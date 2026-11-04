import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail ou nome de usuário (login)',
    example: 'platform.admin',
  })
  @IsString()
  identifier!: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    example: 'Example only: supply a runtime password',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
