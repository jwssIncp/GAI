import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryItemImage } from '../../domain/entities/inventory-item-image';
import { InventoryItemImageStatus } from '../../domain/enums/inventory-item-image-status.enum';

export class InventoryItemImageResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  inventory_item_id!: number;

  @ApiProperty()
  storage_provider!: string;

  @ApiProperty()
  original_name!: string;

  @ApiProperty()
  mime_type!: string;

  @ApiProperty({ type: 'integer' })
  size_bytes!: number;

  @ApiPropertyOptional({ nullable: true })
  checksum!: string | null;

  @ApiProperty({ enum: InventoryItemImageStatus })
  status!: InventoryItemImageStatus;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  uploaded_by_id!: number | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromDomain(image: InventoryItemImage): InventoryItemImageResponseDto {
    const props = image.toProps();
    return {
      id: props.id,
      organization_id: props.organizationId,
      inventory_item_id: props.inventoryItemId,
      storage_provider: props.storageProvider,
      original_name: props.originalName,
      mime_type: props.mimeType,
      size_bytes: props.sizeBytes,
      checksum: props.checksum,
      status: props.status,
      uploaded_by_id: props.uploadedById,
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
      deleted_at: props.deletedAt?.toISOString() ?? null,
    };
  }
}

export class InventoryItemImageUploadUrlResponseDto {
  @ApiProperty({ type: InventoryItemImageResponseDto })
  image!: InventoryItemImageResponseDto;

  @ApiProperty()
  upload_url!: string;

  @ApiProperty()
  expires_in_seconds!: number;
}

export class InventoryItemImageDownloadUrlResponseDto {
  @ApiProperty({ type: InventoryItemImageResponseDto })
  image!: InventoryItemImageResponseDto;

  @ApiProperty()
  download_url!: string;

  @ApiProperty()
  expires_in_seconds!: number;
}

export class InventoryItemImageListResponseDto {
  @ApiProperty({ type: [InventoryItemImageResponseDto] })
  items!: InventoryItemImageResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  page_size!: number;

  @ApiProperty({ minimum: 0 })
  total_items!: number;

  @ApiProperty({ minimum: 0 })
  total_pages!: number;
}
