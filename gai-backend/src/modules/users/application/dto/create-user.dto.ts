import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  IfProvided,
  LOGIN_PATTERN,
  NormalizedIdentifier,
  Trimmed,
} from '../../../../common/validation/user-input';
export class CreateUserDto {
  @ApiProperty()
  @Trimmed()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  full_name!: string;
  @ApiProperty()
  @NormalizedIdentifier()
  @IsString()
  @Matches(LOGIN_PATTERN, {
    message:
      'Login: use de 3 a 100 letras, números, ponto, hífen ou sublinhado, sem @ ou espaços.',
  })
  login!: string;
  @ApiProperty()
  @NormalizedIdentifier()
  @IsEmail()
  @MaxLength(255)
  email!: string;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Trimmed()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+\d() .-]*$/)
  phone?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Trimmed()
  @IsString()
  @MaxLength(120)
  job_title?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsInt()
  @Min(1)
  organization_id?: number | null;
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  role_ids!: number[];

  @ApiProperty({ enum: ['INVITATION', 'TEMPORARY_PASSWORD'] })
  @IsIn(['INVITATION', 'TEMPORARY_PASSWORD'])
  activation_method!: 'INVITATION' | 'TEMPORARY_PASSWORD';
  @ApiPropertyOptional()
  @IfProvided()
  @IsString()
  @MaxLength(256)
  password?: string;
}
