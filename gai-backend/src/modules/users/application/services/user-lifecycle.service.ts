import { identityTransaction } from '../../../auth/infrastructure/persistence/identity-transaction';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, IsNull, QueryFailedError } from 'typeorm';
import {
  CredentialTransactionsService,
  lockUser,
} from '../../../auth/application/services/credential-transactions.service';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../auth/domain/ports/password-hasher.port';
import { UserStatus } from '../../../auth/domain/enums/user.enums';
import { Password } from '../../../auth/domain/value-objects/password';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { SessionEntity } from '../../../auth/infrastructure/persistence/session.entity';
import { PasswordResetTokenEntity } from '../../../auth/infrastructure/persistence/password-reset-token.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { UserAuditLogEntity } from '../../infrastructure/persistence/user-audit-log.entity';
import { UserRoleAssignmentEntity } from '../../infrastructure/persistence/user-role-assignment.entity';
import { replaceUserRoles } from '../../infrastructure/persistence/typeorm-user-role-assignment.repository';
import {
  assertCurrentAccessAdministrator,
  assertActiveAccessOrganization,
  assertAdministratorSurvives,
  lockAccessAdministration,
} from '../../infrastructure/persistence/access-administration-lock';
import { ManagedUser } from '../../domain/entities/managed-user';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../domain/ports/user-role-assignment.repository.port';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { ActorContext, UserScopeService } from './user-scope.service';
import { FieldAgentEntity } from '../../../field-agents/infrastructure/persistence/field-agent.entity';

@Injectable()
export class UserLifecycleService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: UserScopeService,
    private readonly credentials: CredentialTransactionsService,
    private readonly config: ConfigService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
  ) {}

  options() {
    return {
      invitation_available: !this.config.get<boolean>(
        'auth.useMockEmail',
        true,
      ),
      password_min_length: Password.MIN_LENGTH,
      password_max_length: Password.MAX_LENGTH,
      temporary_password_ttl_hours: this.config.get<number>(
        'auth.temporaryPasswordTtlHours',
        24,
      ),
    };
  }

  async create(
    dto: CreateUserDto,
    actor: ActorContext,
    onCreated?: (manager: EntityManager, user: UserEntity) => Promise<void>,
  ) {
    this.scope.assertCanManageUsers(actor);
    const organizationId = this.scope.resolveOrganizationIdForCreate(
      actor,
      dto.organization_id ?? undefined,
    );
    if (
      dto.organization_id !== undefined &&
      dto.organization_id !== organizationId
    )
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Selecione uma organização do seu escopo.',
      });
    const invited = dto.activation_method === 'INVITATION';
    if (invited && dto.password !== undefined)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'O convite permite que o usuário defina sua própria senha.',
      });
    const passwordHash = await this.hasher.hash(
      invited
        ? randomBytes(48).toString('hex')
        : Password.create(dto.password as string).getValue(),
    );
    let token: string | undefined;
    const user = await this.translateConflict(() =>
      identityTransaction(this.db, async (manager) => {
        await lockAccessAdministration(manager);
        await assertCurrentAccessAdministrator(manager, actor);
        await assertActiveAccessOrganization(manager, organizationId);
        const saved = await manager.getRepository(UserEntity).save({
          fullName: dto.full_name,
          login: dto.login,
          email: dto.email,
          phone: dto.phone || null,
          jobTitle: dto.job_title || null,
          organizationId,
          passwordHash,
          status: invited ? UserStatus.PENDING_ACTIVATION : UserStatus.ACTIVE,
          mustChangePassword: !invited,
          temporaryPasswordExpiresAt: invited
            ? null
            : new Date(
                Date.now() +
                  this.options().temporary_password_ttl_hours * 3600000,
              ),
          authVersion: 0,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        });
        await replaceUserRoles(manager, saved.id, dto.role_ids, actor);
        if (invited)
          token = await this.credentials.issueToken(
            manager,
            saved,
            'INVITATION',
          );
        await manager.getRepository(UserAuditLogEntity).save({
          userId: saved.id,
          operation: 'CREATE',
          performedBy: actor.id,
          changes: {
            login: { before: null, after: saved.login },
            email: { before: null, after: saved.email },
            organization_id: { before: null, after: organizationId },
            role_ids: { before: [], after: dto.role_ids },
            activation_method: { before: null, after: dto.activation_method },
          },
        });
        if (onCreated) await onCreated(manager, saved);
        return saved;
      }),
    );
    const delivery = token ? await this.deliver(user, token, actor) : undefined;
    return {
      ...(await this.response(user)),
      ...(delivery ? { invitation_delivery: delivery } : {}),
    };
  }

  async update(id: number, dto: UpdateUserDto, actor: ActorContext) {
    const saved = await this.translateConflict(() =>
      identityTransaction(this.db, async (manager) => {
        await lockAccessAdministration(manager);
        await assertCurrentAccessAdministrator(manager, actor);
        const user = await lockUser(manager, id);
        if (!user)
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'Usuário não encontrado.',
          });
        this.scope.assertCanAccessUser(actor, new ManagedUser(user));
        const changes: Record<string, { before: unknown; after: unknown }> = {};
        if (
          dto.organization_id !== undefined &&
          dto.organization_id !== user.organizationId
        ) {
          this.scope.assertCanChangeUserOrganization(actor);
          const incompatible = await manager
            .getRepository(FieldAgentEntity)
            .createQueryBuilder('agent')
            .withDeleted()
            .where(
              'agent.user_id = :userId AND agent.organization_id <> :organizationId',
              { userId: id, organizationId: dto.organization_id ?? -1 },
            )
            .getExists();
          if (incompatible)
            throw new ConflictException({
              code: 'USER_LINKED_TO_FIELD_AGENT',
              message:
                'Desassocie previamente a conta dos inventariantes da organização anterior, inclusive cadastros excluídos, antes de transferi-la.',
            });
          await assertActiveAccessOrganization(manager, dto.organization_id);
          await assertAdministratorSurvives(manager, user, []);
          if (!dto.role_ids)
            throw new ConflictException({
              code: 'CONFLICT',
              message:
                'Selecione os perfis compatíveis com a nova organização.',
            });
          changes.organization_id = {
            before: user.organizationId,
            after: dto.organization_id,
          };
          user.organizationId = dto.organization_id;
          user.authVersion++;
          await manager
            .getRepository(SessionEntity)
            .update(
              { userId: id, revokedAt: IsNull() },
              { revokedAt: new Date() },
            );
          await manager
            .getRepository(PasswordResetTokenEntity)
            .update({ userId: id, usedAt: IsNull() }, { usedAt: new Date() });
        }
        for (const [field, value] of Object.entries({
          fullName: dto.full_name,
          login: dto.login,
          email: dto.email,
          phone: dto.phone === '' ? null : dto.phone,
          jobTitle: dto.job_title === '' ? null : dto.job_title,
        })) {
          if (
            value !== undefined &&
            user[field as keyof UserEntity] !== value
          ) {
            const key = field as
              | 'fullName'
              | 'login'
              | 'email'
              | 'phone'
              | 'jobTitle';
            changes[field] = { before: user[key], after: value };
            if (key === 'phone' || key === 'jobTitle') user[key] = value;
            else if (value !== null) user[key] = value;
          }
        }
        if (changes.email)
          await manager
            .getRepository(PasswordResetTokenEntity)
            .update({ userId: id, usedAt: IsNull() }, { usedAt: new Date() });
        await manager.getRepository(UserEntity).save(user);
        if (dto.role_ids) {
          const previousRoles = await manager
            .getRepository(UserRoleAssignmentEntity)
            .findBy({ userId: id, isActive: true, revokedAt: IsNull() });
          await replaceUserRoles(manager, id, dto.role_ids, actor);
          changes.role_ids = {
            before: previousRoles.map((role) => Number(role.roleId)),
            after: dto.role_ids,
          };
        }
        if (Object.keys(changes).length)
          await manager.getRepository(UserAuditLogEntity).save({
            userId: id,
            operation: 'UPDATE',
            performedBy: actor.id,
            changes,
          });
        return user;
      }),
    );
    return this.response(saved);
  }

  async resetPassword(id: number, password: string, actor: ActorContext) {
    const hash = await this.hasher.hash(Password.create(password).getValue());
    await identityTransaction(this.db, async (manager) => {
      await lockAccessAdministration(manager);
      await assertCurrentAccessAdministrator(manager, actor);
      const user = await lockUser(manager, id);
      if (!user) throw new NotFoundException();
      this.scope.assertCanAccessUser(actor, new ManagedUser(user));
      if (user.status === UserStatus.PENDING_ACTIVATION)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Reenvie o convite para uma conta pendente.',
        });
      await this.credentials.replacePassword(manager, user, hash, true);
      await manager.getRepository(UserAuditLogEntity).save({
        userId: id,
        performedBy: actor.id,
        operation: 'PASSWORD_RESET',
        changes: { password: { before: '[redacted]', after: '[redacted]' } },
      });
    });
    return {
      message:
        'Senha temporária definida. As sessões foram encerradas; a troca será exigida no próximo acesso.',
    };
  }

  async setStatus(id: number, status: UserStatus, actor: ActorContext) {
    const saved = await identityTransaction(this.db, async (manager) => {
      await lockAccessAdministration(manager);
      await assertCurrentAccessAdministrator(manager, actor);
      const user = await lockUser(manager, id);
      if (!user) throw new NotFoundException();
      this.scope.assertCanAccessUser(actor, new ManagedUser(user));
      if (
        user.status === UserStatus.PENDING_ACTIVATION &&
        status === UserStatus.ACTIVE
      )
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'A ativação depende do convite e da definição de senha.',
        });
      if (status === UserStatus.ACTIVE)
        await assertActiveAccessOrganization(manager, user.organizationId);
      if (status !== UserStatus.ACTIVE)
        await assertAdministratorSurvives(manager, user, []);
      const before = user.status;
      user.status = status;
      user.authVersion++;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await manager.getRepository(UserEntity).save(user);
      await manager
        .getRepository(SessionEntity)
        .update({ userId: id, revokedAt: IsNull() }, { revokedAt: new Date() });
      await manager
        .getRepository(PasswordResetTokenEntity)
        .update({ userId: id, usedAt: IsNull() }, { usedAt: new Date() });
      await manager.getRepository(UserAuditLogEntity).save({
        userId: id,
        operation:
          status === UserStatus.ACTIVE
            ? 'ACTIVATE'
            : status === UserStatus.INACTIVE
              ? 'DEACTIVATE'
              : 'BLOCK',
        performedBy: actor.id,
        changes: { status: { before, after: status } },
      });
      return user;
    });
    return this.response(saved);
  }

  async resend(id: number, actor: ActorContext) {
    const { user, token } = await identityTransaction(
      this.db,
      async (manager) => {
        await lockAccessAdministration(manager);
        await assertCurrentAccessAdministrator(manager, actor);
        const user = await lockUser(manager, id);
        if (!user) throw new NotFoundException();
        this.scope.assertCanAccessUser(actor, new ManagedUser(user));
        if (user.status !== UserStatus.PENDING_ACTIVATION)
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'A conta não está pendente de ativação.',
          });
        await this.credentials.assertEligible(manager, user, true);
        return {
          user,
          token: await this.credentials.issueToken(manager, user, 'INVITATION'),
        };
      },
    );
    return { invitation_delivery: await this.deliver(user, token, actor) };
  }

  private async deliver(user: UserEntity, token: string, actor: ActorContext) {
    let result: 'SENT' | 'FAILED' | 'DEVELOPMENT' = this.options()
      .invitation_available
      ? 'SENT'
      : 'DEVELOPMENT';
    try {
      await this.credentials.sendInvitation(user.email, token);
    } catch {
      result = 'FAILED';
    }
    await this.db.getRepository(UserAuditLogEntity).save({
      userId: user.id,
      performedBy: actor.id,
      operation: 'INVITATION_DISPATCH',
      changes: { delivery: { before: null, after: result } },
    });
    return result;
  }
  private async response(user: UserEntity) {
    const organization =
      user.organizationId === null
        ? null
        : await this.db
            .getRepository(OrganizationEntity)
            .findOneBy({ id: user.organizationId });
    return {
      ...UserResponseDto.fromDomain(
        new ManagedUser(user),
        await this.assignments.findActiveByUserId(user.id),
      ),
      organization_name:
        organization?.tradeName || organization?.legalName || null,
    };
  }
  private async translateConflict<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const driver =
        error instanceof QueryFailedError
          ? (error.driverError as { code?: string; errno?: number })
          : null;
      if (
        driver &&
        (driver.code === 'ER_DUP_ENTRY' ||
          (driver.code === 'SQLITE_CONSTRAINT' &&
            /UNIQUE constraint/i.test((error as Error).message)))
      )
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Login ou e-mail já cadastrado.',
        });
      throw error;
    }
  }
}
