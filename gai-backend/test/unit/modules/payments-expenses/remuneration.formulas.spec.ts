import {
  daysInclusive,
  percentOf,
  remunerationTotals,
  RemunerationRuleError,
  weekdaysInclusive,
} from '../../../../src/modules/payments-expenses/domain/remuneration.formulas';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('Remuneração: fórmulas (doc 06 §2.3)', () => {
  it('dias = fim − início + 1 (conta os dois extremos)', () => {
    expect(daysInclusive(d('2026-11-03'), d('2026-11-07'))).toBe(5);
    expect(daysInclusive(d('2026-11-03'), d('2026-11-03'))).toBe(1);
    expect(daysInclusive(d('2026-02-27'), d('2026-03-02'))).toBe(4); // virada de mês
    expect(() => daysInclusive(d('2026-11-07'), d('2026-11-03'))).toThrow(
      RemunerationRuleError,
    );
  });

  it('dias úteis: só de segunda a sexta, contando os dois extremos', () => {
    // 03/11/2026 é terça
    expect(weekdaysInclusive(d('2026-11-03'), d('2026-11-07'))).toBe(4); // ter–sáb
    expect(weekdaysInclusive(d('2026-11-02'), d('2026-11-08'))).toBe(5); // semana cheia
    expect(weekdaysInclusive(d('2026-11-07'), d('2026-11-08'))).toBe(0); // sáb–dom
    expect(weekdaysInclusive(d('2026-11-06'), d('2026-11-09'))).toBe(2); // sex–seg
    expect(weekdaysInclusive(d('2026-05-25'), d('2026-06-05'))).toBe(10); // caso do Netlify
    expect(weekdaysInclusive(d('2026-11-04'), d('2026-11-04'))).toBe(1);
    expect(weekdaysInclusive(d('2026-11-01'), d('2026-11-30'))).toBe(21);
    expect(() => weekdaysInclusive(d('2026-11-07'), d('2026-11-03'))).toThrow(
      RemunerationRuleError,
    );
  });

  it('total = dias × diária + adicional; final = total − descontos (5 × 185 + 50 − 30)', () => {
    expect(
      remunerationTotals({
        days: 5,
        dailyRate: '185.00',
        additionalAmount: '50.00',
        discountAmount: '30.00',
      }),
    ).toEqual({
      dailyTotal: '925.00',
      totalAmount: '975.00',
      finalAmount: '945.00',
      totalManual: false,
    });
  });

  it('mudar as datas recalcula COM o adicional (bug do INVESTOR l.1440 não replicado)', () => {
    const before = remunerationTotals({
      days: 5,
      dailyRate: '185.00',
      additionalAmount: '120.00',
      discountAmount: '0',
    });
    const after = remunerationTotals({
      days: daysInclusive(d('2026-11-03'), d('2026-11-09')),
      dailyRate: '185.00',
      additionalAmount: '120.00',
      discountAmount: '0',
    });
    expect(before.totalAmount).toBe('1045.00'); // 5 × 185 + 120
    expect(after.totalAmount).toBe('1415.00'); // 7 × 185 + 120
  });

  it('total manual substitui o calculado e fica marcado', () => {
    expect(
      remunerationTotals({
        days: 5,
        dailyRate: '185.00',
        additionalAmount: '50.00',
        discountAmount: '100.00',
        manualTotal: '1000.00',
      }),
    ).toEqual({
      dailyTotal: '925.00',
      totalAmount: '1000.00',
      finalAmount: '900.00',
      totalManual: true,
    });
  });

  it('centavos exatos, sem erro de ponto flutuante (3 × 33,33 + 0,01)', () => {
    expect(
      remunerationTotals({
        days: 3,
        dailyRate: '33.33',
        additionalAmount: '0.01',
        discountAmount: '0.00',
      }).totalAmount,
    ).toBe('100.00');
    expect(
      remunerationTotals({
        days: 1,
        dailyRate: '0.10',
        additionalAmount: '0.20',
        discountAmount: '0',
      }).finalAmount,
    ).toBe('0.30');
  });

  it('valores grandes sem perda de precisão', () => {
    expect(
      remunerationTotals({
        days: 365,
        dailyRate: '9999999999.99',
        additionalAmount: '0',
        discountAmount: '0',
      }).totalAmount,
    ).toBe('3649999999996.35');
  });

  it('descontos maiores que o total são recusados', () => {
    expect(() =>
      remunerationTotals({
        days: 1,
        dailyRate: '185.00',
        additionalAmount: '0',
        discountAmount: '185.01',
      }),
    ).toThrow('Os descontos não podem ser maiores que o total.');
  });

  it('% de despesas de técnicos: 3.000 / 10.000 = 30,00%; base ≤ 0 = sem percentual', () => {
    expect(percentOf('3000.00', '10000.00')).toBe('30.00');
    expect(percentOf('1.00', '3.00')).toBe('33.33');
    expect(percentOf('2.00', '3.00')).toBe('66.67');
    expect(percentOf('100.00', '0.00')).toBeNull();
  });
});
