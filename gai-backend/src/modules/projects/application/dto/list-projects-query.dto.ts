import { ProjectType } from '../../domain/enums/project-type.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ProjectStatus } from '../../domain/enums/project-status.enum';

export class ListProjectsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;

  @ApiPropertyOptional({ type: 'integer', format: 'int64' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organization_id?: number;

  @ApiPropertyOptional({ type: 'integer', format: 'int64' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id?: number;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: ProjectType })
  @IsOptional()
  @IsEnum(ProjectType)
  project_type?: ProjectType;
  @ApiPropertyOptional({
    enum: ['name', 'code', 'start_date', 'end_date', 'created_at'],
  })
  @IsOptional()
  @IsIn(['name', 'code', 'start_date', 'end_date', 'created_at'])
  sort_by?: 'name' | 'code' | 'start_date' | 'end_date' | 'created_at';
  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Busca por nome, codigo ou descricao' })
  @IsOptional()
  @IsString()
  search?: string;
}
