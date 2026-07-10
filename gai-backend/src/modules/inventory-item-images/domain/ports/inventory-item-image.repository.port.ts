import { InventoryItemImage } from '../entities/inventory-item-image';
import { InventoryItemImageAuditOperation } from '../enums/inventory-item-image-audit-operation.enum';
import { InventoryItemImageStatus } from '../enums/inventory-item-image-status.enum';

export interface ListInventoryItemImagesParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  inventoryItemId?: number;
  status?: InventoryItemImageStatus;
}

export interface InventoryItemImageAuditEntry {
  inventoryItemImageId: number;
  organizationId: number;
  inventoryItemId: number;
  operation: InventoryItemImageAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const INVENTORY_ITEM_IMAGE_REPOSITORY = Symbol(
  'INVENTORY_ITEM_IMAGE_REPOSITORY',
);

export interface InventoryItemImageRepository {
  findById(id: number): Promise<InventoryItemImage | null>;
  countActiveByItem(inventoryItemId: number): Promise<number>;
  list(
    params: ListInventoryItemImagesParams,
  ): Promise<{ items: InventoryItemImage[]; total: number }>;
  saveWithAudit(
    image: InventoryItemImage,
    audit: InventoryItemImageAuditEntry,
  ): Promise<InventoryItemImage>;
  audit(audit: InventoryItemImageAuditEntry): Promise<void>;
}
