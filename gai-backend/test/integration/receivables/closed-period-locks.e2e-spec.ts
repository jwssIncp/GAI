import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { DrePeriod } from '../../../src/modules/managerial-dre/dre.entity';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

/**
 * Trava de competência fechada da DRE em TODAS as baixas, estornos e datas que
 * levam um lançamento ao fluxo: recebíveis, fluxo de caixa (despesa), comissões,
 * placas, despesas, parcelas, diárias e configuração da DRE. A recusa diz a
 * ação, o mês e o caminho (reabrir na DRE, com permissão e justificativa).
 * 10/2026 fica fechada (sem coluna congelada) durante o teste; 11/2026, aberta.
 */
describe('Competência fechada: trava em todas as baixas e estornos (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;
  let project: number;
  let seq = 0;
  const key = () => `trava-fechada-${++seq}`;
  const api = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + admin);
  /** Mensagem padrão: ação recusada, mês e caminho. */
  const refused = (action: string) =>
    `${action}: a competência 10/2026 está fechada na DRE. Reabra a competência 10/2026 na DRE (exige permissão e justificativa) e lance novamente.`;
  const setOctober = async (closed: boolean) => {
    const repo = ds.getRepository(DrePeriod);
    const row = await repo.findOneBy({ organizationId: 1, month: '2026-10' });
    if (row) await repo.update({ id: row.id }, { closed });
    else
      await repo.save(
        repo.create({
          organizationId: 1,
          month: '2026-10',
          revision: 1,
          closed,
          data: { hash: 'sintetico' } as never,
        }),
      );
  };
  const receivable = async (first_due_on: string, status: number) => {
    const d = {
      company_id: 1,
      project_id: project,
      origin: 'manual',
      description: 'SINTETICO trava ' + ++seq,
      amount: '100.00',
      currency: 'BRL',
      issued_on: '2026-09-01',
      reason: 'Teste exclusivamente sintético',
      payment: { mode: 'equal', count: 1, first_due_on },
    };
    const p = (
      await api('post', '/finance/receivables/preview').send(d).expect(201)
    ).body;
    return api('post', '/finance/receivables')
      .send({ ...d, preview_hash: p.preview_hash, command_key: key() })
      .expect(status);
  };
  const receive = (
    r: { id: number; revision: number; installments: Array<{ id: number }> },
    received_on: string,
  ) =>
    api('post', `/finance/receivables/${r.id}/receipts`).send({
      revision: r.revision,
      command_key: key(),
      reason: 'Baixa de teste sintético',
      installment_id: r.installments[0].id,
      amount: '100.00',
      received_on,
      method: 'synthetic',
      reference: key(),
    });

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    project = (
      await api('post', '/projects')
        .send({ organization_id: 1, company_id: 1, name: 'SINTETICO trava' })
        .expect(201)
    ).body.id;
    await setOctober(true);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('recebíveis: criar, receber, estornar e reprogramar respeitam a data original e a nova', async () => {
    // criar com vencimento em mês fechado
    const created = await receivable('2026-10-31', 409);
    expect(created.body).toMatchObject({
      code: 'DRE_PERIOD_CLOSED',
      message: refused('Não é possível criar o recebível'),
      details: { months: ['2026-10'] },
    });
    // receber com a data nova em mês fechado
    let r = (await receivable('2026-11-30', 201)).body;
    expect((await receive(r, '2026-10-20').expect(409)).body.message).toBe(
      refused('Não é possível registrar o recebimento'),
    );
    // reprogramar a prevista para mês fechado
    expect(
      (
        await api('post', '/finance/cash-flow/reschedule')
          .send({
            items: [
              { receivable_id: r.id, installment_id: r.installments[0].id },
            ],
            due_on: '2026-10-15',
            reason: 'Teste sintético de reprogramação',
          })
          .expect(200)
      ).body.results[0].message,
    ).toBe(refused('Não é possível alterar a data prevista'));
    // com outubro aberto, recebe em 20/10; fechado de novo, estornar é recusado (data original)
    await setOctober(false);
    r = (await receive(r, '2026-10-20').expect(201)).body;
    await setOctober(true);
    const event = (r.events as Array<{ id: number; operation: string }>).find(
      (e) => e.operation === 'receipt',
    )!;
    expect(
      (
        await api(
          'post',
          `/finance/receivables/${r.id}/receipts/${event.id}/reverse`,
        )
          .send({
            revision: r.revision,
            command_key: key(),
            reason: 'Estorno sintético',
            reversed_on: '2026-11-02',
          })
          .expect(409)
      ).body.message,
    ).toBe(refused('Não é possível estornar o recebimento'));
    // desfazer pelo fluxo: mesma regra (item recusado no lote)
    expect(
      (
        await api('post', '/finance/cash-flow/receipts/undo')
          .send({
            items: [{ receivable_id: r.id, event_id: event.id }],
            reason: 'Recebimento lançado por engano',
          })
          .expect(200)
      ).body,
    ).toMatchObject({ done: 0, failed: 1 });
  });

  it('fluxo de caixa: pagar e desfazer pagamento de despesa (data nova e original)', async () => {
    const expense = (
      await api('post', `/projects/${project}/expenses`)
        .send({
          description: 'SINTETICO despesa faturada',
          expense_date: '2026-11-05',
          amount: '50.00',
          payment_method: 'invoiced',
          invoiced_payment_date: '2026-11-20',
        })
        .expect(201)
    ).body.id;
    const settle = (paid_on: string | null) =>
      api('post', '/finance/cash-flow/outflows/settle')
        .send({
          keys: [`expense:${expense}`],
          paid_on,
          reason: 'Ajuste de baixa no teste',
        })
        .expect(200);
    expect((await settle('2026-10-25')).body.results[0].message).toBe(
      refused('Não é possível registrar o pagamento'),
    );
    await setOctober(false);
    expect((await settle('2026-10-25')).body.done).toBe(1);
    await setOctober(true);
    expect((await settle(null)).body.results[0].message).toBe(
      refused('Não é possível desfazer o pagamento'),
    );
    expect((await settle('2026-11-03')).body.results[0].message).toBe(
      refused('Não é possível alterar a data de pagamento'),
    );
  });

  it('comissões e placas: lançar, pagar e excluir', async () => {
    const partner = (
      await api('post', '/commission-partners')
        .send({ name: 'SINTETICO parceiro', company: 'Trava Ltda' })
        .expect(201)
    ).body.id;
    const commission = (expected_payment_on: string) =>
      api('post', '/commissions').send({
        project_id: project,
        partner_id: partner,
        percent: '5.00',
        contract_value: '1000.00',
        expected_payment_on,
      });
    expect((await commission('2026-10-20').expect(409)).body.message).toBe(
      refused('Não é possível lançar a comissão'),
    );
    const id = (await commission('2026-11-20').expect(201)).body.id;
    expect(
      (
        await api('patch', `/commissions/${id}`)
          .send({ paid_on: '2026-10-25' })
          .expect(409)
      ).body.message,
    ).toBe(refused('Não é possível registrar o pagamento da comissão'));
    // pelo fluxo: a mesma trava (está na origem)
    expect(
      (
        await api('post', '/finance/cash-flow/outflows/settle')
          .send({ keys: [`commission:${id}`], paid_on: '2026-10-25' })
          .expect(200)
      ).body.results[0].message,
    ).toBe(refused('Não é possível registrar o pagamento da comissão'));

    const order = (ordered_on: string) =>
      api('post', '/asset-tag-orders').send({
        project_id: project,
        ordered_on,
        quantity: 10,
        unit_cost: '1.00',
        unit_price: '2.00',
        supplier_name: 'Planner',
      });
    expect((await order('2026-10-05').expect(409)).body.message).toBe(
      refused('Não é possível lançar o pedido de placas'),
    );
    const tag = (await order('2026-11-05').expect(201)).body.id;
    expect(
      (
        await api('patch', `/asset-tag-orders/${tag}`)
          .send({ supplier_paid_on: '2026-10-25' })
          .expect(409)
      ).body.message,
    ).toBe(refused('Não é possível registrar o pagamento ao fornecedor'));
    // pago em 25/10 com o mês aberto; fechado de novo, excluir é recusado
    await setOctober(false);
    await api('patch', `/asset-tag-orders/${tag}`)
      .send({ supplier_paid_on: '2026-10-25' })
      .expect(200);
    await setOctober(true);
    expect(
      (await api('delete', `/asset-tag-orders/${tag}`).expect(409)).body
        .message,
    ).toBe(refused('Não é possível excluir o pedido de placas'));
  });

  it('despesas: lançar, alterar data, gerar parcelas e cancelar', async () => {
    const create = (expense_date: string) =>
      api('post', `/projects/${project}/expenses`).send({
        description: 'SINTETICO despesa',
        expense_date,
        amount: '30.00',
      });
    expect((await create('2026-10-10').expect(409)).body.message).toBe(
      refused('Não é possível lançar a despesa'),
    );
    const id = (await create('2026-11-10').expect(201)).body.id;
    expect(
      (
        await api('patch', `/projects/${project}/expenses/${id}`)
          .send({
            description: 'SINTETICO despesa',
            expense_date: '2026-10-11',
            amount: '30.00',
          })
          .expect(409)
      ).body.message,
    ).toBe(refused('Não é possível alterar a despesa'));
    expect(
      (
        await api(
          'post',
          `/projects/${project}/expenses/${id}/installments/generate`,
        )
          .send({ count: 2, first_due_date: '2026-10-15' })
          .expect(409)
      ).body.message,
    ).toBe(refused('Não é possível gerar as parcelas'));
    // despesa de outubro lançada com o mês aberto: cancelar depois é recusado
    await setOctober(false);
    const october = (await create('2026-10-12').expect(201)).body.id;
    await setOctober(true);
    expect(
      (
        await api('post', `/projects/${project}/expenses/${october}/cancel`)
          .send({})
          .expect(409)
      ).body.message,
    ).toBe(refused('Não é possível cancelar a despesa'));
  });

  it('diárias: lançar, pagar e alterar a data prevista', async () => {
    const agent = (
      await api('post', '/field-agents')
        .send({ name: 'SINTETICO inventariante trava' })
        .expect(201)
    ).body.id;
    await api('post', `/projects/${project}/field-agents`)
      .send({ field_agent_id: agent, role: 'collector' })
      .expect(201);
    const create = (expected_payment_date: string) =>
      api('post', `/projects/${project}/payments`).send({
        field_agent_id: agent,
        start_date: '2026-09-01',
        end_date: '2026-09-02',
        expected_payment_date,
        daily_rate: '100.00',
      });
    expect((await create('2026-10-20').expect(409)).body.message).toBe(
      refused('Não é possível lançar a diária'),
    );
    const id = (await create('2026-11-20').expect(201)).body.id;
    await api('post', `/projects/${project}/payments/${id}/approve`)
      .send({})
      .expect(200);
    const pay = (
      await api('post', '/field-agent-payments/pay')
        .send({ ids: [id], date_mode: 'chosen', payment_date: '2026-10-21' })
        .expect(200)
    ).body;
    expect(pay.results[0].message).toBe(
      refused('Não é possível registrar o pagamento'),
    );
    expect(
      (
        await api('post', `/field-agent-payments/${id}/date`)
          .send({ kind: 'expected', date: '2026-10-25' })
          .expect(409)
      ).body.message,
    ).toBe(refused('Não é possível alterar a data prevista'));
  });

  it('DRE: regras não mudam enquanto houver mês fechado sem coluna congelada', async () => {
    const r = await api('put', '/finance/dre/monthly/rules')
      .send({
        command_key: key(),
        reason: 'Teste sintético de regras',
        rules: { field_agents: null },
      })
      .expect(409);
    expect(r.body.message).toBe(
      'Não é possível alterar as regras da DRE: a competência 10/2026 está fechada sem a coluna congelada e mudaria de valor. Congele a coluna em Competências ou reabra a competência 10/2026 na DRE (exige permissão e justificativa) e altere novamente.',
    );
  });

  it('reaberta a competência, as mesmas ações passam', async () => {
    await setOctober(false);
    const r = (await receivable('2026-10-31', 201)).body;
    await receive(r, '2026-10-20').expect(201);
  });
});
