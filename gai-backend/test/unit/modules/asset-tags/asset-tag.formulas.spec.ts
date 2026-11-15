import {
  AssetTagRuleError,
  assetTagExpenseType,
  assetTagTotals,
  normalizeCivilDate,
  sequenceQuantity,
  settlementDate,
} from '../../../../src/modules/asset-tags/asset-tag.formulas';

describe('Placas de patrimônio: fórmulas (doc 06 §5.2)', () => {
  it('quantidade pela sequência: fim − início + 1; final < inicial é sinalizado', () => {
    expect(sequenceQuantity(1001, 2000)).toEqual({
      quantity: 1000,
      error: null,
    });
    expect(sequenceQuantity(5, 5)).toEqual({ quantity: 1, error: null });
    expect(sequenceQuantity(2000, 1001).error).toMatch(/final é menor/);
    expect(sequenceQuantity(0, 10).error).toMatch(/positivos/);
    expect(sequenceQuantity(null, 10)).toEqual({ quantity: null, error: null });
  });

  it('custo, valor, líquido com o % de impostos dos parâmetros e lucro', () => {
    // 1.000 placas × R$ 0,85 = 850,00; × R$ 2,50 = 2.500,00;
    // líquido = 2.500 × 0,84 = 2.100,00; lucro = 2.100 − 850 = 1.250,00
    expect(
      assetTagTotals({
        quantity: 1000,
        unitCost: '0.85',
        unitPrice: '2.50',
        taxPct: '16.00',
      }),
    ).toEqual({
      cost_total: '850.00',
      value_total: '2500.00',
      net_value: '2100.00',
      net_profit: '1250.00',
    });
    // Frações de centavo: 333 × R$ 0,345 = 114,885 → 114,89 (meio para cima)
    // 333 × R$ 0,40 = 133,20; líquido 133,20 × 0,8667 (13,33%) = 115,444… → 115,44
    expect(
      assetTagTotals({
        quantity: 333,
        unitCost: '0.345',
        unitPrice: '0.40',
        taxPct: '13.33',
      }),
    ).toEqual({
      cost_total: '114.89',
      value_total: '133.20',
      net_value: '115.44',
      net_profit: '0.55',
    });
    // Prejuízo: lucro negativo
    expect(
      assetTagTotals({
        quantity: 100,
        unitCost: '3.00',
        unitPrice: '3.00',
        taxPct: '16.00',
      }).net_profit,
    ).toBe('-48.00');
    // Sem parâmetros: líquido e lucro ficam nulos (não inventa 16%)
    expect(
      assetTagTotals({
        quantity: 10,
        unitCost: '1.00',
        unitPrice: '2.00',
        taxPct: null,
      }),
    ).toEqual({
      cost_total: '10.00',
      value_total: '20.00',
      net_value: null,
      net_profit: null,
    });
    expect(() =>
      assetTagTotals({
        quantity: 1,
        unitCost: '1,00',
        unitPrice: '1',
        taxPct: '16',
      }),
    ).toThrow(AssetTagRuleError);
  });

  it('tipo de despesa pelo "Plaquetas por conta de"; alteração manual prevalece', () => {
    expect(assetTagExpenseType(['client'], null)).toBe('reimbursable');
    expect(assetTagExpenseType(['company'], null)).toBe('non_reimbursable');
    expect(assetTagExpenseType(['client', 'company'], null)).toBeNull();
    expect(assetTagExpenseType([null], null)).toBeNull();
    expect(assetTagExpenseType(['client'], 'non_reimbursable')).toBe(
      'non_reimbursable',
    );
  });

  it('ano com 2 dígitos vira 20xx; data impossível é recusada', () => {
    expect(normalizeCivilDate('0026-05-10')).toBe('2026-05-10');
    expect(normalizeCivilDate('2026-02-28')).toBe('2026-02-28');
    expect(normalizeCivilDate('')).toBeNull();
    expect(() => normalizeCivilDate('2026-02-30')).toThrow(AssetTagRuleError);
  });

  it('recebido/pago com data: data → sim; sim sem data → hoje; não → limpa', () => {
    const today = '2026-11-13';
    expect(settlementDate(undefined, '2026-11-01', null, today)).toBe(
      '2026-11-01',
    );
    expect(settlementDate(true, undefined, null, today)).toBe(today);
    expect(settlementDate(true, undefined, '2026-10-01', today)).toBe(
      '2026-10-01',
    );
    expect(settlementDate(true, null, null, today)).toBe(today);
    expect(settlementDate(false, undefined, '2026-10-01', today)).toBeNull();
    expect(settlementDate(undefined, undefined, '2026-10-01', today)).toBe(
      '2026-10-01',
    );
    expect(settlementDate(undefined, '0026-11-02', null, today)).toBe(
      '2026-11-02',
    );
  });
});
