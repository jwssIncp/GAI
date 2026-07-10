import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ExpenseStatus } from '../../domain/enums/expense-status.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  field_agent_id?: number;
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  start_date?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  end_date?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  payment_date?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class ListExpensesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  field_agent_id?: number;
  @ApiPropertyOptional({ enum: ExpenseStatus })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  start_date?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  end_date?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
