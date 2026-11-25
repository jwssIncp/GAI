import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { JsonRecord } from '../../domain/entities/field-agent';
import {
  BRAZILIAN_STATES,
  normalizeState,
} from '../../domain/validation/brazilian-states';
import {
  IsBrazilianDocument,
  IsBrazilianPhone,
  NormalizeOptionalDocument,
  NormalizeOptionalEmail,
  NormalizeOptionalPhone,
  normalizeOptionalText,
} from '../validation/field-agent.validators';

export class CreateFieldAgentDto {
  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id?: number | null;

  @ApiProperty({ minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ format: 'email', nullable: true })
  @NormalizeOptionalEmail()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NormalizeOptionalPhone()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsBrazilianPhone()
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NormalizeOptionalDocument()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsBrazilianDocument()
  document?: string | null;

  @ApiPropertyOptional({ enum: BRAZILIAN_STATES, nullable: true })
  @Transform(({ value }) => normalizeState(value))
  @IsOptional()
  @IsIn(BRAZILIAN_STATES, { message: 'UF inválida.' })
  state?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'A cidade deve ter no máximo 120 caracteres.' })
  city?: string | null;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'A indicação deve ter no máximo 255 caracteres.' })
  referral?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'Projetos a vincular já no cadastro (mesma transação; mesmas regras do vínculo pelo projeto).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  project_ids?: number[];
}
