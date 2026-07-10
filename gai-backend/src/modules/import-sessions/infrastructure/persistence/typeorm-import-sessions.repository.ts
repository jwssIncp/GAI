import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ImportAuditEntry,
  ImportSessionsRepository,
  ListImportErrorsParams,
  ListImportPayloadsParams,
  ListImportSessionsParams,
} from '../../domain/ports/import-sessions.repository.port';
import { ImportFileEntity } from './import-file.entity';
import { ImportPayloadEntity } from './import-payload.entity';
import { ImportPayloadErrorEntity } from './import-payload-error.entity';
import { ImportSessionAuditLogEntity } from './import-session-audit-log.entity';
import { ImportSessionEntity } from './import-session.entity';

@Injectable()
export class TypeOrmImportSessionsRepository implements ImportSessionsRepository {
  constructor(
    @InjectRepository(ImportSessionEntity)
    private readonly sessions: Repository<ImportSessionEntity>,
    @InjectRepository(ImportPayloadEntity)
    private readonly payloads: Repository<ImportPayloadEntity>,
    @InjectRepository(ImportPayloadErrorEntity)
    private readonly errors: Repository<ImportPayloadErrorEntity>,
    @InjectRepository(ImportFileEntity)
    private readonly files: Repository<ImportFileEntity>,
    @InjectRepository(ImportSessionAuditLogEntity)
    private readonly auditLogs: Repository<ImportSessionAuditLogEntity>,
  ) {}

  findSessionById(id: number): Promise<ImportSessionEntity | null> {
    return this.sessions.findOne({ where: { id } });
  }

  findSessionByUuid(uuid: string): Promise<ImportSessionEntity | null> {
    return this.sessions.findOne({ where: { sessionUuid: uuid } });
  }

  async listSessions(
    params: ListImportSessionsParams,
  ): Promise<{ items: ImportSessionEntity[]; total: number }> {
    const qb = this.sessions
      .createQueryBuilder('session')
      .where('session.organizationId = :organizationId', {
        organizationId: params.organizationId,
      })
      .andWhere('session.projectId = :projectId', {
        projectId: params.projectId,
      });
    if (params.status)
      qb.andWhere('session.status = :status', { status: params.status });
    qb.orderBy('session.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  saveSession(
    session: ImportSessionEntity,
    audit: ImportAuditEntry,
  ): Promise<ImportSessionEntity> {
    return this.sessions.manager.transaction(async (manager) => {
      const saved = await manager
        .getRepository(ImportSessionEntity)
        .save(session);
      await manager.getRepository(ImportSessionAuditLogEntity).save({
        organizationId: audit.organizationId,
        projectId: audit.projectId,
        importSessionId: audit.importSessionId ?? saved.id,
        importPayloadId: audit.importPayloadId ?? null,
        importFileId: audit.importFileId ?? null,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });
      return saved;
    });
  }

  findPayloadById(id: number): Promise<ImportPayloadEntity | null> {
    return this.payloads.findOne({ where: { id } });
  }

  findPayloadByNumber(
    sessionId: number,
    payloadNumber: number,
  ): Promise<ImportPayloadEntity | null> {
    return this.payloads.findOne({
      where: { importSessionId: sessionId, payloadNumber },
    });
  }

  findPayloadByIdempotencyKey(
    sessionId: number,
    idempotencyKey: string,
  ): Promise<ImportPayloadEntity | null> {
    return this.payloads.findOne({
      where: { importSessionId: sessionId, idempotencyKey },
    });
  }

  async listPayloads(
    params: ListImportPayloadsParams,
  ): Promise<{ items: ImportPayloadEntity[]; total: number }> {
    const [items, total] = await this.payloads.findAndCount({
      where: {
        organizationId: params.organizationId,
        importSessionId: params.importSessionId,
      },
      order: { payloadNumber: 'ASC' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    });
    return { items, total };
  }

  savePayloadWithAudit(
    payload: ImportPayloadEntity,
    audit: ImportAuditEntry,
  ): Promise<ImportPayloadEntity> {
    return this.payloads.manager.transaction(async (manager) => {
      const saved = await manager
        .getRepository(ImportPayloadEntity)
        .save(payload);
      await manager.getRepository(ImportSessionAuditLogEntity).save({
        organizationId: audit.organizationId,
        projectId: audit.projectId,
        importSessionId: audit.importSessionId,
        importPayloadId: audit.importPayloadId ?? saved.id,
        importFileId: audit.importFileId ?? null,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });
      return saved;
    });
  }

  async listErrors(
    params: ListImportErrorsParams,
  ): Promise<{ items: ImportPayloadErrorEntity[]; total: number }> {
    const where: {
      organizationId: number;
      importSessionId: number;
      importPayloadId?: number;
    } = {
      organizationId: params.organizationId,
      importSessionId: params.importSessionId,
    };
    if (params.importPayloadId) where.importPayloadId = params.importPayloadId;
    const [items, total] = await this.errors.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    });
    return { items, total };
  }

  findFileById(id: number): Promise<ImportFileEntity | null> {
    return this.files.findOne({ where: { id } });
  }

  listFiles(
    sessionId: number,
    organizationId: number,
  ): Promise<ImportFileEntity[]> {
    return this.files.find({
      where: { importSessionId: sessionId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  saveFileWithAudit(
    file: ImportFileEntity,
    audit: ImportAuditEntry,
  ): Promise<ImportFileEntity> {
    return this.files.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(ImportFileEntity).save(file);
      await manager.getRepository(ImportSessionAuditLogEntity).save({
        organizationId: audit.organizationId,
        projectId: audit.projectId,
        importSessionId: audit.importSessionId,
        importPayloadId: audit.importPayloadId ?? null,
        importFileId: audit.importFileId ?? saved.id,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });
      return saved;
    });
  }

  async audit(audit: ImportAuditEntry): Promise<void> {
    await this.auditLogs.save({
      organizationId: audit.organizationId,
      projectId: audit.projectId,
      importSessionId: audit.importSessionId ?? null,
      importPayloadId: audit.importPayloadId ?? null,
      importFileId: audit.importFileId ?? null,
      operation: audit.operation,
      performedBy: audit.performedBy,
      changes: audit.changes,
    });
  }
}
