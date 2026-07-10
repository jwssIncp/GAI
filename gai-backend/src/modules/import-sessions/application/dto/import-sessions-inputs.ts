import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { JsonRecord } from '../../../projects/domain/entities/project';
import { InventoryItemStatus } from '../../../inventory-items/domain/enums/inventory-item-status.enum';
import { ImportFileType } from '../../domain/enums/import-file-type.enum';
import { ImportSessionSource } from '../../domain/enums/import-session-source.enum';
import { ImportSessionType } from '../../domain/enums/import-session-type.enum';

const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

export enum ImportItemOperation {
  CREATE = 'create',
  UPDATE = 'update',
  UPSERT = 'upsert',
  DELETE = 'delete',
  REMOVE = 'remove',
}

export class CreateImportSessionDto {
  @ApiProperty({ enum: ImportSessionType })
  @IsEnum(ImportSessionType)
  type!: ImportSessionType;

  @ApiProperty({ enum: ImportSessionSource })
  @IsEnum(ImportSessionSource)
  source!: ImportSessionSource;

  @ApiPropertyOptional({ minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  expected_payloads?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord;
}

export class ImportPayloadItemImageDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord;
}

export class ImportPayloadItemDto {
  @ApiProperty({ enum: ImportItemOperation })
  @IsEnum(ImportItemOperation)
  operation!: ImportItemOperation;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_item_id?: string | null;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sequence?: string | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  old_plate?: string | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  new_plate?: string | null;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  unit_text?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address_text?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location_text?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serial_number?: string | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  capacity?: string | null;

  @ApiPropertyOptional({ minimum: 1900, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string | null;

  @ApiPropertyOptional({ pattern: MONEY_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  used_value?: string | null;

  @ApiPropertyOptional({ pattern: MONEY_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  new_value?: string | null;

  @ApiPropertyOptional({ enum: InventoryItemStatus })
  @IsOptional()
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;

  @ApiPropertyOptional({ type: [ImportPayloadItemImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ImportPayloadItemImageDto)
  images?: ImportPayloadItemImageDto[];
}

export class CreateImportPayloadDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  payload_number!: number;

  @ApiProperty({ maxLength: 128 })
  @IsString()
  @MaxLength(128)
  idempotency_key!: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string | null;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  raw_payload_path?: string | null;

  @ApiProperty({ type: [ImportPayloadItemDto] })
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => ImportPayloadItemDto)
  items!: ImportPayloadItemDto[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord;
}

export class CreateImportFileUploadDto {
  @ApiProperty({ enum: ImportFileType })
  @IsEnum(ImportFileType)
  type!: ImportFileType;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  original_name!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  mime_type!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes!: number;
}

export class ConfirmImportFileUploadDto {
  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string | null;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes?: number;
}
