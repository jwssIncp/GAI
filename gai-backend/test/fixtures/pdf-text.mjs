// Extrai o texto de um PDF (caminho no 1º argumento) com o pdf.js e imprime
// no stdout, uma página por linha. Usado pelos testes de documentos: roda em
// processo separado porque o pdf.js é só ESM e o Jest do projeto é CommonJS.
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const data = new Uint8Array(readFileSync(process.argv[2]));
const pdf = await getDocument({ data, verbosity: 0 }).promise;
const pages = [];
for (let i = 1; i <= pdf.numPages; i++) {
  const content = await (await pdf.getPage(i)).getTextContent();
  pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
}
process.stdout.write(pages.join('\n'));
