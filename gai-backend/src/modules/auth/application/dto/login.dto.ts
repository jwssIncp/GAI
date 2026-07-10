import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail ou nome de usuário (login)',
    example: 'platform.admin',
  })
  @IsString()
  identifier!: string;

  @ApiProperty({ format: 'password', minLength: 8, example: 'Admin@123456' })
  @IsString()
  @MinLength(8)
  password!: string;
}
