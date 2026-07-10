import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { OrganizationStatus } from '../../domain/enums/organization-status.enum';

export class CreateOrganizationDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 255,
    example: 'Empresa Exemplo Ltda',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  legal_name!: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'Exemplo' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  trade_name?: string;

  @ApiProperty({
    pattern: '^\\d{14}$',
    description: 'CNPJ com 14 dígitos, sem máscara',
    example: '11222333000181',
  })
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj must contain exactly 14 digits' })
  cnpj!: string;

  @ApiPropertyOptional({ format: 'email', example: 'contato@exemplo.com.br' })
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 20, example: '11999998888' })
  @IsOptional()
  @IsString()
  @Length(10, 20)
  contact_phone?: string;

  @ApiPropertyOptional({
    enum: OrganizationStatus,
    default: OrganizationStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}
