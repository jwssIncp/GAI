import PdfPrinter from 'pdfmake';
import fontFiles from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableLayoutType,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { PDFDocument } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';
import {
  DOCUMENT_ENGINE,
  DocumentFormat,
  MAX_DOCUMENT_BYTES,
  ProfessionalDocument,
} from './document.contract';
// Bundled Roboto 3.014 is licensed under SIL OFL-1.1 (see third-party notice).
// Never fetch fonts,
// logos, HTML, URLs or filesystem paths supplied by a tenant.
const vfs = fontFiles as unknown as Record<string, string>;
function tableLayout(columns: string[], rows: string[][]) {
  const fontSize = columns.length > 8 ? 8 : 9;
  const weights = columns.map((c) =>
    /descri|notas|observa/i.test(c)
      ? 2.5
      : /^(projeto|empresa)$/i.test(c)
        ? 1.7
        : /\bID\b/i.test(c)
          ? 0.65
          : 1,
  );
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (495 * w) / total);
  const pdfWidths = weights.map(
    (w) => ((507.28 - 8 * columns.length) * w) / total,
  );
  // Very tall cells must remain splittable; regular rows stay together.
  const fits = (row: string[]) =>
    row.every((text, i) => {
      const chars = Math.max(
        1,
        Math.floor((pdfWidths[i] - 8) / (fontSize * 0.6)),
      );
      const lines = text
        .split('\n')
        .reduce(
          (n, line) => n + Math.max(1, Math.ceil(line.length / chars)),
          0,
        );
      return lines * fontSize * 1.3 < 560;
    });
  return { fontSize, widths, pdfWidths, keepRows: rows.every(fits), fits };
}
export async function renderDocument(
  model: ProfessionalDocument,
  format: DocumentFormat,
): Promise<Buffer> {
  const result =
    format === 'pdf' ? await renderPdf(model) : await renderDocx(model);
  await validateDocument(result, format);
  return result;
}
export async function validateDocument(bytes: Buffer, format: DocumentFormat) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES)
    throw new Error('DOCUMENT_SIZE');
  if (format === 'pdf') {
    if (
      bytes.subarray(0, 5).toString() !== '%PDF-' ||
      !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))
    )
      throw new Error('DOCUMENT_INVALID_PDF');
    const pdf = await PDFDocument.load(bytes);
    if (!pdf.getPageCount() || pdf.getPageCount() > 500)
      throw new Error('DOCUMENT_PAGE_LIMIT');
  } else {
    const zip = unzipSync(bytes);
    for (const name of [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/styles.xml',
      'word/header1.xml',
      'word/footer1.xml',
    ])
      if (!zip[name]?.length) throw new Error('DOCUMENT_INVALID_DOCX');
    for (const [name, value] of Object.entries(zip)) {
      if (
        name.endsWith('.rels') &&
        /TargetMode="External"|vbaProject|attachedTemplate/.test(
          strFromU8(value),
        )
      )
        throw new Error('DOCUMENT_EXTERNAL_RELATIONSHIP');
    }
    if (!strFromU8(zip['word/document.xml']).includes('<w:document'))
      throw new Error('DOCUMENT_INVALID_OOXML');
  }
}
async function renderPdf(m: ProfessionalDocument): Promise<Buffer> {
  const font =
    m.visual.font === 'Times'
      ? {
          normal: 'Times-Roman',
          bold: 'Times-Bold',
          italics: 'Times-Italic',
          bolditalics: 'Times-BoldItalic',
        }
      : {
          normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
          bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
          italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
          bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
        };
  const content: Content[] = [];
  if (m.visual.logo_png)
    content.push({
      image: m.visual.logo_png,
      fit: [130, 70],
      margin: [0, 0, 0, 20],
    });
  content.push(
    {
      text: m.visual.organization_name,
      color: m.visual.primary_color,
      fontSize: 14,
      bold: true,
      margin: [0, 0, 0, 24],
    },
    { text: m.subtitle, fontSize: 12 },
    {
      text: m.title,
      fontSize: 28,
      bold: true,
      color: m.visual.primary_color,
      margin: [0, 16, 0, 24],
    },
    { text: m.visual.institutional, margin: [0, 0, 0, 24] },
    {
      text: `${m.status}\n${m.version}\nData: ${m.date}\nModelo visual: ${m.visual.version}`,
      fontSize: 10,
      margin: [0, 0, 0, 18],
    },
  );
  if (m.visual.cover)
    content.push({
      text: 'Conteúdo do documento',
      pageBreak: 'before',
      fontSize: 16,
      bold: true,
      margin: [0, 0, 0, 12],
    });
  for (const block of m.blocks) {
    content.push({ text: block.title, style: 'heading' });
    for (const p of block.paragraphs ?? [])
      if (p) content.push({ text: p, margin: [0, 0, 0, 8] });
    if (block.table?.columns.length) {
      const t = block.table;
      const layout = tableLayout(t.columns, t.rows);
      content.push({
        table: {
          headerRows: 1,
          widths: layout.pdfWidths,
          dontBreakRows: layout.keepRows,
          keepWithHeaderRows: layout.keepRows ? 1 : 0,
          body: [
            t.columns.map((text) => ({
              text,
              bold: true,
              fillColor: m.visual.primary_color,
              color: '#FFFFFF',
            })),
            ...(t.rows.length
              ? t.rows
              : [
                  t.columns.map((_, i) =>
                    i ? '' : 'Sem registros no recorte',
                  ),
                ]),
          ],
        },
        fontSize: layout.fontSize,
        margin: [0, 4, 0, 16],
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === node.table.body.length ? 0 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#CBD5E1',
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      });
    }
  }
  content.push({
    text: `Versão SHA-256: ${m.sourceHash}`,
    fontSize: 8,
    margin: [0, 16, 0, 0],
  });
  const definition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [44, 64, 44, 64],
    content,
    info: {
      title: m.title,
      author: m.visual.organization_name,
      creator: DOCUMENT_ENGINE,
    },
    defaultStyle: {
      font: 'DocumentFont',
      fontSize: 10,
      lineHeight: 1.25,
      color: '#1E293B',
    },
    styles: {
      heading: {
        fontSize: 15,
        bold: true,
        color: m.visual.primary_color,
        margin: [0, 16, 0, 10],
      },
    },
    header: {
      text: m.visual.header,
      font: 'DocumentFont',
      fontSize: 9,
      color: '#475569',
      margin: [44, 28, 44, 0],
    },
    footer: (page, total) => ({
      columns: [
        { text: m.visual.footer, width: '*' },
        { text: `${page} / ${total}`, width: 65, alignment: 'right' },
      ],
      font: 'DocumentFont',
      fontSize: 8,
      margin: [44, 24, 44, 0],
    }),
    pageBreakBefore: (node, following) =>
      node.style === 'heading' && following.length === 0,
  };
  const doc = new PdfPrinter({ DocumentFont: font }).createPdfKitDocument(
    definition,
  );
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    doc.on('data', (b: Buffer) => {
      total += b.length;
      if (total > MAX_DOCUMENT_BYTES) {
        doc.destroy();
        reject(new Error('DOCUMENT_SIZE'));
      } else chunks.push(b);
    });
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}
async function renderDocx(m: ProfessionalDocument): Promise<Buffer> {
  const color = m.visual.primary_color.slice(1),
    font = m.visual.font === 'Times' ? 'Times New Roman' : 'Arial';
  const paragraph = (text: string) =>
    new Paragraph({
      children: text
        .split('\n')
        .flatMap((line, i) => [
          new TextRun({ text: line, break: i ? 1 : undefined }),
        ]),
      spacing: { after: 160 },
    });
  const children: (Paragraph | Table)[] = [];
  if (m.visual.logo_png) {
    const b = Buffer.from(m.visual.logo_png.split(',')[1], 'base64'),
      w = b.readUInt32BE(16),
      h = b.readUInt32BE(20),
      scale = Math.min(160 / w, 80 / h);
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: b,
            transformation: {
              width: Math.round(w * scale),
              height: Math.round(h * scale),
            },
            altText: {
              title: 'Logotipo da organização',
              description: m.visual.organization_name,
              name: 'Logotipo',
            },
          }),
        ],
      }),
    );
  }
  children.push(
    paragraph(m.visual.organization_name),
    new Paragraph({ text: m.title, heading: HeadingLevel.TITLE }),
    paragraph(m.subtitle),
    paragraph(m.visual.institutional),
    paragraph(
      `${m.status}\n${m.version}\nData: ${m.date}\nModelo visual: ${m.visual.version}`,
    ),
  );
  if (m.visual.cover)
    children.push(new Paragraph({ children: [new PageBreak()] }));
  for (const block of m.blocks) {
    children.push(
      new Paragraph({
        text: block.title,
        heading: HeadingLevel.HEADING_1,
        keepNext: true,
      }),
    );
    for (const p of block.paragraphs ?? []) if (p) children.push(paragraph(p));
    if (block.table?.columns.length) {
      const t = block.table,
        rows = t.rows.length
          ? t.rows
          : [t.columns.map((_, i) => (i ? '' : 'Sem registros no recorte'))];
      const layout = tableLayout(t.columns, rows);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          columnWidths: layout.widths.map((w) => Math.floor(w * 20)),
          rows: [
            new TableRow({
              tableHeader: true,
              children: t.columns.map(
                (text) =>
                  new TableCell({
                    shading: { fill: color },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text,
                            bold: true,
                            color: 'FFFFFF',
                            size: 18,
                          }),
                        ],
                      }),
                    ],
                  }),
              ),
            }),
            ...rows.map(
              (row) =>
                new TableRow({
                  cantSplit: layout.fits(row),
                  children: row.map(
                    (text) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text,
                                size: layout.fontSize * 2,
                              }),
                            ],
                            spacing: { after: 80 },
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          ],
        }),
      );
      children.push(paragraph(''));
    }
  }
  children.push(paragraph(`Versão SHA-256: ${m.sourceHash}`));
  return Packer.toBuffer(
    new Document({
      creator: m.visual.organization_name,
      title: m.title,
      description: `${DOCUMENT_ENGINE} · ${m.version}`,
      styles: {
        default: {
          document: {
            run: { font, size: 21, color: '1E293B' },
            paragraph: { spacing: { line: 300 } },
          },
          heading1: {
            run: { font, color, size: 30, bold: true },
            paragraph: { spacing: { before: 280, after: 160 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1200, right: 880, bottom: 1200, left: 880 },
            },
          },
          headers: {
            default: new Header({ children: [paragraph(m.visual.header)] }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun(m.visual.footer + ' · '),
                    new TextRun({
                      children: [
                        PageNumber.CURRENT,
                        ' / ',
                        PageNumber.TOTAL_PAGES,
                      ],
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    }),
  );
}
