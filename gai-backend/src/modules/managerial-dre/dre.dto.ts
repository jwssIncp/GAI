import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
export const DRE_GROUPS = [
  'revenue',
  'deductions',
  'direct_cost',
  'operating_expense',
  'financial_income',
  'financial_expense',
  'income_tax',
] as const;
export type DreGroup = (typeof DRE_GROUPS)[number];
export class DreScopeDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page_size = 20;
}
export class DreReportDto extends DreScopeDto {
  @Matches(/^\d{4}-\d{2}$/) start_month!: string;
  @Matches(/^\d{4}-\d{2}$/) end_month!: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) compare_start_month?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) compare_end_month?: string;
}
export class DreCommandDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/)
  command_key!: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
export class DreAccountDto extends DreCommandDto {
  @IsString() @Matches(/^[0-9A-Za-z][0-9A-Za-z.-]{0,39}$/) code!: string;
  @IsString() @MinLength(3) @MaxLength(150) name!: string;
  @IsIn(DRE_GROUPS) group!: DreGroup;
  @IsOptional() @IsInt() @Min(1) parent_id?: number;
  @IsBoolean() posting!: boolean;
}
export class DreAccountEditDto extends DreCommandDto {
  @IsInt() @Min(1) revision!: number;
  @IsString() @MinLength(3) @MaxLength(150) name!: string;
  @IsBoolean() active!: boolean;
}
export class DreAllocationDto {
  @Matches(/^\d{4}-\d{2}$/) month!: string;
  @IsOptional() @IsInt() @Min(1) account_id?: number | null;
  @Matches(/^\d{1,13}(\.\d{1,2})?$/) amount!: string;
}
export class DreEntryDto extends DreCommandDto {
  @IsIn(['manual', 'receivable', 'expense', 'payment']) source_kind!: string;
  @IsOptional() @IsInt() @Min(1) source_id?: number;
  @IsOptional() @IsInt() @Min(1) project_id?: number | null;
  @IsString() @MinLength(3) @MaxLength(180) economic_key!: string;
  @IsString() @MinLength(5) @MaxLength(500) event_document!: string;
  @IsString() @MinLength(3) @MaxLength(1000) description!: string;
  @IsIn(['BRL', 'USD', 'EUR']) currency!: string;
  @IsOptional() @IsString() @MaxLength(1000) currency_reason?: string;
  @IsIn(['draft', 'recognized', 'excluded', 'void']) status!: string;
  @IsDefined()
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => DreAllocationDto)
  allocations!: DreAllocationDto[];
}
export class DreEntryEditDto extends DreEntryDto {
  @IsInt() @Min(1) revision!: number;
}
export class DreCloseDto extends DreCommandDto {
  @IsIn(['BRL', 'USD', 'EUR']) currency!: string;
  @IsInt() @Min(0) revision!: number;
  @IsString() @MinLength(10) @MaxLength(2000) policy_reference!: string;
  @IsBoolean() sources_reviewed!: boolean;
  @IsBoolean() allow_incomplete!: boolean;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsIn(DRE_GROUPS, { each: true })
  reviewed_groups!: DreGroup[];
}
export class DreReopenDto extends DreCommandDto {
  @IsInt() @Min(1) revision!: number;
}
export class DreExportDto extends DreReportDto {
  @IsIn([
    'statement',
    'projects',
    'monthly',
    'revenue',
    'costs',
    'expenses',
    'unclassified',
  ])
  kind!: string;
}
