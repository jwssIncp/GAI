import { monthlyDueDate } from '../../../../src/modules/expense-accountabilities/monthly-due-date.policy';

describe('Monthly due dates', () => {
  it.each([
    ['2026-01-31', ['2026-01-31', '2026-02-28', '2026-03-31']],
    ['2028-01-31', ['2028-01-31', '2028-02-29', '2028-03-31']],
    ['2026-01-30', ['2026-01-30', '2026-02-28', '2026-03-30']],
    ['2028-01-29', ['2028-01-29', '2028-02-29', '2028-03-29']],
    ['2026-01-29', ['2026-01-29', '2026-02-28', '2026-03-29']],
    ['2028-02-29', ['2028-02-29', '2028-03-31', '2028-04-30']],
    ['2026-02-28', ['2026-02-28', '2026-03-31', '2026-04-30']],
    ['2026-04-30', ['2026-04-30', '2026-05-31', '2026-06-30']],
    ['2026-12-31', ['2026-12-31', '2027-01-31', '2027-02-28']],
  ])('derives dates from %s without overflow or drift', (origin, expected) => {
    const date = new Date(`${origin}T00:00:00Z`);
    expect(
      expected.map((_, i) =>
        monthlyDueDate(date, i).toISOString().slice(0, 10),
      ),
    ).toEqual(expected);
    expect(date.toISOString().slice(0, 10)).toBe(origin);
  });
  it.each([1, 2, 12, 24, 36])(
    'handles %i installments across years',
    (count) => {
      const origin = new Date('2027-01-31T00:00:00Z');
      for (let i = 0; i < count; i++) {
        const due = monthlyDueDate(origin, i);
        const last = new Date(
          Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0),
        );
        expect(due).toEqual(last);
        expect(due.getUTCFullYear() * 12 + due.getUTCMonth()).toBe(
          2027 * 12 + i,
        );
      }
    },
  );
});
