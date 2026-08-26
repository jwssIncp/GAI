import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseAccountabilityStatus } from './expense-accountability.entity';

export class CreateExpenseAccountabilityDto {
  @ApiProperty({ type: 'integer' }) @IsInt() @Min(1) field_agent_id!: number;
  @ApiProperty({ format: 'date' }) @IsDateString() period_start!: string;
  @ApiProperty({ format: 'date' }) @IsDateString() period_end!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
export class AddAccountabilityExpenseDto {
  @ApiProperty({ type: 'integer' }) @IsInt() @Min(1) expense_id!: number;
}
export class GenerateExpenseInstallmentsDto {
  @ApiProperty({ minimum: 1, maximum: 120 })
  @IsInt()
  @Min(1)
  @Max(120)
  count!: number;
  @ApiProperty({ format: 'date' }) @IsDateString() first_due_date!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  origin?: string;
}

export class ExpenseAccountabilityListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    name: 'page_size',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size = 20;

  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  field_agent_id?: number;

  @ApiPropertyOptional({ enum: ExpenseAccountabilityStatus })
  @IsOptional()
  @IsEnum(ExpenseAccountabilityStatus)
  status?: ExpenseAccountabilityStatus;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  period_start?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  period_end?: string;
}

export class ExpenseInstallmentListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    name: 'page_size',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size = 20;
}
