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
import { DRE_GROUPS } from '../../../src/modules/managerial-dre/dre.dto';
import {
  DreAccountVersion,
  DreEntryVersion,
} from '../../../src/modules/managerial-dre/dre.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
describe('DRE HTTP with disposable MySQL', () => {
  let app: INestApplication,
    ds: DataSource,
    admin: string,
    user: string,
    platform: string,
    seq = 0,
    revenue: any,
    cost: any,
    entry: any;
  const key = () => `synthetic-dre-command-${++seq}`;
  const command = () => ({
    command_key: key(),
    reason: 'Evidencia exclusivamente sintetica',
  });
  const call = (
    method: 'get' | 'post' | 'put',
    path: string,
    body: object = {},
    token = admin,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1/finance/dre' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const input = (over: object = {}) => ({
    ...command(),
    source_kind: 'manual',
    economic_key: key(),
    event_document: 'Documento sintetico de servico prestado',
    description: 'SINTETICO DRE',
    currency: 'BRL',
    status: 'recognized',
    allocations: [
      { month: '2026-01', account_id: revenue.id, amount: '100.01' },
    ],
    ...over,
  });
  const report = () =>
    call('get', '/report?start_month=2026-01&end_month=2026-01');
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
  it('requires authentication and explicit DRE permissions for custom roles', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/finance/dre/accounts')
      .expect(401);
    await call('get', '/accounts', {}, user).expect(403);
    await call(
      'get',
      '/report?start_month=2026-01&end_month=2026-01',
      {},
      user,
    ).expect(403);
  });
  it('creates org-owned versioned accounts with idempotency', async () => {
    const dto = {
      ...command(),
      code: 'SYN.1',
      name: 'Receita sintetica',
      group: 'revenue',
      posting: true,
    };
    revenue = (await call('post', '/accounts', dto).expect(201)).body;
    expect((await call('post', '/accounts', dto).expect(201)).body.id).toBe(
      revenue.id,
    );
    await call('post', '/accounts', { ...dto, name: 'Outro nome' }).expect(409);
    cost = (
      await call('post', '/accounts', {
        ...command(),
        code: 'SYN.2',
        name: 'Custo sintetico',
        group: 'direct_cost',
        posting: true,
      }).expect(201)
    ).body;
    expect(await ds.getRepository(DreAccountVersion).count()).toBe(2);
  });
  it('requires evidence and rejects invalid hierarchy and unbounded dates', async () => {
    await call('post', '/accounts', {
      ...command(),
      code: 'SYN.X',
      name: 'Filha sintetica',
      group: 'direct_cost',
      posting: true,
      parent_id: revenue.id,
    }).expect(400);
    await call('post', '/entries', input({ event_document: '' })).expect(400);
    await call('get', '/report?start_month=2020-01&end_month=2026-01').expect(
      400,
    );
  });
  it('records accrual separately and exposes incomplete coverage instead of definitive profit', async () => {
    entry = (await call('post', '/entries', input()).expect(201)).body;
    const r = (await report().expect(200)).body;
    expect(
      r.totals[0].lines.find((l: any) => l.key === 'revenue'),
    ).toMatchObject({ known_amount: '100.01', amount: null });
    expect(r.complete).toBe(false);
    expect(r.rows[0].month).toBe('2026-01');
  });
  it('prevents duplicate economic documents and negative or missing allocations', async () => {
    await call(
      'post',
      '/entries',
      input({ economic_key: entry.economicKey }),
    ).expect(409);
    await call(
      'post',
      '/entries',
      input({
        allocations: [
          { month: '2026-01', account_id: revenue.id, amount: '-1.00' },
        ],
      }),
    ).expect(400);
    await call('post', '/entries', input({ allocations: [] })).expect(400);
  });
  it('keeps unclassified values outside classified totals', async () => {
    await call(
      'post',
      '/entries',
      input({
        allocations: [{ month: '2026-01', account_id: null, amount: '9.99' }],
      }),
    ).expect(201);
    const r = (await report().expect(200)).body;
    expect(r.totals[0].unclassified_amount).toBe('9.99');
    expect(r.totals[0].lines[0].known_amount).toBe('100.01');
  });
  it('versions adjustments and rejects stale revisions', async () => {
    const dto = input({
      source_kind: 'manual',
      economic_key: entry.economicKey,
      revision: entry.revision,
      allocations: [
        { month: '2026-01', account_id: revenue.id, amount: '80.01' },
      ],
    });
    entry = (await call('put', '/entries/' + entry.id, dto).expect(200)).body;
    await call('put', '/entries/' + entry.id, { ...dto, ...command() }).expect(
      409,
    );
    expect(
      await ds
        .getRepository(DreEntryVersion)
        .count({ where: { entryId: entry.id } }),
    ).toBe(2);
  });
  it('enforces organization and project isolation', async () => {
    await call('get', '/accounts?organization_id=999').expect(403);
    await call(
      'get',
      '/report?start_month=2026-01&end_month=2026-01&project_id=999999',
    ).expect(400);
    await call('post', '/entries', input({ project_id: 999999 })).expect(400);
  });
  it('closes only with policy and explicitly allowed partial data, blocks edits, reopens with history', async () => {
    const dto = {
      ...command(),
      revision: 0,
      currency: 'BRL',
      policy_reference: 'POLITICA SINTETICA APROVADA 2026',
      sources_reviewed: true,
      allow_incomplete: false,
      reviewed_groups: [...DRE_GROUPS],
    };
    await call('post', '/periods/2026-01/close', dto).expect(409);
    const p = (
      await call('post', '/periods/2026-01/close', {
        ...dto,
        ...command(),
        allow_incomplete: true,
      }).expect(201)
    ).body;
    await call('post', '/entries', input()).expect(409);
    const list = (await call('get', '/periods').expect(200)).body;
    expect(list[0].data.snapshot.rows).toBeUndefined();
    await call('post', '/periods/2026-01/reopen', {
      ...command(),
      revision: p.revision,
    }).expect(201);
    const history = (await call('get', '/periods/2026-01').expect(200)).body;
    expect(history.history.length).toBe(2);
    await call(
      'post',
      '/entries',
      input({
        allocations: [
          { month: '2026-01', account_id: cost.id, amount: '10.00' },
        ],
      }),
    ).expect(201);
  });
  it('supports comparison without combining currencies and validates range lengths', async () => {
    await call(
      'post',
      '/entries',
      input({
        currency: 'USD',
        allocations: [
          { month: '2026-01', account_id: revenue.id, amount: '7.00' },
        ],
      }),
    ).expect(201);
    const r = (await report().expect(200)).body;
    expect(r.totals.map((x: any) => x.currency).sort()).toEqual(['BRL', 'USD']);
    await call(
      'get',
      '/report?start_month=2026-01&end_month=2026-01&compare_start_month=2025-01&compare_end_month=2025-02',
    ).expect(400);
  });
  it('creates a scoped auditable workbook job and denies unprivileged exports', async () => {
    const dto = {
      start_month: '2026-01',
      end_month: '2026-01',
      kind: 'statement',
    };
    await call('post', '/exports', dto, user).expect(403);
    const e = (await call('post', '/exports', dto).expect(201)).body;
    expect(e.id).toBeDefined();
    await call('get', '/exports/' + e.id).expect(200);
  });
  it('does not duplicate accrual when receiving and reversing cash, and rejects duplicate sources', async () => {
    const finance = (path: string, body: object) =>
      request(app.getHttpServer())
        .post('/api/v1/finance' + path)
        .set('Authorization', 'Bearer ' + admin)
        .send(body);
    const source = {
      company_id: 1,
      origin: 'manual',
      description: 'SINTETICO receita por competencia',
      amount: '33.33',
      currency: 'BRL',
      issued_on: '2026-10-01',
      reason: 'Teste de independencia do caixa',
      payment: { mode: 'equal', count: 1, first_due_on: '2026-10-31' },
    };
    const preview = (await finance('/receivables/preview', source).expect(201))
      .body;
    let receivable = (
      await finance('/receivables', {
        ...command(),
        ...source,
        preview_hash: preview.preview_hash,
      }).expect(201)
    ).body;
    const dto = input({
      source_kind: 'receivable',
      source_id: receivable.id,
      allocations: [
        { month: '2026-02', account_id: revenue.id, amount: '33.33' },
      ],
    });
    const e = (await call('post', '/entries', dto).expect(201)).body;
    await call('post', '/entries', {
      ...dto,
      ...command(),
      economic_key: key(),
    }).expect(409);
    receivable = (
      await finance('/receivables/' + receivable.id + '/receipts', {
        ...command(),
        revision: receivable.revision,
        installment_id: receivable.installments[0].id,
        amount: '33.33',
        received_on: '2026-10-02',
        method: 'synthetic',
        reference: key(),
      }).expect(201)
    ).body;
    const event = receivable.events.find((x: any) => x.operation === 'receipt');
    await finance(
      '/receivables/' + receivable.id + '/receipts/' + event.id + '/reverse',
      {
        ...command(),
        revision: receivable.revision,
        reversed_on: '2026-10-03',
      },
    ).expect(201);
    const r = (
      await call('get', '/report?start_month=2026-02&end_month=2026-02').expect(
        200,
      )
    ).body;
    expect(r.rows.filter((x: any) => x.entry_id === e.id)).toHaveLength(1);
    expect(r.rows.find((x: any) => x.entry_id === e.id).amount).toBe('33.33');
    expect(
      r.stale_sources.some((x: any) => x.key === 'receivable:' + receivable.id),
    ).toBe(false);
  });
  it('serializes competing revisions and preserves both immutable history and a single winner', async () => {
    const body = input({
      economic_key: entry.economicKey,
      revision: entry.revision,
    });
    const responses = await Promise.all([
      call('put', '/entries/' + entry.id, body),
      call('put', '/entries/' + entry.id, { ...body, ...command() }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it('isolates actual foreign organization accounts, entries, project and export', async () => {
    const external = async (path: string, body: object) =>
      (
        await request(app.getHttpServer())
          .post('/api/v1' + path)
          .set('Authorization', 'Bearer ' + platform)
          .send(body)
          .expect(201)
      ).body;
    const org = (
      await external('/organizations', {
        legal_name: 'SINTETICO Outra DRE',
        trade_name: 'DRE Outra',
        cnpj: '11444777000161',
      })
    ).id;
    const company = (
      await external('/companies', {
        organization_id: org,
        name: 'SINTETICO Cliente externo DRE',
      })
    ).id;
    const project = (
      await external('/projects', {
        organization_id: org,
        company_id: company,
        name: 'SINTETICO Projeto externo DRE',
      })
    ).id;
    const account = (
      await call(
        'post',
        '/accounts?organization_id=' + org,
        {
          ...command(),
          code: 'FOREIGN.1',
          name: 'SINTETICO Receita externa',
          group: 'revenue',
          posting: true,
        },
        platform,
      ).expect(201)
    ).body;
    const foreign = (
      await call(
        'post',
        '/entries?organization_id=' + org,
        input({
          project_id: project,
          allocations: [
            { month: '2026-01', account_id: account.id, amount: '12.34' },
          ],
        }),
        platform,
      ).expect(201)
    ).body;
    await call('get', '/accounts/' + account.id).expect(403);
    await call('get', '/entries/' + foreign.id).expect(403);
    await call(
      'get',
      '/report?start_month=2026-01&end_month=2026-01&project_id=' + project,
    ).expect(400);
    await call(
      'post',
      '/entries',
      input({
        allocations: [
          { month: '2026-01', account_id: account.id, amount: '1.00' },
        ],
      }),
    ).expect(400);
    const job = (
      await call(
        'post',
        '/exports',
        {
          organization_id: org,
          start_month: '2026-01',
          end_month: '2026-01',
          kind: 'statement',
        },
        platform,
      ).expect(201)
    ).body;
    await call('get', '/exports/' + job.id).expect(403);
    await call('get', '/exports/' + job.id + '/download').expect(403);
  });
  it('rejects grouping and commercial sources as automatic economic facts', async () => {
    for (const source_kind of [
      'contract',
      'budget',
      'receipt',
      'accountability',
    ])
      await call(
        'post',
        '/entries',
        input({ source_kind, source_id: 1 }),
      ).expect(400);
    const before = (await report().expect(200)).body.rows.length;
    await call('get', '/sources').expect(200);
    expect((await report().expect(200)).body.rows).toHaveLength(before);
  });
  it('keeps partial source balances outside validated results', async () => {
    const sources = (await call('get', '/sources').expect(200)).body.items;
    const s = sources.find((s: any) => s.kind === 'receivable');
    const existing = (await call('get', '/entries/' + s.entry_id).expect(200))
      .body;
    await call('put', '/entries/' + existing.id, {
      ...input(),
      source_kind: 'receivable',
      source_id: s.id,
      economic_key: existing.economicKey,
      revision: existing.revision,
      allocations: [
        { month: '2026-02', account_id: revenue.id, amount: '20.00' },
      ],
    }).expect(200);
    const r = (
      await call('get', '/report?start_month=2026-02&end_month=2026-02').expect(
        200,
      )
    ).body;
    expect(
      r.pending_sources.find((x: any) => x.key === s.key).remaining_amount,
    ).toBe('13.33');
    expect(r.complete).toBe(false);
  });
  it('recognizes original expenses and field payments once, never the accountability grouping or paid date', async () => {
    const api = (path: string, body: object = {}) =>
      request(app.getHttpServer())
        .post('/api/v1' + path)
        .set('Authorization', 'Bearer ' + admin)
        .send(body);
    const project = (
      await api('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO custos DRE',
      }).expect(201)
    ).body.id;
    const agent = (
      await api('/field-agents', {
        name: 'SINTETICO inventariante DRE',
      }).expect(201)
    ).body.id;
    await api('/projects/' + project + '/field-agents', {
      field_agent_id: agent,
      role: 'collector',
    }).expect(201);
    const prefix = '/projects/' + project;
    const expense = (
      await api(prefix + '/expenses', {
        field_agent_id: agent,
        description: 'SINTETICO transporte',
        expense_date: '2026-10-01',
        amount: '10.01',
      }).expect(201)
    ).body;
    await api(prefix + '/expenses/' + expense.id + '/approve').expect(200);
    const grouping = (
      await api(prefix + '/expense-accountabilities', {
        field_agent_id: agent,
        period_start: '2026-10-01',
        period_end: '2026-10-31',
        notes: 'SINTETICO agrupamento sem novo custo',
      }).expect(201)
    ).body;
    await api(
      prefix + '/expense-accountabilities/' + grouping.id + '/expenses',
      { expense_id: expense.id },
    ).expect(200);
    const payment = (
      await api(prefix + '/payments', {
        field_agent_id: agent,
        start_date: '2026-10-01',
        end_date: '2026-10-01',
        payment_date: '2026-10-20',
        daily_rate: '3.33',
      }).expect(201)
    ).body;
    await api(prefix + '/payments/' + payment.id + '/approve').expect(200);
    for (const [source_kind, source_id, amount] of [
      ['expense', expense.id, '10.01'],
      ['payment', payment.id, '3.33'],
    ] as const) {
      const dto = input({
        source_kind,
        source_id,
        project_id: project,
        allocations: [{ month: '2026-03', account_id: cost.id, amount }],
      });
      await call('post', '/entries', dto).expect(400);
      await call('post', '/entries', {
        ...dto,
        ...command(),
        currency_reason: 'Documento sintetico identifica BRL',
      }).expect(201);
    }
    await api(prefix + '/expenses/' + expense.id + '/mark-as-paid').expect(200);
    await api(prefix + '/payments/' + payment.id + '/mark-as-paid', {
      payment_date: '2026-10-21',
    }).expect(200);
    const r = (
      await call(
        'get',
        '/report?start_month=2026-03&end_month=2026-03&project_id=' + project,
      ).expect(200)
    ).body;
    expect(r.rows).toHaveLength(2);
    expect(
      r.totals[0].lines.find((l: any) => l.key === 'direct_cost').known_amount,
    ).toBe('13.34');
    expect(r.stale_sources).toHaveLength(0);
  });
  it('economic reversal keeps immutable versions without deleting financial events', async () => {
    const dto = input();
    let e = (await call('post', '/entries', dto).expect(201)).body;
    e = (
      await call('put', '/entries/' + e.id, {
        ...dto,
        ...command(),
        revision: e.revision,
        status: 'void',
      }).expect(200)
    ).body;
    expect(
      (await report().expect(200)).body.rows.some(
        (r: any) => r.entry_id === e.id,
      ),
    ).toBe(false);
    expect(
      (await call('get', '/entries/' + e.id).expect(200)).body.versions,
    ).toHaveLength(2);
  });
  it('read permission alone grants no mutation or raw closure sources; download revalidates revocation', async () => {
    const role = await ds
      .getRepository(RoleEntity)
      .findOneByOrFail({ name: 'Operador' });
    const permissions = await ds.getRepository(PermissionEntity).find();
    const grant = async (key: string) => {
      const p = permissions.find((p) => p.key === key)!;
      await ds
        .getRepository(RolePermissionEntity)
        .save({ roleId: role.id, permissionId: p.id });
      return p.id;
    };
    const ids: number[] = [];
    ids.push(await grant('dre:read'));
    let restricted = await loginAsOrgUser(app);
    const r = (
      await call(
        'get',
        '/report?start_month=2026-01&end_month=2026-01',
        {},
        restricted,
      ).expect(200)
    ).body;
    expect(r.source_permissions).toEqual([]);
    expect(r.pending_sources).toEqual([]);
    expect(r.complete).toBe(false);
    await call('get', '/periods/2026-01', {}, restricted).expect(403);
    await call('post', '/entries', input(), restricted).expect(403);
    await call(
      'post',
      '/accounts',
      {
        ...command(),
        code: 'NOACCESS',
        name: 'Nao autorizado',
        group: 'revenue',
        posting: true,
      },
      restricted,
    ).expect(403);
    for (const k of [
      'dre:export',
      'export-jobs:create',
      'export-jobs:download',
    ])
      ids.push(await grant(k));
    restricted = await loginAsOrgUser(app);
    const job = (
      await call(
        'post',
        '/exports',
        { start_month: '2026-01', end_month: '2026-01', kind: 'statement' },
        restricted,
      ).expect(201)
    ).body;
    const exportPermission = permissions.find((p) => p.key === 'dre:export')!;
    await ds
      .getRepository(RolePermissionEntity)
      .delete({ roleId: role.id, permissionId: exportPermission.id });
    await call(
      'get',
      '/exports/' + job.id + '/download',
      {},
      restricted,
    ).expect(403);
    for (const permissionId of ids)
      await ds
        .getRepository(RolePermissionEntity)
        .delete({ roleId: role.id, permissionId });
  });
  it('supports annual comparisons and certifies complete documented coverage without inferred taxes', async () => {
    const annual = (
      await call(
        'get',
        '/report?start_month=2026-01&end_month=2026-12&compare_start_month=2025-01&compare_end_month=2025-12',
      ).expect(200)
    ).body;
    expect(
      annual.monthly.filter((m: any) => m.currency === 'BRL'),
    ).toHaveLength(12);
    expect(annual.comparison).toMatchObject({
      start_month: '2025-01',
      end_month: '2025-12',
    });
    const p = (
      await call(
        'post',
        '/periods/2026-01/close?organization_id=2',
        {
          ...command(),
          revision: 0,
          currency: 'BRL',
          policy_reference:
            'POLITICA SINTETICA - ausencia de outros fatos revisada',
          sources_reviewed: true,
          allow_incomplete: false,
          reviewed_groups: [...DRE_GROUPS],
        },
        platform,
      ).expect(201)
    ).body;
    expect(p.data.snapshot.complete).toBe(true);
    const r = (
      await call(
        'get',
        '/report?organization_id=2&start_month=2026-01&end_month=2026-01',
        {},
        platform,
      ).expect(200)
    ).body;
    expect(
      r.totals[0].lines.find((l: any) => l.key === 'income_tax').amount,
    ).toBe('0.00');
    expect(
      r.totals[0].lines.find((l: any) => l.key === 'after_tax').amount,
    ).toBe('12.34');
    expect(r.totals[0].gross_margin).toBe('100.00');
  });
});
