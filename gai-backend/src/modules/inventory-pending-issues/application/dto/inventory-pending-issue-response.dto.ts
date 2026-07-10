import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryPendingIssue,
  JsonRecord,
} from '../../domain/entities/inventory-pending-issue';
import { InventoryPendingIssueSeverity } from '../../domain/enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../../domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../../domain/enums/inventory-pending-issue-type.enum';

export class InventoryPendingIssueResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;
  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;
  @ApiProperty({ type: 'integer', format: 'int64' })
  project_id!: number;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  inventory_item_id!: number | null;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  accounting_item_id!: number | null;
  @ApiProperty({ enum: InventoryPendingIssueType })
  type!: InventoryPendingIssueType;
  @ApiProperty({ enum: InventoryPendingIssueStatus })
  status!: InventoryPendingIssueStatus;
  @ApiProperty({ enum: InventoryPendingIssueSeverity })
  severity!: InventoryPendingIssueSeverity;
  @ApiProperty()
  title!: string;
  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  old_value!: JsonRecord | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  new_value!: JsonRecord | null;
  @ApiPropertyOptional({ nullable: true })
  resolution_notes!: string | null;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  resolved_by_id!: number | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  resolved_at!: string | null;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  ignored_by_id!: number | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  ignored_at!: string | null;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  created_by_id!: number | null;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  updated_by_id!: number | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: JsonRecord | null;
  @ApiProperty({ format: 'date-time' })
  created_at!: string;
  @ApiProperty({ format: 'date-time' })
  updated_at!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromDomain(
    issue: InventoryPendingIssue,
  ): InventoryPendingIssueResponseDto {
    const props = issue.toProps();
    return {
      id: props.id,
      organization_id: props.organizationId,
      project_id: props.projectId,
      inventory_item_id: props.inventoryItemId,
      accounting_item_id: props.accountingItemId,
      type: props.type,
      status: props.status,
      severity: props.severity,
      title: props.title,
      description: props.description,
      old_value: props.oldValue,
      new_value: props.newValue,
      resolution_notes: props.resolutionNotes,
      resolved_by_id: props.resolvedById,
      resolved_at: props.resolvedAt?.toISOString() ?? null,
      ignored_by_id: props.ignoredById,
      ignored_at: props.ignoredAt?.toISOString() ?? null,
      created_by_id: props.createdById,
      updated_by_id: props.updatedById,
      metadata: props.metadata,
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
      deleted_at: props.deletedAt?.toISOString() ?? null,
    };
  }
}

export class InventoryPendingIssueListResponseDto {
  @ApiProperty({ type: [InventoryPendingIssueResponseDto] })
  items!: InventoryPendingIssueResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() page_size!: number;
  @ApiProperty() total_items!: number;
  @ApiProperty() total_pages!: number;
}

export class GenerateInventoryPendingIssuesResponseDto {
  @ApiProperty() created!: number;
  @ApiProperty() skipped!: number;
}
