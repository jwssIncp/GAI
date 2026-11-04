import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Password } from '../../domain/value-objects/password';

export class PasswordResetConfirmDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  token!: string;

  @ApiProperty({
    format: 'password',
    minLength: Password.MIN_LENGTH,
    maxLength: Password.MAX_LENGTH,
    description:
      'De 8 a 128 caracteres, permitindo frases e gerenciadores de senha',
    example: 'Uma frase pessoal muito longa',
  })
  @IsString()
  @MinLength(Password.MIN_LENGTH)
  @MaxLength(Password.MAX_LENGTH)
  new_password!: string;
}

export class PasswordResetConfirmResponseDto {
  @ApiProperty({ example: 'Password reset successfully' })
  message!: string;
}
