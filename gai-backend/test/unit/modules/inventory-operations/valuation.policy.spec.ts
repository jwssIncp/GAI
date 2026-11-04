import {
  valuationValues,
  valuationBatchLimit,
} from '../../../../src/modules/inventory-operations/application/valuation.policy';
describe('Shared individual and batch valuation policy', () => {
  const dto = {
    source: ' Catalogo documentado ',
    valuation_date: '2026-10-27',
    new_value: '123.45',
    used_value: null,
    notes: ' nota ',
  };
  it('keeps decimal strings, zero and civil dates without mutating a master record', () => {
    expect(valuationValues(dto)).toMatchObject({
      source: 'Catalogo documentado',
      valuationDate: '2026-10-27',
      newValue: '123.45',
      usedValue: null,
      notes: 'nota',
    });
    expect(valuationValues({ ...dto, new_value: '0.00' }).newValue).toBe(
      '0.00',
    );
  });
  it.each([
    '0001-01-01',
    '2026-02-30',
    '2026-10-27T12:00:00Z',
    '2026-13-01',
    '',
  ])('rejects invalid or non-civil date %s', (date) =>
    expect(() => valuationValues({ ...dto, valuation_date: date })).toThrow(),
  );
  it.each(['-1', '1.234', '12,50', '1e3', ''])(
    'rejects invalid money %s',
    (value) =>
      expect(() => valuationValues({ ...dto, new_value: value })).toThrow(),
  );
  it('requires a documented source and at least one value', () => {
    expect(() => valuationValues({ ...dto, source: '  ' })).toThrow();
    expect(() => valuationValues({ ...dto, new_value: null })).toThrow();
  });
  it('bounds configured synchronous limits', () => {
    expect(valuationBatchLimit(undefined)).toBe(100);
    expect(valuationBatchLimit('25')).toBe(25);
    expect(() => valuationBatchLimit(501)).toThrow();
    expect(() => valuationBatchLimit(0)).toThrow();
  });
});
