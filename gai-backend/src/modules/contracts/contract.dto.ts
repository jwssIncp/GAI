import { IsCivilDate } from '../../common/validation/civil-date';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const CONTRACT_STATUSES = [
  'draft',
  'active',
  'suspended',
  'completed',
  'cancelled',
  'archived',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export class ContractDataDto {
  @IsString() @MinLength(1) @MaxLength(100) number!: string;
  @Type(() => Number) @IsInt() @Min(1) company_id!: number;
  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  contracted_on?: string | null;
  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  starts_on?: string | null;
  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ends_on?: string | null;
  @IsOptional() @IsString() @Matches(/^\d{1,13}(\.\d{1,2})?$/) original_value?:
    | string
    | null;
  @IsIn(['BRL', 'USD', 'EUR']) currency!: string;
  @IsOptional() @IsString() @MaxLength(120) contracting_type?: string | null;
  @IsOptional() @IsString() @MaxLength(120) segment?: string | null;
  @IsOptional() @IsString() @MaxLength(120) commercial_origin?: string | null;
  @IsOptional() @IsBoolean() recurring?: boolean | null;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  services!: string[];
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  estimated_assets?: number | null;
  @IsOptional() @IsString() @MaxLength(10000) scope?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) commercial_terms?: string | null;
  @IsIn(CONTRACT_STATUSES) status!: ContractStatus;
}
export class EditContractDto extends ContractDataDto {
  @IsInt() @Min(1) revision!: number;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
export class ContractCommandDto {
  @IsInt() @Min(1) revision!: number;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
export class AmendmentDto extends ContractCommandDto {
  @IsString() @MinLength(1) @MaxLength(100) identifier!: string;
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dated_on!: string;
  @IsIn(['value', 'term', 'scope', 'mixed']) type!: string;
  @IsOptional() @IsString() @Matches(/^-?\d{1,13}(\.\d{1,2})?$/) value_delta?:
    | string
    | null;
  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ends_on?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10000) scope?:
    | string
    | null;
}
