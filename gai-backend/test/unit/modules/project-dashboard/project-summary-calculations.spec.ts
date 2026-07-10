import {
  calculateProgressPercentage,
  sumMoney,
} from '../../../../src/modules/project-dashboard/application/services/project-summary-calculations';

describe('Project summary calculations', () => {
  it('calculates inventory progress and avoids division by zero', () => {
    expect(calculateProgressPercentage(0, 0)).toBe(0);
    expect(calculateProgressPercentage(75, 100)).toBe(75);
    expect(calculateProgressPercentage(1, 3)).toBe(33.33);
    expect(calculateProgressPercentage(5, 5)).toBe(100);
  });

  it('sums money as fixed decimal strings', () => {
    expect(sumMoney('5000.00', '1200.00')).toBe('6200.00');
    expect(sumMoney('0.10', '0.20')).toBe('0.30');
    expect(sumMoney('', '2')).toBe('2.00');
  });
});
