import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole, UserStatus } from '../../../auth/domain/enums/user.enums';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum({
    name: 'name',
    login: 'login',
    created_at: 'created_at',
    last_login_at: 'last_login_at',
  })
  sort_by?: 'name' | 'login' | 'created_at' | 'last_login_at';
  @IsOptional()
  @IsEnum({ ASC: 'ASC', DESC: 'DESC' })
  sort_order?: 'ASC' | 'DESC';
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  role_id?: number;

  @ApiPropertyOptional({ enum: ['PLATFORM', 'ORGANIZATION'] })
  @IsOptional()
  @IsEnum({ PLATFORM: 'PLATFORM', ORGANIZATION: 'ORGANIZATION' })
  scope?: 'PLATFORM' | 'ORGANIZATION';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;

  @ApiPropertyOptional({ type: 'integer', format: 'int64' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organization_id?: number;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Busca por login ou email' })
  @IsOptional()
  @IsString()
  search?: string;
}
