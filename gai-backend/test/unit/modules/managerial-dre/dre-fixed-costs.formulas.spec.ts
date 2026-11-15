import {
  fixedCostFlowItems,
  FIXED_COST_LABEL,
} from '../../../../src/modules/managerial-dre/dre-fixed-costs.formulas';
import {
  buildGrid,
  flowKindOf,
  type GridContext,
} from '../../../../src/modules/managerial-dre/dre-monthly.formulas';

/**
 * Exemplo à mão (hoje 14/11/2026; corte 09/2026):
 * - R (receita, fluxo) e FA (variável, diárias pelo fluxo): fora;
 * - VAR (variável sem papel, lançado): fora (não é custo fixo);
 * - OUT (receita pós-operacional): fora (receita);
 * - SAL (custo fixo): lançado 6.000 em 08 e 6.500 em 10; estimado 6.500
 *   (repete o último) em 11 e 12;
 * - EQ (variável, papel equipamentos, valor fixo 400): lançado 900 em 10;
 *   estimado 400 em 11 e 12;
 * - BR (pós-operacional, papel filial 3.021): estimado em 11 e 12.
 */
const c = (n: number) => BigInt(Math.round(n * 100));
const acc = (
  id: number,
  code: string,
  name: string,
  group: GridContext['accounts'][number]['group'],
  post = false,
) => ({ id, code, name, group, post_operational: post });
const ctx: GridContext = {
  today: '2026-11-14',
  cutoff: '2026-09',
  accounts: [
    acc(1, '1.01', 'Receita', 'revenue'),
    acc(3, '3.01', 'Inventariantes', 'direct_cost'),
    acc(8, '3.06', 'Equipamentos', 'direct_cost'),
    acc(10, '3.07', 'Outros variáveis', 'direct_cost'),
    acc(5, '4.01', 'Pessoal fixo', 'operating_expense'),
    acc(6, '5.02', 'Filial', 'operating_expense', true),
    acc(9, '5.09', 'Outra receita', 'revenue', true),
  ],
  rules: { billing_revenue: 1, field_agents: 3, equipment: 8, branch: 6 },
  flow: new Map([
    ['billing_revenue|2026-11', c(20000)],
    ['field_agents|2026-11', c(3000)],
  ]),
  entered: new Map([
    ['5|2026-08', c(6000)],
    ['5|2026-10', c(6500)],
    ['8|2026-10', c(900)],
    ['10|2026-10', c(250)],
    ['9|2026-10', c(50)],
  ]),
  classified: new Map(),
  closed: new Map(),
  params: {
    partnerPct: '0.00',
    branch: '3021.00',
    itemModes: { equipment: 'fixed' },
    itemAmounts: { equipment: '400.00' },
  },
};

describe('Custos fixos da DRE no fluxo de caixa', () => {
  const rows = fixedCostFlowItems(buildGrid(ctx, '2026'));
  const pick = (code: string) =>
    rows
      .filter((r) => r.description.startsWith(code))
      .map((r) => [
        r.date,
        r.refs.fixed_cost,
        r.status,
        r.gross,
        r.refs.basis ?? null,
      ]);

  it('só contas de custo fixo, pós-operacional e papéis (nunca receita nem fluxo)', () => {
    expect(new Set(rows.map((r) => r.description.split(' ')[0]))).toEqual(
      new Set(['3.06', '4.01', '5.02']),
    );
  });

  it('lançado (realizado só em mês anterior ao corrente) e estimado com a base; nada antes do corte', () => {
    // 08/2026 (6.000 lançado) é anterior ao corte 09/2026: fica fora.
    expect(pick('4.01')).toEqual([
      ['2026-10-31', 'entered', 'realized', '6500.00', null],
      ['2026-11-30', 'estimate', 'open', '6500.00', 'repete o último valor'],
      ['2026-12-31', 'estimate', 'open', '6500.00', 'repete o último valor'],
    ]);
    expect(pick('3.06')).toEqual([
      ['2026-10-31', 'entered', 'realized', '900.00', null],
      ['2026-11-30', 'estimate', 'open', '400.00', 'valor fixo dos parâmetros'],
      ['2026-12-31', 'estimate', 'open', '400.00', 'valor fixo dos parâmetros'],
    ]);
    expect(pick('5.02').map((r) => r[3])).toEqual(['3021.00', '3021.00']);
  });

  it('saída derivada, sem projeto, sem baixa e fora da DRE (sem contagem dupla)', () => {
    for (const r of rows) {
      expect(r).toMatchObject({
        direction: 'out',
        group: 'non_reimbursable',
        origin: 'fixed_cost',
        origin_label: FIXED_COST_LABEL,
        project_id: null,
        currency: 'BRL',
        derived: true,
        overdue: false,
      });
      expect(r.refs.settle_key).toBeUndefined();
      expect(flowKindOf(r)).toBeNull();
    }
  });

  it('lançado no mês corrente conta como a pagar', () => {
    const now = fixedCostFlowItems(
      buildGrid(
        { ...ctx, entered: new Map([...ctx.entered, ['5|2026-11', c(7000)]]) },
        '2026',
      ),
    ).find((r) => r.key === 'fixed_cost:5:2026-11:entered')!;
    expect([now.status, now.gross]).toEqual(['open', '7000.00']);
  });
});
