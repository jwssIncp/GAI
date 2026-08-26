import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectSummaryProjectDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  start_date!: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  end_date!: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;
}

export class ProjectInventorySummaryDto {
  @ApiProperty()
  total_items!: number;
  @ApiProperty()
  evaluated_items!: number;
  @ApiProperty()
  pending_items!: number;
  @ApiProperty()
  divergent_items!: number;
  @ApiProperty()
  not_found_items!: number;
  @ApiProperty()
  duplicated_items!: number;
  @ApiProperty()
  removed_items!: number;
  @ApiProperty()
  inactive_items!: number;
  @ApiProperty()
  progress_percentage!: number;
  @ApiProperty() inventoried_items!: number;
  @ApiProperty() observation_progress_percentage!: number;
  @ApiProperty() inventory_sessions!: number;
  @ApiProperty() inventory_rounds!: number;
  @ApiProperty() reinventory_rounds!: number;
  @ApiProperty() observations!: number;
}

export class ProjectImagesSummaryDto {
  @ApiProperty()
  total_images!: number;
  @ApiProperty()
  uploaded_images!: number;
  @ApiProperty()
  pending_upload_images!: number;
  @ApiProperty()
  removed_images!: number;
}

export class ProjectAccountingSummaryDto {
  @ApiProperty()
  total_accounting_items!: number;
  @ApiProperty()
  matched_accounting_items!: number;
  @ApiProperty()
  divergent_accounting_items!: number;
  @ApiProperty()
  not_found_accounting_items!: number;
  @ApiProperty()
  ignored_accounting_items!: number;
  @ApiProperty() latest_reconciliation_run!: number | null;
  @ApiProperty() reconciled_items!: number;
  @ApiProperty() physical_surplus_items!: number;
  @ApiProperty() accounting_surplus_items!: number;
  @ApiProperty() duplicate_items!: number;
  @ApiProperty() consolidated_items!: number;
}

export class ProjectPendingIssuesSummaryDto {
  @ApiProperty()
  total_pending_issues!: number;
  @ApiProperty()
  open_pending_issues!: number;
  @ApiProperty()
  in_review_pending_issues!: number;
  @ApiProperty()
  resolved_pending_issues!: number;
  @ApiProperty()
  ignored_pending_issues!: number;
  @ApiProperty()
  cancelled_pending_issues!: number;
  @ApiProperty()
  critical_pending_issues!: number;
  @ApiProperty()
  high_pending_issues!: number;
  @ApiProperty()
  medium_pending_issues!: number;
  @ApiProperty()
  low_pending_issues!: number;
}

export class ProjectFieldAgentsSummaryDto {
  @ApiProperty()
  total_field_agents!: number;
  @ApiProperty()
  active_field_agents!: number;
  @ApiProperty()
  inactive_field_agents!: number;
  @ApiProperty()
  finished_field_agents!: number;
}

export class ProjectFinancialSummaryDto {
  @ApiProperty()
  total_payments!: number;
  @ApiProperty()
  pending_payments!: number;
  @ApiProperty()
  approved_payments!: number;
  @ApiProperty()
  paid_payments!: number;
  @ApiProperty()
  cancelled_payments!: number;
  @ApiProperty({ example: '5000.00' })
  total_payment_amount!: string;
  @ApiProperty()
  total_expenses!: number;
  @ApiProperty()
  pending_expenses!: number;
  @ApiProperty()
  approved_expenses!: number;
  @ApiProperty()
  paid_expenses!: number;
  @ApiProperty()
  rejected_expenses!: number;
  @ApiProperty()
  cancelled_expenses!: number;
  @ApiProperty({ example: '1200.00' })
  total_expense_amount!: string;
  @ApiProperty({ example: '6200.00' })
  financial_total_amount!: string;
  @ApiProperty() open_accountabilities!: number;
  @ApiProperty() closed_accountabilities!: number;
  @ApiProperty({ example: '1200.00' }) closed_accountabilities_amount!: string;
}

export class ProjectImportsSummaryDto {
  @ApiProperty()
  total_import_sessions!: number;
  @ApiProperty()
  open_import_sessions!: number;
  @ApiProperty()
  processing_import_sessions!: number;
  @ApiProperty()
  finished_import_sessions!: number;
  @ApiProperty()
  failed_import_sessions!: number;
  @ApiProperty()
  cancelled_import_sessions!: number;
  @ApiProperty()
  expired_import_sessions!: number;
}

export class ProjectExportsSummaryDto {
  @ApiProperty()
  total_export_jobs!: number;
  @ApiProperty()
  pending_export_jobs!: number;
  @ApiProperty()
  processing_export_jobs!: number;
  @ApiProperty()
  finished_export_jobs!: number;
  @ApiProperty()
  failed_export_jobs!: number;
  @ApiProperty()
  cancelled_export_jobs!: number;
  @ApiProperty()
  expired_export_jobs!: number;
}

export class ProjectRecentActivitySummaryDto {
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  last_inventory_item_created_at!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  last_inventory_item_updated_at!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  last_import_finished_at!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  last_export_finished_at!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  last_pending_issue_created_at!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  last_payment_updated_at!: string | null;
}

export class ProjectSummaryResponseDto {
  @ApiProperty({ type: ProjectSummaryProjectDto })
  project!: ProjectSummaryProjectDto;

  @ApiProperty({ type: ProjectInventorySummaryDto })
  inventory!: ProjectInventorySummaryDto;

  @ApiProperty({ type: ProjectImagesSummaryDto })
  images!: ProjectImagesSummaryDto;

  @ApiProperty({ type: ProjectAccountingSummaryDto })
  accounting!: ProjectAccountingSummaryDto;

  @ApiProperty({ type: ProjectPendingIssuesSummaryDto })
  pending_issues!: ProjectPendingIssuesSummaryDto;

  @ApiProperty({ type: ProjectFieldAgentsSummaryDto })
  field_agents!: ProjectFieldAgentsSummaryDto;

  @ApiPropertyOptional({ type: ProjectFinancialSummaryDto, nullable: true })
  financial?: ProjectFinancialSummaryDto;

  @ApiPropertyOptional({ type: ProjectImportsSummaryDto, nullable: true })
  imports?: ProjectImportsSummaryDto;

  @ApiPropertyOptional({ type: ProjectExportsSummaryDto, nullable: true })
  exports?: ProjectExportsSummaryDto;

  @ApiPropertyOptional({
    type: ProjectRecentActivitySummaryDto,
    nullable: true,
  })
  recent_activity?: ProjectRecentActivitySummaryDto;
}
