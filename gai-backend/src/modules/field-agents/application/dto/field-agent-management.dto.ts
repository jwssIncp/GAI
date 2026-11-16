import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  NormalizedIdentifier,
  LOGIN_PATTERN,
} from '../../../../common/validation/user-input';

export class FieldAgentPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size: number = 20;
}
export class FieldAgentUserOptionsDto extends FieldAgentPageDto {
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) current_agent_id?: number;
}
const LOGIN_MESSAGE =
  'Login: use de 3 a 100 letras, números, ponto, hífen ou sublinhado, sem @ ou espaços.';
export class InviteFieldAgentUserDto {
  @NormalizedIdentifier()
  @IsString()
  @Matches(LOGIN_PATTERN, { message: LOGIN_MESSAGE })
  login!: string;
  @NormalizedIdentifier()
  @IsEmail({}, { message: 'Informe um e-mail válido para enviar o convite.' })
  @MaxLength(255)
  email!: string;
}
/** Acesso com senha temporária gerada pelo sistema; e-mail opcional. */
export class CreateFieldAgentTemporaryAccessDto {
  @NormalizedIdentifier()
  @IsString()
  @Matches(LOGIN_PATTERN, { message: LOGIN_MESSAGE })
  login!: string;
  @IsOptional()
  @NormalizedIdentifier()
  @ValidateIf((_o, value: unknown) => value !== null && value !== '')
  @IsEmail({}, { message: 'Informe um e-mail válido ou deixe em branco.' })
  @MaxLength(255)
  email?: string | null;
}
