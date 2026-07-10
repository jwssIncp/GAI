import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { JsonRecord } from '../../domain/entities/inventory-accounting-item';
import { InventoryAccountingItemStatus } from '../../domain/enums/inventory-accounting-item-status.enum';

const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

export class UpdateInventoryAccountingItemDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  plate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  accounting_account_description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  location?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  acquisition_date?: string | null;

  @ApiPropertyOptional({ pattern: MONEY_PATTERN.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  acquisition_value?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  base_code?: string | null;

  @ApiPropertyOptional({ enum: InventoryAccountingItemStatus })
  @IsOptional()
  @IsEnum(InventoryAccountingItemStatus)
  status?: InventoryAccountingItemStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  investor_code?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  note_1?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  note_2?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  new_inventory_plate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  inventory_description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  inventory_location?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;
}
