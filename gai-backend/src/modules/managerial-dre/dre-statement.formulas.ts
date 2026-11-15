import type { DreGroup } from './dre.dto';
import {
  LINE_LABELS,
  lines,
  type GridAccount,
  type LineValues,
} from './dre-monthly.formulas';
import { decimal, percentage, signed, type DreLineInput } from './dre.policy';

type Which = (a: GridAccount) => boolean;
const group =
  (...g: DreGroup[]): Which =>
  (a) =>
    !a.post_operational && g.includes(a.group);
const post: Which = (a) => a.post_operational;
const any =
  (...w: Which[]): Which =>
  (a) =>
    w.some((f) => f(a));

/** Contas que compõem cada linha (para a lista de lançamentos da linha). */
const MEMBERS: Record<keyof LineValues, Which> = {
  revenue: group('revenue'),
  deductions: group('deductions'),
  net_revenue: group('revenue', 'deductions'),
  variable_costs: group('direct_cost'),
  fixed_costs: group('operating_expense'),
  total_costs: group('direct_cost', 'operating_expense'),
  operating_result: group(
    'revenue',
    'deductions',
    'direct_cost',
    'operating_expense',
  ),
  post_operational: post,
  financial_result: group('financial_income', 'financial_expense'),
  income_taxes: group('income_tax'),
  final_result: any(() => true),
};

/**
 * Demonstrativo no modo DRE automática: as MESMAS linhas, nomes e regras da
 * DRE mensal (pós-operacional abaixo do resultado operacional e resultado
 * final), sobre os valores sem estimativa.
 */
export function monthlyStatement(
  rows: DreLineInput[],
  accounts: GridAccount[],
) {
  const byCode = new Map<string, bigint>();
  for (const r of rows)
    if (r.account_code)
      byCode.set(
        r.account_code,
        (byCode.get(r.account_code) ?? 0n) + signed(r.amount),
      );
  const v = lines(accounts, (a) => byCode.get(a.code) ?? 0n);
  const codesOf = (w: Which) => new Set(accounts.filter(w).map((a) => a.code));
  const keys = Object.keys(LINE_LABELS) as Array<keyof LineValues>;
  return {
    lines: keys.map((key) => {
      const codes = codesOf(MEMBERS[key]);
      const members = accounts.filter(MEMBERS[key]);
      return {
        key,
        label: LINE_LABELS[key],
        groups: [...new Set(members.map((a) => a.group))],
        known_amount: decimal(v[key]),
        amount: decimal(v[key]),
        complete: true,
        entry_ids: [
          ...new Set(
            rows
              .filter(
                (r) =>
                  r.entry_id && r.account_code && codes.has(r.account_code),
              )
              .map((r) => r.entry_id),
          ),
        ],
      };
    }),
    complete: true,
    gross_margin: percentage(v.net_revenue - v.variable_costs, v.net_revenue),
    operating_margin: percentage(v.operating_result, v.net_revenue),
    known_gross_margin: percentage(
      v.net_revenue - v.variable_costs,
      v.net_revenue,
    ),
    known_operating_margin: percentage(v.operating_result, v.net_revenue),
    unclassified_amount: '0.00',
  };
}
