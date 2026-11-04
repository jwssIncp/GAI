import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';
import { NormalizedIdentifier } from '../../../../common/validation/user-input';

export class PasswordResetRequestDto {
  @ApiProperty({ format: 'email', example: 'user@gai.local' })
  @IsEmail()
  @NormalizedIdentifier()
  @MaxLength(255)
  email!: string;
}

export class PasswordResetRequestResponseDto {
  @ApiProperty({
    example:
      'If the email is registered, you will receive recovery instructions.',
  })
  message!: string;
}
