import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JsonRecord } from '../../domain/entities/inventory-pending-issue';
import { InventoryPendingIssueSeverity } from '../../domain/enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../../domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../../domain/enums/inventory-pending-issue-type.enum';

export class CreateInventoryPendingIssueDto {
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inventory_item_id?: number | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accounting_item_id?: number | null;

  @ApiProperty({ enum: InventoryPendingIssueType })
  @IsEnum(InventoryPendingIssueType)
  type!: InventoryPendingIssueType;

  @ApiPropertyOptional({ enum: InventoryPendingIssueSeverity })
  @IsOptional()
  @IsEnum(InventoryPendingIssueSeverity)
  severity?: InventoryPendingIssueSeverity;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  old_value?: JsonRecord | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  new_value?: JsonRecord | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;
}

export class UpdateInventoryPendingIssueDto {
  @ApiPropertyOptional({ enum: InventoryPendingIssueType })
  @IsOptional()
  @IsEnum(InventoryPendingIssueType)
  type?: InventoryPendingIssueType;

  @ApiPropertyOptional({ enum: InventoryPendingIssueStatus })
  @IsOptional()
  @IsEnum(InventoryPendingIssueStatus)
  status?: InventoryPendingIssueStatus;

  @ApiPropertyOptional({ enum: InventoryPendingIssueSeverity })
  @IsOptional()
  @IsEnum(InventoryPendingIssueSeverity)
  severity?: InventoryPendingIssueSeverity;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  old_value?: JsonRecord | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  new_value?: JsonRecord | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;
}

export class ResolveInventoryPendingIssueDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  resolution_notes?: string | null;
}
