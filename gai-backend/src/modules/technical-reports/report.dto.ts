import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
export const REPORT_PERMISSIONS = [
  'technical-reports:read',
  'technical-reports:edit',
  'technical-reports:templates',
  'technical-reports:approve',
  'technical-reports:export',
];
export const FAMILIES = [
  'identity',
  'units',
  'inventory',
  'accounting',
  'observations',
  'reconciliation',
  'valuation',
  'issues',
] as const;
export type Family = (typeof FAMILIES)[number];
export const SYSTEM_KEYS = [
  'project.name',
  'project.id',
  'project.status',
  'company.name',
  'company.document',
  'inventory.count',
  'observations.count',
  'accounting.count',
  'reconciliation.count',
  'valuation.count',
  'valuation.used_total',
  'issues.open_count',
] as const;
export class ReportScopeDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
}
export class ReportCommandDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/) command_key!: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
export class ReportRevisionDto extends ReportCommandDto {
  @IsInt() @Min(1) revision!: number;
}
export class SectionDefinition {
  @Matches(/^[a-z][a-z0-9_-]{0,49}$/) key!: string;
  @IsString() @MinLength(2) @MaxLength(150) title!: string;
  @IsString() @MaxLength(20000) text!: string;
  @IsBoolean() required!: boolean;
}
export class FieldDefinition {
  @Matches(/^[a-z][a-z0-9_-]{0,49}$/) key!: string;
  @IsString() @MinLength(2) @MaxLength(150) label!: string;
  @IsBoolean() required!: boolean;
  @IsOptional() @IsIn(SYSTEM_KEYS) system_key?: string;
}
export class ReportRules {
  @IsBoolean() responsible_required!: boolean;
  @IsBoolean() professional_registration_required!: boolean;
  @IsBoolean() reconciliation_required!: boolean;
  @IsBoolean() valuation_required!: boolean;
  @IsIn(['warning', 'block']) unresolved_divergences!: 'warning' | 'block';
  @IsIn(['warning', 'block']) incomplete_indicators!: 'warning' | 'block';
  @IsIn(['warning', 'block']) stale_sources!: 'warning' | 'block';
}
export class TemplateDataDto {
  @IsString() @MinLength(3) @MaxLength(150) name!: string;
  @IsString() @MinLength(3) @MaxLength(100) report_type!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SectionDefinition)
  sections!: SectionDefinition[];
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => FieldDefinition)
  fields!: FieldDefinition[];
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(8)
  @IsIn(FAMILIES, { each: true })
  tables!: Family[];
  @IsDefined() @ValidateNested() @Type(() => ReportRules) rules!: ReportRules;
}
export class CreateTemplateDto extends ReportCommandDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => TemplateDataDto)
  data!: TemplateDataDto;
}
export class EditTemplateDto extends CreateTemplateDto {
  @IsInt() @Min(1) revision!: number;
}
export class ResponsibleDto extends ReportCommandDto {
  @IsInt() @Min(1) user_id!: number;
  @IsString() @MinLength(3) @MaxLength(150) display_name!: string;
  @IsString() @MinLength(3) @MaxLength(150) function!: string;
  @IsString() @MaxLength(150) professional_registration!: string;
  @IsString() @MaxLength(1000) registration_evidence!: string;
}
export class SourceSelectionDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(8)
  @IsIn(FAMILIES, { each: true })
  families!: Family[];
  @IsOptional() @IsInt() @Min(1) session_id?: number;
  @IsOptional() @IsInt() @Min(1) valuation_batch_id?: number;
}
export class CreateReportDto extends ReportCommandDto {
  @IsInt() @Min(1) template_version_id!: number;
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsDefined()
  @ValidateNested()
  @Type(() => SourceSelectionDto)
  selection!: SourceSelectionDto;
}
export class SectionEdit {
  @Matches(/^[a-z][a-z0-9_-]{0,49}$/) key!: string;
  @IsString() @MaxLength(20000) text!: string;
}
export class FieldEdit {
  @Matches(/^[a-z][a-z0-9_-]{0,49}$/) key!: string;
  @IsString() @MaxLength(2000) value!: string;
}
export class EditReportDto extends ReportRevisionDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SectionEdit)
  sections!: SectionEdit[];
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => FieldEdit)
  fields!: FieldEdit[];
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  responsible_ids!: number[];
  @IsString() @MaxLength(10000) technical_notes!: string;
  @IsString() @MaxLength(20000) conclusion!: string;
}
export class RefreshReportDto extends ReportRevisionDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SourceSelectionDto)
  selection!: SourceSelectionDto;
}
export class TransitionReportDto extends ReportRevisionDto {
  @IsIn(['review', 'approve', 'reopen', 'archive']) action!: string;
}
