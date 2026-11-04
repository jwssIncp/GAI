import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
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
export class UpdateUserDto {
  @ApiPropertyOptional()
  @IfProvided()
  @Trimmed()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  full_name?: string;
  @ApiPropertyOptional()
  @IfProvided()
  @NormalizedIdentifier()
  @IsString()
  @Matches(LOGIN_PATTERN, {
    message:
      'Login: use de 3 a 100 letras, números, ponto, hífen ou sublinhado, sem @ ou espaços.',
  })
  login?: string;
  @ApiPropertyOptional()
  @IfProvided()
  @NormalizedIdentifier()
  @IsEmail()
  @MaxLength(255)
  email?: string;
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
  @ApiPropertyOptional({ type: [Number] })
  @IfProvided()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  role_ids?: number[];
}
