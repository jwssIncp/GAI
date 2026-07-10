import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccountingImportBatch,
  ImportErrorRecord,
} from '../../domain/entities/accounting-import-batch';
import { InventoryAccountingItem } from '../../domain/entities/inventory-accounting-item';
import {
  InventoryAccountingItemAuditEntry,
  InventoryAccountingItemRepository,
  ListAccountingImportBatchesParams,
  ListInventoryAccountingItemsParams,
} from '../../domain/ports/inventory-accounting-item.repository.port';
import { AccountingImportBatchEntity } from './accounting-import-batch.entity';
import { InventoryAccountingItemAuditLogEntity } from './inventory-accounting-item-audit-log.entity';
import { InventoryAccountingItemEntity } from './inventory-accounting-item.entity';

@Injectable()
export class TypeOrmInventoryAccountingItemRepository implements InventoryAccountingItemRepository {
  constructor(
    @InjectRepository(InventoryAccountingItemEntity)
    private readonly itemRepo: Repository<InventoryAccountingItemEntity>,
    @InjectRepository(AccountingImportBatchEntity)
    private readonly batchRepo: Repository<AccountingImportBatchEntity>,
  ) {}

  async findById(id: number): Promise<InventoryAccountingItem | null> {
    const entity = await this.itemRepo
      .createQueryBuilder('item')
      .withDeleted()
      .where('item.id = :id', { id })
      .getOne();
    return entity ? this.toItemDomain(entity) : null;
  }

  async findByNaturalKey(params: {
    organizationId: number;
    projectId: number;
    plate: string | null;
    baseCode: string | null;
    investorCode: string | null;
  }): Promise<InventoryAccountingItem | null> {
    const qb = this.itemRepo
      .createQueryBuilder('item')
      .withDeleted()
      .where('item.organizationId = :organizationId', params)
      .andWhere('item.projectId = :projectId', params);

    if (params.plate) {
      qb.andWhere('item.plate = :plate', params);
    } else {
      qb.andWhere('item.plate IS NULL');
    }
    if (params.baseCode) {
      qb.andWhere('item.baseCode = :baseCode', params);
    } else {
      qb.andWhere('item.baseCode IS NULL');
    }
    if (params.investorCode) {
      qb.andWhere('item.investorCode = :investorCode', params);
    } else {
      qb.andWhere('item.investorCode IS NULL');
    }

    const entity = await qb.getOne();
    return entity ? this.toItemDomain(entity) : null;
  }

  async list(
    params: ListInventoryAccountingItemsParams,
  ): Promise<{ items: InventoryAccountingItem[]; total: number }> {
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
    if (params.plate) {
      qb.andWhere('item.plate = :plate', { plate: params.plate });
    }
    if (params.baseCode) {
      qb.andWhere('item.baseCode = :baseCode', { baseCode: params.baseCode });
    }
    if (params.investorCode) {
      qb.andWhere('item.investorCode = :investorCode', {
        investorCode: params.investorCode,
      });
    }
    if (params.description) {
      qb.andWhere('LOWER(item.description) LIKE :description', {
        description: `%${params.description.toLowerCase()}%`,
      });
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(item.description) LIKE :term OR LOWER(item.plate) LIKE :term OR LOWER(item.baseCode) LIKE :term OR LOWER(item.investorCode) LIKE :term OR LOWER(item.location) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    }

    qb.orderBy('item.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return {
      items: entities.map((entity) => this.toItemDomain(entity)),
      total,
    };
  }

  async saveWithAudit(
    item: InventoryAccountingItem,
    audit: InventoryAccountingItemAuditEntry,
  ): Promise<InventoryAccountingItem> {
    return this.itemRepo.manager.transaction(async (manager) => {
      const itemRepository = manager.getRepository(
        InventoryAccountingItemEntity,
      );
      const auditRepository = manager.getRepository(
        InventoryAccountingItemAuditLogEntity,
      );

      const saved = await itemRepository.save(this.toItemEntity(item));
      await auditRepository.save({
        inventoryAccountingItemId: audit.inventoryAccountingItemId || saved.id,
        organizationId: audit.organizationId,
        projectId: audit.projectId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toItemDomain(saved);
    });
  }

  async saveImportBatch(
    batch: AccountingImportBatch,
  ): Promise<AccountingImportBatch> {
    const saved = await this.batchRepo.save(this.toBatchEntity(batch));
    return this.toBatchDomain(saved);
  }

  async findBatchById(id: number): Promise<AccountingImportBatch | null> {
    const entity = await this.batchRepo.findOne({ where: { id } });
    return entity ? this.toBatchDomain(entity) : null;
  }

  async listBatches(
    params: ListAccountingImportBatchesParams,
  ): Promise<{ items: AccountingImportBatch[]; total: number }> {
    const qb = this.batchRepo
      .createQueryBuilder('batch')
      .where('batch.organizationId = :organizationId', {
        organizationId: params.organizationId,
      })
      .andWhere('batch.projectId = :projectId', {
        projectId: params.projectId,
      });

    if (params.status) {
      qb.andWhere('batch.status = :status', { status: params.status });
    }

    qb.orderBy('batch.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return {
      items: entities.map((entity) => this.toBatchDomain(entity)),
      total,
    };
  }

  async getBatchErrors(batchId: number): Promise<ImportErrorRecord[]> {
    const batch = await this.findBatchById(batchId);
    const metadata = batch?.toProps().metadata;
    const errors = metadata?.error_report;
    return Array.isArray(errors) ? (errors as ImportErrorRecord[]) : [];
  }

  private toItemEntity(
    item: InventoryAccountingItem,
  ): InventoryAccountingItemEntity {
    const props = item.toProps();
    const entity = this.itemRepo.create({
      organizationId: props.organizationId,
      projectId: props.projectId,
      plate: props.plate,
      description: props.description,
      accountingAccountDescription: props.accountingAccountDescription,
      location: props.location,
      acquisitionDate: props.acquisitionDate,
      acquisitionValue: props.acquisitionValue,
      baseCode: props.baseCode,
      status: props.status,
      investorCode: props.investorCode,
      note1: props.note1,
      note2: props.note2,
      newInventoryPlate: props.newInventoryPlate,
      inventoryDescription: props.inventoryDescription,
      inventoryLocation: props.inventoryLocation,
      metadata: props.metadata,
      importedById: props.importedById,
      importBatchId: props.importBatchId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toItemDomain(
    entity: InventoryAccountingItemEntity,
  ): InventoryAccountingItem {
    return new InventoryAccountingItem({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      projectId: Number(entity.projectId),
      plate: entity.plate,
      description: entity.description,
      accountingAccountDescription: entity.accountingAccountDescription,
      location: entity.location,
      acquisitionDate: this.toNullableDate(entity.acquisitionDate),
      acquisitionValue: this.toMoneyString(entity.acquisitionValue),
      baseCode: entity.baseCode,
      status: entity.status,
      investorCode: entity.investorCode,
      note1: entity.note1,
      note2: entity.note2,
      newInventoryPlate: entity.newInventoryPlate,
      inventoryDescription: entity.inventoryDescription,
      inventoryLocation: entity.inventoryLocation,
      metadata: entity.metadata,
      importedById:
        entity.importedById === null ? null : Number(entity.importedById),
      importBatchId:
        entity.importBatchId === null ? null : Number(entity.importBatchId),
      createdAt: this.toDate(entity.createdAt),
      updatedAt: this.toDate(entity.updatedAt),
      deletedAt: this.toNullableDate(entity.deletedAt),
    });
  }

  private toBatchEntity(
    batch: AccountingImportBatch,
  ): AccountingImportBatchEntity {
    const props = batch.toProps();
    const entity = this.batchRepo.create({
      organizationId: props.organizationId,
      projectId: props.projectId,
      originalFileName: props.originalFileName,
      storageProvider: props.storageProvider,
      bucket: props.bucket,
      path: props.path,
      status: props.status,
      totalRows: props.totalRows,
      processedRows: props.processedRows,
      successRows: props.successRows,
      failedRows: props.failedRows,
      errorReportPath: props.errorReportPath,
      importedById: props.importedById,
      startedAt: props.startedAt,
      finishedAt: props.finishedAt,
      metadata: props.metadata,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toBatchDomain(
    entity: AccountingImportBatchEntity,
  ): AccountingImportBatch {
    return new AccountingImportBatch({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      projectId: Number(entity.projectId),
      originalFileName: entity.originalFileName,
      storageProvider: entity.storageProvider,
      bucket: entity.bucket,
      path: entity.path,
      status: entity.status,
      totalRows: Number(entity.totalRows),
      processedRows: Number(entity.processedRows),
      successRows: Number(entity.successRows),
      failedRows: Number(entity.failedRows),
      errorReportPath: entity.errorReportPath,
      importedById:
        entity.importedById === null ? null : Number(entity.importedById),
      startedAt: this.toNullableDate(entity.startedAt),
      finishedAt: this.toNullableDate(entity.finishedAt),
      metadata: entity.metadata,
      createdAt: this.toDate(entity.createdAt),
      updatedAt: this.toDate(entity.updatedAt),
    });
  }

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private toNullableDate(value: Date | string | null): Date | null {
    return value === null ? null : this.toDate(value);
  }

  private toMoneyString(value: string | number | null): string | null {
    if (value === null) {
      return null;
    }
    return Number(value).toFixed(2);
  }
}
