import {
  compareSources,
  DEFAULT_MATCH_CONFIG as config,
  descriptionSimilarity,
  type MatchSource,
} from '../../../../src/modules/assisted-reconciliation/matching.policy';
const source = (v: Partial<MatchSource> = {}): MatchSource => ({
  id: 1,
  plate: null,
  serial: null,
  description: null,
  location: null,
  unit: null,
  version: 'v1',
  ...v,
});
describe('Conservative matching evidence', () => {
  it('matches normalized plate without changing identifiers or using monetary values', () => {
    const a = source({ plate: 'Ab-001', description: 'Motor elétrico' }),
      b = source({ plate: 'AB001', description: 'Mesa madeira' });
    const evidence = compareSources(a, b, config)!;
    expect(evidence.rule).toBe('exact_plate');
    expect(evidence.alerts[0]).toContain('Descrição');
    expect(a.plate).toBe('Ab-001');
  });
  it('compares series and explains a different plate', () => {
    const e = compareSources(
      source({ serial: 'SN-100', plate: '1' }),
      source({ serial: 'sn100', plate: '2' }),
      config,
    )!;
    expect(e.rule).toBe('exact_serial');
    expect(e.divergent).toContain('plate');
    expect(e.alerts.join()).toContain('placas divergem');
  });
  it('uses versioned conservative text thresholds and reliable exact location', () => {
    const a = source({
        description: 'Motor elétrico industrial trifásico',
        location: 'Galpão 1',
      }),
      b = source({
        description: 'Motor elétrico industrial trifásico novo',
        location: 'galpao 1',
      });
    expect(descriptionSimilarity(a.description, b.description)).toBe(0.8);
    expect(compareSources(a, b, config)).toBeNull();
    expect(
      compareSources(a, b, { ...config, localTextThreshold: 0.8 })?.rule,
    ).toBe('description_location');
    expect(
      compareSources(
        a,
        { ...b, location: 'Galpao 2' },
        { ...config, localTextThreshold: 0.8 },
      ),
    ).toBeNull();
  });
  it('does not match missing values, one generic word or location alone', () => {
    expect(compareSources(source(), source(), config)).toBeNull();
    expect(
      compareSources(
        source({ description: 'mesa' }),
        source({ description: 'mesa' }),
        config,
      ),
    ).toBeNull();
    expect(
      compareSources(
        source({ location: 'Sala 1' }),
        source({ location: 'Sala 1' }),
        config,
      ),
    ).toBeNull();
  });
  it('reports missing comparison evidence and not-found physical evidence', () => {
    const e = compareSources(
      source({ plate: '123', result: 'not_found' }),
      source({ plate: '123' }),
      config,
    )!;
    expect(e.missing).toContain('serial');
    expect(e.similarity).toBeNull();
    expect(e.alerts.join()).toContain('reinventário');
  });
});
