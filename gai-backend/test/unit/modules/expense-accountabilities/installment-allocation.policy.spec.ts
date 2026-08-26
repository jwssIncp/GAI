import { InstallmentAllocationPolicy } from '../../../../src/modules/expense-accountabilities/installment-allocation.policy';
describe('InstallmentAllocationPolicy', () => {
  it('preserves every cent when the amount is not evenly divisible', () => {
    const result = InstallmentAllocationPolicy.allocate('100.00', 3);
    expect(result).toEqual(['33.34', '33.33', '33.33']);
    expect(
      result.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0),
    ).toBe(10000);
  });
  it('supports installments smaller than one cent per part', () => {
    expect(InstallmentAllocationPolicy.allocate('0.02', 3)).toEqual([
      '0.01',
      '0.01',
      '0.00',
    ]);
  });
  it.each([
    ['0.01', 3, ['0.01', '0.00', '0.00']],
    ['10.00', 6, ['1.67', '1.67', '1.67', '1.67', '1.66', '1.66']],
    [
      '1000000.99',
      12,
      [
        '83333.42',
        '83333.42',
        '83333.42',
        '83333.42',
        '83333.42',
        '83333.42',
        '83333.42',
        '83333.41',
        '83333.41',
        '83333.41',
        '83333.41',
        '83333.41',
      ],
    ],
  ])(
    'allocates %s across %i installments exactly',
    (amount, count, expected) => {
      const result = InstallmentAllocationPolicy.allocate(amount, count);
      expect(result).toEqual(expected);
      expect(
        result.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0),
      ).toBe(Math.round(Number(amount) * 100));
    },
  );
});
