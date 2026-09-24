import { createHash, randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
  ): Promise<ImportSessionResponseDto> {
    const project = await this.getProject(projectId, actor, true);
    const now = new Date();
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
      expiresAt: new Date(
        now.getTime() + this.scope.sessionTtlHours() * 3600000,
      ),
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
    const duplicate = await this.findDuplicate(session, dto);
    if (duplicate) return ImportPayloadResponseDto.fromEntity(duplicate);

    const payload = new ImportPayloadEntity();
    payload.organizationId = session.organizationId;
    payload.importSessionId = session.id;
    payload.payloadNumber = dto.payload_number;
    payload.idempotencyKey = dto.idempotency_key;
    payload.checksum = dto.checksum ?? null;
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

    const saved = await this.repo.savePayloadWithAudit(payload, {
      organizationId: session.organizationId,
      projectId,
      importSessionId: session.id,
      operation: ImportOperation.RECEIVE_PAYLOAD,
      performedBy: actor.id,
      changes: { payload_number: dto.payload_number },
    });
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
    if (
      session.expectedPayloads &&
      session.receivedPayloads < session.expectedPayloads
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Expected payloads were not fully received',
      });
    }
    session.status =
      session.failedPayloads > 0
        ? ImportSessionStatus.FAILED
        : ImportSessionStatus.FINISHED;
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
    for (const payload of items.filter(
      (item) => item.status === ImportPayloadStatus.FAILED,
    )) {
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
    await this.findSession(projectId, sessionId, actor, true);
    const payload = await this.findPayload(sessionId, payloadId);
    if (payload.status !== ImportPayloadStatus.FAILED) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only failed payloads can be reprocessed',
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
    const saved = await this.repo.saveFileWithAudit(file, {
      organizationId: session.organizationId,
      projectId,
      importSessionId: session.id,
      operation: ImportOperation.CREATE_FILE,
      performedBy: actor.id,
      changes: { status: ImportFileStatus.PENDING_UPLOAD },
    });
    const signed = await this.storageSigner.createUploadUrl({
      bucket: saved.bucket,
      path: saved.path,
      mimeType: saved.mimeType,
      expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
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
    if (dto.size_bytes && Number(file.sizeBytes) !== dto.size_bytes) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'File size mismatch',
      });
    }
    file.checksum = dto.checksum ?? file.checksum;
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
    const signed = await this.storageSigner.createDownloadUrl({
      bucket: file.bucket,
      path: file.path,
      mimeType: file.mimeType,
      expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
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
    await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(ImportSessionEntity);
      const payloadRepo = manager.getRepository(ImportPayloadEntity);
      const errorRepo = manager.getRepository(ImportPayloadErrorEntity);
      const auditRepo = manager.getRepository(ImportSessionAuditLogEntity);
      const itemRepo = manager.getRepository(InventoryItemEntity);
      const itemAuditRepo = manager.getRepository(InventoryItemAuditLogEntity);
      const session = await sessionRepo.findOneByOrFail({ id: sessionId });
      const payload = await payloadRepo.findOneByOrFail({ id: payloadId });
      const previous = {
        created: Number(payload.createdCount),
        updated: Number(payload.updatedCount),
        deleted: Number(payload.deletedCount),
        failed: Number(payload.failedCount),
      };
      const wasProcessed = payload.processedAt !== null;
      await errorRepo.delete({ importPayloadId: payload.id });
      payload.status = ImportPayloadStatus.PROCESSING;
      await payloadRepo.save(payload);
      const items = this.extractItems(payload);
      const counts: Counts = { created: 0, updated: 0, deleted: 0, failed: 0 };
      for (const [index, item] of items.entries()) {
        try {
          const result =
            session.type === ImportSessionType.PHYSICAL_OBSERVATIONS_IMPORT
              ? await this.applyPhysicalObservation(
                  manager,
                  session,
                  payload,
                  item,
                  actor,
                  index + 1,
                )
              : await this.applyItem(
                  manager,
                  itemRepo,
                  itemAuditRepo,
                  session,
                  item,
                  actor,
                  index + 1,
                );
          counts[result] += 1;
        } catch (error) {
          counts.failed += 1;
          await errorRepo.save({
            organizationId: session.organizationId,
            importSessionId: session.id,
            importPayloadId: payload.id,
            rowNumber: index + 1,
            itemReference:
              item.external_item_id ?? item.new_plate ?? item.old_plate ?? null,
            errorCode: this.errorCode(error),
            errorMessage: this.errorMessage(error),
            rawData: item as unknown as Record<string, unknown>,
          });
        }
      }
      payload.status = ImportPayloadStatus.PROCESSED;
      payload.createdCount = counts.created;
      payload.updatedCount = counts.updated;
      payload.deletedCount = counts.deleted;
      payload.failedCount = counts.failed;
      payload.processedAt = new Date();
      payload.errorMessage = null;
      await payloadRepo.save(payload);
      this.applySessionDelta(session, previous, counts, payload, wasProcessed);
      await sessionRepo.save(session);
      await auditRepo.save({
        organizationId: session.organizationId,
        projectId,
        importSessionId: session.id,
        importPayloadId: payload.id,
        importFileId: null,
        operation: ImportOperation.PROCESS_PAYLOAD,
        performedBy: actor.id,
        changes: counts,
      });
    });
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
    itemRepo: Repository<InventoryItemEntity>,
    auditRepo: Repository<InventoryItemAuditLogEntity>,
    session: ImportSessionEntity,
    item: ImportPayloadItemDto,
    actor: ImportSessionActorContext,
    rowNumber: number,
  ): Promise<'created' | 'updated' | 'deleted'> {
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
    if (
      item.operation === ImportItemOperation.DELETE ||
      item.operation === ImportItemOperation.REMOVE
    ) {
      target.status = InventoryItemStatus.REMOVED;
      target.deletedAt = now;
      target.updatedById = actor.id;
    } else {
      this.assignItemFields(target, item, actor.id);
    }
    const saved = await manager.getRepository(InventoryItemEntity).save(target);
    await auditRepo.save({
      inventoryItemId: saved.id,
      organizationId: session.organizationId,
      projectId: session.projectId,
      operation: before
        ? InventoryItemAuditOperation.UPDATE
        : InventoryItemAuditOperation.CREATE,
      performedBy: actor.id,
      changes: { row_number: { before: null, after: rowNumber } },
    });
    if (
      item.operation === ImportItemOperation.DELETE ||
      item.operation === ImportItemOperation.REMOVE
    ) {
      return 'deleted';
    }
    return before ? 'updated' : 'created';
  }

  private assignItemFields(
    target: InventoryItemEntity,
    item: ImportPayloadItemDto,
    actorId: number,
  ): void {
    target.externalItemId =
      this.scope.cleanText(item.external_item_id) ??
      target.externalItemId ??
      null;
    target.sequence =
      this.scope.cleanText(item.sequence) ?? target.sequence ?? null;
    target.oldPlate =
      this.scope.normalizePlate(item.old_plate) ?? target.oldPlate ?? null;
    target.newPlate =
      this.scope.normalizePlate(item.new_plate) ?? target.newPlate ?? null;
    target.unitText =
      this.scope.cleanText(item.unit_text) ?? target.unitText ?? null;
    target.addressText =
      this.scope.cleanText(item.address_text) ?? target.addressText ?? null;
    target.locationText =
      this.scope.cleanText(item.location_text) ?? target.locationText ?? null;
    target.description =
      this.scope.cleanText(item.description) ?? target.description ?? null;
    target.brand = this.scope.cleanText(item.brand) ?? target.brand ?? null;
    target.model = this.scope.cleanText(item.model) ?? target.model ?? null;
    target.serialNumber =
      this.scope.cleanText(item.serial_number) ?? target.serialNumber ?? null;
    target.capacity =
      this.scope.cleanText(item.capacity) ?? target.capacity ?? null;
    target.year = item.year ?? target.year ?? null;
    target.notes = this.scope.cleanText(item.notes) ?? target.notes ?? null;
    target.source =
      this.scope.cleanText(item.source) ?? target.source ?? 'import_session';
    target.usedValue = item.used_value ?? target.usedValue ?? null;
    target.newValue = item.new_value ?? target.newValue ?? null;
    target.status = item.status ?? target.status ?? InventoryItemStatus.PENDING;
    target.metadata = { ...(target.metadata ?? {}), ...(item.metadata ?? {}) };
    if (item.images?.length) target.metadata.import_images = item.images;
    target.updatedById = actorId;
  }

  private async findDuplicate(
    session: ImportSessionEntity,
    dto: CreateImportPayloadDto,
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
      (existing.checksum ?? null) !== (dto.checksum ?? null)
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Payload idempotency conflict',
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
      session.status = ImportSessionStatus.EXPIRED;
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Import session expired',
      });
    }
    if (
      [
        ImportSessionStatus.FINISHED,
        ImportSessionStatus.FAILED,
        ImportSessionStatus.CANCELLED,
        ImportSessionStatus.EXPIRED,
      ].includes(session.status)
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
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
    if (project.organizationId !== Number(session.organizationId)) {
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
