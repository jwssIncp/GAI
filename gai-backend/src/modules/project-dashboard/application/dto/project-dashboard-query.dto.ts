import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { InventoryItemStatus } from '../../../inventory-items/domain/enums/inventory-item-status.enum';

export enum ProjectDashboardPeriod {
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  CURRENT_MONTH = 'month',
  TOTAL = 'total',
  CUSTOM = 'custom',
}

export enum ProjectDashboardGrouping {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class ProjectDashboardQueryDto {
  @ApiPropertyOptional({
    enum: ProjectDashboardPeriod,
    default: ProjectDashboardPeriod.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(ProjectDashboardPeriod)
  period?: ProjectDashboardPeriod = ProjectDashboardPeriod.LAST_30_DAYS;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Obrigatório quando period=custom.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  date_from?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Obrigatório quando period=custom.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  date_to?: string;

  @ApiPropertyOptional({
    enum: ProjectDashboardGrouping,
    default: ProjectDashboardGrouping.DAY,
  })
  @IsOptional()
  @IsEnum(ProjectDashboardGrouping)
  grouping?: ProjectDashboardGrouping = ProjectDashboardGrouping.DAY;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Valor exato de inventory_items.unit_text.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  unit?: string;

  @ApiPropertyOptional({
    example: 'SP',
    description: 'Sigla oficial de Unidade Federativa.',
  })
  @IsOptional()
  @Matches(
    /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,
  )
  state?: string;

  @ApiPropertyOptional({ enum: InventoryItemStatus })
  @IsOptional()
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;
}
