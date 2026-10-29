import { IsCivilDate } from '../../common/validation/civil-date';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
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
const DECIMAL = /^\d{1,13}(\.\d{1,2})?$/;
const PERCENT = /^\d{1,2}(\.\d{1,2})?$/;
export const BUDGET_STATUSES = [
  'draft',
  'review',
  'approved',
  'rejected',
  'archived',
] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export class PricingValuesDto {
  @IsIn(['BRL', 'USD', 'EUR']) currency!: string;
  @IsInt() @Min(1) @Max(1000000) productivity!: number;
  @IsInt() @Min(1) @Max(3650) default_days!: number;
  @IsInt() @Min(1) @Max(500) default_professionals!: number;
  @IsInt() @Min(1) @Max(10000) addresses_per_person_day!: number;
  @IsString() @Matches(/^\d{1,2}(\.\d{1,4})?$/) address_factor!: string;
  @IsString() @Matches(DECIMAL) daily_rate!: string;
  @IsString() @Matches(DECIMAL) operational_fixed!: string;
  @IsString() @Matches(DECIMAL) travel_fixed!: string;
  @IsString() @Matches(DECIMAL) transport_per_day!: string;
  @IsString() @Matches(DECIMAL) lodging_per_room_day!: string;
  @IsString() @Matches(DECIMAL) food_per_person_day!: string;
  @IsString() @Matches(DECIMAL) materials_fixed!: string;
  @IsString() @Matches(DECIMAL) tags_per_asset!: string;
  @IsString() @Matches(DECIMAL) administration_fixed!: string;
  @IsString() @Matches(DECIMAL) minimum_price!: string;
  @IsInt() @Min(1) @Max(10) room_capacity!: number;
  @IsInt() @Min(1) @Max(3650) extra_every_days!: number;
  @IsInt() @Min(0) @Max(31) extra_days!: number;
  @IsString() @Matches(PERCENT) tax_pct!: string;
  @IsString() @Matches(PERCENT) commission_pct!: string;
  @IsString() @Matches(PERCENT) margin_pct!: string;
}
export class PublishPricingDto extends PricingValuesDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  valid_from!: string;
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  valid_to!: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
export class SizingDto {
  @IsOptional() @IsInt() @Min(1) @Max(3650) available_days?: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) team?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000000) productivity?: number;
  @IsOptional() @IsString() @Matches(PERCENT) margin_pct?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) operational_extra?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) final_price?: string;
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  adjustment_reason?: string;
}
export class BudgetPaymentDto {
  @IsIn(['equal', 'percentages', 'amounts']) mode!: string;
  @IsInt() @Min(0) @Max(60) count!: number;
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  first_due_on!: string;
  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  entry_due_on?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}(\.\d{1,2})?$/)
  entry_percent?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) entry_amount?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @Matches(/^\d{1,3}(\.\d{1,2})?$/, { each: true })
  percentages?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @Matches(DECIMAL, { each: true })
  amounts?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsCivilDate({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  dates?: string[];
}
export class BudgetDataDto {
  @IsOptional() @IsInt() @Min(1) organization_id?: number;
  @IsInt() @Min(1) company_id!: number;
  @IsOptional() @IsInt() @Min(1) project_id?: number | null;
  @IsString() @MinLength(1) @MaxLength(100) number!: string;
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  prepared_on!: string;
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  valid_until!: string;
  @IsOptional() @IsString() @MaxLength(120) segment?: string | null;
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  services!: string[];
  @IsInt() @Min(0) @Max(1000000000) estimated_assets!: number;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  unit_ids!: number[];
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(3, { each: true })
  @MaxLength(500, { each: true })
  addresses!: string[];
  @IsString() @MinLength(3) @MaxLength(10000) scope!: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) operational_constraints?:
    | string
    | null;
  @IsInt() @Min(1) responsible_id!: number;
  @IsInt() @Min(1) pricing_id!: number;
  @IsDefined() @ValidateNested() @Type(() => SizingDto) sizing!: SizingDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => BudgetPaymentDto)
  payment!: BudgetPaymentDto;
}
export class BudgetVersionDto extends BudgetDataDto {
  @IsInt() @Min(1) revision!: number;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsInt() @Min(1) base_version_id?: number;
}
export class BudgetTransitionDto {
  @IsInt() @Min(1) revision!: number;
  @IsIn(BUDGET_STATUSES) status!: BudgetStatus;
  @IsInt() @Min(1) version_id!: number;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
export class BudgetListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) company_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @IsIn(BUDGET_STATUSES) status?: BudgetStatus;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;
}
