import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { InventoryItemImage } from '../../domain/entities/inventory-item-image';
import { InventoryItemImageStatus } from '../../domain/enums/inventory-item-image-status.enum';
import {
  InventoryItemImageAuditEntry,
  InventoryItemImageRepository,
  ListInventoryItemImagesParams,
} from '../../domain/ports/inventory-item-image.repository.port';
import { InventoryItemImageAuditLogEntity } from './inventory-item-image-audit-log.entity';
import { InventoryItemImageEntity } from './inventory-item-image.entity';

@Injectable()
export class TypeOrmInventoryItemImageRepository implements InventoryItemImageRepository {
  constructor(
    @InjectRepository(InventoryItemImageEntity)
    private readonly imageRepo: Repository<InventoryItemImageEntity>,
  ) {}

  async findById(id: number): Promise<InventoryItemImage | null> {
    const entity = await this.imageRepo
      .createQueryBuilder('image')
      .withDeleted()
      .where('image.id = :id', { id })
      .getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async countActiveByItem(inventoryItemId: number): Promise<number> {
    return this.imageRepo.count({
      where: {
        inventoryItemId,
        status: Not(InventoryItemImageStatus.REMOVED),
      },
      withDeleted: true,
    });
  }

  async list(
    params: ListInventoryItemImagesParams,
  ): Promise<{ items: InventoryItemImage[]; total: number }> {
    const qb = this.imageRepo.createQueryBuilder('image').withDeleted();

    if (params.organizationId) {
      qb.andWhere('image.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.inventoryItemId) {
      qb.andWhere('image.inventoryItemId = :inventoryItemId', {
        inventoryItemId: params.inventoryItemId,
      });
    }
    if (params.status) {
      qb.andWhere('image.status = :status', { status: params.status });
    }

    qb.orderBy('image.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((entity) => this.toDomain(entity)), total };
  }

  async saveWithAudit(
    image: InventoryItemImage,
    audit: InventoryItemImageAuditEntry,
  ): Promise<InventoryItemImage> {
    return this.imageRepo.manager.transaction(async (manager) => {
      const imageRepository = manager.getRepository(InventoryItemImageEntity);
      const auditRepository = manager.getRepository(
        InventoryItemImageAuditLogEntity,
      );

      const saved = await imageRepository.save(this.toEntity(image));
      await auditRepository.save({
        inventoryItemImageId: audit.inventoryItemImageId || saved.id,
        organizationId: audit.organizationId,
        inventoryItemId: audit.inventoryItemId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toDomain(saved);
    });
  }

  async audit(audit: InventoryItemImageAuditEntry): Promise<void> {
    await this.imageRepo.manager
      .getRepository(InventoryItemImageAuditLogEntity)
      .save({
        inventoryItemImageId: audit.inventoryItemImageId,
        organizationId: audit.organizationId,
        inventoryItemId: audit.inventoryItemId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });
  }

  private toEntity(image: InventoryItemImage): InventoryItemImageEntity {
    const props = image.toProps();
    const entity = this.imageRepo.create({
      organizationId: props.organizationId,
      inventoryItemId: props.inventoryItemId,
      storageProvider: props.storageProvider,
      bucket: props.bucket,
      path: props.path,
      originalName: props.originalName,
      mimeType: props.mimeType,
      sizeBytes: props.sizeBytes,
      checksum: props.checksum,
      status: props.status,
      uploadedById: props.uploadedById,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toDomain(entity: InventoryItemImageEntity): InventoryItemImage {
    return new InventoryItemImage({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      inventoryItemId: Number(entity.inventoryItemId),
      storageProvider: entity.storageProvider,
      bucket: entity.bucket,
      path: entity.path,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      sizeBytes: Number(entity.sizeBytes),
      checksum: entity.checksum,
      status: entity.status,
      uploadedById:
        entity.uploadedById === null ? null : Number(entity.uploadedById),
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
