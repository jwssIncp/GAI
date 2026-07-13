import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { JsonRecord } from '../../domain/entities/project';

const trimString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeOptionalDate = (value: unknown): unknown =>
  value === '' ? undefined : value;

export class CreateProjectDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organization_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id!: number;

  @ApiProperty({ minLength: 2, maxLength: 255 })
  @Transform((params: TransformFnParams) => trimString(params.value as unknown))
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @Transform((params: TransformFnParams) =>
    trimOptionalString(params.value as unknown),
  )
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @Transform((params: TransformFnParams) =>
    normalizeOptionalDate(params.value as unknown),
  )
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  start_date?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @Transform((params: TransformFnParams) =>
    normalizeOptionalDate(params.value as unknown),
  )
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  end_date?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  settings?: JsonRecord | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;
}
