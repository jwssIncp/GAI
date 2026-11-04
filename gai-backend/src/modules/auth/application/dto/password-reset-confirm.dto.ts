import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  token!: string;

  @ApiProperty({
    format: 'password',
    minLength: 15,
    maxLength: 128,
    description:
      'De 15 a 128 caracteres, permitindo frases e gerenciadores de senha',
    example: 'Uma frase pessoal muito longa',
  })
  @IsString()
  @MinLength(15)
  @MaxLength(256)
  new_password!: string;
}

export class PasswordResetConfirmResponseDto {
  @ApiProperty({ example: 'Password reset successfully' })
  message!: string;
}
