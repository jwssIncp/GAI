import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const REFRESH_TOKEN_PATTERN = /^gmr_[A-Za-z0-9_-]{43}$/;

export class MobileLoginDto {
  @ApiProperty({ description: 'E-mail ou login', example: 'tecnico.campo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @ApiPropertyOptional({
    description: 'Rótulo do aparelho (informativo, não é prova de identidade)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_label?: string;
}

export class MobileRefreshTokenDto {
  @ApiProperty({ description: 'Refresh token opaco recebido no login/refresh' })
  @IsString()
  @Length(47, 47)
  @Matches(REFRESH_TOKEN_PATTERN)
  refresh_token!: string;
}

export class MobileTokenUserDto {
  @ApiProperty({ type: 'integer' }) id!: number;
  @ApiPropertyOptional({ nullable: true }) full_name!: string | null;
  @ApiProperty() must_change_password!: boolean;
}

export class MobileTokenResponseDto {
  @ApiProperty({ example: 'Bearer' }) token_type!: 'Bearer';
  @ApiProperty({ description: 'Access token opaco de curta duração' })
  access_token!: string;
  @ApiProperty({ format: 'date-time' }) access_token_expires_at!: string;
  @ApiProperty() refresh_token!: string;
  @ApiProperty({ format: 'date-time' }) refresh_token_expires_at!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'Expiração absoluta da sessão; exige novo login',
  })
  session_expires_at!: string;
  @ApiProperty({ type: MobileTokenUserDto }) user!: MobileTokenUserDto;
}
