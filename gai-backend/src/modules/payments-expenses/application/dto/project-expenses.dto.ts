import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsCivilDate } from '../../../../common/validation/civil-date';
import { EXPENSE_TYPES, type ExpenseType } from '../../domain/expense.formulas';
import { MONEY_PATTERN } from './payments-expenses-inputs';

export class ExpenseProjectsQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(['true', 'false']) only_open?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) year?: number;
}

export class ExpenseBoardQueryDto {
  @IsOptional()
  @IsIn(['reimbursable', 'non_reimbursable', 'unclassified'])
  expense_type?: 'reimbursable' | 'non_reimbursable' | 'unclassified';
  @IsOptional() @IsIn(['billed', 'pending']) billing?: 'billed' | 'pending';
  @IsOptional()
  @IsIn(['pending', 'approved', 'paid', 'rejected', 'cancelled'])
  status?: string;
  @IsOptional() @IsString() @IsCivilDate() start_date?: string;
  @IsOptional() @IsString() @IsCivilDate() end_date?: string;
  /** Id do técnico ou "none" (despesas gerais). */
  @IsOptional() @Matches(/^(\d+|none)$/) field_agent_id?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) batch_id?: number;
}

export class ExpenseExportQueryDto extends ExpenseBoardQueryDto {
  @IsOptional() @IsIn(['xlsx', 'csv']) format?: 'xlsx' | 'csv';
}

export class ExpenseZipQueryDto {
  @IsIn(['full', 'client']) kind!: 'full' | 'client';
  /** "all", "batched", "unbatched" ou o id do lote. */
  @Matches(/^(all|batched|unbatched|\d+)$/) batch!: string;
}

export class ExpenseIdsDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}

export class ExpenseTypeBatchDto extends ExpenseIdsDto {
  @ApiProperty({ enum: EXPENSE_TYPES })
  @IsIn(EXPENSE_TYPES)
  expense_type!: ExpenseType;
}

export class AddToBatchDto extends ExpenseIdsDto {
  @ApiPropertyOptional({
    description: 'Lote aberto existente; sem ele, cria um lote novo',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batch_id?: number;
  @IsOptional() @IsString() @IsCivilDate() batch_date?: string;
  @IsOptional() @IsString() @IsCivilDate() expected_receipt_on?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}

export class BillBatchDto {
  @IsOptional() @IsString() @IsCivilDate() expected_receipt_on?: string | null;
}

export class ReasonDto {
  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

export class AdvanceInputDto {
  @Type(() => Number) @IsInt() @Min(1) field_agent_id!: number;
  @IsString() @IsCivilDate() advanced_on!: string;
  @IsString() @Matches(MONEY_PATTERN) amount!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(150) deposited_by_name?: string | null;
}

class ImportRowValuesDto {
  @IsOptional() @IsString() expense_date!: string | null;
  @IsOptional() @Type(() => Number) @IsInt() field_agent_id!: number | null;
  @IsOptional() @IsString() field_agent_name!: string | null;
  @IsOptional() @IsString() reason_code!: string | null;
  @IsOptional() @IsString() description!: string | null;
  @IsOptional()
  @IsIn([...EXPENSE_TYPES, null])
  expense_type!: ExpenseType | null;
  @IsOptional() @IsString() amount!: string | null;
  @IsOptional() @IsString() deposited_amount!: string | null;
  @IsOptional()
  @IsIn(['cash', 'installments', 'invoiced', null])
  payment_method!: 'cash' | 'installments' | 'invoiced' | null;
  @IsOptional() @Type(() => Number) @IsInt() installment_count!: number | null;
  @IsOptional() @IsString() invoiced_payment_date!: string | null;
}

class ImportRowDto {
  @Type(() => Number) @IsInt() @Min(1) line!: number;
  /** Erros da pré-visualização (ignorados na gravação, que valida de novo). */
  @IsOptional() @IsArray() @IsString({ each: true }) errors?: string[];
  @IsObject()
  @ValidateNested()
  @Type(() => ImportRowValuesDto)
  values!: ImportRowValuesDto;
}

export class ImportCommitDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}
