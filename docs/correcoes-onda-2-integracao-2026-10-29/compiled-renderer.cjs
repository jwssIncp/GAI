const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const backend = path.join(__dirname, 'evidencias/workspace/gai-backend');
process.chdir(backend);
process.env.NODE_ENV = 'production';
const { DocumentRendererService } = require(path.join(backend, 'dist/src/modules/documents/document-renderer.service.js'));
const { DEFAULT_VISUAL } = require(path.join(backend, 'dist/src/modules/documents/document.contract.js'));
const { PDFDocument } = require(path.join(backend, 'node_modules/pdf-lib'));
const { unzipSync, strFromU8 } = require(path.join(backend, 'node_modules/fflate'));
const out = path.join(__dirname, 'evidencias/compiled-renderer');
fs.mkdirSync(out, { recursive: true });
const model = { title: 'SINTETICO renderer compilado', subtitle: 'Validação local', version: 'synthetic-compiled-v1', date: '29/10/2026', status: 'SINTETICO', sourceHash: 'a'.repeat(64), visual: { ...DEFAULT_VISUAL }, blocks: [{ title: 'Itens sintéticos', table: { columns: ['ID', 'Descrição', 'Situação'], rows: Array.from({ length: 1001 }, (_, i) => [String(i + 1), `SYN-COMPILED-${String(i).padStart(5, '0')}`, 'SINTETICO']) } }] };
(async () => {
  const renderer = new DocumentRendererService(), result = [];
  try {
    for (const format of ['docx', 'pdf']) {
      const start = Date.now(), bytes = await renderer.render(model, format);
      const item = { format, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), milliseconds: Date.now() - start, compiled_worker: true };
      if (format === 'pdf') item.pages = (await PDFDocument.load(bytes)).getPageCount();
      else if (!strFromU8(unzipSync(bytes)['word/document.xml']).includes('SYN-COMPILED-01000')) throw Error('Compiled DOCX omitted its last row');
      fs.writeFileSync(path.join(out, `compiled-1001.${format}`), bytes); result.push(item);
    }
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { renderer.onModuleDestroy(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
