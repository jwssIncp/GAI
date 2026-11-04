import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProjectType } from '../../domain/enums/project-type.enum';

export class ProjectRegistrationFieldsDto {
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 40,
    nullable: true,
    description: 'Unique within organization; generated when omitted on create',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z0-9][A-Z0-9._/-]+$/)
  code?: string | null;

  @ApiPropertyOptional({ enum: ProjectType, nullable: true })
  @IsOptional()
  @IsEnum(ProjectType)
  project_type?: ProjectType | null;

  @ApiPropertyOptional({ type: 'integer', nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  responsible_user_id?: number | null;

  @ApiPropertyOptional({ type: 'integer', nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planning_responsible_user_id?: number | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  planning_notes?: string | null;
}
