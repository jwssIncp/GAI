import {
  AccountingImportBatch,
  ImportErrorRecord,
} from '../entities/accounting-import-batch';
import { InventoryAccountingItem } from '../entities/inventory-accounting-item';
import { InventoryAccountingItemAuditOperation } from '../enums/inventory-accounting-item-audit-operation.enum';
import { AccountingImportBatchStatus } from '../enums/accounting-import-batch-status.enum';
import { InventoryAccountingItemStatus } from '../enums/inventory-accounting-item-status.enum';

export interface ListInventoryAccountingItemsParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  projectId?: number;
  plate?: string;
  status?: InventoryAccountingItemStatus;
  baseCode?: string;
  investorCode?: string;
  description?: string;
  search?: string;
}

export interface ListAccountingImportBatchesParams {
  page: number;
  pageSize: number;
  organizationId: number;
  projectId: number;
  status?: AccountingImportBatchStatus;
}

export interface InventoryAccountingItemAuditEntry {
  inventoryAccountingItemId: number;
  organizationId: number;
  projectId: number;
  operation: InventoryAccountingItemAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const INVENTORY_ACCOUNTING_ITEM_REPOSITORY = Symbol(
  'INVENTORY_ACCOUNTING_ITEM_REPOSITORY',
);

export interface InventoryAccountingItemRepository {
  findById(id: number): Promise<InventoryAccountingItem | null>;
  findByNaturalKey(params: {
    organizationId: number;
    projectId: number;
    plate: string | null;
    baseCode: string | null;
    investorCode: string | null;
  }): Promise<InventoryAccountingItem | null>;
  list(
    params: ListInventoryAccountingItemsParams,
  ): Promise<{ items: InventoryAccountingItem[]; total: number }>;
  saveWithAudit(
    item: InventoryAccountingItem,
    audit: InventoryAccountingItemAuditEntry,
  ): Promise<InventoryAccountingItem>;
  saveImportBatch(batch: AccountingImportBatch): Promise<AccountingImportBatch>;
  findBatchById(id: number): Promise<AccountingImportBatch | null>;
  listBatches(
    params: ListAccountingImportBatchesParams,
  ): Promise<{ items: AccountingImportBatch[]; total: number }>;
  getBatchErrors(batchId: number): Promise<ImportErrorRecord[]>;
}
