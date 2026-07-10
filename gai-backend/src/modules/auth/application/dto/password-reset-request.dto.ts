import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class PasswordResetRequestDto {
  @ApiProperty({ format: 'email', example: 'user@gai.local' })
  @IsEmail()
  email!: string;
}

export class PasswordResetRequestResponseDto {
  @ApiProperty({
    example:
      'If the email is registered, you will receive recovery instructions.',
  })
  message!: string;
}
