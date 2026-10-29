import { BadRequestException, ConflictException } from '@nestjs/common';
import { decimal, scaled } from '../budgets/budget.policy';
import { DRE_GROUPS, DreGroup } from './dre.dto';
export { decimal, scaled };
export const DRE_ENGINE = 'managerial-accrual-v1';
export const DRE_PERMISSIONS = [
  'dre:read',
  'dre:configure',
  'dre:classify',
  'dre:adjust',
  'dre:periods',
  'dre:export',
];
export const GROUP_LABELS: Record<DreGroup, string> = {
  revenue: 'Receita bruta',
  deductions: 'Deduções da receita',
  direct_cost: 'Custos dos serviços',
  operating_expense: 'Despesas operacionais',
  financial_income: 'Receitas financeiras',
  financial_expense: 'Despesas financeiras',
  income_tax: 'Tributos sobre lucro reconhecidos',
};
export function invalid(message: string): never {
  throw new BadRequestException({ code: 'DRE_INVALID', message });
}
export function conflict(message: string): never {
  throw new ConflictException({ code: 'DRE_CONFLICT', message });
}
export function month(value: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ||
    value < '1000-01' ||
    value > '9999-12'
  )
    invalid('Competência inválida. Use AAAA-MM.');
  return value;
}
export function months(start: string, end: string) {
  month(start);
  month(end);
  if (start > end) invalid('Período invertido.');
  const out: string[] = [];
  let y = Number(start.slice(0, 4)),
    m = Number(start.slice(5));
  while (`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}` <= end) {
    out.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
    if (out.length > 60) invalid('Limite de 60 competências por consulta.');
    if (++m === 13) {
      m = 1;
      y++;
    }
  }
  return out;
}
export interface DreLineInput {
  entry_id: number;
  revision: number;
  month: string;
  currency: string;
  project_id: number | null;
  amount: string;
  group: DreGroup | null;
  account_code: string | null;
  account_name: string | null;
  description: string;
  source_key: string | null;
}
export function percentage(n: bigint, d: bigint) {
  if (d <= 0n) return null;
  const neg = n < 0n,
    abs = neg ? -n : n;
  return decimal((neg ? -1n : 1n) * ((abs * 10000n + d / 2n) / d));
}
export function calculateDre(
  rows: DreLineInput[],
  reviewed: DreGroup[],
  hasGaps: boolean,
) {
  const sums = Object.fromEntries(DRE_GROUPS.map((g) => [g, 0n])) as Record<
    DreGroup,
    bigint
  >;
  for (const r of rows) if (r.group) sums[r.group] += scaled(r.amount);
  const complete = (groups: DreGroup[]) =>
    !hasGaps && groups.every((g) => reviewed.includes(g));
  const line = (
    key: string,
    label: string,
    known: bigint,
    groups: DreGroup[],
  ) => ({
    key,
    label,
    groups,
    known_amount: decimal(known),
    amount: complete(groups) ? decimal(known) : null,
    complete: complete(groups),
    entry_ids: [
      ...new Set(
        rows
          .filter((r) => r.group && groups.includes(r.group))
          .map((r) => r.entry_id),
      ),
    ],
  });
  const net = sums.revenue - sums.deductions,
    gross = net - sums.direct_cost,
    operating = gross - sums.operating_expense,
    financial = sums.financial_income - sums.financial_expense,
    before = operating + financial,
    after = before - sums.income_tax;
  const a: DreGroup[] = ['revenue', 'deductions'],
    b: DreGroup[] = [...a, 'direct_cost'],
    c: DreGroup[] = [...b, 'operating_expense'],
    d: DreGroup[] = [...c, 'financial_income', 'financial_expense'];
  return {
    lines: [
      line('revenue', GROUP_LABELS.revenue, sums.revenue, ['revenue']),
      line('deductions', GROUP_LABELS.deductions, sums.deductions, [
        'deductions',
      ]),
      line('net_revenue', 'Receita líquida', net, a),
      line('direct_cost', GROUP_LABELS.direct_cost, sums.direct_cost, [
        'direct_cost',
      ]),
      line('gross_profit', 'Lucro bruto gerencial', gross, b),
      line(
        'operating_expense',
        GROUP_LABELS.operating_expense,
        sums.operating_expense,
        ['operating_expense'],
      ),
      line('operating_result', 'Resultado operacional', operating, c),
      line(
        'financial_income',
        GROUP_LABELS.financial_income,
        sums.financial_income,
        ['financial_income'],
      ),
      line(
        'financial_expense',
        GROUP_LABELS.financial_expense,
        sums.financial_expense,
        ['financial_expense'],
      ),
      line('financial_result', 'Resultado financeiro', financial, [
        'financial_income',
        'financial_expense',
      ]),
      line(
        'before_tax',
        'Resultado gerencial antes de tributos sobre lucro',
        before,
        d,
      ),
      line('income_tax', GROUP_LABELS.income_tax, sums.income_tax, [
        'income_tax',
      ]),
      line(
        'after_tax',
        'Resultado gerencial após tributos reconhecidos',
        after,
        [...d, 'income_tax'],
      ),
    ],
    gross_margin: complete(b) ? percentage(gross, net) : null,
    operating_margin: complete(c) ? percentage(operating, net) : null,
    known_gross_margin: percentage(gross, net),
    known_operating_margin: percentage(operating, net),
    complete: complete([...DRE_GROUPS]),
    unclassified_amount: decimal(
      rows.filter((r) => !r.group).reduce((s, r) => s + scaled(r.amount), 0n),
    ),
  };
}
