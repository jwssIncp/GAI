import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import { fieldAgentAuditChanges } from '../../application/services/field-agent-audit';
import { lockAccessAdministration } from '../../../users/infrastructure/persistence/access-administration-lock';
import { lockUser } from '../../../auth/application/services/credential-transactions.service';
import { identityTransaction } from '../../../auth/infrastructure/persistence/identity-transaction';
import { RoleEntity } from '../../../users/infrastructure/persistence/role.entity';
import { UserRoleAssignmentEntity } from '../../../users/infrastructure/persistence/user-role-assignment.entity';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import {
  assertAssignmentPeriod,
  requireOperationalAgent,
} from '../../application/services/operational-eligibility';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { ProjectStatusTransitionPolicy } from '../../../projects/domain/services/project-status-transition.policy';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { ProjectStatusBlocksFieldAgentOperationError } from '../../application/errors/project-status-blocks-operation';
import { FieldAgent } from '../../domain/entities/field-agent';
import { ProjectFieldAgent } from '../../domain/entities/project-field-agent';
import { FieldAgentAuditOperation } from '../../domain/enums/field-agent-audit-operation.enum';
import { ProjectFieldAgentStatus } from '../../domain/enums/project-field-agent-status.enum';
import {
  FieldAgentAuditEntry,
  FieldAgentRepository,
  ListFieldAgentsParams,
  ListProjectFieldAgentsParams,
} from '../../domain/ports/field-agent.repository.port';
import { FieldAgentAuditLogEntity } from './field-agent-audit-log.entity';
import { FieldAgentEntity } from './field-agent.entity';
import { ProjectFieldAgentEntity } from './project-field-agent.entity';
import { ActiveAssignmentExistsError } from '../../application/errors/field-agent-conflict';

@Injectable()
export class TypeOrmFieldAgentRepository implements FieldAgentRepository {
  constructor(
    @InjectRepository(FieldAgentEntity)
    private readonly fieldAgentRepo: Repository<FieldAgentEntity>,
    @InjectRepository(ProjectFieldAgentEntity)
    private readonly assignmentRepo: Repository<ProjectFieldAgentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findById(id: number): Promise<FieldAgent | null> {
    const entity = await this.fieldAgentRepo.findOne({ where: { id } });
    return entity ? this.toFieldAgentDomain(entity) : null;
  }

  async findLinkedToUser(
    userId: number,
    organizationId: number,
  ): Promise<FieldAgent | null> {
    const entity = await this.fieldAgentRepo.findOne({
      where: { userId, organizationId },
      withDeleted: true,
      order: { deletedAt: 'ASC', id: 'DESC' },
    });
    return entity ? this.toFieldAgentDomain(entity) : null;
  }

  async findAssignmentById(id: number): Promise<ProjectFieldAgent | null> {
    const entity = await this.assignmentRepo.findOne({ where: { id } });
    return entity ? this.toAssignmentDomain(entity) : null;
  }

  async findUserOrganizationId(
    userId: number,
  ): Promise<number | null | undefined> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user ? user.organizationId : undefined;
  }

  async hasActiveAssignment(
    organizationId: number,
    projectId: number,
    fieldAgentId: number,
    excludeAssignmentId?: number,
  ): Promise<boolean> {
    const count = await this.assignmentRepo.count({
      where: {
        organizationId,
        projectId,
        fieldAgentId,
        status: ProjectFieldAgentStatus.ACTIVE,
        ...(excludeAssignmentId ? { id: Not(excludeAssignmentId) } : {}),
      },
    });
    return count > 0;
  }

  async findConflict(
    organizationId: number,
    values: { email?: string | null; document?: string | null },
    excludeFieldAgentId?: number,
  ): Promise<'email' | 'document' | null> {
    const id = excludeFieldAgentId ? Not(excludeFieldAgentId) : undefined;
    if (
      values.email &&
      (await this.fieldAgentRepo.exists({
        withDeleted: true,
        where: { organizationId, email: values.email, ...(id ? { id } : {}) },
      }))
    )
      return 'email';
    if (
      values.document &&
      (await this.fieldAgentRepo.exists({
        withDeleted: true,
        where: {
          organizationId,
          document: values.document,
          ...(id ? { id } : {}),
        },
      }))
    )
      return 'document';
    return null;
  }

  async list(
    params: ListFieldAgentsParams,
  ): Promise<{ items: FieldAgent[]; total: number }> {
    const qb = this.fieldAgentRepo.createQueryBuilder('fieldAgent');

    if (params.organizationId) {
      qb.andWhere('fieldAgent.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.status) {
      qb.andWhere('fieldAgent.status = :status', { status: params.status });
    }
    if (params.search) {
      const digits = params.search.replace(/\D/g, '');
      qb.andWhere(
        "(LOWER(fieldAgent.name) LIKE :term OR LOWER(fieldAgent.email) LIKE :term OR fieldAgent.document LIKE :term OR fieldAgent.phone LIKE :term OR (:digits <> '' AND (fieldAgent.document LIKE :numeric OR fieldAgent.phone LIKE :numeric)))",
        {
          term: `%${params.search.toLowerCase()}%`,
          digits,
          numeric: `%${digits}%`,
        },
      );
    }
    if (params.deleted)
      qb.withDeleted().andWhere('fieldAgent.deletedAt IS NOT NULL');
    if (params.excludeProjectId)
      qb.andWhere(
        'NOT EXISTS (SELECT 1 FROM project_field_agents link WHERE link.field_agent_id=fieldAgent.id AND link.project_id=:excludeProjectId AND link.organization_id=fieldAgent.organization_id AND link.status=:active)',
        { excludeProjectId: params.excludeProjectId, active: 'active' },
      );
    qb.orderBy('fieldAgent.name', 'ASC').addOrderBy('fieldAgent.id', 'ASC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return {
      items: entities.map((entity) => this.toFieldAgentDomain(entity)),
      total,
    };
  }

  async listAssignments(
    params: ListProjectFieldAgentsParams,
  ): Promise<{ items: ProjectFieldAgent[]; total: number }> {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .withDeleted();
    if (params.organizationId)
      qb.andWhere('assignment.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    if (params.search) {
      qb.innerJoin(
        FieldAgentEntity,
        'agent',
        'agent.id=assignment.fieldAgentId',
      );
      qb.andWhere(
        '(LOWER(agent.name) LIKE :search OR LOWER(agent.email) LIKE :search)',
        { search: `%${params.search.toLowerCase()}%` },
      );
    }
    qb.andWhere('assignment.projectId = :projectId', {
      projectId: params.projectId,
    });
    if (params.status) {
      qb.andWhere('assignment.status = :status', { status: params.status });
    }
    qb.orderBy('assignment.createdAt', 'DESC').addOrderBy(
      'assignment.id',
      'DESC',
    );
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return {
      items: entities.map((entity) => this.toAssignmentDomain(entity)),
      total,
    };
  }

  async saveFieldAgentWithAudit(
    fieldAgent: FieldAgent,
    audit: FieldAgentAuditEntry,
  ): Promise<FieldAgent> {
    const db = this.fieldAgentRepo.manager.connection;
    return identityTransaction(db, async (manager) => {
      // Same access/user locks as organization transfer; no cross-tenant link can
      // be created between its preflight and commit.
      await lockAccessAdministration(manager);
      if (fieldAgent.userId !== null) {
        const user = await lockUser(manager, fieldAgent.userId);
        const platform =
          user &&
          (await manager
            .getRepository(UserRoleAssignmentEntity)
            .createQueryBuilder('a')
            .innerJoin(RoleEntity, 'r', 'r.id=a.roleId')
            .where(
              'a.userId=:id AND a.isActive=:active AND a.revokedAt IS NULL AND r.key=:key AND r.isActive=:active',
              { id: user.id, active: true, key: UserRole.PLATFORM_ADMIN },
            )
            .getExists());
        if (
          !user ||
          user.organizationId !== fieldAgent.organizationId ||
          platform
        )
          throw new ConflictException({
            code: 'CONFLICT',
            message:
              'Selecione uma conta da mesma organização, sem perfil de plataforma.',
          });
        const duplicate = await manager.getRepository(FieldAgentEntity).exists({
          where: {
            userId: user.id,
            ...(fieldAgent.id ? { id: Not(fieldAgent.id) } : {}),
          },
        });
        if (duplicate)
          throw new ConflictException({
            code: 'CONFLICT',
            message:
              'Esta conta já está associada a outro inventariante não excluído.',
          });
      }
      const repo = manager.getRepository(FieldAgentEntity);
      const auditRepo = manager.getRepository(FieldAgentAuditLogEntity);
      let entity = this.toFieldAgentEntity(fieldAgent);
      if (fieldAgent.id > 0) {
        const current = await repo.findOne({
          where: {
            id: fieldAgent.id,
            organizationId: fieldAgent.organizationId,
          },
          withDeleted: true,
          ...(manager.connection.options.type === 'mysql'
            ? { lock: { mode: 'pessimistic_write' as const } }
            : {}),
        });
        if (
          !current ||
          (current.deletedAt &&
            audit.operation !== FieldAgentAuditOperation.RESTORE)
        )
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'O cadastro mudou. Atualize a página.',
          });
        const keys: Record<string, keyof FieldAgentEntity> = {
          user_id: 'userId',
          deleted_at: 'deletedAt',
        };
        for (const [key, change] of Object.entries(audit.changes)) {
          const property = keys[key] ?? (key as keyof FieldAgentEntity);
          if (
            JSON.stringify(current[property]) !== JSON.stringify(change.before)
          )
            throw new ConflictException({
              code: 'CONCURRENT_MODIFICATION',
              message:
                'O cadastro foi alterado por outro operador. Atualize a página.',
            });
        }
        // Preserve unrelated concurrent fields rather than saving a stale row.
        entity = Object.assign(
          current,
          Object.fromEntries(
            Object.keys(audit.changes).map((key) => {
              const property = keys[key] ?? key;
              return [
                property,
                (entity as unknown as Record<string, unknown>)[property],
              ];
            }),
          ),
        );
      }
      const saved = await repo.save(entity);

      await auditRepo.save({
        organizationId: audit.organizationId,
        fieldAgentId: audit.fieldAgentId || saved.id,
        projectFieldAgentId: audit.projectFieldAgentId ?? null,
        projectId: audit.projectId ?? null,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: fieldAgentAuditChanges(audit.changes),
      });

      return this.toFieldAgentDomain(saved);
    });
  }

  async saveAssignmentWithAudit(
    assignment: ProjectFieldAgent,
    audit: FieldAgentAuditEntry,
  ): Promise<ProjectFieldAgent> {
    return this.assignmentRepo.manager.transaction(async (manager) => {
      await this.lockOperationalProject(
        manager,
        assignment.organizationId,
        assignment.projectId,
      );
      const repo = manager.getRepository(ProjectFieldAgentEntity);
      const auditRepo = manager.getRepository(FieldAgentAuditLogEntity);
      const current = await repo.findOne({
        where: {
          id: assignment.id,
          organizationId: assignment.organizationId,
          projectId: assignment.projectId,
        },
        ...(manager.connection.options.type === 'mysql'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (
        !current ||
        current.updatedAt.getTime() !== assignment.toProps().updatedAt.getTime()
      )
        throw new ConflictException({
          code: 'CONCURRENT_MODIFICATION',
          message: 'O vínculo mudou. Atualize a página.',
        });
      const saved = await repo.save(this.toAssignmentEntity(assignment));

      await auditRepo.save({
        organizationId: audit.organizationId,
        fieldAgentId: audit.fieldAgentId,
        projectFieldAgentId: audit.projectFieldAgentId || saved.id,
        projectId: audit.projectId ?? saved.projectId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: fieldAgentAuditChanges(audit.changes),
      });

      return this.toAssignmentDomain(saved);
    });
  }

  async saveAssignmentEnsuringUniqueActive(
    assignment: ProjectFieldAgent,
    audit: FieldAgentAuditEntry,
  ): Promise<ProjectFieldAgent> {
    return this.assignmentRepo.manager.transaction(async (manager) => {
      await this.lockOperationalProject(
        manager,
        assignment.organizationId,
        assignment.projectId,
      );
      if (assignment.status === ProjectFieldAgentStatus.ACTIVE) {
        await requireOperationalAgent(
          manager,
          assignment.organizationId,
          assignment.fieldAgentId,
        );
        assertAssignmentPeriod(assignment.startDate, assignment.endDate);
        const assignmentRepo = manager.getRepository(ProjectFieldAgentEntity);
        const duplicate = await assignmentRepo.count({
          where: {
            organizationId: assignment.organizationId,
            projectId: assignment.projectId,
            fieldAgentId: assignment.fieldAgentId,
            status: ProjectFieldAgentStatus.ACTIVE,
            ...(assignment.id > 0 ? { id: Not(assignment.id) } : {}),
          },
        });
        if (duplicate > 0) throw new ActiveAssignmentExistsError();
      }

      const repo = manager.getRepository(ProjectFieldAgentEntity);
      const auditRepo = manager.getRepository(FieldAgentAuditLogEntity);
      if (assignment.id) {
        const current = await repo.findOne({
          where: {
            id: assignment.id,
            organizationId: assignment.organizationId,
            projectId: assignment.projectId,
          },
          ...(manager.connection.options.type === 'mysql'
            ? { lock: { mode: 'pessimistic_write' as const } }
            : {}),
        });
        if (
          !current ||
          current.updatedAt.getTime() !==
            assignment.toProps().updatedAt.getTime()
        )
          throw new ConflictException({
            code: 'CONCURRENT_MODIFICATION',
            message: 'O vínculo mudou. Atualize a página.',
          });
      }
      const saved = await repo.save(this.toAssignmentEntity(assignment));
      await auditRepo.save({
        organizationId: audit.organizationId,
        fieldAgentId: audit.fieldAgentId,
        projectFieldAgentId: audit.projectFieldAgentId || saved.id,
        projectId: audit.projectId ?? saved.projectId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: fieldAgentAuditChanges(audit.changes),
      });
      return this.toAssignmentDomain(saved);
    });
  }

  private async lockOperationalProject(
    manager: EntityManager,
    organizationId: number,
    projectId: number,
  ): Promise<void> {
    const lock =
      manager.connection.options.type === 'mysql'
        ? { mode: 'pessimistic_write' as const }
        : undefined;
    const project = await manager.getRepository(ProjectEntity).findOne({
      where: { id: projectId, organizationId },
      ...(lock ? { lock } : {}),
    });
    if (
      !project ||
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
    ) {
      throw new ProjectStatusBlocksFieldAgentOperationError(
        project?.status ?? null,
      );
    }
  }

  private toFieldAgentEntity(fieldAgent: FieldAgent): FieldAgentEntity {
    const props = fieldAgent.toProps();
    const entity = this.fieldAgentRepo.create({
      organizationId: props.organizationId,
      userId: props.userId,
      name: props.name,
      email: props.email,
      phone: props.phone,
      document: props.document,
      status: props.status,
      metadata: props.metadata,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toAssignmentEntity(
    assignment: ProjectFieldAgent,
  ): ProjectFieldAgentEntity {
    const props = assignment.toProps();
    const entity = this.assignmentRepo.create({
      organizationId: props.organizationId,
      projectId: props.projectId,
      fieldAgentId: props.fieldAgentId,
      role: props.role,
      status: props.status,
      startDate: props.startDate,
      endDate: props.endDate,
      notes: props.notes,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toFieldAgentDomain(entity: FieldAgentEntity): FieldAgent {
    return new FieldAgent({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      userId: entity.userId === null ? null : Number(entity.userId),
      name: entity.name,
      email: entity.email,
      phone: entity.phone,
      document: entity.document,
      status: entity.status,
      metadata: entity.metadata,
      createdAt: this.toDate(entity.createdAt),
      updatedAt: this.toDate(entity.updatedAt),
      deletedAt: this.toNullableDate(entity.deletedAt),
    });
  }

  private toAssignmentDomain(
    entity: ProjectFieldAgentEntity,
  ): ProjectFieldAgent {
    return new ProjectFieldAgent({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      projectId: Number(entity.projectId),
      fieldAgentId: Number(entity.fieldAgentId),
      role: entity.role,
      status: entity.status,
      startDate: this.toNullableDate(entity.startDate),
      endDate: this.toNullableDate(entity.endDate),
      notes: entity.notes,
      createdAt: this.toDate(entity.createdAt),
      updatedAt: this.toDate(entity.updatedAt),
    });
  }

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private toNullableDate(value: Date | string | null): Date | null {
    return value === null ? null : this.toDate(value);
  }
}
