import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';
import {
  FieldTask,
  FieldChecklist,
  FieldTemplateVersion,
} from '../../../src/modules/field-coordination/field.entity';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { FieldAgentEntity } from '../../../src/modules/field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../../src/modules/field-agents/infrastructure/persistence/project-field-agent.entity';
import { FieldAgentStatus } from '../../../src/modules/field-agents/domain/enums/field-agent-status.enum';
import { ProjectFieldAgentStatus } from '../../../src/modules/field-agents/domain/enums/project-field-agent-status.enum';
import { InventoryPendingIssueEntity } from '../../../src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { InventoryPendingIssueStatus } from '../../../src/modules/inventory-pending-issues/domain/enums/inventory-pending-issue-status.enum';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import { ProjectStatus } from '../../../src/modules/projects/domain/enums/project-status.enum';
import type { FieldDefinition } from '../../../src/modules/field-coordination/field.policy';

describe('Field coordination real HTTP persistence, scope and concurrency', () => {
  let app: INestApplication,
    ds: DataSource,
    admin: string,
    platform: string,
    user: string,
    project: number,
    other: number,
    foreign: number,
    template: number;
  const h = (token = admin) => ({ Authorization: `Bearer ${token}` });
  const post = (path: string, body: object, token = admin) =>
    request(app.getHttpServer())
      .post('/api/v1' + path)
      .set(h(token))
      .send(body);
  const get = (path: string, token = admin) =>
    request(app.getHttpServer())
      .get('/api/v1' + path)
      .set(h(token));
  const patch = (path: string, body: object, token = admin) =>
    request(app.getHttpServer())
      .patch('/api/v1' + path)
      .set(h(token))
      .send(body);
  const def = (): FieldDefinition => ({
    groups: [
      {
        id: 'stage3',
        title: 'Obrigatórias da terceira etapa',
        order: 3,
        required: false,
      },
    ],
    tasks: [
      {
        id: 'task',
        group_id: 'stage3',
        title: 'Verificar campo',
        order: 0,
        required: true,
        allow_not_applicable: true,
        requires_responsible: true,
        requires_due_date: true,
        requires_notes: true,
        requires_approval: true,
        requires_issue_resolved: false,
      },
    ],
  });
  const base = (p = project) => `/projects/${p}/field-coordination`;
  let seq = 0;
  const create = async (p = project, t = template) => {
    const dto = {
      template_id: t,
      title: 'Checklist sintético',
      command_key: 'create-key-' + ++seq,
    };
    const result = await post(base(p), dto);
    expect(result.status).toBe(201);
    return result.body as { id: number; revision: number };
  };
  const taskOf = async (id: number) =>
    ((await get(base() + `/${id}/tasks`)).body.items as FieldTask[])[0];
  const save = (
    id: number,
    task: number,
    revision: number,
    values: object,
    token = admin,
  ) => patch(base() + `/${id}/tasks/${task}`, { revision, ...values }, token);
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    platform = await loginAsAdmin(app);
    user = await loginAsOrgUser(app);
    project = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'Campo A',
      })
    ).body.id as number;
    other = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'Campo B',
      })
    ).body.id as number;
    const org = (
      await post(
        '/organizations',
        { legal_name: 'Campo Outra Org', cnpj: '11444777000161' },
        platform,
      )
    ).body.id as number;
    const company = (
      await post(
        '/companies',
        { organization_id: org, name: 'Outra empresa' },
        platform,
      )
    ).body.id as number;
    foreign = (
      await post(
        '/projects',
        { organization_id: org, company_id: company, name: 'Campo privado' },
        platform,
      )
    ).body.id as number;
    const model = await post('/organizations/1/field-templates', {
      name: 'Modelo campo',
      definition: def(),
    });
    expect(model.status).toBe(201);
    template = model.body.id as number;
  });
  afterAll(async () => {
    await app?.close();
  });
  it('registers organizational permissions, rejects no session and custom user without grants', async () => {
    expect(
      (await ds.getRepository(PermissionEntity).find()).filter(
        (p) => p.resource === 'field-coordination',
      ),
    ).toHaveLength(3);
    expect(
      (await request(app.getHttpServer()).get('/api/v1' + base())).status,
    ).toBe(401);
    expect((await get(base(), user)).status).toBe(403);
  });
  it('versions models, preserves snapshots, independently creates project instances and replays creation safely', async () => {
    const a = await create(),
      b = await create(other);
    expect(a.id).not.toBe(b.id);
    const changed = def();
    changed.tasks[0].title = 'Versão alterada';
    expect(
      (
        await patch('/organizations/1/field-templates/' + template, {
          name: 'Modelo 2',
          expected_version: 1,
          definition: changed,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await patch('/organizations/1/field-templates/' + template, {
          name: 'Obsoleto',
          expected_version: 1,
          definition: changed,
        })
      ).status,
    ).toBe(409);
    expect((await get(base() + `/${a.id}`)).body.snapshot.tasks[0].title).toBe(
      'Verificar campo',
    );
    expect(
      await ds
        .getRepository(FieldTemplateVersion)
        .countBy({ templateId: template }),
    ).toBe(2);
    const dto = {
      template_id: template,
      title: 'Idempotente',
      command_key: 'creation-replay-test',
    };
    const first = await post(base(), dto),
      replay = await post(base(), dto);
    expect(replay.body.id).toBe(first.body.id);
    expect((await post(base(), { ...dto, title: 'Diferente' })).status).toBe(
      409,
    );
    expect((await get(base(other) + `/${a.id}`)).status).toBe(404);
  });
  it('validates every mandatory stage, task requirements, approval, completion and reasoned reopening without finishing the project', async () => {
    const row = await create();
    let task = await taskOf(row.id);
    expect(
      (
        await post(base() + `/${row.id}/transition`, {
          revision: 1,
          action: 'complete',
          command_key: 'reject-complete',
        })
      ).status,
    ).toBe(409);
    expect(
      (await save(row.id, task.id, 1, { state: 'completed' })).status,
    ).toBe(400);
    const userId = (
      await ds.getRepository(UserEntity).findOneByOrFail({ login: 'org.admin' })
    ).id;
    expect(
      (
        await save(row.id, task.id, 1, {
          state: 'completed',
          responsible_user_id: userId,
          due_date: '2026-10-27',
          notes: 'Verificação real',
        })
      ).status,
    ).toBe(200);
    expect(
      (await get(base() + `/${row.id}/readiness`)).body.blockers[0].code,
    ).toBe('APPROVAL_REQUIRED');
    expect((await save(row.id, task.id, 1, { notes: 'stale' })).status).toBe(
      409,
    );
    expect(
      (
        await post(base() + `/${row.id}/tasks/${task.id}/approve`, {
          revision: 2,
          command_key: 'approve-task-' + row.id,
        })
      ).status,
    ).toBe(201);
    const dto = {
      revision: 3,
      action: 'complete',
      command_key: 'complete-' + row.id,
    };
    const approvalReplay = await post(
      base() + `/${row.id}/tasks/${task.id}/approve`,
      { revision: 2, command_key: 'approve-task-' + row.id },
    );
    expect(approvalReplay.status).toBe(201);
    expect(approvalReplay.body.revision).toBe(3);
    const completed = await post(base() + `/${row.id}/transition`, dto);
    expect(completed.status).toBe(201);
    expect(completed.body.status).toBe('completed');
    expect(
      (await post(base() + `/${row.id}/transition`, dto)).body.revision,
    ).toBe(4);
    expect(
      (await save(row.id, task.id, 4, { state: 'pending', reason: 'revisão' }))
        .status,
    ).toBe(409);
    expect(
      (
        await post(base() + `/${row.id}/transition`, {
          revision: 4,
          action: 'reopen',
          command_key: 'reopen-no-reason',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(base() + `/${row.id}/transition`, {
          revision: 4,
          action: 'reopen',
          command_key: 'reopen-' + row.id,
          reason: 'Nova conferência',
        })
      ).body.status,
    ).toBe('open');
    expect(
      (
        await save(row.id, task.id, 5, {
          state: 'in_progress',
          reason: 'Ajustar evidências',
        })
      ).status,
    ).toBe(200);
    task = await taskOf(row.id);
    expect(task.approvedById).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(
      (await ds.getRepository(ProjectEntity).findOneByOrFail({ id: project }))
        .status,
    ).toBe(ProjectStatus.DRAFT);
    expect(
      (await get(base() + `/${row.id}/history`)).body.items.length,
    ).toBeGreaterThanOrEqual(5);
  });
  it('computes SQL KPIs, blocked/overdue/N/A denominators and conditional task applicability', async () => {
    const definition = def();
    definition.tasks[0] = {
      ...definition.tasks[0],
      requires_responsible: false,
      requires_due_date: false,
      requires_notes: false,
      requires_approval: false,
    };
    definition.tasks.push({
      ...definition.tasks[0],
      id: 'conditional',
      title: 'Condicional',
      applicable_if: [{ task_id: 'task', states: ['completed'] }],
    });
    const model = (
      await post('/organizations/1/field-templates', {
        name: 'Condicional',
        definition,
      })
    ).body.id as number;
    const row = await create(project, model),
      task = await taskOf(row.id);
    expect(
      (
        await save(row.id, task.id, 1, {
          state: 'blocked',
          due_date: '2020-01-01',
        })
      ).status,
    ).toBe(200);
    let summary = (await get(base() + `/${row.id}/dashboard`)).body.summary;
    expect(summary.total).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.percent).toBe(0);
    expect(summary.conditionallyExcluded).toBe(1);
    expect(
      (await save(row.id, task.id, 2, { state: 'not_applicable' })).status,
    ).toBe(400);
    expect(
      (
        await save(row.id, task.id, 2, {
          state: 'not_applicable',
          reason: 'Fora do escopo',
        })
      ).status,
    ).toBe(200);
    summary = (await get(base() + `/${row.id}/dashboard`)).body.summary;
    expect(summary.notApplicable).toBe(1);
    expect(summary.percent).toBe(100);
    expect(summary.overdue).toBe(0);
    expect(
      (
        await save(row.id, task.id, 3, {
          state: 'in_progress',
          reason: 'Novo escopo',
        })
      ).status,
    ).toBe(200);
    expect(
      (await save(row.id, task.id, 4, { state: 'completed' })).status,
    ).toBe(200);
    summary = (await get(base() + `/${row.id}/dashboard`)).body.summary;
    expect(summary.total).toBe(2);
    expect(summary.percent).toBe(50);
    expect(
      (await get(base() + `/${row.id}/tasks?state=pending&page_size=1`)).body
        .total,
    ).toBe(1);
  });
  it('distinguishes users from linked field agents and rejects foreign IDs, invalid dates and unlinked agents', async () => {
    const row = await create(),
      task = await taskOf(row.id);
    const agent = await ds.getRepository(FieldAgentEntity).save({
      organizationId: 1,
      name: 'Técnico',
      status: FieldAgentStatus.ACTIVE,
    });
    expect(
      (await save(row.id, task.id, 1, { field_agent_id: agent.id })).status,
    ).toBe(400);
    await ds.getRepository(ProjectFieldAgentEntity).save({
      organizationId: 1,
      projectId: project,
      fieldAgentId: agent.id,
      status: ProjectFieldAgentStatus.ACTIVE,
    });
    expect(
      (
        await save(row.id, task.id, 1, {
          field_agent_id: agent.id,
          due_date: '2026-99-99',
        })
      ).status,
    ).toBe(400);
    expect(
      (await save(row.id, task.id, 1, { field_agent_id: agent.id })).status,
    ).toBe(200);
    const userId = (
      await ds.getRepository(UserEntity).findOneByOrFail({ login: 'org.admin' })
    ).id;
    expect(
      (await save(row.id, task.id, 2, { responsible_user_id: userId })).status,
    ).toBe(400);
    expect(
      (await get(base() + `/context?kind=field_agent`)).body.items[0].kind,
    ).toBe('field_agent');
    await ds
      .getRepository(ProjectFieldAgentEntity)
      .update(
        { fieldAgentId: agent.id, projectId: project },
        { endDate: new Date('2020-01-01T00:00:00Z') },
      );
    expect(
      (await get(base() + '/context?kind=field_agent')).body.items,
    ).toHaveLength(0);
    expect((await save(row.id, task.id, 2, { priority: 'high' })).status).toBe(
      400,
    );
    expect(
      (
        await save(row.id, task.id, 2, {
          field_agent_id: null,
          responsible_user_id: 99999,
        })
      ).status,
    ).toBe(400);
  });
  it('links real pending issues without changing them and rechecks their current status before completion', async () => {
    const row = await create(),
      task = await taskOf(row.id);
    const issue = await ds.getRepository(InventoryPendingIssueEntity).save({
      organizationId: 1,
      projectId: project,
      title: 'Ocorrência',
      type: 'other' as InventoryPendingIssueEntity['type'],
      status: InventoryPendingIssueStatus.OPEN,
    });
    expect(
      (await save(row.id, task.id, 1, { linked_issue_id: issue.id })).status,
    ).toBe(200);
    expect(
      (await get(base() + `/${row.id}/tasks`)).body.items[0].issue.status,
    ).toBe('open');
    const foreignIssue = await ds
      .getRepository(InventoryPendingIssueEntity)
      .save({
        organizationId: 1,
        projectId: other,
        title: 'Outro projeto',
        type: 'other' as InventoryPendingIssueEntity['type'],
        status: InventoryPendingIssueStatus.OPEN,
      });
    expect(
      (await save(row.id, task.id, 2, { linked_issue_id: foreignIssue.id }))
        .status,
    ).toBe(400);
    expect(
      (
        await ds
          .getRepository(InventoryPendingIssueEntity)
          .findOneByOrFail({ id: issue.id })
      ).status,
    ).toBe('open');
  });
  it('supports local task creation, detects concurrency, previews messages without delivery and blocks terminal project writes', async () => {
    const row = await create(),
      task = await taskOf(row.id),
      definition = { ...def().tasks[0], id: 'additional', title: 'Adicional' };
    expect(
      (await post(base() + `/${row.id}/tasks`, { revision: 1, definition }))
        .status,
    ).toBe(201);
    const [a, b] =
      ds.options.type === 'mysql'
        ? await Promise.all([
            save(row.id, task.id, 2, { priority: 'high' }),
            save(row.id, task.id, 2, { priority: 'low' }),
          ])
        : [
            await save(row.id, task.id, 2, { priority: 'high' }),
            await save(row.id, task.id, 2, { priority: 'low' }),
          ];
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const message = await get(base() + `/${row.id}/message?kind=initial`);
    expect(message.body.sent).toBe(false);
    expect(message.body.text).toContain('Nenhuma mensagem');
    await ds
      .getRepository(ProjectEntity)
      .update({ id: project }, { status: ProjectStatus.FINISHED });
    expect(
      (await save(row.id, task.id, 3, { priority: 'normal' })).status,
    ).toBe(409);
    expect((await get(base() + `/${row.id}/dashboard`)).status).toBe(200);
    await ds
      .getRepository(ProjectEntity)
      .update({ id: project }, { status: ProjectStatus.DRAFT });
  });
  it('requires a linked resolved issue when configured and never synchronizes issue and task states', async () => {
    const definition = def();
    Object.assign(definition.tasks[0], {
      requires_responsible: false,
      requires_due_date: false,
      requires_notes: false,
      requires_approval: false,
      requires_issue_resolved: true,
    });
    const model = (
      await post('/organizations/1/field-templates', {
        name: 'Dependência patrimonial',
        definition,
      })
    ).body.id as number;
    const row = await create(project, model),
      task = await taskOf(row.id);
    const issue = await ds.getRepository(InventoryPendingIssueEntity).save({
      organizationId: 1,
      projectId: project,
      title: 'Ocorrência dependente',
      type: 'other' as InventoryPendingIssueEntity['type'],
      status: InventoryPendingIssueStatus.OPEN,
    });
    expect(
      (
        await save(row.id, task.id, 1, {
          linked_issue_id: issue.id,
          state: 'completed',
        })
      ).status,
    ).toBe(400);
    expect((await taskOf(row.id)).state).toBe('pending');
    await ds
      .getRepository(InventoryPendingIssueEntity)
      .update(
        { id: issue.id },
        { status: InventoryPendingIssueStatus.RESOLVED },
      );
    expect(
      (
        await save(row.id, task.id, 1, {
          linked_issue_id: issue.id,
          state: 'completed',
        })
      ).status,
    ).toBe(200);
    await ds
      .getRepository(InventoryPendingIssueEntity)
      .update({ id: issue.id }, { status: InventoryPendingIssueStatus.OPEN });
    const ready = await get(base() + `/${row.id}/readiness`);
    expect(ready.body.can_complete).toBe(false);
    expect(ready.body.blockers[0].code).toBe('TASK_REQUIREMENTS');
    expect((await taskOf(row.id)).state).toBe('completed');
  });
  it('archives and restores templates with optimistic versions while retaining versioned snapshots', async () => {
    expect(
      (
        await post(
          '/organizations/1/field-templates/' + template + '/archive',
          { expected_version: 2, archived: true },
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await post(base(), {
          template_id: template,
          title: 'Bloqueado',
          command_key: 'archived-model-create',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await get(
          '/organizations/1/field-templates/' + template + '/versions/1',
        )
      ).body.definition.tasks[0].title,
    ).toBe('Verificar campo');
    expect(
      (
        await post(
          '/organizations/1/field-templates/' + template + '/archive',
          { expected_version: 3, archived: false },
        )
      ).status,
    ).toBe(201);
  });
  it('fails closed for missing catalog and restricts edit, coordinate, foreign projects, parents and models', async () => {
    const row = await create(),
      task = await taskOf(row.id);
    const issue = await ds.getRepository(InventoryPendingIssueEntity).save({
      organizationId: 1,
      projectId: project,
      title: 'Pendência com leitura separada',
      type: 'other' as InventoryPendingIssueEntity['type'],
      status: InventoryPendingIssueStatus.OPEN,
    });
    expect(
      (await save(row.id, task.id, 1, { linked_issue_id: issue.id })).status,
    ).toBe(200);
    const role = await ds
      .getRepository(RoleEntity)
      .findOneByOrFail({ name: 'Operador' });
    const permissions = await ds.getRepository(PermissionEntity).find();
    await ds.getRepository(RolePermissionEntity).delete({ roleId: role.id });
    await ds
      .getRepository(RolePermissionEntity)
      .save(
        permissions
          .filter((p) =>
            ['field-coordination:read', 'field-coordination:edit'].includes(
              p.key,
            ),
          )
          .map((p) => ({ roleId: role.id, permissionId: p.id })),
      );
    expect((await get(base(), user)).status).toBe(200);
    const masked = await get(base() + `/${row.id}/tasks`, user);
    expect(masked.body.items[0].issue).toBeNull();
    expect(masked.body.items[0].linkedIssueId).toBeNull();
    const edited = await save(
      row.id,
      task.id,
      2,
      { notes: 'Sem leitura da pendência' },
      user,
    );
    expect(edited.status).toBe(200);
    expect(edited.body.task.linkedIssueId).toBeNull();
    expect(
      (
        await post(
          base() + `/${row.id}/tasks/${task.id}/approve`,
          { revision: 1 },
          user,
        )
      ).status,
    ).toBe(403);
    expect((await get(base(foreign))).status).toBe(403);
    expect((await get('/organizations/2/field-templates')).status).toBe(403);
    expect((await get(base(other) + `/${row.id}/tasks`)).status).toBe(404);
    expect(
      (
        await post(
          base(foreign),
          {
            template_id: template,
            title: 'Proibido',
            command_key: 'foreign-command',
          },
          platform,
        )
      ).status,
    ).toBe(404);
    const grant = permissions.find(
      (p) => p.key === 'field-coordination:coordinate',
    )!;
    await ds
      .getRepository(PermissionEntity)
      .update({ id: grant.id }, { key: grant.key + '.missing' });
    expect(
      (
        await post(base() + `/${row.id}/transition`, {
          revision: 1,
          action: 'complete',
          command_key: 'missing-catalog',
        })
      ).status,
    ).toBe(403);
    await ds
      .getRepository(PermissionEntity)
      .update({ id: grant.id }, { key: grant.key });
    expect(await ds.getRepository(FieldChecklist).count()).toBeGreaterThan(1);
  });
});
