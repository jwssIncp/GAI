import { InventoryItem } from '../entities/inventory-item';
import { InventoryItemAuditOperation } from '../enums/inventory-item-audit-operation.enum';
import { InventoryItemStatus } from '../enums/inventory-item-status.enum';

export interface ListInventoryItemsParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  projectId?: number;
  status?: InventoryItemStatus;
  oldPlate?: string;
  newPlate?: string;
  description?: string;
  search?: string;
}

export interface InventoryItemAuditEntry {
  inventoryItemId: number;
  organizationId: number;
  projectId: number;
  operation: InventoryItemAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const INVENTORY_ITEM_REPOSITORY = Symbol('INVENTORY_ITEM_REPOSITORY');

export interface InventoryItemRepository {
  findById(id: number): Promise<InventoryItem | null>;
  list(
    params: ListInventoryItemsParams,
  ): Promise<{ items: InventoryItem[]; total: number }>;
  saveWithAudit(
    item: InventoryItem,
    audit: InventoryItemAuditEntry,
  ): Promise<InventoryItem>;
}
