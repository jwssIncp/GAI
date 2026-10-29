import {
  balance,
  civil,
  decimal,
  plan,
  scaled,
} from '../../../../src/modules/receivables/receivable.policy';
import {
  aggregateCash,
  CashMovement,
} from '../../../../src/modules/receivables/cash-flow.service';
describe('Exact receivables and cash policy', () => {
  it('allocates residual cents without drift', () => {
    expect(
      plan(
        '100.00',
        { mode: 'equal', count: 3, first_due_on: '2026-01-31' },
        '2026-01-01',
      ).rows.map((r) => r.amount),
    ).toEqual(['33.33', '33.33', '33.34']);
  });
  it.each([
    ['2026-01-31', ['2026-01-31', '2026-02-28', '2026-03-31']],
    ['2028-01-31', ['2028-01-31', '2028-02-29', '2028-03-31']],
    ['2026-01-30', ['2026-01-30', '2026-02-28', '2026-03-30']],
  ])('preserves civil month policy %s', (first, dates) => {
    expect(
      plan(
        '10.00',
        { mode: 'equal', count: 3, first_due_on: first },
        '2026-01-01',
      ).rows.map((r) => r.due_on),
    ).toEqual(dates);
  });
  it('allocates entry and custom amounts exactly', () => {
    expect(
      plan(
        '100.00',
        {
          mode: 'amounts',
          count: 2,
          entry_amount: '10.00',
          entry_due_on: '2026-01-01',
          first_due_on: '2026-02-01',
          amounts: ['40.01', '49.99'],
          dates: ['2026-02-03', '2026-03-04'],
        },
        '2026-01-01',
      ).rows.map((r) => r.amount),
    ).toEqual(['10.00', '40.01', '49.99']);
  });
  it('supports percentages and a single installment', () => {
    expect(
      plan(
        '10.01',
        {
          mode: 'percentages',
          count: 2,
          first_due_on: '2026-01-01',
          percentages: ['50', '50'],
        },
        '2026-01-01',
      ).rows.map((r) => r.amount),
    ).toEqual(['5.01', '5.00']);
    expect(
      plan(
        '0.01',
        { mode: 'equal', count: 1, first_due_on: '2026-01-01' },
        '2026-01-01',
      ).rows[0].amount,
    ).toBe('0.01');
  });
  it('rejects invalid dates, zero rows and broken totals', () => {
    expect(() => civil('2026-02-29')).toThrow();
    expect(() =>
      plan(
        '0.01',
        { mode: 'equal', count: 3, first_due_on: '2026-01-01' },
        '2026-01-01',
      ),
    ).toThrow();
    expect(() =>
      plan(
        '10.00',
        {
          mode: 'amounts',
          count: 1,
          first_due_on: '2026-01-01',
          amounts: ['9.99'],
        },
        '2026-01-01',
      ),
    ).toThrow();
  });
  it('handles maximum decimal precision without floating arithmetic', () => {
    expect(decimal(scaled('9999999999999.99') + 1n)).toBe('10000000000000.00');
  });
  it('derives partial, paid and reversed balances', () => {
    expect(
      balance('10.00', [{ operation: 'receipt', amount: '3.33' }]),
    ).toEqual({ received: '3.33', open: '6.67', status: 'partial' });
    expect(
      balance('10.00', [{ operation: 'receipt', amount: '10.00' }]).status,
    ).toBe('paid');
    expect(
      balance('10.00', [
        { operation: 'receipt', amount: '10.00' },
        { operation: 'reversal', amount: '-10.00' },
      ]).status,
    ).toBe('open');
  });
  it('rejects inconsistent overpayment and negative net receipts', () => {
    expect(() =>
      balance('10.00', [{ operation: 'receipt', amount: '10.01' }]),
    ).toThrow();
    expect(() =>
      balance('10.00', [{ operation: 'reversal', amount: '-0.01' }]),
    ).toThrow();
  });
  const movement = (over: Partial<CashMovement>): CashMovement => ({
    source: 'receivable_event',
    source_id: 1,
    receivable_id: 1,
    installment_id: 1,
    company_id: 1,
    project_id: 1,
    contract_id: null,
    currency: 'BRL',
    direction: 'in',
    view: 'actual',
    on: '2026-10-01',
    amount: '10.01',
    description: 'SINTETICO',
    status: 'partial',
    overdue: false,
    ...over,
  });
  it('keeps actual, expected and reversal in their proper periods', () => {
    const a = aggregateCash([
      movement({}),
      movement({ source_id: 2, amount: '-3.33', on: '2026-11-01' }),
      movement({
        source: 'receivable_installment',
        source_id: 3,
        amount: '4.44',
        view: 'expected',
        overdue: true,
      }),
    ]);
    expect(a.totals[0]).toMatchObject({
      actual_in: '6.68',
      expected_in: '4.44',
      overdue: '4.44',
      projected_net: '11.12',
    });
    expect(a.monthly[1].actual_in).toBe('-3.33');
  });
  it('never nets unspecified outgoing currency against BRL or USD', () => {
    const a = aggregateCash([
      movement({}),
      movement({ currency: 'USD', amount: '1.00' }),
      movement({ currency: 'UNSPECIFIED', direction: 'out', amount: '2.00' }),
    ]);
    expect(a.totals).toHaveLength(3);
    expect(a.totals.find((t) => t.currency === 'BRL')?.actual_net).toBe(
      '10.01',
    );
    expect(a.totals.find((t) => t.currency === 'UNSPECIFIED')?.actual_net).toBe(
      '-2.00',
    );
  });
});
