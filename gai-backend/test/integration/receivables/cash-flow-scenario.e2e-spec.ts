import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  ContractAmendmentEntity,
  ContractEntity,
} from '../../../src/modules/contracts/contract.entity';
import {
  createTestApp,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

type Item = {
  key: string;
  direction: 'in' | 'out';
  group: string;
  origin: string;
  date: string;
  status: string;
  overdue: boolean;
  overdue_days: number;
  gross: string;
  net: string;
  project_name: string;
  installment: { number: number; of: number } | null;
  refs: Record<string, string | number | null>;
};

/**
 * Cenário de referência da etapa 7 (doc 06 §7), com os valores esperados
 * calculados à mão (IR 13,33%; prazo da 1ª parcela 30 dias; referência:
 * hoje = 14/11/2026, mês = 12/2026, ano = 2026). A tabela "esperado × obtido"
 * do relatório da etapa sai destas asserções.
 */
describe('Fluxo de caixa: cenário de referência (MySQL)', () => {
  let app: INestApplication;
  let admin: string;
  let user: string;
  let ds: DataSource;
  let alfa: number;
  let beta: number;
  let agent: number;
  const api = (method: 'get' | 'post' | 'patch', path: string, token = admin) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  const board = async (query = 'as_of=2026-11-14&month=2026-12&year=2026') =>
    (await api('get', `/finance/cash-flow/board?${query}`).expect(200))
      .body as {
      kpis: Array<Record<string, Record<string, string | number>>>;
      alerts: Record<string, unknown>;
      items: Item[];
    };

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    const defaults = (
      await api('get', '/finance-settings/defaults').expect(200)
    ).body as Record<string, unknown>;
    await api('post', '/finance-settings')
      .send({
        valid_from: '2026-01-01',
        reason: 'Parametros do cenario',
        values: defaults,
      })
      .expect(201);
    const project = async (name: string) =>
      (
        await api('post', '/projects')
          .send({ organization_id: 1, company_id: 1, name })
          .expect(201)
      ).body.id as number;
    alfa = await project('Alfa fluxo');
    beta = await project('Beta fluxo');
    agent = (
      await api('post', '/field-agents').send({ name: 'Ana Fluxo' }).expect(201)
    ).body.id;
    await api('post', `/projects/${alfa}/field-agents`)
      .send({ field_agent_id: agent, role: 'collector' })
      .expect(201);
    const contracts = ds.getRepository(ContractEntity);
    const base = {
      status: 'active',
      currency: 'BRL',
      services: [],
      company_name: 'Empresa',
      company_state: null,
      current_ends_on: null,
      current_scope: null,
    };
    const ca = await contracts.save({
      organizationId: 1,
      projectId: alfa,
      companyId: 1,
      number: 'CT-A',
      revision: 1,
      data: {
        ...base,
        number: 'CT-A',
        company_id: 1,
        original_value: '12000.00',
        current_value: '15000.00',
        contracted_on: '2026-11-02',
        payment_plan: { mode: 'equal', installments: 3, percentages: null },
        expenses_paid_by: 'client',
        amendment_installments: { 'AD-1': 2 },
      } as never,
    });
    await contracts.save({
      organizationId: 1,
      projectId: beta,
      companyId: 1,
      number: 'CT-B',
      revision: 1,
      data: {
        ...base,
        number: 'CT-B',
        company_id: 1,
        original_value: '10000.00',
        current_value: '10000.00',
        contracted_on: '2026-05-01',
        payment_plan: {
          mode: 'percentages',
          installments: 2,
          percentages: ['30.00', '70.00'],
        },
        tags_paid_by: 'company',
      } as never,
    });
    const [{ id: actorId }] = await ds.query(
      'SELECT id FROM users ORDER BY id LIMIT 1',
    );
    await ds.getRepository(ContractAmendmentEntity).save({
      contractId: Number(ca.id),
      organizationId: 1,
      projectId: alfa,
      identifier: 'AD-1',
      datedOn: '2026-12-05',
      type: 'value',
      valueDelta: '3000.00',
      endsOn: null,
      scope: null,
      reason: 'Aditivo do cenario',
      actorId: Number(actorId),
      revision: 1,
      recordedAt: new Date(),
    });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('propostas (D-F): contrato, aditivo e plano em %; datas = contrato + 30 dias + i meses', async () => {
    const items = (await board('as_of=2026-11-14&year=2027')).items.concat(
      (await board('as_of=2026-11-14&year=2026')).items,
    );
    const proposed = (key: string) =>
      [
        ...new Map(
          items.filter((i) => i.refs.source_key === key).map((i) => [i.key, i]),
        ).values(),
      ]
        .map((i) => [i.date, i.gross])
        .sort((a, b) => a[0].localeCompare(b[0]));
    expect(
      proposed(
        `contract:${(await ds.getRepository(ContractEntity).findOneByOrFail({ number: 'CT-A' })).id}`,
      ),
    ).toEqual([
      ['2026-12-02', '4000.00'],
      ['2027-01-02', '4000.00'],
      ['2027-02-02', '4000.00'],
    ]);
    const all = await board('as_of=2026-11-14&year=2026');
    expect(all.alerts.proposed_count).toBe(3);
  });

  it('monta o cenário: confirma CA e CB, recebe, reprograma, diárias, despesas, lote, comissão e placa', async () => {
    const contracts = await ds
      .getRepository(ContractEntity)
      .find({ where: { organizationId: 1 } });
    const keyOf = (n: string) =>
      `contract:${contracts.find((c) => c.number === n)!.id}`;
    const confirmed = (
      await api('post', '/finance/cash-flow/proposals/confirm')
        .send({ keys: [keyOf('CT-A'), keyOf('CT-B')] })
        .expect(200)
    ).body;
    expect(confirmed.done).toBe(2);
    // confirmar de novo: recusado no item (origem já gerou recebível)
    expect(
      (
        await api('post', '/finance/cash-flow/proposals/confirm')
          .send({ keys: [keyOf('CT-A')] })
          .expect(200)
      ).body.failed,
    ).toBe(1);
    let items = (await board('as_of=2026-11-14&year=2026')).items;
    const ca1 = items.find(
      (i) =>
        i.origin === 'contract' &&
        i.project_name === 'Alfa fluxo' &&
        i.installment?.number === 1,
    )!;
    await api('post', '/finance/cash-flow/receipts')
      .send({
        items: [
          {
            receivable_id: ca1.refs.receivable_id,
            installment_id: ca1.refs.installment_id,
          },
        ],
        received_on: '2026-11-10',
      })
      .expect(200);
    items = (await board('as_of=2026-11-14&year=2027')).items;
    const cb2 =
      items.find(
        (i) =>
          i.project_name === 'Beta fluxo' &&
          i.installment?.number === 2 &&
          i.direction === 'in',
      ) ??
      (await board('as_of=2026-11-14&year=2026')).items.find(
        (i) =>
          i.project_name === 'Beta fluxo' &&
          i.installment?.number === 2 &&
          i.direction === 'in',
      )!;
    const r = await api('post', '/finance/cash-flow/reschedule')
      .send({
        items: [
          {
            receivable_id: cb2.refs.receivable_id,
            installment_id: cb2.refs.installment_id,
          },
        ],
        due_on: '2027-01-15',
        reason: 'Cliente pediu prorrogação',
      })
      .expect(200);
    expect(r.body.done).toBe(1);

    // Diárias: P1 em aberto (prevista 10/12), P2 paga em 10/11
    const pay = (rate: string, expected: string) =>
      api('post', `/projects/${alfa}/payments`)
        .send({
          field_agent_id: agent,
          start_date: '2026-11-01',
          end_date: '2026-11-05',
          expected_payment_date: expected,
          daily_rate: rate,
        })
        .expect(201);
    const p1 = (await pay('200.00', '2026-12-10')).body.id;
    const p2 = (await pay('100.00', '2026-11-20')).body.id;
    for (const id of [p1, p2])
      await api('post', `/projects/${alfa}/payments/${id}/approve`).expect(200);
    await api('post', '/field-agent-payments/pay')
      .send({ ids: [p2], date_mode: 'chosen', payment_date: '2026-11-10' })
      .expect(200);

    // Despesas: E1 à vista (não reemb.), E2 a prazo 3x (reemb.), E3 faturada (não reemb.)
    const expense = (body: Record<string, unknown>) =>
      api('post', `/projects/${alfa}/expenses`)
        .send({ description: 'Cenario', field_agent_id: agent, ...body })
        .expect(201);
    await expense({
      amount: '200.00',
      expense_date: '2026-11-03',
      expense_type: 'non_reimbursable',
      payment_method: 'cash',
    });
    const e2 = (
      await expense({
        amount: '300.00',
        expense_date: '2026-11-13',
        payment_method: 'installments',
        installment_count: 3,
      })
    ).body;
    expect(e2.expense_type).toBe('reimbursable'); // padrão do contrato (cliente)
    await expense({
      amount: '450.00',
      expense_date: '2026-11-05',
      expense_type: 'non_reimbursable',
      payment_method: 'invoiced',
      invoiced_payment_date: '2026-12-20',
    });
    // Baixa manual da 1ª parcela de E2 no fluxo
    expect(
      (
        await api('post', '/finance/cash-flow/outflows/settle')
          .send({
            keys: [`expense:${e2.id}:installment:1`],
            paid_on: '2026-11-12',
          })
          .expect(200)
      ).body.done,
    ).toBe(1);
    // Editar a origem (descrição) não perde a baixa
    await api('patch', `/projects/${alfa}/expenses/${e2.id}`)
      .send({
        description: 'Cenario editado',
        field_agent_id: agent,
        amount: '300.00',
        expense_date: '2026-11-13',
        payment_method: 'installments',
      })
      .expect(200);
    // Prestar conta de E2: lote faturado com previsão 25/01/2027 → proposta de reembolso → confirmada
    const batch = (
      await api('post', `/projects/${alfa}/reimbursement-batches`)
        .send({ ids: [e2.id] })
        .expect(200)
    ).body.batch_id;
    await api('post', `/projects/${alfa}/reimbursement-batches/${batch}/bill`)
      .send({ expected_receipt_on: '2027-01-25' })
      .expect(200);
    expect(
      (
        await api('post', '/finance/cash-flow/proposals/confirm')
          .send({ keys: [`reimbursement:${batch}`] })
          .expect(200)
      ).body.done,
    ).toBe(1);

    // Comissão 5% de 12.000 prevista 28/12; placa 100 × 2,00 / 5,00 (16%)
    const partner = (
      await api('post', '/commission-partners')
        .send({ name: 'Parceiro Fluxo' })
        .expect(201)
    ).body.id;
    await api('post', '/commissions')
      .send({
        project_id: alfa,
        partner_id: partner,
        contract_value: '12000.00',
        percent: '5.00',
        expected_payment_on: '2026-12-28',
      })
      .expect(201);
    await api('post', '/asset-tag-orders')
      .send({
        project_id: beta,
        ordered_on: '2026-11-05',
        quantity: 100,
        unit_cost: '2.00',
        unit_price: '5.00',
        supplier_name: 'Planner',
        supplier_expected_payment_on: '2026-12-18',
        client_expected_receipt_on: '2027-01-20',
      })
      .expect(201);
  });

  it('KPIs do mês atual como a tela pede (sem mês): referência 11/2026 e próximo 12/2026', async () => {
    // A tela não envia o mês: a API usa o mês da data de referência (14/11/2026).
    const res = (
      await api(
        'get',
        '/finance/cash-flow/board?as_of=2026-11-14&year=2026',
      ).expect(200)
    ).body as {
      reference: { month: string; year: string };
      kpis: Array<Record<string, Record<string, string>>>;
    };
    expect(res.reference).toEqual({ month: '2026-11', year: '2026' });
    const brl = res.kpis.find(
      (k) => (k.currency as unknown as string) === 'BRL',
    )!;
    // 11/2026: recebido CA#1 4.000 (10/11); pagos IR 533,20 + diária P2 500 + E1 200 + E2#1 100 = 1.333,20
    expect(brl.month).toEqual({
      reference: '2026-11',
      in_realized: '4000.00',
      in_open: '0.00',
      out_realized: '1333.20',
      out_open: '0.00',
      total: '2666.80',
    });
    // 12/2026: nenhuma entrada em aberto (CA#1 já recebida); saídas P1 1.000 + placa 200 + E3 450 + comissão 600
    expect(brl.next_month).toEqual({
      reference: '2026-12',
      in_gross: '0.00',
      in_net: '0.00',
      out: '2250.00',
      total: '-2250.00',
    });
  });

  it('KPIs: esperado (calculado à mão) × obtido', async () => {
    const { kpis, alerts } = await board();
    const brl = kpis.find((k) => (k.currency as unknown as string) === 'BRL')!;
    expect(brl.month).toEqual({
      reference: '2026-12',
      in_realized: '0.00',
      in_open: '0.00',
      out_realized: '0.00',
      out_open: '2250.00',
      total: '-2250.00',
    });
    expect(brl.next_month).toEqual({
      reference: '2027-01',
      in_gross: '13220.00',
      in_net: '11553.75',
      out: '100.00',
      total: '11453.75',
    });
    expect(brl.year).toEqual({
      reference: '2026',
      in: '7000.00',
      out: '3983.10',
      total: '3016.90',
      in_open_net: '2600.10',
      out_open: '2250.00',
    });
    expect(brl.overdue).toEqual({
      in: '3000.00',
      in_count: 1,
      out: '0.00',
      out_count: 0,
    });
    expect(brl.proposed).toEqual({ amount: '3000.00', count: 2 });
    expect(alerts.proposed_count).toBe(1); // só o aditivo segue não confirmado
  });

  it('tabelas: entradas, IR derivado, saídas, baixa preservada e vencida aparecendo por padrão', async () => {
    const y26 = (await board()).items;
    const y27 = (await board('as_of=2026-11-14&month=2026-12&year=2027')).items;
    const pick = (items: Item[], f: (i: Item) => boolean) =>
      items
        .filter(f)
        .map((i) => `${i.date} ${i.origin} ${i.status} ${i.gross}`);
    // 2026: 11 movimentos (2 entradas + 9 saídas, contando 2 de IR)
    expect(y26).toHaveLength(11);
    expect(pick(y26, (i) => i.direction === 'in')).toEqual([
      '2026-05-31 contract open 3000.00',
      '2026-11-10 contract realized 4000.00',
    ]);
    expect(pick(y26, (i) => i.origin === 'income_tax')).toEqual([
      '2026-05-31 income_tax open 399.90',
      '2026-11-10 income_tax realized 533.20',
    ]);
    expect(
      pick(y26, (i) => i.direction === 'out' && i.origin !== 'income_tax'),
    ).toEqual([
      '2026-11-03 expense realized 200.00',
      '2026-11-10 field_agent_payment realized 500.00',
      '2026-11-12 expense realized 100.00', // baixa manual mantida após editar a despesa
      '2026-12-10 field_agent_payment open 1000.00',
      '2026-12-18 asset_tag_cost open 200.00',
      '2026-12-20 expense open 450.00',
      '2026-12-28 commission open 600.00',
    ]);
    const overdue = y26.find((i) => i.overdue)!;
    expect(overdue).toMatchObject({
      date: '2026-05-31',
      gross: '3000.00',
      net: '2600.10',
      overdue_days: 167,
    });
    // 2027: 14 movimentos do ano + a entrada vencida de 2026 (nunca escondida)
    expect(y27).toHaveLength(15);
    expect(y27[0]).toMatchObject({ date: '2026-05-31', overdue: true });
    expect(pick(y27, (i) => i.direction === 'in')).toEqual([
      '2026-05-31 contract open 3000.00',
      '2027-01-02 contract open 4000.00',
      '2027-01-04 amendment proposed 1500.00',
      '2027-01-15 contract open 7000.00', // reprogramada de 30/06/2026
      '2027-01-20 asset_tag open 420.00',
      '2027-01-25 reimbursement open 300.00',
      '2027-02-02 contract open 4000.00',
      '2027-02-04 amendment proposed 1500.00',
    ]);
    expect(y27.find((i) => i.origin === 'reimbursement')).toMatchObject({
      net: '300.00',
      group: 'reimbursement',
    }); // sem IR
  });

  /**
   * Etapa 8. Parâmetros = padrões (IR 13,33%; sócio 10%; margem econômica 10%;
   * custo fixo 10.915,00 + 3.021,00; itens em "média DRE" indisponíveis).
   * Janela 12/2025–11/2026 (realizado): receita 4.000,00 (CA#1); IR 533,20 =
   * 13,33%; diárias 500,00 = 12,50%; não reemb. 200,00 (E1) = 5,00%; comissão
   * 0; sócio efetivo 10 × (100 − 13,33)/100 = 8,667%.
   * MC = 100 − 13,33 − 12,50 − 5,00 − 0 − 8,667 = 60,503 → 60,50; MCe = 65,50.
   * Resultado do fluxo 2026 = 3.016,90; custo fixo 12 × 13.936,00 = 167.232,00;
   * operacional = 3.016,90 − 167.232,00 = −164.215,10 (sócio 0: todos os
   * trimestres negativos) = resultado projetado.
   * PEC = 164.215,10 / 0,65503 = 250.698,59.
   * PEE = (10% × 7.000,00 + 164.215,10) / (0,65503 − 0,10) = 297.128,26.
   * Margem líquida = −164.215,10 / (7.000,00 − 650,00/0,8667) = −2.627,43%.
   * Prazo médio: CA#1 contratada 02/11, recebida 10/11 = 8,0 dias.
   */
  it('indicadores: esperado (calculado à mão) × obtido', async () => {
    const r = (
      await api(
        'get',
        '/finance/cash-flow/indicators?as_of=2026-11-14&month=2026-12&year=2026',
      ).expect(200)
    ).body;
    const ind = r.indicators;
    expect(r.configured).toBe(true);
    expect(ind.window).toEqual({
      from: '2025-12',
      to: '2026-11',
      revenue: '4000.00',
      missing_tax: { count: 0, amount: '0.00', since: null },
    });
    expect(ind.contribution_margin).toEqual({
      mc: '60.50',
      mce: '65.50',
      income_tax_pct: '13.33',
      field_agents_pct: '12.50',
      non_reimbursable_pct: '5.00',
      commission_pct: '0.00',
      partner_effective_pct: '8.67',
    });
    expect(ind.fixed_cost.total).toBe('13936.00');
    expect(ind.fixed_cost.year).toBe('167232.00');
    expect(ind.fixed_cost.unavailable).toEqual([
      'additional_income_tax',
      'equipment',
      'back_office',
    ]);
    expect(ind.cash_year_result).toBe('3016.90');
    expect(ind.partner_commission).toEqual({
      pct: '10.00',
      operating_by_quarter: [
        '-41808.00',
        '-39207.90',
        '-41808.00',
        '-41391.20',
      ],
      quarters: ['0.00', '0.00', '0.00', '0.00'],
      year: '0.00',
    });
    expect(ind.operating_result).toBe('-164215.10');
    expect(ind.projected_result).toBe('-164215.10');
    expect(ind.year_revenue).toBe('7000.00');
    expect(ind.accounting_break_even).toBe('250698.59');
    expect(ind.economic_break_even).toBe('297128.26');
    expect(ind.net_margin).toBe('-2627.43');
    expect(ind.average_collection_days).toBe('8.0');
    expect(r.simulation).toBeNull();
    // KPIs dos indicadores = KPIs do quadro (mesma lista de movimentos)
    const brl = (await board()).kpis.find(
      (k) => (k.currency as unknown as string) === 'BRL',
    )!;
    expect(r.kpis.month).toEqual(brl.month);
    expect(r.kpis.year).toEqual(brl.year);
  });

  /**
   * Simulação: venda de 10.000,00 em 12/2026, 01/2027, 02/2027 (50/30/20),
   * empresa paga as despesas (20% orçado = 2.000,00 → 1.000/600/400).
   * 12/2026: +5.000,00 − IR 666,50 − 1.000,00 = +3.333,50 → mês −2.250,00 →
   * 1.083,50; 01/2027: +3.000,00 − 399,90 − 600,00 = +2.000,10 → 11.453,75 →
   * 13.453,85; ano 3.016,90 + 3.333,50 = 6.350,40; projetado −160.881,60;
   * PEC = 160.881,60/0,65503 = 245.609,51; PEE = (1.200 + 160.881,60)/0,55503
   * = 292.023,13; margem líquida = −160.881,60 / (12.000 − 1.650/0,8667)
   * = −1.593,48%. Nada é gravado.
   */
  it('simulação de venda: esperado × obtido, sem gravar', async () => {
    const q =
      '/finance/cash-flow/indicators?as_of=2026-11-14&month=2026-12&year=2026' +
      '&sim_value=10000.00&sim_signal_month=2026-12&sim_second_month=2027-01' +
      '&sim_third_month=2027-02&sim_company_expenses=true';
    const s = (await api('get', q).expect(200)).body.simulation;
    expect(s.movements.map((m: { gross: string }) => m.gross)).toEqual([
      '5000.00',
      '666.50',
      '3000.00',
      '399.90',
      '2000.00',
      '266.60',
      '1000.00',
      '600.00',
      '400.00',
    ]);
    expect(s.kpis.month.total).toBe('1083.50');
    expect(s.kpis.next_month.total).toBe('13453.85');
    expect(s.kpis.year.total).toBe('6350.40');
    expect(s.indicators.projected_result).toBe('-160881.60');
    expect(s.indicators.accounting_break_even).toBe('245609.51');
    expect(s.indicators.economic_break_even).toBe('292023.13');
    expect(s.indicators.net_margin).toBe('-1593.48');
    expect(s.indicators.contribution_margin.mc).toBe('60.50');
    expect(s.delta).toEqual({
      month_total: '3333.50',
      next_month_total: '2000.10',
      year_total: '3333.50',
      projected_result: '3333.50',
    });
    // nada gravado: o quadro continua igual
    const brl = (await board()).kpis.find(
      (k) => (k.currency as unknown as string) === 'BRL',
    )!;
    expect(brl.month.total).toBe('-2250.00');
    // mês passado: recusado; mês atual: parcela cai hoje (14/11), não no dia 1º
    const base =
      '/finance/cash-flow/indicators?as_of=2026-11-14&sim_value=1000.00&sim_company_expenses=false';
    const past = await api(
      'get',
      base +
        '&sim_signal_month=2026-10&sim_second_month=2026-11&sim_third_month=2026-12',
    ).expect(400);
    expect(past.body.message).toContain('mês passado');
    const now = (
      await api(
        'get',
        base +
          '&sim_signal_month=2026-11&sim_second_month=2026-12&sim_third_month=2027-01',
      ).expect(200)
    ).body.simulation;
    expect(now.movements[0]).toMatchObject({
      date: '2026-11-14',
      gross: '500.00',
    });
  });

  it('desfazer e refazer: baixa de saída, estorno de recebimento e descarte de proposta', async () => {
    let items = (await board()).items;
    const commission = items.find((i) => i.origin === 'commission')!;
    await api('post', '/finance/cash-flow/outflows/settle')
      .send({ keys: [commission.refs.settle_key], paid_on: '2026-11-13' })
      .expect(200);
    items = (await board()).items;
    expect(items.find((i) => i.origin === 'commission')).toMatchObject({
      status: 'realized',
      date: '2026-11-13',
    });
    await api('post', '/finance/cash-flow/outflows/settle')
      .send({ keys: [commission.refs.settle_key], paid_on: null })
      .expect(200);
    const received = (await board()).items.find(
      (i) => i.origin === 'contract' && i.status === 'realized',
    )!;
    expect(
      (
        await api('post', '/finance/cash-flow/receipts/undo')
          .send({
            items: [
              {
                receivable_id: received.refs.receivable_id,
                event_id: received.refs.event_id,
              },
            ],
          })
          .expect(200)
      ).body.done,
    ).toBe(1);
    // Estorno: o recebimento fica "estornado" (sem linha negativa), o IR acompanha,
    // a parcela volta a aparecer em aberto (02/12/2026) e os KPIs deixam o estornado de fora.
    const afterUndo = await board('as_of=2026-11-14&year=2026');
    items = afterUndo.items;
    expect(items.some((i) => i.gross.startsWith('-'))).toBe(false);
    expect(
      items
        .filter((i) => i.status === 'reversed')
        .map((i) => `${i.origin} ${i.gross}`)
        .sort(),
    ).toEqual(['contract 4000.00', 'income_tax 533.20']);
    // data do estorno = dia em que foi feito (hoje)
    expect(
      items.find((i) => i.status === 'reversed' && i.origin === 'contract')!
        .refs.reversed_on,
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      items.find(
        (i) =>
          i.origin === 'contract' &&
          i.status === 'open' &&
          i.date === '2026-12-02',
      ),
    ).toMatchObject({ gross: '4000.00' });
    const nov = afterUndo.kpis.find(
      (k) => (k.currency as unknown as string) === 'BRL',
    )!;
    // 11/2026 sem o recebimento estornado: entradas 0; saídas pagas 1.333,20 − IR 533,20 = 800,00
    expect(nov.month).toMatchObject({
      in_realized: '0.00',
      out_realized: '800.00',
      total: '-800.00',
    });
    // Descartar a proposta do aditivo (com justificativa): some e não volta enquanto não mudar
    const amendmentKey = (await board('as_of=2026-11-14&year=2027')).items.find(
      (i) => i.origin === 'amendment',
    )!.refs.source_key;
    await api('post', '/finance/cash-flow/proposals/discard')
      .send({
        keys: [amendmentKey],
        reason: 'Aditivo será faturado em outra nota',
      })
      .expect(200);
    const after = await board('as_of=2026-11-14&year=2027');
    expect(after.items.some((i) => i.origin === 'amendment')).toBe(false);
    expect(after.alerts.proposed_count).toBe(0);
  });

  it('permissões', async () => {
    await api('get', '/finance/cash-flow/board', user).expect(403);
    await api('get', '/finance/cash-flow/indicators', user).expect(403);
  });
});
