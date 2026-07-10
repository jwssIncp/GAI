import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountingImportBatch } from '../../domain/entities/accounting-import-batch';
import {
  InventoryAccountingItem,
  JsonRecord,
} from '../../domain/entities/inventory-accounting-item';
import { AccountingImportBatchStatus } from '../../domain/enums/accounting-import-batch-status.enum';
import { InventoryAccountingItemStatus } from '../../domain/enums/inventory-accounting-item-status.enum';

export class InventoryAccountingItemResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;
  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;
  @ApiProperty({ type: 'integer', format: 'int64' })
  project_id!: number;
  @ApiPropertyOptional({ nullable: true })
  plate!: string | null;
  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
  @ApiPropertyOptional({ nullable: true })
  accounting_account_description!: string | null;
  @ApiPropertyOptional({ nullable: true })
  location!: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  acquisition_date!: string | null;
  @ApiPropertyOptional({ nullable: true })
  acquisition_value!: string | null;
  @ApiPropertyOptional({ nullable: true })
  base_code!: string | null;
  @ApiProperty({ enum: InventoryAccountingItemStatus })
  status!: InventoryAccountingItemStatus;
  @ApiPropertyOptional({ nullable: true })
  investor_code!: string | null;
  @ApiPropertyOptional({ nullable: true })
  note_1!: string | null;
  @ApiPropertyOptional({ nullable: true })
  note_2!: string | null;
  @ApiPropertyOptional({ nullable: true })
  new_inventory_plate!: string | null;
  @ApiPropertyOptional({ nullable: true })
  inventory_description!: string | null;
  @ApiPropertyOptional({ nullable: true })
  inventory_location!: string | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: JsonRecord | null;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  imported_by_id!: number | null;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  import_batch_id!: number | null;
  @ApiProperty({ format: 'date-time' })
  created_at!: string;
  @ApiProperty({ format: 'date-time' })
  updated_at!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromDomain(
    item: InventoryAccountingItem,
  ): InventoryAccountingItemResponseDto {
    const props = item.toProps();
    return {
      id: props.id,
      organization_id: props.organizationId,
      project_id: props.projectId,
      plate: props.plate,
      description: props.description,
      accounting_account_description: props.accountingAccountDescription,
      location: props.location,
      acquisition_date:
        props.acquisitionDate?.toISOString().slice(0, 10) ?? null,
      acquisition_value: props.acquisitionValue,
      base_code: props.baseCode,
      status: props.status,
      investor_code: props.investorCode,
      note_1: props.note1,
      note_2: props.note2,
      new_inventory_plate: props.newInventoryPlate,
      inventory_description: props.inventoryDescription,
      inventory_location: props.inventoryLocation,
      metadata: props.metadata,
      imported_by_id: props.importedById,
      import_batch_id: props.importBatchId,
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
      deleted_at: props.deletedAt?.toISOString() ?? null,
    };
  }
}

export class InventoryAccountingItemListResponseDto {
  @ApiProperty({ type: [InventoryAccountingItemResponseDto] })
  items!: InventoryAccountingItemResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() page_size!: number;
  @ApiProperty() total_items!: number;
  @ApiProperty() total_pages!: number;
}

export class AccountingImportBatchResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;
  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;
  @ApiProperty({ type: 'integer', format: 'int64' })
  project_id!: number;
  @ApiProperty()
  original_file_name!: string;
  @ApiProperty({ enum: AccountingImportBatchStatus })
  status!: AccountingImportBatchStatus;
  @ApiProperty() total_rows!: number;
  @ApiProperty() processed_rows!: number;
  @ApiProperty() success_rows!: number;
  @ApiProperty() failed_rows!: number;
  @ApiPropertyOptional({ nullable: true })
  error_report_path!: string | null;
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  imported_by_id!: number | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  started_at!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  finished_at!: string | null;
  @ApiProperty({ format: 'date-time' })
  created_at!: string;
  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  static fromDomain(
    batch: AccountingImportBatch,
  ): AccountingImportBatchResponseDto {
    const props = batch.toProps();
    return {
      id: props.id,
      organization_id: props.organizationId,
      project_id: props.projectId,
      original_file_name: props.originalFileName,
      status: props.status,
      total_rows: props.totalRows,
      processed_rows: props.processedRows,
      success_rows: props.successRows,
      failed_rows: props.failedRows,
      error_report_path: props.errorReportPath,
      imported_by_id: props.importedById,
      started_at: props.startedAt?.toISOString() ?? null,
      finished_at: props.finishedAt?.toISOString() ?? null,
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
    };
  }
}

export class AccountingImportBatchListResponseDto {
  @ApiProperty({ type: [AccountingImportBatchResponseDto] })
  items!: AccountingImportBatchResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() page_size!: number;
  @ApiProperty() total_items!: number;
  @ApiProperty() total_pages!: number;
}
