import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as XLSX from 'xlsx';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsOrgUser,
  loginAsAdmin,
} from '../test-app.helper';
import { ContractDataDto } from '../../../src/modules/contracts/contract.dto';
import {
  ContractEntity,
  ContractVersionEntity,
  CommercialReportEntity,
} from '../../../src/modules/contracts/contract.entity';
import { ContractService } from '../../../src/modules/contracts/contract.service';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { CompanyEntity } from '../../../src/modules/companies/infrastructure/persistence/company.entity';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import { ProjectStatus } from '../../../src/modules/projects/domain/enums/project-status.enum';

describe('Contracts and commercial overview through HTTP and real SQL', () => {
  let app: INestApplication,
    ds: DataSource,
    admin: string,
    user: string,
    platform: string,
    seq = 0;
  const call = (
    method: 'get' | 'post' | 'patch',
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
    await ds.getRepository(CompanyEntity).update(1, { state: 'SP' });
  });
  afterAll(async () => {
    await app?.close();
  });
  const fixture = async () => {
    const p = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Contratos ' + ++seq,
      }).expect(201)
    ).body.id as number;
    return { p, base: `/projects/${p}/contracts` };
  };
  const data = (over: Partial<ContractDataDto> = {}): ContractDataDto => ({
    number: 'SINTETICO-' + ++seq,
    company_id: 1,
    contracted_on: '2024-03-10',
    starts_on: '2024-03-10',
    ends_on: '2029-12-31',
    original_value: '100.10',
    currency: 'BRL',
    contracting_type: 'Serviço',
    segment: 'TESTE-' + seq,
    commercial_origin: 'Teste sintético',
    recurring: true,
    services: ['Inventário', 'Avaliação'],
    estimated_assets: 100,
    scope: 'Escopo sintético',
    commercial_terms: 'Sem cobrança real',
    status: 'active',
    ...over,
  });
  const create = async (f: Awaited<ReturnType<typeof fixture>>, d = data()) =>
    (await post(f.base, d).expect(201)).body as ContractEntity;
  const amendment = (over = {}) => ({
    revision: 1,
    reason: 'Justificativa sintética',
    identifier: 'AD-1',
    dated_on: '2026-10-27',
    type: 'value',
    value_delta: '0.20',
    ...over,
  });
  it('keeps old projects with no contracts and denies missing permissions and missing catalog keys', async () => {
    const f = await fixture();
    expect((await get(f.base).expect(200)).body).toEqual([]);
    await request(app.getHttpServer())
      .get('/api/v1' + f.base)
      .expect(401);
    await get(f.base, user).expect(403);
    await post(f.base, data(), user).expect(403);
    await get('/organization-overview/commercial', user).expect(403);
    const repo = ds.getRepository(PermissionEntity),
      permission = await repo.findOneByOrFail({ key: 'contracts:read' });
    await repo.update(permission.id, { key: 'temporarily-absent-contracts' });
    try {
      await get(f.base).expect(403);
    } finally {
      await repo.update(permission.id, { key: 'contracts:read' });
    }
    const commercial = await repo.findOneByOrFail({
      key: 'commercial-indicators:read',
    });
    await repo.update(commercial.id, { key: 'temporarily-absent-commercial' });
    try {
      await get('/organization-overview?segment=secret').expect(403);
      await get('/organization-overview/commercial').expect(403);
    } finally {
      await repo.update(commercial.id, { key: 'commercial-indicators:read' });
    }
  });
  it('preserves original terms, records additive cents and all immutable revisions', async () => {
    const f = await fixture(),
      d = data(),
      c = await create(f, d);
    const a = await post(
      f.base + `/${c.id}/amendments`,
      amendment({ type: 'mixed', ends_on: '2030-12-31', scope: 'Novo escopo' }),
    ).expect(201);
    expect(a.body.data.original_value).toBe('100.10');
    expect(a.body.data.current_value).toBe('100.30');
    expect(a.body.revision).toBe(2);
    const detail = (await get(f.base + `/${c.id}`).expect(200)).body;
    expect(detail.versions).toHaveLength(2);
    expect(detail.versions[1].data.current_value).toBe('100.10');
    expect(detail.amendments[0].valueDelta).toBe('0.20');
    expect(detail.amendments[0].actorId).toBeTruthy();
    expect(detail.data.ends_on).toBe('2029-12-31');
    expect(detail.data.current_ends_on).toBe('2030-12-31');
    await call('patch', f.base + `/${c.id}`, {
      ...d,
      revision: 2,
      reason: 'Alterar original indevido',
      original_value: '200.00',
    }).expect(409);
    await post(
      f.base + `/${c.id}/amendments`,
      amendment({ revision: 2, identifier: 'AD-2', value_delta: '-0.10' }),
    ).expect(201);
    expect((await get(f.base + `/${c.id}`)).body.data.current_value).toBe(
      '100.20',
    );
  });
  it('versions edits, completes and archives, forbids forbidden transitions and edits after archive', async () => {
    const f = await fixture(),
      d = data(),
      c = await create(f, d);
    await call('patch', f.base + `/${c.id}`, {
      ...d,
      revision: 1,
      reason: 'Ajuste dos dados comerciais',
      segment: 'Novo segmento',
      status: 'completed',
    }).expect(200);
    await post(
      f.base + `/${c.id}/amendments`,
      amendment({ revision: 2 }),
    ).expect(409);
    await post(f.base + `/${c.id}/archive`, {
      revision: 2,
      reason: 'Encerramento documental',
    }).expect(201);
    const detail = (await get(f.base + `/${c.id}`)).body;
    expect(detail.revision).toBe(3);
    expect(
      detail.versions.map((v: { operation: string }) => v.operation),
    ).toEqual(['archive', 'edit', 'create']);
    await call('patch', f.base + `/${c.id}`, {
      ...d,
      revision: 3,
      reason: 'Tentativa de alteração',
    }).expect(409);
  });
  it('supports incomplete drafts, missing data stays null and activation requires complete terms', async () => {
    const f = await fixture(),
      segment = 'INCOMPLETO-' + ++seq;
    const d = data({
      status: 'draft',
      original_value: null,
      contracted_on: null,
      starts_on: null,
      ends_on: null,
      recurring: null,
      estimated_assets: null,
      segment,
    });
    const c = await create(f, d),
      result = (
        await get(
          '/organization-overview/commercial?segment=' + segment,
        ).expect(200)
      ).body;
    expect(result.count).toBe(1);
    expect(result.totals[0].current.value).toBeNull();
    expect(result.totals[0].average).toBeNull();
    expect(result.annual).toEqual([]);
    expect(result.estimated_assets).toBeNull();
    expect(result.totals[0].unknown_recurring_count).toBe(1);
    await call('patch', f.base + `/${c.id}`, {
      ...d,
      status: 'active',
      revision: 1,
      reason: 'Ativação incompleta',
    }).expect(400);
    await call('patch', f.base + `/${c.id}`, {
      ...d,
      status: 'active',
      original_value: '0.00',
      contracted_on: '2025-01-02',
      starts_on: '2025-01-02',
      ends_on: '2028-12-31',
      revision: 1,
      reason: 'Complementação documental',
    }).expect(200);
    expect((await get(f.base + `/${c.id}`)).body.data.current_value).toBe(
      '0.00',
    );
  });
  it('calculates annual count, original/current totals and rounded tickets without mixing currencies', async () => {
    const f = await fixture(),
      segment = 'ANUAL-' + ++seq;
    const a = await create(f, data({ segment, original_value: '0.10' }));
    await create(
      f,
      data({ segment, original_value: '0.20', recurring: false }),
    );
    await create(
      f,
      data({ segment, original_value: '99.99', currency: 'USD' }),
    );
    await post(f.base + `/${a.id}/amendments`, amendment()).expect(201);
    const r = (
      await get('/organization-overview/commercial?segment=' + segment).expect(
        200,
      )
    ).body;
    expect(r.annual[0].year).toBe('2024');
    expect(r.annual[0].count).toBe(3);
    const brl = r.totals.find(
      (t: { currency: string }) => t.currency === 'BRL',
    );
    expect(brl.original.value).toBe('0.30');
    expect(brl.current.value).toBe('0.50');
    expect(brl.average).toBe('0.25');
    expect(brl.recurring_count).toBe(1);
    expect(brl.recurring.value).toBe('0.30');
    expect(r.totals).toHaveLength(2);
    expect(r.status_evolution[0].statuses).toContainEqual({
      status: 'active',
      count: 3,
    });
  });
  it('combines contract dates/status/UF/company/services/recurrence/assets with the operational cut and exports', async () => {
    const f = await fixture(),
      segment = 'FILTROS-' + ++seq;
    const c = await create(f, data({ segment }));
    await create(f, data({ segment, recurring: false, estimated_assets: 10 }));
    // Multiple linked units must not multiply either projects or contracts.
    if (ds.options.type === 'mysql') {
      await ds.query(
        "INSERT INTO company_units(organization_id,company_id,name,state,status) VALUES(1,1,'SINTETICO Unidade 1','SP','active'),(1,1,'SINTETICO Unidade 2','SP','active')",
      );
      const units = await ds.query(
        "SELECT id FROM company_units WHERE name LIKE 'SINTETICO Unidade %'",
      );
      for (const unit of units)
        await ds.query(
          'INSERT INTO project_units(organization_id,project_id,company_unit_id) VALUES(1,?,?)',
          [f.p, unit.id],
        );
    }
    const params = `segment=${segment}&contract_from=2024-01-01&contract_to=2024-12-31&contract_status=active&company_id=1&contract_state=SP&recurring=true&service=Invent%C3%A1rio&assets_min=90&assets_max=110`;
    const r = (
      await get('/organization-overview/commercial?' + params).expect(200)
    ).body;
    expect(r.rows.map((x: { id: number }) => x.id)).toEqual([c.id]);
    expect(
      (await get('/organization-overview?' + params)).body.total_projects,
    ).toBe(1);
    expect(
      (await get('/organization-overview/projects?' + params)).body.total,
    ).toBe(1);
    expect(
      (await get('/organization-overview/companies?' + params)).body.items[0]
        .total,
    ).toBe(1);
    expect(
      (await get('/organization-overview/export.csv?' + params)).text,
    ).toContain('SINTETICO Contratos');
    expect(
      (
        await get(
          '/organization-overview/commercial?' + params + '&search=NONEXISTENT',
        )
      ).body.count,
    ).toBe(0);
    await get(
      '/organization-overview/commercial?assets_min=10&assets_max=1',
    ).expect(400);
    await get(
      '/organization-overview/commercial?contract_from=2026-02-30',
    ).expect(400);
  });
  it('preserves saved report data and filters after later amendments, and exports safe exact strings', async () => {
    const f = await fixture(),
      segment = 'RELATORIO-' + ++seq;
    const c = await create(f, data({ segment, number: '=SINTETICO-' + seq }));
    const r = (
      await get('/organization-overview/commercial?segment=' + segment)
    ).body;
    const report = (
      await post('/organization-overview/commercial/reports', {
        segment,
        expected_hash: r.hash,
      }).expect(201)
    ).body as CommercialReportEntity;
    await post(f.base + `/${c.id}/amendments`, amendment()).expect(201);
    const old = (
      await get(
        '/organization-overview/commercial/reports/' + report.id,
      ).expect(200)
    ).body;
    expect(old.payload.rows[0].current_value).toBe('100.10');
    expect(old.payload.rows[0].revision).toBe(1);
    expect(old.payload.filters).toEqual({ segment });
    await post('/organization-overview/commercial/reports', {
      segment,
      expected_hash: r.hash,
    }).expect(409);
    const csv = (
      await get(
        `/organization-overview/commercial/reports/${report.id}/export.csv`,
      ).expect(200)
    ).text;
    expect(csv).toContain("'=SINTETICO");
    expect(csv).toContain('100.10');
    const response = await get(
      `/organization-overview/commercial/reports/${report.id}/export.xlsx`,
    )
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const workbook = XLSX.read(response.body, { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Contratos)).toHaveLength(1);
    expect(workbook.Sheets.Contratos.D2.f).toBeUndefined();
    expect(workbook.Sheets.Contratos.I2.v).toBe('100.10');
  });
  it('rejects tenant/company/project/contract substitution and never leaks historical reports', async () => {
    const f = await fixture(),
      other = await fixture(),
      c = await create(f);
    await get(other.base + `/${c.id}`).expect(404);
    await post(f.base, data({ company_id: 999999 })).expect(400);
    const org = (
      await post(
        '/organizations',
        {
          legal_name: 'SINTETICO Outra',
          trade_name: 'Outra',
          cnpj: '11444777000161',
        },
        platform,
      ).expect(201)
    ).body.id as number;
    const comp = (
      await post(
        '/companies',
        { organization_id: org, name: 'SINTETICO Empresa estrangeira' },
        platform,
      ).expect(201)
    ).body.id as number;
    const p = (
      await post(
        '/projects',
        { organization_id: org, company_id: comp, name: 'SINTETICO Segredo' },
        platform,
      ).expect(201)
    ).body.id as number;
    await get(`/projects/${p}/contracts`).expect(403);
    await post(`/projects/${p}/contracts`, data({ company_id: comp })).expect(
      403,
    );
    const foreign = await post(
      `/projects/${p}/contracts`,
      data({ company_id: comp, segment: 'SEGREDO' }),
      platform,
    ).expect(201);
    expect(
      (await get('/organization-overview/commercial?segment=SEGREDO')).body
        .count,
    ).toBe(0);
    await get(f.base + `/${foreign.body.id}`).expect(404);
    const report = await ds.getRepository(CommercialReportEntity).save({
      organizationId: org,
      actorId: 1,
      recordedAt: new Date(),
      payload: { secret: true },
    });
    await get('/organization-overview/commercial/reports/' + report.id).expect(
      404,
    );
  });
  it('serializes concurrent revisions and rolls back contract update if version persistence fails', async () => {
    const f = await fixture(),
      c = await create(f);
    const responses = await Promise.all([
      post(f.base + `/${c.id}/amendments`, amendment()),
      post(f.base + `/${c.id}/amendments`, amendment({ identifier: 'AD-2' })),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await get(f.base + `/${c.id}`)).body.revision).toBe(2);
    const service = app.get(ContractService),
      original = (
        service as unknown as {
          version: (...args: unknown[]) => Promise<unknown>;
        }
      ).version;
    const spy = jest
      .spyOn(service as never, 'version' as never)
      .mockImplementationOnce(() => {
        throw new Error('Synthetic version persistence failure');
      });
    try {
      await post(
        f.base + `/${c.id}/amendments`,
        amendment({ revision: 2, identifier: 'ROLLBACK' }),
      ).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(original).toBeDefined();
    const detail = (await get(f.base + `/${c.id}`)).body;
    expect(detail.revision).toBe(2);
    expect(detail.amendments).toHaveLength(1);
    expect(detail.versions).toHaveLength(2);
    expect(
      await ds
        .getRepository(ContractVersionEntity)
        .countBy({ contractId: c.id }),
    ).toBe(2);
  });
  it('counts compatible operational sources on the same cut and respects each source permission', async () => {
    const f = await fixture(),
      segment = 'ETAPAS-' + ++seq;
    await create(f, data({ segment }));
    await ds.query(
      "INSERT INTO inventory_sessions(organization_id,project_id,name,status) VALUES(1,?,'SINTETICO Sessao A','finished'),(1,?,'SINTETICO Sessao B','active')",
      [f.p, f.p],
    );
    const result = (
      await get('/organization-overview/commercial?segment=' + segment).expect(
        200,
      )
    ).body;
    expect(
      result.operational_stages.find(
        (s: { source: string }) => s.source === 'inventory_sessions',
      ),
    ).toMatchObject({ total: 2, completed: 1, percentage: 50 });
    expect(
      result.operational_stages.find(
        (s: { source: string }) => s.source === 'project_preparations',
      ),
    ).toMatchObject({ total: null, completed: null, percentage: null });
    const repo = ds.getRepository(PermissionEntity),
      permission = await repo.findOneByOrFail({
        key: 'inventory-sessions:read',
      });
    await repo.update(permission.id, {
      key: 'temporarily-missing-session-stage',
    });
    try {
      expect(
        (
          await get(
            '/organization-overview/commercial?segment=' + segment,
          ).expect(200)
        ).body.operational_stages.some(
          (s: { source: string }) => s.source === 'inventory_sessions',
        ),
      ).toBe(false);
    } finally {
      await repo.update(permission.id, { key: 'inventory-sessions:read' });
    }
  });
  it('validates decimals, negative totals, duplicated commands, invalid dates and closed project writes', async () => {
    const f = await fixture(),
      c = await create(f);
    for (const value of ['1.001', '-1', '1e3', 'NaN'])
      await post(f.base, data({ original_value: value })).expect(400);
    await post(f.base, data({ number: c.number })).expect(409);
    await post(
      f.base + `/${c.id}/amendments`,
      amendment({ value_delta: '-101' }),
    ).expect(400);
    await post(
      f.base + `/${c.id}/amendments`,
      amendment({ dated_on: '2023-01-01' }),
    ).expect(400);
    await post(f.base + `/${c.id}/archive`, {
      revision: 1,
      reason: 'Tentativa prematura',
    }).expect(409);
    await ds
      .getRepository(ProjectEntity)
      .update(f.p, { status: ProjectStatus.FINISHED });
    await post(f.base + `/${c.id}/amendments`, amendment()).expect(409);
    await post(f.base, data()).expect(409);
    await get(f.base + `/${c.id}`).expect(200);
  });
});
