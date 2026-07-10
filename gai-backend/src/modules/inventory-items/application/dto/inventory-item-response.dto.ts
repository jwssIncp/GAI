import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryItem,
  JsonRecord,
} from '../../domain/entities/inventory-item';
import { InventoryItemStatus } from '../../domain/enums/inventory-item-status.enum';

export class InventoryItemResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  project_id!: number;

  @ApiPropertyOptional({ nullable: true })
  external_item_id!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sequence!: string | null;

  @ApiPropertyOptional({ nullable: true })
  old_plate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  new_plate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  unit_text!: string | null;

  @ApiPropertyOptional({ nullable: true })
  address_text!: string | null;

  @ApiPropertyOptional({ nullable: true })
  location_text!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brand!: string | null;

  @ApiPropertyOptional({ nullable: true })
  model!: string | null;

  @ApiPropertyOptional({ nullable: true })
  serial_number!: string | null;

  @ApiPropertyOptional({ nullable: true })
  capacity!: string | null;

  @ApiPropertyOptional({ nullable: true })
  year!: number | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  source!: string | null;

  @ApiPropertyOptional({ nullable: true })
  used_value!: string | null;

  @ApiPropertyOptional({ nullable: true })
  new_value!: string | null;

  @ApiProperty({ enum: InventoryItemStatus })
  status!: InventoryItemStatus;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: JsonRecord | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  created_by_id!: number | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  updated_by_id!: number | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromDomain(item: InventoryItem): InventoryItemResponseDto {
    const props = item.toProps();
    return {
      id: props.id,
      organization_id: props.organizationId,
      project_id: props.projectId,
      external_item_id: props.externalItemId,
      sequence: props.sequence,
      old_plate: props.oldPlate,
      new_plate: props.newPlate,
      unit_text: props.unitText,
      address_text: props.addressText,
      location_text: props.locationText,
      description: props.description,
      brand: props.brand,
      model: props.model,
      serial_number: props.serialNumber,
      capacity: props.capacity,
      year: props.year,
      notes: props.notes,
      source: props.source,
      used_value: props.usedValue,
      new_value: props.newValue,
      status: props.status,
      metadata: props.metadata,
      created_by_id: props.createdById,
      updated_by_id: props.updatedById,
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
      deleted_at: props.deletedAt?.toISOString() ?? null,
    };
  }
}

export class InventoryItemListResponseDto {
  @ApiProperty({ type: [InventoryItemResponseDto] })
  items!: InventoryItemResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  page_size!: number;

  @ApiProperty({ minimum: 0 })
  total_items!: number;

  @ApiProperty({ minimum: 0 })
  total_pages!: number;
}
