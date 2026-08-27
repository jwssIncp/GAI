import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ConsolidationDecision,
  InventoryObservationResult,
  InventoryRoundKind,
  InventoryRoundStatus,
} from '../domain/inventory-operation.enums';
import {
  ConfirmInventoryItemImageUploadDto,
  CreateInventoryItemImageUploadDto,
} from '../../inventory-item-images/application/dto/inventory-item-image-inputs';

export class CreateInventorySessionDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) name!: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RequestReinventoryDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  @IsInt()
  @Min(1)
  inventory_item_id!: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) reason!: string;
}

export class CancelInventorySessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class CreateObservationEvidenceUploadDto extends CreateInventoryItemImageUploadDto {}

export class ConfirmObservationEvidenceUploadDto extends ConfirmInventoryItemImageUploadDto {}

export class CreateInventoryObservationDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  @IsInt()
  @Min(1)
  inventory_item_id!: number;
  @ApiProperty({ type: 'integer', format: 'int64' })
  @IsInt()
  @Min(1)
  field_agent_id!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 100)
  idempotency_key?: string;
  @ApiProperty({ enum: InventoryObservationResult })
  @IsEnum(InventoryObservationResult)
  result!: InventoryObservationResult;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  observed_plate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  observed_serial_number?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  unit_text?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sector_text?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  location_text?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  captured_at?: string;
}

export class ConsolidateReconciliationDto {
  @ApiProperty({ enum: ConsolidationDecision })
  @IsEnum(ConsolidationDecision)
  decision!: ConsolidationDecision;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class CreateAssetValuationDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) source!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/)
  new_value?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/)
  used_value?: string | null;
  @ApiProperty({ format: 'date' }) @IsDateString() valuation_date!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class InventoryOperationResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' }) id!: number;
}

export class InventoryOperationListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    name: 'page_size',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size = 20;
}

export class InventorySessionListQueryDto extends InventoryOperationListQueryDto {
  @ApiPropertyOptional({ enum: ['draft', 'active', 'finished', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class InventoryObservationListQueryDto extends InventoryOperationListQueryDto {
  @ApiPropertyOptional({ type: 'integer', format: 'int64' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  round_id?: number;

  @ApiPropertyOptional({ type: 'integer', format: 'int64' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inventory_item_id?: number;

  @ApiPropertyOptional({ type: 'integer', format: 'int64' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  field_agent_id?: number;
}

export class InventoryRoundListQueryDto extends InventoryOperationListQueryDto {
  @ApiPropertyOptional({ enum: InventoryRoundStatus })
  @IsOptional()
  @IsEnum(InventoryRoundStatus)
  status?: InventoryRoundStatus;

  @ApiPropertyOptional({ name: 'type', enum: InventoryRoundKind })
  @IsOptional()
  @IsEnum(InventoryRoundKind)
  type?: InventoryRoundKind;
}

export class ReconciliationListQueryDto extends InventoryOperationListQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  run_number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
