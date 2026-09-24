import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  legal_name?: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  trade_name?: string;

  @ApiPropertyOptional({ format: 'email', nullable: true })
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 20, nullable: true })
  @IsOptional()
  @IsString()
  @Length(10, 20)
  contact_phone?: string;
}
