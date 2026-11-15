import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as XLSX from 'xlsx';
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
  project_id: number | null;
  currency: string;
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
  const api = (
    method: 'get' | 'post' | 'patch' | 'put',
    path: string,
    token = admin,
  ) =>
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
        // corte da DRE automática escolhido pela organização do cenário
        values: { ...defaults, dre_regime_cutoff_month: '2026-09' },
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
      dre_total: '0.00', // DRE ainda sem plano de contas neste ponto
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

  /** Contas do plano sugerido, por código. */
  const dreAccounts: Record<string, number> = {};
  const acc = (code: string) => dreAccounts[code];
  type DreGrid = {
    accounts: Array<{
      id: number;
      code: string;
      total: string;
      cells: Array<{
        month: string;
        value: string;
        flow: string;
        entered: string | null;
        estimate: string | null;
        closed: boolean;
      }>;
    }>;
    lines: Array<{ key: string; values: string[]; total: string }>;
    estimates: number;
    window: Record<string, unknown>;
    warnings: string[];
  };
  const dreView = async (query = 'year=2026&as_of=2026-11-14') =>
    (await api('get', `/finance/dre/monthly?${query}`).expect(200)).body as {
      grid: DreGrid;
      config: {
        accounts: Array<{ id: number; label: string }>;
        excluded_accounts: Array<{
          id: number;
          code: string;
          revision: number;
        }>;
        layout: { revision: number; data: Record<string, number[]> };
      };
      compare: {
        year: string;
        lines: Array<{ key: string; total: string }>;
      } | null;
    };
  const cellOf = (g: DreGrid, code: string, month: string) =>
    g.accounts
      .find((x) => x.code === code)!
      .cells.find((c) => c.month === month)!;
  const lineOf = (g: DreGrid, key: string) =>
    g.lines.find((l) => l.key === key)!;
  const xlsx = (rows: unknown[][]) => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'DRE');
    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  };
  const year = (v: (number | string)[]) => [
    ...v,
    ...Array(12 - v.length).fill(''),
  ];
  const sheet = () =>
    xlsx([
      [
        'Conta',
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ],
      ['1.01', ...Array(8).fill(10000), 99999, 99999, 99999, 99999],
      ['Tributos sobre receitas', ...year(Array(8).fill('1.333,00'))],
      ['Equipes de campo', ...year(Array(8).fill(2000))],
      ['Outros custos diretos', ...year(Array(8).fill(500))],
      ['Comerciais', ...year(Array(8).fill(300))],
      ['Administrativas', ...year(Array(10).fill(6000))],
      ['Tecnologia', ...year(['', '', '', '', '', '', '', 300, 600, 900])],
      ['Linha desconhecida', ...year([1])],
    ]);

  /**
   * Etapa 9 — DRE mensal do cenário (hoje 14/11/2026; corte 09/2026).
   * Plano sugerido do GAI (sem nomes de pessoas) e regras: faturamento → 1.01,
   * IR → 2.01, diárias → 3.01, reembolsáveis → 3.02, placas → 3.05, não
   * reembolsáveis → 3.06, comissões → 4.02; papéis: equipamentos → 4.03
   * (média de 3 meses), filial → 4.04 e sócio → 4.05 (pós-operacionais).
   * Importação 2026: 1.01 jan–ago 10.000 (set–dez ignorados: vêm do fluxo);
   * 2.01 jan–ago 1.333; 3.01 jan–ago 2.000; 3.06 jan–ago 500; 4.02 jan–ago 300;
   * 4.01 jan–out 6.000; 4.03 ago 300, set 600, out 900.
   * Fluxo (etapa 7): nov 1.01 4.000, 2.01 533,20, 3.01 500, 3.02 100, 3.06 200;
   * dez 3.01 1.000, 3.05 200, 3.06 450, 4.02 600.
   * Operacional: jan–jul 8.667 − 2.500 − 6.300 = −133; ago −133 − 300 = −433;
   * set −6.000 − 600 = −6.600; out −6.000 − 900 = −6.900;
   * nov 3.466,80 − 800 − (6.000 est. + 600 est.) = −3.933,20;
   * dez −1.650 − (6.000 est. + 600 est. + 600) = −8.850.
   * Sócio T4: −6.900 − 3.933,20 − 8.850 < 0 → 0. Filial 3.021 em nov e dez.
   * Resultado final: 7 × −133 − 433 − 6.600 − 6.900 − 6.954,20 − 11.871
   * = −33.689,20; receita bruta 84.000; 6 estimativas.
   */
  it('DRE mensal: plano, regras, importação com pré-visualização, lançamento e fechamento', async () => {
    await api('post', '/finance/dre/accounts/bootstrap')
      .send({ command_key: 'dre-bootstrap-1', reason: 'Plano do cenario' })
      .expect(201);
    let v = await dreView();
    for (const x of v.config.accounts)
      dreAccounts[x.label.split(' ')[0]] = x.id;
    await api('put', '/finance/dre/monthly/rules')
      .send({
        command_key: 'dre-rules-1',
        reason: 'Regras do cenario',
        rules: {
          billing_revenue: acc('1.01'),
          reimbursement_revenue: acc('1.02'),
          income_tax: acc('2.01'),
          field_agents: acc('3.01'),
          reimbursable_expenses: acc('3.02'),
          asset_tags: acc('3.05'),
          non_reimbursable_expenses: acc('3.06'),
          commissions: acc('4.02'),
          equipment: acc('4.03'),
          branch: acc('4.04'),
          partner_commission: acc('4.05'),
        },
      })
      .expect(200);
    await api('put', '/finance/dre/monthly/layout')
      .send({
        command_key: 'dre-layout-1',
        reason: 'Layout do cenario',
        revision: 0,
        hidden: [acc('2.03')],
        summary: [acc('1.01')],
        post_operational: [acc('4.04'), acc('4.05')],
      })
      .expect(200);

    // Pré-visualização: nada é gravado; linhas reconhecidas por código e por nome
    const preview = (
      await api('post', '/finance/dre/monthly/imports/preview')
        .field('year', '2026')
        .attach('file', sheet(), 'dre-2026.xlsx')
        .expect(200)
    ).body as {
      checksum: string;
      rows: Array<{
        label: string;
        status: string;
        months: Array<{ action: string }>;
      }>;
      totals: Record<string, number>;
    };
    expect(preview.rows.map((r) => [r.label, r.status])).toEqual([
      ['1.01', 'ok'],
      ['Tributos sobre receitas', 'ok'],
      ['Equipes de campo', 'ok'],
      ['Outros custos diretos', 'ok'],
      ['Comerciais', 'ok'],
      ['Administrativas', 'ok'],
      ['Tecnologia', 'ok'],
      ['Linha desconhecida', 'unmatched'],
    ]);
    // 8×5 + 10 + 3 = 53 células; set–dez da 1.01 ignorados (fluxo)
    expect(preview.totals).toEqual({
      apply: 53,
      skipped_closed: 0,
      skipped_flow: 4,
      unmatched: 1,
    });
    expect(cellOf((await dreView()).grid, '1.01', '2026-01').value).toBe(
      '0.00',
    );
    // CSV brasileiro: ponto e vírgula e valores com vírgula decimal
    const csv = (
      await api('post', '/finance/dre/monthly/imports/preview')
        .field('year', '2026')
        .attach(
          'file',
          Buffer.from('Conta;Jan;Fev\nHospedagem;1.234,56;-10,00\n'),
          'dre.csv',
        )
        .expect(200)
    ).body as typeof preview;
    expect(csv.rows[0].status).toBe('ok');
    expect(
      (csv.rows[0] as unknown as { months: Array<{ amount: string }> }).months
        .slice(0, 2)
        .map((m) => m.amount),
    ).toEqual(['1234.56', '-10.00']);
    // Confirmar exige o mesmo arquivo da pré-visualização
    await api('post', '/finance/dre/monthly/imports')
      .field('year', '2026')
      .field('checksum', '0'.repeat(64))
      .field('command_key', 'dre-import-bad')
      .field('reason', 'Importacao do historico')
      .attach('file', sheet(), 'dre-2026.xlsx')
      .expect(409);
    const done = (
      await api('post', '/finance/dre/monthly/imports')
        .field('year', '2026')
        .field('checksum', preview.checksum)
        .field('command_key', 'dre-import-1')
        .field('reason', 'Importacao do historico')
        .attach('file', sheet(), 'dre-2026.xlsx')
        .expect(201)
    ).body;
    expect(done.written).toBe(53);

    // Fecha 10/2026 (fechamento que o GAI já tem) e confirma que ele congela
    await api('post', '/finance/dre/periods/2026-10/close')
      .send({
        command_key: 'dre-close-2026-10',
        reason: 'Fechamento do cenario',
        currency: 'BRL',
        revision: 0,
        policy_reference: 'Politica de fechamento do cenario',
        sources_reviewed: false,
        allow_incomplete: true,
        reviewed_groups: [],
      })
      .expect(201);
    const lockedCell = await api('put', '/finance/dre/monthly/cells')
      .send({
        command_key: 'dre-cell-closed',
        reason: 'Tentativa em mes fechado',
        account_id: acc('4.01'),
        month: '2026-10',
        amount: '1.00',
      })
      .expect(409);
    expect(lockedCell.body.message).toContain('fechada');
    const again = (
      await api('post', '/finance/dre/monthly/imports/preview')
        .field('year', '2026')
        .attach('file', sheet(), 'dre-2026.xlsx')
        .expect(200)
    ).body;
    // out/2026 fechado: o 99.999 da 1.01 em out é recusado (mês fechado);
    // set, nov e dez seguem do fluxo; 4.01 e 4.03 de out já estão iguais
    expect(again.totals).toMatchObject({
      apply: 0,
      skipped_closed: 1,
      skipped_flow: 3,
    });

    // Lançar e apagar uma célula (com histórico); estimativa não é gravada
    await api('put', '/finance/dre/monthly/cells')
      .send({
        command_key: 'dre-cell-1',
        reason: 'Hospedagem de novembro',
        account_id: acc('3.03'),
        month: '2026-11',
        amount: '250.00',
      })
      .expect(200);
    await api('put', '/finance/dre/monthly/cells')
      .send({
        command_key: 'dre-cell-2',
        reason: 'Lancamento duplicado',
        account_id: acc('3.03'),
        month: '2026-11',
        amount: null,
      })
      .expect(200);
    const detail = (
      await api(
        'get',
        `/finance/dre/monthly/detail?account_id=${acc('3.03')}&month=2026-11&as_of=2026-11-14`,
      ).expect(200)
    ).body;
    expect(
      detail.versions.map((x: { amount: string | null }) => x.amount),
    ).toEqual([null, '250.00']);
    const fa = (
      await api(
        'get',
        `/finance/dre/monthly/detail?account_id=${acc('3.01')}&month=2026-12&as_of=2026-11-14`,
      ).expect(200)
    ).body;
    expect(fa.movements.map((x: { gross: string }) => x.gross)).toEqual([
      '1000.00',
    ]);

    v = await dreView();
    const g = v.grid;
    expect(cellOf(g, '1.01', '2026-01')).toMatchObject({
      value: '10000.00',
      entered: '10000.00',
    });
    expect(cellOf(g, '1.01', '2026-11')).toMatchObject({
      value: '4000.00',
      flow: '4000.00',
      entered: null,
    });
    expect(cellOf(g, '2.01', '2026-03').value).toBe('1333.00');
    expect(cellOf(g, '4.01', '2026-10')).toMatchObject({
      value: '6000.00',
      closed: true,
    });
    expect(cellOf(g, '4.01', '2026-11')).toMatchObject({
      value: '6000.00',
      entered: null,
      estimate: '6000.00',
    });
    expect(cellOf(g, '4.03', '2026-12').estimate).toBe('600.00'); // (300 + 600 + 900) / 3
    expect(cellOf(g, '4.04', '2026-11').estimate).toBe('3021.00');
    expect(cellOf(g, '4.05', '2026-12').estimate).toBeNull(); // trimestre negativo
    expect(cellOf(g, '3.03', '2026-11').value).toBe('0.00');
    expect(lineOf(g, 'operating_result').values).toEqual([
      '-133.00',
      '-133.00',
      '-133.00',
      '-133.00',
      '-133.00',
      '-133.00',
      '-133.00',
      '-433.00',
      '-6600.00',
      '-6900.00',
      '-3933.20',
      '-8850.00',
    ]);
    expect(lineOf(g, 'final_result').values.slice(10)).toEqual([
      '-6954.20',
      '-11871.00',
    ]);
    expect(lineOf(g, 'final_result').total).toBe('-33689.20');
    expect(lineOf(g, 'revenue').total).toBe('84000.00');
    expect(g.estimates).toBe(6);
    expect(v.config.layout.data.hidden).toEqual([acc('2.03')]);

    // Comparativo entre anos (2025 sem valores)
    const cmp = await dreView('year=2026&compare_year=2025&as_of=2026-11-14');
    expect(cmp.compare?.year).toBe('2025');
    expect(
      cmp.compare?.lines.find((l) => l.key === 'final_result')?.total,
    ).toBe('0.00');

    // Excluir conta: bloqueado se faz papel na DRE; sem papel, exclui e restaura
    const rev = async (id: number) =>
      (await api('get', `/finance/dre/accounts/${id}`).expect(200)).body as {
        account?: { revision: number };
        revision?: number;
      };
    const accountRevision = async (id: number) => {
      const r = (await rev(id)) as Record<string, unknown>;
      return Number(
        (r.account as { revision: number } | undefined)?.revision ?? r.revision,
      );
    };
    await api('put', `/finance/dre/accounts/${acc('4.04')}`)
      .send({
        command_key: 'dre-del-404',
        reason: 'Excluir filial',
        revision: await accountRevision(acc('4.04')),
        name: 'Serviços de terceiros',
        active: false,
      })
      .expect(409);
    await api('put', `/finance/dre/accounts/${acc('3.04')}`)
      .send({
        command_key: 'dre-del-304',
        reason: 'Excluir alimentacao',
        revision: await accountRevision(acc('3.04')),
        name: 'Alimentação',
        active: false,
      })
      .expect(200);
    v = await dreView();
    expect(v.grid.accounts.some((x) => x.code === '3.04')).toBe(false);
    expect(v.config.excluded_accounts.map((x) => x.code)).toEqual(['3.04']);
    await api('put', `/finance/dre/accounts/${acc('3.04')}`)
      .send({
        command_key: 'dre-restore-304',
        reason: 'Restaurar alimentacao',
        revision: v.config.excluded_accounts[0].revision,
        name: 'Alimentação',
        active: true,
      })
      .expect(200);
    expect((await dreView()).grid.accounts.some((x) => x.code === '3.04')).toBe(
      true,
    );
  });

  /**
   * Etapa 8 sobre a DRE (etapa 9). Janela: 12 meses antes de 11/2026 com receita
   * na DRE = jan–ago/2026 (8 meses): receita 80.000; diárias 16.000 (20,00%);
   * não reemb. 4.000 (5,00%); comissões 2.400 (3,00%); IR do parâmetro 13,33%;
   * sócio efetivo 10 × 86,67% = 8,667%.
   * MC = 100 − 13,33 − 20 − 5 − 3 − 8,667 = 50,003 → 50,00%; MCe = 55,00%.
   * Resultado projetado = resultado final da DRE 2026 = −33.689,20.
   * PEC = 33.689,20 / 0,55003 = 61.249,75.
   * PEE = (10% × 84.000 + 33.689,20) / (0,55003 − 0,10) = 93.525,32.
   * Margem líquida = −33.689,20 / (84.000 − 4.650/0,8667) = −42,84%
   * (não reemb. do ano na DRE: 8 × 500 + 200 + 450 = 4.650).
   * Custo fixo: 10.915 + 3.021 + equipamentos 600 (média de 3 meses da DRE);
   * adicional de IR e back-office sem conta associada → indisponíveis.
   * Prazo médio: CA#1 contratada 02/11, recebida 10/11 = 8,0 dias.
   */
  it('indicadores sobre a DRE: esperado (calculado à mão) × obtido', async () => {
    const r = (
      await api(
        'get',
        '/finance/cash-flow/indicators?as_of=2026-11-14&month=2026-12&year=2026',
      ).expect(200)
    ).body;
    const ind = r.indicators;
    expect(ind.window).toEqual({
      from: '2025-11',
      to: '2026-10',
      revenue: '80000.00',
      taxed_revenue: '80000.00', // toda a receita da janela é faturamento
      months_with_revenue: 8,
      missing_accounts: [],
    });
    expect(ind.contribution_margin).toEqual({
      mc: '50.00',
      mce: '55.00',
      income_tax_pct: '13.33',
      field_agents_pct: '20.00',
      non_reimbursable_pct: '5.00',
      commission_pct: '3.00',
      partner_effective_pct: '8.67',
    });
    expect(ind.fixed_cost.total).toBe('14536.00');
    expect(ind.fixed_cost.unavailable).toEqual([
      'additional_income_tax',
      'back_office',
    ]);
    expect(
      ind.fixed_cost.items.find((i: { key: string }) => i.key === 'equipment')
        .amount,
    ).toBe('600.00');
    expect(ind.dre).toMatchObject({
      revenue: '84000.00',
      operating_result: '-27647.20',
      final_result: '-33689.20',
      estimates: 6,
      // Fluxo do ano com os custos fixos da DRE a partir do corte (set–dez):
      // 4.01 6.000 × 4 + 4.03 (600 + 900 + 600 + 600) + 4.04 3.021 × 2 = 32.742
      // → 3.016,90 − 32.742 = −29.725,10.
      cash_flow_total: '-29725.10',
    });
    expect(ind.partner_commission).toMatchObject({
      quarters: ['0.00', '0.00', '0.00', '0.00'],
      operating_by_quarter: ['-399.00', '-399.00', '-7166.00', '-19683.20'],
      year: '0.00',
    });
    expect(ind.projected_result).toBe('-33689.20');
    expect(ind.year_revenue).toBe('84000.00');
    expect(ind.accounting_break_even).toBe('61249.75');
    expect(ind.economic_break_even).toBe('93525.32');
    expect(ind.net_margin).toBe('-42.84');
    expect(ind.average_collection_days).toBe('8.0');
    // Total do ano: o quadro do fluxo mostra o resultado da DRE (e mantém o do fluxo)
    const brl = (await board()).kpis.find(
      (k) => (k.currency as unknown as string) === 'BRL',
    )!;
    expect(brl.year.dre_total).toBe('-33689.20');
    expect(brl.year.total).toBe('-29725.10');
    expect(r.kpis.year.dre_total).toBe('-33689.20');
    // Mesmos cards no quadro e nos indicadores
    expect(r.kpis.month).toEqual(brl.month);
    expect(r.kpis.next_month).toEqual(brl.next_month);
    expect(r.kpis.year.out_open).toBe(brl.year.out_open);
  });

  /**
   * Simulação sobre a DRE (como simMes e SIM_RES): venda de 10.000 em 12/2026,
   * 01/2027, 02/2027, despesas da empresa. % históricos: inventariantes 20%,
   * não reemb. 5%. 5.000 → IR 666,50 + 1.000 + 250; 3.000 → 399,90 + 600 + 150;
   * 2.000 → 266,60 + 400 + 100.
   * 12/2026: 5.000 − 666,50 − 1.000 − 250 = +3.083,50 → −2.250 − custos fixos
   * de dez (4.01 6.000 + 4.03 600 + 4.04 3.021 = 9.621) = −11.871 → −8.787,50.
   * 01/2027: 3.000 − 399,90 − 600 − 150 = +1.850,10 → 11.453,75 → 13.303,85
   * (sem custo fixo: estimativa só no ano corrente).
   * Ano: 5.000 × MC 50,003% = 2.500,15 → DRE −33.689,20 → −31.189,05.
   * PEC = 31.189,05/0,55003 = 56.704,27; PEE = (8.900 + 31.189,05)/0,45003
   * = 89.080,84; margem líquida = −31.189,05/(89.000 − 5.365,18) = −37,29%.
   * Despesas do cliente: + 5.000 × 5% = 250 → 2.750,15. Nada é gravado.
   */
  it('simulação de venda sobre a DRE: esperado × obtido, sem gravar', async () => {
    const q =
      '/finance/cash-flow/indicators?as_of=2026-11-14&month=2026-12&year=2026' +
      '&sim_value=10000.00&sim_signal_month=2026-12&sim_second_month=2027-01' +
      '&sim_third_month=2027-02';
    const s = (await api('get', q + '&sim_company_expenses=true').expect(200))
      .body.simulation;
    expect(s.movements.map((m: { gross: string }) => m.gross)).toEqual([
      '5000.00',
      '666.50',
      '1000.00',
      '250.00',
      '3000.00',
      '399.90',
      '600.00',
      '150.00',
      '2000.00',
      '266.60',
      '400.00',
      '100.00',
    ]);
    expect(s.basis).toEqual({
      field_agents_pct: '20.00',
      non_reimbursable_pct: '5.00',
      mc: '50.00',
      year_sale: '5000.00',
      sale_result: '2500.15',
      client_share: '0.00',
    });
    expect(s.kpis.month.total).toBe('-8787.50');
    expect(s.kpis.next_month.total).toBe('13303.85');
    expect(s.kpis.year.dre_total).toBe('-31189.05');
    expect(s.indicators.projected_result).toBe('-31189.05');
    expect(s.indicators.accounting_break_even).toBe('56704.27');
    expect(s.indicators.economic_break_even).toBe('89080.84');
    expect(s.indicators.net_margin).toBe('-37.29');
    expect(s.delta).toEqual({
      month_total: '3083.50',
      next_month_total: '1850.10',
      year_total: '2500.15',
      projected_result: '2500.15',
    });
    const c = (await api('get', q + '&sim_company_expenses=false').expect(200))
      .body.simulation;
    expect(c.movements).toHaveLength(9);
    expect(c.basis.client_share).toBe('250.00');
    expect(c.delta.month_total).toBe('3333.50');
    expect(c.delta.projected_result).toBe('2750.15');
    // nada gravado
    const brl = (await board()).kpis.find(
      (k) => (k.currency as unknown as string) === 'BRL',
    )!;
    // dez: −2.250 do fluxo − 9.621 de custos fixos = −11.871 (= resultado final da DRE de dez)
    expect(brl.month.total).toBe('-11871.00');
    expect(brl.year.dre_total).toBe('-33689.20');
    // mês passado: recusado; mês atual: parcela cai hoje (14/11), não no dia 1º
    const base =
      '/finance/cash-flow/indicators?as_of=2026-11-14&month=2026-12&sim_value=1000.00&sim_company_expenses=false';
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
    // 11/2026 sem o recebimento estornado: entradas 0; saídas pagas 1.333,20 − IR 533,20 = 800,00;
    // a pagar = custos fixos de nov (6.000 + 600 + 3.021 = 9.621, estimados)
    expect(nov.month).toMatchObject({
      in_realized: '0.00',
      out_realized: '800.00',
      out_open: '9621.00',
      total: '-10421.00',
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

  /**
   * Etapa 10 (no fim: não altera os valores dos testes anteriores).
   * Totais anuais da DRE 2026 sem estimativas (o estorno do teste anterior só
   * move a receita de CA#1 de nov para dez): receita 84.000; deduções
   * 8 × 1.333 + 533,20 = 11.197,20; custos variáveis 8 × 2.000 + 500 + 1.000
   * (diárias) + 100 + 200 + 8 × 500 + 200 + 450 = 22.450 (+ 20 da diária de
   * set criada aqui = 22.470); despesas operacionais 10 × 6.000 + (8 × 300 +
   * 600) + (300 + 600 + 900) = 64.800.
   * Operacional = 84.000 − 11.197,20 − 22.470 − 64.800 = −14.467,20.
   */
  it('etapa 10: Demonstrativo = DRE mensal, classificação em dobro recusada, fechamento por verificação, coluna congelada, modelo padrão e XLSX = tela', async () => {
    const report = async () =>
      (
        await api(
          'get',
          '/finance/dre/report?start_month=2026-01&end_month=2026-12',
        ).expect(200)
      ).body as {
        mode: string;
        cutoff: string;
        warnings: string[];
        totals: Array<{
          currency: string;
          lines: Array<{
            key: string;
            label: string;
            amount: string | null;
            known_amount: string;
          }>;
        }>;
        by_project: Array<{
          project_id: number | null;
          lines: Array<{ key: string; known_amount: string }>;
        }>;
      };
    const line = (r: Awaited<ReturnType<typeof report>>, key: string) =>
      r.totals[0].lines.find((l) => l.key === key)!.known_amount;

    // 1) Classificar origem do fluxo a partir do corte: recusado (contaria em dobro)
    const ca1 = (await board('as_of=2026-11-14&year=2026')).items
      .concat((await board('as_of=2026-11-14&year=2027')).items)
      .find(
        (i) =>
          i.origin === 'contract' &&
          i.project_name === 'Alfa fluxo' &&
          i.installment?.number === 1,
      )!;
    const dup = await api('post', '/finance/dre/entries')
      .send({
        command_key: 'dre-dup-ca1',
        reason: 'Tentativa de classificar CA1',
        source_kind: 'receivable',
        source_id: ca1.refs.receivable_id,
        project_id: alfa,
        economic_key: 'dup-ca1',
        event_document: 'Contrato CT-A parcela 1',
        description: 'CA1 classificada manualmente',
        currency: 'BRL',
        status: 'recognized',
        allocations: [
          { month: '2026-12', account_id: acc('1.01'), amount: '4000.00' },
        ],
      })
      .expect(409);
    expect(dup.body.message).toContain('contaria em dobro');

    // 2) Fechamento de set/2026 pela verificação: bloqueio e ciência
    const p = (
      await api('post', `/projects/${alfa}/payments`)
        .send({
          field_agent_id: agent,
          start_date: '2026-09-01',
          end_date: '2026-09-02',
          expected_payment_date: '2026-09-20',
          daily_rate: '10.00',
        })
        .expect(201)
    ).body.id;
    await api('post', `/projects/${alfa}/payments/${p}/approve`).expect(200);
    await api('put', '/finance/dre/monthly/rules')
      .send({
        command_key: 'dre-rules-off',
        reason: 'Teste do bloqueio',
        rules: { field_agents: null },
      })
      .expect(200);
    let check = (
      await api(
        'get',
        '/finance/dre/monthly/checklist/2026-09?as_of=2026-11-14',
      ).expect(200)
    ).body;
    expect(check.blockers.map((b: { code: string }) => b.code)).toEqual([
      'unmapped_kinds',
    ]);
    const closeSep = (acknowledged: string[], key: string) =>
      api('post', '/finance/dre/periods/2026-09/close').send({
        command_key: key,
        reason: 'Fechamento de setembro',
        currency: 'BRL',
        revision: 0,
        policy_reference: 'Politica de fechamento do cenario',
        sources_reviewed: false,
        allow_incomplete: true, // ignorado na DRE automática: não contorna bloqueio
        reviewed_groups: [],
        acknowledged,
      });
    expect(
      (await closeSep([], 'dre-close-sep-1').expect(409)).body.message,
    ).toContain('sem conta associada');
    await api('put', '/finance/dre/monthly/rules')
      .send({
        command_key: 'dre-rules-on',
        reason: 'Teste do bloqueio',
        rules: { field_agents: acc('3.01') },
      })
      .expect(200);
    check = (
      await api(
        'get',
        '/finance/dre/monthly/checklist/2026-09?as_of=2026-11-14',
      ).expect(200)
    ).body;
    expect(check.blockers).toEqual([]);
    expect(check.warnings).toEqual([
      expect.objectContaining({
        code: 'open_items',
        count: 1,
        amount: '20.00',
      }),
    ]);
    expect(
      (await closeSep([], 'dre-close-sep-2').expect(409)).body.message,
    ).toContain('Confirme ciência');
    await closeSep(['open_items'], 'dre-close-sep-3').expect(201);

    // 3) Demonstrativo = DRE mensal (sem estimativas), com aviso do fluxo
    const r = await report();
    expect(r.mode).toBe('monthly');
    expect(r.cutoff).toBe('2026-09');
    expect(r.warnings.join(' ')).toContain('passam a incluir o fluxo');
    expect(line(r, 'revenue')).toBe('84000.00');
    expect(line(r, 'deductions')).toBe('11197.20');
    expect(line(r, 'direct_cost')).toBe('22470.00');
    expect(line(r, 'operating_expense')).toBe('64800.00');
    expect(line(r, 'operating_result')).toBe('-14467.20');
    const g = (await dreView()).grid as DreGrid & {
      accounts: Array<{ group?: string }>;
    };
    const actual = (group: string) =>
      (
        g.accounts
          .filter((a) => (a as { group?: string }).group === group)
          .flatMap((a) => a.cells)
          .reduce(
            (s2, c) =>
              s2 +
              Math.round(Number(c.value) * 100) -
              Math.round(Number(c.estimate ?? 0) * 100),
            0,
          ) / 100
      ).toFixed(2);
    for (const [key, group] of [
      ['revenue', 'revenue'],
      ['deductions', 'deductions'],
      ['direct_cost', 'direct_cost'],
      ['operating_expense', 'operating_expense'],
    ])
      expect(line(r, key)).toBe(actual(group));
    const alfaLines = r.by_project.find((x) => x.project_id === alfa)!.lines;
    expect(alfaLines.find((l) => l.key === 'revenue')!.known_amount).toBe(
      '4000.00',
    );

    // 4) Mês fechado antes da DRE mensal: diferença por linha e congelamento com motivo
    await api('post', '/finance/dre/periods/2026-08/close')
      .send({
        command_key: 'dre-close-aug',
        reason: 'Fechamento de agosto',
        currency: 'BRL',
        revision: 0,
        policy_reference: 'Politica de fechamento do cenario',
        sources_reviewed: false,
        allow_incomplete: false,
        reviewed_groups: [],
      })
      .expect(201);
    // simula um fechamento antigo: sem coluna congelada e resumo só das classificações
    await ds.query(
      "UPDATE dre_periods SET data = JSON_REMOVE(JSON_SET(data, '$.snapshot.totals[0].lines[0].known_amount', '0.00'), '$.grid') WHERE month = '2026-08'",
    );
    const periods = (await api('get', '/finance/dre/periods').expect(200))
      .body as Array<{ month: string; has_grid: boolean; revision: number }>;
    expect(periods.find((x) => x.month === '2026-08')!.has_grid).toBe(false);
    const preview = (
      await api('get', '/finance/dre/monthly/freeze/2026-08').expect(200)
    ).body;
    expect(
      preview.lines.find((l: { key: string }) => l.key === 'revenue'),
    ).toMatchObject({
      stored: '0.00',
      recalculated: '10000.00',
      difference: '10000.00',
    });
    await api('post', '/finance/dre/monthly/freeze/2026-08')
      .send({
        command_key: 'dre-freeze-aug-0',
        reason: 'curt',
        revision: preview.revision,
      })
      .expect(400); // motivo obrigatório (mínimo de 5 caracteres)
    await api('post', '/finance/dre/monthly/freeze/2026-08')
      .send({
        command_key: 'dre-freeze-aug',
        reason: 'Congelar agosto conferido',
        revision: preview.revision,
      })
      .expect(200);
    expect(
      (await api('get', '/finance/dre/periods').expect(200)).body.find(
        (x: { month: string }) => x.month === '2026-08',
      ).has_grid,
    ).toBe(true);
    const history = (
      await api('get', '/finance/dre/periods/2026-08').expect(200)
    ).body;
    expect(history.period.data.frozen).toMatchObject({
      reason: 'Congelar agosto conferido',
    });
    await api('get', '/finance/dre/monthly/freeze/2026-08').expect(409); // já congelada

    // 5) Modelo padrão: pré-visualização e aplicação que só completa
    const plan = (await api('get', '/finance/dre/monthly/model').expect(200))
      .body;
    // plano sugerido antigo: 5/6/7 são financeiro e tributos (outros grupos) → conflito
    expect(plan.totals).toEqual({ create: 5, exists: 18, conflict: 9, map: 1 }); // 1.04 revenda de placas
    const applied = (
      await api('post', '/finance/dre/monthly/model')
        .send({ command_key: 'dre-model-1', reason: 'Aplicar modelo padrao' })
        .expect(200)
    ).body;
    expect(applied).toMatchObject({ created: 5, mapped: 1, conflicts: 9 });
    expect(
      (await api('get', '/finance/dre/monthly/model').expect(200)).body.totals
        .create,
    ).toBe(0);
    await api('get', '/finance/dre/monthly/model', user).expect(403);

    // 6) XLSX do Demonstrativo = valores da tela (mesma API)
    const now = await report();
    const job = (
      await api('post', '/finance/dre/exports')
        .send({
          start_month: '2026-01',
          end_month: '2026-12',
          kind: 'statement',
        })
        .expect(201)
    ).body;
    let status = '';
    for (let i = 0; i < 40 && status !== 'finished'; i++) {
      status = (await api('get', `/finance/dre/exports/${job.id}`).expect(200))
        .body.status;
      if (status !== 'finished')
        await new Promise((done) => setTimeout(done, 250));
    }
    expect(status).toBe('finished');
    const file = (
      await api('get', `/finance/dre/exports/${job.id}/download`)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200)
    ).body as Buffer;
    const book = XLSX.read(file, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      book.Sheets['DRE Gerencial'],
      { header: 1 },
    );
    const sheet = new Map(
      rows.slice(1).map((x) => [String(x[1]), Number(x[3])]),
    );
    for (const l of now.totals[0].lines)
      expect(sheet.get(l.label)).toBe(Number(l.known_amount));
  });

  /**
   * Alterar a data de recebimento (fluxo de caixa com paridade): estorno do
   * recebimento original e novo recebimento na nova data, na mesma transação
   * (dois eventos seguidos na trilha do recebível); data futura recusada; exige
   * receber e estornar.
   */
  it('alterar data de recebimento: estorno + novo recebimento na mesma transação, futura recusada', async () => {
    const open = (await board('as_of=2026-11-14&year=all')).items.find(
      (i) =>
        i.origin === 'contract' && i.status === 'open' && i.refs.installment_id,
    )!;
    await api('post', '/finance/cash-flow/receipts')
      .send({
        items: [
          {
            receivable_id: open.refs.receivable_id,
            installment_id: open.refs.installment_id,
          },
        ],
        received_on: '2026-11-10',
      })
      .expect(200);
    const realizedOf = async () =>
      (await board('as_of=2026-11-14&year=all')).items.find(
        (i) =>
          i.status === 'realized' &&
          i.origin === 'contract' &&
          i.refs.receivable_id === open.refs.receivable_id,
      )!;
    const received = await realizedOf();
    expect(received.date).toBe('2026-11-10');
    const ref = {
      receivable_id: received.refs.receivable_id,
      event_id: received.refs.event_id,
    };
    // sem justificativa: recusado pela validação
    await api('post', '/finance/cash-flow/receipts/redate')
      .send({ items: [ref], received_on: '2026-11-12' })
      .expect(400);
    // data futura: recusada antes de tocar no recebível
    const future = await api('post', '/finance/cash-flow/receipts/redate')
      .send({
        items: [ref],
        received_on: '2099-01-01',
        reason: 'Data informada pelo banco',
      })
      .expect(400);
    expect(future.body.code).toBe('FUTURE_SETTLEMENT_DATE');
    await api('post', '/finance/cash-flow/receipts/redate', user)
      .send({
        items: [ref],
        received_on: '2026-11-12',
        reason: 'Data informada pelo banco',
      })
      .expect(403);
    const done = (
      await api('post', '/finance/cash-flow/receipts/redate')
        .send({
          items: [ref],
          received_on: '2026-11-12',
          reason: 'Data informada pelo banco',
        })
        .expect(200)
    ).body;
    expect(done).toMatchObject({ done: 1, failed: 0 });
    const after = (await board('as_of=2026-11-14&year=all')).items.filter(
      (i) =>
        i.origin === 'contract' &&
        i.refs.receivable_id === open.refs.receivable_id &&
        i.installment?.number === open.installment?.number,
    );
    expect(
      after
        .filter((i) => i.status !== 'open')
        .map((i) => `${i.status} ${i.date} ${i.gross}`)
        .sort(),
    ).toEqual([
      `realized 2026-11-12 ${open.gross}`,
      `reversed 2026-11-10 ${open.gross}`,
    ]);
    // a parcela não volta a ficar em aberto (o valor foi recebido de novo)
    expect(after.some((i) => i.status === 'open')).toBe(false);
    // trilha: estorno e novo recebimento em revisões seguidas, com a justificativa
    const detail = (
      await api(
        'get',
        `/finance/receivables/${String(open.refs.receivable_id)}`,
      ).expect(200)
    ).body as {
      events: Array<{
        operation: string;
        revision: number;
        effectiveOn: string | null;
        details: Record<string, unknown>;
      }>;
    };
    const last = detail.events.slice(-2);
    expect(last.map((e) => e.operation)).toEqual(['reversal', 'receipt']);
    expect(last[1].revision).toBe(last[0].revision + 1);
    expect(String(last[1].effectiveOn).slice(0, 10)).toBe('2026-11-12');
    expect(last[0].details).toMatchObject({
      reason: 'Data informada pelo banco',
      redated_to: '2026-11-12',
    });
    expect(last[1].details).toMatchObject({
      before: '2026-11-10',
      after: '2026-11-12',
    });
    // mesma data: recusada no item (nada muda)
    const same = (
      await api('post', '/finance/cash-flow/receipts/redate')
        .send({
          items: [
            {
              receivable_id: ref.receivable_id,
              event_id: (await realizedOf()).refs.event_id,
            },
          ],
          received_on: '2026-11-12',
          reason: 'Mesma data de novo',
        })
        .expect(200)
    ).body;
    expect(same).toMatchObject({ done: 0, failed: 1 });
    expect(same.results[0].message).toContain('já é essa');
  });
});
