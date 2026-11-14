import { BadRequestException, Injectable } from '@nestjs/common';
import { FinanceSettingsService } from '../finance-settings/finance-settings.service';
import { civilToday } from '../finance-settings/finance-settings.policy';
import type { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { CashFlowBoardService } from './cash-flow-board.service';
import {
  addMonths,
  cashFlowKpis,
  cents,
  type FlowItem,
  incomeTax,
  money,
  splitPercentages,
} from './cash-flow.formulas';
import {
  accountingBreakEven,
  averageCollectionDays,
  contributionMargin,
  economicBreakEven,
  fixedCostMonthly,
  netMargin,
  partnerCommission,
  pctUnits,
} from './cash-flow-indicators.formulas';
import { ReceivableService } from './receivable.service';

export interface SaleSimulation {
  value: string;
  signal_month: string;
  second_month: string;
  third_month: string;
  company_expenses: boolean;
}

const sum = (items: FlowItem[]) =>
  money(items.reduce((s, i) => s + cents(i.gross), 0n));
const net = (items: FlowItem[]) =>
  money(
    items.reduce(
      (s, i) => s + (i.direction === 'in' ? cents(i.gross) : -cents(i.gross)),
      0n,
    ),
  );

/**
 * Indicadores (doc 06 §7.4, etapa 8), calculados a partir dos mesmos movimentos
 * do fluxo de caixa. Enquanto a DRE (etapa 9) não existe: a janela de 12 meses
 * usa o realizado do fluxo (caixa, não competência), o resultado projetado do
 * ano é o resultado do fluxo menos o custo fixo dos parâmetros nos 12 meses, e
 * os itens de custo fixo em "média de 3 meses da DRE" ficam indisponíveis.
 */
@Injectable()
export class CashFlowIndicatorsService {
  constructor(
    private readonly board: CashFlowBoardService,
    private readonly receivables: ReceivableService,
    private readonly settings: FinanceSettingsService,
  ) {}

  async indicators(
    q: {
      organization_id?: number;
      project_id?: number;
      year?: string;
      month?: string;
      as_of?: string;
    },
    simulation: SaleSimulation | null,
    actor: ProjectActorContext,
  ) {
    const org = this.receivables.org(actor, q.organization_id);
    await this.receivables.require(actor, [
      'cash-flow:read',
      'receivables:read',
      'payments:read',
      'expenses:read',
      ...(simulation ? ['cash-flow:simulate'] : []),
    ]);
    const today = q.as_of ?? civilToday();
    const month = q.month ?? today.slice(0, 7);
    const year = q.year ?? month.slice(0, 4);
    let params;
    try {
      params = await this.settings.valuesAt(org, today);
    } catch {
      return {
        configured: false as const,
        as_of: today,
        reference: { month, year },
      };
    }
    const all = (await this.board.items(org, today)).items.filter(
      (i) =>
        i.currency === 'BRL' &&
        (!q.project_id || i.project_id === q.project_id),
    );
    const compute = (items: FlowItem[]) =>
      this.compute(items, params, { month, year });
    const original = compute(all);
    if (!simulation)
      return {
        configured: true as const,
        as_of: today,
        reference: { month, year },
        ...original,
        simulation: null,
      };
    const extra = await this.simulate(org, simulation, today);
    const simulated = compute([...all, ...extra]);
    const delta = (a: string | null, b: string | null) =>
      a === null || b === null ? null : money(cents(b) - cents(a));
    return {
      configured: true as const,
      as_of: today,
      reference: { month, year },
      ...original,
      simulation: {
        input: simulation,
        movements: extra.map((i) => ({
          date: i.date,
          direction: i.direction,
          origin: i.origin_label,
          gross: i.gross,
        })),
        kpis: simulated.kpis,
        indicators: simulated.indicators,
        delta: {
          month_total: delta(
            original.kpis.month.total,
            simulated.kpis.month.total,
          ),
          next_month_total: delta(
            original.kpis.next_month.total,
            simulated.kpis.next_month.total,
          ),
          year_total: delta(
            original.kpis.year.total,
            simulated.kpis.year.total,
          ),
          projected_result: delta(
            original.indicators.projected_result,
            simulated.indicators.projected_result,
          ),
        },
      },
    };
  }

  private compute(
    items: FlowItem[],
    p: Awaited<ReturnType<FinanceSettingsService['valuesAt']>>,
    ref: { month: string; year: string },
  ) {
    const live = items.filter((i) => i.status !== 'reversed');
    const [kpis] = cashFlowKpis(live, ref).filter((k) => k.currency === 'BRL');
    // Janela: os 12 meses anteriores ao mês de referência (realizado do fluxo).
    const start = addMonths(`${ref.month}-01`, -12);
    const end = `${ref.month}-01`;
    const win = live.filter(
      (i) => i.status === 'realized' && i.date >= start && i.date < end,
    );
    const revenue = sum(
      win.filter((i) => i.direction === 'in' && i.group === 'billing'),
    );
    // Entradas da janela sem IR (sem parâmetro vigente na data): a margem fica
    // incompleta — sinalizada, nunca escondida.
    const taxed = new Set(
      items.filter((i) => i.origin === 'income_tax').map((i) => i.key),
    );
    const untaxed = win.filter(
      (i) =>
        i.direction === 'in' &&
        i.group === 'billing' &&
        !taxed.has(`ir:${i.key}`),
    );
    const margin = contributionMargin({
      revenue,
      incomeTax: sum(win.filter((i) => i.origin === 'income_tax')),
      fieldAgents: sum(win.filter((i) => i.origin === 'field_agent_payment')),
      nonReimbursable: sum(
        win.filter(
          (i) => i.origin === 'expense' && i.group === 'non_reimbursable',
        ),
      ),
      commissions: sum(win.filter((i) => i.origin === 'commission')),
      partnerPct: p.partner_commission_pct,
    });
    const fixed = fixedCostMonthly({
      operation: p.fixed_cost_operation,
      branch: p.fixed_cost_branch,
      modes: { ...p.fixed_cost_item_modes },
      amounts: { ...(p.fixed_cost_item_amounts ?? {}) },
    });
    const inYear = live.filter((i) => i.date.startsWith(ref.year));
    const cashYear = net(inYear);
    const quarters = [0, 1, 2, 3].map((qi) => {
      const months = [1, 2, 3].map(
        (m) => `${ref.year}-${String(qi * 3 + m).padStart(2, '0')}`,
      );
      const cash = net(
        inYear.filter((i) => months.includes(i.date.slice(0, 7))),
      );
      return money(cents(cash) - 3n * cents(fixed.total));
    });
    const partner = partnerCommission(quarters, p.partner_commission_pct);
    const operating = money(cents(cashYear) - 12n * cents(fixed.total));
    const result = money(cents(operating) - cents(partner.year));
    const yearRevenue = sum(
      inYear.filter((i) => i.direction === 'in' && i.group === 'billing'),
    );
    // Não reembolsáveis do ano (inclui as despesas da venda simulada, se houver).
    const nonReimbYear = sum(
      inYear.filter(
        (i) =>
          ['expense', 'simulation_expense'].includes(i.origin) &&
          i.group === 'non_reimbursable',
      ),
    );
    const cutoff = `${p.dre_regime_cutoff_month}-01`;
    const receipts = live
      .filter(
        (i) =>
          i.direction === 'in' &&
          i.group === 'billing' &&
          i.status === 'realized' &&
          i.refs.contracted_on &&
          i.date >= cutoff,
      )
      .map((i) => ({
        amount: i.gross,
        contracted_on: String(i.refs.contracted_on),
        received_on: i.date,
      }));
    return {
      kpis,
      indicators: {
        window: {
          from: start.slice(0, 7),
          to: addMonths(end, -1).slice(0, 7),
          revenue,
          missing_tax: {
            count: untaxed.length,
            amount: sum(untaxed),
            since: untaxed.length ? untaxed.map((i) => i.date).sort()[0] : null,
          },
        },
        contribution_margin: margin
          ? {
              mc: margin.mc,
              mce: margin.mce,
              income_tax_pct: margin.income_tax_pct,
              field_agents_pct: margin.field_agents_pct,
              non_reimbursable_pct: margin.non_reimbursable_pct,
              commission_pct: margin.commission_pct,
              partner_effective_pct: margin.partner_effective_pct,
            }
          : null,
        fixed_cost: { ...fixed, year: money(12n * cents(fixed.total)) },
        cash_year_result: cashYear,
        operating_result: operating,
        partner_commission: {
          pct: p.partner_commission_pct,
          quarters: partner.quarters,
          operating_by_quarter: quarters,
          year: partner.year,
        },
        projected_result: result,
        year_revenue: yearRevenue,
        accounting_break_even: margin
          ? accountingBreakEven(result, margin.units.mce)
          : null,
        economic_break_even: margin
          ? economicBreakEven(
              result,
              yearRevenue,
              p.economic_break_even_margin_pct,
              margin.units.mce,
            )
          : null,
        economic_margin_pct: p.economic_break_even_margin_pct,
        net_margin: netMargin(
          result,
          yearRevenue,
          nonReimbYear,
          p.income_tax_pct,
        ),
        average_collection_days: averageCollectionDays(receipts),
        collection_since: cutoff,
        depends_on_dre: [
          'Janela da margem de contribuição pelo realizado do fluxo (caixa), não por competência.',
          'Resultado projetado = resultado do fluxo no ano − custo fixo dos parâmetros nos 12 meses − comissão do sócio.',
          ...(fixed.unavailable.length
            ? [
                `Itens de custo fixo em "média de 3 meses da DRE" indisponíveis até a etapa 9: ${fixed.items
                  .filter((i) => !i.available)
                  .map((i) => i.label)
                  .join(', ')}.`,
              ]
            : []),
        ],
      },
    };
  }

  /** Venda hipotética (não gravada): 50% no mês do sinal, 30% e 20% nos seguintes, com IR e, se a empresa paga as despesas, o % orçado de não reembolsáveis. */
  private async simulate(
    org: number,
    s: SaleSimulation,
    today: string,
  ): Promise<FlowItem[]> {
    const current = today.slice(0, 7);
    if (s.signal_month < current)
      throw new BadRequestException({
        code: 'SIMULATION_PAST_MONTH',
        message: `A venda simulada não pode começar num mês passado (${s.signal_month.split('-').reverse().join('/')}).`,
      });
    if (!(s.signal_month <= s.second_month && s.second_month <= s.third_month))
      throw new BadRequestException({
        code: 'SIMULATION_MONTH_ORDER',
        message:
          'Os meses das parcelas da venda simulada devem estar em ordem.',
      });
    // No mês atual a parcela cai hoje (não no dia 1º, que já passou).
    const dateOf = (m: string) => (m === current ? today : `${m}-01`);
    const parts = splitPercentages(s.value, ['50.00', '30.00', '20.00']);
    const months = [s.signal_month, s.second_month, s.third_month];
    const out: FlowItem[] = [];
    const base = {
      project_id: null,
      project_name: 'Venda simulada',
      currency: 'BRL',
      realized_on: null,
      status: 'open' as const,
      overdue: false,
      overdue_days: 0,
      installment: null,
      contract_pct: null,
    };
    let budgetPct: string | null = null;
    for (const [i, m] of months.entries()) {
      const date = dateOf(m);
      const p = await this.settings.valuesAt(org, date).catch(() => {
        throw new BadRequestException({
          code: 'SIMULATION_NO_PARAMETERS',
          message: `Sem parâmetros financeiros vigentes em ${date.split('-').reverse().join('/')} para calcular o IR da venda simulada.`,
        });
      });
      const tax = incomeTax(parts[i], p.income_tax_pct);
      out.push({
        ...base,
        key: `sim:in:${i}`,
        direction: 'in',
        group: 'billing',
        origin: 'simulation',
        origin_label: 'Venda simulada',
        date,
        expected_on: date,
        gross: parts[i],
        net: money(cents(parts[i]) - cents(tax)),
        derived: false,
        description: `Parcela ${i + 1}/3 da venda simulada`,
        refs: {},
      });
      out.push({
        ...base,
        key: `sim:ir:${i}`,
        direction: 'out',
        group: 'non_reimbursable',
        origin: 'income_tax',
        origin_label: 'Imposto de Renda',
        date,
        expected_on: date,
        gross: tax,
        net: tax,
        derived: true,
        description: 'IR da venda simulada',
        refs: {},
      });
      budgetPct ??= p.budgeted_non_reimbursable_expense_pct;
    }
    if (s.company_expenses && budgetPct) {
      const total = money(
        (cents(s.value) * pctUnits(budgetPct) * 2n + 1_000_000n) / 2_000_000n,
      );
      splitPercentages(total, ['50.00', '30.00', '20.00']).forEach((v, i) =>
        out.push({
          ...base,
          key: `sim:exp:${i}`,
          direction: 'out',
          group: 'non_reimbursable',
          origin: 'simulation_expense',
          origin_label: 'Despesas não reembolsáveis (simulação)',
          date: dateOf(months[i]),
          expected_on: dateOf(months[i]),
          gross: v,
          net: v,
          derived: false,
          description: `Despesas por conta da empresa: ${budgetPct.replace('.', ',')}% orçado`,
          refs: {},
        }),
      );
    }
    return out;
  }
}
