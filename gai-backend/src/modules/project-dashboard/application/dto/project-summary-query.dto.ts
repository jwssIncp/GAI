import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

export class ProjectSummaryQueryDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Includes financial totals only when both payments:read and expenses:read are authorized; otherwise the optional block is omitted.',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  include_financial?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  include_imports?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  include_exports?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  include_recent_activity?: boolean = false;
}
