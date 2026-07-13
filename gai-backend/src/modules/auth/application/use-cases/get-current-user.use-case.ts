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
  ) {}

  async execute(userId: number): Promise<CurrentUserDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      });
    }

    const roleAssignments = await this.assignments.findActiveByUserId(user.id);

    return CurrentUserDto.fromUser({
      id: user.id,
      login: user.login,
      email: user.email,
      status: user.status,
      organizationId: user.organizationId,
      roleAssignments: roleAssignments.map((assignment) =>
        RoleAssignmentResponseDto.fromAssignedRole(assignment),
      ),
      permissions: await this.permissions.resolveForUser(user.id),
    });
  }
}
