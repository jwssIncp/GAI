import {
  BadRequestException,
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
import { AssignUserRoleDto } from '../dto/assign-user-role.dto';
import { RoleAssignmentResponseDto } from '../dto/user-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../../infrastructure/persistence/role.entity';

@Injectable()
export class AssignUserRoleUseCase {
  constructor(
    @Inject(USER_MANAGEMENT_REPOSITORY)
    private readonly users: UserManagementRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    private readonly scope: UserScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AssignUserRoleUseCase.name);
  }

  async execute(
    userId: number,
    dto: AssignUserRoleDto,
    actor: ActorContext,
  ): Promise<RoleAssignmentResponseDto> {
    this.scope.assertCanAssignRoles(actor);

    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    this.scope.assertCanAccessUser(actor, user);

    const role = await this.roleRepo.findOne({ where: { id: dto.role_id } });
    if (!role || !role.isActive) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ field: 'role_id', message: 'Invalid or inactive role' }],
      });
    }

    if (
      role.type === RoleType.SYSTEM &&
      role.key === UserRole.PLATFORM_ADMIN &&
      !actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)
    ) {
      throw new ConflictException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    try {
      this.scope.assertCanAssignRole(actor, user.organizationId, {
        type: role.type,
        key: role.key,
        organizationId: role.organizationId,
      });
    } catch (error) {
      this.logger.warn({
        operation: 'ASSIGN_USER_ROLE',
        actorId: actor.id,
        userId,
        roleId: dto.role_id,
        result: 'DENIED_SCOPE',
      });
      throw error;
    }

    const existing = await this.assignments.findActiveAssignment(
      userId,
      dto.role_id,
    );
    if (existing) {
      return RoleAssignmentResponseDto.fromAssignedRole(existing);
    }

    const saved = await this.assignments.assign({
      userId,
      roleId: dto.role_id,
      assignedBy: actor.id,
    });

    this.logger.info({
      operation: 'ASSIGN_USER_ROLE',
      userId,
      roleId: dto.role_id,
      result: 'SUCCESS',
    });

    return RoleAssignmentResponseDto.fromAssignedRole(saved);
  }
}
