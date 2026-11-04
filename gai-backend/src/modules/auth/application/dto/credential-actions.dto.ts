import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Password } from '../../domain/value-objects/password';
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  current_password!: string;
  @ApiProperty({
    minLength: Password.MIN_LENGTH,
    maxLength: Password.MAX_LENGTH,
  })
  @IsString()
  @MinLength(Password.MIN_LENGTH)
  @MaxLength(Password.MAX_LENGTH)
  new_password!: string;
}
export class AdministrativePasswordDto {
  @ApiProperty({
    minLength: Password.MIN_LENGTH,
    maxLength: Password.MAX_LENGTH,
  })
  @IsString()
  @MinLength(Password.MIN_LENGTH)
  @MaxLength(Password.MAX_LENGTH)
  password!: string;
}
