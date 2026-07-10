import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_MANAGEMENT_REPOSITORY,
  type UserManagementRepository,
} from '../../domain/ports/user-management.repository.port';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../domain/ports/user-role-assignment.repository.port';
import { RoleAssignmentResponseDto } from '../dto/user-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class ListUserRoleAssignmentsUseCase {
  constructor(
    @Inject(USER_MANAGEMENT_REPOSITORY)
    private readonly users: UserManagementRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    private readonly scope: UserScopeService,
  ) {}

  async execute(
    userId: number,
    actor: ActorContext,
  ): Promise<RoleAssignmentResponseDto[]> {
    this.scope.assertCanManageUsers(actor);

    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    this.scope.assertCanAccessUser(actor, user);

    const items = await this.assignments.findActiveByUserId(userId);
    return items.map(RoleAssignmentResponseDto.fromAssignedRole);
  }
}
