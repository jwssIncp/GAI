import { createHash, randomUUID } from 'crypto';
import { isExplicitInstant } from '../../../../common/validation/instant-date';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { identityTransaction } from '../../../auth/infrastructure/persistence/identity-transaction';
import { InventoryItemImageAuditOperation } from '../../../inventory-item-images/domain/enums/inventory-item-image-audit-operation.enum';
import { InventoryItemImageStatus } from '../../../inventory-item-images/domain/enums/inventory-item-image-status.enum';
import { InventoryItemImageAuditLogEntity } from '../../../inventory-item-images/infrastructure/persistence/inventory-item-image-audit-log.entity';
import { InventoryItemImageEntity } from '../../../inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import {
  STORAGE_SIGNER,
  type StorageSigner,
} from '../../../../common/storage/storage-signer.port';
import { InventoryItemAuditOperation } from '../../../inventory-items/domain/enums/inventory-item-audit-operation.enum';
import { InventoryItemStatus } from '../../../inventory-items/domain/enums/inventory-item-status.enum';
import { InventoryItemAuditLogEntity } from '../../../inventory-items/infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryItemEntity } from '../../../inventory-items/infrastructure/persistence/inventory-item.entity';
import { ProjectFieldAgentStatus } from '../../../field-agents/domain/enums/project-field-agent-status.enum';
import { ProjectFieldAgentEntity } from '../../../field-agents/infrastructure/persistence/project-field-agent.entity';
import { FieldAgentEntity } from '../../../field-agents/infrastructure/persistence/field-agent.entity';
import { FieldAgentStatus } from '../../../field-agents/domain/enums/field-agent-status.enum';
import {
  InventoryObservationResult,
  InventoryRoundStatus,
  InventorySessionStatus,
  PlateEvidenceSource,
} from '../../../inventory-operations/domain/inventory-operation.enums';
import {
  InventoryObservationEntity,
  InventoryOperationAuditLogEntity,
  InventoryPlateHistoryEntity,
  InventoryRoundEntity,
  InventorySessionEntity,
} from '../../../inventory-operations/infrastructure/persistence/inventory-operation.entity';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { ImportFileStatus } from '../../domain/enums/import-file-status.enum';
import { ImportOperation } from '../../domain/enums/import-operation.enum';
import { ImportPayloadStatus } from '../../domain/enums/import-payload-status.enum';
import { ImportSessionStatus } from '../../domain/enums/import-session-status.enum';
import {
  IMPORT_SESSIONS_REPOSITORY,
  type ImportSessionsRepository,
} from '../../domain/ports/import-sessions.repository.port';
import { ImportFileEntity } from '../../infrastructure/persistence/import-file.entity';
import { ImportPayloadEntity } from '../../infrastructure/persistence/import-payload.entity';
import { ImportPayloadErrorEntity } from '../../infrastructure/persistence/import-payload-error.entity';
import { ImportSessionAuditLogEntity } from '../../infrastructure/persistence/import-session-audit-log.entity';
import { ImportSessionEntity } from '../../infrastructure/persistence/import-session.entity';
import {
  ConfirmImportFileUploadDto,
  CreateImportFileUploadDto,
  CreateImportPayloadDto,
  CreateImportSessionDto,
  ImportItemOperation,
  ImportPayloadItemDto,
  ImportPhysicalObservationsFileDto,
} from '../dto/import-sessions-inputs';
import { ImportFileType } from '../../domain/enums/import-file-type.enum';
import { ImportSessionType } from '../../domain/enums/import-session-type.enum';
import { ImportSessionSource } from '../../domain/enums/import-session-source.enum';
import { PhysicalObservationImportParserService } from './physical-observation-import-parser.service';
import {
  ImportPagedQueryDto,
  ImportSessionListQueryDto,
} from '../dto/import-sessions-query.dto';
import {
  ImportFileDownloadUrlResponseDto,
  ImportFileResponseDto,
  ImportFileUploadUrlResponseDto,
  ImportPayloadErrorListResponseDto,
  ImportPayloadErrorResponseDto,
  ImportPayloadListResponseDto,
  ImportPayloadResponseDto,
  ImportSessionListResponseDto,
  ImportSessionResponseDto,
} from '../dto/import-sessions-response.dto';
import {
  ImportSessionActorContext,
  ImportSessionScopeService,
} from './import-session-scope.service';

type Counts = {
  created: number;
  updated: number;
  deleted: number;
  failed: number;
};

@Injectable()
export class ImportSessionsService {
  constructor(
    @Inject(IMPORT_SESSIONS_REPOSITORY)
    private readonly repo: ImportSessionsRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(STORAGE_SIGNER) private readonly storageSigner: StorageSigner,
    @InjectRepository(ImportSessionEntity)
    private readonly sessionRepo: Repository<ImportSessionEntity>,
    private readonly dataSource: DataSource,
    private readonly scope: ImportSessionScopeService,
    private readonly logger: PinoLogger,
    private readonly physicalParser: PhysicalObservationImportParserService,
  ) {
    this.logger.setContext(ImportSessionsService.name);
  }

  async createSession(
    projectId: number,
    dto: CreateImportSessionDto,
    actor: ImportSessionActorContext,
    options: { ttlHours?: number } = {},
  ): Promise<ImportSessionResponseDto> {
    const project = await this.getProject(projectId, actor, true);
    const now = new Date();
    const ttlHours = options.ttlHours ?? this.scope.sessionTtlHours();
    const session = this.sessionRepo.create({
      organizationId: project.organizationId,
      projectId,
      type: dto.type,
      source: dto.source,
      status: ImportSessionStatus.OPEN,
      sessionUuid: randomUUID(),
      expectedPayloads: dto.expected_payloads ?? null,
      receivedPayloads: 0,
      processedPayloads: 0,
      failedPayloads: 0,
      totalItems: 0,
      totalImages: 0,
      totalCreated: 0,
      totalUpdated: 0,
      totalDeleted: 0,
      totalFailed: 0,
      rawBackupPath: null,
      createdById: actor.id,
      startedAt: now,
      finishedAt: null,
      expiresAt: new Date(now.getTime() + ttlHours * 3600000),
      errorMessage: null,
      metadata: dto.metadata ?? null,
    });
    const saved = await this.repo.saveSession(session, {
      organizationId: project.organizationId,
      projectId,
      operation: ImportOperation.CREATE_SESSION,
      performedBy: actor.id,
      changes: { status: { before: null, after: ImportSessionStatus.OPEN } },
    });
    this.logger.info(
      { sessionId: saved.id, projectId },
      'import session created',
    );
    return ImportSessionResponseDto.fromEntity(saved);
  }

  async listSessions(
    projectId: number,
    query: ImportSessionListQueryDto,
    actor: ImportSessionActorContext,
  ): Promise<ImportSessionListResponseDto> {
    const project = await this.getProject(projectId, actor, false);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repo.listSessions({
      page,
      pageSize,
      organizationId: project.organizationId,
      projectId,
      status: query.status,
    });
    return this.paginate(
      items.map((item) => ImportSessionResponseDto.fromEntity(item)),
      page,
      pageSize,
      total,
    );
  }

  async getSession(
    projectId: number,
    sessionId: number,
    actor: ImportSessionActorContext,
  ): Promise<ImportSessionResponseDto> {
    return ImportSessionResponseDto.fromEntity(
      await this.findSession(projectId, sessionId, actor, false),
    );
  }

  async getSessionByUuid(
    projectId: number,
    sessionUuid: string,
    actor: ImportSessionActorContext,
  ): Promise<ImportSessionResponseDto> {
    const session = await this.repo.findSessionByUuid(sessionUuid);
    if (!session || Number(session.projectId) !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Import session not found',
      });
    }
    await this.assertSessionScope(projectId, session, actor, false);
    return ImportSessionResponseDto.fromEntity(session);
  }

  async receivePayload(
    projectId: number,
    sessionId: number,
    dto: CreateImportPayloadDto,
    actor: ImportSessionActorContext,
  ): Promise<ImportPayloadResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, true);
    this.assertSessionAcceptsPayload(session);
    this.assertPayloadLimits(dto);
    const contentHash = this.contentHash(dto);
    const duplicate = await this.findDuplicate(session, dto, contentHash);
    if (duplicate) return ImportPayloadResponseDto.fromEntity(duplicate);

    const payload = new ImportPayloadEntity();
    payload.organizationId = session.organizationId;
    payload.importSessionId = session.id;
    payload.payloadNumber = dto.payload_number;
    payload.idempotencyKey = dto.idempotency_key;
    payload.checksum = dto.checksum ?? null;
    payload.contentHash = contentHash;
    payload.status = ImportPayloadStatus.RECEIVED;
    payload.itemsCount = dto.items.length;
    payload.imagesCount = this.countImages(dto.items);
    payload.createdCount = 0;
    payload.updatedCount = 0;
    payload.deletedCount = 0;
    payload.failedCount = 0;
    payload.rawPayloadPath =
      dto.raw_payload_path ??
      `organizations/${session.organizationId}/imports/${session.id}/payload-${dto.payload_number}.json`;
    payload.receivedAt = new Date();
    payload.processedAt = null;
    payload.errorMessage = null;
    payload.metadata = dto.metadata ?? null;
    payload.payload = { items: dto.items };

    let saved: ImportPayloadEntity;
    try {
      saved = await this.repo.savePayloadWithAudit(payload, {
        organizationId: session.organizationId,
        projectId,
        importSessionId: session.id,
        operation: ImportOperation.RECEIVE_PAYLOAD,
        performedBy: actor.id,
        changes: { payload_number: dto.payload_number },
      });
    } catch (error) {
      // Concurrent duplicate (same number/key): the unique index wins; answer
      // like a replay, or 409 if the content differs.
      const raced = await this.findDuplicate(session, dto, contentHash);
      if (raced) return ImportPayloadResponseDto.fromEntity(raced);
      throw error;
    }
    await this.processPayload(projectId, session.id, saved.id, actor);
    return ImportPayloadResponseDto.fromEntity(
      (await this.repo.findPayloadById(saved.id))!,
    );
  }

  async listPayloads(
    projectId: number,
    sessionId: number,
    query: ImportPagedQueryDto,
    actor: ImportSessionActorContext,
  ): Promise<ImportPayloadListResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, false);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repo.listPayloads({
      page,
      pageSize,
      organizationId: session.organizationId,
      importSessionId: session.id,
    });
    return this.paginate(
      items.map((item) => ImportPayloadResponseDto.fromEntity(item)),
      page,
      pageSize,
      total,
    );
  }

  async getPayload(
    projectId: number,
    sessionId: number,
    payloadId: number,
    actor: ImportSessionActorContext,
  ): Promise<ImportPayloadResponseDto> {
    await this.findSession(projectId, sessionId, actor, false);
    const payload = await this.findPayload(sessionId, payloadId);
    return ImportPayloadResponseDto.fromEntity(payload);
  }

  async finishSession(
    projectId: number,
    sessionId: number,
    actor: ImportSessionActorContext,
  ): Promise<ImportSessionResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, true);
    this.assertSessionAcceptsPayload(session);
    if (
      session.expectedPayloads &&
      session.receivedPayloads < session.expectedPayloads
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Expected payloads were not fully received',
      });
    }
    const { items: pending } = await this.repo.listPayloads({
      page: 1,
      pageSize: 1,
      organizationId: session.organizationId,
      importSessionId: session.id,
      status: ImportPayloadStatus.PROCESSING,
    });
    if (pending.length)
      throw new ConflictException({
        code: 'IMPORT_PAYLOAD_PROCESSING',
        message: 'There are payloads still processing',
      });
    const failed = Number(session.totalFailed);
    const applied =
      Number(session.totalCreated) +
      Number(session.totalUpdated) +
      Number(session.totalDeleted);
    session.status =
      failed === 0
        ? ImportSessionStatus.FINISHED
        : applied > 0
          ? ImportSessionStatus.FINISHED_WITH_ERRORS
          : ImportSessionStatus.FAILED;
    session.finishedAt = new Date();
    const saved = await this.repo.saveSession(session, {
      organizationId: session.organizationId,
      projectId,
      importSessionId: session.id,
      operation: ImportOperation.FINISH_SESSION,
      performedBy: actor.id,
      changes: { status: session.status },
    });
    return ImportSessionResponseDto.fromEntity(saved);
  }

  async cancelSession(
    projectId: number,
    sessionId: number,
    actor: ImportSessionActorContext,
  ): Promise<ImportSessionResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, true);
    if (this.isTerminal(session.status))
      throw new ConflictException({
        code: 'IMPORT_SESSION_TERMINAL',
        message: 'Import session is already closed',
      });
    session.status = ImportSessionStatus.CANCELLED;
    session.finishedAt = new Date();
    const saved = await this.repo.saveSession(session, {
      organizationId: session.organizationId,
      projectId,
      importSessionId: session.id,
      operation: ImportOperation.CANCEL_SESSION,
      performedBy: actor.id,
      changes: { status: ImportSessionStatus.CANCELLED },
    });
    return ImportSessionResponseDto.fromEntity(saved);
  }

  async retrySession(
    projectId: number,
    sessionId: number,
    actor: ImportSessionActorContext,
  ): Promise<ImportSessionResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, true);
    const { items } = await this.repo.listPayloads({
      page: 1,
      pageSize: 100,
      organizationId: session.organizationId,
      importSessionId: session.id,
    });
    this.assertSessionAcceptsPayload(session);
    for (const payload of items.filter((item) => this.isReprocessable(item))) {
      await this.processPayload(projectId, session.id, payload.id, actor);
    }
    await this.repo.audit({
      organizationId: session.organizationId,
      projectId,
      importSessionId: session.id,
      operation: ImportOperation.RETRY_SESSION,
      performedBy: actor.id,
      changes: { retried: true },
    });
    return ImportSessionResponseDto.fromEntity(
      (await this.repo.findSessionById(session.id))!,
    );
  }

  async reprocessPayload(
    projectId: number,
    sessionId: number,
    payloadId: number,
    actor: ImportSessionActorContext,
  ): Promise<ImportPayloadResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, true);
    this.assertSessionAcceptsPayload(session);
    const payload = await this.findPayload(sessionId, payloadId);
    if (!this.isReprocessable(payload)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'Only failed payloads (or payloads stuck in processing) can be reprocessed',
      });
    }
    await this.processPayload(projectId, sessionId, payloadId, actor);
    return ImportPayloadResponseDto.fromEntity(
      (await this.repo.findPayloadById(payloadId))!,
    );
  }

  async listErrors(
    projectId: number,
    sessionId: number,
    query: ImportPagedQueryDto,
    actor: ImportSessionActorContext,
    payloadId?: number,
  ): Promise<ImportPayloadErrorListResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, false);
    if (payloadId) await this.findPayload(sessionId, payloadId);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repo.listErrors({
      page,
      pageSize,
      organizationId: session.organizationId,
      importSessionId: session.id,
      importPayloadId: payloadId,
    });
    return this.paginate(
      items.map((item) => ImportPayloadErrorResponseDto.fromEntity(item)),
      page,
      pageSize,
      total,
    );
  }

  async createFileUploadUrl(
    projectId: number,
    sessionId: number,
    dto: CreateImportFileUploadDto,
    actor: ImportSessionActorContext,
  ): Promise<ImportFileUploadUrlResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, true);
    this.assertSessionAcceptsPayload(session);
    this.scope.assertFileForType(dto.type, dto.mime_type, dto.size_bytes);
    const file = new ImportFileEntity();
    file.organizationId = session.organizationId;
    file.importSessionId = session.id;
    file.importPayloadId = null;
    file.type = dto.type;
    file.storageProvider = this.scope.storageProvider();
    file.bucket = this.scope.storageBucket();
    file.path = this.scope.buildImportFilePath({
      organizationId: session.organizationId,
      sessionId: session.id,
      storageKey: randomUUID(),
      originalName: dto.original_name,
    });
    file.originalName = dto.original_name;
    file.mimeType = dto.mime_type;
    file.sizeBytes = dto.size_bytes;
    file.checksum = null;
    file.status = ImportFileStatus.PENDING_UPLOAD;
    file.uploadedById = actor.id;
    const signed = await this.storageSigner.createUploadUrl({
      bucket: file.bucket,
      path: file.path,
      mimeType: file.mimeType,
      expiresInSeconds: this.scope.uploadTtlSeconds(file.type),
      sizeBytes: Number(file.sizeBytes),
      checksum: file.checksum,
    });

    const saved = await this.repo.saveFileWithAudit(file, {
      organizationId: session.organizationId,
      projectId,
      importSessionId: session.id,
      operation: ImportOperation.CREATE_FILE,
      performedBy: actor.id,
      changes: { status: ImportFileStatus.PENDING_UPLOAD },
    });
    return {
      file: ImportFileResponseDto.fromEntity(saved),
      upload_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }

  async confirmFileUpload(
    projectId: number,
    sessionId: number,
    fileId: number,
    dto: ConfirmImportFileUploadDto,
    actor: ImportSessionActorContext,
  ): Promise<ImportFileResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, true);
    const file = await this.findFile(
      session.id,
      fileId,
      session.organizationId,
    );
    if (file.status === ImportFileStatus.UPLOADED)
      return ImportFileResponseDto.fromEntity(file);
    if (file.status !== ImportFileStatus.PENDING_UPLOAD)
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending files can be confirmed',
      });
    const verified = await this.storageSigner.verifyUpload({
      bucket: file.bucket,
      path: file.path,
      mimeType: file.mimeType,
      sizeBytes: Number(file.sizeBytes),
      checksum: file.checksum,
      createdAt: file.createdAt,
      expiresInSeconds: this.scope.uploadTtlSeconds(file.type),
      assertion: { sizeBytes: dto.size_bytes, checksum: dto.checksum },
    });
    file.checksum = verified.checksum;
    file.sizeBytes = verified.sizeBytes;
    file.status = ImportFileStatus.UPLOADED;
    if (file.type === ImportFileType.RAW_BACKUP) {
      session.rawBackupPath = file.path;
    }
    const saved = await this.repo.saveFileWithAudit(file, {
      organizationId: session.organizationId,
      projectId,
      importSessionId: session.id,
      importFileId: file.id,
      operation: ImportOperation.CONFIRM_FILE,
      performedBy: actor.id,
      changes: { status: ImportFileStatus.UPLOADED },
    });
    if (file.type === ImportFileType.RAW_BACKUP) {
      await this.repo.saveSession(session, {
        organizationId: session.organizationId,
        projectId,
        importSessionId: session.id,
        operation: ImportOperation.CONFIRM_FILE,
        performedBy: actor.id,
        changes: { raw_backup_path: file.path },
      });
    }
    return ImportFileResponseDto.fromEntity(saved);
  }

  async listFiles(
    projectId: number,
    sessionId: number,
    actor: ImportSessionActorContext,
  ): Promise<ImportFileResponseDto[]> {
    const session = await this.findSession(projectId, sessionId, actor, false);
    const files = await this.repo.listFiles(session.id, session.organizationId);
    return files.map((file) => ImportFileResponseDto.fromEntity(file));
  }

  async createFileDownloadUrl(
    projectId: number,
    sessionId: number,
    fileId: number,
    actor: ImportSessionActorContext,
  ): Promise<ImportFileDownloadUrlResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, false);
    const file = await this.findFile(
      session.id,
      fileId,
      session.organizationId,
    );
    if (file.status !== ImportFileStatus.UPLOADED)
      throw new ConflictException({
        code: 'IMPORT_FILE_NOT_UPLOADED',
        message: 'Only uploaded files can be downloaded',
      });
    const signed = await this.storageSigner.createDownloadUrl({
      bucket: file.bucket,
      path: file.path,
      mimeType: file.mimeType,
      expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
      sizeBytes: Number(file.sizeBytes),
      checksum: file.checksum,
    });
    await this.repo.audit({
      organizationId: session.organizationId,
      projectId,
      importSessionId: session.id,
      importFileId: file.id,
      operation: ImportOperation.DOWNLOAD_FILE,
      performedBy: actor.id,
      changes: { download_url: 'created' },
    });
    return {
      file: ImportFileResponseDto.fromEntity(file),
      download_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }

  private async processPayload(
    projectId: number,
    sessionId: number,
    payloadId: number,
    actor: ImportSessionActorContext,
  ): Promise<void> {
    // 1) Mark the payload as processing (short transaction).
    const { session, payload, previous, wasProcessed } =
      await identityTransaction(this.dataSource, async (manager) => {
        const payload = await manager
          .getRepository(ImportPayloadEntity)
          .findOneByOrFail({ id: payloadId });
        const session = await manager
          .getRepository(ImportSessionEntity)
          .findOneByOrFail({ id: sessionId });
        const previous: Counts = {
          created: Number(payload.createdCount),
          updated: Number(payload.updatedCount),
          deleted: Number(payload.deletedCount),
          failed: Number(payload.failedCount),
        };
        await manager
          .getRepository(ImportPayloadErrorEntity)
          .delete({ importPayloadId: payload.id });
        const wasProcessed = payload.processedAt !== null;
        payload.status = ImportPayloadStatus.PROCESSING;
        await manager.getRepository(ImportPayloadEntity).save(payload);
        return { session, payload, previous, wasProcessed };
      });

    // 2) Apply items in bounded transactions (the project's item-write lock is
    // released between chunks) and one savepoint per item, so a failing item
    // leaves no partial writes behind.
    const items = this.extractItems(payload);
    const counts: Counts = { created: 0, updated: 0, deleted: 0, failed: 0 };
    const chunk = this.scope.itemsPerTransaction();
    for (let start = 0; start < items.length; start += chunk) {
      await identityTransaction(this.dataSource, async (manager) => {
        const end = Math.min(start + chunk, items.length);
        for (let index = start; index < end; index++) {
          const item = items[index];
          try {
            const result = await manager.transaction((savepoint) =>
              session.type === ImportSessionType.PHYSICAL_OBSERVATIONS_IMPORT
                ? this.applyPhysicalObservation(
                    savepoint,
                    session,
                    payload,
                    item,
                    actor,
                    index + 1,
                  )
                : this.applyItem(
                    savepoint,
                    session,
                    payload,
                    item,
                    actor,
                    index + 1,
                  ),
            );
            counts[result] += 1;
          } catch (error) {
            counts.failed += 1;
            await manager.getRepository(ImportPayloadErrorEntity).save({
              organizationId: session.organizationId,
              importSessionId: session.id,
              importPayloadId: payload.id,
              rowNumber: index + 1,
              itemReference:
                item.external_item_id ??
                item.new_plate ??
                item.old_plate ??
                null,
              errorCode: this.errorCode(error),
              errorMessage: this.errorMessage(error),
              rawData: item as unknown as Record<string, unknown>,
            });
          }
        }
      });
    }

    // 3) Final status and session counters under the session row lock, so
    // concurrent payloads of the same session never lose counter updates.
    await identityTransaction(this.dataSource, async (manager) => {
      const locked = await manager.getRepository(ImportSessionEntity).findOne({
        where: { id: sessionId },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      payload.status =
        counts.failed === 0
          ? ImportPayloadStatus.PROCESSED
          : counts.failed >= items.length
            ? ImportPayloadStatus.FAILED
            : ImportPayloadStatus.PARTIALLY_PROCESSED;
      payload.createdCount = counts.created;
      payload.updatedCount = counts.updated;
      payload.deletedCount = counts.deleted;
      payload.failedCount = counts.failed;
      payload.processedAt = new Date();
      payload.errorMessage = counts.failed
        ? `${counts.failed} of ${items.length} item(s) failed`
        : null;
      await manager.getRepository(ImportPayloadEntity).save(payload);
      this.applySessionDelta(locked!, previous, counts, payload, wasProcessed);
      const failedBefore = wasProcessed && previous.failed > 0 ? 1 : 0;
      const failedNow = counts.failed > 0 ? 1 : 0;
      locked!.failedPayloads =
        Number(locked!.failedPayloads) + failedNow - failedBefore;
      await manager.getRepository(ImportSessionEntity).save(locked!);
      await manager.getRepository(ImportSessionAuditLogEntity).save({
        organizationId: session.organizationId,
        projectId,
        importSessionId: session.id,
        importPayloadId: payload.id,
        importFileId: null,
        operation: ImportOperation.PROCESS_PAYLOAD,
        performedBy: actor.id,
        changes: { ...counts, status: payload.status },
      });
    });
  }

  private isTerminal(status: ImportSessionStatus): boolean {
    return [
      ImportSessionStatus.FINISHED,
      ImportSessionStatus.FINISHED_WITH_ERRORS,
      ImportSessionStatus.FAILED,
      ImportSessionStatus.CANCELLED,
      ImportSessionStatus.EXPIRED,
    ].includes(status);
  }

  /** FAILED payloads, or ones left PROCESSING by a crash for over 15 min. */
  private isReprocessable(payload: ImportPayloadEntity): boolean {
    if (payload.status === ImportPayloadStatus.FAILED) return true;
    return (
      payload.status === ImportPayloadStatus.PROCESSING &&
      Date.now() - new Date(payload.updatedAt).getTime() > 15 * 60000
    );
  }

  async importPhysicalFile(
    projectId: number,
    sessionId: number,
    dto: ImportPhysicalObservationsFileDto,
    file: { originalname: string; buffer: Buffer },
    actor: ImportSessionActorContext,
  ): Promise<ImportPayloadResponseDto> {
    const session = await this.findSession(projectId, sessionId, actor, true);
    if (session.type !== ImportSessionType.PHYSICAL_OBSERVATIONS_IMPORT)
      throw new ConflictException({
        code: 'IMPORT_SESSION_TYPE_MISMATCH',
        message: 'Session is not a physical observations import',
      });
    if (!file?.buffer || !file.originalname.toLowerCase().endsWith('.xlsx'))
      throw new BadRequestException({
        code: 'INVALID_IMPORT_FILE',
        message: 'XLSX file is required',
      });
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    return this.receivePayload(
      projectId,
      sessionId,
      {
        payload_number: dto.payload_number,
        idempotency_key: dto.idempotency_key,
        checksum,
        raw_payload_path: `inline-xlsx://${file.originalname}`,
        items: this.physicalParser.parse(file.buffer),
        metadata: {
          original_name: file.originalname,
          parser: 'physical_observation_aliases_v1',
        },
      },
      actor,
    );
  }

  private async applyPhysicalObservation(
    manager: EntityManager,
    importSession: ImportSessionEntity,
    payload: ImportPayloadEntity,
    item: ImportPayloadItemDto,
    actor: ImportSessionActorContext,
    rowNumber: number,
  ): Promise<'created'> {
    if (item.captured_at != null && !isExplicitInstant(item.captured_at))
      throw new Error(
        'captured_at must be a valid timestamp with an explicit offset',
      );
    const config = (importSession.metadata ?? {}) as Record<string, unknown>;
    const inventorySessionId =
      item.inventory_session_id ??
      this.positiveInteger(config.inventory_session_id);
    const roundId = item.round_id ?? this.positiveInteger(config.round_id);
    const fieldAgentId =
      item.field_agent_id ?? this.positiveInteger(config.field_agent_id);
    if (!inventorySessionId)
      throw new Error('inventory_session_id is required');
    if (!roundId) throw new Error('round_id is required');
    if (!fieldAgentId) throw new Error('field_agent_id is required');

    const itemRepo = manager.getRepository(InventoryItemEntity);
    const inventoryItem = item.inventory_item_id
      ? await itemRepo.findOne({
          where: {
            id: item.inventory_item_id,
            organizationId: importSession.organizationId,
            projectId: importSession.projectId,
          },
        })
      : await this.findInventoryItemByExternalId(
          itemRepo,
          importSession.projectId,
          this.scope.cleanText(item.external_item_id) ?? null,
        );
    if (
      !inventoryItem ||
      inventoryItem.organizationId !== importSession.organizationId
    )
      throw new Error('inventory item not found');

    const [operationSession, round, assignment] = await Promise.all([
      manager.getRepository(InventorySessionEntity).findOne({
        where: {
          id: inventorySessionId,
          organizationId: importSession.organizationId,
          projectId: importSession.projectId,
        },
      }),
      manager.getRepository(InventoryRoundEntity).findOne({
        where: {
          id: roundId,
          organizationId: importSession.organizationId,
          projectId: importSession.projectId,
          sessionId: inventorySessionId,
        },
      }),
      manager.getRepository(ProjectFieldAgentEntity).findOne({
        where: {
          organizationId: importSession.organizationId,
          projectId: importSession.projectId,
          fieldAgentId,
          status: ProjectFieldAgentStatus.ACTIVE,
        },
      }),
    ]);
    if (
      !operationSession ||
      operationSession.status !== InventorySessionStatus.ACTIVE
    )
      throw new Error('inventory session must be active');
    if (!round || round.status !== InventoryRoundStatus.ACTIVE)
      throw new Error('inventory round must be active');
    if (
      round.inventoryItemId !== null &&
      round.inventoryItemId !== inventoryItem.id
    )
      throw new Error('reinventory round targets another item');
    if (!assignment)
      throw new Error('field agent must have an active project assignment');
    const fieldAgent = await manager.getRepository(FieldAgentEntity).findOne({
      where: { id: fieldAgentId, organizationId: importSession.organizationId },
    });
    if (!fieldAgent || fieldAgent.status !== FieldAgentStatus.ACTIVE)
      throw new Error('field agent must be active');

    const idempotencyKey = this.physicalObservationKey(
      importSession.sessionUuid,
      payload.idempotencyKey,
      rowNumber,
    );
    const observationRepo = manager.getRepository(InventoryObservationEntity);
    if (
      await observationRepo.findOne({
        where: { organizationId: importSession.organizationId, idempotencyKey },
      })
    )
      return 'created';
    const prior = await observationRepo.findOne({
      where: {
        projectId: importSession.projectId,
        sessionId: inventorySessionId,
        inventoryItemId: inventoryItem.id,
      },
      order: { capturedAt: 'DESC', id: 'DESC' },
    });
    const observedPlate =
      this.scope.normalizePlate(
        item.observed_plate ?? item.new_plate ?? item.old_plate,
      ) ?? null;
    const masterPlate =
      this.scope.normalizePlate(
        inventoryItem.newPlate ?? inventoryItem.oldPlate,
      ) ?? null;
    const capturedAt = item.captured_at
      ? new Date(item.captured_at)
      : new Date();
    if (Number.isNaN(capturedAt.getTime()))
      throw new Error('captured_at must be a valid date-time');
    const result =
      item.observation_result ??
      (observedPlate && masterPlate && observedPlate !== masterPlate
        ? InventoryObservationResult.DIVERGENT
        : InventoryObservationResult.FOUND);
    const observation = await observationRepo.save({
      organizationId: importSession.organizationId,
      projectId: importSession.projectId,
      sessionId: inventorySessionId,
      roundId,
      inventoryItemId: inventoryItem.id,
      fieldAgentId,
      priorObservationId: prior?.id ?? null,
      idempotencyKey,
      result,
      observedPlate,
      observedSerialNumber:
        this.scope.cleanText(
          item.observed_serial_number ?? item.serial_number,
        ) ?? null,
      unitText: this.scope.cleanText(item.unit_text) ?? null,
      sectorText: this.scope.cleanText(item.sector_text) ?? null,
      locationText: this.scope.cleanText(item.location_text) ?? null,
      notes: this.scope.cleanText(item.notes) ?? null,
      capturedAt,
      receivedAt: new Date(),
      createdById: actor.id,
    });
    if (observedPlate)
      await manager.getRepository(InventoryPlateHistoryEntity).save({
        organizationId: importSession.organizationId,
        projectId: importSession.projectId,
        inventoryItemId: inventoryItem.id,
        observationId: observation.id,
        previousPlate: masterPlate,
        observedPlate,
        source: PlateEvidenceSource.PHYSICAL_BASE,
        recordedById: actor.id,
      });
    await manager.getRepository(InventoryOperationAuditLogEntity).save({
      organizationId: importSession.organizationId,
      projectId: importSession.projectId,
      entity: 'inventory_observation',
      entityId: observation.id,
      operation: 'IMPORT_PHYSICAL_EVIDENCE',
      performedBy: actor.id,
      changes: {
        import_session_id: importSession.id,
        import_payload_id: payload.id,
        row_number: rowNumber,
        prior_observation_id: prior?.id ?? null,
        master_plate: masterPlate,
        observed_plate: observedPlate,
      },
    });
    return 'created';
  }

  private positiveInteger(value: unknown): number | undefined {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : undefined;
  }

  private physicalObservationKey(
    sessionUuid: string,
    payloadKey: string,
    rowNumber: number,
  ): string {
    return `imp:${createHash('sha256').update(`${sessionUuid}:${payloadKey}:${rowNumber}`).digest('hex')}`;
  }

  private async applyItem(
    manager: EntityManager,
    session: ImportSessionEntity,
    payload: ImportPayloadEntity,
    item: ImportPayloadItemDto,
    actor: ImportSessionActorContext,
    rowNumber: number,
  ): Promise<'created' | 'updated' | 'deleted'> {
    const itemRepo = manager.getRepository(InventoryItemEntity);
    const auditRepo = manager.getRepository(InventoryItemAuditLogEntity);
    const externalId = this.scope.cleanText(item.external_item_id) ?? null;
    const existing = await this.findInventoryItemByExternalId(
      itemRepo,
      session.projectId,
      externalId,
    );
    if (item.operation === ImportItemOperation.CREATE && existing) {
      throw new Error('external_item_id already exists');
    }
    if (
      [
        ImportItemOperation.UPDATE,
        ImportItemOperation.DELETE,
        ImportItemOperation.REMOVE,
      ].includes(item.operation) &&
      !existing
    ) {
      throw new Error('inventory item not found');
    }
    const removal =
      item.operation === ImportItemOperation.DELETE ||
      item.operation === ImportItemOperation.REMOVE;
    // A removed item is never resurrected or edited by a (late) import.
    if (
      existing &&
      !removal &&
      (existing.deletedAt ||
        [InventoryItemStatus.INACTIVE, InventoryItemStatus.REMOVED].includes(
          existing.status,
        ))
    )
      throw new Error('inventory item was deleted');
    // Validate every referenced photo before writing anything.
    const files = removal
      ? []
      : await this.resolveImportImages(manager, session, item);
    const now = new Date();
    const target =
      existing ??
      itemRepo.create({
        organizationId: session.organizationId,
        projectId: session.projectId,
        createdById: actor.id,
        createdAt: now,
      });
    const before = target.id ? { ...target } : null;
    if (removal) {
      target.status = InventoryItemStatus.REMOVED;
      target.deletedAt = target.deletedAt ?? now;
      target.updatedById = actor.id;
    } else {
      this.assignItemFields(
        target,
        item,
        actor.id,
        session.type === ImportSessionType.MOBILE_SYNC &&
          session.source === ImportSessionSource.MOBILE_APP,
      );
    }
    const saved = await itemRepo.save(target);
    const linked = await this.linkImportImages(
      manager,
      session,
      payload,
      saved,
      files,
      actor,
    );
    await auditRepo.save({
      inventoryItemId: saved.id,
      organizationId: session.organizationId,
      projectId: session.projectId,
      operation: removal
        ? InventoryItemAuditOperation.DEACTIVATE
        : before
          ? InventoryItemAuditOperation.UPDATE
          : InventoryItemAuditOperation.CREATE,
      performedBy: actor.id,
      changes: {
        ...this.itemDiff(before, saved),
        ...(linked ? { images_linked: { before: null, after: linked } } : {}),
        _context: {
          before: null,
          after: {
            channel: 'import',
            import_session_id: session.id,
            payload_number: payload.payloadNumber,
            row_number: rowNumber,
          },
        },
      },
    });
    if (removal) return 'deleted';
    return before ? 'updated' : 'created';
  }

  private static readonly AUDITED_ITEM_FIELDS = [
    'externalItemId',
    'sequence',
    'oldPlate',
    'oldPlate2',
    'newPlate',
    'unitText',
    'addressText',
    'locationText',
    'description',
    'brand',
    'model',
    'serialNumber',
    'capacity',
    'year',
    'notes',
    'source',
    'usedValue',
    'newValue',
    'status',
  ] as const;

  private itemDiff(
    before: InventoryItemEntity | null,
    after: InventoryItemEntity,
  ): Record<string, { before: unknown; after: unknown }> {
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const field of ImportSessionsService.AUDITED_ITEM_FIELDS) {
      const previous = before?.[field] ?? null;
      const next = after[field] ?? null;
      if (String(previous) !== String(next))
        changes[field] = { before: previous, after: next };
    }
    return changes;
  }

  /**
   * Photos referenced by an imported item must be image files uploaded AND
   * verified (confirm-upload) in this same session and organization. Paths
   * outside the session can never be linked.
   */
  private async resolveImportImages(
    manager: EntityManager,
    session: ImportSessionEntity,
    item: ImportPayloadItemDto,
  ): Promise<ImportFileEntity[]> {
    const paths = [
      ...new Set((item.images ?? []).map((image) => image.path ?? '')),
    ];
    const files: ImportFileEntity[] = [];
    for (const path of paths) {
      const file = path
        ? await manager.getRepository(ImportFileEntity).findOne({
            where: {
              importSessionId: session.id,
              organizationId: session.organizationId,
              path,
              type: ImportFileType.IMAGE,
            },
          })
        : null;
      if (
        !file ||
        ![ImportFileStatus.UPLOADED, ImportFileStatus.PROCESSED].includes(
          file.status,
        )
      )
        throw new Error(
          'image file not uploaded and confirmed in this session',
        );
      files.push(file);
    }
    return files;
  }

  private async linkImportImages(
    manager: EntityManager,
    session: ImportSessionEntity,
    payload: ImportPayloadEntity,
    item: InventoryItemEntity,
    files: ImportFileEntity[],
    actor: ImportSessionActorContext,
  ): Promise<number> {
    if (!files.length) return 0;
    const images = manager.getRepository(InventoryItemImageEntity);
    const current = await images.find({
      where: {
        inventoryItemId: item.id,
        status: Not(InventoryItemImageStatus.REMOVED),
      },
    });
    const fresh = files.filter(
      (file) =>
        !current.some((i) => i.bucket === file.bucket && i.path === file.path),
    );
    if (current.length + fresh.length > this.scope.maxImagesPerItem())
      throw new Error('inventory item image limit exceeded');
    for (const file of fresh) {
      const saved = await images.save({
        organizationId: session.organizationId,
        inventoryItemId: item.id,
        storageProvider: file.storageProvider,
        bucket: file.bucket,
        path: file.path,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: Number(file.sizeBytes),
        checksum: file.checksum,
        status: InventoryItemImageStatus.UPLOADED,
        uploadedById: actor.id,
      });
      await manager.getRepository(InventoryItemImageAuditLogEntity).save({
        inventoryItemImageId: saved.id,
        organizationId: session.organizationId,
        inventoryItemId: item.id,
        operation: InventoryItemImageAuditOperation.IMPORT_LINK,
        performedBy: actor.id,
        changes: {
          import_file_id: { before: null, after: file.id },
          import_session_id: { before: null, after: session.id },
        },
      });
    }
    for (const file of files) {
      file.status = ImportFileStatus.PROCESSED;
      file.importPayloadId = payload.id;
      await manager.getRepository(ImportFileEntity).save(file);
    }
    return fresh.length;
  }

  private assignItemFields(
    target: InventoryItemEntity,
    item: ImportPayloadItemDto,
    actorId: number,
    clearNulls = false,
  ): void {
    // Web imports keep the historical rule (null/blank never clears). Mobile
    // reconciliation sessions follow the item PUT: explicit null clears.
    const pick = <T>(
      raw: unknown,
      value: T | null | undefined,
      current: T | null,
    ) => (clearNulls && raw === null ? null : (value ?? current ?? null));
    const text = (raw: string | null | undefined, current: string | null) =>
      pick(raw, this.scope.cleanText(raw), current);
    const plate = (raw: string | null | undefined, current: string | null) =>
      pick(raw, this.scope.normalizePlate(raw), current);
    target.externalItemId =
      this.scope.cleanText(item.external_item_id) ??
      target.externalItemId ??
      null;
    target.sequence = text(item.sequence, target.sequence);
    target.oldPlate = plate(item.old_plate, target.oldPlate);
    target.oldPlate2 = plate(item.old_plate_2, target.oldPlate2);
    target.newPlate = plate(item.new_plate, target.newPlate);
    target.unitText = text(item.unit_text, target.unitText);
    target.addressText = text(item.address_text, target.addressText);
    target.locationText = text(item.location_text, target.locationText);
    target.description = text(item.description, target.description);
    target.brand = text(item.brand, target.brand);
    target.model = text(item.model, target.model);
    target.serialNumber = text(item.serial_number, target.serialNumber);
    target.capacity = text(item.capacity, target.capacity);
    target.year = pick(item.year, item.year, target.year);
    target.notes = text(item.notes, target.notes);
    target.source =
      this.scope.cleanText(item.source) ?? target.source ?? 'import_session';
    target.usedValue = pick(item.used_value, item.used_value, target.usedValue);
    target.newValue = pick(item.new_value, item.new_value, target.newValue);
    target.status = item.status ?? target.status ?? InventoryItemStatus.PENDING;
    target.metadata = { ...(target.metadata ?? {}), ...(item.metadata ?? {}) };
    // Photos are linked as inventory_item_images (linkImportImages), not kept
    // as unverified paths in metadata.
    target.updatedById = actorId;
  }

  /** Server-side SHA-256 of the payload content (client checksum optional). */
  private contentHash(dto: CreateImportPayloadDto): string {
    return createHash('sha256')
      .update(JSON.stringify({ n: dto.payload_number, items: dto.items }))
      .digest('hex');
  }

  private async findDuplicate(
    session: ImportSessionEntity,
    dto: CreateImportPayloadDto,
    contentHash: string,
  ): Promise<ImportPayloadEntity | null> {
    const byNumber = await this.repo.findPayloadByNumber(
      session.id,
      dto.payload_number,
    );
    const byKey = await this.repo.findPayloadByIdempotencyKey(
      session.id,
      dto.idempotency_key,
    );
    const existing = byNumber ?? byKey;
    if (!existing) return null;
    if (
      existing.payloadNumber !== dto.payload_number ||
      existing.idempotencyKey !== dto.idempotency_key ||
      (existing.checksum ?? null) !== (dto.checksum ?? null) ||
      (existing.contentHash !== null && existing.contentHash !== contentHash)
    ) {
      throw new ConflictException({
        code: 'PAYLOAD_IDEMPOTENCY_CONFLICT',
        message:
          'Payload idempotency conflict: same number/key with different content.',
      });
    }
    return existing;
  }

  private assertPayloadLimits(dto: CreateImportPayloadDto): void {
    if (dto.items.length > this.scope.maxItemsPerPayload()) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Payload item limit exceeded',
      });
    }
    if (this.countImages(dto.items) > this.scope.maxImagesPerPayload()) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Payload image limit exceeded',
      });
    }
  }

  private assertSessionAcceptsPayload(session: ImportSessionEntity): void {
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      throw new ConflictException({
        code: 'IMPORT_SESSION_EXPIRED',
        message: 'Import session expired',
      });
    }
    if (this.isTerminal(session.status)) {
      throw new ConflictException({
        code: 'IMPORT_SESSION_TERMINAL',
        message: 'Import session does not accept new payloads',
      });
    }
  }

  private applySessionDelta(
    session: ImportSessionEntity,
    previous: Counts,
    counts: Counts,
    payload: ImportPayloadEntity,
    wasProcessed: boolean,
  ): void {
    session.status = ImportSessionStatus.RECEIVING;
    if (!wasProcessed) {
      session.receivedPayloads = Number(session.receivedPayloads) + 1;
      session.processedPayloads = Number(session.processedPayloads) + 1;
      session.totalItems =
        Number(session.totalItems) + Number(payload.itemsCount);
      session.totalImages =
        Number(session.totalImages) + Number(payload.imagesCount);
    }
    session.totalCreated =
      Number(session.totalCreated) + counts.created - previous.created;
    session.totalUpdated =
      Number(session.totalUpdated) + counts.updated - previous.updated;
    session.totalDeleted =
      Number(session.totalDeleted) + counts.deleted - previous.deleted;
    session.totalFailed =
      Number(session.totalFailed) + counts.failed - previous.failed;
  }

  private async getProject(
    projectId: number,
    actor: ImportSessionActorContext,
    mutate: boolean,
  ) {
    const project = await this.projects.findById(projectId);
    if (!project)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    if (mutate) this.scope.assertProjectAllowsMutation(project);
    return project;
  }

  private async findSession(
    projectId: number,
    sessionId: number,
    actor: ImportSessionActorContext,
    mutate: boolean,
  ): Promise<ImportSessionEntity> {
    const session = await this.repo.findSessionById(sessionId);
    if (!session || Number(session.projectId) !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Import session not found',
      });
    }
    await this.assertSessionScope(projectId, session, actor, mutate);
    return session;
  }

  private async assertSessionScope(
    projectId: number,
    session: ImportSessionEntity,
    actor: ImportSessionActorContext,
    mutate: boolean,
  ): Promise<void> {
    const project = await this.getProject(projectId, actor, mutate);
    if (
      project.organizationId !== Number(session.organizationId) ||
      // Field accounts only see the sessions they opened (no IDOR within the
      // organization); managers keep organization-wide access.
      (actor.confined && Number(session.createdById) !== actor.id)
    ) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Import session not found',
      });
    }
  }

  private async findPayload(
    sessionId: number,
    payloadId: number,
  ): Promise<ImportPayloadEntity> {
    const payload = await this.repo.findPayloadById(payloadId);
    if (!payload || Number(payload.importSessionId) !== sessionId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Import payload not found',
      });
    }
    return payload;
  }

  private async findFile(
    sessionId: number,
    fileId: number,
    organizationId: number,
  ): Promise<ImportFileEntity> {
    const file = await this.repo.findFileById(fileId);
    if (
      !file ||
      Number(file.importSessionId) !== sessionId ||
      Number(file.organizationId) !== organizationId
    ) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Import file not found',
      });
    }
    return file;
  }

  private extractItems(payload: ImportPayloadEntity): ImportPayloadItemDto[] {
    const raw = payload.payload as { items?: ImportPayloadItemDto[] } | null;
    return Array.isArray(raw?.items) ? raw.items : [];
  }

  private countImages(items: ImportPayloadItemDto[]): number {
    return items.reduce((sum, item) => sum + (item.images?.length ?? 0), 0);
  }

  private findInventoryItemByExternalId(
    repo: Repository<InventoryItemEntity>,
    projectId: number,
    externalItemId: string | null,
  ): Promise<InventoryItemEntity | null> {
    if (!externalItemId) return Promise.resolve(null);
    return repo.findOne({
      where: { projectId, externalItemId },
      withDeleted: true,
    });
  }

  private errorCode(error: unknown): string {
    return error instanceof Error
      ? error.message
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .slice(0, 80)
      : 'IMPORT_ERROR';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Import item failed';
  }

  private paginate<T>(
    items: T[],
    page: number,
    pageSize: number,
    total: number,
  ): {
    items: T[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  } {
    return {
      items,
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
