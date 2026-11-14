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
  pctOf,
  saleResult,
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
    const ref = { month, year };
    const { internals, ...original } = this.compute(all, params, ref);
    if (!simulation)
      return {
        configured: true as const,
        as_of: today,
        reference: ref,
        ...original,
        simulation: null,
      };
    this.assertSimulation(simulation, today);
    if (!internals.margin)
      throw new BadRequestException({
        code: 'SIMULATION_NO_HISTORY',
        message:
          'Sem receita recebida nos 12 meses anteriores: não há % histórico de inventariantes e despesas para simular a venda.',
      });
    const mu = internals.margin.units;
    const extra = await this.simulate(org, simulation, today, mu);
    // Meses (atual e próximo): pelos movimentos da venda (líquido de IR −
    // inventariantes − não reembolsáveis), como o simMes do INVESTOR.
    const live = all.filter((i) => i.status !== 'reversed');
    const [moved] = cashFlowKpis([...live, ...extra], ref).filter(
      (k) => k.currency === 'BRL',
    );
    // Ano: venda do ano × MC (+ a parte do cliente: não reemb. × % quando as
    // despesas são do cliente), como o SIM_RES do INVESTOR.
    const yearSale = sum(
      extra.filter((i) => i.origin === 'simulation' && i.date.startsWith(year)),
    );
    const effect = saleResult({
      yearSale,
      clientPaysExpenses: !simulation.company_expenses,
      mcUnits: mu.mc,
      nonReimbursableUnits: mu.nonReimbursable,
    });
    const projected = money(cents(internals.result) + cents(effect.result));
    const yearRevenue = money(cents(internals.yearRevenue) + cents(yearSale));
    const yearTotal = money(
      cents(original.kpis.year.total) + cents(effect.result),
    );
    const delta = (a: string | null, b: string | null) =>
      a === null || b === null ? null : money(cents(b) - cents(a));
    return {
      configured: true as const,
      as_of: today,
      reference: ref,
      ...original,
      simulation: {
        input: simulation,
        basis: {
          field_agents_pct: internals.margin.field_agents_pct,
          non_reimbursable_pct: internals.margin.non_reimbursable_pct,
          mc: internals.margin.mc,
          year_sale: yearSale,
          sale_result: effect.result,
          client_share: effect.client_share,
        },
        movements: extra.map((i) => ({
          date: i.date,
          direction: i.direction,
          origin: i.origin_label,
          gross: i.gross,
        })),
        kpis: {
          ...original.kpis,
          month: moved.month,
          next_month: moved.next_month,
          year: { ...original.kpis.year, total: yearTotal },
        },
        indicators: {
          ...original.indicators,
          projected_result: projected,
          year_revenue: yearRevenue,
          accounting_break_even: accountingBreakEven(projected, mu.mce),
          economic_break_even: economicBreakEven(
            projected,
            yearRevenue,
            params.economic_break_even_margin_pct,
            mu.mce,
          ),
          net_margin: netMargin(
            projected,
            yearRevenue,
            internals.nonReimbursableYear,
            params.income_tax_pct,
          ),
        },
        delta: {
          month_total: delta(original.kpis.month.total, moved.month.total),
          next_month_total: delta(
            original.kpis.next_month.total,
            moved.next_month.total,
          ),
          year_total: effect.result,
          projected_result: effect.result,
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
        (i) => i.origin === 'expense' && i.group === 'non_reimbursable',
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
      internals: {
        margin,
        result,
        yearRevenue,
        nonReimbursableYear: nonReimbYear,
      },
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

  private assertSimulation(s: SaleSimulation, today: string): void {
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
  }

  /**
   * Venda hipotética (não gravada), como o simMes do INVESTOR: 50% no mês do
   * sinal, 30% e 20% nos seguintes; cada parcela desconta o IR do parâmetro,
   * os inventariantes pelo % histórico (12 meses) e, se a empresa paga as
   * despesas, os não reembolsáveis pelo % histórico.
   */
  private async simulate(
    org: number,
    s: SaleSimulation,
    today: string,
    pct: { fieldAgents: bigint; nonReimbursable: bigint },
  ): Promise<FlowItem[]> {
    const current = today.slice(0, 7);
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
      derived: true,
      refs: {},
    };
    const outflow = (
      key: string,
      date: string,
      gross: string,
      group: FlowItem['group'],
      origin: string,
      label: string,
      description: string,
    ): FlowItem => ({
      ...base,
      key,
      direction: 'out',
      group,
      origin,
      origin_label: label,
      date,
      expected_on: date,
      gross,
      net: gross,
      description,
    });
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
      });
      out.push(
        outflow(
          `sim:ir:${i}`,
          date,
          tax,
          'non_reimbursable',
          'income_tax',
          'Imposto de Renda',
          'IR da venda simulada',
        ),
        outflow(
          `sim:fa:${i}`,
          date,
          pctOf(parts[i], pct.fieldAgents),
          'non_reimbursable',
          'simulation_field_agents',
          'Inventariantes (simulação)',
          'Inventariantes pelo % histórico',
        ),
      );
      if (s.company_expenses)
        out.push(
          outflow(
            `sim:nr:${i}`,
            date,
            pctOf(parts[i], pct.nonReimbursable),
            'non_reimbursable',
            'simulation_expense',
            'Despesas não reembolsáveis (simulação)',
            'Despesas por conta da empresa pelo % histórico',
          ),
        );
    }
    return out;
  }
}
