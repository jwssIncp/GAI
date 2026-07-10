import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogAsset } from '../../domain/entities/catalog-asset';
import {
  CatalogAssetAuditEntry,
  CatalogAssetRepository,
  ListCatalogAssetsParams,
} from '../../domain/ports/catalog-asset.repository.port';
import { CatalogAssetAuditLogEntity } from './catalog-asset-audit-log.entity';
import { CatalogAssetEntity } from './catalog-asset.entity';

@Injectable()
export class TypeOrmCatalogAssetRepository implements CatalogAssetRepository {
  constructor(
    @InjectRepository(CatalogAssetEntity)
    private readonly catalogAssetRepo: Repository<CatalogAssetEntity>,
  ) {}

  async findById(id: number): Promise<CatalogAsset | null> {
    const entity = await this.catalogAssetRepo
      .createQueryBuilder('catalogAsset')
      .withDeleted()
      .where('catalogAsset.id = :id', { id })
      .getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async findByNormalizedDescription(
    organizationId: number,
    descriptionNormalized: string,
    excludeId?: number,
  ): Promise<CatalogAsset | null> {
    const qb = this.catalogAssetRepo
      .createQueryBuilder('catalogAsset')
      .withDeleted()
      .where('catalogAsset.organizationId = :organizationId', {
        organizationId,
      })
      .andWhere('catalogAsset.descriptionNormalized = :descriptionNormalized', {
        descriptionNormalized,
      });

    if (excludeId !== undefined) {
      qb.andWhere('catalogAsset.id <> :excludeId', { excludeId });
    }

    const entity = await qb.getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async list(
    params: ListCatalogAssetsParams,
  ): Promise<{ items: CatalogAsset[]; total: number }> {
    const qb = this.catalogAssetRepo
      .createQueryBuilder('catalogAsset')
      .withDeleted();

    if (params.organizationId) {
      qb.andWhere('catalogAsset.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.status) {
      qb.andWhere('catalogAsset.status = :status', { status: params.status });
    }
    if (params.category) {
      qb.andWhere('LOWER(catalogAsset.category) = :category', {
        category: params.category.toLowerCase(),
      });
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(catalogAsset.description) LIKE :term OR catalogAsset.descriptionNormalized LIKE :normalizedTerm)',
        {
          term: `%${params.search.toLowerCase()}%`,
          normalizedTerm: `%${this.normalizeSearch(params.search)}%`,
        },
      );
    }

    qb.orderBy('catalogAsset.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((entity) => this.toDomain(entity)), total };
  }

  async saveWithAudit(
    catalogAsset: CatalogAsset,
    audit: CatalogAssetAuditEntry,
  ): Promise<CatalogAsset> {
    return this.catalogAssetRepo.manager.transaction(async (manager) => {
      const catalogAssetRepository = manager.getRepository(CatalogAssetEntity);
      const auditRepository = manager.getRepository(CatalogAssetAuditLogEntity);

      const saved = await catalogAssetRepository.save(
        this.toEntity(catalogAsset),
      );
      await auditRepository.save({
        catalogAssetId: audit.catalogAssetId || saved.id,
        organizationId: audit.organizationId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toDomain(saved);
    });
  }

  private toEntity(catalogAsset: CatalogAsset): CatalogAssetEntity {
    const props = catalogAsset.toProps();
    const entity = this.catalogAssetRepo.create({
      organizationId: props.organizationId,
      description: props.description,
      descriptionNormalized: props.descriptionNormalized,
      category: props.category,
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

  private toDomain(entity: CatalogAssetEntity): CatalogAsset {
    return new CatalogAsset({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      description: entity.description,
      descriptionNormalized: entity.descriptionNormalized,
      category: entity.category,
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

  private normalizeSearch(value: string): string {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
