import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { JsonRecord } from '../../domain/entities/field-agent-payment';

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
  start_date!: string;
  @ApiProperty({ format: 'date' })
  @IsString()
  end_date!: string;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  payment_date?: string | null;
  @ApiProperty({ pattern: MONEY_PATTERN.source })
  @IsString()
  @Matches(MONEY_PATTERN)
  daily_rate!: string;
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
}

export class MarkAsPaidDto {
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
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
