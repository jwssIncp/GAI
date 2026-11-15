import { parseAmount } from '../../../../src/modules/managerial-dre/dre-monthly-commands.service';

describe('importação da DRE: leitura de valores', () => {
  it('aceita padrão brasileiro, número do Excel, negativos e vazio (= 0)', () => {
    expect(parseAmount('1.234,56')).toBe(123456n);
    expect(parseAmount('-15.010,34')).toBe(-1501034n);
    expect(parseAmount('(500,00)')).toBe(-50000n);
    expect(parseAmount('R$ 10.915,00')).toBe(1091500n);
    expect(parseAmount(1234.5)).toBe(123450n);
    expect(parseAmount('1234.56')).toBe(123456n);
    expect(parseAmount('1.000')).toBe(100000n);
    expect(parseAmount('')).toBe(0n);
    expect(parseAmount(null)).toBe(0n);
  });
  it('recusa texto que não é número', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('12,3,4')).toBeNull();
  });
});
