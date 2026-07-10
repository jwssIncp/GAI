import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { RoleType } from '../../domain/enums/role-type.enum';
import {
  USER_MANAGEMENT_REPOSITORY,
  type UserManagementRepository,
} from '../../domain/ports/user-management.repository.port';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../domain/ports/user-role-assignment.repository.port';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class RevokeUserRoleAssignmentUseCase {
  constructor(
    @Inject(USER_MANAGEMENT_REPOSITORY)
    private readonly users: UserManagementRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    private readonly scope: UserScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RevokeUserRoleAssignmentUseCase.name);
  }

  async execute(
    userId: number,
    assignmentId: number,
    actor: ActorContext,
  ): Promise<void> {
    this.scope.assertCanAssignRoles(actor);

    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    this.scope.assertCanAccessUser(actor, user);

    const activeAssignments =
      await this.assignments.findAllActiveByUserId(userId);
    const target = activeAssignments.find(
      (item) => item.assignmentId === assignmentId,
    );
    if (!target) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Role assignment not found',
      });
    }

    this.scope.assertCanRevokeRole(actor, user.organizationId, {
      type: target.roleType,
      key: target.roleKey,
      organizationId: target.organizationId,
    });

    if (
      target.roleType === RoleType.SYSTEM &&
      target.roleKey === UserRole.PLATFORM_ADMIN
    ) {
      const others = await this.assignments.countActiveUsersWithSystemRole(
        UserRole.PLATFORM_ADMIN,
        userId,
      );
      if (others === 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Cannot revoke the last active PLATFORM_ADMIN assignment',
        });
      }
    }

    await this.assignments.revoke(assignmentId, new Date());

    this.logger.info({
      operation: 'REVOKE_USER_ROLE',
      userId,
      assignmentId,
      result: 'SUCCESS',
    });
  }
}
