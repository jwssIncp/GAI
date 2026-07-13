import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ExportJobStatus } from '../../domain/enums/export-job-status.enum';
import { ExportJobType } from '../../domain/enums/export-job-type.enum';

export class ExportJobListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({
    name: 'page_size',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  page_size = 20;

  @ApiPropertyOptional({ enum: ExportJobType })
  @IsEnum(ExportJobType)
  @IsOptional()
  type?: ExportJobType;

  @ApiPropertyOptional({ enum: ExportJobStatus })
  @IsEnum(ExportJobStatus)
  @IsOptional()
  status?: ExportJobStatus;

  @ApiPropertyOptional({
    name: 'requested_by_id',
    type: 'integer',
    format: 'int64',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  requested_by_id?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString()
  @IsOptional()
  date_from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString()
  @IsOptional()
  date_to?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  @IsOptional()
  search?: string;
}
