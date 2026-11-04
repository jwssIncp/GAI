import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In, IsNull, LessThan } from 'typeorm';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../projects/application/services/project-scope.service';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { ProjectStatusTransitionPolicy } from '../projects/domain/services/project-status-transition.policy';
import { OrganizationEntity } from '../organizations/infrastructure/persistence/organization.entity';
import { CompanyEntity } from '../companies/infrastructure/persistence/company.entity';
import { CompanyUnitEntity } from '../companies/infrastructure/persistence/company-unit.entity';
import { ProjectUnitEntity } from '../companies/infrastructure/persistence/project-unit.entity';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../auth/domain/enums/user.enums';
import { PreparationRepository } from './preparation.repository';
import {
  CreatePreparationDto,
  CreateTemplateDto,
  SaveAnswersDto,
  UpdatePreparationDto,
  UpdateTemplateDto,
} from './preparation.dto';
import {
  PreparationAnswerEntity,
  PreparationAuditEntity,
  PreparationTemplateEntity,
  PreparationTemplateVersionEntity,
  ProjectPreparationEntity,
} from './preparation.entity';
import {
  allocations,
  applicability,
  invalid,
  progress,
  validateAnswer,
  validateQuestions,
  validDate,
} from './domain/preparation.policy';
import { PolicyAnswer, PreparationQuestion } from './domain/preparation.types';

@Injectable()
export class PreparationService {
  constructor(
    private readonly repo: PreparationRepository,
    private readonly scope: ProjectScopeService,
  ) {}
  private missing(): never {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Preparação ou modelo não encontrado neste escopo',
    });
  }
  private conflict(
    message = 'Dados alterados por outra operação; recarregue antes de salvar',
  ): never {
    throw new ConflictException({ code: 'PREPARATION_CONFLICT', message });
  }
  private text(value: string): string {
    if (typeof value !== 'string' || !value.trim())
      invalid('Nome/título não pode ser vazio');
    return value.trim();
  }
  private async organization(id: number, actor: ProjectActorContext) {
    this.scope.assertCanAccessProject(actor, id);
    if (
      !(await this.repo.manager
        .getRepository(OrganizationEntity)
        .existsBy({ id }))
    )
      this.missing();
  }
  private async project(
    id: number,
    actor: ProjectActorContext,
    mutation = false,
  ) {
    const project = await this.repo.manager
      .getRepository(ProjectEntity)
      .findOneBy({ id });
    if (!project) this.missing();
    this.scope.assertCanAccessProject(actor, project.organizationId);
    if (
      mutation &&
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
    )
      throw new ConflictException({
        code: 'PROJECT_STATUS_BLOCKS_OPERATION',
        message: 'Project status blocks this operation',
      });
    return project;
  }
  private audit(
    manager: EntityManager,
    actor: ProjectActorContext,
    organizationId: number,
    operation: string,
    changes: Record<string, unknown>,
    projectId: number | null = null,
    preparationId: number | null = null,
    templateId: number | null = null,
  ) {
    return manager.getRepository(PreparationAuditEntity).save({
      organizationId,
      projectId,
      preparationId,
      templateId,
      operation,
      performedById: actor.id,
      changes: JSON.parse(JSON.stringify(changes)) as Record<string, unknown>,
    });
  }
  async listTemplates(organizationId: number, actor: ProjectActorContext) {
    await this.organization(organizationId, actor);
    const items = await this.repo.manager
      .getRepository(PreparationTemplateEntity)
      .find({ where: { organizationId }, order: { id: 'DESC' }, take: 200 });
    return {
      items: items.map((item) => this.templateSummary(item)),
      limit: 200,
    };
  }
  private templateSummary(item: PreparationTemplateEntity) {
    return {
      id: item.id,
      organization_id: item.organizationId,
      name: item.name,
      kind: item.kind,
      current_version: item.currentVersion,
      archived_at: item.archivedAt,
      updated_at: item.updatedAt,
    };
  }
  async getTemplate(
    organizationId: number,
    id: number,
    actor: ProjectActorContext,
  ) {
    await this.organization(organizationId, actor);
    const item = await this.repo.template(organizationId, id);
    if (!item) this.missing();
    const current = await this.repo.version(
      organizationId,
      id,
      item.currentVersion,
    );
    if (!current) this.missing();
    const versions = await this.repo.manager
      .getRepository(PreparationTemplateVersionEntity)
      .find({
        where: { organizationId, templateId: id },
        order: { version: 'DESC' },
        take: 100,
        select: {
          id: true,
          version: true,
          name: true,
          createdAt: true,
          createdById: true,
        },
      });
    return {
      ...this.templateSummary(item),
      questions: current.questions,
      versions: versions.map((v) => ({
        version: v.version,
        name: v.name,
        created_at: v.createdAt,
        created_by_id: v.createdById,
      })),
    };
  }
  async getVersion(
    organizationId: number,
    id: number,
    version: number,
    actor: ProjectActorContext,
  ) {
    await this.organization(organizationId, actor);
    if (!(await this.repo.template(organizationId, id))) this.missing();
    const row = await this.repo.version(organizationId, id, version);
    if (!row) this.missing();
    return {
      template_id: id,
      version: row.version,
      name: row.name,
      questions: row.questions,
      created_at: row.createdAt,
      created_by_id: row.createdById,
    };
  }
  async createTemplate(
    organizationId: number,
    dto: CreateTemplateDto,
    actor: ProjectActorContext,
  ) {
    await this.organization(organizationId, actor);
    const questions = validateQuestions(dto.questions);
    const id = await this.repo.transaction(async (manager) => {
      const item = await manager.getRepository(PreparationTemplateEntity).save({
        organizationId,
        name: this.text(dto.name),
        kind: dto.kind,
        currentVersion: 1,
        archivedAt: null,
      });
      await manager.getRepository(PreparationTemplateVersionEntity).save({
        organizationId,
        templateId: item.id,
        version: 1,
        name: item.name,
        questions,
        createdById: actor.id,
      });
      await this.audit(
        manager,
        actor,
        organizationId,
        'TEMPLATE_CREATED',
        { version: 1, name: item.name, questions },
        null,
        null,
        item.id,
      );
      return item.id;
    });
    return this.getTemplate(organizationId, id, actor);
  }
  async updateTemplate(
    organizationId: number,
    id: number,
    dto: UpdateTemplateDto,
    actor: ProjectActorContext,
  ) {
    await this.organization(organizationId, actor);
    const questions = validateQuestions(dto.questions);
    await this.repo.transaction(async (manager) => {
      const item = await this.repo.template(organizationId, id, manager);
      if (!item) this.missing();
      if (item.archivedAt)
        this.conflict('Modelo arquivado não pode ser editado');
      const versions = await manager
        .getRepository(PreparationTemplateVersionEntity)
        .find({ where: { organizationId, templateId: id } });
      const types = new Map<string, string>();
      versions.forEach((v) =>
        v.questions.forEach((q) => types.set(q.id, q.type)),
      );
      if (questions.some((q) => types.has(q.id) && types.get(q.id) !== q.type))
        invalid(
          'Mudança de tipo exige novo ID de pergunta; preserve a identidade das versões anteriores',
        );
      const name = this.text(dto.name);
      const changed = await manager
        .getRepository(PreparationTemplateEntity)
        .update(
          {
            id,
            organizationId,
            currentVersion: dto.expected_version,
            archivedAt: IsNull(),
          },
          { name, currentVersion: dto.expected_version + 1 },
        );
      if (changed.affected !== 1) this.conflict();
      await manager.getRepository(PreparationTemplateVersionEntity).save({
        organizationId,
        templateId: id,
        version: dto.expected_version + 1,
        name,
        questions,
        createdById: actor.id,
      });
      await this.audit(
        manager,
        actor,
        organizationId,
        'TEMPLATE_VERSION_CREATED',
        {
          before: { version: item.currentVersion, name: item.name },
          after: { version: dto.expected_version + 1, name, questions },
        },
        null,
        null,
        id,
      );
    });
    return this.getTemplate(organizationId, id, actor);
  }
  async archiveTemplate(
    organizationId: number,
    id: number,
    revision: number,
    actor: ProjectActorContext,
  ) {
    await this.organization(organizationId, actor);
    await this.repo.transaction(async (manager) => {
      if (!(await this.repo.template(organizationId, id, manager)))
        this.missing();
      const changed = await manager
        .getRepository(PreparationTemplateEntity)
        .update(
          {
            id,
            organizationId,
            currentVersion: revision,
            archivedAt: IsNull(),
          },
          { archivedAt: new Date() },
        );
      if (changed.affected !== 1) this.conflict();
      await this.audit(
        manager,
        actor,
        organizationId,
        'TEMPLATE_ARCHIVED',
        { version: revision },
        null,
        null,
        id,
      );
    });
    return this.getTemplate(organizationId, id, actor);
  }
  async cloneTemplate(
    organizationId: number,
    id: number,
    actor: ProjectActorContext,
  ) {
    const original = await this.getTemplate(organizationId, id, actor);
    const clone = await this.createTemplate(
      organizationId,
      {
        name: `${original.name.slice(0, 185)} (cópia)`,
        kind: original.kind,
        questions: original.questions,
      },
      actor,
    );
    await this.audit(
      this.repo.manager,
      actor,
      organizationId,
      'TEMPLATE_CLONED',
      { source_template_id: id },
      null,
      null,
      clone.id,
    );
    return clone;
  }
  private async responsible(
    id: number | null | undefined,
    organizationId: number,
    manager: EntityManager,
  ) {
    if (
      id != null &&
      !(await manager
        .getRepository(UserEntity)
        .existsBy({ id, organizationId, status: UserStatus.ACTIVE }))
    )
      invalid(
        'Responsável deve ser um usuário ativo da organização do projeto',
      );
  }
  private async units(project: ProjectEntity, manager = this.repo.manager) {
    const links = await manager.getRepository(ProjectUnitEntity).find({
      where: {
        organizationId: project.organizationId,
        projectId: project.id,
      },
    });
    if (!links.length || !project.companyId) return [];
    const units = await manager.getRepository(CompanyUnitEntity).find({
      where: {
        id: In(links.map((link) => link.companyUnitId)),
        organizationId: project.organizationId,
        companyId: project.companyId,
      },
      order: { name: 'ASC' },
    });
    return units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      address: [unit.address, unit.number, unit.city, unit.state]
        .filter(Boolean)
        .join(', '),
    }));
  }
  async context(projectId: number, actor: ProjectActorContext) {
    const project = await this.project(projectId, actor);
    const company = project.companyId
      ? await this.repo.manager.getRepository(CompanyEntity).findOneBy({
          id: project.companyId,
          organizationId: project.organizationId,
        })
      : null;
    const users = await this.repo.manager.getRepository(UserEntity).find({
      where: {
        organizationId: project.organizationId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, login: true },
      order: { login: 'ASC' },
      take: 500,
    });
    return {
      project: {
        id: project.id,
        name: project.name,
        organization_id: project.organizationId,
        status: project.status,
      },
      company: company ? { id: company.id, name: company.name } : null,
      units: await this.units(project),
      responsible_users: users.map((user) => ({
        id: user.id,
        label: user.login,
      })),
    };
  }
  async list(projectId: number, actor: ProjectActorContext) {
    const project = await this.project(projectId, actor);
    const instances = await this.repo.manager
      .getRepository(ProjectPreparationEntity)
      .find({
        where: { organizationId: project.organizationId, projectId },
        order: { id: 'DESC' },
        take: 100,
      });
    const items = await Promise.all(
      instances.map(async (row) =>
        this.view(row, await this.repo.answers(row)),
      ),
    );
    return { items, limit: 100 };
  }
  async create(
    projectId: number,
    dto: CreatePreparationDto,
    actor: ProjectActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    validDate(dto.scheduled_date);
    validDate(dto.due_date);
    const id = await this.repo.transaction(async (manager) => {
      const template = await this.repo.template(
        project.organizationId,
        dto.template_id,
        manager,
      );
      if (!template) this.missing();
      if (template.archivedAt)
        this.conflict('Modelo arquivado não pode originar novas instâncias');
      const version = await this.repo.version(
        project.organizationId,
        template.id,
        dto.template_version ?? template.currentVersion,
        manager,
      );
      if (!version) this.missing();
      await this.responsible(
        dto.responsible_user_id,
        project.organizationId,
        manager,
      );
      const row = await manager.getRepository(ProjectPreparationEntity).save({
        organizationId: project.organizationId,
        projectId,
        templateVersionId: version.id,
        kind: template.kind,
        title: this.text(dto.title),
        snapshot: {
          name: version.name,
          version: version.version,
          questions: version.questions,
        },
        status: 'draft',
        revision: 1,
        responsibleUserId: dto.responsible_user_id ?? null,
        scheduledDate: dto.scheduled_date ?? null,
        dueDate: dto.due_date ?? null,
        notes: null,
        createdById: actor.id,
        approvedById: null,
        approvedAt: null,
      });
      await this.audit(
        manager,
        actor,
        project.organizationId,
        'INSTANCE_CREATED',
        {
          snapshot: row.snapshot,
          title: row.title,
          responsible_user_id: row.responsibleUserId,
          scheduled_date: row.scheduledDate,
          due_date: row.dueDate,
        },
        projectId,
        row.id,
        template.id,
      );
      return row.id;
    });
    return this.get(projectId, id, actor);
  }
  private async scopedInstance(
    project: ProjectEntity,
    id: number,
    manager = this.repo.manager,
  ) {
    const instance = await this.repo.instance(
      project.organizationId,
      project.id,
      id,
      manager,
    );
    if (!instance) this.missing();
    return instance;
  }
  private editable(instance: ProjectPreparationEntity) {
    if (['approved', 'archived'].includes(instance.status))
      this.conflict(
        'Instância aprovada ou arquivada não pode ser editada; reabra uma aprovação antes de alterar',
      );
  }
  private async claim(
    manager: EntityManager,
    row: ProjectPreparationEntity,
    revision: number,
    changes: Partial<ProjectPreparationEntity> = {},
  ) {
    const changed = await manager
      .getRepository(ProjectPreparationEntity)
      .update(
        {
          id: row.id,
          organizationId: row.organizationId,
          projectId: row.projectId,
          revision,
        },
        { ...changes, revision: revision + 1 },
      );
    if (changed.affected !== 1) this.conflict();
  }
  private view(
    row: ProjectPreparationEntity,
    answers: PreparationAnswerEntity[],
  ) {
    const enabled = applicability(row.snapshot.questions, answers);
    return {
      id: row.id,
      organization_id: row.organizationId,
      project_id: row.projectId,
      kind: row.kind,
      title: row.title,
      template_version_id: row.templateVersionId,
      snapshot: row.snapshot,
      revision: row.revision,
      status: row.status,
      responsible_user_id: row.responsibleUserId,
      scheduled_date: row.scheduledDate,
      due_date: row.dueDate,
      notes: row.notes,
      approved_by_id: row.approvedById,
      approved_at: row.approvedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      progress: progress(row.snapshot.questions, answers),
      answers: row.snapshot.questions.map((q) => {
        const a = answers.find((answer) => answer.questionId === q.id);
        return {
          question_id: q.id,
          applicable: enabled.get(q.id)!,
          state: a?.state ?? 'pending',
          value: a?.value ?? null,
          notes: a?.notes ?? null,
          responsible_user_id: a?.responsibleUserId ?? null,
          due_date: a?.dueDate ?? null,
          answered_by_id: a?.answeredById ?? null,
          answered_at: a?.answeredAt ?? null,
          allocations: allocations(a?.value ?? null),
        };
      }),
    };
  }
  async get(projectId: number, id: number, actor: ProjectActorContext) {
    const project = await this.project(projectId, actor);
    const row = await this.scopedInstance(project, id);
    return this.view(row, await this.repo.answers(row));
  }
  async update(
    projectId: number,
    id: number,
    dto: UpdatePreparationDto,
    actor: ProjectActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    validDate(dto.scheduled_date);
    validDate(dto.due_date);
    await this.repo.transaction(async (manager) => {
      const row = await this.scopedInstance(project, id, manager);
      if (row.revision !== dto.revision) this.conflict();
      this.editable(row);
      await this.responsible(
        dto.responsible_user_id,
        project.organizationId,
        manager,
      );
      const changes: Partial<ProjectPreparationEntity> = {};
      if (dto.title !== undefined) changes.title = this.text(dto.title);
      if (dto.responsible_user_id !== undefined)
        changes.responsibleUserId = dto.responsible_user_id;
      if (dto.scheduled_date !== undefined)
        changes.scheduledDate = dto.scheduled_date;
      if (dto.due_date !== undefined) changes.dueDate = dto.due_date;
      if (dto.notes !== undefined) changes.notes = dto.notes;
      await this.claim(manager, row, dto.revision, changes);
      await this.audit(
        manager,
        actor,
        project.organizationId,
        'INSTANCE_UPDATED',
        {
          before: {
            title: row.title,
            responsibleUserId: row.responsibleUserId,
            scheduledDate: row.scheduledDate,
            dueDate: row.dueDate,
            notes: row.notes,
          },
          after: changes,
          revision: dto.revision + 1,
        },
        projectId,
        id,
      );
    });
    return this.get(projectId, id, actor);
  }
  private async validateAll(
    questions: PreparationQuestion[],
    answers: PolicyAnswer[],
    project: ProjectEntity,
    manager: EntityManager,
  ) {
    const enabled = applicability(questions, answers);
    const unitIds = new Set(
      (await this.units(project, manager)).map((unit) => unit.id),
    );
    for (const answer of answers) {
      if (!enabled.get(answer.questionId)) continue;
      const q = questions.find(
        (question) => question.id === answer.questionId,
      )!;
      validateAnswer(q, answer, answers);
      if (
        q.type === 'unit_allocations' &&
        Array.isArray(answer.value) &&
        answer.value.some((row) => !unitIds.has(row.unit_id))
      )
        invalid('Unidade não vinculada à empresa e ao projeto deste escopo');
    }
  }
  async saveAnswers(
    projectId: number,
    id: number,
    dto: SaveAnswersDto,
    actor: ProjectActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.repo.transaction(async (manager) => {
      const row = await this.scopedInstance(project, id, manager);
      if (row.revision !== dto.revision) this.conflict();
      this.editable(row);
      const existing = await this.repo.answers(row, manager);
      const merged = new Map<string, PolicyAnswer>(
        existing.map((answer) => [answer.questionId, answer]),
      );
      if (
        new Set(dto.answers.map((answer) => answer.question_id)).size !==
        dto.answers.length
      )
        invalid('Não repita uma pergunta no mesmo lote');
      for (const answer of dto.answers) {
        if (!row.snapshot.questions.some((q) => q.id === answer.question_id))
          invalid('Pergunta não pertence à versão desta instância');
        validDate(answer.due_date);
        await this.responsible(
          answer.responsible_user_id,
          project.organizationId,
          manager,
        );
        merged.set(answer.question_id, {
          questionId: answer.question_id,
          state: answer.state,
          value: answer.value,
          notes: answer.notes ?? null,
        });
      }
      const answers = [...merged.values()];
      const enabled = applicability(row.snapshot.questions, answers);
      if (
        dto.answers.some(
          (answer) =>
            !enabled.get(answer.question_id) ||
            !row.snapshot.questions.find((q) => q.id === answer.question_id)!
              .visible,
        )
      )
        invalid(
          'Pergunta oculta ou desabilitada por condição não pode receber alterações',
        );
      await this.validateAll(row.snapshot.questions, answers, project, manager);
      await this.claim(manager, row, dto.revision, { status: 'in_progress' });
      for (const answer of dto.answers) {
        const before = existing.find(
          (item) => item.questionId === answer.question_id,
        );
        const saved = await manager
          .getRepository(PreparationAnswerEntity)
          .save({
            id: before?.id,
            organizationId: project.organizationId,
            projectId,
            preparationId: id,
            questionId: answer.question_id,
            state: answer.state,
            value: answer.value,
            notes: answer.notes ?? null,
            responsibleUserId:
              answer.responsible_user_id === undefined
                ? (before?.responsibleUserId ?? null)
                : answer.responsible_user_id,
            dueDate:
              answer.due_date === undefined
                ? (before?.dueDate ?? null)
                : answer.due_date,
            answeredById: actor.id,
            answeredAt: answer.state === 'pending' ? null : new Date(),
          });
        await this.audit(
          manager,
          actor,
          project.organizationId,
          'ANSWER_SAVED',
          {
            question_id: answer.question_id,
            question_label: row.snapshot.questions.find(
              (q) => q.id === answer.question_id,
            )!.label,
            before: before ?? null,
            after: saved,
            revision: dto.revision + 1,
          },
          projectId,
          id,
        );
      }
    });
    return this.get(projectId, id, actor);
  }
  async transition(
    projectId: number,
    id: number,
    revision: number,
    action: 'approve' | 'reopen' | 'archive',
    actor: ProjectActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.repo.transaction(async (manager) => {
      const row = await this.scopedInstance(project, id, manager);
      if (row.revision !== revision) this.conflict();
      const changes: Partial<ProjectPreparationEntity> = {};
      if (action === 'approve') {
        this.editable(row);
        const answers = await this.repo.answers(row, manager);
        await this.validateAll(
          row.snapshot.questions,
          answers,
          project,
          manager,
        );
        const missing = progress(
          row.snapshot.questions,
          answers,
        ).missing_required;
        if (missing.length)
          this.conflict(
            `Perguntas obrigatórias pendentes: ${missing.join(', ')}`,
          );
        Object.assign(changes, {
          status: 'approved',
          approvedById: actor.id,
          approvedAt: new Date(),
        });
      } else if (action === 'reopen') {
        if (row.status !== 'approved')
          this.conflict('Somente uma instância aprovada pode ser reaberta');
        Object.assign(changes, {
          status: 'in_progress',
          approvedById: null,
          approvedAt: null,
        });
      } else {
        this.editable(row);
        changes.status = 'archived';
      }
      await this.claim(manager, row, revision, changes);
      await this.audit(
        manager,
        actor,
        project.organizationId,
        `INSTANCE_${action.toUpperCase()}`,
        { before: row.status, after: changes, revision: revision + 1 },
        projectId,
        id,
      );
    });
    return this.get(projectId, id, actor);
  }
  async history(
    projectId: number,
    id: number,
    actor: ProjectActorContext,
    beforeId?: number,
  ) {
    const project = await this.project(projectId, actor);
    await this.scopedInstance(project, id);
    const rows = await this.repo.manager
      .getRepository(PreparationAuditEntity)
      .find({
        where: {
          organizationId: project.organizationId,
          projectId,
          preparationId: id,
          ...(beforeId ? { id: LessThan(beforeId) } : {}),
        },
        order: { id: 'DESC' },
        take: 50,
      });
    return {
      items: rows.map((row) => ({
        id: row.id,
        operation: row.operation,
        performed_by_id: row.performedById,
        created_at: row.createdAt,
        changes: row.changes,
      })),
      next_before_id: rows.length === 50 ? rows.at(-1)!.id : null,
    };
  }
  async communication(
    projectId: number,
    id: number,
    actor: ProjectActorContext,
    channel: 'email' | 'guidance',
  ) {
    const instance = await this.get(projectId, id, actor);
    const context = await this.context(projectId, actor);
    const users = new Map(
      context.responsible_users.map((user) => [user.id, user.label]),
    );
    const lines = [
      channel === 'email'
        ? 'Ata e orientações de preparação'
        : 'Orientações para a equipe técnica',
      `Projeto: ${context.project.name}`,
      `Empresa: ${context.company?.name ?? 'Não vinculada'}`,
      `Documento: ${instance.title} — ${instance.snapshot.name} v${instance.snapshot.version}`,
      `Situação: ${instance.status}`,
      `Responsável: ${users.get(instance.responsible_user_id ?? -1) ?? 'Não definido'}`,
      `Data: ${instance.scheduled_date ?? 'Não definida'} | Prazo: ${instance.due_date ?? 'Não definido'}`,
      ...context.units.map((unit) => `Unidade: ${unit.name} — ${unit.address}`),
      '',
    ];
    for (const question of instance.snapshot.questions) {
      const answer = instance.answers.find(
        (a) => a.question_id === question.id,
      )!;
      if (!question.visible || !answer.applicable || answer.state === 'pending')
        continue;
      const value =
        answer.state === 'not_applicable'
          ? 'Não aplicável'
          : typeof answer.value === 'boolean'
            ? answer.value
              ? 'Sim'
              : 'Não'
            : Array.isArray(answer.value)
              ? answer.allocations
                  .map(
                    (allocation) =>
                      `${context.units.find((unit) => unit.id === allocation.unit_id)?.name ?? 'Unidade desvinculada'}: ${allocation.quantity} itens (${allocation.participation_percent}%)`,
                  )
                  .join('; ')
              : answer.value && typeof answer.value === 'object'
                ? `${answer.value.start} a ${answer.value.end}`
                : String(answer.value);
      lines.push(
        `[${question.category}] ${question.label}: ${value}`,
        ...(answer.notes ? [`Observações: ${answer.notes}`] : []),
      );
    }
    if (instance.notes) lines.push(`Observações gerais: ${instance.notes}`);
    lines.push('', 'Conteúdo para revisão. Esta prévia não foi enviada.');
    await this.audit(
      this.repo.manager,
      actor,
      context.project.organization_id,
      'COMMUNICATION_PREVIEW',
      { channel, revision: instance.revision },
      projectId,
      id,
    );
    return {
      channel,
      recipient: null,
      subject: `${instance.kind === 'kickoff' ? 'Kick-off' : 'Checklist do cliente'} — ${context.project.name}`,
      body: lines.join('\n'),
      delivery_status: 'preview_only' as const,
    };
  }
}
