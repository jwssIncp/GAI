import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ minLength: 3, maxLength: 100, example: 'joao.silva' })
  @IsString()
  @MinLength(3)
  login!: string;

  @ApiProperty({ format: 'email', example: 'joao@empresa.com.br' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ type: 'integer', format: 'int64' })
  @IsOptional()
  @IsInt()
  @Min(1)
  organization_id?: number;
}
