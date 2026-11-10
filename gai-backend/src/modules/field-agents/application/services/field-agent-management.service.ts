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
import { DataSource } from 'typeorm';
import { fieldAgentAuditChanges } from './field-agent-audit';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { UserLifecycleService } from '../../../users/application/services/user-lifecycle.service';
import { RoleType } from '../../../users/domain/enums/role-type.enum';
import { PermissionEntity } from '../../../users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../../../users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../users/infrastructure/persistence/role-permission.entity';
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
import { PermissionScope } from '../../../users/domain/enums/permission-scope.enum';

import { FIELD_ACCESS_PERMISSIONS } from '../../domain/field-access-permissions';

@Injectable()
export class FieldAgentManagementService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: FieldAgentScopeService,
    private readonly users: UserLifecycleService,
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
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
      status: row.status,
      metadata: row.metadata,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      deleted_at: row.deletedAt?.toISOString() ?? null,
      linked_user: user
        ? {
            id: user.id,
            full_name: user.fullName,
            login: user.login,
            email: user.email,
            status: user.status,
          }
        : null,
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
    if (!actor.systemRoles.includes(UserRole.ORG_ADMIN))
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Somente o administrador da organização pode criar acesso por convite.',
      });
    if (row.userId)
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'O inventariante já possui conta. Use o reenvio de convite, se necessário.',
      });
    const orgUser = await this.db.getRepository(RoleEntity).findOneByOrFail({
      key: UserRole.ORG_USER,
      type: RoleType.SYSTEM,
      isActive: true,
    });
    const input = Object.assign(new CreateUserDto(), {
      full_name: row.name,
      email: dto.email,
      login: dto.login,
      activation_method: 'INVITATION',
      role_ids: [orgUser.id],
    });
    if ((await validate(input)).length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Revise nome (mínimo 3 caracteres), login e e-mail antes de criar a conta.',
      });
    return this.users.create(input, actor, async (manager, user) => {
      // create() already holds the access-administration lock. All identity and
      // association changes roll back together if another request linked it.
      const current = await manager.getRepository(FieldAgentEntity).findOne({
        where: { id, organizationId: row.organizationId },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!current || current.userId)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'O cadastro mudou ou já possui conta. Atualize a página.',
        });
      const key = `FIELD_AGENT_ORG_${row.organizationId}`;
      let role = await manager
        .getRepository(RoleEntity)
        .findOneBy({ key, organizationId: row.organizationId });
      if (!role) {
        role = await manager.getRepository(RoleEntity).save({
          key,
          organizationId: row.organizationId,
          type: RoleType.ORGANIZATION,
          name: 'Inventariante de campo',
          description:
            'Coleta somente nos projetos com vínculo ativo e vigente.',
          isActive: true,
        });
        const permissions = (
          await manager.getRepository(PermissionEntity).find()
        ).filter(
          (p) =>
            FIELD_ACCESS_PERMISSIONS.includes(p.key) &&
            p.scope === PermissionScope.ORGANIZATION,
        );
        if (permissions.length !== FIELD_ACCESS_PERMISSIONS.length)
          throw new ConflictException({
            code: 'CONFLICT',
            message:
              'O catálogo de permissões de campo está incompleto. Revise a configuração antes de convidar.',
          });
        for (const permission of permissions)
          await manager
            .getRepository(RolePermissionEntity)
            .save({ roleId: role.id, permissionId: permission.id });
      }
      if (!role.isActive)
        throw new ConflictException({
          code: 'CONFLICT',
          message:
            'O perfil de campo está inativo. Revise os perfis antes de convidar.',
        });
      const grants = await manager
        .getRepository(PermissionEntity)
        .createQueryBuilder('permission')
        .innerJoin(
          RolePermissionEntity,
          'grant',
          'grant.permissionId=permission.id',
        )
        .where('grant.roleId = :id', { id: role.id })
        .getMany();
      // Roles created before Onda 0 hold a smaller subset; they stay valid (no
      // automatic upgrade). Anything outside the least-privilege set is refused.
      if (
        grants.length === 0 ||
        grants.some(
          (p) =>
            !FIELD_ACCESS_PERMISSIONS.includes(p.key) ||
            p.scope !== PermissionScope.ORGANIZATION,
        )
      )
        throw new ConflictException({
          code: 'CONFLICT',
          message:
            'O perfil de campo foi alterado. Revise suas permissões mínimas antes de criar novos acessos.',
        });
      await replaceUserRoles(manager, user.id, [orgUser.id, role.id], actor);
      current.userId = user.id;
      await manager.getRepository(FieldAgentEntity).save(current);
      await manager.getRepository(FieldAgentAuditLogEntity).save({
        fieldAgentId: id,
        organizationId: row.organizationId,
        performedBy: actor.id,
        operation: FieldAgentAuditOperation.INVITE_USER,
        changes: { user_id: { before: null, after: user.id } },
      });
      await manager.getRepository(UserAuditLogEntity).save({
        userId: user.id,
        performedBy: actor.id,
        operation: 'FIELD_ACCESS_PROFILE',
        changes: {
          role_ids: { before: [orgUser.id], after: [orgUser.id, role.id] },
        },
      });
    });
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
}
