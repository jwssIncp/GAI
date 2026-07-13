import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../../../projects/application/services/project-scope.service';
import { CreateExportJobDto } from '../dto/export-job-inputs.dto';
import { ExportJobListQueryDto } from '../dto/export-job-query.dto';
import {
  ExportJobDownloadUrlResponseDto,
  ExportJobListResponseDto,
  ExportJobResponseDto,
} from '../dto/export-job-response.dto';
import { ExportJobAuditOperation } from '../../domain/enums/export-job-audit-operation.enum';
import { ExportJobStatus } from '../../domain/enums/export-job-status.enum';
import { ExportJobAuditLogEntity } from '../../infrastructure/persistence/export-job-audit-log.entity';
import { ExportJobEntity } from '../../infrastructure/persistence/export-job.entity';
import { ExportJobProcessorService } from './export-job-processor.service';

export type ExportJobActorContext = ProjectActorContext;

export interface ExportJobDownloadFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  content: Buffer;
}

@Injectable()
export class ExportJobsService {
  constructor(
    @InjectRepository(ExportJobEntity)
    private readonly jobs: Repository<ExportJobEntity>,
    @InjectRepository(ExportJobAuditLogEntity)
    private readonly audits: Repository<ExportJobAuditLogEntity>,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly projectScope: ProjectScopeService,
    private readonly dataSource: DataSource,
    private readonly processor: ExportJobProcessorService,
  ) {}

  async create(
    projectId: number,
    dto: CreateExportJobDto,
    actor: ExportJobActorContext,
  ): Promise<ExportJobResponseDto> {
    const project = await this.getAuthorizedProject(projectId, actor);
    const now = new Date();
    const saved = await this.dataSource.transaction(async (manager) => {
      const job = manager.getRepository(ExportJobEntity).create({
        organizationId: project.organizationId,
        projectId,
        type: dto.type,
        status: ExportJobStatus.PENDING,
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        fileContent: null,
        checksum: null,
        requestedById: actor.id,
        retryOfId: null,
        attemptCount: 1,
        requestedAt: now,
        startedAt: null,
        finishedAt: null,
        expiresAt: null,
        errorCode: null,
        errorMessage: null,
        deletedAt: null,
      });
      const created = await manager.getRepository(ExportJobEntity).save(job);
      await manager.getRepository(ExportJobAuditLogEntity).save({
        exportJobId: created.id,
        organizationId: created.organizationId,
        projectId: created.projectId,
        operation: ExportJobAuditOperation.REQUEST,
        performedBy: actor.id,
        changes: {
          type: { before: null, after: created.type },
          status: { before: null, after: created.status },
        },
      });
      return created;
    });

    this.processor.enqueue(saved.id);
    return ExportJobResponseDto.fromEntity(saved);
  }

  async list(
    projectId: number,
    query: ExportJobListQueryDto,
    actor: ExportJobActorContext,
  ): Promise<ExportJobListResponseDto> {
    const project = await this.getAuthorizedProject(projectId, actor);
    await this.expireProjectJobs(project.organizationId, projectId);

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const qb = this.jobs
      .createQueryBuilder('job')
      .where('job.organization_id = :organizationId', {
        organizationId: project.organizationId,
      })
      .andWhere('job.project_id = :projectId', { projectId });

    if (query.type) qb.andWhere('job.type = :type', { type: query.type });
    if (query.status)
      qb.andWhere('job.status = :status', { status: query.status });
    if (query.requested_by_id) {
      qb.andWhere('job.requested_by_id = :requestedById', {
        requestedById: query.requested_by_id,
      });
    }
    if (query.date_from) {
      qb.andWhere('job.requested_at >= :dateFrom', {
        dateFrom: new Date(`${query.date_from}T00:00:00.000Z`),
      });
    }
    if (query.date_to) {
      const dateToExclusive = new Date(`${query.date_to}T00:00:00.000Z`);
      dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1);
      qb.andWhere('job.requested_at < :dateToExclusive', { dateToExclusive });
    }
    if (query.search) {
      const search = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(job.file_name) LIKE :search', { search })
            .orWhere('LOWER(job.type) LIKE :search', { search })
            .orWhere('LOWER(job.error_message) LIKE :search', { search });
        }),
      );
    }

    const [items, total] = await qb
      .orderBy('job.created_at', 'DESC')
      .addOrderBy('job.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: items.map((item) => ExportJobResponseDto.fromEntity(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async get(
    projectId: number,
    jobId: number,
    actor: ExportJobActorContext,
  ): Promise<ExportJobResponseDto> {
    const project = await this.getAuthorizedProject(projectId, actor);
    const job = await this.getJobEntity(
      project.organizationId,
      projectId,
      jobId,
    );
    return ExportJobResponseDto.fromEntity(await this.expireIfNeeded(job));
  }

  async cancel(
    projectId: number,
    jobId: number,
    actor: ExportJobActorContext,
  ): Promise<ExportJobResponseDto> {
    const project = await this.getAuthorizedProject(projectId, actor);
    const job = await this.expireIfNeeded(
      await this.getJobEntity(project.organizationId, projectId, jobId),
    );
    if (
      job.status !== ExportJobStatus.PENDING &&
      job.status !== ExportJobStatus.PROCESSING
    ) {
      throw this.transitionConflict('cancel', job.status, [
        ExportJobStatus.PENDING,
        ExportJobStatus.PROCESSING,
      ]);
    }

    const now = new Date();
    const updated = await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(ExportJobEntity)
        .set({
          status: ExportJobStatus.CANCELLED,
          finishedAt: now,
          expiresAt: null,
          fileContent: null,
        })
        .where('id = :jobId', { jobId: job.id })
        .andWhere('status = :status', { status: job.status })
        .execute();
      if (result.affected !== 1) return false;
      await manager.getRepository(ExportJobAuditLogEntity).save({
        exportJobId: job.id,
        organizationId: job.organizationId,
        projectId: job.projectId,
        operation: ExportJobAuditOperation.CANCEL,
        performedBy: actor.id,
        changes: {
          status: { before: job.status, after: ExportJobStatus.CANCELLED },
          finished_at: { before: null, after: now.toISOString() },
        },
      });
      return true;
    });

    if (!updated) {
      throw new ConflictException({
        code: 'EXPORT_JOB_CONCURRENT_MODIFICATION',
        message: 'Export job status changed while it was being cancelled',
        details: { action: 'cancel', export_job_id: job.id },
      });
    }
    return ExportJobResponseDto.fromEntity(
      await this.getJobEntity(project.organizationId, projectId, jobId),
    );
  }

  async retry(
    projectId: number,
    jobId: number,
    actor: ExportJobActorContext,
  ): Promise<ExportJobResponseDto> {
    const project = await this.getAuthorizedProject(projectId, actor);
    const original = await this.expireIfNeeded(
      await this.getJobEntity(project.organizationId, projectId, jobId),
    );
    if (
      original.status !== ExportJobStatus.FAILED &&
      original.status !== ExportJobStatus.CANCELLED &&
      original.status !== ExportJobStatus.EXPIRED
    ) {
      throw this.transitionConflict('retry', original.status, [
        ExportJobStatus.FAILED,
        ExportJobStatus.CANCELLED,
        ExportJobStatus.EXPIRED,
      ]);
    }

    const now = new Date();
    const saved = await this.dataSource.transaction(async (manager) => {
      if (this.dataSource.options.type !== 'sqlite') {
        await manager
          .getRepository(ExportJobEntity)
          .createQueryBuilder('job')
          .setLock('pessimistic_write')
          .where('job.id = :jobId', { jobId: original.id })
          .getOneOrFail();
      }
      const activeRetry = await manager.getRepository(ExportJobEntity).findOne({
        where: {
          retryOfId: original.id,
          status: In([ExportJobStatus.PENDING, ExportJobStatus.PROCESSING]),
        },
        order: { createdAt: 'DESC' },
      });
      if (activeRetry) {
        throw new ConflictException({
          code: 'EXPORT_JOB_ACTIVE_RETRY_EXISTS',
          message: 'An active retry already exists for this export job',
          details: {
            retry_job_id: activeRetry.id,
            status: activeRetry.status,
          },
        });
      }
      const retry = manager.getRepository(ExportJobEntity).create({
        organizationId: original.organizationId,
        projectId: original.projectId,
        type: original.type,
        status: ExportJobStatus.PENDING,
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        fileContent: null,
        checksum: null,
        requestedById: actor.id,
        retryOfId: original.id,
        attemptCount: Number(original.attemptCount) + 1,
        requestedAt: now,
        startedAt: null,
        finishedAt: null,
        expiresAt: null,
        errorCode: null,
        errorMessage: null,
        deletedAt: null,
      });
      const created = await manager.getRepository(ExportJobEntity).save(retry);
      const auditRepo = manager.getRepository(ExportJobAuditLogEntity);
      await auditRepo.save([
        auditRepo.create({
          exportJobId: original.id,
          organizationId: original.organizationId,
          projectId: original.projectId,
          operation: ExportJobAuditOperation.RETRY,
          performedBy: actor.id,
          changes: {
            retry_job_id: { before: null, after: created.id },
          },
        }),
        auditRepo.create({
          exportJobId: created.id,
          organizationId: created.organizationId,
          projectId: created.projectId,
          operation: ExportJobAuditOperation.REQUEST,
          performedBy: actor.id,
          changes: {
            retry_of_id: { before: null, after: original.id },
            status: { before: null, after: ExportJobStatus.PENDING },
          },
        }),
      ]);
      return created;
    });

    this.processor.enqueue(saved.id);
    return ExportJobResponseDto.fromEntity(saved);
  }

  async createDownloadUrl(
    projectId: number,
    jobId: number,
    actor: ExportJobActorContext,
  ): Promise<ExportJobDownloadUrlResponseDto> {
    const project = await this.getAuthorizedProject(projectId, actor);
    const job = await this.assertDownloadable(
      await this.getJobEntity(project.organizationId, projectId, jobId),
    );
    await this.audits.save({
      exportJobId: job.id,
      organizationId: job.organizationId,
      projectId: job.projectId,
      operation: ExportJobAuditOperation.CREATE_DOWNLOAD_URL,
      performedBy: actor.id,
      changes: { authenticated_download_url_created: true },
    });

    return {
      job: ExportJobResponseDto.fromEntity(job),
      download_url: `/api/v1/projects/${projectId}/export-jobs/${jobId}/download`,
      expires_in_seconds: Math.max(
        0,
        Math.floor((job.expiresAt!.getTime() - Date.now()) / 1000),
      ),
      requires_authentication: true,
    };
  }

  async download(
    projectId: number,
    jobId: number,
    actor: ExportJobActorContext,
  ): Promise<ExportJobDownloadFile> {
    const project = await this.getAuthorizedProject(projectId, actor);
    const summary = await this.assertDownloadable(
      await this.getJobEntity(project.organizationId, projectId, jobId),
    );
    const job = await this.jobs
      .createQueryBuilder('job')
      .addSelect('job.fileContent')
      .where('job.id = :jobId', { jobId })
      .andWhere('job.project_id = :projectId', { projectId })
      .andWhere('job.organization_id = :organizationId', {
        organizationId: project.organizationId,
      })
      .getOneOrFail();
    if (!job.fileContent) {
      throw new ConflictException({
        code: 'EXPORT_FILE_NOT_READY',
        message: 'Export file content is not available',
        details: { status: summary.status, export_job_id: summary.id },
      });
    }

    await this.audits.save({
      exportJobId: job.id,
      organizationId: job.organizationId,
      projectId: job.projectId,
      operation: ExportJobAuditOperation.DOWNLOAD,
      performedBy: actor.id,
      changes: { downloaded: true },
    });
    return {
      fileName: summary.fileName!,
      mimeType: summary.mimeType!,
      sizeBytes: Number(summary.sizeBytes),
      checksum: summary.checksum!,
      content: Buffer.isBuffer(job.fileContent)
        ? job.fileContent
        : Buffer.from(job.fileContent),
    };
  }

  private async getAuthorizedProject(
    projectId: number,
    actor: ExportJobActorContext,
  ) {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.projectScope.assertCanAccessProject(actor, project.organizationId);
    return project;
  }

  private async getJobEntity(
    organizationId: number,
    projectId: number,
    jobId: number,
  ): Promise<ExportJobEntity> {
    const job = await this.jobs.findOne({
      where: { id: jobId, organizationId, projectId },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Export job not found',
      });
    }
    return job;
  }

  private async assertDownloadable(
    job: ExportJobEntity,
  ): Promise<ExportJobEntity> {
    const current = await this.expireIfNeeded(job);
    if (current.status === ExportJobStatus.EXPIRED) {
      throw new GoneException({
        code: 'EXPORT_JOB_EXPIRED',
        message: 'Export file has expired',
      });
    }
    if (
      current.status !== ExportJobStatus.FINISHED ||
      !current.fileName ||
      !current.mimeType ||
      current.sizeBytes === null ||
      !current.checksum ||
      !current.expiresAt
    ) {
      throw new ConflictException({
        code: 'EXPORT_FILE_NOT_READY',
        message: 'Export file is not available for download',
        details: { status: current.status, export_job_id: current.id },
      });
    }
    return current;
  }

  private async expireProjectJobs(
    organizationId: number,
    projectId: number,
  ): Promise<void> {
    const expired = await this.jobs.find({
      where: {
        organizationId,
        projectId,
        status: ExportJobStatus.FINISHED,
        expiresAt: LessThanOrEqual(new Date()),
      },
      take: 100,
    });
    for (const job of expired) await this.expireJob(job);
  }

  private async expireIfNeeded(job: ExportJobEntity): Promise<ExportJobEntity> {
    if (
      job.status === ExportJobStatus.FINISHED &&
      job.expiresAt &&
      job.expiresAt.getTime() <= Date.now()
    ) {
      await this.expireJob(job);
      return this.getJobEntity(job.organizationId, job.projectId, job.id);
    }
    return job;
  }

  private async expireJob(job: ExportJobEntity): Promise<void> {
    const now = new Date();
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

  private transitionConflict(
    action: string,
    status: ExportJobStatus,
    allowedStatuses: ExportJobStatus[],
  ): ConflictException {
    return new ConflictException({
      code: 'EXPORT_JOB_STATUS_TRANSITION_NOT_ALLOWED',
      message: `Export job cannot ${action} from status ${status}`,
      details: {
        action,
        current_status: status,
        allowed_statuses: allowedStatuses,
      },
    });
  }
}
