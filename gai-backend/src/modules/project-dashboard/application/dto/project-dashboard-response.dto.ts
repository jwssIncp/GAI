import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardAvailabilityDto {
  @ApiProperty()
  available!: boolean;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;
}

export class DashboardSummaryDto {
  @ApiProperty() total_items!: number;
  @ApiProperty() inventoried_items!: number;
  @ApiProperty() not_inventoried_items!: number;
  @ApiPropertyOptional({ nullable: true }) consolidated_items!: number | null;
  @ApiPropertyOptional({ nullable: true }) pending_consolidation_items!:
    | number
    | null;
  @ApiProperty() completion_percentage!: number;
  @ApiPropertyOptional({ nullable: true }) consolidation_percentage!:
    | number
    | null;
  @ApiPropertyOptional({ nullable: true }) total_sectors!: number | null;
  @ApiProperty() total_units!: number;
  @ApiProperty() total_field_agents!: number;
  @ApiProperty() active_days!: number;
  @ApiProperty() average_items_per_active_day!: number;
  @ApiProperty() inventoried_today!: number;
  @ApiProperty() inventoried_last_7_days!: number;
  @ApiProperty() inventoried_last_30_days!: number;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  last_activity_at!: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  estimated_completion_date!: string | null;
}

export class DashboardTimelinePointDto {
  @ApiProperty({ example: '2026-07-24' }) period!: string;
  @ApiProperty() inventoried_items!: number;
  @ApiProperty() moving_average!: number;
  @ApiProperty() cumulative_inventoried_items!: number;
  @ApiPropertyOptional({ nullable: true }) cumulative_consolidated_items!:
    | number
    | null;
  @ApiProperty() total_items_reference!: number;
}

export class DashboardStatusPointDto {
  @ApiProperty() status!: string;
  @ApiProperty() total_items!: number;
  @ApiProperty() percentage!: number;
}

export class DashboardUnitPointDto {
  @ApiPropertyOptional({ nullable: true }) unit!: string | null;
  @ApiProperty() total_items!: number;
  @ApiProperty() inventoried_items!: number;
  @ApiProperty() pending_items!: number;
  @ApiPropertyOptional({ nullable: true }) consolidated_items!: number | null;
  @ApiProperty() completion_percentage!: number;
}

export class DashboardGeographyPointDto {
  @ApiProperty() state!: string;
  @ApiProperty() total_items!: number;
  @ApiProperty() inventoried_items!: number;
  @ApiProperty() pending_items!: number;
  @ApiPropertyOptional({ nullable: true }) consolidated_items!: number | null;
  @ApiProperty() total_units!: number;
  @ApiPropertyOptional({ nullable: true }) total_sectors!: number | null;
  @ApiProperty() completion_percentage!: number;
}

export class DashboardDataQualityDto {
  @ApiProperty() items_without_unit!: number;
  @ApiProperty() items_without_location!: number;
  @ApiProperty() items_without_description!: number;
  @ApiProperty() items_without_state!: number;
}

export class DashboardRecentActivityDto {
  @ApiProperty({ type: 'integer', format: 'int64' }) id!: number;
  @ApiProperty({ type: 'integer', format: 'int64' }) inventory_item_id!: number;
  @ApiProperty() operation!: string;
  @ApiPropertyOptional({ nullable: true }) resulting_status!: string | null;
  @ApiProperty({ format: 'date-time' }) occurred_at!: string;
}

export class DashboardFiltersDto {
  @ApiProperty() period!: string;
  @ApiPropertyOptional({ format: 'date', nullable: true }) date_from!:
    | string
    | null;
  @ApiPropertyOptional({ format: 'date', nullable: true }) date_to!:
    | string
    | null;
  @ApiProperty() grouping!: string;
  @ApiPropertyOptional({ nullable: true }) unit!: string | null;
  @ApiPropertyOptional({ nullable: true }) state!: string | null;
  @ApiPropertyOptional({ nullable: true }) status!: string | null;
  @ApiProperty({ type: [String] }) available_units!: string[];
  @ApiProperty({ type: [String] }) available_states!: string[];
  @ApiProperty({ type: [String] }) available_statuses!: string[];
}

export class ProjectDashboardAnalyticsResponseDto {
  @ApiProperty({
    example: {
      id: 1,
      name: 'Inventário 2026',
      status: 'active',
      organization_id: 1,
      company_id: 2,
    },
  })
  project!: {
    id: number;
    name: string;
    status: string;
    organization_id: number;
    company_id: number | null;
  };

  @ApiProperty({ type: DashboardSummaryDto }) summary!: DashboardSummaryDto;
  @ApiProperty({ type: [DashboardTimelinePointDto] })
  timeline!: DashboardTimelinePointDto[];
  @ApiProperty({ type: [DashboardStatusPointDto] })
  status_distribution!: DashboardStatusPointDto[];
  @ApiProperty({ type: [DashboardUnitPointDto] })
  units!: DashboardUnitPointDto[];
  @ApiProperty({ type: [DashboardGeographyPointDto] })
  geography!: DashboardGeographyPointDto[];
  @ApiProperty() unlocated_items!: number;
  @ApiProperty({ type: DashboardDataQualityDto })
  data_quality!: DashboardDataQualityDto;
  @ApiProperty({ type: [DashboardRecentActivityDto] })
  recent_activity!: DashboardRecentActivityDto[];
  @ApiProperty({ type: [DashboardUnitPointDto] })
  attention_units!: DashboardUnitPointDto[];
  @ApiProperty({ type: DashboardAvailabilityDto })
  sectors!: DashboardAvailabilityDto;
  @ApiProperty({ type: DashboardAvailabilityDto })
  consolidation!: DashboardAvailabilityDto;
  @ApiProperty({ type: DashboardAvailabilityDto })
  productivity!: DashboardAvailabilityDto;
  @ApiProperty({ type: DashboardFiltersDto }) filters!: DashboardFiltersDto;
  @ApiProperty({ type: [String] }) limitations!: string[];
  @ApiProperty({ example: 'America/Sao_Paulo' }) timezone!: string;
}
