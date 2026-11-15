import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  BRAZILIAN_STATES,
  normalizeState,
} from '../../domain/validation/brazilian-states';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FieldAgentStatus } from '../../domain/enums/field-agent-status.enum';

export class ListFieldAgentsQueryDto {
  @IsOptional() @IsIn(['current', 'deleted']) deletion?: 'current' | 'deleted';
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exclude_project_id?: number;
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

  @ApiPropertyOptional({ enum: FieldAgentStatus })
  @IsOptional()
  @IsEnum(FieldAgentStatus)
  status?: FieldAgentStatus;

  @ApiPropertyOptional({ enum: BRAZILIAN_STATES })
  @Transform(({ value }) => normalizeState(value) ?? undefined)
  @IsOptional()
  @IsIn(BRAZILIAN_STATES)
  state?: string;

  @ApiPropertyOptional({ description: 'Busca por nome, email ou documento' })
  @IsOptional()
  @IsString()
  search?: string;
}
