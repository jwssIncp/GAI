import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsOrgUser,
  loginAsAdmin,
} from '../test-app.helper';
import {
  testBudget,
  testPricing,
} from '../../unit/modules/budgets/budget.fixtures';
import {
  BudgetEntity,
  BudgetPricingEntity,
  BudgetVersionEntity,
} from '../../../src/modules/budgets/budget.entity';
import { BudgetService } from '../../../src/modules/budgets/budget.service';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { BudgetDataDto } from '../../../src/modules/budgets/budget.dto';
describe('Budgets with immutable calculation memory and tenant isolation in MySQL', () => {
  let app: INestApplication,
    ds: DataSource,
    admin: string,
    user: string,
    platform: string,
    pricing: BudgetPricingEntity,
    seq = 0;
  const call = (
    method: 'get' | 'post' | 'put',
    path: string,
    body: object = {},
    token = admin,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const get = (path: string, token = admin) => call('get', path, {}, token);
  const post = (path: string, body: object, token = admin) =>
    call('post', path, body, token);
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    platform = await loginAsAdmin(app);
    pricing = (await post('/budgets/pricing', testPricing()).expect(201))
      .body as BudgetPricingEntity;
  });
  afterAll(async () => app?.close());
  const input = (over: Partial<BudgetDataDto> = {}) =>
    testBudget({
      number: 'SINTETICO-HTTP-' + ++seq,
      pricing_id: pricing.id,
      ...over,
    });
  const create = async (dto = input()) => ({
    b: (await post('/budgets', dto).expect(201)).body as BudgetEntity,
    dto,
  });
  const detail = async (id: number) =>
    (await get('/budgets/' + id).expect(200)).body as BudgetEntity & {
      versions: BudgetVersionEntity[];
      audit: unknown[];
    };
  it('requires session, does not grant custom roles implicitly and fails closed on missing catalog entries', async () => {
    await request(app.getHttpServer()).get('/api/v1/budgets').expect(401);
    await get('/budgets', user).expect(403);
    await post('/budgets', input(), user).expect(403);
    await post('/budgets/pricing', testPricing(), user).expect(403);
    const repo = ds.getRepository(PermissionEntity),
      read = await repo.findOneByOrFail({ key: 'budgets:read' });
    await repo.update(read.id, { key: 'temporarily-absent-budget' });
    try {
      await get('/budgets').expect(403);
    } finally {
      await repo.update(read.id, { key: 'budgets:read' });
    }
  });
  it('publishes immutable parameter versions with exact values and non-overlapping validity', async () => {
    expect(pricing.values.daily_rate).toBe('100.10');
    await post(
      '/budgets/pricing',
      testPricing({ valid_from: '2027-01-01', valid_to: '2030-12-31' }),
    ).expect(409);
    const next = (
      await post(
        '/budgets/pricing',
        testPricing({
          valid_from: '2030-01-01',
          valid_to: '2031-12-31',
          daily_rate: '111.11',
        }),
      ).expect(201)
    ).body;
    expect(next.version).toBe(2);
    expect(
      (
        await ds
          .getRepository(BudgetPricingEntity)
          .findOneByOrFail({ id: pricing.id })
      ).values.daily_rate,
    ).toBe('100.10');
    for (const over of [
      { productivity: 0 },
      { margin_pct: '85' },
      { daily_rate: '0.001' },
      { address_factor: '0' },
    ])
      await post('/budgets/pricing', testPricing(over)).expect(400);
  });
  it('creates standalone budgets before a project, persists complete memory and filters the list', async () => {
    const { b, dto } = await create(),
      d = await detail(b.id);
    expect(d.projectId).toBeNull();
    expect(d.versions).toHaveLength(1);
    expect(d.versions[0].snapshot.pricing.id).toBe(pricing.id);
    expect(d.versions[0].snapshot.calculation.final_price).toBe('1913.72');
    expect(d.versions[0].snapshot.calculation.payment.remaining_balance).toBe(
      '0.00',
    );
    expect(d.audit).toHaveLength(1);
    expect(
      (await get('/budgets?search=' + dto.number)).body.items.map(
        (x: { id: number }) => x.id,
      ),
    ).toEqual([b.id]);
    expect(
      (await get('/budgets?search=' + dto.number + '&status=approved')).body
        .total,
    ).toBe(0);
    await post('/budgets', dto).expect(409);
    await get(`/budgets/${b.id}/proposal`).expect(409);
  });
  it('calculates previews without persisting budgets or mutating the input', async () => {
    const dto = input(),
      before = await ds.getRepository(BudgetEntity).count();
    const a = (await post('/budgets/simulate', dto).expect(201)).body,
      b = (await post('/budgets/simulate', dto).expect(201)).body;
    expect(a.calculation).toEqual(b.calculation);
    expect(await ds.getRepository(BudgetEntity).count()).toBe(before);
  });
  it('creates edited versions and scenarios, chooses one for review and freezes its approval', async () => {
    const { b, dto } = await create();
    const edited = await call('put', `/budgets/${b.id}/versions`, {
      ...dto,
      revision: 1,
      name: 'Revisão comercial',
      reason: 'Ajuste da estimativa',
      estimated_assets: 1200,
    }).expect(200);
    const current = (await detail(b.id)).versions[0];
    expect(edited.body.revision).toBe(2);
    await post(`/budgets/${b.id}/scenarios`, {
      ...dto,
      revision: 2,
      base_version_id: current.id,
      name: 'Equipe ampliada',
      reason: 'Cenário de prazo comercial',
      sizing: { team: 3, adjustment_reason: 'Equipe ampliada sintética' },
    }).expect(201);
    const d = await detail(b.id),
      scenario = d.versions[0];
    expect(d.headVersionId).toBe(current.id);
    await post(`/budgets/${b.id}/transitions`, {
      revision: 3,
      status: 'review',
      version_id: scenario.id,
      reason: 'Selecionado cenário ampliado',
    }).expect(201);
    await post(`/budgets/${b.id}/transitions`, {
      revision: 4,
      status: 'approved',
      version_id: current.id,
      reason: 'Tentativa de versão diferente',
    }).expect(409);
    await post(`/budgets/${b.id}/transitions`, {
      revision: 4,
      status: 'approved',
      version_id: scenario.id,
      reason: 'Aprovação comercial sintética',
    }).expect(201);
    const approved = await detail(b.id);
    expect(approved.approvedVersionId).toBe(scenario.id);
    expect(approved.versions).toHaveLength(3);
    await call('put', `/budgets/${b.id}/versions`, {
      ...dto,
      revision: 5,
      name: 'Tentativa de edição',
      reason: 'Não sobrescrever aprovado',
    }).expect(409);
    await post(`/budgets/${b.id}/scenarios`, {
      ...dto,
      revision: 5,
      name: 'Após aprovação',
      reason: 'Apenas comparação comercial',
    }).expect(201);
    const after = await detail(b.id);
    expect(after.headVersionId).toBe(scenario.id);
    expect(after.approvedVersionId).toBe(scenario.id);
    expect(after.versions.find((v) => v.id === scenario.id)?.snapshot).toEqual(
      scenario.snapshot,
    );
    const proposal = (await get(`/budgets/${b.id}/proposal`).expect(200)).body;
    expect(proposal.version).toBe(scenario.version);
    expect(proposal.final_price).toBe(
      scenario.snapshot.calculation.final_price,
    );
    const [before] = await ds.query(
      'SELECT (SELECT COUNT(*) FROM projects) p,(SELECT COUNT(*) FROM project_contracts) c,(SELECT COUNT(*) FROM expenses) e',
    );
    expect(
      (await get(`/budgets/${b.id}/contract-preview`).expect(200)).body,
    ).toMatchObject({
      eligible_for_future_conversion: false,
      creates_contract: false,
      creates_project: false,
      creates_receivables: false,
    });
    const [last] = await ds.query(
      'SELECT (SELECT COUNT(*) FROM projects) p,(SELECT COUNT(*) FROM project_contracts) c,(SELECT COUNT(*) FROM expenses) e',
    );
    expect(last).toEqual(before);
    await post(`/budgets/${b.id}/transitions`, {
      revision: after.revision,
      status: 'archived',
      version_id: scenario.id,
      reason: 'Arquivamento documental aprovado',
    }).expect(201);
    expect((await get(`/budgets/${b.id}/proposal`).expect(200)).body).toEqual(
      proposal,
    );
    await get(`/budgets/${b.id}/contract-preview`).expect(409);
  });
  it('enforces explicit transition rules and immutable archive history', async () => {
    const { b } = await create();
    await post(`/budgets/${b.id}/transitions`, {
      revision: 1,
      status: 'approved',
      version_id: b.headVersionId,
      reason: 'Aprovação sem revisão',
    }).expect(409);
    await post(`/budgets/${b.id}/transitions`, {
      revision: 1,
      status: 'archived',
      version_id: b.headVersionId,
      reason: 'Arquivamento documental',
    }).expect(201);
    await post(`/budgets/${b.id}/transitions`, {
      revision: 2,
      status: 'draft',
      version_id: b.headVersionId,
      reason: 'Não reabrir arquivado',
    }).expect(409);
    expect((await detail(b.id)).versions).toHaveLength(1);
  });
  it('keeps read/edit/configuration/approval permissions independent for customized profiles', async () => {
    const role = await ds
      .getRepository(RoleEntity)
      .findOneByOrFail({ name: 'Operador', organizationId: 1 });
    const keys = ['budgets:read', 'budgets:edit'];
    const perms = await ds.getRepository(PermissionEntity).find();
    const grants = keys.map((key) => ({
      roleId: role.id,
      permissionId: perms.find((p) => p.key === key)!.id,
    }));
    await ds.getRepository(RolePermissionEntity).save(grants);
    try {
      await get('/budgets', user).expect(200);
      await post('/budgets/pricing', testPricing(), user).expect(403);
      const dto = input({ responsible_id: 3 }),
        b = (await post('/budgets', dto, user).expect(201)).body;
      await post(
        '/budgets/simulate',
        {
          ...dto,
          sizing: { team: 3, adjustment_reason: 'Equipe manual sem concessão' },
        },
        user,
      ).expect(403);
      await post(
        `/budgets/${b.id}/transitions`,
        {
          revision: 1,
          status: 'review',
          version_id: b.headVersionId,
          reason: 'Enviar para análise',
        },
        user,
      ).expect(201);
      await post(
        `/budgets/${b.id}/transitions`,
        {
          revision: 2,
          status: 'approved',
          version_id: b.headVersionId,
          reason: 'Sem autorização de aprovação',
        },
        user,
      ).expect(403);
    } finally {
      for (const grant of grants)
        await ds.getRepository(RolePermissionEntity).delete(grant);
    }
  });
  it('validates company/project/unit/user/parameter IDs, snapshots addresses and cannot substitute identity', async () => {
    const p = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Projeto orçamento',
      }).expect(201)
    ).body.id as number;
    await ds.query(
      "INSERT INTO company_units(organization_id,company_id,name,state,status,address) VALUES(1,1,'SINTETICO Unidade orçamento','SP','active','Rua de teste')",
    );
    const [u] = await ds.query(
      "SELECT id FROM company_units WHERE name='SINTETICO Unidade orçamento'",
    );
    const { b, dto } = await create(input({ project_id: p, unit_ids: [u.id] }));
    const d = await detail(b.id);
    expect(d.versions[0].snapshot.context.project?.id).toBe(p);
    expect(d.versions[0].snapshot.context.units[0].address).toContain(
      'Rua de teste',
    );
    expect(d.versions[0].snapshot.calculation.inputs.address_count).toBe(3);
    for (const over of [
      { company_id: 999999 },
      { project_id: 999999 },
      { unit_ids: [999999] },
      { responsible_id: 999999 },
      { pricing_id: 999999 },
    ])
      await post('/budgets', input(over)).expect(400);
    await call('put', `/budgets/${b.id}/versions`, {
      ...dto,
      number: 'TROCA',
      revision: 1,
      name: 'Identidade inválida',
      reason: 'Não substituir identidade',
    }).expect(400);
  });
  it('isolates foreign organizations including parameters, versions and project relations', async () => {
    const org = (
      await post(
        '/organizations',
        {
          legal_name: 'SINTETICO Organização orçamento',
          cnpj: '11444777000161',
        },
        platform,
      ).expect(201)
    ).body.id as number;
    const comp = (
      await post(
        '/companies',
        { organization_id: org, name: 'SINTETICO Outra empresa' },
        platform,
      ).expect(201)
    ).body.id as number;
    const project = (
      await post(
        '/projects',
        {
          organization_id: org,
          company_id: comp,
          name: 'SINTETICO Outro projeto',
        },
        platform,
      ).expect(201)
    ).body.id as number;
    const foreignPricing = (
      await post(
        '/budgets/pricing?organization_id=' + org,
        testPricing({ name: 'SINTETICO Outro parâmetro' }),
        platform,
      ).expect(201)
    ).body as BudgetPricingEntity;
    const own = await create();
    await get('/budgets?organization_id=' + org).expect(403);
    await get('/budgets/pricing?organization_id=' + org).expect(403);
    for (const over of [
      { company_id: comp },
      { project_id: project },
      { pricing_id: foreignPricing.id },
      { responsible_id: 1 },
    ])
      await post('/budgets', input(over)).expect(400);
    // Synthetic foreign fixture written directly only into the disposable DB.
    const foreign = await ds.getRepository(BudgetEntity).save({
      organizationId: org,
      companyId: comp,
      projectId: project,
      number: 'SINTETICO SEGREDO',
      status: 'draft',
      revision: 1,
      headVersionId: null,
      approvedVersionId: null,
      createdAt: new Date(),
    });
    await get('/budgets/' + foreign.id).expect(403);
    await post(`/budgets/${foreign.id}/transitions`, {
      revision: 1,
      status: 'archived',
      version_id: own.b.headVersionId,
      reason: 'Bloquear acesso estrangeiro',
    }).expect(403);
    const another = await create();
    await post(`/budgets/${own.b.id}/scenarios`, {
      ...own.dto,
      revision: 1,
      base_version_id: another.b.headVersionId,
      name: 'Base inválida',
      reason: 'Versão de outro orçamento',
    }).expect(404);
    expect((await get('/budgets?search=SEGREDO')).body.total).toBe(0);
  });
  it('serializes competing edits and rolls back budgets and versions on a failed append', async () => {
    const { b, dto } = await create();
    const responses = await Promise.all(
      [1, 2].map((n) =>
        call('put', `/budgets/${b.id}/versions`, {
          ...dto,
          revision: 1,
          name: 'Concorrente ' + n,
          reason: 'Alteração concorrente sintética',
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await detail(b.id)).versions).toHaveLength(2);
    const service = app.get(BudgetService),
      before = await ds.getRepository(BudgetEntity).count();
    const spy = jest
      .spyOn(service as never, 'append' as never)
      .mockImplementationOnce(() => {
        throw new Error('Synthetic budget append failure');
      });
    try {
      await post('/budgets', input()).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await ds.getRepository(BudgetEntity).count()).toBe(before);
  });
  it('revalidates live responsible and project state before commercial review', async () => {
    const { b } = await create(input({ responsible_id: 3 }));
    await ds.query("UPDATE users SET status='INACTIVE' WHERE id=3");
    try {
      await post(`/budgets/${b.id}/transitions`, {
        revision: 1,
        status: 'review',
        version_id: b.headVersionId,
        reason: 'Responsável não mais ativo',
      }).expect(409);
    } finally {
      await ds.query("UPDATE users SET status='ACTIVE' WHERE id=3");
    }
    expect((await detail(b.id)).status).toBe('draft');
  });
  it('rejects incomplete/wrongly priced inputs, invalid payment totals and stale approvals', async () => {
    for (const over of [
      {
        sizing: { margin_pct: '99.99', adjustment_reason: 'Cenário inválido' },
      },
      {
        payment: {
          mode: 'amounts',
          count: 1,
          first_due_on: '2027-01-31',
          amounts: ['1.00'],
        },
      },
      { estimated_assets: -1 },
      { prepared_on: '2030-01-01' },
      { unit_ids: [1, 1] },
    ])
      await post('/budgets', input(over)).expect(400);
    const { b } = await create(
      input({ prepared_on: '2026-01-01', valid_until: '2026-01-02' }),
    );
    await post(`/budgets/${b.id}/transitions`, {
      revision: 1,
      status: 'review',
      version_id: b.headVersionId,
      reason: 'Revisão comercial vencida',
    }).expect(201);
    await post(`/budgets/${b.id}/transitions`, {
      revision: 2,
      status: 'approved',
      version_id: b.headVersionId,
      reason: 'Aprovação vencida indevida',
    }).expect(409);
    expect((await detail(b.id)).status).toBe('review');
  });
});
