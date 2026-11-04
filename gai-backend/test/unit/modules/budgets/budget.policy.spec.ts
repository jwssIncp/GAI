import {
  calculateBudget,
  paymentPlan,
  pricingValues,
  scaled,
  decimal,
} from '../../../../src/modules/budgets/budget.policy';
import { testBudget, testPricing } from './budget.fixtures';
import {
  BudgetEntity,
  BudgetVersionEntity,
} from '../../../../src/modules/budgets/budget.entity';
describe('Budget sizing, exact pricing and commercial installments', () => {
  it('normalizes MySQL BIGINT IDs to the numeric domain used by version selection and CAS', () => {
    const budget = Object.assign(new BudgetEntity(), {
      id: '42',
      organizationId: '1',
      companyId: '9',
      projectId: null,
      headVersionId: '101',
      approvedVersionId: null,
    });
    budget.normalizeIds();
    expect(budget.id).toBe(42);
    expect(budget.companyId).toBe(9);
    expect(budget.headVersionId).toBe(101);
    expect(budget.projectId).toBeNull();
    const version = Object.assign(new BudgetVersionEntity(), {
      id: '101',
      organizationId: '1',
      budgetId: '42',
      pricingId: '5',
      baseVersionId: null,
      actorId: '2',
    });
    version.normalizeIds();
    expect(version.id).toBe(101);
    expect(version.budgetId).toBe(42);
    expect(version.pricingId).toBe(5);
  });
  it('never silently loses ID precision beyond the numeric domain', () => {
    const budget = Object.assign(new BudgetEntity(), {
      id: '9007199254740993',
    });
    expect(() => budget.normalizeIds()).toThrow('safe integer');
  });
  it('ceil-rounds staff and field days and retains detailed costs and generic gross-up', () => {
    const r = calculateBudget(testBudget(), testPricing(), 2);
    expect(r.sizing).toMatchObject({
      person_days: 10,
      team: 2,
      field_days: 5,
      rooms: 1,
      extra_days: 2,
      stay_days: 7,
    });
    expect(r.lines.find((l) => l.key === 'technical')?.subtotal).toBe(
      '1001.00',
    );
    expect(r.lines.find((l) => l.key === 'lodging')?.subtotal).toBe('140.00');
    expect(r.cost_total).toBe('1339.60');
    expect(r.final_price).toBe('1913.72');
    expect(r.tax_amount).toBe('191.37');
    expect(r.commission_amount).toBe('95.69');
    expect(r.margin_amount).toBe('287.06');
    expect(r.payment.rows.reduce((s, r) => s + scaled(r.amount), 0n)).toBe(
      scaled(r.final_price),
    );
  });
  it('returns exactly the same result for identical inputs and parameter version', () => {
    expect(calculateBudget(testBudget(), testPricing(), 2)).toEqual(
      calculateBudget(testBudget(), testPricing(), 2),
    );
  });
  it('honors address effort, adjustment factor and integer team without division by zero', () => {
    const p = testPricing({
      productivity: 1000,
      address_factor: '1.5000',
      default_days: 3,
    });
    const r = calculateBudget(testBudget({ estimated_assets: 1 }), p, 101);
    expect(r.sizing).toMatchObject({
      effort_assets: 1,
      effort_addresses: 51,
      person_days: 51,
      required_team: 17,
      team: 17,
      field_days: 3,
    });
    expect(() => pricingValues(testPricing({ productivity: 0 }))).toThrow();
    expect(() => pricingValues(testPricing({ address_factor: '0' }))).toThrow();
  });
  it('does not invent paid work when both quantities are zero; fixed costs still remain explicit', () => {
    const r = calculateBudget(
      testBudget({ estimated_assets: 0 }),
      testPricing(),
      0,
    );
    expect(r.sizing.field_days).toBe(0);
    expect(r.lines.find((l) => l.key === 'technical')?.subtotal).toBe('0.00');
    expect(r.cost_total).toBe('14.60');
  });
  it('applies only the published minimum and never a fixed legacy floor', () => {
    const a = calculateBudget(
      testBudget({ estimated_assets: 1 }),
      testPricing({ minimum_price: '5000.01' }),
      0,
    );
    expect(a.final_price).toBe('5000.01');
    expect(
      calculateBudget(testBudget({ estimated_assets: 1 }), testPricing(), 0)
        .final_price,
    ).not.toBe('21000.00');
  });
  it('requires manual justification and adequate staff, and rejects a margin denominator of zero', () => {
    expect(() =>
      calculateBudget(testBudget({ sizing: { team: 1 } }), testPricing(), 2),
    ).toThrow('justificativa');
    expect(() =>
      calculateBudget(
        testBudget({
          sizing: { team: 1, adjustment_reason: 'Equipe reduzida' },
        }),
        testPricing(),
        2,
      ),
    ).toThrow('Equipe insuficiente');
    expect(() => pricingValues(testPricing({ margin_pct: '85' }))).toThrow();
    expect(() =>
      calculateBudget(
        testBudget({
          sizing: { margin_pct: '85', adjustment_reason: 'Margem ajustada' },
        }),
        testPricing(),
        2,
      ),
    ).toThrow();
  });
  it('simulates team/productivity/expenses/margin/deadline changes and does not mutate input parameters', () => {
    const p = testPricing(),
      before = JSON.stringify(p);
    const r = calculateBudget(
      testBudget({
        sizing: {
          team: 1,
          available_days: 20,
          productivity: 200,
          operational_extra: '0.20',
          margin_pct: '20',
          adjustment_reason: 'Cenário comercial sintético',
        },
      }),
      p,
      2,
    );
    expect(r.sizing.team).toBe(1);
    expect(r.rates.margin_pct).toBe('20.00');
    expect(r.lines.at(-1)?.subtotal).toBe('0.20');
    expect(JSON.stringify(p)).toBe(before);
  });
  it('preserves large monetary cents and rejects malformed money and out-of-range final price', () => {
    expect(decimal(scaled('9999999999999.99'))).toBe('9999999999999.99');
    for (const value of ['1.001', '-1', '1e2', 'Infinity', '1,20'])
      expect(() => scaled(value)).toThrow();
    expect(() =>
      calculateBudget(
        testBudget(),
        testPricing({ daily_rate: '9999999999999.99' }),
        2,
      ),
    ).toThrow();
  });
  it('allocates exact residual cents to the last installment and preserves end-of-month including leap years', () => {
    const p = paymentPlan(
      10001n,
      { mode: 'equal', count: 3, first_due_on: '2028-01-31' },
      '2026-10-27',
    );
    expect(p.rows.map((r) => r.amount)).toEqual(['33.33', '33.33', '33.35']);
    expect(p.rows.map((r) => r.due_on)).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
    ]);
    expect(p.rows.reduce((s, r) => s + scaled(r.percentage, 4), 0n)).toBe(
      1000000n,
    );
  });
  it('supports entry amounts, exact custom percentages and custom amounts/dates', () => {
    const a = paymentPlan(
      10001n,
      {
        mode: 'percentages',
        count: 3,
        entry_percent: '10',
        percentages: ['30', '30', '30'],
        first_due_on: '2027-01-31',
      },
      '2026-10-27',
    );
    expect(a.rows.map((r) => r.amount)).toEqual([
      '10.00',
      '30.00',
      '30.00',
      '30.01',
    ]);
    const b = paymentPlan(
      10001n,
      {
        mode: 'amounts',
        count: 2,
        entry_amount: '10.01',
        amounts: ['40.00', '50.00'],
        first_due_on: '2027-01-10',
        dates: ['2027-01-10', '2027-02-15'],
      },
      '2026-10-27',
    );
    expect(b.remaining_balance).toBe('0.00');
    expect(b.rows.at(-1)?.due_on).toBe('2027-02-15');
  });
  it('rejects incorrect percentages, entry above price, mismatched amounts and unordered dates', () => {
    for (const p of [
      {
        mode: 'percentages',
        count: 2,
        entry_percent: '10',
        percentages: ['30', '30'],
      },
      { mode: 'equal', count: 2, entry_amount: '101.00' },
      { mode: 'amounts', count: 2, amounts: ['50.00', '49.99'] },
      { mode: 'equal', count: 2, dates: ['2027-02-01', '2027-01-01'] },
    ])
      expect(() =>
        paymentPlan(10000n, { first_due_on: '2027-01-01', ...p }, '2026-10-27'),
      ).toThrow();
  });
  it('accepts full entry with no remaining installments and rejects impossible dates', () => {
    const p = paymentPlan(
      10001n,
      {
        mode: 'equal',
        count: 0,
        entry_percent: '100',
        first_due_on: '2027-01-31',
      },
      '2026-10-27',
    );
    expect(p.rows).toHaveLength(1);
    expect(p.financed_balance).toBe('0.00');
    expect(() =>
      paymentPlan(
        1n,
        { mode: 'equal', count: 1, first_due_on: '2027-02-30' },
        '2026-10-27',
      ),
    ).toThrow();
  });
});
