import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UserRole, UserStatus } from '../../../auth/domain/enums/user.enums';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../../auth/domain/ports/session.repository.port';
import { RoleType } from '../../domain/enums/role-type.enum';
import { UserAuditOperation } from '../../domain/enums/user-audit-operation.enum';
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
export class DeactivateUserUseCase {
  constructor(
    @Inject(USER_MANAGEMENT_REPOSITORY)
    private readonly repository: UserManagementRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepository,
    private readonly scope: UserScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DeactivateUserUseCase.name);
  }

  async execute(id: number, actor: ActorContext): Promise<UserResponseDto> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    this.scope.assertCanAccessUser(actor, user);

    if (user.status === UserStatus.INACTIVE) {
      const roleAssignments = await this.assignments.findActiveByUserId(
        user.id,
      );
      return UserResponseDto.fromDomain(user, roleAssignments);
    }

    const activeAssignments = await this.assignments.findActiveByUserId(
      user.id,
    );
    const isPlatformAdmin = activeAssignments.some(
      (item) =>
        item.roleType === RoleType.SYSTEM &&
        item.roleKey === UserRole.PLATFORM_ADMIN,
    );

    if (isPlatformAdmin) {
      const otherActive = await this.repository.countActivePlatformAdmins(
        user.id,
      );
      if (otherActive === 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Cannot deactivate the last active PLATFORM_ADMIN',
        });
      }
    }

    const revokedAt = new Date();
    const sessionsRevoked = await this.sessions.revokeAllForUser(
      user.id,
      revokedAt,
    );
    const previousStatus = user.status;
    user.deactivate();

    const saved = await this.repository.saveWithAudit(user, {
      userId: user.id,
      operation: UserAuditOperation.DEACTIVATE,
      performedBy: actor.id,
      changes: {
        status: { before: previousStatus, after: UserStatus.INACTIVE },
      },
    });

    this.logger.info({
      operation: 'DEACTIVATE_USER',
      userId: saved.id,
      sessionsRevoked,
      result: 'SUCCESS',
    });

    const roleAssignments = await this.assignments.findActiveByUserId(saved.id);
    return UserResponseDto.fromDomain(saved, roleAssignments);
  }
}
