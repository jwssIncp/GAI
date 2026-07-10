import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from '../../domain/entities/inventory-item';
import {
  InventoryItemAuditEntry,
  InventoryItemRepository,
  ListInventoryItemsParams,
} from '../../domain/ports/inventory-item.repository.port';
import { InventoryItemAuditLogEntity } from './inventory-item-audit-log.entity';
import { InventoryItemEntity } from './inventory-item.entity';

@Injectable()
export class TypeOrmInventoryItemRepository implements InventoryItemRepository {
  constructor(
    @InjectRepository(InventoryItemEntity)
    private readonly itemRepo: Repository<InventoryItemEntity>,
  ) {}

  async findById(id: number): Promise<InventoryItem | null> {
    const entity = await this.itemRepo
      .createQueryBuilder('item')
      .withDeleted()
      .where('item.id = :id', { id })
      .getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async list(
    params: ListInventoryItemsParams,
  ): Promise<{ items: InventoryItem[]; total: number }> {
    const qb = this.itemRepo.createQueryBuilder('item').withDeleted();

    if (params.organizationId) {
      qb.andWhere('item.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.projectId) {
      qb.andWhere('item.projectId = :projectId', {
        projectId: params.projectId,
      });
    }
    if (params.status) {
      qb.andWhere('item.status = :status', { status: params.status });
    }
    if (params.oldPlate) {
      qb.andWhere('item.oldPlate = :oldPlate', { oldPlate: params.oldPlate });
    }
    if (params.newPlate) {
      qb.andWhere('item.newPlate = :newPlate', { newPlate: params.newPlate });
    }
    if (params.description) {
      qb.andWhere('LOWER(item.description) LIKE :description', {
        description: `%${params.description.toLowerCase()}%`,
      });
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(item.description) LIKE :term OR LOWER(item.oldPlate) LIKE :term OR LOWER(item.newPlate) LIKE :term OR LOWER(item.brand) LIKE :term OR LOWER(item.model) LIKE :term OR LOWER(item.serialNumber) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    }

    qb.orderBy('item.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((entity) => this.toDomain(entity)), total };
  }

  async saveWithAudit(
    item: InventoryItem,
    audit: InventoryItemAuditEntry,
  ): Promise<InventoryItem> {
    return this.itemRepo.manager.transaction(async (manager) => {
      const itemRepository = manager.getRepository(InventoryItemEntity);
      const auditRepository = manager.getRepository(
        InventoryItemAuditLogEntity,
      );

      const saved = await itemRepository.save(this.toEntity(item));
      await auditRepository.save({
        inventoryItemId: audit.inventoryItemId || saved.id,
        organizationId: audit.organizationId,
        projectId: audit.projectId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toDomain(saved);
    });
  }

  private toEntity(item: InventoryItem): InventoryItemEntity {
    const props = item.toProps();
    const entity = this.itemRepo.create({
      organizationId: props.organizationId,
      projectId: props.projectId,
      externalItemId: props.externalItemId,
      sequence: props.sequence,
      oldPlate: props.oldPlate,
      newPlate: props.newPlate,
      unitText: props.unitText,
      addressText: props.addressText,
      locationText: props.locationText,
      description: props.description,
      brand: props.brand,
      model: props.model,
      serialNumber: props.serialNumber,
      capacity: props.capacity,
      year: props.year,
      notes: props.notes,
      source: props.source,
      usedValue: props.usedValue,
      newValue: props.newValue,
      status: props.status,
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

  private toDomain(entity: InventoryItemEntity): InventoryItem {
    return new InventoryItem({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      projectId: Number(entity.projectId),
      externalItemId: entity.externalItemId,
      sequence: entity.sequence,
      oldPlate: entity.oldPlate,
      newPlate: entity.newPlate,
      unitText: entity.unitText,
      addressText: entity.addressText,
      locationText: entity.locationText,
      description: entity.description,
      brand: entity.brand,
      model: entity.model,
      serialNumber: entity.serialNumber,
      capacity: entity.capacity,
      year: entity.year === null ? null : Number(entity.year),
      notes: entity.notes,
      source: entity.source,
      usedValue: entity.usedValue === null ? null : String(entity.usedValue),
      newValue: entity.newValue === null ? null : String(entity.newValue),
      status: entity.status,
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
