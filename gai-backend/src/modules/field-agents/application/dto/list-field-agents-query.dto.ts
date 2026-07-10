import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FieldAgentStatus } from '../../domain/enums/field-agent-status.enum';

export class ListFieldAgentsQueryDto {
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

  @ApiPropertyOptional({ description: 'Busca por nome, email ou documento' })
  @IsOptional()
  @IsString()
  search?: string;
}
