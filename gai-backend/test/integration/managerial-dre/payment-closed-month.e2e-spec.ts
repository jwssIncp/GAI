import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';
import { DRE_GROUPS } from '../../../src/modules/managerial-dre/dre.dto';

/**
 * Competência fechada na DRE: pagar, voltar para em aberto, reagendar e reabrir para
 * edição são recusados enquanto o mês em que o lançamento foi classificado está
 * fechado, e voltam a ser aceitos depois que a competência é reaberta.
 */
describe('Pagamento de inventariantes × competência fechada da DRE (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let seq = 0;
  const MONTH = '2026-10';
  const command = () => ({
    command_key: `sintetico-dre-fechado-${++seq}`,
    reason: 'Evidencia exclusivamente sintetica',
  });
  const post = (path: string, body: object = {}) =>
    request(app.getHttpServer())
      .post('/api/v1' + path)
      .set('Authorization', 'Bearer ' + admin)
      .send(body);
  const get = (path: string) =>
    request(app.getHttpServer())
      .get('/api/v1' + path)
      .set('Authorization', 'Bearer ' + admin);

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('recusa no mês fechado e aceita depois de reaberto', async () => {
    const cost = (
      await post('/finance/dre/accounts', {
        ...command(),
        code: 'SYN.C1',
        name: 'Custo sintetico de campo',
        group: 'direct_cost',
        posting: true,
      }).expect(201)
    ).body as { id: number };
    const project = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO DRE fechada',
      }).expect(201)
    ).body.id as number;
    const agent = (
      await post('/field-agents', { name: 'SINTETICO inventariante' }).expect(
        201,
      )
    ).body.id as number;
    await post(`/projects/${project}/field-agents`, {
      field_agent_id: agent,
      role: 'collector',
    }).expect(201);
    const prefix = `/projects/${project}/payments`;
    const create = async () => {
      const p = (
        await post(prefix, {
          field_agent_id: agent,
          start_date: '2026-10-01',
          end_date: '2026-10-05',
          expected_payment_date: '2026-10-20',
          daily_rate: '100.00',
        }).expect(201)
      ).body as { id: number };
      await post(`${prefix}/${p.id}/approve`).expect(200);
      await post('/finance/dre/entries', {
        ...command(),
        source_kind: 'payment',
        source_id: p.id,
        project_id: project,
        economic_key: `sintetico-diaria-${p.id}`,
        event_document: 'Documento sintetico de diarias de campo',
        description: 'SINTETICO diarias',
        currency: 'BRL',
        currency_reason: 'Documento sintetico identifica BRL',
        status: 'recognized',
        allocations: [{ month: MONTH, account_id: cost.id, amount: '500.00' }],
      }).expect(201);
      return p.id;
    };
    const open = await create(); // aprovado, em aberto
    const paid = await create();
    expect(
      (
        await post('/field-agent-payments/pay', {
          ids: [paid],
          date_mode: 'chosen',
          payment_date: '2026-10-21',
        }).expect(200)
      ).body.done,
    ).toBe(1);

    const closing = (
      await post(`/finance/dre/periods/${MONTH}/close`, {
        ...command(),
        revision: 0,
        currency: 'BRL',
        policy_reference: 'POLITICA SINTETICA APROVADA 2026',
        sources_reviewed: true,
        allow_incomplete: true,
        reviewed_groups: [...DRE_GROUPS],
      }).expect(201)
    ).body as { revision: number };

    // Mês fechado: tudo recusado, nada muda.
    const refusedItem = async (path: string, body: object) => {
      const r = (await post(path, body).expect(200)).body;
      expect(r.done).toBe(0);
      expect(r.results[0].ok).toBe(false);
      expect(r.results[0].message).toContain(MONTH);
    };
    await refusedItem('/field-agent-payments/pay', {
      ids: [open],
      date_mode: 'today',
    });
    await post(`${prefix}/${open}/mark-as-paid`, {
      payment_date: '2026-10-22',
    }).expect(409);
    await refusedItem('/field-agent-payments/revert', { ids: [paid] });
    await post(`/field-agent-payments/${open}/date`, {
      kind: 'expected',
      date: '2026-10-25',
    }).expect(409);
    await post(`/field-agent-payments/${paid}/date`, {
      kind: 'payment',
      date: '2026-10-23',
    }).expect(409);
    await post(`${prefix}/${open}/reopen`, {
      reason: 'Corrigir a quantidade de dias',
    }).expect(409);
    const before = (await get(`/field-agent-payments?project_id=${project}`))
      .body.items as Array<{
      id: number;
      status: string;
      expected_payment_date: string;
      payment_date: string | null;
    }>;
    expect(before.find((i) => i.id === open)).toMatchObject({
      status: 'approved',
      expected_payment_date: '2026-10-20',
    });
    expect(before.find((i) => i.id === paid)).toMatchObject({
      status: 'paid',
      payment_date: '2026-10-21',
    });

    await post(`/finance/dre/periods/${MONTH}/reopen`, {
      ...command(),
      revision: closing.revision,
    }).expect(201);

    // Reaberto: as mesmas ações passam.
    await post(`/field-agent-payments/${open}/date`, {
      kind: 'expected',
      date: '2026-10-25',
    }).expect(200);
    await post(`/field-agent-payments/${paid}/date`, {
      kind: 'payment',
      date: '2026-10-23',
    }).expect(200);
    expect(
      (await post('/field-agent-payments/revert', { ids: [paid] }).expect(200))
        .body.done,
    ).toBe(1);
    await post(`${prefix}/${paid}/reopen`, {
      reason: 'Corrigir a quantidade de dias',
    }).expect(200);
    expect(
      (
        await post('/field-agent-payments/pay', {
          ids: [open],
          date_mode: 'today',
        }).expect(200)
      ).body.done,
    ).toBe(1);
    const after = (await get(`/field-agent-payments?project_id=${project}`))
      .body.items as Array<{ id: number; status: string }>;
    expect(after.find((i) => i.id === open)?.status).toBe('paid');
    expect(after.find((i) => i.id === paid)?.status).toBe('pending');
  });
});
