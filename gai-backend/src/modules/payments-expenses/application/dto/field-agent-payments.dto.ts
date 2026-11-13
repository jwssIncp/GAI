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
  Min,
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
