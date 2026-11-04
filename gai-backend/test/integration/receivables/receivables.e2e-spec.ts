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
import { ReceivableInputDto } from '../../../src/modules/receivables/receivable.dto';
import {
  ReceivableEntity,
  ReceivableEventEntity,
} from '../../../src/modules/receivables/receivable.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { ExportJobEntity } from '../../../src/modules/export-jobs/infrastructure/persistence/export-job.entity';
import { ExportWorkbookBuilderService } from '../../../src/modules/export-jobs/application/services/export-workbook-builder.service';
import {
  testBudget,
  testPricing,
} from '../../unit/modules/budgets/budget.fixtures';
import * as XLSX from 'xlsx';
import { ReceivableService } from '../../../src/modules/receivables/receivable.service';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
describe('Receivables HTTP with disposable MySQL', () => {
  let app: INestApplication,
    ds: DataSource,
    admin: string,
    user: string,
    platform: string,
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
  const get = (p: string, t = admin) => call('get', p, {}, t),
    post = (p: string, b: object, t = admin) => call('post', p, b, t);
  const key = () => `synthetic-command-${++seq}`;
  const input = (
    over: Partial<ReceivableInputDto> = {},
  ): ReceivableInputDto => ({
    company_id: 1,
    origin: 'manual',
    description: 'SINTETICO HTTP ' + seq,
    amount: '100.01',
    currency: 'BRL',
    issued_on: '2026-01-01',
    reason: 'Teste exclusivamente sintético',
    payment: { mode: 'equal', count: 3, first_due_on: '2026-01-31' },
    ...over,
  });
  const create = async (d = input()) => {
    const p = (await post('/finance/receivables/preview', d).expect(201)).body;
    return (
      await post('/finance/receivables', {
        ...d,
        preview_hash: p.preview_hash,
        command_key: key(),
      }).expect(201)
    ).body;
  };
  const receipt = (r: any, amount: string, over: object = {}) => ({
    revision: r.revision,
    command_key: key(),
    reason: 'Baixa de teste sintético',
    installment_id: r.installments[0].id,
    amount,
    received_on: '2026-10-01',
    method: 'synthetic',
    reference: key(),
    ...over,
  });
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    platform = await loginAsAdmin(app);
  });
  afterAll(async () => {
    await app?.close();
  });
  it('requires financial permission, even when projects read is available', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/finance/receivables')
      .expect(401);
    await get('/finance/receivables', user).expect(403);
    await get('/finance/cash-flow', user).expect(403);
  });
  it('persists exact monthly installments and preview creates no facts', async () => {
    const before = await ds.getRepository(ReceivableEntity).count();
    const d = input();
    await post('/finance/receivables/preview', d).expect(201);
    expect(await ds.getRepository(ReceivableEntity).count()).toBe(before);
    const r = await create(d);
    expect(r.installments.map((i: any) => i.amount)).toEqual([
      '33.33',
      '33.33',
      '33.35',
    ]);
    expect(r.installments.map((i: any) => i.dueOn)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
    expect(
      (await get('/finance/receivables/' + r.id).expect(200)).body.open,
    ).toBe('100.01');
  });
  it('deduplicates create and rejects altered preview', async () => {
    const d = input(),
      p = (await post('/finance/receivables/preview', d)).body,
      body = { ...d, preview_hash: p.preview_hash, command_key: key() };
    const a = await post('/finance/receivables', body).expect(201),
      b = await post('/finance/receivables', body).expect(201);
    expect(a.body.id).toBe(b.body.id);
    await post('/finance/receivables', {
      ...body,
      command_key: key(),
      description: 'Different',
    }).expect(409);
  });
  it('records partial/full receipts, prevents overpay and persists reversal', async () => {
    let r = await create(
      input({
        amount: '10.01',
        payment: { mode: 'equal', count: 1, first_due_on: '2026-01-31' },
      }),
    );
    const first = receipt(r, '3.33');
    r = (await post(`/finance/receivables/${r.id}/receipts`, first).expect(201))
      .body;
    expect(r).toMatchObject({
      received: '3.33',
      open: '6.68',
      status: 'partial',
    });
    expect(
      (await post(`/finance/receivables/${r.id}/receipts`, first).expect(201))
        .body.events,
    ).toHaveLength(2);
    await post(
      `/finance/receivables/${r.id}/receipts`,
      receipt(r, '6.69'),
    ).expect(409);
    r = (
      await post(
        `/finance/receivables/${r.id}/receipts`,
        receipt(r, '6.68'),
      ).expect(201)
    ).body;
    expect(r.status).toBe('paid');
    const e = r.events.find(
      (e: any) => e.operation === 'receipt' && e.amount === '3.33',
    );
    r = (
      await post(`/finance/receivables/${r.id}/receipts/${e.id}/reverse`, {
        revision: r.revision,
        command_key: key(),
        reason: 'Correção sintética auditada',
        reversed_on: '2026-10-02',
      }).expect(201)
    ).body;
    expect(r).toMatchObject({
      received: '6.68',
      open: '3.33',
      status: 'partial',
    });
    await post(`/finance/receivables/${r.id}/receipts/${e.id}/reverse`, {
      revision: r.revision,
      command_key: key(),
      reason: 'Segunda tentativa inválida',
      reversed_on: '2026-10-02',
    }).expect(409);
    expect(
      (await get('/finance/receivables/' + r.id)).body.events,
    ).toHaveLength(4);
  });
  it('serializes concurrent receipts and same-command retries without extra events', async () => {
    const r = await create(
      input({
        amount: '10.00',
        payment: { mode: 'equal', count: 1, first_due_on: '2026-01-01' },
      }),
    );
    const a = receipt(r, '7.00'),
      b = receipt(r, '7.00');
    const results = await Promise.all([
      post(`/finance/receivables/${r.id}/receipts`, a),
      post(`/finance/receivables/${r.id}/receipts`, b),
    ]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
    expect((await get('/finance/receivables/' + r.id)).body.received).toBe(
      '7.00',
    );
    const s = await create();
    const body = receipt(s, '1.00');
    const retries = await Promise.all([
      post(`/finance/receivables/${s.id}/receipts`, body),
      post(`/finance/receivables/${s.id}/receipts`, body),
    ]);
    expect(retries.map((x) => x.status)).toEqual([201, 201]);
    expect(
      (await get('/finance/receivables/' + s.id)).body.events,
    ).toHaveLength(2);
  });
  it('requires explicit reversals before cancellation and preserves history', async () => {
    let r = await create();
    r = (
      await post(`/finance/receivables/${r.id}/receipts`, receipt(r, '1.00'))
    ).body;
    await post(`/finance/receivables/${r.id}/cancel`, {
      revision: r.revision,
      command_key: key(),
      reason: 'Cancelar sem estorno',
    }).expect(409);
    const e = r.events.find((e: any) => e.operation === 'receipt');
    r = (
      await post(`/finance/receivables/${r.id}/receipts/${e.id}/reverse`, {
        revision: r.revision,
        command_key: key(),
        reason: 'Estorno antes do cancelamento',
        reversed_on: '2026-10-02',
      })
    ).body;
    r = (
      await post(`/finance/receivables/${r.id}/cancel`, {
        revision: r.revision,
        command_key: key(),
        reason: 'Cancelamento controlado',
      }).expect(201)
    ).body;
    expect(r.status).toBe('cancelled');
    expect(r.events).toHaveLength(4);
    await post(
      `/finance/receivables/${r.id}/receipts`,
      receipt(r, '1.00'),
    ).expect(409);
  });
  it('validates foreign references, installment ownership and command reuse', async () => {
    await post(
      '/finance/receivables/preview',
      input({ company_id: 999999 }),
    ).expect(400);
    await get('/finance/receivables?organization_id=99999').expect(403);
    await get('/finance/cash-flow?project_id=99999').expect(400);
    const a = await create(),
      b = await create();
    await post(
      `/finance/receivables/${a.id}/receipts`,
      receipt(a, '1.00', { installment_id: b.installments[0].id }),
    ).expect(400);
    const body = receipt(a, '1.00');
    await post(`/finance/receivables/${a.id}/receipts`, body).expect(201);
    await post(`/finance/receivables/${a.id}/receipts`, {
      ...body,
      amount: '2.00',
    }).expect(409);
  });
  it('fails closed when live financial catalog is incomplete', async () => {
    const repo = ds.getRepository(PermissionEntity),
      p = await repo.findOneByOrFail({ key: 'cash-flow:read' });
    await repo.delete(p.id);
    await get('/finance/cash-flow?direction=in').expect(403);
    await get('/finance/cash-flow?direction=in', platform).expect(403);
    await repo.save(p);
  });
  it('edits metadata with revision control and immutable principal', async () => {
    const r = await create();
    const body = {
      revision: r.revision,
      command_key: key(),
      reason: 'Corrigir descrição sintética',
      description: 'SINTETICO corrigido',
      notes: 'Persistido',
    };
    await call('put', `/finance/receivables/${r.id}`, body).expect(200);
    await call('put', `/finance/receivables/${r.id}`, {
      ...body,
      command_key: key(),
    }).expect(409);
    const d = (await get('/finance/receivables/' + r.id)).body;
    expect(d.amount).toBe('100.01');
    expect(d.data.notes).toBe('Persistido');
  });
  it('generates approved budget once, preserving its approved snapshot', async () => {
    const pricing = (await post('/budgets/pricing', testPricing())).body;
    let b = (
      await post(
        '/budgets',
        testBudget({ pricing_id: pricing.id, number: 'SINTETICO-RECEIVABLES' }),
      )
    ).body;
    b = (
      await post(`/budgets/${b.id}/transitions`, {
        revision: b.revision,
        status: 'review',
        version_id: b.headVersionId,
        reason: 'Revisão sintética',
      })
    ).body;
    b = (
      await post(`/budgets/${b.id}/transitions`, {
        revision: b.revision,
        status: 'approved',
        version_id: b.headVersionId,
        reason: 'Aprovação sintética',
      })
    ).body;
    const source = (await get('/finance/sources/budget/' + b.id).expect(200))
      .body;
    const dto = input({
      ...source,
      project_id: undefined,
      origin: 'budget',
      source_id: b.id,
      issued_on: '2026-01-01',
    });
    delete (dto as any).payment.extra;
    const r = await create(dto);
    expect(r.sourceKey).toBe('budget:' + b.id);
    const p = (await post('/finance/receivables/preview', dto)).body;
    await post('/finance/receivables', {
      ...dto,
      preview_hash: p.preview_hash,
      command_key: key(),
    }).expect(409);
    expect((await get('/budgets/' + b.id)).body.approvedVersionId).toBe(
      b.approvedVersionId,
    );
  });
  it('separates expected/actual and date filters after partial receipt', async () => {
    const r = await create(
      input({
        amount: '10.00',
        payment: { mode: 'equal', count: 1, first_due_on: '2026-02-01' },
      }),
    );
    await post(
      `/finance/receivables/${r.id}/receipts`,
      receipt(r, '3.00'),
    ).expect(201);
    const report = (
      await get(
        '/finance/cash-flow?direction=in&date_from=2026-10-01&date_to=2026-10-01',
      ).expect(200)
    ).body;
    expect(
      report.movements.some(
        (m: any) =>
          m.receivable_id === r.id &&
          m.view === 'actual' &&
          m.amount === '3.00',
      ),
    ).toBe(true);
    expect(
      report.movements.some(
        (m: any) => m.receivable_id === r.id && m.view === 'expected',
      ),
    ).toBe(false);
    expect(report.complete).toBe(false);
  });
  it('rolls back parent revision when immutable event persistence fails', async () => {
    const r = await create(),
      service = app.get(ReceivableService);
    const spy = jest
      .spyOn(
        service as unknown as { event: (...args: unknown[]) => Promise<void> },
        'event',
      )
      .mockRejectedValueOnce(new Error('SINTETICO failure'));
    await post(
      `/finance/receivables/${r.id}/receipts`,
      receipt(r, '1.00'),
    ).expect(500);
    spy.mockRestore();
    const after = (await get('/finance/receivables/' + r.id)).body;
    expect(after.revision).toBe(r.revision);
    expect(after.received).toBe('0.00');
    expect(after.events).toHaveLength(1);
  });
  it('custom financial read never implies receipt, reversal, edit or export rights', async () => {
    const role = await ds
        .getRepository(RoleEntity)
        .findOneByOrFail({ name: 'Operador' }),
      permission = await ds
        .getRepository(PermissionEntity)
        .findOneByOrFail({ key: 'receivables:read' });
    await ds
      .getRepository(RolePermissionEntity)
      .save({ roleId: role.id, permissionId: permission.id });
    const restricted = await loginAsOrgUser(app),
      r = await create();
    await get('/finance/receivables', restricted).expect(200);
    await post(
      `/finance/receivables/${r.id}/receipts`,
      receipt(r, '1.00'),
      restricted,
    ).expect(403);
    await post(
      `/finance/receivables/${r.id}/cancel`,
      { revision: r.revision, command_key: key(), reason: 'Não autorizado' },
      restricted,
    ).expect(403);
    await post(
      '/finance/exports',
      { kind: 'receivables', filters: {} },
      restricted,
    ).expect(403);
    await ds
      .getRepository(RolePermissionEntity)
      .delete({ roleId: role.id, permissionId: permission.id });
  });
  it('rejects invalid dates and nonpositive receipt amounts without any events', async () => {
    const r = await create();
    await post(
      `/finance/receivables/${r.id}/receipts`,
      receipt(r, '0.00'),
    ).expect(409);
    await post(
      `/finance/receivables/${r.id}/receipts`,
      receipt(r, '1.00', { received_on: '2026-02-30' }),
    ).expect(400);
    await post(
      `/finance/receivables/${r.id}/receipts`,
      receipt(r, '1.00', { received_on: '2029-01-01' }),
    ).expect(400);
    await post('/finance/receivables/preview', {
      ...input(),
      payment: undefined,
    }).expect(400);
    await post('/finance/exports', { kind: 'receivables' }).expect(400);
    await post(`/finance/receivables/${r.id}/cancel`, {
      revision: r.revision,
      command_key: key(),
      reason: '     ',
    }).expect(400);
    expect(
      (await get('/finance/receivables/' + r.id)).body.events,
    ).toHaveLength(1);
  });
  it('isolates actual foreign organization records and exports', async () => {
    const org = (
      await post(
        '/organizations',
        {
          legal_name: 'SINTETICO Outra organização',
          trade_name: 'Outra',
          cnpj: '11444777000161',
        },
        platform,
      ).expect(201)
    ).body.id;
    const company = (
      await post(
        '/companies',
        { organization_id: org, name: 'SINTETICO Cliente estrangeiro' },
        platform,
      ).expect(201)
    ).body.id;
    const project = (
      await post(
        '/projects',
        {
          organization_id: org,
          company_id: company,
          name: 'SINTETICO Projeto estrangeiro',
        },
        platform,
      ).expect(201)
    ).body.id;
    const dto = input({
      organization_id: org,
      company_id: company,
      project_id: project,
    });
    const preview = (
      await post('/finance/receivables/preview', dto, platform).expect(201)
    ).body;
    const foreign = (
      await post(
        '/finance/receivables',
        { ...dto, preview_hash: preview.preview_hash, command_key: key() },
        platform,
      ).expect(201)
    ).body;
    await get('/finance/receivables/' + foreign.id).expect(403);
    await post(
      `/finance/receivables/${foreign.id}/receipts`,
      receipt(foreign, '1.00'),
    ).expect(403);
    await post(
      '/finance/receivables/preview',
      input({ company_id: company }),
    ).expect(400);
    await post(
      '/finance/receivables/preview',
      input({ project_id: project }),
    ).expect(400);
    await get('/finance/cash-flow?company_id=' + company).expect(400);
    expect(
      (await get('/finance/receivables')).body.items.some(
        (r: any) => r.id === foreign.id,
      ),
    ).toBe(false);
    const e = (
      await post(
        '/finance/exports',
        { kind: 'receivables', filters: { organization_id: org } },
        platform,
      ).expect(201)
    ).body;
    await get(`/finance/exports/${e.id}`).expect(403);
    await get(`/finance/exports/${e.id}/download`).expect(403);
  });
  it('generates contract principal and amendment separately without changing originals', async () => {
    const project = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Recebíveis contrato',
      }).expect(201)
    ).body.id;
    const c = (
      await post(`/projects/${project}/contracts`, {
        number: 'SINTETICO-FIN-1',
        company_id: 1,
        contracted_on: '2026-01-01',
        starts_on: '2026-01-01',
        ends_on: '2029-12-31',
        original_value: '100.10',
        currency: 'BRL',
        recurring: false,
        services: [],
        status: 'active',
      }).expect(201)
    ).body;
    const dto = input({
      origin: 'contract',
      source_id: c.id,
      project_id: project,
      amount: '100.10',
    });
    const r = await create(dto);
    expect(r.contractId).toBe(c.id);
    await post(`/projects/${project}/contracts/${c.id}/amendments`, {
      revision: 1,
      reason: 'Aditivo sintético',
      identifier: 'AD-FIN-1',
      dated_on: '2026-10-01',
      type: 'value',
      value_delta: '10.01',
    }).expect(201);
    const p = (await post('/finance/receivables/preview', dto)).body;
    await post('/finance/receivables', {
      ...dto,
      preview_hash: p.preview_hash,
      command_key: key(),
    }).expect(409);
    const detail = (await get(`/projects/${project}/contracts/${c.id}`)).body;
    const a = detail.amendments[0];
    const ar = await create(
      input({
        origin: 'amendment',
        source_id: a.id,
        project_id: project,
        amount: '10.01',
      }),
    );
    expect(ar.amount).toBe('10.01');
    expect(
      (await get(`/projects/${project}/contracts/${c.id}`)).body.data
        .original_value,
    ).toBe('100.10');
  });
  it('uses original expense once and removes its expected installments after full payment', async () => {
    const project = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Caixa saídas',
      }).expect(201)
    ).body.id;
    const expense = (
      await post(`/projects/${project}/expenses`, {
        description: 'SINTETICO Transporte',
        expense_date: '2026-10-01',
        amount: '10.01',
      }).expect(201)
    ).body;
    await post(
      `/projects/${project}/expenses/${expense.id}/approve`,
      {},
    ).expect(200);
    await ds.query(
      'INSERT INTO expense_installments (organization_id,project_id,expense_id,installment_number,installment_count,due_date,amount,created_at) VALUES (1,?,?,1,2,?,5.00,NOW()),(1,?,?,2,2,?,5.01,NOW())',
      [project, expense.id, '2026-10-01', project, expense.id, '2026-11-01'],
    );
    let report = (
      await get(
        `/finance/cash-flow?project_id=${project}&direction=out`,
      ).expect(200)
    ).body;
    expect(report.movements).toHaveLength(2);
    expect(report.totals[0].expected_out).toBe('10.01');
    expect(report.totals[0].actual_out).toBe('0.00');
    await post(
      `/projects/${project}/expenses/${expense.id}/mark-as-paid`,
      {},
    ).expect(200);
    report = (
      await get(
        `/finance/cash-flow?project_id=${project}&direction=out`,
      ).expect(200)
    ).body;
    expect(report.movements).toHaveLength(1);
    expect(report.movements[0].source).toBe('expense');
    expect(report.totals[0].expected_out).toBe('0.00');
    expect(report.totals[0].actual_out).toBe('10.01');
  });
  it('exports through existing processor and revalidates catalog on download', async () => {
    await create(input({ description: '=HYPERLINK("bad")' }));
    const e = (
      await post('/finance/exports', {
        kind: 'receivables',
        filters: {},
      }).expect(201)
    ).body;
    const job = await ds
      .getRepository(ExportJobEntity)
      .findOneByOrFail({ id: e.id });
    const buffer = await app.get(ExportWorkbookBuilderService).build(job);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets['Recebíveis'],
    );
    expect(
      rows.some((r) => String(r['Descrição']).startsWith("'=HYPERLINK")),
    ).toBe(true);
    await get(`/finance/exports/${e.id}`, user).expect(403);
    const p = await ds
      .getRepository(PermissionEntity)
      .findOneByOrFail({ key: 'receivables:read' });
    await ds.getRepository(PermissionEntity).delete(p.id);
    await get(`/finance/exports/${e.id}/download`).expect(403);
    await ds.getRepository(PermissionEntity).save(p);
    expect(
      await ds.getRepository(ReceivableEventEntity).count(),
    ).toBeGreaterThan(0);
  });
});
