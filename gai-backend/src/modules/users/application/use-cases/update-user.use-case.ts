import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../auth/domain/ports/password-hasher.port';
import { UserAuditOperation } from '../../domain/enums/user-audit-operation.enum';
import {
  USER_MANAGEMENT_REPOSITORY,
  type UserManagementRepository,
} from '../../domain/ports/user-management.repository.port';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../domain/ports/user-role-assignment.repository.port';
import { isRoleCompatibleWithUserOrganization } from '../../domain/services/role-assignment-scope';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_MANAGEMENT_REPOSITORY)
    private readonly repository: UserManagementRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly scope: UserScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateUserUseCase.name);
  }

  async execute(
    id: number,
    dto: UpdateUserDto,
    actor: ActorContext,
  ): Promise<UserResponseDto> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    this.scope.assertCanAccessUser(actor, user);

    const changes: Record<string, { before: unknown; after: unknown }> = {};

    if (
      dto.email !== undefined &&
      dto.email.trim().toLowerCase() !== user.email
    ) {
      const existingEmail = await this.repository.findByEmail(
        dto.email.trim().toLowerCase(),
      );
      if (existingEmail && existingEmail.id !== user.id) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Login or email already exists',
        });
      }
      changes.email = {
        before: user.email,
        after: dto.email.trim().toLowerCase(),
      };
      user.updateEmail(dto.email.trim().toLowerCase());
    }

    if (
      dto.organization_id !== undefined &&
      dto.organization_id !== user.organizationId
    ) {
      const newOrganizationId = dto.organization_id;
      this.scope.assertCanChangeUserOrganization(actor);

      const activeAssignments = await this.assignments.findAllActiveByUserId(
        user.id,
      );
      const incompatibleAssignments = activeAssignments.filter(
        (assignment) =>
          !isRoleCompatibleWithUserOrganization(
            {
              type: assignment.roleType,
              key: assignment.roleKey,
              organizationId: assignment.organizationId,
            },
            newOrganizationId,
          ),
      );
      if (incompatibleAssignments.length > 0) {
        this.logger.warn({
          operation: 'UPDATE_USER_ORGANIZATION',
          actorId: actor.id,
          userId: user.id,
          incompatibleAssignments: incompatibleAssignments.length,
          result: 'DENIED_ACTIVE_ASSIGNMENTS',
        });
        throw new ConflictException({
          code: 'CONFLICT',
          message:
            'Cannot change organization while active role assignments are incompatible; revoke assignments first',
        });
      }
      changes.organization_id = {
        before: user.organizationId,
        after: newOrganizationId,
      };
      user.updateOrganizationId(newOrganizationId);
    }

    if (dto.password !== undefined) {
      const passwordHash = await this.passwordHasher.hash(dto.password);
      user.updatePasswordHash(passwordHash);
      changes.password = { before: '[redacted]', after: '[redacted]' };
    }

    if (Object.keys(changes).length === 0) {
      const roleAssignments = await this.assignments.findActiveByUserId(
        user.id,
      );
      return UserResponseDto.fromDomain(user, roleAssignments);
    }

    const saved = await this.repository.saveWithAudit(user, {
      userId: user.id,
      operation: UserAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: 'UPDATE_USER',
      userId: saved.id,
      result: 'SUCCESS',
    });

    const roleAssignments = await this.assignments.findActiveByUserId(saved.id);
    return UserResponseDto.fromDomain(saved, roleAssignments);
  }
}
