import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { RoleAssignmentResponseDto } from '../../../users/application/dto/user-response.dto';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../../users/domain/ports/user-role-assignment.repository.port';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port';
import { CurrentUserDto } from '../dto/login-response.dto';
import {
  ORGANIZATION_GATE,
  type OrganizationGate,
} from '../../domain/ports/organization-gate.port';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../../domain/ports/permission-resolver.port';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions: PermissionResolver,
    @Inject(ORGANIZATION_GATE)
    private readonly organizations: OrganizationGate,
  ) {}

  async execute(userId: number): Promise<CurrentUserDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Sessão inválida ou expirada. Entre novamente.',
      });
    }

    const roleAssignments = await this.assignments.findActiveByUserId(user.id);

    return CurrentUserDto.fromUser({
      id: user.id,
      fullName: user.fullName,
      mustChangePassword: user.mustChangePassword,
      login: user.login,
      email: user.email,
      status: user.status,
      organizationId: user.organizationId,
      organizationName: user.organizationId
        ? await this.organizations.displayName(user.organizationId)
        : null,
      roleAssignments: roleAssignments.map((assignment) =>
        RoleAssignmentResponseDto.fromAssignedRole(assignment),
      ),
      permissions: user.mustChangePassword
        ? []
        : await this.permissions.resolveForUser(user.id),
    });
  }
}
