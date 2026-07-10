import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InventoryPendingIssueSeverity } from '../../domain/enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../../domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../../domain/enums/inventory-pending-issue-type.enum';

export class ListInventoryPendingIssuesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;

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
  accounting_item_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
