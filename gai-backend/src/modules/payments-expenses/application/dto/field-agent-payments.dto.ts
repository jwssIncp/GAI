import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BATCH_LIMIT } from '../services/field-agent-payments.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export class ConsolidatedPaymentsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) field_agent_id?: number;
  @IsOptional()
  @IsIn(['open', 'pending', 'approved', 'paid', 'cancelled'])
  status?: 'open' | 'pending' | 'approved' | 'paid' | 'cancelled';
  @IsOptional() @IsString() @Matches(MONTH) expected_month?: string;
  @IsOptional() @IsString() @Matches(MONTH) paid_month?: string;
  @IsOptional() @IsString() @Matches(DATE) expected_date?: string;
  @IsOptional() @IsString() @Matches(DATE) payment_date?: string;
  /** Só os em aberto sem data prevista: ?no_expected=true */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  no_expected?: boolean;
}

export class PaymentIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BATCH_LIMIT)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}

/** Desfazer pagamento: a justificativa fica na auditoria de cada lançamento. */
export class RevertPaymentsDto extends PaymentIdsDto {
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}

export class BatchPayDto extends PaymentIdsDto {
  /** today = data de hoje; chosen = uma data para todos; individual = uma data por lançamento. */
  @IsIn(['today', 'chosen', 'individual']) date_mode!:
    | 'today'
    | 'chosen'
    | 'individual';
  @IsOptional() @IsString() @Matches(DATE) payment_date?: string;
  /** { "<id>": "AAAA-MM-DD" } no modo individual. */
  @IsOptional() @IsObject() dates?: Record<string, string>;
}

export class ChangePaymentDateDto {
  @IsIn(['payment', 'expected']) kind!: 'payment' | 'expected';
  @IsString() @Matches(DATE) date!: string;
}
