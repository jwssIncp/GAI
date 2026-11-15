/**
 * Custos fixos no fluxo de caixa (etapa "fluxo de caixa com paridade"): as
 * contas da DRE mensal que o fluxo não alimenta — custos fixos, pós-operacional
 * e contas associadas a papéis (equipamentos, adicional de IR, filial,
 * back-office, comissão do sócio) — viram saídas não reembolsáveis derivadas,
 * uma por conta e mês, com a origem "Custos fixos":
 * - "Lançado": valor lançado, importado ou classificado na DRE (ou congelado
 *   no fechamento). Lançado não significa pago;
 * - "Estimado": estimativa da DRE (nunca gravada).
 * Para os cards, lançado em mês anterior ao corrente conta como realizado
 * (como os meses encerrados do INVESTOR); o restante conta como a pagar.
 * As linhas não têm projeto, não têm baixa no fluxo e não voltam para a DRE
 * (flowKindOf não reconhece a origem "fixed_cost": sem contagem dupla).
 * Só a partir do mês de corte do regime: antes dele a DRE é importada e o
 * fluxo não a alimenta (somar só os custos misturaria os dois regimes).
 */
import type { FlowItem } from '../receivables/cash-flow.formulas';
import { buildGrid, fromCents, toCents } from './dre-monthly.formulas';

type Grid = ReturnType<typeof buildGrid>;
type GridAccountRow = Grid['accounts'][number];

export const FIXED_COST_ORIGIN = 'fixed_cost';
export const FIXED_COST_LABEL = 'Custos fixos';
const INCOME_GROUPS = ['revenue', 'financial_income'];

/** Conta da DRE que entra no fluxo como custo fixo. */
export function isFixedCostAccount(a: GridAccountRow): boolean {
  return (
    a.flow_kinds.length === 0 &&
    !INCOME_GROUPS.includes(a.group) &&
    (a.group === 'operating_expense' || a.post_operational || a.role !== null)
  );
}

const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** Linhas de custo fixo de um ano da grade da DRE mensal. */
export function fixedCostFlowItems(grid: Grid): FlowItem[] {
  const out: FlowItem[] = [];
  for (const a of grid.accounts) {
    if (!isFixedCostAccount(a)) continue;
    for (const c of a.cells) {
      // Antes do corte a DRE é importada e o fluxo não a alimenta: só a partir dele.
      if (c.month < grid.cutoff) continue;
      const estimate = c.estimate === null ? 0n : toCents(c.estimate);
      const entered = toCents(c.value) - estimate;
      const date = lastDay(c.month);
      const row = (state: 'entered' | 'estimate', value: bigint): FlowItem => ({
        key: `${FIXED_COST_ORIGIN}:${a.id}:${c.month}:${state}`,
        direction: 'out',
        group: 'non_reimbursable',
        origin: FIXED_COST_ORIGIN,
        origin_label: FIXED_COST_LABEL,
        project_id: null,
        project_name: '—',
        currency: 'BRL',
        date,
        expected_on: date,
        realized_on: null,
        status:
          state === 'entered' && c.month < grid.current_month
            ? 'realized'
            : 'open',
        overdue: false,
        overdue_days: 0,
        gross: fromCents(value),
        net: fromCents(value),
        derived: true,
        installment: null,
        contract_pct: null,
        description: `${a.code} ${a.name}`,
        refs: {
          fixed_cost: state,
          account_id: a.id,
          month: c.month,
          basis: state === 'estimate' ? c.estimate_basis : null,
        },
        reference_on: null,
      });
      if (entered !== 0n) out.push(row('entered', entered));
      if (estimate !== 0n) out.push(row('estimate', estimate));
    }
  }
  return out;
}
