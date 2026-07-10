import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryPendingIssue } from '../../domain/entities/inventory-pending-issue';
import { InventoryPendingIssueStatus } from '../../domain/enums/inventory-pending-issue-status.enum';
import {
  InventoryPendingIssueAuditEntry,
  InventoryPendingIssueRepository,
  ListInventoryPendingIssuesParams,
} from '../../domain/ports/inventory-pending-issue.repository.port';
import { InventoryPendingIssueAuditLogEntity } from './inventory-pending-issue-audit-log.entity';
import { InventoryPendingIssueEntity } from './inventory-pending-issue.entity';

@Injectable()
export class TypeOrmInventoryPendingIssueRepository implements InventoryPendingIssueRepository {
  constructor(
    @InjectRepository(InventoryPendingIssueEntity)
    private readonly issueRepo: Repository<InventoryPendingIssueEntity>,
  ) {}

  async findById(id: number): Promise<InventoryPendingIssue | null> {
    const entity = await this.issueRepo
      .createQueryBuilder('issue')
      .withDeleted()
      .where('issue.id = :id', { id })
      .getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async findOpenDuplicate(params: {
    organizationId: number;
    projectId: number;
    type: string;
    inventoryItemId: number | null;
    accountingItemId: number | null;
  }): Promise<InventoryPendingIssue | null> {
    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .where('issue.organizationId = :organizationId', params)
      .andWhere('issue.projectId = :projectId', params)
      .andWhere('issue.type = :type', params)
      .andWhere('issue.status IN (:...statuses)', {
        statuses: [
          InventoryPendingIssueStatus.OPEN,
          InventoryPendingIssueStatus.IN_REVIEW,
        ],
      });

    if (params.inventoryItemId === null) {
      qb.andWhere('issue.inventoryItemId IS NULL');
    } else {
      qb.andWhere('issue.inventoryItemId = :inventoryItemId', params);
    }
    if (params.accountingItemId === null) {
      qb.andWhere('issue.accountingItemId IS NULL');
    } else {
      qb.andWhere('issue.accountingItemId = :accountingItemId', params);
    }

    const entity = await qb.getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async list(
    params: ListInventoryPendingIssuesParams,
  ): Promise<{ items: InventoryPendingIssue[]; total: number }> {
    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .withDeleted()
      .leftJoin(
        'inventory_items',
        'inventoryItem',
        'inventoryItem.id = issue.inventoryItemId',
      )
      .leftJoin(
        'inventory_accounting_items',
        'accountingItem',
        'accountingItem.id = issue.accountingItemId',
      );

    if (params.organizationId) {
      qb.andWhere('issue.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.projectId) {
      qb.andWhere('issue.projectId = :projectId', {
        projectId: params.projectId,
      });
    }
    if (params.type) {
      qb.andWhere('issue.type = :type', { type: params.type });
    }
    if (params.status) {
      qb.andWhere('issue.status = :status', { status: params.status });
    } else if (!params.includeIgnored) {
      qb.andWhere('issue.status != :ignored', {
        ignored: InventoryPendingIssueStatus.IGNORED,
      });
    }
    if (params.severity) {
      qb.andWhere('issue.severity = :severity', { severity: params.severity });
    }
    if (params.inventoryItemId) {
      qb.andWhere('issue.inventoryItemId = :inventoryItemId', {
        inventoryItemId: params.inventoryItemId,
      });
    }
    if (params.accountingItemId) {
      qb.andWhere('issue.accountingItemId = :accountingItemId', {
        accountingItemId: params.accountingItemId,
      });
    }
    if (params.plate) {
      qb.andWhere(
        '(inventoryItem.oldPlate = :plate OR inventoryItem.newPlate = :plate OR accountingItem.plate = :plate OR accountingItem.newInventoryPlate = :plate)',
        { plate: params.plate },
      );
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(issue.title) LIKE :term OR LOWER(issue.description) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    }

    qb.orderBy('issue.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((entity) => this.toDomain(entity)), total };
  }

  async saveWithAudit(
    issue: InventoryPendingIssue,
    audit: InventoryPendingIssueAuditEntry,
  ): Promise<InventoryPendingIssue> {
    return this.issueRepo.manager.transaction(async (manager) => {
      const issueRepository = manager.getRepository(
        InventoryPendingIssueEntity,
      );
      const auditRepository = manager.getRepository(
        InventoryPendingIssueAuditLogEntity,
      );

      const saved = await issueRepository.save(this.toEntity(issue));
      await auditRepository.save({
        inventoryPendingIssueId: audit.inventoryPendingIssueId || saved.id,
        organizationId: audit.organizationId,
        projectId: audit.projectId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toDomain(saved);
    });
  }

  private toEntity(issue: InventoryPendingIssue): InventoryPendingIssueEntity {
    const props = issue.toProps();
    const entity = this.issueRepo.create({
      organizationId: props.organizationId,
      projectId: props.projectId,
      inventoryItemId: props.inventoryItemId,
      accountingItemId: props.accountingItemId,
      type: props.type,
      status: props.status,
      severity: props.severity,
      title: props.title,
      description: props.description,
      oldValue: props.oldValue,
      newValue: props.newValue,
      resolutionNotes: props.resolutionNotes,
      resolvedById: props.resolvedById,
      resolvedAt: props.resolvedAt,
      ignoredById: props.ignoredById,
      ignoredAt: props.ignoredAt,
      createdById: props.createdById,
      updatedById: props.updatedById,
      metadata: props.metadata,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt,
    });
    if (props.id > 0) entity.id = props.id;
    return entity;
  }

  private toDomain(entity: InventoryPendingIssueEntity): InventoryPendingIssue {
    return new InventoryPendingIssue({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      projectId: Number(entity.projectId),
      inventoryItemId:
        entity.inventoryItemId === null ? null : Number(entity.inventoryItemId),
      accountingItemId:
        entity.accountingItemId === null
          ? null
          : Number(entity.accountingItemId),
      type: entity.type,
      status: entity.status,
      severity: entity.severity,
      title: entity.title,
      description: entity.description,
      oldValue: entity.oldValue,
      newValue: entity.newValue,
      resolutionNotes: entity.resolutionNotes,
      resolvedById:
        entity.resolvedById === null ? null : Number(entity.resolvedById),
      resolvedAt: this.toNullableDate(entity.resolvedAt),
      ignoredById:
        entity.ignoredById === null ? null : Number(entity.ignoredById),
      ignoredAt: this.toNullableDate(entity.ignoredAt),
      createdById:
        entity.createdById === null ? null : Number(entity.createdById),
      updatedById:
        entity.updatedById === null ? null : Number(entity.updatedById),
      metadata: entity.metadata,
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
