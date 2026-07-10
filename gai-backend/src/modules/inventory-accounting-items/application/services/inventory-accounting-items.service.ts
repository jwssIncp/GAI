import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import {
  AccountingImportBatch,
  ImportErrorRecord,
} from '../../domain/entities/accounting-import-batch';
import { InventoryAccountingItem } from '../../domain/entities/inventory-accounting-item';
import { AccountingImportBatchStatus } from '../../domain/enums/accounting-import-batch-status.enum';
import { InventoryAccountingItemAuditOperation } from '../../domain/enums/inventory-accounting-item-audit-operation.enum';
import { InventoryAccountingItemStatus } from '../../domain/enums/inventory-accounting-item-status.enum';
import {
  INVENTORY_ACCOUNTING_ITEM_REPOSITORY,
  type InventoryAccountingItemRepository,
} from '../../domain/ports/inventory-accounting-item.repository.port';
import { UpdateInventoryAccountingItemDto } from '../dto/inventory-accounting-item-inputs';
import {
  AccountingImportBatchListResponseDto,
  AccountingImportBatchResponseDto,
  InventoryAccountingItemListResponseDto,
  InventoryAccountingItemResponseDto,
} from '../dto/inventory-accounting-item-response.dto';
import {
  ListAccountingImportBatchesQueryDto,
  ListInventoryAccountingItemsQueryDto,
} from '../dto/list-inventory-accounting-items-query.dto';
import { AccountingImportParserService } from './accounting-import-parser.service';
import {
  InventoryAccountingItemActorContext,
  InventoryAccountingItemScopeService,
} from './inventory-accounting-item-scope.service';

export interface UploadedAccountingFile {
  originalname: string;
  buffer: Buffer;
  mimetype?: string;
}

@Injectable()
export class InventoryAccountingItemsService {
  constructor(
    @Inject(INVENTORY_ACCOUNTING_ITEM_REPOSITORY)
    private readonly repository: InventoryAccountingItemRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: InventoryAccountingItemScopeService,
    private readonly parser: AccountingImportParserService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(InventoryAccountingItemsService.name);
  }

  async importFile(
    projectId: number,
    file: UploadedAccountingFile | undefined,
    actor: InventoryAccountingItemActorContext,
  ): Promise<AccountingImportBatchResponseDto> {
    if (!file?.buffer) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'XLSX file is required',
      });
    }
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only XLSX files are supported',
      });
    }

    const project = await this.getAuthorizedProject(projectId, actor, true);
    const now = new Date();
    let batch = await this.repository.saveImportBatch(
      new AccountingImportBatch({
        id: 0,
        organizationId: project.organizationId,
        projectId,
        originalFileName: file.originalname,
        storageProvider: null,
        bucket: null,
        path: null,
        status: AccountingImportBatchStatus.PROCESSING,
        totalRows: 0,
        processedRows: 0,
        successRows: 0,
        failedRows: 0,
        errorReportPath: null,
        importedById: actor.id,
        startedAt: now,
        finishedAt: null,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const rows = this.parser.parse(file.buffer);
    const errors: ImportErrorRecord[] = [];
    let successRows = 0;

    for (const row of rows) {
      if (row.errors.length > 0) {
        errors.push({ row: row.rowNumber, errors: row.errors });
        continue;
      }
      try {
        const existing = await this.repository.findByNaturalKey({
          organizationId: project.organizationId,
          projectId,
          plate: row.data.plate,
          baseCode: row.data.baseCode,
          investorCode: row.data.investorCode,
        });
        const item =
          existing ??
          this.newItem(project.organizationId, projectId, actor.id, batch.id);
        const changes = item.updateFields({
          ...row.data,
          importedById: actor.id,
          importBatchId: batch.id,
        });
        const saved = await this.repository.saveWithAudit(item, {
          inventoryAccountingItemId: item.id,
          organizationId: project.organizationId,
          projectId,
          operation: existing
            ? InventoryAccountingItemAuditOperation.UPDATE
            : InventoryAccountingItemAuditOperation.IMPORT,
          performedBy: actor.id,
          changes:
            Object.keys(changes).length > 0
              ? changes
              : { import_batch_id: { before: null, after: batch.id } },
        });
        successRows += saved.id > 0 ? 1 : 0;
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          errors: [error instanceof Error ? error.message : 'Invalid row'],
        });
      }
    }

    batch.finish(rows.length, successRows, errors, new Date());
    batch = await this.repository.saveImportBatch(batch);

    this.logger.info({
      operation: 'IMPORT_INVENTORY_ACCOUNTING_ITEMS',
      batchId: batch.id,
      projectId,
      organizationId: project.organizationId,
      totalRows: rows.length,
      successRows,
      failedRows: errors.length,
      result: errors.length > 0 ? 'FAILED_WITH_ROW_ERRORS' : 'SUCCESS',
    });

    return AccountingImportBatchResponseDto.fromDomain(batch);
  }

  async listItems(
    projectId: number,
    query: ListInventoryAccountingItemsQueryDto,
    actor: InventoryAccountingItemActorContext,
  ): Promise<InventoryAccountingItemListResponseDto> {
    const project = await this.getAuthorizedProject(projectId, actor, false);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repository.list({
      page,
      pageSize,
      organizationId: project.organizationId,
      projectId,
      plate: this.scope.normalizePlate(query.plate) ?? undefined,
      status: query.status,
      baseCode: this.scope.cleanText(query.base_code) ?? undefined,
      investorCode: this.scope.cleanText(query.investor_code) ?? undefined,
      description: query.description,
      search: query.search,
    });
    return {
      items: items.map((item) =>
        InventoryAccountingItemResponseDto.fromDomain(item),
      ),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getItem(
    projectId: number,
    id: number,
    actor: InventoryAccountingItemActorContext,
  ): Promise<InventoryAccountingItemResponseDto> {
    const item = await this.repository.findById(id);
    if (!item || item.projectId !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory accounting item not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, item.organizationId);
    return InventoryAccountingItemResponseDto.fromDomain(item);
  }

  async updateItem(
    projectId: number,
    id: number,
    dto: UpdateInventoryAccountingItemDto,
    actor: InventoryAccountingItemActorContext,
  ): Promise<InventoryAccountingItemResponseDto> {
    const item = await this.repository.findById(id);
    if (!item || item.projectId !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory accounting item not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, item.organizationId);
    await this.getAuthorizedProject(projectId, actor, true);

    const changes = item.updateFields({
      plate: this.scope.normalizePlate(dto.plate),
      description: this.scope.cleanText(dto.description),
      accountingAccountDescription: this.scope.cleanText(
        dto.accounting_account_description,
      ),
      location: this.scope.cleanText(dto.location),
      acquisitionDate: this.scope.parseDate(dto.acquisition_date),
      acquisitionValue: this.scope.normalizeMoney(dto.acquisition_value),
      baseCode: this.scope.cleanText(dto.base_code),
      status: dto.status,
      investorCode: this.scope.cleanText(dto.investor_code),
      note1: this.scope.cleanText(dto.note_1),
      note2: this.scope.cleanText(dto.note_2),
      newInventoryPlate: this.scope.normalizePlate(dto.new_inventory_plate),
      inventoryDescription: this.scope.cleanText(dto.inventory_description),
      inventoryLocation: this.scope.cleanText(dto.inventory_location),
      metadata: dto.metadata,
    });
    if (Object.keys(changes).length === 0) {
      return InventoryAccountingItemResponseDto.fromDomain(item);
    }
    const saved = await this.repository.saveWithAudit(item, {
      inventoryAccountingItemId: item.id,
      organizationId: item.organizationId,
      projectId: item.projectId,
      operation: InventoryAccountingItemAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });
    return InventoryAccountingItemResponseDto.fromDomain(saved);
  }

  async changeStatus(
    projectId: number,
    id: number,
    action: 'deactivate' | 'reactivate',
    actor: InventoryAccountingItemActorContext,
  ): Promise<InventoryAccountingItemResponseDto> {
    const item = await this.repository.findById(id);
    if (!item || item.projectId !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory accounting item not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, item.organizationId);
    await this.getAuthorizedProject(projectId, actor, true);
    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes =
        action === 'deactivate'
          ? item.deactivate(new Date())
          : item.reactivate();
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Status blocks this operation',
      });
    }
    const saved = await this.repository.saveWithAudit(item, {
      inventoryAccountingItemId: item.id,
      organizationId: item.organizationId,
      projectId: item.projectId,
      operation:
        action === 'deactivate'
          ? InventoryAccountingItemAuditOperation.DEACTIVATE
          : InventoryAccountingItemAuditOperation.REACTIVATE,
      performedBy: actor.id,
      changes,
    });
    return InventoryAccountingItemResponseDto.fromDomain(saved);
  }

  async listBatches(
    projectId: number,
    query: ListAccountingImportBatchesQueryDto,
    actor: InventoryAccountingItemActorContext,
  ): Promise<AccountingImportBatchListResponseDto> {
    const project = await this.getAuthorizedProject(projectId, actor, false);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repository.listBatches({
      page,
      pageSize,
      organizationId: project.organizationId,
      projectId,
    });
    return {
      items: items.map((batch) =>
        AccountingImportBatchResponseDto.fromDomain(batch),
      ),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getBatch(
    projectId: number,
    batchId: number,
    actor: InventoryAccountingItemActorContext,
  ): Promise<AccountingImportBatchResponseDto> {
    const batch = await this.repository.findBatchById(batchId);
    if (!batch || batch.projectId !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Accounting import batch not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, batch.organizationId);
    return AccountingImportBatchResponseDto.fromDomain(batch);
  }

  async getBatchErrors(
    projectId: number,
    batchId: number,
    actor: InventoryAccountingItemActorContext,
  ): Promise<{ items: ImportErrorRecord[] }> {
    await this.getBatch(projectId, batchId, actor);
    return { items: await this.repository.getBatchErrors(batchId) };
  }

  private async getAuthorizedProject(
    projectId: number,
    actor: InventoryAccountingItemActorContext,
    mutation: boolean,
  ) {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    if (mutation) {
      this.scope.assertProjectAllowsMutation(project);
    }
    return project;
  }

  private newItem(
    organizationId: number,
    projectId: number,
    actorId: number,
    batchId: number,
  ): InventoryAccountingItem {
    const now = new Date();
    return new InventoryAccountingItem({
      id: 0,
      organizationId,
      projectId,
      plate: null,
      description: null,
      accountingAccountDescription: null,
      location: null,
      acquisitionDate: null,
      acquisitionValue: null,
      baseCode: null,
      status: InventoryAccountingItemStatus.PENDING,
      investorCode: null,
      note1: null,
      note2: null,
      newInventoryPlate: null,
      inventoryDescription: null,
      inventoryLocation: null,
      metadata: null,
      importedById: actorId,
      importBatchId: batchId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }
}
