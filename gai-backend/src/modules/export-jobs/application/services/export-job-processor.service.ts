import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { ExportJobAuditOperation } from '../../domain/enums/export-job-audit-operation.enum';
import { ExportJobStatus } from '../../domain/enums/export-job-status.enum';
import { ExportJobAuditLogEntity } from '../../infrastructure/persistence/export-job-audit-log.entity';
import { ExportJobEntity } from '../../infrastructure/persistence/export-job.entity';
import {
  ExportRowLimitExceededError,
  ExportWorkbookBuilderService,
} from './export-workbook-builder.service';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class ExportJobProcessorService
  implements OnModuleInit, OnModuleDestroy
{
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly scheduled = new Map<
    number,
    ReturnType<typeof setImmediate>
  >();
  private readonly running = new Set<Promise<void>>();
  private draining = false;
  private destroyed = false;

  constructor(
    @InjectRepository(ExportJobEntity)
    private readonly jobs: Repository<ExportJobEntity>,
    private readonly dataSource: DataSource,
    private readonly workbookBuilder: ExportWorkbookBuilderService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ExportJobProcessorService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.recoverStaleJobs();
    await this.expireFinishedJobs();
    await this.drainPendingJobs();
    this.pollTimer = setInterval(() => {
      void this.runMaintenanceCycle();
    }, this.pollIntervalMs());
    this.pollTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    for (const handle of this.scheduled.values()) clearImmediate(handle);
    this.scheduled.clear();
    await Promise.allSettled([...this.running]);
  }

  enqueue(jobId: number): void {
    if (
      this.destroyed ||
      this.running.size + this.scheduled.size >= this.maxConcurrency() ||
      this.scheduled.has(jobId) ||
      [...this.running].some(
        (running) =>
          (running as Promise<void> & { jobId?: number }).jobId === jobId,
      )
    ) {
      return;
    }

    const handle = setImmediate(() => {
      this.scheduled.delete(jobId);
      if (this.destroyed) return;

      const work = this.processJob(jobId)
        .catch((error: unknown) => {
          this.logger.error({
            operation: 'PROCESS_EXPORT_JOB',
            exportJobId: jobId,
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          this.running.delete(work);
          void this.drainPendingJobs();
        });
      (work as Promise<void> & { jobId?: number }).jobId = jobId;
      this.running.add(work);
    });
    this.scheduled.set(jobId, handle);
  }

  async processJob(jobId: number): Promise<void> {
    const job = await this.claimJob(jobId);
    if (!job) return;

    try {
      const content = await this.workbookBuilder.build(job);
      if (content.length > this.maxFileSizeBytes()) {
        throw new Error(
          'Generated export exceeds the configured file size limit',
        );
      }
      await this.finishJob(job, content);
    } catch (error) {
      await this.failJob(job, error);
    }
  }

  private async drainPendingJobs(): Promise<void> {
    if (this.destroyed || this.draining) return;
    this.draining = true;
    try {
      const availableSlots =
        this.maxConcurrency() - this.running.size - this.scheduled.size;
      if (availableSlots <= 0) return;
      const pending = await this.jobs
        .createQueryBuilder('job')
        .select('job.id', 'id')
        .where('job.status = :status', { status: ExportJobStatus.PENDING })
        .orderBy('job.created_at', 'ASC')
        .limit(availableSlots)
        .getRawMany<{ id: number | string }>();
      for (const row of pending) this.enqueue(Number(row.id));
    } finally {
      this.draining = false;
    }
  }

  private async runMaintenanceCycle(): Promise<void> {
    try {
      await this.expireFinishedJobs();
      await this.drainPendingJobs();
    } catch (error) {
      this.logger.error({
        operation: 'EXPORT_JOB_MAINTENANCE',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private claimJob(jobId: number): Promise<ExportJobEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const result = await manager
        .createQueryBuilder()
        .update(ExportJobEntity)
        .set({
          status: ExportJobStatus.PROCESSING,
          startedAt: now,
          finishedAt: null,
          expiresAt: null,
          errorCode: null,
          errorMessage: null,
        })
        .where('id = :jobId', { jobId })
        .andWhere('status = :status', { status: ExportJobStatus.PENDING })
        .execute();

      if (result.affected !== 1) return null;
      const job = await manager.getRepository(ExportJobEntity).findOneByOrFail({
        id: jobId,
      });
      await manager.getRepository(ExportJobAuditLogEntity).save({
        exportJobId: job.id,
        organizationId: job.organizationId,
        projectId: job.projectId,
        operation: ExportJobAuditOperation.START,
        performedBy: null,
        changes: {
          status: {
            before: ExportJobStatus.PENDING,
            after: ExportJobStatus.PROCESSING,
          },
          started_at: { before: null, after: now.toISOString() },
        },
      });
      return job;
    });
  }

  private async finishJob(
    job: ExportJobEntity,
    content: Buffer,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.retentionDays() * 24 * 60 * 60 * 1000,
    );
    const checksum = createHash('sha256').update(content).digest('hex');
    const fileName = `project-${job.projectId}-${job.type}-${job.id}.xlsx`;

    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(ExportJobEntity)
        .set({
          status: ExportJobStatus.FINISHED,
          fileName,
          mimeType: XLSX_MIME,
          sizeBytes: content.length,
          fileContent: content,
          checksum,
          finishedAt: now,
          expiresAt,
          errorCode: null,
          errorMessage: null,
        })
        .where('id = :jobId', { jobId: job.id })
        .andWhere('status = :status', { status: ExportJobStatus.PROCESSING })
        .execute();

      // A concurrent cancellation wins and the generated bytes are discarded.
      if (result.affected !== 1) return;
      await manager.getRepository(ExportJobAuditLogEntity).save({
        exportJobId: job.id,
        organizationId: job.organizationId,
        projectId: job.projectId,
        operation: ExportJobAuditOperation.FINISH,
        performedBy: null,
        changes: {
          status: {
            before: ExportJobStatus.PROCESSING,
            after: ExportJobStatus.FINISHED,
          },
          size_bytes: { before: null, after: content.length },
          checksum: { before: null, after: checksum },
          expires_at: { before: null, after: expiresAt.toISOString() },
        },
      });
    });
  }

  private async failJob(job: ExportJobEntity, error: unknown): Promise<void> {
    const now = new Date();
    const errorCode =
      error instanceof ExportRowLimitExceededError
        ? 'EXPORT_ROW_LIMIT_EXCEEDED'
        : 'EXPORT_GENERATION_FAILED';
    const message = (
      error instanceof Error ? error.message : 'Unknown export generation error'
    ).slice(0, 2000);

    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(ExportJobEntity)
        .set({
          status: ExportJobStatus.FAILED,
          finishedAt: now,
          errorCode,
          errorMessage: message,
          fileContent: null,
        })
        .where('id = :jobId', { jobId: job.id })
        .andWhere('status = :status', { status: ExportJobStatus.PROCESSING })
        .execute();
      if (result.affected !== 1) return;
      await manager.getRepository(ExportJobAuditLogEntity).save({
        exportJobId: job.id,
        organizationId: job.organizationId,
        projectId: job.projectId,
        operation: ExportJobAuditOperation.FAIL,
        performedBy: null,
        changes: {
          status: {
            before: ExportJobStatus.PROCESSING,
            after: ExportJobStatus.FAILED,
          },
          error_code: { before: null, after: errorCode },
          error_message: { before: null, after: message },
        },
      });
    });
  }

  private async recoverStaleJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - this.staleAfterMs());
    const staleJobs = await this.jobs.find({
      where: {
        status: ExportJobStatus.PROCESSING,
        startedAt: LessThan(cutoff),
      },
      take: 100,
    });

    for (const job of staleJobs) {
      const recovered = await this.dataSource.transaction(async (manager) => {
        const result = await manager
          .createQueryBuilder()
          .update(ExportJobEntity)
          .set({ status: ExportJobStatus.PENDING, startedAt: null })
          .where('id = :jobId', { jobId: job.id })
          .andWhere('status = :status', {
            status: ExportJobStatus.PROCESSING,
          })
          .andWhere('started_at < :cutoff', { cutoff })
          .execute();
        if (result.affected !== 1) return false;
        await manager.getRepository(ExportJobAuditLogEntity).save({
          exportJobId: job.id,
          organizationId: job.organizationId,
          projectId: job.projectId,
          operation: ExportJobAuditOperation.RECOVER_STALE,
          performedBy: null,
          changes: {
            status: {
              before: ExportJobStatus.PROCESSING,
              after: ExportJobStatus.PENDING,
            },
          },
        });
        return true;
      });
      if (recovered) this.enqueue(job.id);
    }
  }

  private async expireFinishedJobs(): Promise<void> {
    const now = new Date();
    const expired = await this.jobs.find({
      where: {
        status: ExportJobStatus.FINISHED,
        expiresAt: LessThanOrEqual(now),
      },
      order: { expiresAt: 'ASC' },
      take: 100,
    });

    for (const job of expired) {
      await this.dataSource.transaction(async (manager) => {
        const result = await manager
          .createQueryBuilder()
          .update(ExportJobEntity)
          .set({ status: ExportJobStatus.EXPIRED, fileContent: null })
          .where('id = :jobId', { jobId: job.id })
          .andWhere('status = :status', { status: ExportJobStatus.FINISHED })
          .andWhere('expires_at <= :now', { now })
          .execute();
        if (result.affected !== 1) return;
        await manager.getRepository(ExportJobAuditLogEntity).save({
          exportJobId: job.id,
          organizationId: job.organizationId,
          projectId: job.projectId,
          operation: ExportJobAuditOperation.EXPIRE,
          performedBy: null,
          changes: {
            status: {
              before: ExportJobStatus.FINISHED,
              after: ExportJobStatus.EXPIRED,
            },
            file_content: { before: 'stored', after: null },
          },
        });
      });
    }
  }

  private pollIntervalMs(): number {
    return this.positiveNumber(process.env.EXPORT_JOB_POLL_INTERVAL_MS, 1000);
  }

  private staleAfterMs(): number {
    return (
      this.positiveNumber(process.env.EXPORT_JOB_STALE_AFTER_MINUTES, 60) *
      60 *
      1000
    );
  }

  private retentionDays(): number {
    return this.positiveNumber(process.env.EXPORT_JOB_RETENTION_DAYS, 7);
  }

  private maxConcurrency(): number {
    return Math.max(
      1,
      Math.floor(
        this.positiveNumber(process.env.EXPORT_JOB_MAX_CONCURRENCY, 2),
      ),
    );
  }

  private maxFileSizeBytes(): number {
    // Stay below MySQL MEDIUMBLOB's 16 MiB limit.
    return Math.min(
      16_000_000,
      this.positiveNumber(
        process.env.EXPORT_JOB_MAX_FILE_SIZE_BYTES,
        15 * 1024 * 1024,
      ),
    );
  }

  private positiveNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
