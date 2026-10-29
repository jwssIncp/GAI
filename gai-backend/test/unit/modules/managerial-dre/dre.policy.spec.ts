import {
  calculateDre,
  DreLineInput,
  months,
  percentage,
} from '../../../../src/modules/managerial-dre/dre.policy';
import {
  DRE_GROUPS,
  DreGroup,
} from '../../../../src/modules/managerial-dre/dre.dto';
const row = (
  group: DreGroup | null,
  amount: string,
  entry_id = 1,
): DreLineInput => ({
  group,
  amount,
  entry_id,
  revision: 1,
  month: '2026-01',
  currency: 'BRL',
  project_id: null,
  account_code: null,
  account_name: null,
  description: 'Synthetic',
  source_key: null,
});
describe('Managerial accrual formulas', () => {
  it('calculates every layer with exact cents and explicit taxes', () => {
    const r = calculateDre(
      [
        row('revenue', '100.01'),
        row('deductions', '10.00'),
        row('direct_cost', '20.00'),
        row('operating_expense', '5.00'),
        row('financial_income', '1.00'),
        row('financial_expense', '2.00'),
        row('income_tax', '3.00'),
      ],
      [...DRE_GROUPS],
      false,
    );
    expect(
      Object.fromEntries(r.lines.map((l) => [l.key, l.amount])),
    ).toMatchObject({
      net_revenue: '90.01',
      gross_profit: '70.01',
      operating_result: '65.01',
      financial_result: '-1.00',
      before_tax: '64.01',
      after_tax: '61.01',
    });
    expect(r.complete).toBe(true);
  });
  it('does not silently certify missing groups as zero or infer taxes', () => {
    const r = calculateDre([row('revenue', '100.00')], ['revenue'], false);
    expect(r.lines.find((l) => l.key === 'income_tax')).toMatchObject({
      amount: null,
      known_amount: '0.00',
    });
    expect(r.lines.find((l) => l.key === 'after_tax')?.amount).toBeNull();
  });
  it('excludes unclassified amounts and flags coverage gaps', () => {
    const r = calculateDre(
      [row('revenue', '10.01'), row(null, '9.99')],
      [...DRE_GROUPS],
      true,
    );
    expect(r.unclassified_amount).toBe('9.99');
    expect(r.lines[0]).toMatchObject({ known_amount: '10.01', amount: null });
  });
  it('retains exact precision near the decimal storage limit', () => {
    const r = calculateDre(
      [row('revenue', '9999999999999.99'), row('direct_cost', '0.01')],
      [...DRE_GROUPS],
      false,
    );
    expect(r.lines.find((l) => l.key === 'gross_profit')?.amount).toBe(
      '9999999999999.98',
    );
  });
  it('provides dependencies for accurate subtotal drill-down', () => {
    const r = calculateDre(
      [row('revenue', '20.00'), row('income_tax', '1.00')],
      [...DRE_GROUPS],
      false,
    );
    expect(r.lines.find((l) => l.key === 'net_revenue')?.groups).toEqual([
      'revenue',
      'deductions',
    ]);
  });
  it('handles negative margins and undefined denominators', () => {
    expect(percentage(-1n, 3n)).toBe('-33.33');
    expect(percentage(1n, 0n)).toBeNull();
  });
  it('validates ranges and cross-year comparisons', () => {
    expect(months('2025-12', '2026-02')).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(() => months('2026-02', '2026-01')).toThrow();
    expect(() => months('2026-13', '2026-13')).toThrow();
    expect(() => months('2020-01', '2026-01')).toThrow();
  });
});
