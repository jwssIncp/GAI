import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { ProjectFieldAgentStatus } from '../../../field-agents/domain/enums/project-field-agent-status.enum';
import { ProjectFieldAgentEntity } from '../../../field-agents/infrastructure/persistence/project-field-agent.entity';
import { ImportFileStatus } from '../../../import-sessions/domain/enums/import-file-status.enum';
import { ImportPayloadStatus } from '../../../import-sessions/domain/enums/import-payload-status.enum';
import { ImportSessionStatus } from '../../../import-sessions/domain/enums/import-session-status.enum';
import { ImportFileEntity } from '../../../import-sessions/infrastructure/persistence/import-file.entity';
import { ImportPayloadEntity } from '../../../import-sessions/infrastructure/persistence/import-payload.entity';
import { ImportSessionEntity } from '../../../import-sessions/infrastructure/persistence/import-session.entity';
import { AccountingImportBatchStatus } from '../../../inventory-accounting-items/domain/enums/accounting-import-batch-status.enum';
import { InventoryAccountingItemStatus } from '../../../inventory-accounting-items/domain/enums/inventory-accounting-item-status.enum';
import { AccountingImportBatchEntity } from '../../../inventory-accounting-items/infrastructure/persistence/accounting-import-batch.entity';
import { InventoryAccountingItemEntity } from '../../../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemImageStatus } from '../../../inventory-item-images/domain/enums/inventory-item-image-status.enum';
import { InventoryItemImageEntity } from '../../../inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { InventoryItemStatus } from '../../../inventory-items/domain/enums/inventory-item-status.enum';
import { InventoryItemEntity } from '../../../inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryPendingIssueStatus } from '../../../inventory-pending-issues/domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueEntity } from '../../../inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { ExpenseAttachmentStatus } from '../../../payments-expenses/domain/enums/expense-attachment-status.enum';
import { ExpenseStatus } from '../../../payments-expenses/domain/enums/expense-status.enum';
import { PaymentStatus } from '../../../payments-expenses/domain/enums/payment-status.enum';
import { ExpenseAttachmentEntity } from '../../../payments-expenses/infrastructure/persistence/expense-attachment.entity';
import { ExpenseEntity } from '../../../payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../../../payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { Project } from '../../domain/entities/project';
import {
  ListProjectsParams,
  ProjectAuditEntry,
  ProjectEditableFields,
  ProjectFieldsUpdateResult,
  ProjectOpenOperation,
  ProjectRepository,
  ProjectStatusTransitionResult,
} from '../../domain/ports/project.repository.port';
import {
  ProjectReadinessProfile,
  ProjectStatusTransitionError,
  ProjectStatusTransitionPolicy,
} from '../../domain/services/project-status-transition.policy';
import { ProjectAuditLogEntity } from './project-audit-log.entity';
import { ProjectEntity } from './project.entity';

@Injectable()
export class TypeOrmProjectRepository implements ProjectRepository {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
  ) {}

  async findById(id: number): Promise<Project | null> {
    const entity = await this.projectRepo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async list(
    params: ListProjectsParams,
  ): Promise<{ items: Project[]; total: number }> {
    const qb = this.projectRepo.createQueryBuilder('project');

    if (params.organizationId) {
      qb.andWhere('project.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.status) {
      qb.andWhere('project.status = :status', { status: params.status });
    }
    if (params.companyId) {
      qb.andWhere('project.companyId = :companyId', {
        companyId: params.companyId,
      });
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(project.name) LIKE :term OR LOWER(project.description) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    }

    qb.orderBy('project.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((entity) => this.toDomain(entity)), total };
  }

  async saveWithAudit(
    project: Project,
    audit: ProjectAuditEntry,
  ): Promise<Project> {
    return this.projectRepo.manager.transaction(async (manager) => {
      const projectRepository = manager.getRepository(ProjectEntity);
      const auditRepository = manager.getRepository(ProjectAuditLogEntity);

      const saved = await projectRepository.save(this.toEntity(project));
      await auditRepository.save({
        projectId: audit.projectId || saved.id,
        organizationId: audit.organizationId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toDomain(saved);
    });
  }

  async updateFieldsWithAudit(params: {
    id: number;
    expectedStatus: import('../../domain/enums/project-status.enum').ProjectStatus;
    expectedUpdatedAt: Date;
    fields: ProjectEditableFields;
    actorId: number;
    now: Date;
    audit: ProjectAuditEntry;
  }): Promise<ProjectFieldsUpdateResult> {
    return this.projectRepo.manager.transaction(async (manager) => {
      const projectRepository = manager.getRepository(ProjectEntity);
      const auditRepository = manager.getRepository(ProjectAuditLogEntity);
      const fields = params.fields;

      const update = await projectRepository.update(
        {
          id: params.id,
          status: params.expectedStatus,
          updatedAt: params.expectedUpdatedAt,
        },
        {
          ...(fields.name !== undefined ? { name: fields.name } : {}),
          ...(fields.description !== undefined
            ? { description: fields.description }
            : {}),
          ...(fields.startDate !== undefined
            ? { startDate: fields.startDate }
            : {}),
          ...(fields.endDate !== undefined ? { endDate: fields.endDate } : {}),
          updatedById: params.actorId,
          updatedAt: params.now,
        },
      );

      if (update.affected !== 1) {
        const current = await projectRepository.findOne({
          where: { id: params.id },
        });
        if (!current) {
          return { kind: 'not_found' };
        }
        return {
          kind: 'concurrent_modification',
          currentStatus: current.status,
          currentUpdatedAt: this.toDate(current.updatedAt),
        };
      }

      await auditRepository.save({
        projectId: params.audit.projectId || params.id,
        organizationId: params.audit.organizationId,
        operation: params.audit.operation,
        performedBy: params.audit.performedBy,
        changes: params.audit.changes,
      });

      const saved = await projectRepository.findOneOrFail({
        where: { id: params.id },
      });
      return { kind: 'success', project: this.toDomain(saved) };
    });
  }

  async transitionStatusWithAudit(params: {
    id: number;
    action: import('../../domain/services/project-status-transition.policy').ProjectStatusAction;
    actorId: number;
    now: Date;
  }): Promise<ProjectStatusTransitionResult> {
    return this.projectRepo.manager.transaction(async (manager) => {
      const projectRepository = manager.getRepository(ProjectEntity);
      const auditRepository = manager.getRepository(ProjectAuditLogEntity);
      let query = projectRepository
        .createQueryBuilder('project')
        .where('project.id = :id', { id: params.id });

      if (this.supportsPessimisticLock(manager)) {
        query = query.setLock('pessimistic_write');
      }

      const entity = await query.getOne();
      if (!entity) {
        return { kind: 'not_found' };
      }

      let rule;
      try {
        rule = ProjectStatusTransitionPolicy.resolve(
          entity.status,
          params.action,
        );
      } catch (error) {
        if (error instanceof ProjectStatusTransitionError) {
          return {
            kind: 'invalid_transition',
            currentStatus: entity.status,
          };
        }
        throw error;
      }

      const operations = await this.findBlockingOperations(
        manager,
        entity.id,
        rule.readiness,
      );
      if (operations.length > 0) {
        return {
          kind: 'open_operations',
          currentStatus: entity.status,
          operations,
        };
      }

      const project = this.toDomain(entity);
      const expectedStatus = project.status;
      const changes = project.applyStatusAction(
        params.action,
        params.actorId,
        params.now,
      );
      const props = project.toProps();
      const update = await projectRepository.update(
        { id: params.id, status: expectedStatus },
        {
          status: props.status,
          finishedAt: props.finishedAt,
          updatedById: params.actorId,
          updatedAt: params.now,
        },
      );

      if (update.affected !== 1) {
        const current = await projectRepository.findOne({
          where: { id: params.id },
        });
        return {
          kind: 'concurrent_modification',
          currentStatus: current?.status ?? null,
        };
      }

      await auditRepository.save({
        projectId: params.id,
        organizationId: entity.organizationId,
        operation: rule.auditOperation,
        performedBy: params.actorId,
        changes,
      });

      const saved = await projectRepository.findOneOrFail({
        where: { id: params.id },
      });
      return { kind: 'success', project: this.toDomain(saved) };
    });
  }

  private supportsPessimisticLock(manager: EntityManager): boolean {
    return !['sqlite', 'better-sqlite3', 'sqljs'].includes(
      String(manager.connection.options.type),
    );
  }

  private async findBlockingOperations(
    manager: EntityManager,
    projectId: number,
    profile: ProjectReadinessProfile,
  ): Promise<ProjectOpenOperation[]> {
    if (profile === 'none') {
      return [];
    }

    const operations: ProjectOpenOperation[] = [];
    const add = (type: string, count: number): void => {
      if (count > 0) operations.push({ type, count });
    };

    add(
      'import_session',
      await manager.getRepository(ImportSessionEntity).count({
        where: {
          projectId,
          status: In([
            ImportSessionStatus.OPEN,
            ImportSessionStatus.RECEIVING,
            ImportSessionStatus.PROCESSING,
            ImportSessionStatus.FAILED,
          ]),
          deletedAt: IsNull(),
        },
      }),
    );
    add(
      'import_payload',
      await manager
        .getRepository(ImportPayloadEntity)
        .createQueryBuilder('payload')
        .innerJoin(
          ImportSessionEntity,
          'session',
          'session.id = payload.import_session_id',
        )
        .where('session.project_id = :projectId', { projectId })
        .andWhere('session.deleted_at IS NULL')
        .andWhere('payload.status IN (:...statuses)', {
          statuses: [
            ImportPayloadStatus.RECEIVED,
            ImportPayloadStatus.PROCESSING,
            ImportPayloadStatus.FAILED,
          ],
        })
        .getCount(),
    );
    add(
      'import_file_pending_upload',
      await manager
        .getRepository(ImportFileEntity)
        .createQueryBuilder('file')
        .innerJoin(
          ImportSessionEntity,
          'session',
          'session.id = file.import_session_id',
        )
        .where('session.project_id = :projectId', { projectId })
        .andWhere('session.deleted_at IS NULL')
        .andWhere('file.deleted_at IS NULL')
        .andWhere('file.status = :status', {
          status: ImportFileStatus.PENDING_UPLOAD,
        })
        .getCount(),
    );
    add(
      'accounting_import_batch',
      await manager.getRepository(AccountingImportBatchEntity).count({
        where: {
          projectId,
          status: In([
            AccountingImportBatchStatus.PENDING,
            AccountingImportBatchStatus.PROCESSING,
          ]),
        },
      }),
    );
    add(
      'inventory_image_pending_upload',
      await manager
        .getRepository(InventoryItemImageEntity)
        .createQueryBuilder('image')
        .innerJoin(
          InventoryItemEntity,
          'item',
          'item.id = image.inventory_item_id',
        )
        .where('item.project_id = :projectId', { projectId })
        .andWhere('item.deleted_at IS NULL')
        .andWhere('image.deleted_at IS NULL')
        .andWhere('image.status = :status', {
          status: InventoryItemImageStatus.PENDING_UPLOAD,
        })
        .getCount(),
    );
    add(
      'expense_attachment_pending_upload',
      await manager
        .getRepository(ExpenseAttachmentEntity)
        .createQueryBuilder('attachment')
        .innerJoin(
          ExpenseEntity,
          'expense',
          'expense.id = attachment.expense_id',
        )
        .where('expense.project_id = :projectId', { projectId })
        .andWhere('expense.deleted_at IS NULL')
        .andWhere('attachment.deleted_at IS NULL')
        .andWhere('attachment.status = :status', {
          status: ExpenseAttachmentStatus.PENDING_UPLOAD,
        })
        .getCount(),
    );
    add('export_job', await this.countOpenExportJobs(manager, projectId));

    add(
      'inventory_item_pending',
      await manager.getRepository(InventoryItemEntity).count({
        where: {
          projectId,
          status: InventoryItemStatus.PENDING,
          deletedAt: IsNull(),
        },
      }),
    );
    add(
      'accounting_item_pending',
      await manager.getRepository(InventoryAccountingItemEntity).count({
        where: {
          projectId,
          status: InventoryAccountingItemStatus.PENDING,
          deletedAt: IsNull(),
        },
      }),
    );
    add(
      'pending_issue_open',
      await manager.getRepository(InventoryPendingIssueEntity).count({
        where: {
          projectId,
          status: In([
            InventoryPendingIssueStatus.OPEN,
            InventoryPendingIssueStatus.IN_REVIEW,
          ]),
          deletedAt: IsNull(),
        },
      }),
    );
    add(
      'field_agent_assignment_active',
      await manager.getRepository(ProjectFieldAgentEntity).count({
        where: { projectId, status: ProjectFieldAgentStatus.ACTIVE },
      }),
    );
    add(
      'payment_open',
      await manager.getRepository(FieldAgentPaymentEntity).count({
        where: {
          projectId,
          status: In([PaymentStatus.PENDING, PaymentStatus.APPROVED]),
          deletedAt: IsNull(),
        },
      }),
    );
    add(
      'expense_open',
      await manager.getRepository(ExpenseEntity).count({
        where: {
          projectId,
          status: In([ExpenseStatus.PENDING, ExpenseStatus.APPROVED]),
          deletedAt: IsNull(),
        },
      }),
    );
    return operations;
  }

  private async countOpenExportJobs(
    manager: EntityManager,
    projectId: number,
  ): Promise<number> {
    const table = await manager.queryRunner?.getTable('export_jobs');
    if (!table) return 0;
    const deletedPredicate = table.findColumnByName('deleted_at')
      ? ' AND deleted_at IS NULL'
      : '';
    const rows: unknown = await manager.query(
      `SELECT COUNT(*) AS count FROM export_jobs WHERE project_id = ? AND status IN (?, ?)${deletedPredicate}`,
      [projectId, 'pending', 'processing'],
    );
    if (!Array.isArray(rows)) return 0;
    const first: unknown = rows[0];
    if (typeof first !== 'object' || first === null || !('count' in first)) {
      return 0;
    }
    return Number(first.count ?? 0);
  }

  private toEntity(project: Project): ProjectEntity {
    const props = project.toProps();
    const entity = this.projectRepo.create({
      organizationId: props.organizationId,
      companyId: props.companyId,
      name: props.name,
      description: props.description,
      status: props.status,
      startDate: props.startDate,
      endDate: props.endDate,
      finishedAt: props.finishedAt,
      settings: props.settings,
      metadata: props.metadata,
      createdById: props.createdById,
      updatedById: props.updatedById,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toDomain(entity: ProjectEntity): Project {
    return new Project({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      companyId: entity.companyId === null ? null : Number(entity.companyId),
      name: entity.name,
      description: entity.description,
      status: entity.status,
      startDate: this.toNullableDate(entity.startDate),
      endDate: this.toNullableDate(entity.endDate),
      finishedAt: this.toNullableDate(entity.finishedAt),
      settings: entity.settings,
      metadata: entity.metadata,
      createdById:
        entity.createdById === null ? null : Number(entity.createdById),
      updatedById:
        entity.updatedById === null ? null : Number(entity.updatedById),
      createdAt: this.toDate(entity.createdAt),
      updatedAt: this.toDate(entity.updatedAt),
      deletedAt: this.toNullableDate(entity.deletedAt),
    });
  }

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private toNullableDate(value: Date | string | null): Date | null {
    return value === null ? null : this.toDate(value);
  }
}
