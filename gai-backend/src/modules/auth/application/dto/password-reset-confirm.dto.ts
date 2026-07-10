import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString()
  token!: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    description:
      'Mín. 8 chars, maiúscula, minúscula, número e caractere especial',
    example: 'NewPass@123',
  })
  @IsString()
  @MinLength(8)
  new_password!: string;
}

export class PasswordResetConfirmResponseDto {
  @ApiProperty({ example: 'Password reset successfully' })
  message!: string;
}
