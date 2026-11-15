import {
  addMonth,
  buildGrid,
  flowKindOf,
  type GridContext,
  windowShares,
} from '../../../../src/modules/managerial-dre/dre-monthly.formulas';

/**
 * Exemplo à mão (hoje 14/11/2026; corte 09/2026; 09/2026 fechado):
 * contas R (receita, fluxo), IR (dedução, fluxo), FA (variável, diárias),
 * NR (variável, não reemb.), SAL (fixo, lançado), EQ (variável, papel
 * equipamentos em média de 3 meses), BR (pós-op., papel filial), PC (pós-op.,
 * papel comissão do sócio 10%).
 */
function ctx(over: Partial<GridContext> = {}): GridContext {
  const c = (n: number) => BigInt(Math.round(n * 100));
  return {
    today: '2026-11-14',
    cutoff: '2026-09',
    accounts: [
      {
        id: 1,
        code: '1.01',
        name: 'R',
        group: 'revenue',
        post_operational: false,
      },
      {
        id: 2,
        code: '2.01',
        name: 'IR',
        group: 'deductions',
        post_operational: false,
      },
      {
        id: 3,
        code: '3.01',
        name: 'FA',
        group: 'direct_cost',
        post_operational: false,
      },
      {
        id: 4,
        code: '3.02',
        name: 'NR',
        group: 'direct_cost',
        post_operational: false,
      },
      {
        id: 8,
        code: '3.03',
        name: 'EQ',
        group: 'direct_cost',
        post_operational: false,
      },
      {
        id: 5,
        code: '4.01',
        name: 'SAL',
        group: 'operating_expense',
        post_operational: false,
      },
      {
        id: 6,
        code: '4.02',
        name: 'BR',
        group: 'operating_expense',
        post_operational: true,
      },
      {
        id: 7,
        code: '4.03',
        name: 'PC',
        group: 'operating_expense',
        post_operational: true,
      },
    ],
    rules: {
      billing_revenue: 1,
      income_tax: 2,
      field_agents: 3,
      non_reimbursable_expenses: 4,
      equipment: 8,
      branch: 6,
      partner_commission: 7,
    },
    flow: new Map([
      ['billing_revenue|2026-08', c(9999)], // antes do corte: ignorado
      ['billing_revenue|2026-09', c(1)], // mês fechado: vale o congelado
      ['billing_revenue|2026-10', c(10000)],
      ['billing_revenue|2026-11', c(20000)],
      ['billing_revenue|2026-12', c(5000)],
      ['income_tax|2026-10', c(1333)],
      ['income_tax|2026-11', c(2666)],
      ['income_tax|2026-12', c(666.5)],
      ['field_agents|2026-11', c(3000)],
      ['non_reimbursable_expenses|2026-12', c(500)],
    ]),
    entered: new Map([
      ['1|2026-08', c(8000)],
      ['5|2026-08', c(6000)],
      ['5|2026-10', c(6500)],
      ['8|2026-08', c(300)],
      ['8|2026-10', c(900)],
    ]),
    classified: new Map(),
    closed: new Map([['2026-09', { '1': '7000.00', '5': '6000.00' }]]),
    params: {
      partnerPct: '10.00',
      branch: '3021.00',
      itemModes: {
        equipment: 'average_3_months',
        back_office: 'zero',
        additional_income_tax: 'fixed',
      },
      itemAmounts: { additional_income_tax: '100.00' },
    },
    ...over,
  };
}
const cell = (g: ReturnType<typeof buildGrid>, id: number, m: string) =>
  g.accounts.find((a) => a.id === id)!.cells.find((c) => c.month === m)!;
const lineOf = (g: ReturnType<typeof buildGrid>, key: string) =>
  g.lines.find((l) => l.key === key)!;

describe('DRE mensal (fórmulas)', () => {
  it('classifica os movimentos do fluxo nas regras, com o sinal da conta', () => {
    expect(
      flowKindOf({ direction: 'in', group: 'billing', origin: 'contract' }),
    ).toEqual({ kind: 'billing_revenue', sign: 1n });
    expect(
      flowKindOf({
        direction: 'out',
        group: 'non_reimbursable',
        origin: 'income_tax',
      })?.kind,
    ).toBe('income_tax');
    expect(
      flowKindOf({ direction: 'out', group: 'to_reimburse', origin: 'expense' })
        ?.kind,
    ).toBe('reimbursable_expenses');
    expect(
      flowKindOf({ direction: 'in', group: 'other_in', origin: 'asset_tag' }),
    ).toEqual({ kind: 'asset_tags_revenue', sign: 1n });
    expect(
      flowKindOf({
        direction: 'out',
        group: 'non_reimbursable',
        origin: 'asset_tag_cost',
      }),
    ).toEqual({ kind: 'asset_tags', sign: 1n });
    expect(
      flowKindOf({ direction: 'in', group: 'billing', origin: 'simulation' })
        ?.kind,
    ).toBe('billing_revenue');
    expect(addMonth('2026-01', -1)).toBe('2025-12');
  });

  it('antes do corte vale o lançado; mês fechado vale o congelado; do corte em diante vem do fluxo', () => {
    const g = buildGrid(ctx(), '2026');
    expect(cell(g, 1, '2026-08').value).toBe('8000.00'); // fluxo 9.999 ignorado
    expect(cell(g, 1, '2026-09')).toMatchObject({
      value: '7000.00',
      closed: true,
    }); // fluxo 0,01 ignorado
    expect(cell(g, 1, '2026-10')).toMatchObject({
      value: '10000.00',
      flow: '10000.00',
    });
    expect(cell(g, 2, '2026-12').value).toBe('666.50');
  });

  it('projeção sem gravar: fixo repete o último valor, equipamentos pela média de 3 meses, filial pelo parâmetro', () => {
    const g = buildGrid(ctx(), '2026');
    // SAL: último valor até o mês corrente = 6.500 (10/2026)
    expect(cell(g, 5, '2026-11')).toMatchObject({
      value: '6500.00',
      entered: null,
      estimate: '6500.00',
    });
    expect(cell(g, 5, '2026-12').estimate).toBe('6500.00');
    expect(cell(g, 5, '2026-10')).toMatchObject({
      value: '6500.00',
      estimate: null,
    }); // passado: sem estimativa
    // EQ: (ago 300 + set 0 + out 900) / 3 = 400
    expect(cell(g, 8, '2026-11').estimate).toBe('400.00');
    // BR: 3.021 do parâmetro
    expect(cell(g, 6, '2026-12').estimate).toBe('3021.00');
  });

  it('comissão do sócio: 10% do operacional do trimestre, no último mês (zero se negativo)', () => {
    const g = buildGrid(ctx(), '2026');
    // operacional: out 8.667 − 900 − 6.500 = 1.267; nov 17.334 − 3.400 − 6.500 = 7.434;
    // dez 4.333,50 − 900 − 6.500 = −3.066,50 → T4 = 5.634,50 → 10% = 563,45
    expect(lineOf(g, 'operating_result').values.slice(9)).toEqual([
      '1267.00',
      '7434.00',
      '-3066.50',
    ]);
    expect(cell(g, 7, '2026-12').estimate).toBe('563.45');
    expect(cell(g, 7, '2026-11').estimate).toBeNull();
    // trimestre negativo: sem comissão
    const neg = buildGrid(
      ctx({ flow: new Map([['billing_revenue|2026-11', 100n]]) }),
      '2026',
    );
    expect(cell(neg, 7, '2026-12').estimate).toBeNull();
  });

  it('linhas calculadas e resultado final do ano', () => {
    const g = buildGrid(ctx(), '2026');
    // ago 1.700; set 1.000; out 1.267; nov 7.434 − 3.021 = 4.413;
    // dez −3.066,50 − 3.021 − 563,45 = −6.650,95 → ano 1.729,05
    expect(lineOf(g, 'final_result').values.slice(7)).toEqual([
      '1700.00',
      '1000.00',
      '1267.00',
      '4413.00',
      '-6650.95',
    ]);
    expect(lineOf(g, 'final_result').total).toBe('1729.05');
    expect(lineOf(g, 'post_operational').values[11]).toBe('3584.45');
    expect(g.estimates).toBe(7);
  });

  it('valor lançado (até zero) vence a estimativa; estimativa não vale em mês fechado nem em outro ano', () => {
    const entered = new Map(ctx().entered);
    entered.set('5|2026-12', 0n);
    const g = buildGrid(ctx({ entered }), '2026');
    expect(cell(g, 5, '2026-12')).toMatchObject({
      value: '0.00',
      entered: '0.00',
      estimate: null,
    });
    const closed = new Map(ctx().closed);
    closed.set('2026-12', {});
    expect(
      cell(buildGrid(ctx({ closed }), '2026'), 5, '2026-12').estimate,
    ).toBeNull();
    expect(buildGrid(ctx(), '2027').estimates).toBe(0);
  });

  it('janela dos %: 12 meses anteriores ao mês corrente com receita na DRE', () => {
    const w = windowShares(ctx());
    expect(w).toMatchObject({
      from: '2025-11',
      to: '2026-10',
      months_with_revenue: 3,
      revenue: '25000.00',
      field_agents: '0.00',
      missing: ['commissions'],
    });
  });

  it('placas: custo do fornecedor em custo e revenda ao cliente em receita (nunca custo negativo)', () => {
    // 2 pedidos: custo 850 cada; revenda líquida (−16%) 2.100 cada, no mesmo mês
    const g = buildGrid(
      ctx({
        accounts: [
          {
            id: 1,
            code: '1.04',
            name: 'Revenda de placas',
            group: 'revenue',
            post_operational: false,
          },
          {
            id: 2,
            code: '3.04',
            name: 'Placas',
            group: 'direct_cost',
            post_operational: false,
          },
        ],
        rules: { asset_tags: 2, asset_tags_revenue: 1 },
        flow: new Map([
          ['asset_tags|2026-11', 170000n],
          ['asset_tags_revenue|2026-11', 420000n],
        ]),
        entered: new Map(),
        closed: new Map(),
      }),
      '2026',
    );
    expect(cell(g, 2, '2026-11').value).toBe('1700.00');
    expect(cell(g, 1, '2026-11').value).toBe('4200.00');
    expect(lineOf(g, 'variable_costs').values[10]).toBe('1700.00');
    expect(lineOf(g, 'revenue').values[10]).toBe('4200.00');
  });

  it('janela: receita sujeita ao IR = conta de faturamento (revenda de placas fica fora)', () => {
    const w = windowShares(
      ctx({
        accounts: [
          {
            id: 1,
            code: '1.01',
            name: 'R',
            group: 'revenue',
            post_operational: false,
          },
          {
            id: 9,
            code: '1.04',
            name: 'Revenda de placas',
            group: 'revenue',
            post_operational: false,
          },
        ],
        rules: { billing_revenue: 1, asset_tags_revenue: 9 },
        flow: new Map([
          ['billing_revenue|2026-10', 600000n],
          ['asset_tags_revenue|2026-10', 400000n],
        ]),
        entered: new Map(),
        closed: new Map(),
      }),
    );
    expect(w).toMatchObject({
      revenue: '10000.00',
      taxed_revenue: '6000.00',
      months_with_revenue: 1,
    });
  });
});
