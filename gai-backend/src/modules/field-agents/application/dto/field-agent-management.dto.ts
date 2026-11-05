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
export class InviteFieldAgentUserDto {
  @NormalizedIdentifier() @IsString() @Matches(LOGIN_PATTERN) login!: string;
  @NormalizedIdentifier() @IsEmail() @MaxLength(255) email!: string;
}
