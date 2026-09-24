import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../../auth/domain/enums/user.enums';
import { RoleType } from '../../domain/enums/role-type.enum';
import { AssignedRole } from '../../domain/ports/user-role-assignment.repository.port';
import { ManagedUser } from '../../domain/entities/managed-user';

export class RoleAssignmentResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  assignment_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  role_id!: number;

  @ApiPropertyOptional({ nullable: true })
  role_key!: string | null;

  @ApiProperty()
  role_name!: string;

  @ApiProperty({ enum: RoleType })
  role_type!: RoleType;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  organization_id!: number | null;

  @ApiProperty({ format: 'date-time' })
  assigned_at!: string;

  static fromAssignedRole(assignment: AssignedRole): RoleAssignmentResponseDto {
    return {
      assignment_id: assignment.assignmentId,
      role_id: assignment.roleId,
      role_key: assignment.roleKey,
      role_name: assignment.roleName,
      role_type: assignment.roleType,
      organization_id: assignment.organizationId,
      assigned_at: assignment.assignedAt.toISOString(),
    };
  }
}

export class UserResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty()
  login!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  organization_id!: number | null;

  @ApiProperty({ type: [RoleAssignmentResponseDto] })
  role_assignments!: RoleAssignmentResponseDto[];

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  static fromDomain(
    user: ManagedUser,
    roleAssignments: AssignedRole[] = [],
  ): UserResponseDto {
    return {
      id: user.id,
      login: user.login,
      email: user.email,
      status: user.status,
      organization_id: user.organizationId,
      role_assignments: roleAssignments.map((assignment) =>
        RoleAssignmentResponseDto.fromAssignedRole(assignment),
      ),
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    };
  }
}

export class PaginationMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  page_size!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  total_pages!: number;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
