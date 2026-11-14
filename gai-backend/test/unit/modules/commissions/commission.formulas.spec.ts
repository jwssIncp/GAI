import {
  CommissionRuleError,
  commissionAmount,
  commissionStatus,
  partnerKey,
} from '../../../../src/modules/commissions/commission.formulas';

describe('Comissões: fórmulas (doc 06 §6.2)', () => {
  it('comissão = valor × % / 100, arredondada ao centavo; manual prevalece', () => {
    expect(commissionAmount('100000.00', '4.00', null)).toBe('4000.00');
    expect(commissionAmount('85350.00', '6.00', null)).toBe('5121.00');
    // 12.345,67 × 8% = 987,6536 → 987,65
    expect(commissionAmount('12345.67', '8.00', null)).toBe('987.65');
    // 1.000,00 × 3,33% = 33,30; 10,10 × 2,5% = 0,2525 → 0,25; 0,30 × 2,5% = 0,0075 → 0,01
    expect(commissionAmount('1000.00', '3.33', null)).toBe('33.30');
    expect(commissionAmount('10.10', '2.50', null)).toBe('0.25');
    expect(commissionAmount('0.30', '2.50', null)).toBe('0.01');
    // valor manual prevalece; apagar (null) volta ao cálculo
    expect(commissionAmount('100000.00', '4.00', '3500.00')).toBe('3500.00');
    expect(() => commissionAmount('100.00', '101.00', null)).toThrow(
      CommissionRuleError,
    );
    expect(() => commissionAmount('100,00', '4.00', null)).toThrow(
      CommissionRuleError,
    );
  });

  it('status automático: pago (com data) › atrasado (prevista passou) › pendente', () => {
    const today = '2026-11-13';
    expect(commissionStatus('2026-11-01', '2026-10-01', today)).toBe('paid');
    expect(commissionStatus(null, '2026-11-12', today)).toBe('overdue');
    expect(commissionStatus(null, '2026-11-13', today)).toBe('pending'); // vence hoje: ainda não atrasou
    expect(commissionStatus(null, null, today)).toBe('pending');
  });

  it('parceiro sem duplicar: mesma chave ignorando acento, caixa e espaços', () => {
    expect(partnerKey('João  da Silva', 'Ação Ltda')).toBe(
      partnerKey('joao da silva', ' ACAO LTDA '),
    );
    expect(partnerKey('João', null)).toBe(partnerKey('joão', ''));
    expect(partnerKey('João', 'A')).not.toBe(partnerKey('João', 'B'));
  });
});
