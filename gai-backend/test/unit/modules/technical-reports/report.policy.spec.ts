import {
  plain,
  renderSection,
  reportValidation,
  validateTemplate,
} from '../../../../src/modules/technical-reports/report.policy';
import { contentFixture, templateFixture } from './report.fixtures';
import { documentHash } from '../../../../src/modules/technical-reports/report.hash';
describe('Technical report documentary policy', () => {
  it('preserves checksums across MySQL JSON key reordering', () => {
    expect(documentHash({ b: 2, a: { y: 1, x: 0 } })).toBe(
      documentHash({ a: { x: 0, y: 1 }, b: 2 }),
    );
  });
  it('validates an explicitly configured report without inventing credentials', () => {
    const r = reportValidation(contentFixture(), 'source-hash');
    expect(r.valid).toBe(true);
    expect(r.issues).toContainEqual(
      expect.objectContaining({
        code: 'INTERNAL_APPROVAL',
        severity: 'warning',
      }),
    );
  });
  it('blocks required sections, dynamic fields and responsible profiles', () => {
    const c = contentFixture();
    c.sections[1].text = '';
    c.fields[0].value = '';
    c.responsibles = [];
    const r = reportValidation(c, 'source-hash');
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'SECTION_REQUIRED',
        'FIELD_REQUIRED',
        'DYNAMIC_FIELD_EMPTY',
        'RESPONSIBLE_REQUIRED',
      ]),
    );
  });
  it('distinguishes configurable warnings from universal blockers', () => {
    const c = contentFixture();
    c.sources.unresolved = 2;
    c.sources.missing = ['valuation.currency'];
    expect(reportValidation(c, 'source-hash').valid).toBe(true);
    c.template.data.rules.unresolved_divergences = 'block';
    expect(reportValidation(c, 'source-hash').valid).toBe(false);
  });
  it('requires professional data only when the published model explicitly requires it', () => {
    const c = contentFixture();
    c.template.data.rules.professional_registration_required = true;
    expect(
      reportValidation(c, 'source-hash').issues.some(
        (i) => i.code === 'REGISTRATION_REQUIRED',
      ),
    ).toBe(true);
  });
  it('blocks stale sources by policy while preserving the extracted snapshot', () => {
    const c = contentFixture();
    expect(reportValidation(c, 'new-hash').valid).toBe(false);
    expect(c.sources.hash).toBe('source-hash');
  });
  it('requires valuation and reconciliation only for applicable models', () => {
    const c = contentFixture();
    c.template.data.rules.valuation_required = true;
    c.template.data.rules.reconciliation_required = true;
    expect(
      reportValidation(c, 'source-hash').issues.map((i) => i.code),
    ).toEqual(
      expect.arrayContaining(['VALUATION_REQUIRED', 'RECONCILIATION_REQUIRED']),
    );
  });
  it('rejects active HTML, controls and undefined placeholders', () => {
    expect(() => plain('<script>alert(1)</script>')).toThrow();
    expect(() => plain('x\u0000')).toThrow();
    const t = templateFixture();
    t.sections[0].text = '{{undefined_key}}';
    expect(() => validateTemplate(t)).toThrow();
  });
  it('renders known dynamic text and identifies missing fields without code evaluation', () => {
    const c = contentFixture();
    expect(renderSection('Projeto {{projeto}}', c.fields)).toBe(
      'Projeto SINTETICO Projeto',
    );
    expect(renderSection('{{ausente}}', c.fields)).toBe('[não preenchido]');
  });
  it('rejects duplicate structural keys', () => {
    const t = templateFixture();
    t.sections.push(t.sections[0]);
    expect(() => validateTemplate(t)).toThrow();
  });
});
