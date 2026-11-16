import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { CreateUserDto } from '../../../users/application/dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { fieldAgentAuditChanges } from './field-agent-audit';
import { UserRole, UserStatus } from '../../../auth/domain/enums/user.enums';
import {
  lockUser,
  CredentialTransactionsService,
} from '../../../auth/application/services/credential-transactions.service';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../auth/domain/ports/password-hasher.port';
import { identityTransaction } from '../../../auth/infrastructure/persistence/identity-transaction';
import {
  assertActiveAccessOrganization,
  assertCurrentAccessAdministrator,
  lockAccessAdministration,
} from '../../../users/infrastructure/persistence/access-administration-lock';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { UserLifecycleService } from '../../../users/application/services/user-lifecycle.service';
import { RoleType } from '../../../users/domain/enums/role-type.enum';
import { RoleEntity } from '../../../users/infrastructure/persistence/role.entity';
import { UserAuditLogEntity } from '../../../users/infrastructure/persistence/user-audit-log.entity';
import { replaceUserRoles } from '../../../users/infrastructure/persistence/typeorm-user-role-assignment.repository';
import { FieldAgent } from '../../domain/entities/field-agent';
import { FieldAgentAuditOperation } from '../../domain/enums/field-agent-audit-operation.enum';
import { FieldAgentStatus } from '../../domain/enums/field-agent-status.enum';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import { FieldAgentEntity } from '../../infrastructure/persistence/field-agent.entity';
import { FieldAgentAuditLogEntity } from '../../infrastructure/persistence/field-agent-audit-log.entity';
import { ProjectFieldAgentEntity } from '../../infrastructure/persistence/project-field-agent.entity';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from './field-agent-scope.service';
import {
  assertFieldOnlyAccount,
  ensureFieldRole,
  fieldAgentAccess,
  generateTemporaryPassword,
  revokeMobileRefreshTokens,
} from './field-agent-access';

@Injectable()
export class FieldAgentManagementService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: FieldAgentScopeService,
    private readonly users: UserLifecycleService,
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    private readonly credentials: CredentialTransactionsService,
    private readonly config: ConfigService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  private async agent(
    id: number,
    actor: FieldAgentActorContext,
    deleted = false,
  ) {
    const organizationId = this.scope.resolveOrganizationForCreate(actor);
    const row = await this.db
      .getRepository(FieldAgentEntity)
      .findOne({ where: { id, organizationId }, withDeleted: deleted });
    if (!row)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventariante não encontrado nesta organização.',
      });
    return row;
  }
  async context(actor: FieldAgentActorContext) {
    const organizationId = this.scope.resolveOrganizationForCreate(actor);
    const org = await this.db
      .getRepository(OrganizationEntity)
      .findOneByOrFail({ id: organizationId });
    return {
      organization_id: organizationId,
      organization_name: org.tradeName || org.legalName,
    };
  }
  async detail(
    id: number,
    actor: FieldAgentActorContext,
    includeDeleted = false,
  ) {
    const row = await this.agent(id, actor, includeDeleted);
    const org = await this.db
      .getRepository(OrganizationEntity)
      .findOneByOrFail({ id: row.organizationId });
    const user = row.userId
      ? await this.db
          .getRepository(UserEntity)
          .findOneBy({ id: row.userId, organizationId: row.organizationId })
      : null;
    return {
      id: row.id,
      organization_id: row.organizationId,
      organization_name: org.tradeName || org.legalName,
      user_id: row.userId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      document: row.document,
      state: row.state ?? null,
      status: row.status,
      metadata: row.metadata,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      deleted_at: row.deletedAt?.toISOString() ?? null,
      linked_user: user ? this.linkedUser(user) : null,
      access: fieldAgentAccess(user),
    };
  }
  async userOptions(
    query: {
      page?: number;
      page_size?: number;
      search?: string;
      current_agent_id?: number;
    },
    actor: FieldAgentActorContext,
  ) {
    const organizationId = this.scope.resolveOrganizationForCreate(actor);
    const qb = this.db
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .where('u.organizationId=:org', { org: organizationId })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM user_role_assignments a JOIN roles r ON r.id=a.role_id WHERE a.user_id=u.id AND a.is_active=1 AND a.revoked_at IS NULL AND r.`key`=:platform AND r.is_active=1)',
        { platform: UserRole.PLATFORM_ADMIN },
      )
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM field_agents f WHERE f.user_id=u.id AND f.deleted_at IS NULL AND f.id<>:current)',
        { current: query.current_agent_id ?? 0 },
      );
    if (query.search)
      qb.andWhere(
        '(LOWER(u.fullName) LIKE :q OR LOWER(u.login) LIKE :q OR LOWER(u.email) LIKE :q)',
        { q: `%${query.search.toLowerCase()}%` },
      );
    const page = query.page ?? 1,
      size = query.page_size ?? 20;
    const [rows, total] = await qb
      .select(['u.id', 'u.fullName', 'u.login', 'u.email', 'u.status'])
      .orderBy('u.fullName', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();
    return {
      items: rows.map((u) => ({
        id: u.id,
        full_name: u.fullName,
        login: u.login,
        email: u.email,
        status: u.status,
      })),
      page,
      page_size: size,
      total_items: total,
      total_pages: Math.ceil(total / size),
    };
  }
  async projects(
    id: number,
    query: { page?: number; page_size?: number },
    actor: FieldAgentActorContext,
  ) {
    const row = await this.agent(id, actor, true);
    const page = query.page ?? 1,
      size = query.page_size ?? 20;
    const qb = this.db
      .getRepository(ProjectFieldAgentEntity)
      .createQueryBuilder('a')
      .where('a.fieldAgentId=:id AND a.organizationId=:org', {
        id,
        org: row.organizationId,
      });
    const [rows, total] = await qb
      .orderBy('a.id', 'DESC')
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();
    const items = await Promise.all(
      rows.map(async (a) => ({
        id: a.id,
        project_id: a.projectId,
        project_name:
          (
            await this.db.getRepository(ProjectEntity).findOne({
              where: { id: a.projectId, organizationId: row.organizationId },
              withDeleted: true,
            })
          )?.name ?? 'Projeto indisponível',
        role: a.role,
        status: a.status,
        start_date: a.startDate?.toISOString().slice(0, 10) ?? null,
        end_date: a.endDate?.toISOString().slice(0, 10) ?? null,
      })),
    );
    return {
      items,
      page,
      page_size: size,
      total_items: total,
      total_pages: Math.ceil(total / size),
    };
  }
  async history(
    id: number,
    query: { page?: number; page_size?: number },
    actor: FieldAgentActorContext,
  ) {
    const row = await this.agent(id, actor, true);
    const page = query.page ?? 1,
      size = query.page_size ?? 20;
    const [rows, total] = await this.db
      .getRepository(FieldAgentAuditLogEntity)
      .findAndCount({
        where: { organizationId: row.organizationId, fieldAgentId: id },
        order: { id: 'DESC' },
        skip: (page - 1) * size,
        take: size,
      });
    const items = await Promise.all(
      rows.map(async (a) => ({
        id: a.id,
        operation: a.operation,
        created_at: a.createdAt.toISOString(),
        performed_by_name: a.performedBy
          ? ((
              await this.db
                .getRepository(UserEntity)
                .findOneBy({ id: a.performedBy })
            )?.fullName ?? 'Usuário')
          : 'Sistema',
        changes: fieldAgentAuditChanges(a.changes),
      })),
    );
    return {
      items,
      page,
      page_size: size,
      total_items: total,
      total_pages: Math.ceil(total / size),
    };
  }
  async restore(id: number, actor: FieldAgentActorContext) {
    const row = await this.agent(id, actor, true);
    if (!row.deletedAt)
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'O cadastro não está excluído.',
      });
    const restored = new FieldAgent({
      ...row,
      id: Number(row.id),
      organizationId: Number(row.organizationId),
      userId: row.userId === null ? null : Number(row.userId),
      deletedAt: null,
      status: FieldAgentStatus.INACTIVE,
    });
    await this.repository.saveFieldAgentWithAudit(restored, {
      fieldAgentId: id,
      organizationId: row.organizationId,
      performedBy: actor.id,
      operation: FieldAgentAuditOperation.RESTORE,
      changes: {
        deleted_at: { before: row.deletedAt, after: null },
        status: { before: row.status, after: FieldAgentStatus.INACTIVE },
      },
    });
    return this.detail(id, actor);
  }
  async invite(
    id: number,
    dto: { login: string; email: string },
    actor: FieldAgentActorContext,
  ) {
    const row = await this.agent(id, actor);
    this.assertOrganizationAdmin(actor, 'criar acesso por convite');
    if (row.userId)
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'O inventariante já possui conta. Use o reenvio de convite, se necessário.',
      });
    const input = await this.accountInput(row, dto, 'INVITATION');
    return this.users.create(input.dto, actor, (manager, user) =>
      this.linkFieldAccount(manager, {
        agentId: id,
        organizationId: row.organizationId,
        user,
        orgUserId: input.orgUserId,
        actor,
        operation: FieldAgentAuditOperation.INVITE_USER,
      }),
    );
  }

  /**
   * Cria a conta do inventariante com senha temporária GERADA pelo sistema.
   * A senha volta só nesta resposta; nunca é gravada em log ou auditoria.
   */
  async createTemporaryAccess(
    id: number,
    dto: { login: string; email?: string | null },
    actor: FieldAgentActorContext,
  ) {
    const row = await this.agent(id, actor);
    this.assertOrganizationAdmin(actor, 'criar acesso com senha temporária');
    if (row.userId)
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'O inventariante já possui conta. Use Redefinir senha temporária.',
      });
    const password = this.generatePassword();
    const input = await this.accountInput(
      row,
      { login: dto.login, email: dto.email || undefined },
      'TEMPORARY_PASSWORD',
      password,
    );
    const created = await this.users.create(
      input.dto,
      actor,
      async (manager, user) => {
        await this.linkFieldAccount(manager, {
          agentId: id,
          organizationId: row.organizationId,
          user,
          orgUserId: input.orgUserId,
          actor,
          operation: FieldAgentAuditOperation.TEMPORARY_ACCESS_CREATED,
        });
        await this.auditTemporaryPassword(manager, user.id, actor, null);
      },
      { temporaryPasswordTtlHours: this.temporaryTtlHours() },
    );
    const user = await this.db
      .getRepository(UserEntity)
      .findOneByOrFail({ id: created.id });
    return this.issued(id, user, password);
  }

  /**
   * Nova senha temporária (mostrada uma vez). Encerra sessões web e do app,
   * refresh tokens e convite pendente; conta revogada ou com convite pendente
   * volta a ACTIVE com troca obrigatória no 1º acesso.
   */
  async resetTemporaryAccess(id: number, actor: FieldAgentActorContext) {
    this.assertOrganizationAdmin(actor, 'redefinir a senha temporária');
    const password = this.generatePassword();
    const hash = await this.hasher.hash(password);
    const user = await this.withFieldAccount(
      id,
      actor,
      async (manager, user, organizationId) => {
        if (user.status === UserStatus.BLOCKED)
          throw new ConflictException({
            code: 'CONFLICT',
            message:
              'A conta está bloqueada na gestão de usuários. Desbloqueie-a antes de redefinir a senha.',
          });
        await assertActiveAccessOrganization(manager, organizationId);
        // A conta volta a ter acesso: o perfil de campo precisa continuar
        // íntegro (permissões mínimas), como no convite.
        await ensureFieldRole(manager, organizationId);
        const before = user.status;
        user.status = UserStatus.ACTIVE;
        await this.credentials.replacePassword(
          manager,
          user,
          hash,
          true,
          this.temporaryTtlHours(),
        );
        await revokeMobileRefreshTokens(
          manager,
          user.id,
          new Date(),
          'temporary_password_reset',
        );
        await this.auditTemporaryPassword(manager, user.id, actor, {
          before,
          after: user.status,
        });
        await manager.getRepository(FieldAgentAuditLogEntity).save({
          fieldAgentId: id,
          organizationId,
          performedBy: actor.id,
          operation: FieldAgentAuditOperation.TEMPORARY_PASSWORD_RESET,
          changes: {},
        });
        return user;
      },
    );
    return this.issued(id, user, password);
  }

  /**
   * Revoga o acesso: a senha vira um hash aleatório (ninguém a conhece), a
   * conta fica INACTIVE (o login e o refresh do app já recusam) e sessões,
   * refresh tokens e convite pendente são encerrados. Só uma nova redefinição
   * devolve o acesso.
   */
  async revokeAccess(id: number, actor: FieldAgentActorContext) {
    this.assertOrganizationAdmin(actor, 'revogar o acesso');
    const hash = await this.hasher.hash(randomBytes(48).toString('hex'));
    const user = await this.withFieldAccount(
      id,
      actor,
      async (manager, user, organizationId) => {
        if (user.status === UserStatus.BLOCKED)
          throw new ConflictException({
            code: 'CONFLICT',
            message:
              'A conta já está bloqueada na gestão de usuários e não tem acesso.',
          });
        const before = user.status;
        user.status = UserStatus.INACTIVE;
        await this.credentials.replacePassword(manager, user, hash, false);
        await revokeMobileRefreshTokens(
          manager,
          user.id,
          new Date(),
          'field_access_revoked',
        );
        await manager.getRepository(UserAuditLogEntity).save({
          userId: user.id,
          performedBy: actor.id,
          operation: 'FIELD_ACCESS_REVOKED',
          changes: {
            password: { before: '[redacted]', after: '[redacted]' },
            ...(before !== user.status
              ? { status: { before, after: user.status } }
              : {}),
          },
        });
        await manager.getRepository(FieldAgentAuditLogEntity).save({
          fieldAgentId: id,
          organizationId,
          performedBy: actor.id,
          operation: FieldAgentAuditOperation.ACCESS_REVOKED,
          changes: {},
        });
        return user;
      },
    );
    return {
      field_agent_id: id,
      linked_user: this.linkedUser(user),
      access: fieldAgentAccess(user),
    };
  }

  async resend(id: number, actor: FieldAgentActorContext) {
    const row = await this.agent(id, actor);
    if (!row.userId)
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Este inventariante não possui conta.',
      });
    return this.users.resend(row.userId, actor);
  }

  private assertOrganizationAdmin(
    actor: FieldAgentActorContext,
    action: string,
  ) {
    if (!actor.systemRoles.includes(UserRole.ORG_ADMIN))
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Somente o administrador da organização pode ${action}.`,
      });
  }

  /** Dados da conta, validados como no cadastro de usuários. */
  private async accountInput(
    row: FieldAgentEntity,
    dto: { login: string; email?: string },
    method: 'INVITATION' | 'TEMPORARY_PASSWORD',
    password?: string,
  ) {
    const orgUser = await this.db.getRepository(RoleEntity).findOneByOrFail({
      key: UserRole.ORG_USER,
      type: RoleType.SYSTEM,
      isActive: true,
    });
    const input = Object.assign(new CreateUserDto(), {
      full_name: row.name,
      email: dto.email,
      login: dto.login,
      activation_method: method,
      role_ids: [orgUser.id],
      ...(password ? { password } : {}),
    });
    // E-mail opcional só na conta de inventariante com senha temporária.
    const emailOptional = method === 'TEMPORARY_PASSWORD' && !dto.email;
    const errors = (await validate(input)).filter(
      (error) => !(emailOptional && error.property === 'email'),
    );
    if (errors.length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: emailOptional
          ? 'Revise nome (mínimo 3 caracteres) e login antes de criar a conta.'
          : 'Revise nome (mínimo 3 caracteres), login e e-mail antes de criar a conta.',
      });
    return { dto: input, orgUserId: orgUser.id };
  }

  /**
   * Liga a conta recém-criada ao inventariante com o perfil de campo mínimo.
   * Roda dentro da transação de UserLifecycleService.create (que já segura o
   * lock de administração de acesso): tudo volta junto se outro pedido ligou
   * uma conta antes.
   */
  private async linkFieldAccount(
    manager: EntityManager,
    input: {
      agentId: number;
      organizationId: number;
      user: UserEntity;
      orgUserId: number;
      actor: FieldAgentActorContext;
      operation: FieldAgentAuditOperation;
    },
  ) {
    const { agentId, organizationId, user, orgUserId, actor } = input;
    const current = await manager.getRepository(FieldAgentEntity).findOne({
      where: { id: agentId, organizationId },
      ...this.lock(manager),
    });
    if (!current || current.userId)
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'O cadastro mudou ou já possui conta. Atualize a página.',
      });
    const role = await ensureFieldRole(manager, organizationId);
    await replaceUserRoles(manager, user.id, [orgUserId, role.id], actor);
    current.userId = user.id;
    await manager.getRepository(FieldAgentEntity).save(current);
    await manager.getRepository(FieldAgentAuditLogEntity).save({
      fieldAgentId: agentId,
      organizationId,
      performedBy: actor.id,
      operation: input.operation,
      changes: { user_id: { before: null, after: user.id } },
    });
    await manager.getRepository(UserAuditLogEntity).save({
      userId: user.id,
      performedBy: actor.id,
      operation: 'FIELD_ACCESS_PROFILE',
      changes: {
        role_ids: { before: [orgUserId], after: [orgUserId, role.id] },
      },
    });
  }

  /** Conta do inventariante travada, com as checagens de escopo e de perfil. */
  private async withFieldAccount<T>(
    id: number,
    actor: FieldAgentActorContext,
    work: (
      manager: EntityManager,
      user: UserEntity,
      organizationId: number,
    ) => Promise<T>,
  ): Promise<T> {
    const row = await this.agent(id, actor);
    if (!row.userId)
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'Este inventariante não possui conta. Crie o acesso antes de redefinir ou revogar.',
      });
    const userId = Number(row.userId);
    const organizationId = Number(row.organizationId);
    return identityTransaction(this.db, async (manager) => {
      await lockAccessAdministration(manager);
      await assertCurrentAccessAdministrator(manager, actor);
      const current = await manager.getRepository(FieldAgentEntity).findOne({
        where: { id, organizationId },
        ...this.lock(manager),
      });
      const user = await lockUser(manager, userId);
      if (
        !current ||
        Number(current.userId) !== userId ||
        !user ||
        Number(user.organizationId) !== organizationId
      )
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'O cadastro mudou. Atualize a página.',
        });
      await assertFieldOnlyAccount(manager, user.id, organizationId);
      return work(manager, user, organizationId);
    });
  }

  private auditTemporaryPassword(
    manager: EntityManager,
    userId: number,
    actor: FieldAgentActorContext,
    status: { before: unknown; after: unknown } | null,
  ) {
    // Só o fato; o valor da senha nunca entra na auditoria.
    return manager.getRepository(UserAuditLogEntity).save({
      userId,
      performedBy: actor.id,
      operation: 'TEMPORARY_PASSWORD_ISSUED',
      changes: {
        password: { before: '[redacted]', after: '[redacted]' },
        ...(status && status.before !== status.after ? { status } : {}),
      },
    });
  }

  /** Resposta de emissão: a senha aparece aqui e em nenhum outro lugar. */
  private issued(id: number, user: UserEntity, password: string) {
    return {
      field_agent_id: id,
      linked_user: this.linkedUser(user),
      access: fieldAgentAccess(user),
      temporary_password_expires_at:
        user.temporaryPasswordExpiresAt?.toISOString() ?? null,
      temporary_password: password,
    };
  }

  private linkedUser(user: UserEntity) {
    return {
      id: user.id,
      full_name: user.fullName,
      login: user.login,
      email: user.email,
      status: user.status,
    };
  }

  private generatePassword() {
    return generateTemporaryPassword(
      this.config.get<number>('auth.fieldAgentTemporaryPasswordLength', 12),
    );
  }

  /** null = sem expiração (padrão). */
  private temporaryTtlHours(): number | null {
    const hours = this.config.get<number>(
      'auth.fieldAgentTemporaryPasswordTtlHours',
      0,
    );
    return Number.isFinite(hours) && hours > 0 ? hours : null;
  }

  private lock(manager: EntityManager) {
    return manager.connection.options.type === 'mysql'
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {};
  }
}
