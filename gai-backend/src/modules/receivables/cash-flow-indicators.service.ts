import { BadRequestException, Injectable } from '@nestjs/common';
import { FinanceSettingsService } from '../finance-settings/finance-settings.service';
import { civilToday } from '../finance-settings/finance-settings.policy';
import type { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { CashFlowBoardService } from './cash-flow-board.service';
import {
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
  pctOf,
  saleResult,
} from './cash-flow-indicators.formulas';
import { ReceivableService } from './receivable.service';
import { DreMonthlyService } from '../managerial-dre/dre-monthly.service';
import {
  average3,
  buildGrid,
  type GridContext,
  windowShares,
} from '../managerial-dre/dre-monthly.formulas';

export interface SaleSimulation {
  value: string;
  signal_month: string;
  second_month: string;
  third_month: string;
  company_expenses: boolean;
}

const sum = (items: FlowItem[]) =>
  money(items.reduce((s, i) => s + cents(i.gross), 0n));

/** Indicadores do fluxo de caixa (doc 06 §7.4) sobre a DRE mensal. */
@Injectable()
export class CashFlowIndicatorsService {
  constructor(
    private readonly board: CashFlowBoardService,
    private readonly receivables: ReceivableService,
    private readonly settings: FinanceSettingsService,
    private readonly monthly: DreMonthlyService,
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
    const dre = await this.monthly.context(org, today);
    if (!dre)
      return { configured: false as const, as_of: today, reference: ref };
    const { internals, ...original } = this.compute(
      all,
      params,
      ref,
      dre.ctx,
      Boolean(q.project_id),
    );
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
          'Sem receita na DRE dos 12 meses anteriores: não há % histórico de inventariantes e despesas para simular a venda.',
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
      cents(original.kpis.year.dre_total) + cents(effect.result),
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
          year: { ...original.kpis.year, dre_total: yearTotal },
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

  /**
   * Indicadores sobre a DRE mensal (etapa 9), como o INVESTOR:
   * - janela dos % (inventariantes, não reembolsáveis, comissões): os 12 meses
   *   anteriores ao mês corrente com receita, sobre a receita bruta da DRE;
   *   IR pelo % do parâmetro;
   * - resultado projetado e total do ano = resultado final da DRE jan–dez
   *   (realizado + fluxo + estimativas, sem gravar estimativa);
   * - comissão do sócio por trimestre a partir da DRE;
   * - itens de custo fixo em "média de 3 meses" pela DRE.
   */
  private compute(
    items: FlowItem[],
    p: Awaited<ReturnType<FinanceSettingsService['valuesAt']>>,
    ref: { month: string; year: string },
    ctx: GridContext,
    projectFiltered: boolean,
  ) {
    const live = items.filter((i) => i.status !== 'reversed');
    const [flowKpis] = cashFlowKpis(live, ref).filter(
      (k) => k.currency === 'BRL',
    );
    const grid = buildGrid(ctx, ref.year);
    const line = (key: string) => grid.lines.find((l) => l.key === key)!;
    const ruleTotal = (kind: keyof GridContext['rules']) => {
      const a = grid.accounts.find((x) => x.id === ctx.rules[kind]);
      return a ? a.total : '0.00';
    };
    const win = windowShares(ctx);
    const margin = contributionMargin({
      revenue: win.revenue,
      incomeTaxPct: p.income_tax_pct,
      fieldAgents: win.field_agents,
      nonReimbursable: win.non_reimbursable,
      commissions: win.commissions,
      partnerPct: p.partner_commission_pct,
    });
    const averages: Record<string, string | null> = {};
    for (const key of ['additional_income_tax', 'equipment', 'back_office']) {
      const a = ctx.accounts.find(
        (x) => x.id === ctx.rules[key as keyof GridContext['rules']],
      );
      averages[key] = a ? money(average3(ctx, a)) : null;
    }
    const fixed = fixedCostMonthly({
      operation: p.fixed_cost_operation,
      branch: p.fixed_cost_branch,
      modes: { ...p.fixed_cost_item_modes },
      amounts: { ...(p.fixed_cost_item_amounts ?? {}) },
      averages,
    });
    const quarterSum = (values: string[]) =>
      [0, 1, 2, 3].map((q) =>
        money(
          values.slice(q * 3, q * 3 + 3).reduce((s, v) => s + cents(v), 0n),
        ),
      );
    const partnerAccount = grid.accounts.find(
      (a) => a.id === ctx.rules.partner_commission,
    );
    const partnerQuarters = partnerAccount
      ? quarterSum(partnerAccount.cells.map((c) => c.value))
      : ['0.00', '0.00', '0.00', '0.00'];
    const result = line('final_result').total;
    const yearRevenue = line('revenue').total;
    const nonReimbYear = ruleTotal('non_reimbursable_expenses');
    const kpis = { ...flowKpis, year: { ...flowKpis.year, dre_total: result } };
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
          from: win.from,
          to: win.to,
          revenue: win.revenue,
          months_with_revenue: win.months_with_revenue,
          missing_accounts: win.missing,
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
        dre: {
          year: ref.year,
          revenue: yearRevenue,
          operating_result: line('operating_result').total,
          final_result: result,
          estimates: grid.estimates,
          cash_flow_total: flowKpis.year.total,
        },
        operating_result: line('operating_result').total,
        partner_commission: {
          pct: p.partner_commission_pct,
          quarters: partnerQuarters,
          operating_by_quarter: quarterSum(line('operating_result').values),
          year: money(partnerQuarters.reduce((s, v) => s + cents(v), 0n)),
          account_missing: !partnerAccount,
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
        notes: [
          `Resultado projetado = resultado final da DRE mensal de ${ref.year} (jan–dez): lançado, fluxo a partir de ${p.dre_regime_cutoff_month.split('-').reverse().join('/')} e ${grid.estimates} estimativa(s) dos meses abertos (não gravadas).`,
          'Margem de contribuição: % de inventariantes, não reembolsáveis e comissões dos 12 meses anteriores com receita na DRE; IR pelo parâmetro.',
          ...(fixed.unavailable.length
            ? [
                `Sem conta associada na DRE para a média de 3 meses: ${fixed.items
                  .filter((i) => !i.available)
                  .map((i) => i.label)
                  .join(', ')}. Associe em DRE mensal › Configurar.`,
              ]
            : []),
          ...(projectFiltered
            ? [
                'Filtro de projeto: os valores da DRE são da organização inteira.',
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
