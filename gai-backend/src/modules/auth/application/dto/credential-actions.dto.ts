import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  current_password!: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  new_password!: string;
}
export class AdministrativePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
