import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  STORAGE_SIGNER,
  type StorageSigner,
} from '../../../common/storage/storage-signer.port';
import { UserRole } from '../../auth/domain/enums/user.enums';
import { ProjectFieldAgentStatus } from '../../field-agents/domain/enums/project-field-agent-status.enum';
import { ProjectFieldAgentEntity } from '../../field-agents/infrastructure/persistence/project-field-agent.entity';
import { InventoryAccountingItemEntity } from '../../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemEntity } from '../../inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryItemImageScopeService } from '../../inventory-item-images/application/services/inventory-item-image-scope.service';
import { ProjectEntity } from '../../projects/infrastructure/persistence/project.entity';
import {
  InventoryObservationEvidenceStatus,
  InventoryRoundKind,
  InventoryRoundStatus,
  InventorySessionStatus,
  PlateEvidenceSource,
  ReconciliationStatus,
} from '../domain/inventory-operation.enums';
import {
  AssetValuationEntity,
  InventoryConsolidationEntity,
  InventoryObservationEvidenceEntity,
  InventoryObservationEntity,
  InventoryOperationAuditLogEntity,
  InventoryPlateHistoryEntity,
  InventoryReconciliationEntity,
  InventoryRoundEntity,
  InventorySessionEntity,
} from '../infrastructure/persistence/inventory-operation.entity';
import {
  CancelInventorySessionDto,
  ConfirmObservationEvidenceUploadDto,
  ConsolidateReconciliationDto,
  CreateAssetValuationDto,
  CreateInventoryObservationDto,
  CreateObservationEvidenceUploadDto,
  CreateInventorySessionDto,
  RequestReinventoryDto,
  InventoryOperationListQueryDto,
  InventoryObservationListQueryDto,
  InventoryRoundListQueryDto,
  InventorySessionListQueryDto,
  ReconciliationListQueryDto,
} from './inventory-operation.dto';
import { InventoryOperationPolicy } from './inventory-operation.policy';

export interface InventoryOperationActor {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class InventoryOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(InventorySessionEntity)
    private readonly sessions: Repository<InventorySessionEntity>,
    @InjectRepository(InventoryRoundEntity)
    private readonly rounds: Repository<InventoryRoundEntity>,
    @InjectRepository(InventoryObservationEntity)
    private readonly observations: Repository<InventoryObservationEntity>,
    @InjectRepository(InventoryObservationEvidenceEntity)
    private readonly observationEvidence: Repository<InventoryObservationEvidenceEntity>,
    @InjectRepository(InventoryReconciliationEntity)
    private readonly reconciliations: Repository<InventoryReconciliationEntity>,
    @InjectRepository(InventoryConsolidationEntity)
    private readonly consolidations: Repository<InventoryConsolidationEntity>,
    @InjectRepository(AssetValuationEntity)
    private readonly valuations: Repository<AssetValuationEntity>,
    @InjectRepository(InventoryPlateHistoryEntity)
    private readonly plateHistory: Repository<InventoryPlateHistoryEntity>,
    @InjectRepository(InventoryItemEntity)
    private readonly items: Repository<InventoryItemEntity>,
    @InjectRepository(InventoryAccountingItemEntity)
    private readonly accountingItems: Repository<InventoryAccountingItemEntity>,
    @InjectRepository(ProjectFieldAgentEntity)
    private readonly assignments: Repository<ProjectFieldAgentEntity>,
    @Inject(STORAGE_SIGNER)
    private readonly storageSigner: StorageSigner,
    private readonly imageScope: InventoryItemImageScopeService,
  ) {}

  async createSession(
    projectId: number,
    dto: CreateInventorySessionDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, true);
    return this.dataSource.transaction(async (manager) => {
      const entity = await manager.getRepository(InventorySessionEntity).save({
        organizationId: project.organizationId,
        projectId,
        name: dto.name.trim(),
        status: InventorySessionStatus.DRAFT,
        startedAt: null,
        finishedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        createdById: actor.id,
        metadata: dto.metadata ?? null,
      });
      await this.audit(
        manager,
        project.organizationId,
        projectId,
        'inventory_session',
        entity.id,
        'CREATE',
        actor.id,
        { status: InventorySessionStatus.DRAFT },
      );
      return this.sessionResponse(entity);
    });
  }

  async listSessions(
    projectId: number,
    query: InventorySessionListQueryDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, false);
    const [items, total] = await this.sessions.findAndCount({
      where: {
        organizationId: project.organizationId,
        projectId,
        ...(query.status
          ? { status: query.status as InventorySessionStatus }
          : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return this.paginate(
      items.map((item) => this.sessionResponse(item)),
      query,
      total,
    );
  }

  async getSession(
    projectId: number,
    sessionId: number,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, false);
    const session = await this.requireSession(projectId, sessionId);
    const currentRound = await this.rounds.findOne({
      where: {
        organizationId: session.organizationId,
        projectId,
        sessionId,
        status: InventoryRoundStatus.ACTIVE,
      },
      order: { roundNumber: 'DESC', id: 'DESC' },
    });
    return {
      ...this.sessionResponse(session),
      current_round_id: currentRound?.id ?? null,
    };
  }

  async listRounds(
    projectId: number,
    sessionId: number,
    query: InventoryRoundListQueryDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, false);
    await this.requireSession(projectId, sessionId);
    const [items, total] = await this.rounds.findAndCount({
      where: {
        organizationId: project.organizationId,
        projectId,
        sessionId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { kind: query.type } : {}),
      },
      order: { roundNumber: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return this.paginate(
      items.map((item) => this.roundResponse(item)),
      query,
      total,
    );
  }

  async startSession(
    projectId: number,
    sessionId: number,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, true);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(InventorySessionEntity);
      const session = await repo.findOne({
        where: { id: sessionId, projectId },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!session) this.notFound('Inventory session');
      InventoryOperationPolicy.assertCanStart(session.status);
      const now = new Date();
      session.status = InventorySessionStatus.ACTIVE;
      session.startedAt = now;
      await repo.save(session);
      const round = await manager.getRepository(InventoryRoundEntity).save({
        organizationId: session.organizationId,
        projectId,
        sessionId,
        roundNumber: 1,
        kind: InventoryRoundKind.INITIAL,
        inventoryItemId: null,
        reason: null,
        status: InventoryRoundStatus.ACTIVE,
        requestedById: actor.id,
        startedAt: now,
        finishedAt: null,
      });
      await this.audit(
        manager,
        session.organizationId,
        projectId,
        'inventory_session',
        sessionId,
        'START',
        actor.id,
        { round_id: round.id },
      );
      return {
        session: this.sessionResponse(session),
        round: this.roundResponse(round),
      };
    });
  }

  async finishSession(
    projectId: number,
    sessionId: number,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, true);
    return this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(InventorySessionEntity);
      const session = await sessionRepo.findOne({
        where: { id: sessionId, projectId },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!session) this.notFound('Inventory session');
      const activeRoundCount = await manager
        .getRepository(InventoryRoundEntity)
        .count({
          where: {
            projectId,
            sessionId,
            status: InventoryRoundStatus.ACTIVE,
          },
        });
      InventoryOperationPolicy.assertCanFinishSession(
        session.status,
        activeRoundCount,
      );
      const oldStatus = session.status;
      session.status = InventorySessionStatus.FINISHED;
      session.finishedAt = new Date();
      await sessionRepo.save(session);
      await this.audit(
        manager,
        session.organizationId,
        projectId,
        'inventory_session',
        sessionId,
        'FINISH',
        actor.id,
        {
          old_status: oldStatus,
          new_status: InventorySessionStatus.FINISHED,
        },
      );
      return this.sessionResponse(session);
    });
  }

  async cancelSession(
    projectId: number,
    sessionId: number,
    dto: CancelInventorySessionDto,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, true);
    return this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(InventorySessionEntity);
      const session = await sessionRepo.findOne({
        where: { id: sessionId, projectId },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!session) this.notFound('Inventory session');
      InventoryOperationPolicy.assertCanCancelSession(session.status);
      const roundRepo = manager.getRepository(InventoryRoundEntity);
      const activeRounds = await roundRepo.find({
        where: {
          projectId,
          sessionId,
          status: InventoryRoundStatus.ACTIVE,
        },
      });
      const now = new Date();
      for (const round of activeRounds) {
        round.status = InventoryRoundStatus.CANCELLED;
        round.finishedAt = now;
      }
      if (activeRounds.length > 0) await roundRepo.save(activeRounds);
      const oldStatus = session.status;
      session.status = InventorySessionStatus.CANCELLED;
      session.cancelledAt = now;
      session.cancellationReason = dto.reason.trim();
      await sessionRepo.save(session);
      await this.audit(
        manager,
        session.organizationId,
        projectId,
        'inventory_session',
        sessionId,
        'CANCEL',
        actor.id,
        {
          old_status: oldStatus,
          new_status: InventorySessionStatus.CANCELLED,
          reason: session.cancellationReason,
          cancelled_round_ids: activeRounds.map((round) => round.id),
        },
      );
      return this.sessionResponse(session);
    });
  }

  async requestReinventory(
    projectId: number,
    sessionId: number,
    dto: RequestReinventoryDto,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, true);
    await this.requireItem(projectId, dto.inventory_item_id);
    const prior = await this.observations.findOne({
      where: { projectId, sessionId, inventoryItemId: dto.inventory_item_id },
      order: { capturedAt: 'DESC', id: 'DESC' },
    });
    if (!prior)
      throw new ConflictException({
        code: 'REINVENTORY_REQUIRES_PRIOR_OBSERVATION',
        message: 'Reinventory requires an earlier observation',
      });
    try {
      return await this.dataSource.transaction(async (manager) => {
        const session = await manager
          .getRepository(InventorySessionEntity)
          .findOne({
            where: { id: sessionId, projectId },
            ...(manager.connection.options.type === 'mysql'
              ? { lock: { mode: 'pessimistic_write' as const } }
              : {}),
          });
        if (!session) this.notFound('Inventory session');
        if (session.status !== InventorySessionStatus.ACTIVE)
          throw new ConflictException({
            code: 'INVENTORY_SESSION_NOT_ACTIVE',
            message: 'Session must be active',
          });
        const latest = await manager
          .getRepository(InventoryRoundEntity)
          .findOne({ where: { sessionId }, order: { roundNumber: 'DESC' } });
        const round = await manager.getRepository(InventoryRoundEntity).save({
          organizationId: session.organizationId,
          projectId,
          sessionId,
          roundNumber: (latest?.roundNumber ?? 0) + 1,
          kind: InventoryRoundKind.REINVENTORY,
          inventoryItemId: dto.inventory_item_id,
          reason: dto.reason.trim(),
          status: InventoryRoundStatus.ACTIVE,
          requestedById: actor.id,
          startedAt: new Date(),
          finishedAt: null,
        });
        await this.audit(
          manager,
          session.organizationId,
          projectId,
          'inventory_round',
          round.id,
          'REQUEST_REINVENTORY',
          actor.id,
          { item_id: dto.inventory_item_id, reason: round.reason },
        );
        return this.roundResponse(round);
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      throw new ConflictException({
        code: 'INVENTORY_ROUND_CONCURRENT_MODIFICATION',
        message: 'Round number was allocated by a concurrent operation',
      });
    }
  }

  async recordObservation(
    projectId: number,
    sessionId: number,
    roundId: number,
    dto: CreateInventoryObservationDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, true);
    const item = await this.requireItem(projectId, dto.inventory_item_id);
    if (dto.idempotency_key) {
      const existing = await this.observations.findOne({
        where: {
          organizationId: project.organizationId,
          idempotencyKey: dto.idempotency_key,
        },
      });
      if (existing) {
        if (
          existing.projectId !== projectId ||
          existing.sessionId !== sessionId ||
          existing.roundId !== roundId
        )
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'Idempotency key belongs to another operation',
          });
        return this.observationResponse(existing);
      }
    }
    const [session, round, assignment] = await Promise.all([
      this.requireSession(projectId, sessionId),
      this.rounds.findOne({ where: { id: roundId, projectId, sessionId } }),
      this.assignments.findOne({
        where: {
          organizationId: project.organizationId,
          projectId,
          fieldAgentId: dto.field_agent_id,
          status: ProjectFieldAgentStatus.ACTIVE,
        },
      }),
    ]);
    if (!round) this.notFound('Inventory round');
    if (!assignment)
      throw new ConflictException({
        code: 'FIELD_AGENT_NOT_ASSIGNED',
        message: 'Field agent must have an active project assignment',
      });
    InventoryOperationPolicy.assertCanReceiveObservation(
      session.status,
      round.status,
      round.kind,
      round.inventoryItemId,
      item.id,
    );
    const roundObservation = await this.observations.findOne({
      where: { projectId, sessionId, roundId, inventoryItemId: item.id },
    });
    if (roundObservation) {
      throw new ConflictException({
        code: 'OBSERVATION_ALREADY_RECORDED',
        message: 'Item already has an observation in this round',
      });
    }
    const prior = await this.observations.findOne({
      where: { projectId, sessionId, inventoryItemId: item.id },
      order: { capturedAt: 'DESC', id: 'DESC' },
    });
    const observedPlate = InventoryOperationPolicy.normalizePlate(
      dto.observed_plate,
    );
    const masterPlate = InventoryOperationPolicy.normalizePlate(
      item.newPlate ?? item.oldPlate,
    );
    try {
      return await this.dataSource.transaction(async (manager) => {
        const observation = await manager
          .getRepository(InventoryObservationEntity)
          .save({
            organizationId: project.organizationId,
            projectId,
            sessionId,
            roundId,
            inventoryItemId: item.id,
            fieldAgentId: dto.field_agent_id,
            priorObservationId: prior?.id ?? null,
            idempotencyKey: dto.idempotency_key ?? null,
            result: dto.result,
            observedPlate,
            observedSerialNumber: this.clean(dto.observed_serial_number),
            unitText: this.clean(dto.unit_text),
            sectorText: this.clean(dto.sector_text),
            locationText: this.clean(dto.location_text),
            notes: this.clean(dto.notes),
            capturedAt: dto.captured_at
              ? new Date(dto.captured_at)
              : new Date(),
            receivedAt: new Date(),
            createdById: actor.id,
          });
        if (observedPlate) {
          await manager.getRepository(InventoryPlateHistoryEntity).save({
            organizationId: project.organizationId,
            projectId,
            inventoryItemId: item.id,
            observationId: observation.id,
            previousPlate: masterPlate,
            observedPlate,
            source: PlateEvidenceSource.FIELD,
            recordedById: actor.id,
          });
        }
        await this.audit(
          manager,
          project.organizationId,
          projectId,
          'inventory_observation',
          observation.id,
          'RECORD',
          actor.id,
          {
            result: dto.result,
            prior_observation_id: prior?.id ?? null,
            master_plate: masterPlate,
            observed_plate: observedPlate,
          },
        );
        return this.observationResponse(observation);
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      if (dto.idempotency_key) {
        const existing = await this.observations.findOne({
          where: {
            organizationId: project.organizationId,
            idempotencyKey: dto.idempotency_key,
          },
        });
        if (
          existing &&
          existing.projectId === projectId &&
          existing.sessionId === sessionId &&
          existing.roundId === roundId
        )
          return this.observationResponse(existing);
        if (existing)
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'Idempotency key belongs to another operation',
          });
      }
      if (
        await this.observations.findOne({
          where: { projectId, sessionId, roundId, inventoryItemId: item.id },
        })
      )
        throw new ConflictException({
          code: 'OBSERVATION_ALREADY_RECORDED',
          message: 'Item already has an observation in this round',
        });
      throw new ConflictException({
        code: 'INVENTORY_OBSERVATION_CONFLICT',
        message: 'Observation conflicts with a concurrent operation',
      });
    }
  }

  async listObservations(
    projectId: number,
    sessionId: number,
    query: InventoryObservationListQueryDto,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, false);
    await this.requireSession(projectId, sessionId);
    const [items, total] = await this.observations.findAndCount({
      where: {
        projectId,
        sessionId,
        ...(query.round_id ? { roundId: query.round_id } : {}),
        ...(query.inventory_item_id
          ? { inventoryItemId: query.inventory_item_id }
          : {}),
        ...(query.field_agent_id ? { fieldAgentId: query.field_agent_id } : {}),
      },
      order: { capturedAt: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return this.paginate(
      items.map((item) => this.observationResponse(item)),
      query,
      total,
    );
  }

  async createEvidenceUploadUrl(
    projectId: number,
    sessionId: number,
    roundId: number,
    observationId: number,
    dto: CreateObservationEvidenceUploadDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, true);
    const session = await this.requireSession(projectId, sessionId);
    this.assertSessionAcceptsEvidence(session);
    await this.requireObservation(projectId, sessionId, roundId, observationId);
    this.imageScope.assertMimeType(dto.mime_type);
    this.imageScope.assertSize(dto.size_bytes);
    const originalName = this.imageScope.cleanText(dto.original_name);
    if (!originalName)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'original_name is required',
      });
    const storageKey = this.observationEvidenceStorageKey(
      project.organizationId,
      projectId,
      sessionId,
      observationId,
      originalName,
    );
    const evidence = await this.dataSource.transaction(async (manager) => {
      const saved = await manager
        .getRepository(InventoryObservationEvidenceEntity)
        .save({
          organizationId: project.organizationId,
          projectId,
          sessionId,
          roundId,
          observationId,
          storageProvider: this.imageScope.storageProvider(),
          bucket: this.imageScope.storageBucket(),
          storageKey,
          originalName,
          mimeType: dto.mime_type.toLowerCase(),
          sizeBytes: dto.size_bytes,
          checksum: this.imageScope.cleanText(dto.checksum),
          status: InventoryObservationEvidenceStatus.PENDING_UPLOAD,
          createdById: actor.id,
          confirmedAt: null,
        });
      await this.audit(
        manager,
        project.organizationId,
        projectId,
        'inventory_observation_evidence',
        saved.id,
        'CREATE_UPLOAD_URL',
        actor.id,
        {
          session_id: sessionId,
          round_id: roundId,
          observation_id: observationId,
          mime_type: saved.mimeType,
          size_bytes: saved.sizeBytes,
        },
      );
      return saved;
    });
    const signed = await this.storageSigner.createUploadUrl({
      bucket: evidence.bucket,
      path: evidence.storageKey,
      mimeType: evidence.mimeType,
      expiresInSeconds: this.imageScope.presignedUrlTtlSeconds(),
    });
    return {
      evidence: this.evidenceResponse(evidence),
      upload_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }

  async confirmEvidenceUpload(
    projectId: number,
    sessionId: number,
    roundId: number,
    observationId: number,
    evidenceId: number,
    dto: ConfirmObservationEvidenceUploadDto,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, true);
    const session = await this.requireSession(projectId, sessionId);
    this.assertSessionAcceptsEvidence(session);
    await this.requireObservation(projectId, sessionId, roundId, observationId);
    if (dto.size_bytes != null) this.imageScope.assertSize(dto.size_bytes);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(InventoryObservationEvidenceEntity);
      const evidence = await repo.findOne({
        where: {
          id: evidenceId,
          organizationId: session.organizationId,
          projectId,
          sessionId,
          roundId,
          observationId,
        },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!evidence) this.notFound('Observation evidence');
      if (evidence.status === InventoryObservationEvidenceStatus.UPLOADED)
        return this.evidenceResponse(evidence);
      const before = {
        status: evidence.status,
        checksum: evidence.checksum,
        size_bytes: evidence.sizeBytes,
      };
      evidence.status = InventoryObservationEvidenceStatus.UPLOADED;
      evidence.checksum =
        this.imageScope.cleanText(dto.checksum) ?? evidence.checksum;
      evidence.sizeBytes = dto.size_bytes ?? evidence.sizeBytes;
      evidence.confirmedAt = new Date();
      await repo.save(evidence);
      await this.audit(
        manager,
        evidence.organizationId,
        projectId,
        'inventory_observation_evidence',
        evidenceId,
        'CONFIRM_UPLOAD',
        actor.id,
        {
          before,
          after: {
            status: evidence.status,
            checksum: evidence.checksum,
            size_bytes: evidence.sizeBytes,
          },
        },
      );
      return this.evidenceResponse(evidence);
    });
  }

  async listObservationEvidence(
    projectId: number,
    sessionId: number,
    roundId: number,
    observationId: number,
    query: InventoryOperationListQueryDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, false);
    await this.requireObservation(projectId, sessionId, roundId, observationId);
    const [items, total] = await this.observationEvidence.findAndCount({
      where: {
        organizationId: project.organizationId,
        projectId,
        sessionId,
        roundId,
        observationId,
      },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return this.paginate(
      items.map((item) => this.evidenceResponse(item)),
      query,
      total,
    );
  }

  async createEvidenceDownloadUrl(
    projectId: number,
    sessionId: number,
    roundId: number,
    observationId: number,
    evidenceId: number,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, false);
    await this.requireObservation(projectId, sessionId, roundId, observationId);
    const evidence = await this.observationEvidence.findOne({
      where: {
        id: evidenceId,
        organizationId: project.organizationId,
        projectId,
        sessionId,
        roundId,
        observationId,
      },
    });
    if (!evidence) this.notFound('Observation evidence');
    if (evidence.status !== InventoryObservationEvidenceStatus.UPLOADED)
      throw new ConflictException({
        code: 'OBSERVATION_EVIDENCE_NOT_UPLOADED',
        message: 'Only uploaded evidence can be downloaded',
      });
    const signed = await this.storageSigner.createDownloadUrl({
      bucket: evidence.bucket,
      path: evidence.storageKey,
      mimeType: evidence.mimeType,
      expiresInSeconds: this.imageScope.presignedUrlTtlSeconds(),
    });
    return {
      evidence: this.evidenceResponse(evidence),
      download_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }

  async finishRound(
    projectId: number,
    sessionId: number,
    roundId: number,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, true);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(InventoryRoundEntity);
      const round = await repo.findOne({
        where: { id: roundId, projectId, sessionId },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!round) this.notFound('Inventory round');
      if (round.status !== InventoryRoundStatus.ACTIVE)
        throw new ConflictException({
          code: 'INVENTORY_ROUND_NOT_ACTIVE',
          message: 'Only active rounds can be finished',
        });
      round.status = InventoryRoundStatus.FINISHED;
      round.finishedAt = new Date();
      await repo.save(round);
      await this.audit(
        manager,
        round.organizationId,
        projectId,
        'inventory_round',
        roundId,
        'FINISH',
        actor.id,
        { status: InventoryRoundStatus.FINISHED },
      );
      return this.roundResponse(round);
    });
  }

  async reconcile(
    projectId: number,
    sessionId: number,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, true);
    await this.requireSession(projectId, sessionId);
    const observations = await this.observations.find({
      where: { projectId, sessionId },
      order: { capturedAt: 'DESC', id: 'DESC' },
    });
    const latest = new Map<number, InventoryObservationEntity>();
    for (const observation of observations)
      if (!latest.has(observation.inventoryItemId))
        latest.set(observation.inventoryItemId, observation);
    if (latest.size === 0)
      throw new ConflictException({
        code: 'RECONCILIATION_REQUIRES_OBSERVATIONS',
        message: 'No observations available',
      });
    const accounting = await this.accountingItems.find({
      where: {
        organizationId: project.organizationId,
        projectId,
        deletedAt: IsNull(),
      },
    });
    const byPlate = new Map<string, InventoryAccountingItemEntity[]>();
    for (const row of accounting) {
      const plate = InventoryOperationPolicy.normalizePlate(
        row.newInventoryPlate ?? row.plate,
      );
      if (!plate) continue;
      byPlate.set(plate, [...(byPlate.get(plate) ?? []), row]);
    }
    const physicalCounts = new Map<string, number>();
    for (const row of latest.values())
      if (row.observedPlate)
        physicalCounts.set(
          row.observedPlate,
          (physicalCounts.get(row.observedPlate) ?? 0) + 1,
        );
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(InventorySessionEntity).findOne({
        where: { id: sessionId, projectId },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      const max = await manager
        .getRepository(InventoryReconciliationEntity)
        .createQueryBuilder('r')
        .select('MAX(r.runNumber)', 'max')
        .where('r.sessionId = :sessionId', { sessionId })
        .getRawOne<{ max: string | null }>();
      const runNumber = Number(max?.max ?? 0) + 1;
      const rows: InventoryReconciliationEntity[] = [];
      const matchedAccounting = new Set<number>();
      for (const observation of latest.values()) {
        const matches = observation.observedPlate
          ? (byPlate.get(observation.observedPlate) ?? [])
          : [];
        let status = ReconciliationStatus.PHYSICAL_SURPLUS;
        if (
          observation.observedPlate &&
          (physicalCounts.get(observation.observedPlate) ?? 0) > 1
        )
          status = ReconciliationStatus.DUPLICATE;
        else if (matches.length > 1) status = ReconciliationStatus.DUPLICATE;
        else if (matches.length === 1) status = ReconciliationStatus.MATCHED;
        const accountingItem = matches[0] ?? null;
        if (accountingItem) matchedAccounting.add(accountingItem.id);
        rows.push(
          manager.getRepository(InventoryReconciliationEntity).create({
            organizationId: project.organizationId,
            projectId,
            sessionId,
            runNumber,
            inventoryItemId: observation.inventoryItemId,
            observationId: observation.id,
            accountingItemId: accountingItem?.id ?? null,
            status,
            physicalPlate: observation.observedPlate,
            accountingPlate: accountingItem
              ? InventoryOperationPolicy.normalizePlate(
                  accountingItem.newInventoryPlate ?? accountingItem.plate,
                )
              : null,
            evidence: {
              observation_result: observation.result,
              accounting_match_count: matches.length,
            },
            createdById: actor.id,
          }),
        );
      }
      for (const row of accounting)
        if (!matchedAccounting.has(row.id))
          rows.push(
            manager.getRepository(InventoryReconciliationEntity).create({
              organizationId: project.organizationId,
              projectId,
              sessionId,
              runNumber,
              inventoryItemId: null,
              observationId: null,
              accountingItemId: row.id,
              status: ReconciliationStatus.ACCOUNTING_SURPLUS,
              physicalPlate: null,
              accountingPlate: InventoryOperationPolicy.normalizePlate(
                row.newInventoryPlate ?? row.plate,
              ),
              evidence: { reason: 'no_latest_physical_observation' },
              createdById: actor.id,
            }),
          );
      const saved = await manager
        .getRepository(InventoryReconciliationEntity)
        .save(rows);
      await this.audit(
        manager,
        project.organizationId,
        projectId,
        'inventory_reconciliation_run',
        null,
        'CREATE',
        actor.id,
        { session_id: sessionId, run_number: runNumber, records: saved.length },
      );
      return {
        run_number: runNumber,
        records: saved.map((row) => this.reconciliationResponse(row)),
      };
    });
  }

  async listReconciliations(
    projectId: number,
    sessionId: number,
    query: ReconciliationListQueryDto,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, false);
    await this.requireSession(projectId, sessionId);
    const [items, total] = await this.reconciliations.findAndCount({
      where: {
        projectId,
        sessionId,
        ...(query.run_number ? { runNumber: query.run_number } : {}),
        ...(query.status
          ? { status: query.status as ReconciliationStatus }
          : {}),
      },
      order: { runNumber: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return this.paginate(
      items.map((row) => this.reconciliationResponse(row)),
      query,
      total,
    );
  }

  async consolidate(
    projectId: number,
    sessionId: number,
    reconciliationId: number,
    dto: ConsolidateReconciliationDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, true);
    const reconciliation = await this.reconciliations.findOne({
      where: { id: reconciliationId, projectId, sessionId },
    });
    if (!reconciliation) this.notFound('Reconciliation');
    if (reconciliation.status === ReconciliationStatus.DUPLICATE)
      throw new ConflictException({
        code: 'DUPLICATE_BLOCKS_CONSOLIDATION',
        message: 'Duplicate evidence must be resolved before consolidation',
      });
    try {
      return await this.dataSource.transaction(async (manager) => {
        if (
          await manager
            .getRepository(InventoryConsolidationEntity)
            .findOne({ where: { reconciliationId } })
        )
          throw new ConflictException({
            code: 'RECONCILIATION_ALREADY_CONSOLIDATED',
            message: 'Reconciliation already consolidated',
          });
        const entity = await manager
          .getRepository(InventoryConsolidationEntity)
          .save({
            organizationId: project.organizationId,
            projectId,
            sessionId,
            reconciliationId,
            inventoryItemId: reconciliation.inventoryItemId,
            decision: dto.decision,
            notes: this.clean(dto.notes),
            evidenceSnapshot: this.reconciliationResponse(reconciliation),
            decidedById: actor.id,
            decidedAt: new Date(),
          });
        await this.audit(
          manager,
          project.organizationId,
          projectId,
          'inventory_consolidation',
          entity.id,
          'CREATE',
          actor.id,
          { reconciliation_id: reconciliationId, decision: dto.decision },
        );
        return this.consolidationResponse(entity);
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      throw new ConflictException({
        code: 'RECONCILIATION_ALREADY_CONSOLIDATED',
        message: 'Reconciliation already consolidated',
      });
    }
  }

  async createValuation(
    projectId: number,
    itemId: number,
    dto: CreateAssetValuationDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, true);
    await this.requireItem(projectId, itemId);
    if (dto.new_value == null && dto.used_value == null)
      throw new ConflictException({
        code: 'VALUATION_REQUIRES_VALUE',
        message: 'At least one value is required',
      });
    return this.dataSource.transaction(async (manager) => {
      const entity = await manager.getRepository(AssetValuationEntity).save({
        organizationId: project.organizationId,
        projectId,
        inventoryItemId: itemId,
        source: dto.source.trim(),
        newValue: dto.new_value ?? null,
        usedValue: dto.used_value ?? null,
        valuationDate: new Date(`${dto.valuation_date}T00:00:00.000Z`),
        notes: this.clean(dto.notes),
        responsibleById: actor.id,
      });
      await this.audit(
        manager,
        project.organizationId,
        projectId,
        'asset_valuation',
        entity.id,
        'CREATE',
        actor.id,
        {
          item_id: itemId,
          source: entity.source,
          new_value: entity.newValue,
          used_value: entity.usedValue,
        },
      );
      return this.valuationResponse(entity);
    });
  }

  async listValuations(
    projectId: number,
    itemId: number,
    query: InventoryOperationListQueryDto,
    actor: InventoryOperationActor,
  ) {
    await this.getProject(projectId, actor, false);
    await this.requireItem(projectId, itemId);
    const [items, total] = await this.valuations.findAndCount({
      where: { projectId, inventoryItemId: itemId },
      order: { valuationDate: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return this.paginate(
      items.map((row) => this.valuationResponse(row)),
      query,
      total,
    );
  }

  async listPlateHistory(
    projectId: number,
    itemId: number,
    query: InventoryOperationListQueryDto,
    actor: InventoryOperationActor,
  ) {
    const project = await this.getProject(projectId, actor, false);
    await this.requireItem(projectId, itemId);
    const total = await this.plateHistory.count({
      where: {
        organizationId: project.organizationId,
        projectId,
        inventoryItemId: itemId,
      },
    });
    const items = await this.plateHistory
      .createQueryBuilder('plate')
      .leftJoin(
        InventoryObservationEntity,
        'observation',
        'observation.id = plate.observation_id AND observation.project_id = :projectId',
        { projectId },
      )
      .leftJoin(
        InventoryRoundEntity,
        'round',
        'round.id = observation.round_id AND round.project_id = :projectId',
        { projectId },
      )
      .select('plate.id', 'id')
      .addSelect('plate.inventory_item_id', 'inventory_item_id')
      .addSelect('plate.observation_id', 'observation_id')
      .addSelect('plate.previous_plate', 'previous_plate')
      .addSelect('plate.observed_plate', 'observed_plate')
      .addSelect('plate.source', 'source')
      .addSelect('plate.recorded_by_id', 'recorded_by_id')
      .addSelect('plate.created_at', 'created_at')
      .addSelect('observation.session_id', 'session_id')
      .addSelect('observation.round_id', 'round_id')
      .addSelect('round.round_number', 'round_number')
      .addSelect('observation.captured_at', 'captured_at')
      .addSelect('observation.field_agent_id', 'field_agent_id')
      .where('plate.organization_id = :organizationId', {
        organizationId: project.organizationId,
      })
      .andWhere('plate.project_id = :projectId', { projectId })
      .andWhere('plate.inventory_item_id = :itemId', { itemId })
      .orderBy('plate.created_at', 'ASC')
      .addOrderBy('plate.id', 'ASC')
      .offset((query.page - 1) * query.page_size)
      .limit(query.page_size)
      .getRawMany<Record<string, unknown>>();
    return this.paginate(items, query, total);
  }

  private async getProject(
    projectId: number,
    actor: InventoryOperationActor,
    mutation: boolean,
  ) {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) this.notFound('Project');
    if (
      !actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) &&
      actor.organizationId !== project.organizationId
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    if (
      mutation &&
      ['inactive', 'finished', 'cancelled', 'archived'].includes(project.status)
    )
      throw new ConflictException({
        code: 'PROJECT_STATUS_BLOCKS_OPERATION',
        message: 'Project status blocks this operation',
      });
    return project;
  }

  private async requireSession(projectId: number, id: number) {
    const entity = await this.sessions.findOne({ where: { id, projectId } });
    if (!entity) this.notFound('Inventory session');
    return entity;
  }
  private async requireObservation(
    projectId: number,
    sessionId: number,
    roundId: number,
    observationId: number,
  ) {
    const entity = await this.observations.findOne({
      where: {
        id: observationId,
        projectId,
        sessionId,
        roundId,
      },
    });
    if (!entity) this.notFound('Inventory observation');
    return entity;
  }
  private assertSessionAcceptsEvidence(session: InventorySessionEntity) {
    if (session.status !== InventorySessionStatus.ACTIVE)
      throw new ConflictException({
        code: 'INVENTORY_SESSION_NOT_ACTIVE',
        message: 'Evidence can only be added while the session is active',
      });
  }
  private observationEvidenceStorageKey(
    organizationId: number,
    projectId: number,
    sessionId: number,
    observationId: number,
    originalName: string,
  ) {
    const safeName =
      originalName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || 'evidence';
    return [
      `organizations/${organizationId}`,
      `projects/${projectId}`,
      `inventory-sessions/${sessionId}`,
      `observations/${observationId}`,
      `evidence/${randomUUID()}-${safeName}`,
    ].join('/');
  }
  private async requireItem(projectId: number, id: number) {
    const entity = await this.items.findOne({ where: { id, projectId } });
    if (!entity) this.notFound('Inventory item');
    return entity;
  }
  private notFound(resource: string): never {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: `${resource} not found`,
    });
  }
  private clean(value: string | null | undefined) {
    const clean = value?.trim();
    return clean ? clean : null;
  }
  private isUniqueViolation(error: unknown): boolean {
    const value = error as {
      code?: string;
      errno?: number;
      driverError?: { code?: string; errno?: number };
    };
    return (
      value.code === 'ER_DUP_ENTRY' ||
      value.code === 'SQLITE_CONSTRAINT' ||
      value.errno === 1062 ||
      value.driverError?.code === 'ER_DUP_ENTRY' ||
      value.driverError?.code === 'SQLITE_CONSTRAINT' ||
      value.driverError?.errno === 1062
    );
  }
  private paginate<T>(
    items: T[],
    query: InventoryOperationListQueryDto,
    total: number,
  ) {
    return {
      items,
      page: query.page,
      page_size: query.page_size,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / query.page_size),
    };
  }
  private async audit(
    manager: import('typeorm').EntityManager,
    organizationId: number,
    projectId: number,
    entity: string,
    entityId: number | null,
    operation: string,
    actorId: number,
    changes: Record<string, unknown>,
  ) {
    await manager.getRepository(InventoryOperationAuditLogEntity).save({
      organizationId,
      projectId,
      entity,
      entityId,
      operation,
      performedBy: actorId,
      changes,
    });
  }
  private sessionResponse(row: InventorySessionEntity) {
    return {
      id: row.id,
      organization_id: row.organizationId,
      project_id: row.projectId,
      name: row.name,
      status: row.status,
      started_at: row.startedAt,
      finished_at: row.finishedAt,
      cancelled_at: row.cancelledAt,
      cancellation_reason: row.cancellationReason,
      created_by_id: row.createdById,
      metadata: row.metadata,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
  private roundResponse(row: InventoryRoundEntity) {
    return {
      id: row.id,
      session_id: row.sessionId,
      round_number: row.roundNumber,
      kind: row.kind,
      type: row.kind,
      inventory_item_id: row.inventoryItemId,
      reason: row.reason,
      status: row.status,
      requested_by_id: row.requestedById,
      started_at: row.startedAt,
      finished_at: row.finishedAt,
      created_by_id: row.requestedById,
      created_at: row.createdAt,
    };
  }
  private observationResponse(row: InventoryObservationEntity) {
    return {
      id: row.id,
      session_id: row.sessionId,
      round_id: row.roundId,
      inventory_item_id: row.inventoryItemId,
      field_agent_id: row.fieldAgentId,
      prior_observation_id: row.priorObservationId,
      idempotency_key: row.idempotencyKey,
      result: row.result,
      observed_plate: row.observedPlate,
      observed_serial_number: row.observedSerialNumber,
      unit_text: row.unitText,
      sector_text: row.sectorText,
      location_text: row.locationText,
      notes: row.notes,
      captured_at: row.capturedAt,
      received_at: row.receivedAt,
    };
  }
  private evidenceResponse(row: InventoryObservationEvidenceEntity) {
    return {
      id: row.id,
      organization_id: row.organizationId,
      project_id: row.projectId,
      session_id: row.sessionId,
      round_id: row.roundId,
      observation_id: row.observationId,
      storage_provider: row.storageProvider,
      bucket: row.bucket,
      storage_key: row.storageKey,
      original_name: row.originalName,
      mime_type: row.mimeType,
      size_bytes: row.sizeBytes,
      checksum: row.checksum,
      status: row.status,
      created_by_id: row.createdById,
      confirmed_at: row.confirmedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
  private reconciliationResponse(
    row: InventoryReconciliationEntity,
  ): Record<string, unknown> {
    return {
      id: row.id,
      session_id: row.sessionId,
      run_number: row.runNumber,
      inventory_item_id: row.inventoryItemId,
      observation_id: row.observationId,
      accounting_item_id: row.accountingItemId,
      status: row.status,
      physical_plate: row.physicalPlate,
      accounting_plate: row.accountingPlate,
      evidence: row.evidence,
      created_by_id: row.createdById,
      created_at: row.createdAt,
    };
  }
  private consolidationResponse(row: InventoryConsolidationEntity) {
    return {
      id: row.id,
      session_id: row.sessionId,
      reconciliation_id: row.reconciliationId,
      inventory_item_id: row.inventoryItemId,
      decision: row.decision,
      notes: row.notes,
      evidence_snapshot: row.evidenceSnapshot,
      decided_by_id: row.decidedById,
      decided_at: row.decidedAt,
    };
  }
  private valuationResponse(row: AssetValuationEntity) {
    return {
      id: row.id,
      inventory_item_id: row.inventoryItemId,
      source: row.source,
      new_value: row.newValue,
      used_value: row.usedValue,
      valuation_date: row.valuationDate,
      notes: row.notes,
      responsible_by_id: row.responsibleById,
      created_at: row.createdAt,
    };
  }
}
