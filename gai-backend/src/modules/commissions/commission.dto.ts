import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const PCT = /^\d{1,3}(\.\d{1,2})?$/;

export class CommissionInputDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) partner_id?: number;
  @IsOptional() @Matches(MONEY) contract_value?: string;
  @IsOptional() @Matches(PCT) percent?: string;
  /** Valor informado à mão; null volta ao cálculo. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(MONEY)
  amount_manual?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE)
  expected_payment_on?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE)
  paid_on?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

export class CommissionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) partner_id?: number;
  @IsOptional() @IsIn(['paid', 'overdue', 'pending']) status?:
    | 'paid'
    | 'overdue'
    | 'pending';
}

export class PartnerInputDto {
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(150) company?: string | null;
}
