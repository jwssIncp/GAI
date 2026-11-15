import { IsCivilDate } from '../../../../common/validation/civil-date';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  Max,
  ValidateNested,
  IsInt,
  MaxLength,
  MinLength,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { JsonRecord } from '../../domain/entities/field-agent-payment';
import {
  EXPENSE_TYPES,
  type ExpensePaymentMethod,
  type ExpenseType,
  MAX_INSTALLMENTS,
  PAYMENT_METHODS,
} from '../../domain/expense.formulas';

export const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

export class PaymentInputDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  field_agent_id!: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  state?: string | null;
  @ApiProperty({ format: 'date' })
  @IsString()
  @IsCivilDate()
  start_date!: string;
  @ApiProperty({ format: 'date' })
  @IsString()
  @IsCivilDate()
  end_date!: string;
  /** Compatibilidade: clientes antigos mandavam a previsão em payment_date. */
  @ApiPropertyOptional({ format: 'date', nullable: true, deprecated: true })
  @IsOptional()
  @IsString()
  @IsCivilDate()
  payment_date?: string | null;
  /** Data PREVISTA de pagamento (obrigatória). A data real só é gravada na baixa. */
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsString()
  @IsCivilDate()
  expected_payment_date?: string | null;
  @ApiProperty({ pattern: MONEY_PATTERN.source })
  @IsString()
  @Matches(MONEY_PATTERN)
  daily_rate!: string;
  /** Total informado à mão (substitui dias × diária + adicional). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  total_manual?: boolean;
  @ApiPropertyOptional({ pattern: MONEY_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  total_amount?: string | null;
  @ApiPropertyOptional({ pattern: MONEY_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  additional_amount?: string;
  @ApiPropertyOptional({ pattern: MONEY_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  discount_amount?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;
}

export class ReopenPaymentDto {
  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

export class RemunerationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) field_agent_id?: number;
  @IsOptional() @IsString() state?: string;
  @IsOptional()
  @IsIn(['open', 'paid', 'cancelled', 'all'])
  status_group?: 'open' | 'paid' | 'cancelled' | 'all';
}

export class RemunerationProjectsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional()
  @Type(() => String)
  @IsIn(['true', 'false'])
  only_open?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) year?: number;
}

export class ExpenseInputDto {
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  field_agent_id?: number | null;
  @ApiProperty()
  @IsString()
  description!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string | null;
  @ApiProperty({ format: 'date' })
  @IsString()
  @IsCivilDate()
  expense_date!: string;
  @ApiProperty({ pattern: MONEY_PATTERN.source })
  @IsString()
  @Matches(MONEY_PATTERN)
  amount!: string;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;

  // Etapa 4 (doc 06 §3.3). Opcionais: clientes antigos (app de campo) continuam válidos.
  @ApiPropertyOptional({ enum: EXPENSE_TYPES, nullable: true })
  @IsOptional()
  @IsIn([...EXPENSE_TYPES, null])
  expense_type?: ExpenseType | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Motivo da lista da organização',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reason_code?: string | null;
  @ApiPropertyOptional({ enum: PAYMENT_METHODS, nullable: true })
  @IsOptional()
  @IsIn([...PAYMENT_METHODS, null])
  payment_method?: ExpensePaymentMethod | null;
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_INSTALLMENTS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INSTALLMENTS)
  installment_count?: number;
  @ApiPropertyOptional({ type: () => [ExpenseInstallmentInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INSTALLMENTS)
  @ValidateNested({ each: true })
  @Type(() => ExpenseInstallmentInputDto)
  installments?: ExpenseInstallmentInputDto[];
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  @IsCivilDate()
  invoiced_payment_date?: string | null;
  @ApiPropertyOptional({ pattern: MONEY_PATTERN.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  deposited_amount?: string | null;
}

export class ExpenseInstallmentInputDto {
  @ApiProperty({ format: 'date' })
  @IsString()
  @IsCivilDate()
  due_date!: string;
  @ApiProperty({ pattern: MONEY_PATTERN.source })
  @IsString()
  @Matches(MONEY_PATTERN)
  amount!: string;
}

export class MarkAsPaidDto {
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  @IsCivilDate()
  payment_date?: string | null;
}

export class RejectExpenseDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

export class CreateExpenseAttachmentUploadDto {
  @ApiProperty()
  @IsString()
  original_name!: string;
  @ApiProperty()
  @IsString()
  mime_type!: string;
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes!: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  checksum?: string | null;
}

export class ConfirmExpenseAttachmentUploadDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  checksum?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes?: number | null;
}
