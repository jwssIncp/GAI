const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'evidencias');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const check = (value, message) => { if (!value) throw Error(message); };
for (const name of ['README.md', 'navegacao.md', 'extracao-laudos.md', 'documentos.md', 'infraestrutura-ecs.md', 'testes.md', 'riscos-residuais.md', 'arquivos.json']) check(fs.statSync(path.join(__dirname, name)).size > 10, 'Missing report ' + name);
const manifest = read(path.join(__dirname, 'arquivos.json'));
for (const entry of manifest.files) check(hash(path.join(root, entry.path)) === entry.sha256, 'Manifest mismatch: ' + entry.path);
let sourceFiles = 0;
function compare(folder, target) {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name), copy = path.join(target, entry.name);
    if (entry.isDirectory()) compare(file, copy);
    else if (entry.isFile()) { check(fs.existsSync(copy) && hash(file) === hash(copy), 'Tested source mismatch: ' + path.relative(root, file)); sourceFiles++; }
  }
}
for (const part of ['gai-backend', 'gai-frontend']) {
  const source = path.join(root, part), target = path.join(out, 'workspace', part);
  for (const name of ['src', 'test', 'e2e']) compare(path.join(source, name), path.join(target, name));
  for (const name of fs.readdirSync(source)) if (fs.statSync(path.join(source, name)).isFile() && /\.(json|ts|cjs|mjs|js|html|css)$/.test(name)) check(hash(path.join(source, name)) === hash(path.join(target, name)), 'Tested config mismatch: ' + part + '/' + name);
}
const final = read(path.join(out, 'final-validation.json'));
check(final.backend_distinct === 830 && !final.production_released, 'Unexpected final acceptance');
console.log(JSON.stringify({ reports: 8, manifest_hashes_verified: manifest.files.length, tested_source_files_identical: sourceFiles, backend_distinct: final.backend_distinct, production_released: false }));
