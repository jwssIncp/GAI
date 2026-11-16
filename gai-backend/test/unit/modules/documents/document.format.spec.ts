import {
  currencySymbol,
  documentDate,
  documentDecimal,
  documentInteger,
  documentMoney,
  documentNumber,
  documentPercent,
} from '../../../../src/modules/documents/document.format';

describe('Formatos pt-BR dos documentos', () => {
  it('moeda: símbolo pt-BR, milhar com ponto e centavos com vírgula, sem float', () => {
    expect(documentMoney('1913.72', 'BRL')).toBe('R$ 1.913,72');
    expect(documentMoney('1913.7', 'BRL')).toBe('R$ 1.913,70');
    expect(documentMoney('0', 'BRL')).toBe('R$ 0,00');
    expect(documentMoney('9999999999999.99', 'BRL')).toBe(
      'R$ 9.999.999.999.999,99',
    );
    expect(documentMoney('-10.00', 'BRL')).toBe('-R$ 10,00');
    expect(documentMoney('1913.72', 'USD')).toBe('US$ 1.913,72');
    expect(documentMoney('1913.72', 'EUR')).toBe('€ 1.913,72');
    expect(currencySymbol('XYZ1')).toBe('XYZ1');
  });
  it('percentual com 2 casas (ou as pedidas)', () => {
    expect(documentPercent('10.00')).toBe('10,00%');
    expect(documentPercent('12.5')).toBe('12,50%');
    expect(documentPercent('33.3333', 4)).toBe('33,3333%');
    expect(documentPercent('33.335')).toBe('33,34%');
  });
  it('decimal mantém as casas do dado ou arredonda meio para cima na string', () => {
    expect(documentDecimal('1.0000')).toBe('1,0000');
    expect(documentDecimal('1234.5', 2)).toBe('1.234,50');
    expect(documentDecimal('0.995', 2)).toBe('1,00');
    expect(documentDecimal('-0.001', 2)).toBe('0,00');
    expect(documentDecimal('99999999999999.995', 2)).toBe(
      '100.000.000.000.000,00',
    );
    expect(documentDecimal('texto')).toBe('texto');
  });
  it('inteiro com milhar e indicadores numéricos', () => {
    expect(documentInteger(1000)).toBe('1.000');
    expect(documentInteger(12)).toBe('12');
    expect(documentInteger('1234567')).toBe('1.234.567');
    expect(documentNumber(1500)).toBe('1.500');
    expect(documentNumber(2.5)).toBe('2,5');
    expect(documentNumber('PAT-1000')).toBe('PAT-1000');
  });
  it('data civil dd/mm/aaaa sem fuso', () => {
    expect(documentDate('2026-10-28')).toBe('28/10/2026');
    expect(documentDate(new Date('2026-10-28T12:00:00Z'))).toBe('28/10/2026');
  });
});
