import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
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
  IsBrazilianDocument,
  IsBrazilianPhone,
  NormalizeOptionalDocument,
  NormalizeOptionalEmail,
  NormalizeOptionalPhone,
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

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: JsonRecord | null;
}
