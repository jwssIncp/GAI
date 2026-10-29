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
import { PreparationQuestion } from '../../../src/modules/project-preparation/domain/preparation.types';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import { ProjectStatus } from '../../../src/modules/projects/domain/enums/project-status.enum';

describe('Project preparation: real HTTP persistence, RBAC and tenant isolation', () => {
  let app: INestApplication;
  let admin: string;
  let platform: string;
  let user: string;
  let project: number;
  let secondProject: number;
  let otherProject: number;
  let otherOrg: number;
  let roleId: number;
  let template: number;
  const auth = (token = admin) => ({ Authorization: `Bearer ${token}` });
  const base = () => `/api/v1/projects/${project}/preparations`;
  const templates = '/api/v1/organizations/1/preparation-templates';
  const q = (
    id: string,
    overrides: Partial<PreparationQuestion> = {},
  ): PreparationQuestion => ({
    id,
    category: 'Geral',
    label: id,
    type: 'text',
    order: 1,
    required: false,
    visible: true,
    allow_not_applicable: false,
    ...overrides,
  });
  const questions = () => [
    q('flag', { type: 'boolean', required: true, order: 0 }),
    q('details', {
      required: true,
      allow_not_applicable: true,
      enabled_when: [{ question_id: 'flag', operator: 'equals', value: true }],
    }),
    q('quantity', { type: 'number', order: 2 }),
    q('sequence', {
      type: 'sequence',
      quantity_question_id: 'quantity',
      order: 3,
    }),
    q('units', { type: 'unit_allocations', order: 4 }),
    q('hidden', { visible: false, order: 5 }),
  ];
  const post = (url: string, body: object = {}, token = admin, status = 201) =>
    request(app.getHttpServer())
      .post(url)
      .set(auth(token))
      .send(body)
      .expect(status);
  const get = (url: string, token = admin, status = 200) =>
    request(app.getHttpServer()).get(url).set(auth(token)).expect(status);
  const patch = (url: string, body: object, token = admin, status = 200) =>
    request(app.getHttpServer())
      .patch(url)
      .set(auth(token))
      .send(body)
      .expect(status);
  const create = async (templateId = template, projectId = project) =>
    (
      await post(`/api/v1/projects/${projectId}/preparations`, {
        template_id: templateId,
        title: 'Preparação sintética',
        scheduled_date: '2028-02-29',
        due_date: '2028-03-31',
      })
    ).body as { id: number; revision: number };
  const answer = (
    question_id: string,
    value: unknown,
    state = 'completed',
    notes?: string,
  ) => ({ question_id, value, state, ...(notes ? { notes } : {}) });
  async function grant(keys: string[]) {
    const ds = app.get(DataSource);
    const repo = ds.getRepository(RolePermissionEntity);
    await repo.delete({ roleId });
    const permissions = await ds.getRepository(PermissionEntity).find();
    await repo.save(
      permissions
        .filter((p) => keys.includes(p.key))
        .map((p) => ({ roleId, permissionId: p.id })),
    );
  }
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    platform = await loginAsAdmin(app);
    user = await loginAsOrgUser(app);
    roleId = (
      await app
        .get(DataSource)
        .getRepository(RoleEntity)
        .findOneByOrFail({ name: 'Operador' })
    ).id;
    project = (
      await post('/api/v1/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'Preparação A',
      })
    ).body.id as number;
    secondProject = (
      await post('/api/v1/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'Preparação A2',
      })
    ).body.id as number;
    otherOrg = (
      await post(
        '/api/v1/organizations',
        { legal_name: 'Organização B privada', cnpj: '11444777000161' },
        platform,
      )
    ).body.id as number;
    const company = await post(
      '/api/v1/companies',
      {
        organization_id: otherOrg,
        name: 'Empresa B privada',
        corporate_name: 'Empresa B privada',
        document: '11444777000161',
      },
      platform,
    );
    otherProject = (
      await post(
        '/api/v1/projects',
        {
          organization_id: otherOrg,
          company_id: company.body.id as number,
          name: 'Projeto B privado',
        },
        platform,
      )
    ).body.id as number;
    template = (
      await post(templates, {
        name: 'Modelo sintético',
        kind: 'kickoff',
        questions: questions(),
      })
    ).body.id as number;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('registers all three organizational permissions in the live catalog', async () => {
    const permissions = await app
      .get(DataSource)
      .getRepository(PermissionEntity)
      .find();
    expect(
      permissions
        .filter((p) => p.resource === 'project-preparation')
        .map((p) => [p.action, p.scope])
        .sort(),
    ).toEqual([
      ['approve', 'ORGANIZATION'],
      ['edit', 'ORGANIZATION'],
      ['read', 'ORGANIZATION'],
    ]);
  });
  it('creates, lists and reads model versions, clones and archives without deleting history', async () => {
    const original = await post(templates, {
      name: 'CRUD modelo',
      kind: 'client_checklist',
      questions: [q('identity')],
    });
    const id = original.body.id as number;
    await patch(`${templates}/${id}`, {
      name: 'CRUD modelo v2',
      questions: [q('identity', { label: 'Novo texto' })],
      expected_version: 1,
    });
    const old = await get(`${templates}/${id}/versions/1`);
    expect(old.body.questions[0].label).toBe('identity');
    const clone = await post(`${templates}/${id}/clone`);
    expect(clone.body.current_version).toBe(1);
    expect(clone.body.organization_id).toBe(1);
    await request(app.getHttpServer())
      .delete(`${templates}/${id}`)
      .set(auth())
      .send({ revision: 2 })
      .expect(200);
    const archived = await get(`${templates}/${id}`);
    expect(archived.body.archived_at).toBeTruthy();
    expect(archived.body.versions).toHaveLength(2);
    expect(
      (await get(templates)).body.items.some(
        (item: { id: number }) => item.id === id,
      ),
    ).toBe(true);
    await post(base(), { template_id: id, title: 'Bloqueada' }, admin, 409);
    await patch(
      `${templates}/${id}`,
      { name: 'Não pode', questions: [q('identity')], expected_version: 2 },
      admin,
      409,
    );
  });
  it('rejects concurrent/stale template updates and type changes of stable IDs', async () => {
    const item = await post(templates, {
      name: 'Versões',
      kind: 'kickoff',
      questions: [q('stable')],
    });
    const id = item.body.id as number;
    await patch(`${templates}/${id}`, {
      name: 'v2',
      questions: [q('stable')],
      expected_version: 1,
    });
    await patch(
      `${templates}/${id}`,
      { name: 'stale', questions: [q('stable')], expected_version: 1 },
      admin,
      409,
    );
    await patch(
      `${templates}/${id}`,
      {
        name: 'tipo',
        questions: [q('stable', { type: 'number' })],
        expected_version: 2,
      },
      admin,
      400,
    );
  });
  it.each([
    [q('hidden-required', { visible: false, required: true })],
    [q('duplicate'), q('duplicate')],
    [
      q('cycle-aa', {
        enabled_when: [{ question_id: 'cycle-bb', operator: 'answered' }],
      }),
      q('cycle-bb', {
        enabled_when: [{ question_id: 'cycle-aa', operator: 'answered' }],
      }),
    ],
    [
      q('unknown', {
        enabled_when: [
          { question_id: 'missing', operator: 'equals', value: true },
        ],
      }),
    ],
    [
      q('boolean-aa', { type: 'boolean' }),
      q('boolean-bb', {
        enabled_when: [
          { question_id: 'boolean-aa', operator: 'equals', value: 'SIM' },
        ],
      }),
    ],
  ])('rejects invalid template definitions %#', async (...definition) => {
    await post(
      templates,
      { name: 'Inválido', kind: 'kickoff', questions: definition },
      admin,
      400,
    );
  });
  it('creates independent kickoff and client-checklist instances without sharing project answers', async () => {
    const a = await create();
    const b = await create(template, secondProject);
    const client = await post(templates, {
      name: 'Cliente separado',
      kind: 'client_checklist',
      questions: [q('flag', { type: 'boolean' })],
    });
    const c = await create(client.body.id as number);
    await patch(`${base()}/${a.id}/answers`, {
      revision: 1,
      answers: [answer('flag', false)],
    });
    expect(
      (await get(`/api/v1/projects/${secondProject}/preparations/${b.id}`)).body
        .answers[0].state,
    ).toBe('pending');
    const independent = await get(`${base()}/${c.id}`);
    expect(independent.body.kind).toBe('client_checklist');
    expect(independent.body.answers[0].state).toBe('pending');
    expect((await get(`${base()}/${a.id}`)).body.scheduled_date).toBe(
      '2028-02-29',
    );
  });
  it('keeps immutable snapshots and answers after model text, order and visibility change', async () => {
    const model = await post(templates, {
      name: 'Histórico original',
      kind: 'kickoff',
      questions: [q('original', { label: 'Texto original' })],
    });
    const id = model.body.id as number;
    const instance = await create(id);
    await patch(`${base()}/${instance.id}/answers`, {
      revision: 1,
      answers: [answer('original', 'Resposta histórica')],
    });
    await patch(`${templates}/${id}`, {
      name: 'Modelo alterado',
      expected_version: 1,
      questions: [
        q('other'),
        q('original', { label: 'Texto diferente', visible: false, order: 2 }),
      ],
    });
    const old = await get(`${base()}/${instance.id}`);
    expect(old.body.snapshot.name).toBe('Histórico original');
    expect(old.body.snapshot.version).toBe(1);
    expect(old.body.snapshot.questions[0].label).toBe('Texto original');
    expect(old.body.answers[0].value).toBe('Resposta histórica');
    const newer = await create(id);
    expect((await get(`${base()}/${newer.id}`)).body.snapshot.version).toBe(2);
  });
  it('enforces enablement on direct API calls and retains inactive historical values', async () => {
    const item = await create();
    await patch(
      `${base()}/${item.id}/answers`,
      { revision: 1, answers: [answer('details', 'Não habilitada')] },
      admin,
      400,
    );
    await patch(
      `${base()}/${item.id}/answers`,
      { revision: 1, answers: [answer('hidden', 'Oculta')] },
      admin,
      400,
    );
    const enabled = await patch(`${base()}/${item.id}/answers`, {
      revision: 1,
      answers: [answer('flag', true), answer('details', 'Valor preservado')],
    });
    expect(
      enabled.body.answers.find(
        (a: { question_id: string }) => a.question_id === 'details',
      ).applicable,
    ).toBe(true);
    const disabled = await patch(`${base()}/${item.id}/answers`, {
      revision: 2,
      answers: [answer('flag', false)],
    });
    const detail = disabled.body.answers.find(
      (a: { question_id: string }) => a.question_id === 'details',
    );
    expect(detail.applicable).toBe(false);
    expect(detail.value).toBe('Valor preservado');
    expect(disabled.body.progress.conditionally_disabled).toBe(1);
    expect(disabled.body.progress.hidden).toBe(1);
  });
  it('distinguishes pending, explicit N/A and completion, and validates mandatory approval', async () => {
    const item = await create();
    await post(`${base()}/${item.id}/approve`, { revision: 1 }, admin, 409);
    await patch(
      `${base()}/${item.id}/answers`,
      {
        revision: 1,
        answers: [answer('flag', null, 'not_applicable', 'Não permitido')],
      },
      admin,
      400,
    );
    await patch(
      `${base()}/${item.id}/answers`,
      {
        revision: 1,
        answers: [
          answer('flag', true),
          answer('details', null, 'not_applicable'),
        ],
      },
      admin,
      400,
    );
    const saved = await patch(`${base()}/${item.id}/answers`, {
      revision: 1,
      answers: [
        answer('flag', true),
        answer('details', null, 'not_applicable', 'Fora do escopo acordado'),
      ],
    });
    expect(saved.body.progress).toMatchObject({
      total: 5,
      completed: 1,
      not_applicable: 1,
      pending: 3,
      percent: 40,
      missing_required: [],
    });
    await post(`${base()}/${item.id}/approve`, { revision: 2 }, admin, 200);
    await patch(
      `${base()}/${item.id}/answers`,
      { revision: 3, answers: [answer('flag', false)] },
      admin,
      409,
    );
    await post(`${base()}/${item.id}/reopen`, { revision: 3 }, admin, 200);
    const pending = await patch(`${base()}/${item.id}/answers`, {
      revision: 4,
      answers: [answer('details', null, 'pending')],
    });
    expect(pending.body.progress.missing_required).toEqual(['details']);
  });
  it('rejects unknown IDs, duplicate answers, invalid typed values, sequence length and stale revisions atomically', async () => {
    const item = await create();
    for (const answers of [
      [answer('missing', 'x')],
      [answer('flag', true), answer('flag', false)],
      [answer('flag', 'SIM')],
      [answer('quantity', 3), answer('sequence', { start: 8, end: 4 })],
      [answer('quantity', 3), answer('sequence', { start: 1, end: 4 })],
    ])
      await patch(
        `${base()}/${item.id}/answers`,
        { revision: 1, answers },
        admin,
        400,
      );
    const saved = await patch(`${base()}/${item.id}/answers`, {
      revision: 1,
      answers: [
        answer('quantity', 3),
        answer('sequence', { start: 8, end: 10 }),
      ],
    });
    expect(saved.body.revision).toBe(2);
    await patch(
      `${base()}/${item.id}/answers`,
      { revision: 1, answers: [answer('quantity', 4)] },
      admin,
      409,
    );
    await patch(
      `${base()}/${item.id}/answers`,
      { revision: 2, answers: [answer('quantity', 4)] },
      admin,
      400,
    );
    expect((await get(`${base()}/${item.id}`)).body.revision).toBe(2);
  });
  it('validates responsible users and civil dates and persists metadata with audit actor/date', async () => {
    const item = await create();
    const context = await get(`${base()}/context`);
    const owner = context.body.responsible_users[0].id as number;
    const foreign = await app
      .get(DataSource)
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'platform.admin' });
    await patch(
      `${base()}/${item.id}`,
      { revision: 1, responsible_user_id: foreign.id },
      admin,
      400,
    );
    await patch(
      `${base()}/${item.id}`,
      { revision: 1, due_date: '2026-02-30' },
      admin,
      400,
    );
    await patch(
      `${base()}/${item.id}`,
      { revision: 1, title: null },
      admin,
      400,
    );
    await patch(`${base()}/${item.id}`, {
      revision: 1,
      title: 'Nome atualizado',
      responsible_user_id: owner,
      scheduled_date: '2028-02-29',
      due_date: '2028-03-31',
      notes: 'Notas persistidas',
    });
    const result = await get(`${base()}/${item.id}`);
    expect(result.body).toMatchObject({
      title: 'Nome atualizado',
      responsible_user_id: owner,
      scheduled_date: '2028-02-29',
      due_date: '2028-03-31',
      notes: 'Notas persistidas',
    });
    const history = await get(`${base()}/${item.id}/history`);
    expect(
      history.body.items.some(
        (row: {
          operation: string;
          performed_by_id: number;
          created_at: string;
        }) =>
          row.operation === 'INSTANCE_UPDATED' &&
          row.performed_by_id === owner &&
          Boolean(row.created_at),
      ),
    ).toBe(true);
  });
  it('archives instances without losing answers or audit records', async () => {
    const item = await create();
    await patch(`${base()}/${item.id}/answers`, {
      revision: 1,
      answers: [answer('flag', false)],
    });
    await request(app.getHttpServer())
      .delete(`${base()}/${item.id}`)
      .set(auth())
      .send({ revision: 2 })
      .expect(200);
    const archived = await get(`${base()}/${item.id}`);
    expect(archived.body.status).toBe('archived');
    expect(archived.body.answers[0].value).toBe(false);
    await patch(
      `${base()}/${item.id}`,
      { revision: 3, title: 'Bloqueada' },
      admin,
      409,
    );
    expect(
      (await get(`${base()}/${item.id}/history`)).body.items.length,
    ).toBeGreaterThanOrEqual(3);
  });
  it('reuses linked units and computes reproducible participation, rejecting foreign and unlinked units', async () => {
    const first = await post('/api/v1/companies/1/units', {
      name: 'Unidade Alfa',
      address: 'Rua Alfa',
      city: 'Belo Horizonte',
      state: 'MG',
    });
    const second = await post('/api/v1/companies/1/units', {
      name: 'Unidade Beta',
    });
    const unlinked = await post('/api/v1/companies/1/units', {
      name: 'Unidade sem vínculo',
    });
    for (const id of [first.body.id, second.body.id])
      await post(`/api/v1/projects/${project}/units`, { company_unit_id: id });
    const item = await create();
    for (const value of [
      [{ unit_id: unlinked.body.id, quantity: 1 }],
      [{ unit_id: 999999, quantity: 1 }],
      [{ unit_id: first.body.id, quantity: -1 }],
      [
        { unit_id: first.body.id, quantity: 1 },
        { unit_id: first.body.id, quantity: 2 },
      ],
    ])
      await patch(
        `${base()}/${item.id}/answers`,
        { revision: 1, answers: [answer('units', value)] },
        admin,
        400,
      );
    const saved = await patch(`${base()}/${item.id}/answers`, {
      revision: 1,
      answers: [
        answer('units', [
          { unit_id: first.body.id, quantity: 3 },
          { unit_id: second.body.id, quantity: 7 },
        ]),
      ],
    });
    expect(
      saved.body.answers
        .find((a: { question_id: string }) => a.question_id === 'units')
        .allocations.map(
          (a: { participation_percent: number }) => a.participation_percent,
        ),
    ).toEqual([30, 70]);
    const context = await get(`${base()}/context`);
    expect(context.body.units).toHaveLength(2);
    const other = await create(template, secondProject);
    await patch(
      `/api/v1/projects/${secondProject}/preparations/${other.id}/answers`,
      {
        revision: 1,
        answers: [answer('units', [{ unit_id: first.body.id, quantity: 3 }])],
      },
      admin,
      400,
    );
  });
  it('blocks unauthenticated, read-only, edit-without-approval and missing-catalog access', async () => {
    const item = await create();
    await request(app.getHttpServer()).get(base()).expect(401);
    await grant([]);
    await get(base(), user, 403);
    await grant(['project-preparation:read']);
    await get(base(), user);
    await post(base(), { template_id: template, title: 'Negada' }, user, 403);
    await patch(
      `${base()}/${item.id}/answers`,
      { revision: 1, answers: [answer('flag', false)] },
      user,
      403,
    );
    await grant(['project-preparation:read', 'project-preparation:edit']);
    await patch(
      `${base()}/${item.id}/answers`,
      { revision: 1, answers: [answer('flag', false)] },
      user,
    );
    await post(`${base()}/${item.id}/approve`, { revision: 2 }, user, 403);
    await grant(['project-preparation:read', 'project-preparation:approve']);
    await post(`${base()}/${item.id}/approve`, { revision: 2 }, user, 200);
    const repo = app.get(DataSource).getRepository(PermissionEntity);
    const permission = await repo.findOneByOrFail({
      key: 'project-preparation:read',
    });
    await app
      .get(DataSource)
      .getRepository(RolePermissionEntity)
      .delete({ permissionId: permission.id });
    await repo.delete(permission.id);
    await get(base(), admin, 403);
    await get(base(), platform, 403);
    await repo.save(permission);
  });
  it('prevents cross-organization reads, edits, clones, histories, communication and project ID substitution', async () => {
    await grant(['project-preparation:read', 'project-preparation:edit']);
    const otherTemplates = `/api/v1/organizations/${otherOrg}/preparation-templates`;
    const otherModel = await post(
      otherTemplates,
      { name: 'Modelo B privado', kind: 'kickoff', questions: [q('private')] },
      platform,
    );
    const otherTemplate = otherModel.body.id as number;
    const foreign = await post(
      `/api/v1/projects/${otherProject}/preparations`,
      { template_id: otherTemplate, title: 'Preparação B privada' },
      platform,
    );
    const id = foreign.body.id as number;
    await get(base(), user);
    for (const suffix of [
      '',
      '/context',
      `/${id}`,
      `/${id}/history`,
      `/${id}/communication`,
    ])
      await get(
        `/api/v1/projects/${otherProject}/preparations${suffix}`,
        user,
        403,
      );
    await patch(
      `/api/v1/projects/${otherProject}/preparations/${id}/answers`,
      { revision: 1, answers: [answer('private', 'Invasão')] },
      user,
      403,
    );
    await get(`${base()}/${id}`, user, 404);
    await post(`${otherTemplates}/${otherTemplate}/clone`, {}, user, 403);
    for (const suffix of [
      '',
      '/context',
      `/${id}`,
      `/${id}/history`,
      `/${id}/communication`,
    ])
      await get(
        `/api/v1/projects/${otherProject}/preparations${suffix}`,
        admin,
        403,
      );
    await patch(
      `/api/v1/projects/${otherProject}/preparations/${id}`,
      { revision: 1, title: 'Invasão' },
      admin,
      403,
    );
    await get(otherTemplates, admin, 403);
    await post(`${otherTemplates}/${otherTemplate}/clone`, {}, admin, 403);
    await get(`${templates}/${otherTemplate}`, admin, 404);
    await post(`${templates}/${otherTemplate}/clone`, {}, admin, 404);
    await post(
      base(),
      { template_id: otherTemplate, title: 'Escopo errado' },
      admin,
      404,
    );
    await get(`${base()}/${id}`, admin, 404);
    await get(`${base()}/${id}/history`, admin, 404);
    await patch(
      `${base()}/${id}/answers`,
      { revision: 1, answers: [answer('private', 'Invasão')] },
      admin,
      404,
    );
    const own = await create();
    await get(
      `/api/v1/projects/${secondProject}/preparations/${own.id}`,
      admin,
      404,
    );
  });
  it('previews authorized project text without disabled answers, foreign data or any delivery claim', async () => {
    const item = await create();
    await patch(`${base()}/${item.id}/answers`, {
      revision: 1,
      answers: [
        answer('flag', true),
        answer('details', 'Detalhe depois desabilitado'),
      ],
    });
    await patch(`${base()}/${item.id}/answers`, {
      revision: 2,
      answers: [answer('flag', false)],
    });
    for (const channel of ['email', 'guidance']) {
      const preview = await get(
        `${base()}/${item.id}/communication?channel=${channel}`,
      );
      expect(preview.body).toMatchObject({
        channel,
        recipient: null,
        delivery_status: 'preview_only',
      });
      expect(preview.body.body).toContain('Preparação A');
      expect(preview.body.body).not.toContain('Detalhe depois desabilitado');
      expect(preview.body.body).not.toContain('B privada');
      expect(preview.body.body).toContain('não foi enviada');
    }
    const history = await get(`${base()}/${item.id}/history`);
    expect(
      history.body.items.filter(
        (row: { operation: string }) =>
          row.operation === 'COMMUNICATION_PREVIEW',
      ),
    ).toHaveLength(2);
  });
  it.each([
    ProjectStatus.FINISHED,
    ProjectStatus.ARCHIVED,
    ProjectStatus.INACTIVE,
    ProjectStatus.CANCELLED,
  ])(
    'preserves existing project mutation policy for %s, retaining read/history access',
    async (status) => {
      const closedProject = (
        await post('/api/v1/projects', {
          organization_id: 1,
          company_id: 1,
          name: `Projeto ${status}`,
        })
      ).body.id as number;
      const item = await create(template, closedProject);
      await app
        .get(DataSource)
        .getRepository(ProjectEntity)
        .update(closedProject, { status });
      const closedBase = `/api/v1/projects/${closedProject}/preparations`;
      await get(`${closedBase}/${item.id}`);
      await get(`${closedBase}/${item.id}/history`);
      const denied = await post(
        closedBase,
        { template_id: template, title: 'Bloqueada' },
        admin,
        409,
      );
      expect(denied.body.code).toBe('PROJECT_STATUS_BLOCKS_OPERATION');
      await patch(
        `${closedBase}/${item.id}`,
        { revision: 1, title: 'Bloqueada' },
        admin,
        409,
      );
      await patch(
        `${closedBase}/${item.id}/answers`,
        { revision: 1, answers: [answer('flag', false)] },
        admin,
        409,
      );
      await post(
        `${closedBase}/${item.id}/approve`,
        { revision: 1 },
        admin,
        409,
      );
    },
  );
});
