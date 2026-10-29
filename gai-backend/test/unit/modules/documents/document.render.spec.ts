import { PDFDocument } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';
import {
  renderDocument,
  validateDocument,
} from '../../../../src/modules/documents/document.render';
import {
  reportDocument,
  documentDate,
  documentMoney,
} from '../../../../src/modules/documents/document.builder';
import {
  DEFAULT_VISUAL,
  ProfessionalDocument,
} from '../../../../src/modules/documents/document.contract';
import { contentFixture } from '../technical-reports/report.fixtures';
import type { TechnicalReportVersion } from '../../../../src/modules/technical-reports/report.entity';
describe('Native professional document renderers', () => {
  const model = (): ProfessionalDocument => ({
    title: 'Laudo sintético · Conciliação e avaliação',
    subtitle: 'Patrimônio São Luís',
    date: '28/10/2026',
    version: 'Revisão 4',
    status: 'Versão aprovada preservada',
    sourceHash: 'a'.repeat(64),
    visual: { ...DEFAULT_VISUAL },
    blocks: [
      {
        title: 'Resultado técnico',
        paragraphs: ['João · ação · patrimônio · R$ 1.234,56 · 28/10/2026'],
      },
      {
        title: 'Bens',
        table: {
          columns: ['Placa', 'Descrição', 'Valor'],
          rows: Array.from({ length: 180 }, (_, i) => [
            `PAT-${i}`,
            `Máquina de precisão ${i}`,
            'BRL 1.234,56',
          ]),
        },
      },
    ],
  });
  it('generates a real multipage A4 PDF without a logo', async () => {
    const bytes = await renderDocument(model(), 'pdf');
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(4);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
  });
  it('creates editable OOXML with native tables, headings, header, footer and page fields', async () => {
    const zip = unzipSync(await renderDocument(model(), 'docx'));
    const doc = strFromU8(zip['word/document.xml']);
    expect(doc).toContain('Máquina de precisão 179');
    expect(doc).toContain('<w:tbl>');
    expect(doc).toContain('w:tblHeader');
    expect(doc).toContain('Heading1');
    expect(doc).toContain('BRL 1.234,56');
    expect(strFromU8(zip['word/footer1.xml'])).toMatch(/PAGE/);
    expect(strFromU8(zip['word/footer1.xml'])).toContain('NUMPAGES');
    expect(Object.keys(zip).some((k) => k.endsWith('.html'))).toBe(false);
  });
  it('uses approved frozen fields and selected source tables without mutating content', () => {
    const data = contentFixture(),
      before = JSON.stringify(data);
    const doc = reportDocument({
      id: 9,
      reportId: 1,
      projectId: 1,
      revision: 4,
      data,
      hash: 'a'.repeat(64),
      recordedAt: new Date('2026-10-28T12:00:00Z'),
      validation: { issues: [] },
    } as unknown as TechnicalReportVersion);
    expect(JSON.stringify(doc)).toContain('Projeto SINTETICO Projeto');
    expect(JSON.stringify(doc)).not.toContain('{{projeto}}');
    expect(JSON.stringify(data)).toBe(before);
    expect(doc.visual.version).toBe('gai-a4-v1');
  });
  it('preserves exact large monetary amounts and civil dates across timezones', () => {
    expect(documentMoney('9999999999999.99', 'BRL')).toBe(
      'BRL 9.999.999.999.999,99',
    );
    expect(documentDate('2026-10-28')).toBe('28/10/2026');
  });
  it('rejects renamed HTML, invalid PDF and invalid Office packages', async () => {
    await expect(
      validateDocument(Buffer.from('<html>fake</html>'), 'pdf'),
    ).rejects.toThrow();
    await expect(
      validateDocument(Buffer.from('<html>fake</html>'), 'docx'),
    ).rejects.toThrow();
    await expect(
      validateDocument(Buffer.from('%PDF-fake\n%%EOF'), 'pdf'),
    ).rejects.toThrow();
  });
});
