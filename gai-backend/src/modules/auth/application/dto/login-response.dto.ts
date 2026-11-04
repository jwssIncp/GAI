import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../domain/enums/user.enums';
import { RoleAssignmentResponseDto } from '../../../users/application/dto/user-response.dto';
import { PermissionScope } from '../../../users/domain/enums/permission-scope.enum';
import { ResolvedPermission } from '../../domain/ports/permission-resolver.port';

export class CurrentUserPermissionDto {
  @ApiProperty({ example: 'projects:read' })
  key!: string;

  @ApiProperty({ enum: PermissionScope })
  scope!: PermissionScope;
}

export class CurrentUserDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;
  @ApiPropertyOptional({ nullable: true }) full_name!: string | null;
  @ApiProperty() must_change_password!: boolean;

  @ApiProperty({ example: 'platform.admin' })
  login!: string;

  @ApiProperty({ format: 'email', example: 'admin@gai.local' })
  email!: string;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  organization_id!: number | null;

  @ApiProperty({ type: [RoleAssignmentResponseDto] })
  role_assignments!: RoleAssignmentResponseDto[];

  @ApiProperty({ type: [CurrentUserPermissionDto] })
  permissions!: CurrentUserPermissionDto[];

  static fromUser(user: {
    id: number;
    fullName?: string | null;
    mustChangePassword?: boolean;
    login: string;
    email: string;
    status: UserStatus;
    organizationId: number | null;
    roleAssignments: RoleAssignmentResponseDto[];
    permissions: ResolvedPermission[];
  }): CurrentUserDto {
    return {
      id: user.id,
      full_name: user.fullName ?? null,
      must_change_password: user.mustChangePassword ?? false,
      login: user.login,
      email: user.email,
      status: user.status,
      organization_id: user.organizationId,
      role_assignments: user.roleAssignments,
      permissions: user.permissions,
    };
  }
}

export class LoginResponseDto {
  @ApiProperty({ format: 'uuid', description: 'ID da sessão (Bearer token)' })
  access_token!: string;

  @ApiProperty({ format: 'date-time' })
  expires_at!: string;

  @ApiProperty({ type: CurrentUserDto })
  user!: CurrentUserDto;
}
