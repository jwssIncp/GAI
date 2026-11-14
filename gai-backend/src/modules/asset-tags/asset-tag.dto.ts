import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Datas aceitam ano com 2 dígitos ("0026-05-10"), corrigido no serviço. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UNIT = /^\d{1,11}(\.\d{1,4})?$/;
const bool = ({ value }: { value: unknown }) =>
  value === true || value === 'true'
    ? true
    : value === false || value === 'false'
      ? false
      : value;

export class AssetTagOrderInputDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @IsString() @MaxLength(60) proposal_number?: string | null;
  @IsOptional() @Matches(DATE) ordered_on?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) quantity?: number;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequence_start?: number | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequence_end?: number | null;
  @IsOptional() @IsString() @MaxLength(60) model?: string | null;
  @IsOptional() @IsString() @MaxLength(150) supplier_name?: string;
  @IsOptional() @Matches(UNIT) unit_cost?: string;
  @IsOptional() @Transform(bool) @IsBoolean() supplier_paid?: boolean;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE)
  supplier_expected_payment_on?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE)
  supplier_paid_on?: string | null;
  @IsOptional() @Matches(UNIT) unit_price?: string;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE)
  client_expected_receipt_on?: string | null;
  @IsOptional() @Transform(bool) @IsBoolean() client_received?: boolean;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE)
  client_received_on?: string | null;
  @IsOptional()
  @IsIn(['reimbursable', 'non_reimbursable', null])
  expense_type_override?: 'reimbursable' | 'non_reimbursable' | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

export class AssetTagOrderQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @IsIn(['pending', 'paid']) supplier_status?: 'pending' | 'paid';
  @IsOptional() @IsIn(['yes', 'no']) received?: 'yes' | 'no';
  @IsOptional()
  @IsIn(['reimbursable', 'non_reimbursable', 'unclassified'])
  expense_type?: 'reimbursable' | 'non_reimbursable' | 'unclassified';
  @IsOptional() @IsString() @MaxLength(60) proposal?: string;
}
