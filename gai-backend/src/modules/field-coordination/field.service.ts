import { fieldToday } from './field.policy';
import { createHash } from 'crypto';
import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, LessThan } from 'typeorm';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import {
  ProjectScopeService,
  type ProjectActorContext,
} from '../projects/application/services/project-scope.service';
import { ProjectStatusTransitionPolicy } from '../projects/domain/services/project-status-transition.policy';
import { OrganizationEntity } from '../organizations/infrastructure/persistence/organization.entity';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../auth/domain/enums/user.enums';
import { FieldAgentEntity } from '../field-agents/infrastructure/persistence/field-agent.entity';
import { FieldAgentStatus } from '../field-agents/domain/enums/field-agent-status.enum';
import { ProjectFieldAgentEntity } from '../field-agents/infrastructure/persistence/project-field-agent.entity';
import { ProjectFieldAgentStatus } from '../field-agents/domain/enums/project-field-agent-status.enum';
import { InventoryPendingIssueEntity } from '../inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { InventoryPendingIssueStatus } from '../inventory-pending-issues/domain/enums/inventory-pending-issue-status.enum';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../auth/domain/ports/permission-resolver.port';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import {
  FieldAudit,
  FieldChecklist,
  FieldCommand,
  FieldTask,
  FieldTemplate,
  FieldTemplateVersion,
} from './field.entity';
import {
  applicability,
  civilDate,
  conflict,
  invalid,
  validateDefinition,
  validateTransition,
} from './field.policy';
import type { FieldDefinition, FieldTaskDefinition } from './field.policy';
import {
  FieldAddTaskDto,
  FieldArchiveTemplateDto,
  FieldCreateDto,
  FieldMessageQuery,
  FieldPageQuery,
  FieldTaskDto,
  FieldTemplateDto,
  FieldTransitionDto,
} from './field.dto';

type Actor = ProjectActorContext;
@Injectable()
export class FieldService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: ProjectScopeService,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions: PermissionResolver,
  ) {}
  private missing(): never {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Registro não encontrado neste projeto/organização',
    });
  }
  private async allowed(actor: Actor, permission: string) {
    return hasAllPermissions(actor, [permission], this.permissions);
  }
  private async require(actor: Actor, permission: string) {
    if (!(await this.allowed(actor, permission)))
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
  }
  private async organization(id: number, actor: Actor) {
    this.scope.assertCanAccessProject(actor, id);
    if (!(await this.db.getRepository(OrganizationEntity).existsBy({ id })))
      this.missing();
  }
  private async project(
    id: number,
    actor: Actor,
    mutate = false,
    manager = this.db.manager,
  ) {
    const row = await manager.findOneBy(ProjectEntity, { id });
    if (!row) this.missing();
    this.scope.assertCanAccessProject(actor, row.organizationId);
    if (
      mutate &&
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(row.status)
    )
      conflict('O estado do projeto bloqueia alterações de campo');
    return row;
  }
  private async instance(
    projectId: number,
    id: number,
    actor: Actor,
    manager = this.db.manager,
    mutate = false,
  ) {
    const project = await this.project(projectId, actor, mutate, manager);
    const row = await manager.findOneBy(FieldChecklist, {
      id,
      projectId,
      organizationId: project.organizationId,
    });
    if (!row) this.missing();
    return row;
  }
  private async bump(
    manager: EntityManager,
    row: FieldChecklist,
    revision: number,
    requireOpen = true,
  ) {
    if (requireOpen && row.status !== 'open')
      conflict('Checklist concluído/arquivado: reabra antes de editar');
    const result = await manager.update(
      FieldChecklist,
      {
        id: row.id,
        organizationId: row.organizationId,
        projectId: row.projectId,
        revision,
      },
      { revision: revision + 1 },
    );
    if (result.affected !== 1) conflict();
    row.revision = revision + 1;
  }
  private audit(
    manager: EntityManager,
    actor: Actor,
    org: number,
    operation: string,
    changes: object,
    checklist?: FieldChecklist,
    templateId?: number,
  ) {
    return manager.save(
      FieldAudit,
      manager.create(FieldAudit, {
        organizationId: org,
        projectId: checklist?.projectId ?? null,
        checklistId: checklist?.id ?? null,
        templateId: templateId ?? null,
        performedById: actor.id,
        operation,
        changes,
      }),
    );
  }
  async templates(org: number, query: FieldPageQuery, actor: Actor) {
    await this.organization(org, actor);
    const [items, total] = await this.db
      .getRepository(FieldTemplate)
      .findAndCount({
        where: { organizationId: org },
        order: { id: 'DESC' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      });
    return { items, total, page: query.page, page_size: query.page_size };
  }
  async template(org: number, id: number, actor: Actor, version?: number) {
    await this.organization(org, actor);
    const row = await this.db
      .getRepository(FieldTemplate)
      .findOneBy({ id, organizationId: org });
    if (!row) this.missing();
    const snapshot = await this.db
      .getRepository(FieldTemplateVersion)
      .findOneBy({
        templateId: id,
        organizationId: org,
        version: version ?? row.currentVersion,
      });
    if (!snapshot) this.missing();
    return {
      ...row,
      version: snapshot.version,
      name: snapshot.name,
      description: snapshot.description,
      definition: snapshot.definition,
    };
  }
  async saveTemplate(
    org: number,
    dto: FieldTemplateDto,
    actor: Actor,
    id?: number,
  ) {
    await this.organization(org, actor);
    const definition = validateDefinition(dto.definition);
    const name = dto.name.trim();
    if (!name) invalid('Nome obrigatório');
    return this.db.transaction(async (manager) => {
      let row: FieldTemplate;
      if (id) {
        const existing = await manager.findOneBy(FieldTemplate, {
          id,
          organizationId: org,
        });
        if (!existing) this.missing();
        row = existing;
        if (row.archivedAt) conflict('Modelo arquivado');
        if (!dto.expected_version) invalid('expected_version obrigatório');
        const result = await manager.update(
          FieldTemplate,
          { id, organizationId: org, currentVersion: dto.expected_version },
          {
            name,
            description: dto.description ?? null,
            currentVersion: dto.expected_version + 1,
          },
        );
        if (result.affected !== 1) conflict('Versão do modelo alterada');
        row.currentVersion = dto.expected_version + 1;
        row.name = name;
        row.description = dto.description ?? null;
      } else
        row = await manager.save(
          FieldTemplate,
          manager.create(FieldTemplate, {
            organizationId: org,
            name,
            description: dto.description ?? null,
            currentVersion: 1,
            archivedAt: null,
          }),
        );
      await manager.save(
        FieldTemplateVersion,
        manager.create(FieldTemplateVersion, {
          organizationId: org,
          templateId: row.id,
          version: row.currentVersion,
          name,
          description: row.description,
          definition,
          createdById: actor.id,
        }),
      );
      await this.audit(
        manager,
        actor,
        org,
        id ? 'TEMPLATE_VERSION' : 'TEMPLATE_CREATE',
        { version: row.currentVersion, definition },
        undefined,
        row.id,
      );
      return { ...row, definition };
    });
  }
  async archiveTemplate(
    org: number,
    id: number,
    dto: FieldArchiveTemplateDto,
    actor: Actor,
  ) {
    await this.organization(org, actor);
    return this.db.transaction(async (manager) => {
      const result = await manager.update(
        FieldTemplate,
        { id, organizationId: org, currentVersion: dto.expected_version },
        {
          archivedAt: dto.archived ? new Date() : null,
          currentVersion: () => 'current_version + 1',
        },
      );
      if (result.affected !== 1) conflict('Modelo ausente ou versão alterada');
      // Archiving is metadata only: keep a version for every current_version value.
      const old = await manager.findOneBy(FieldTemplateVersion, {
        templateId: id,
        organizationId: org,
        version: dto.expected_version,
      });
      if (!old) this.missing();
      await manager.save(
        FieldTemplateVersion,
        manager.create(FieldTemplateVersion, {
          organizationId: org,
          templateId: id,
          version: dto.expected_version + 1,
          name: old.name,
          description: old.description,
          definition: old.definition,
          createdById: actor.id,
        }),
      );
      await this.audit(
        manager,
        actor,
        org,
        'TEMPLATE_ARCHIVE',
        { archived: dto.archived, version: dto.expected_version + 1 },
        undefined,
        id,
      );
      return {
        id,
        archived: dto.archived,
        currentVersion: dto.expected_version + 1,
      };
    });
  }
  async context(projectId: number, actor: Actor, query: FieldPageQuery) {
    const project = await this.project(projectId, actor);
    const org = project.organizationId;
    if (query.kind === 'field_agent') {
      const builder = this.db
        .getRepository(FieldAgentEntity)
        .createQueryBuilder('agent')
        .innerJoin(
          ProjectFieldAgentEntity,
          'link',
          'link.field_agent_id=agent.id AND link.organization_id=:org AND link.project_id=:projectId AND link.status=:active AND (link.start_date IS NULL OR link.start_date<=:today) AND (link.end_date IS NULL OR link.end_date>=:today)',
          {
            org,
            projectId,
            active: ProjectFieldAgentStatus.ACTIVE,
            today: fieldToday(),
          },
        )
        .where('agent.organization_id=:org AND agent.status=:status', {
          org,
          status: FieldAgentStatus.ACTIVE,
        });
      if (query.search)
        builder.andWhere('agent.name LIKE :search', {
          search: `%${query.search}%`,
        });
      const [items, total] = await builder
        .orderBy('agent.name', 'ASC')
        .skip((query.page - 1) * query.page_size)
        .take(query.page_size)
        .getManyAndCount();
      return {
        project: {
          id: project.id,
          name: project.name,
          organizationId: org,
          status: project.status,
        },
        items: items.map((row) => ({
          id: row.id,
          name: row.name,
          kind: 'field_agent',
          linkedUserId: row.userId,
        })),
        total,
        page: query.page,
        page_size: query.page_size,
      };
    }
    const builder = this.db
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .where('user.organization_id=:org AND user.status=:status', {
        org,
        status: UserStatus.ACTIVE,
      });
    if (query.search)
      builder.andWhere('user.login LIKE :search', {
        search: `%${query.search}%`,
      });
    const [items, total] = await builder
      .orderBy('user.login', 'ASC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    return {
      project: {
        id: project.id,
        name: project.name,
        organizationId: org,
        status: project.status,
      },
      items: items.map((row) => ({
        id: row.id,
        name: row.login,
        kind: 'user',
      })),
      total,
      page: query.page,
      page_size: query.page_size,
    };
  }
  async list(projectId: number, query: FieldPageQuery, actor: Actor) {
    const project = await this.project(projectId, actor);
    const [items, total] = await this.db
      .getRepository(FieldChecklist)
      .findAndCount({
        where: { projectId, organizationId: project.organizationId },
        order: { id: 'DESC' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      });
    return { items, total, page: query.page, page_size: query.page_size };
  }
  get(projectId: number, id: number, actor: Actor) {
    return this.instance(projectId, id, actor);
  }
  private async command<T extends object>(
    projectId: number,
    key: string,
    payload: object,
    actor: Actor,
    execute: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const project = await this.project(projectId, actor);
    const where = {
      organizationId: project.organizationId,
      projectId,
      commandKey: key,
    };
    const canonical = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => [key, canonical(item)]),
            )
          : value;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(canonical({ actor: actor.id, payload })))
      .digest('hex');
    const existing = await this.db.getRepository(FieldCommand).findOneBy(where);
    if (existing) {
      if (existing.fingerprint !== fingerprint || !existing.result)
        conflict('Chave idempotente reutilizada com conteúdo diferente');
      return existing.result as T;
    }
    try {
      return await this.db.transaction(async (manager) => {
        const record = await manager.save(
          FieldCommand,
          manager.create(FieldCommand, { ...where, fingerprint, result: null }),
        );
        const result = await execute(manager);
        await manager.update(
          FieldCommand,
          { id: record.id },
          { result: JSON.parse(JSON.stringify(result)) as object },
        );
        return result;
      });
    } catch (error) {
      const replay = await this.db.getRepository(FieldCommand).findOneBy(where);
      if (replay?.result && replay.fingerprint === fingerprint)
        return replay.result as T;
      throw error;
    }
  }
  async create(projectId: number, dto: FieldCreateDto, actor: Actor) {
    return this.command(
      projectId,
      dto.command_key,
      { operation: 'create', ...dto },
      actor,
      async (manager) => {
        const project = await this.project(projectId, actor, true, manager);
        const template = await manager.findOneBy(FieldTemplate, {
          id: dto.template_id,
          organizationId: project.organizationId,
        });
        if (!template) this.missing();
        if (template.archivedAt) conflict('Modelo arquivado');
        const version = await manager.findOneBy(FieldTemplateVersion, {
          templateId: template.id,
          organizationId: project.organizationId,
          version: dto.template_version ?? template.currentVersion,
        });
        if (!version) this.missing();
        const row = await manager.save(
          FieldChecklist,
          manager.create(FieldChecklist, {
            organizationId: project.organizationId,
            projectId,
            templateVersionId: version.id,
            title: dto.title.trim(),
            snapshot: {
              ...version.definition,
              name: version.name,
              version: version.version,
            },
            status: 'open',
            revision: 1,
            createdById: actor.id,
            completedAt: null,
            completedById: null,
          }),
        );
        if (!row.title) invalid('Título obrigatório');
        for (const definition of version.definition.tasks)
          await this.insertTask(manager, row, definition);
        await this.recompute(manager, row);
        await this.audit(
          manager,
          actor,
          row.organizationId,
          'CHECKLIST_CREATE',
          { templateId: template.id, version: version.version },
          row,
        );
        return row;
      },
    );
  }
  private insertTask(
    manager: EntityManager,
    row: FieldChecklist,
    definition: FieldTaskDefinition,
  ) {
    const group = row.snapshot.groups.find(
      (group) => group.id === definition.group_id,
    );
    if (!group) invalid('Etapa inválida');
    return manager.save(
      FieldTask,
      manager.create(FieldTask, {
        organizationId: row.organizationId,
        projectId: row.projectId,
        checklistId: row.id,
        stableId: definition.id,
        groupId: definition.group_id,
        title: definition.title,
        definition,
        position: definition.order,
        required: definition.required || group.required,
        applicable: true,
        state: 'pending',
        priority: 'normal',
        responsibleUserId: null,
        fieldAgentId: null,
        startDate: null,
        dueDate: null,
        notes: null,
        reason: null,
        linkedIssueId: null,
        completedAt: null,
        approvedById: null,
        approvedAt: null,
      }),
    );
  }
  private async recompute(manager: EntityManager, row: FieldChecklist) {
    const tasks = await manager.findBy(FieldTask, {
      checklistId: row.id,
      projectId: row.projectId,
      organizationId: row.organizationId,
    });
    const definition: FieldDefinition = {
      groups: row.snapshot.groups,
      tasks: tasks.map((task) => task.definition),
    };
    const map = applicability(definition, tasks);
    for (const task of tasks)
      if (task.applicable !== map.get(task.stableId))
        await manager.update(
          FieldTask,
          { id: task.id },
          { applicable: map.get(task.stableId)! },
        );
  }
  private async validateReferences(
    manager: EntityManager,
    row: FieldChecklist,
    task: FieldTask,
    actor: Actor,
    linkChanged = false,
  ) {
    if (task.responsibleUserId && task.fieldAgentId)
      invalid(
        'Selecione usuário administrativo OU inventariante, nunca IDs intercambiáveis',
      );
    if (
      task.responsibleUserId &&
      !(await manager.existsBy(UserEntity, {
        id: task.responsibleUserId,
        organizationId: row.organizationId,
        status: UserStatus.ACTIVE,
      }))
    )
      invalid('Usuário responsável deve estar ativo na organização');
    if (task.fieldAgentId) {
      const agent = await manager.findOneBy(FieldAgentEntity, {
        id: task.fieldAgentId,
        organizationId: row.organizationId,
        status: FieldAgentStatus.ACTIVE,
      });
      const link = await manager.findOneBy(ProjectFieldAgentEntity, {
        fieldAgentId: task.fieldAgentId,
        projectId: row.projectId,
        organizationId: row.organizationId,
        status: ProjectFieldAgentStatus.ACTIVE,
      });
      if (!agent || !link)
        invalid('Inventariante precisa estar ativo e vinculado ao projeto');
      const date = (value: unknown) =>
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : typeof value === 'string'
            ? value
            : null;
      const start = date(link.startDate),
        end = date(link.endDate),
        today = fieldToday();
      if ((start && start > today) || (end && end < today))
        invalid('Vínculo do inventariante fora do período válido');
    }
    if (task.linkedIssueId) {
      if (linkChanged)
        await this.require(actor, 'inventory-pending-issues:read');
      if (
        !(await manager.existsBy(InventoryPendingIssueEntity, {
          id: task.linkedIssueId,
          organizationId: row.organizationId,
          projectId: row.projectId,
        }))
      )
        invalid('Pendência não pertence ao projeto');
    }
    civilDate(task.startDate);
    civilDate(task.dueDate);
    if (task.startDate && task.dueDate && task.startDate > task.dueDate)
      invalid('Prazo anterior ao início previsto');
    if (
      task.state === 'not_applicable' &&
      (!task.definition.allow_not_applicable || !task.reason?.trim())
    )
      invalid('Não aplicável precisa ser permitido e justificado');
    if (task.state === 'completed') {
      if (!task.applicable)
        invalid('Tarefa não aplicável por condição não pode ser concluída');
      if (
        task.definition.requires_responsible &&
        !task.responsibleUserId &&
        !task.fieldAgentId
      )
        invalid('Responsável obrigatório');
      if (task.definition.requires_due_date && !task.dueDate)
        invalid('Prazo obrigatório');
      if (task.definition.requires_notes && !task.notes?.trim())
        invalid('Observações de conclusão obrigatórias');
      if (task.definition.requires_issue_resolved) {
        const issue = task.linkedIssueId
          ? await manager.findOneBy(InventoryPendingIssueEntity, {
              id: task.linkedIssueId,
              projectId: row.projectId,
              organizationId: row.organizationId,
            })
          : null;
        if (!issue || issue.status !== InventoryPendingIssueStatus.RESOLVED)
          invalid('Tarefa exige pendência patrimonial vinculada e resolvida');
      }
    }
  }
  async addTask(
    projectId: number,
    id: number,
    dto: FieldAddTaskDto,
    actor: Actor,
  ) {
    return this.db.transaction(async (manager) => {
      const row = await this.instance(projectId, id, actor, manager, true);
      await this.bump(manager, row, dto.revision);
      const definitions = (
        await manager.findBy(FieldTask, { checklistId: id })
      ).map((task) => task.definition);
      validateDefinition({
        groups: row.snapshot.groups,
        tasks: [...definitions, dto.definition],
      });
      const task = await this.insertTask(manager, row, dto.definition);
      await this.recompute(manager, row);
      await this.audit(
        manager,
        actor,
        row.organizationId,
        'TASK_CREATE',
        { task },
        row,
      );
      return { task, revision: row.revision };
    });
  }
  async updateTask(
    projectId: number,
    id: number,
    taskId: number,
    dto: FieldTaskDto & { command_key?: string },
    actor: Actor,
    approve = false,
  ) {
    const execute = async (manager: EntityManager) => {
      const row = await this.instance(projectId, id, actor, manager, true);
      await this.bump(manager, row, dto.revision);
      const task = await manager.findOneBy(FieldTask, {
        id: taskId,
        checklistId: id,
        projectId,
        organizationId: row.organizationId,
      });
      if (!task) this.missing();
      const before = structuredClone(task);
      if (approve) {
        if (task.state !== 'completed' || !task.applicable)
          invalid('Aprovação exige tarefa aplicável concluída');
        await this.validateReferences(manager, row, task, actor);
        task.approvedById = actor.id;
        task.approvedAt = new Date();
      } else {
        const next = dto.state ?? task.state;
        const transition = validateTransition(
          task.state,
          next,
          next === task.state ? task.reason : dto.reason,
        );
        if (transition.reopens)
          await this.require(actor, 'field-coordination:coordinate');
        if (
          ['completed', 'not_applicable'].includes(task.state) &&
          !transition.reopens &&
          Object.keys(dto).some((key) => !['revision', 'state'].includes(key))
        )
          conflict('Reabra a tarefa antes de editar seus dados');
        if (dto.title !== undefined) {
          if (!dto.title.trim()) invalid('Título obrigatório');
          task.title = dto.title.trim();
        }
        for (const [key, field] of [
          ['notes', 'notes'],
          ['reason', 'reason'],
          ['priority', 'priority'],
          ['responsible_user_id', 'responsibleUserId'],
          ['field_agent_id', 'fieldAgentId'],
          ['linked_issue_id', 'linkedIssueId'],
          ['start_date', 'startDate'],
          ['due_date', 'dueDate'],
        ] as const) {
          if (dto[key] !== undefined)
            (task as unknown as Record<string, unknown>)[field] = dto[key];
        }
        task.startDate = civilDate(task.startDate);
        task.dueDate = civilDate(task.dueDate);
        task.state = next;
        await this.validateReferences(
          manager,
          row,
          task,
          actor,
          dto.linked_issue_id !== undefined &&
            dto.linked_issue_id !== before.linkedIssueId,
        );
        task.completedAt =
          next === 'completed' ? (before.completedAt ?? new Date()) : null;
        task.approvedById = null;
        task.approvedAt = null;
      }
      await manager.save(FieldTask, task);
      await this.recompute(manager, row);
      await this.audit(
        manager,
        actor,
        row.organizationId,
        approve ? 'TASK_APPROVE' : 'TASK_UPDATE',
        { before, after: task, revision: row.revision },
        row,
      );
      return { task, revision: row.revision };
    };
    let result: { task: FieldTask; revision: number };
    if (approve) {
      if (!dto.command_key) invalid('command_key obrigatório para aprovação');
      result = await this.command(
        projectId,
        dto.command_key,
        { operation: 'task-approve', id, taskId, ...dto },
        actor,
        execute,
      );
    } else result = await this.db.transaction(execute);
    if (!(await this.allowed(actor, 'inventory-pending-issues:read')))
      result.task.linkedIssueId = null;
    return result;
  }
  private taskQuery(row: FieldChecklist, manager = this.db.manager) {
    return manager
      .getRepository(FieldTask)
      .createQueryBuilder('task')
      .where(
        'task.organization_id=:org AND task.project_id=:project AND task.checklist_id=:id',
        { org: row.organizationId, project: row.projectId, id: row.id },
      );
  }
  async tasks(
    projectId: number,
    id: number,
    query: FieldPageQuery,
    actor: Actor,
  ) {
    const row = await this.instance(projectId, id, actor);
    const builder = this.taskQuery(row);
    for (const [key, column] of [
      ['group_id', 'group_id'],
      ['state', 'state'],
      ['priority', 'priority'],
      ['responsible_user_id', 'responsible_user_id'],
      ['field_agent_id', 'field_agent_id'],
    ] as const)
      if (query[key])
        builder.andWhere(`task.${column}=:${key}`, { [key]: query[key] });
    if (query.due_before)
      builder.andWhere('task.due_date<=:before', {
        before: civilDate(query.due_before),
      });
    if (query.overdue === 'true')
      builder.andWhere(
        'task.applicable=:applies AND task.state NOT IN (:...done) AND task.due_date<:today',
        {
          applies: true,
          done: ['completed', 'not_applicable'],
          today: fieldToday(),
        },
      );
    if (query.search)
      builder.andWhere('task.title LIKE :search', {
        search: `%${query.search}%`,
      });
    const [items, total] = await builder
      .orderBy('task.position', 'ASC')
      .addOrderBy('task.id', 'ASC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    const mayReadIssues = await this.allowed(
      actor,
      'inventory-pending-issues:read',
    );
    const projected = [];
    const userIds = items.flatMap((task) =>
      task.responsibleUserId ? [task.responsibleUserId] : [],
    );
    const agentIds = items.flatMap((task) =>
      task.fieldAgentId ? [task.fieldAgentId] : [],
    );
    const users = userIds.length
      ? await this.db
          .getRepository(UserEntity)
          .findBy({ id: In(userIds), organizationId: row.organizationId })
      : [];
    const agents = agentIds.length
      ? await this.db
          .getRepository(FieldAgentEntity)
          .findBy({ id: In(agentIds), organizationId: row.organizationId })
      : [];
    for (const task of items) {
      const issue =
        mayReadIssues && task.linkedIssueId
          ? await this.db.getRepository(InventoryPendingIssueEntity).findOneBy({
              id: task.linkedIssueId,
              projectId,
              organizationId: row.organizationId,
            })
          : null;
      projected.push({
        ...task,
        linkedIssueId: mayReadIssues ? task.linkedIssueId : null,
        hasLinkedIssue: !!task.linkedIssueId,
        responsible: task.responsibleUserId
          ? {
              kind: 'user',
              id: task.responsibleUserId,
              name:
                users.find((user) => user.id === task.responsibleUserId)
                  ?.login ?? 'Usuário indisponível',
            }
          : task.fieldAgentId
            ? {
                kind: 'field_agent',
                id: task.fieldAgentId,
                name:
                  agents.find((agent) => agent.id === task.fieldAgentId)
                    ?.name ?? 'Inventariante indisponível',
              }
            : null,
        issue: issue
          ? { id: issue.id, title: issue.title, status: issue.status }
          : null,
      });
    }
    return {
      items: projected,
      total,
      page: query.page,
      page_size: query.page_size,
      revision: row.revision,
    };
  }
  async blockers(
    projectId: number,
    id: number,
    actor: Actor,
    manager = this.db.manager,
  ) {
    const row = await this.instance(projectId, id, actor, manager);
    // SQL first: fetch only applicable mandatory rows, never a full task list for KPIs.
    const tasks = await this.taskQuery(row, manager)
      .andWhere('task.required=:required AND task.applicable=:applies', {
        required: true,
        applies: true,
      })
      .getMany();
    const blockers: Array<{
      task_id: number;
      stable_id: string;
      group_id: string;
      code: string;
      message: string;
    }> = [];
    for (const task of tasks) {
      const add = (code: string, message: string) =>
        blockers.push({
          task_id: task.id,
          stable_id: task.stableId,
          group_id: task.groupId,
          code,
          message,
        });
      if (!['completed', 'not_applicable'].includes(task.state)) {
        add(
          task.state === 'blocked' ? 'TASK_BLOCKED' : 'TASK_PENDING',
          'Tarefa obrigatória não resolvida',
        );
        continue;
      }
      try {
        await this.validateReferences(manager, row, task, actor);
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        const body = error.getResponse();
        const message =
          typeof body === 'object' &&
          'message' in body &&
          typeof body.message === 'string'
            ? body.message
            : 'Requisitos da tarefa não atendidos';
        add('TASK_REQUIREMENTS', message);
      }
      if (
        task.state === 'completed' &&
        task.definition.requires_approval &&
        !task.approvedById
      )
        add('APPROVAL_REQUIRED', 'Aprovação da tarefa obrigatória ausente');
    }
    return {
      can_complete: blockers.length === 0 && row.status === 'open',
      revision: row.revision,
      blockers,
    };
  }
  async transition(
    projectId: number,
    id: number,
    dto: FieldTransitionDto,
    actor: Actor,
  ) {
    return this.command(
      projectId,
      dto.command_key,
      { operation: 'transition', id, ...dto },
      actor,
      async (manager) => {
        const row = await this.instance(projectId, id, actor, manager, true);
        if (row.status === 'archived') conflict('Checklist arquivado');
        if (dto.action === 'complete') {
          if (row.status !== 'open') conflict('Checklist não está aberto');
          await this.bump(manager, row, dto.revision);
          const result = await this.blockers(projectId, id, actor, manager);
          if (result.blockers.length)
            conflict('Conclusão de campo impedida', result.blockers);
          row.status = 'completed';
          row.completedAt = new Date();
          row.completedById = actor.id;
        } else {
          if (!dto.reason?.trim()) invalid('Motivo obrigatório');
          if (dto.action === 'reopen' && row.status !== 'completed')
            conflict('Somente checklist concluído pode ser reaberto');
          await this.bump(manager, row, dto.revision, false);
          row.status = dto.action === 'archive' ? 'archived' : 'open';
          row.completedAt = null;
          row.completedById = null;
        }
        await manager.update(
          FieldChecklist,
          { id: row.id },
          {
            status: row.status,
            completedAt: row.completedAt,
            completedById: row.completedById,
          },
        );
        await this.audit(
          manager,
          actor,
          row.organizationId,
          'CHECKLIST_' + dto.action.toUpperCase(),
          { reason: dto.reason ?? null, revision: row.revision },
          row,
        );
        return row;
      },
    );
  }
  async dashboard(projectId: number, id: number, actor: Actor) {
    const row = await this.instance(projectId, id, actor);
    const today = fieldToday();
    const grouped = await this.taskQuery(row)
      .select('task.group_id', 'groupId')
      .addSelect('task.state', 'state')
      .addSelect('task.applicable', 'applicable')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        'SUM(CASE WHEN task.due_date < :today AND task.applicable=1 AND task.state NOT IN (:...done) THEN 1 ELSE 0 END)',
        'overdue',
      )
      .setParameters({ today, done: ['completed', 'not_applicable'] })
      .groupBy('task.group_id')
      .addGroupBy('task.state')
      .addGroupBy('task.applicable')
      .getRawMany<{
        groupId: string;
        state: string;
        applicable: number;
        count: string;
        overdue: string;
      }>();
    const groups = row.snapshot.groups.map((group) => {
      const rows = grouped.filter(
        (item) => item.groupId === group.id && Number(item.applicable),
      );
      const total = rows.reduce((s, r) => s + Number(r.count), 0),
        completed = rows
          .filter((r) => r.state === 'completed')
          .reduce((s, r) => s + Number(r.count), 0),
        na = rows
          .filter((r) => r.state === 'not_applicable')
          .reduce((s, r) => s + Number(r.count), 0);
      return {
        ...group,
        total,
        completed,
        notApplicable: na,
        pending: total - completed - na,
        blocked: rows
          .filter((r) => r.state === 'blocked')
          .reduce((s, r) => s + Number(r.count), 0),
        overdue: rows.reduce((s, r) => s + Number(r.overdue), 0),
        percent: total ? Math.round(((completed + na) * 1000) / total) / 10 : 0,
      };
    });
    const responsibles = await this.taskQuery(row)
      .andWhere('task.applicable=1')
      .leftJoin(
        UserEntity,
        'u',
        'u.id=task.responsible_user_id AND u.organization_id=task.organization_id',
      )
      .leftJoin(
        FieldAgentEntity,
        'a',
        'a.id=task.field_agent_id AND a.organization_id=task.organization_id',
      )
      .select('task.responsible_user_id', 'userId')
      .addSelect('task.field_agent_id', 'fieldAgentId')
      .addSelect('u.login', 'userName')
      .addSelect('a.name', 'agentName')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN task.state='completed' AND task.applicable=1 THEN 1 ELSE 0 END)",
        'completed',
      )
      .groupBy('task.responsible_user_id')
      .addGroupBy('task.field_agent_id')
      .addGroupBy('u.login')
      .addGroupBy('a.name')
      .getRawMany();
    const links = await this.taskQuery(row)
      .andWhere('task.linked_issue_id IS NOT NULL')
      .select('COUNT(DISTINCT task.linked_issue_id)', 'count')
      .getRawOne<{ count: string }>();
    const sum = (
      key:
        | 'total'
        | 'completed'
        | 'notApplicable'
        | 'blocked'
        | 'overdue'
        | 'pending',
    ) => groups.reduce((s, g) => s + g[key], 0);
    const total = sum('total');
    return {
      checklist: row,
      groups,
      responsibles: responsibles as unknown[],
      summary: {
        asOfDate: today,
        groups: groups.length,
        groupsCompleted: groups.filter((g) => g.total > 0 && g.pending === 0)
          .length,
        groupsPending: groups.filter((g) => g.pending > 0).length,
        groupsNotApplicable: groups.filter((g) => g.total === 0).length,
        total,
        completed: sum('completed'),
        notApplicable: sum('notApplicable'),
        pending: sum('pending'),
        blocked: sum('blocked'),
        overdue: sum('overdue'),
        conditionallyExcluded: grouped
          .filter((r) => !Number(r.applicable))
          .reduce((s, r) => s + Number(r.count), 0),
        percent: total
          ? Math.round(
              ((sum('completed') + sum('notApplicable')) * 1000) / total,
            ) / 10
          : 0,
        linkedIssues: Number(links?.count ?? 0),
        denominator:
          'Tarefas aplicáveis de todas as etapas; N/A justificado resolve a tarefa e permanece no denominador; bloqueadas não concluem. Progresso não substitui aprovação.',
      },
    };
  }
  async history(
    projectId: number,
    id: number,
    query: FieldPageQuery,
    actor: Actor,
  ) {
    const row = await this.instance(projectId, id, actor);
    const items = await this.db.getRepository(FieldAudit).find({
      where: {
        organizationId: row.organizationId,
        projectId,
        checklistId: id,
        ...(query.before_id ? { id: LessThan(query.before_id) } : {}),
      },
      order: { id: 'DESC' },
      take: query.page_size,
    });
    if (!(await this.allowed(actor, 'inventory-pending-issues:read')))
      for (const item of items)
        item.changes = JSON.parse(
          JSON.stringify(item.changes, (key, value: unknown) =>
            key === 'linkedIssueId' ? null : value,
          ),
        ) as object;
    return {
      items,
      next_before_id:
        items.length === query.page_size ? items.at(-1)!.id : null,
    };
  }
  async message(
    projectId: number,
    id: number,
    query: FieldMessageQuery,
    actor: Actor,
  ) {
    const row = await this.instance(projectId, id, actor);
    const project = await this.project(projectId, actor);
    const builder = this.taskQuery(row).andWhere('task.applicable=:applies', {
      applies: true,
    });
    if (query.group_id)
      builder.andWhere('task.group_id=:group', { group: query.group_id });
    if (query.responsible_user_id)
      builder.andWhere('task.responsible_user_id=:user', {
        user: query.responsible_user_id,
      });
    if (query.field_agent_id)
      builder.andWhere('task.field_agent_id=:agent', {
        agent: query.field_agent_id,
      });
    if (query.kind === 'assigned')
      builder.andWhere(
        '(task.responsible_user_id IS NOT NULL OR task.field_agent_id IS NOT NULL)',
      );
    if (['pending', 'open', 'inventory_start'].includes(query.kind))
      builder.andWhere('task.state NOT IN (:...done)', {
        done: ['completed', 'not_applicable'],
      });
    const [tasks, total] = await builder
      .orderBy('task.position', 'ASC')
      .take(100)
      .getManyAndCount();
    const labels: Record<string, string> = {
      initial: 'Instruções iniciais',
      assigned: 'Tarefas atribuídas',
      pending: 'Pendências por responsável',
      open: 'Atividades em aberto',
      inventory_start: 'Orientações para início do inventário',
    };
    const states: Record<string, string> = {
      pending: 'Pendente',
      in_progress: 'Em andamento',
      completed: 'Concluída',
      blocked: 'Bloqueada',
      not_applicable: 'Não aplicável',
    };
    const text = [
      `Coordenação de Campo — ${project.name}`,
      `Checklist: ${row.title}`,
      `Prévia: ${labels[query.kind]} | revisão ${row.revision}`,
      ...tasks.map(
        (task) =>
          `• ${task.title} — ${states[task.state]} — prazo ${task.dueDate ?? 'não definido'}`,
      ),
      ...(total > tasks.length
        ? [`Exibidas ${tasks.length} de ${total} tarefas; refine os filtros.`]
        : []),
      'Conteúdo para revisão. Nenhuma mensagem foi enviada.',
    ].join('\n');
    await this.audit(
      this.db.manager,
      actor,
      row.organizationId,
      'MESSAGE_PREVIEW',
      { kind: query.kind, total },
      row,
    );
    return { text, total, included: tasks.length, sent: false };
  }
}
