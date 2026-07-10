import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_MANAGEMENT_REPOSITORY,
  type UserManagementRepository,
} from '../../domain/ports/user-management.repository.port';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../domain/ports/user-role-assignment.repository.port';
import { UserResponseDto } from '../dto/user-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class GetUserUseCase {
  constructor(
    @Inject(USER_MANAGEMENT_REPOSITORY)
    private readonly repository: UserManagementRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    private readonly scope: UserScopeService,
  ) {}

  async execute(id: number, actor: ActorContext): Promise<UserResponseDto> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    this.scope.assertCanAccessUser(actor, user);
    const roleAssignments = await this.assignments.findActiveByUserId(user.id);
    return UserResponseDto.fromDomain(user, roleAssignments);
  }
}
