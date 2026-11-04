import { DocumentRendererService } from '../../../../src/modules/documents/document-renderer.service';
import {
  DEFAULT_VISUAL,
  ProfessionalDocument,
} from '../../../../src/modules/documents/document.contract';
describe('Isolated native render worker', () => {
  const model = (): ProfessionalDocument => ({
    title: 'SINTETICO Concorrência',
    subtitle: '',
    date: '28/10/2026',
    version: '1',
    status: 'Aprovado',
    sourceHash: 'a'.repeat(64),
    visual: { ...DEFAULT_VISUAL },
    blocks: [{ title: 'Conteúdo', paragraphs: ['Acentuação · patrimônio'] }],
  });
  it('bounds concurrent workers and recovers capacity after completion', async () => {
    const renderer = new DocumentRendererService();
    try {
      const a = renderer.render(model(), 'pdf'),
        b = renderer.render(model(), 'docx');
      await expect(renderer.render(model(), 'pdf')).rejects.toThrow('ocupada');
      const [pdf, word] = await Promise.all([a, b]);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(word.subarray(0, 2).toString()).toBe('PK');
      expect((await renderer.render(model(), 'pdf')).length).toBeGreaterThan(
        1000,
      );
    } finally {
      renderer.onModuleDestroy();
    }
  });
  it('refuses oversized inputs before allocating a worker', async () => {
    const renderer = new DocumentRendererService(),
      doc = model();
    doc.blocks[0].paragraphs = ['x'.repeat(3 * 1024 * 1024)];
    await expect(renderer.render(doc, 'pdf')).rejects.toThrow('3 MB');
  });
});
