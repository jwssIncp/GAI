import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UserStatus } from '../../../auth/domain/enums/user.enums';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../auth/domain/ports/password-hasher.port';
import { ManagedUser } from '../../domain/entities/managed-user';
import { UserAuditOperation } from '../../domain/enums/user-audit-operation.enum';
import {
  USER_MANAGEMENT_REPOSITORY,
  type UserManagementRepository,
} from '../../domain/ports/user-management.repository.port';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_MANAGEMENT_REPOSITORY)
    private readonly repository: UserManagementRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly scope: UserScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateUserUseCase.name);
  }

  async execute(
    dto: CreateUserDto,
    actor: ActorContext,
  ): Promise<UserResponseDto> {
    this.scope.assertCanManageUsers(actor);
    const organizationId = this.scope.resolveOrganizationIdForCreate(
      actor,
      dto.organization_id,
    );
    this.scope.assertPlatformOnlyAssignment(actor, organizationId);

    const existingLogin = await this.repository.findByLogin(dto.login.trim());
    if (existingLogin) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Login or email already exists',
      });
    }

    const existingEmail = await this.repository.findByEmail(
      dto.email.trim().toLowerCase(),
    );
    if (existingEmail) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Login or email already exists',
      });
    }

    const now = new Date();
    const passwordHash = await this.passwordHasher.hash(dto.password);
    const user = new ManagedUser({
      id: 0,
      organizationId,
      login: dto.login.trim(),
      email: dto.email.trim().toLowerCase(),
      passwordHash,
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.repository.saveWithAudit(user, {
      userId: 0,
      operation: UserAuditOperation.CREATE,
      performedBy: actor.id,
      changes: {
        login: { before: null, after: user.login },
        email: { before: null, after: user.email },
        organization_id: { before: null, after: organizationId },
      },
    });

    this.logger.info({
      operation: 'CREATE_USER',
      userId: saved.id,
      result: 'SUCCESS',
    });

    return UserResponseDto.fromDomain(saved);
  }
}
