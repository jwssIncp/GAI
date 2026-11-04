import { ProjectRegistrationFieldsDto } from './project-registration-fields.dto';
import { IsCivilDate } from '../../../../common/validation/civil-date';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';

const trimString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeOptionalDate = (value: unknown): unknown =>
  value === '' ? undefined : value;

export class UpdateProjectDto extends ProjectRegistrationFieldsDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Optional optimistic concurrency token from the previously read project',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  expected_updated_at?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 255 })
  @Transform((params: TransformFnParams) => trimString(params.value as unknown))
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

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
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  start_date?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @Transform((params: TransformFnParams) =>
    normalizeOptionalDate(params.value as unknown),
  )
  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  end_date?: string | null;
}
