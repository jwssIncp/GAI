import { InventoryItemImageStatus } from '../enums/inventory-item-image-status.enum';

export interface InventoryItemImageProps {
  id: number;
  organizationId: number;
  inventoryItemId: number;
  storageProvider: string;
  bucket: string;
  path: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  status: InventoryItemImageStatus;
  uploadedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class InventoryItemImage {
  constructor(private readonly props: InventoryItemImageProps) {
    this.assertRequired(props.originalName, 'original_name');
    this.assertRequired(props.mimeType, 'mime_type');
    this.assertRequired(props.bucket, 'bucket');
    this.assertRequired(props.path, 'path');
    this.assertPositiveInteger(props.sizeBytes, 'size_bytes');
  }

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get inventoryItemId(): number {
    return this.props.inventoryItemId;
  }

  get bucket(): string {
    return this.props.bucket;
  }

  get path(): string {
    return this.props.path;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get status(): InventoryItemImageStatus {
    return this.props.status;
  }

  confirmUpload(
    actorId: number | null,
    fields: { checksum?: string | null; sizeBytes?: number | null },
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== InventoryItemImageStatus.PENDING_UPLOAD) {
      throw new Error('Only pending upload images can be confirmed');
    }
    const changes: Record<string, { before: unknown; after: unknown }> = {
      status: {
        before: this.props.status,
        after: InventoryItemImageStatus.UPLOADED,
      },
    };
    this.props.status = InventoryItemImageStatus.UPLOADED;
    this.props.uploadedById = actorId;

    if (fields.checksum !== undefined && fields.checksum !== null) {
      changes.checksum = {
        before: this.props.checksum,
        after: fields.checksum,
      };
      this.props.checksum = fields.checksum;
    }
    if (fields.sizeBytes !== undefined && fields.sizeBytes !== null) {
      this.assertPositiveInteger(fields.sizeBytes, 'size_bytes');
      changes.size_bytes = {
        before: this.props.sizeBytes,
        after: fields.sizeBytes,
      };
      this.props.sizeBytes = fields.sizeBytes;
    }
    return changes;
  }

  remove(
    actorId: number | null,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === InventoryItemImageStatus.REMOVED) {
      throw new Error('Inventory item image is already removed');
    }
    const beforeStatus = this.props.status;
    const beforeDeletedAt = this.props.deletedAt;
    this.props.status = InventoryItemImageStatus.REMOVED;
    this.props.uploadedById = actorId;
    this.props.deletedAt = now;
    return {
      status: { before: beforeStatus, after: this.props.status },
      deleted_at: { before: beforeDeletedAt, after: now },
    };
  }

  toProps(): InventoryItemImageProps {
    return { ...this.props };
  }

  private assertRequired(value: string, field: string): void {
    if (value.trim().length === 0) {
      throw new Error(`${field} is required`);
    }
  }

  private assertPositiveInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${field} must be a positive integer`);
    }
  }
}
