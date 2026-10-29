import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { DataSource } from 'typeorm';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsOrgUser,
  loginAsAdmin,
} from '../test-app.helper';
import {
  InventoryObservationEntity,
  InventoryConsolidationEntity,
  InventoryReconciliationEntity,
} from '../../../src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity';
import { InventoryItemEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryAccountingItemEntity } from '../../../src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import {
  AssistedCandidate,
  AssistedRun,
  AssistedDecision,
} from '../../../src/modules/assisted-reconciliation/assisted.entity';

describe('Assisted reconciliation HTTP, persistence and domain integration', () => {
  let app: INestApplication,
    ds: DataSource,
    admin: string,
    user: string,
    platform: string,
    seq = 0;
  const post = (path: string, body: object = {}, token = admin) =>
    request(app.getHttpServer())
      .post('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const get = (path: string, token = admin) =>
    request(app.getHttpServer())
      .get('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  const patch = (path: string, body: object) =>
    request(app.getHttpServer())
      .patch('/api/v1' + path)
      .set('Authorization', 'Bearer ' + admin)
      .send(body);
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    platform = await loginAsAdmin(app);
  });
  afterAll(async () => app?.close());
  const fixture = async (physical: object = {}, accounting: object = {}) => {
    const p = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'Assisted synthetic ' + ++seq,
      }).expect(201)
    ).body.id as number;
    const agent = (
      await post('/field-agents', {
        name: 'Synthetic inspector ' + seq,
      }).expect(201)
    ).body.id as number;
    await post(`/projects/${p}/field-agents`, { field_agent_id: agent }).expect(
      201,
    );
    const i = (
      await post(`/projects/${p}/inventory-items`, {
        old_plate: 'P100',
        description: 'Motor eletrico industrial',
        ...physical,
      }).expect(201)
    ).body.id as number;
    const s = (
      await post(`/projects/${p}/inventory-sessions`, {
        name: 'Synthetic session',
      }).expect(201)
    ).body.id as number;
    const round = (
      await post(`/projects/${p}/inventory-sessions/${s}/start`).expect(200)
    ).body.round.id as number;
    const o = (
      await post(
        `/projects/${p}/inventory-sessions/${s}/rounds/${round}/observations`,
        {
          inventory_item_id: i,
          field_agent_id: agent,
          result: 'found',
          observed_plate: 'P100',
          observed_serial_number: 'SN100',
          location_text: 'Galpao 1',
        },
      ).expect(201)
    ).body.id as number;
    // Accounting creation is import-only: exercise the actual CSV parser/import rather than inventing a create API.
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          placa: 'P100',
          descricao_01: 'Motor eletrico industrial',
          numero_serie: 'SN100',
          localizacao: 'Galpao 1',
        },
      ]),
      'Base',
    );
    const imported = await request(app.getHttpServer())
      .post(`/api/v1/projects/${p}/accounting-imports`)
      .set('Authorization', 'Bearer ' + admin)
      .attach(
        'file',
        XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
        'base.xlsx',
      );
    expect(imported.status).toBe(201);
    const a = (
      await ds
        .getRepository(InventoryAccountingItemEntity)
        .findOneByOrFail({ projectId: p })
    ).id;
    if (Object.keys(accounting).length)
      await ds
        .getRepository(InventoryAccountingItemEntity)
        .update(a, accounting);
    return {
      p,
      s,
      i,
      o,
      a,
      round,
      agent,
      base: `/projects/${p}/inventory-sessions/${s}/assisted-reconciliation`,
    };
  };
  const generate = async (f: Awaited<ReturnType<typeof fixture>>) => {
    const run = (await post(f.base + '/runs', {}).expect(201))
      .body as AssistedRun;
    const page = (await get(f.base + `/runs/${run.id}/candidates`).expect(200))
      .body as { items: AssistedCandidate[]; stale: boolean };
    return { run, ...page };
  };
  const decide = (
    f: Awaited<ReturnType<typeof fixture>>,
    r: AssistedRun,
    c: AssistedCandidate,
    over: object = {},
  ) => ({
    revision: c.revision,
    source_hash: r.sourceHash,
    action: 'approved',
    reason: 'Revisao humana das fontes sintéticas',
    command_key: 'decision-' + ++seq,
    ...over,
  });
  it('persists serial imported explicitly, normalized plate and source evidence without changing the plate algorithm', async () => {
    const f = await fixture();
    const g = await generate(f);
    expect(g.stale).toBe(false);
    expect(g.items[0].evidence?.rule).toBe('exact_plate');
    expect(g.items[0].accounting?.serial).toBe('SN100');
    const old = await post(
      `/projects/${f.p}/inventory-sessions/${f.s}/reconciliations`,
    ).expect(201);
    expect(old.body.records[0].status).toBe('matched');
    expect(
      await ds
        .getRepository(InventoryConsolidationEntity)
        .countBy({ projectId: f.p }),
    ).toBe(0);
  });
  it('approves atomically/idempotently into normal consolidation and preserves every source', async () => {
    const f = await fixture(
      {},
      { plate: 'OTHER', description: 'Mesa administrativa' },
    );
    const g = await generate(f),
      c = g.items[0];
    expect(c.evidence?.rule).toBe('exact_serial');
    expect(c.evidence?.alerts.join()).toContain('Descrição');
    const before = {
      item: await ds
        .getRepository(InventoryItemEntity)
        .findOneByOrFail({ id: f.i }),
      observation: await ds
        .getRepository(InventoryObservationEntity)
        .findOneByOrFail({ id: f.o }),
      accounting: await ds
        .getRepository(InventoryAccountingItemEntity)
        .findOneByOrFail({ id: f.a }),
    };
    const dto = decide(f, g.run, c);
    const path = f.base + `/candidates/${c.id}/decisions`;
    const first = await post(path, dto).expect(201);
    expect((await post(path, dto).expect(201)).body).toEqual(first.body);
    expect(
      (
        await post(
          path,
          Object.fromEntries(Object.entries(dto).reverse()),
        ).expect(201)
      ).body,
    ).toEqual(first.body);
    await post(path, { ...dto, reason: 'Different reason' }).expect(409);
    const snap = await ds
      .getRepository(InventoryConsolidationEntity)
      .findOneByOrFail({ projectId: f.p });
    expect(snap.evidenceSnapshot.evidence).toMatchObject({
      assisted_candidate_id: c.id,
      source_hash: g.run.sourceHash,
    });
    expect(
      await ds
        .getRepository(InventoryConsolidationEntity)
        .countBy({ projectId: f.p }),
    ).toBe(1);
    expect(
      await ds.getRepository(InventoryItemEntity).findOneByOrFail({ id: f.i }),
    ).toEqual(before.item);
    expect(
      await ds
        .getRepository(InventoryObservationEntity)
        .findOneByOrFail({ id: f.o }),
    ).toEqual(before.observation);
    expect(
      await ds
        .getRepository(InventoryAccountingItemEntity)
        .findOneByOrFail({ id: f.a }),
    ).toEqual(before.accounting);
    expect(
      (await get(f.base + `/candidates/${c.id}/history`).expect(200)).body
        .items[0],
    ).toMatchObject({ action: 'approved', reason: dto.reason, revision: 2 });
    const next = await generate(f);
    await post(
      f.base + `/candidates/${next.items[0].id}/decisions`,
      decide(f, next.run, next.items[0]),
    ).expect(409);
    const old = await post(
      `/projects/${f.p}/inventory-sessions/${f.s}/reconciliations`,
    ).expect(201);
    await post(
      `/projects/${f.p}/inventory-sessions/${f.s}/reconciliations/${old.body.records[0].id}/consolidate`,
      { decision: 'accepted' },
    ).expect(409);
  });
  it('rejects with history, no consolidation; immutable reviewed candidate requires a new run', async () => {
    const f = await fixture();
    const g = await generate(f),
      c = g.items[0];
    const dto = decide(f, g.run, c, { action: 'rejected' });
    await post(f.base + `/candidates/${c.id}/decisions`, dto).expect(201);
    await post(f.base + `/candidates/${c.id}/decisions`, {
      ...dto,
      command_key: 'other-command',
    }).expect(409);
    expect(
      await ds
        .getRepository(InventoryConsolidationEntity)
        .countBy({ projectId: f.p }),
    ).toBe(0);
    expect(
      await ds.getRepository(AssistedDecision).countBy({ candidateId: c.id }),
    ).toBe(1);
  });
  it('detects stale source edits, additions and soft deletion before approval', async () => {
    const f = await fixture();
    const g = await generate(f),
      c = g.items[0];
    await patch(`/projects/${f.p}/inventory-accounting-items/${f.a}`, {
      description: 'Alterada',
    }).expect(200);
    expect(
      (await get(f.base + `/runs/${g.run.id}/candidates`).expect(200)).body
        .stale,
    ).toBe(true);
    await post(
      f.base + `/candidates/${c.id}/decisions`,
      decide(f, g.run, c),
    ).expect(409);
    expect(
      await ds.getRepository(AssistedDecision).countBy({ candidateId: c.id }),
    ).toBe(0);
    const fresh = await generate(f);
    await ds.getRepository(InventoryAccountingItemEntity).softDelete(f.a);
    await post(
      f.base + `/candidates/${fresh.items[0].id}/decisions`,
      decide(f, fresh.run, fresh.items[0]),
    ).expect(409);
  });
  it('records all ambiguous candidates and blocks duplicate plate/series without deleting evidence', async () => {
    const f = await fixture();
    const original = await ds
      .getRepository(InventoryAccountingItemEntity)
      .findOneByOrFail({ id: f.a });
    const copy = ds
      .getRepository(InventoryAccountingItemEntity)
      .create({ ...original, id: undefined });
    await ds.getRepository(InventoryAccountingItemEntity).save(copy);
    const g = await generate(f);
    expect(g.items).toHaveLength(2);
    expect(g.run.summary.ambiguous).toBe(2);
    expect(g.items[0].warnings.join()).toContain('Duplicidade');
    await post(
      f.base + `/candidates/${g.items[0].id}/decisions`,
      decide(f, g.run, g.items[0]),
    ).expect(409);
  });
  it('does not replace prior consolidated decisions', async () => {
    const f = await fixture();
    const old = await post(
      `/projects/${f.p}/inventory-sessions/${f.s}/reconciliations`,
    ).expect(201);
    await post(
      `/projects/${f.p}/inventory-sessions/${f.s}/reconciliations/${old.body.records[0].id}/consolidate`,
      { decision: 'accepted' },
    ).expect(201);
    const before = await ds
      .getRepository(InventoryConsolidationEntity)
      .findBy({ projectId: f.p });
    const g = await generate(f);
    await post(
      f.base + `/candidates/${g.items[0].id}/decisions`,
      decide(f, g.run, g.items[0]),
    ).expect(409);
    expect(
      await ds
        .getRepository(InventoryConsolidationEntity)
        .findBy({ projectId: f.p }),
    ).toEqual(before);
  });
  it('serializes competing decisions with a single durable winner', async () => {
    const f = await fixture();
    const g = await generate(f),
      c = g.items[0];
    const path = f.base + `/candidates/${c.id}/decisions`;
    if (ds.options.type === 'mysql') {
      const results = await Promise.all([
        post(path, decide(f, g.run, c)),
        post(path, decide(f, g.run, c)),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    } else {
      await post(path, decide(f, g.run, c)).expect(201);
      await post(path, decide(f, g.run, c)).expect(409);
    }
    expect(
      await ds
        .getRepository(InventoryConsolidationEntity)
        .countBy({ projectId: f.p }),
    ).toBe(1);
  });
  it('validates auth, RBAC and foreign project/session/run/candidate IDs', async () => {
    const f = await fixture(),
      other = await fixture();
    const g = await generate(f);
    await request(app.getHttpServer())
      .get('/api/v1' + f.base + '/runs')
      .expect(401);
    await get(f.base + '/runs', user).expect(403);
    await get(other.base + `/runs/${g.run.id}/candidates`).expect(404);
    await get(other.base + `/candidates/${g.items[0].id}/history`).expect(404);
    await post(
      other.base + `/candidates/${g.items[0].id}/decisions`,
      decide(f, g.run, g.items[0]),
    ).expect(404);
    const org = (
      await post(
        '/organizations',
        { legal_name: 'Other synthetic org', cnpj: '11444777000161' },
        platform,
      ).expect(201)
    ).body.id as number;
    const company = (
      await post(
        '/companies',
        { organization_id: org, name: 'Other company' },
        platform,
      ).expect(201)
    ).body.id as number;
    const foreign = (
      await post(
        '/projects',
        { organization_id: org, company_id: company, name: 'Other tenant' },
        platform,
      ).expect(201)
    ).body.id as number;
    await get(
      `/projects/${foreign}/inventory-sessions/${f.s}/assisted-reconciliation/runs`,
    ).expect(403);
    await post(f.base + '/runs', {
      config: {
        version: 1,
        textThreshold: 0.6,
        localTextThreshold: 0.6,
        descriptionAlertThreshold: 0.2,
      },
    }).expect(400);
  });
  it('exposes a shared text/local candidate and enforces one-to-one approval across runs', async () => {
    const f = await fixture({}, { plate: null, serialNumber: null });
    const second = (
      await post(`/projects/${f.p}/inventory-items`, {
        old_plate: 'P200',
        description: 'Motor eletrico industrial',
      }).expect(201)
    ).body.id as number;
    await post(
      `/projects/${f.p}/inventory-sessions/${f.s}/rounds/${f.round}/observations`,
      {
        inventory_item_id: second,
        field_agent_id: f.agent,
        result: 'found',
        observed_plate: 'P200',
        observed_serial_number: 'SN200',
        location_text: 'Galpao 1',
      },
    ).expect(201);
    const g = await generate(f);
    expect(g.items).toHaveLength(2);
    expect(
      g.items.every((c) => c.evidence?.rule === 'description_location'),
    ).toBe(true);
    expect(
      g.items.every((c) => c.warnings.join().includes('compartilhado')),
    ).toBe(true);
    await post(
      f.base + `/candidates/${g.items[0].id}/decisions`,
      decide(f, g.run, g.items[0]),
    ).expect(201);
    await post(
      f.base + `/candidates/${g.items[1].id}/decisions`,
      decide(f, g.run, g.items[1]),
    ).expect(409);
    expect(
      await ds
        .getRepository(InventoryConsolidationEntity)
        .countBy({ projectId: f.p }),
    ).toBe(1);
  });
  it('keeps generation and history pagination bounded and detects added observations', async () => {
    const f = await fixture();
    for (let n = 0; n < 20; n++) {
      const i = (
        await post(`/projects/${f.p}/inventory-items`, {
          old_plate: 'Z' + n,
          description: 'Sem descricao correspondente ' + n,
        }).expect(201)
      ).body.id as number;
      await post(
        `/projects/${f.p}/inventory-sessions/${f.s}/rounds/${f.round}/observations`,
        {
          inventory_item_id: i,
          field_agent_id: f.agent,
          result: 'found',
          observed_plate: 'Z' + n,
        },
      ).expect(201);
    }
    const g = await generate(f);
    expect(g.run.summary.physical).toBe(20);
    expect(g.run.nextItemId).not.toBeNull();
    const next = (
      await post(f.base + '/runs', { after_item_id: g.run.nextItemId }).expect(
        201,
      )
    ).body as AssistedRun;
    expect(next.summary.physical).toBe(1);
    expect(next.nextItemId).toBeNull();
    const page = (
      await get(
        f.base + `/runs/${g.run.id}/candidates?page=2&page_size=1`,
      ).expect(200)
    ).body as { items: AssistedCandidate[]; total: number };
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(20);
    const c = g.items.find((c) => c.accountingItemId === f.a)!;
    await post(
      f.base + `/candidates/${c.id}/decisions`,
      decide(f, g.run, c, { action: 'rejected' }),
    ).expect(201);
    const history = (
      await get(
        f.base + `/candidates/${c.id}/history?page=1&page_size=20`,
      ).expect(200)
    ).body as { items: unknown[] };
    expect(history.items).toHaveLength(1);
    const reinventory = (
      await post(`/projects/${f.p}/inventory-sessions/${f.s}/reinventory`, {
        inventory_item_id: f.i,
        reason: 'Confirmar fonte',
      }).expect(201)
    ).body.id as number;
    await post(
      `/projects/${f.p}/inventory-sessions/${f.s}/rounds/${reinventory}/observations`,
      {
        inventory_item_id: f.i,
        field_agent_id: f.agent,
        result: 'found',
        observed_plate: 'P100',
      },
    ).expect(201);
    expect(
      (await get(f.base + `/runs/${g.run.id}/candidates`).expect(200)).body
        .stale,
    ).toBe(true);
  });
  it('preserves series and original accounting fields in partial PATCH and response', async () => {
    const f = await fixture();
    const changed = await patch(
      `/projects/${f.p}/inventory-accounting-items/${f.a}`,
      { description: 'Motor eletrico industrial revisado' },
    ).expect(200);
    expect(changed.body).toMatchObject({
      plate: 'P100',
      serial_number: 'SN100',
      location: 'Galpao 1',
      description: 'Motor eletrico industrial revisado',
    });
    expect(
      await ds
        .getRepository(InventoryAccountingItemEntity)
        .findOneByOrFail({ id: f.a }),
    ).toMatchObject({
      plate: 'P100',
      serialNumber: 'SN100',
      location: 'Galpao 1',
    });
    const series = await patch(
      `/projects/${f.p}/inventory-accounting-items/${f.a}`,
      { serial_number: 'SN200' },
    ).expect(200);
    expect(series.body).toMatchObject({
      plate: 'P100',
      serial_number: 'SN200',
      description: 'Motor eletrico industrial revisado',
    });
  });
  it('persists explicit no-candidate records and leaves incomplete sources untouched', async () => {
    const f = await fixture(
      { description: null },
      { plate: null, serialNumber: null, description: null },
    );
    const g = await generate(f);
    expect(g.items[0].accounting).toBeNull();
    expect(g.run.summary.withoutCandidates).toBe(1);
    await post(
      f.base + `/candidates/${g.items[0].id}/decisions`,
      decide(f, g.run, g.items[0]),
    ).expect(409);
    expect(
      await ds
        .getRepository(InventoryReconciliationEntity)
        .countBy({ projectId: f.p }),
    ).toBe(0);
  });
});
