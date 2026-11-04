const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'evidencias');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = n => JSON.parse(fs.readFileSync(path.join(out, n), 'utf8'));
const checks = [];
function check(name, ok, details) { checks.push({ name, passed: Boolean(ok), details }); }
const required = ['README.md', 'auditoria-visual.md', 'design-system.md', 'identidade-gai.md', 'navegacao-ux.md', 'interatividade.md', 'temas.md', 'responsividade.md', 'acessibilidade.md', 'testes.md', 'antes-depois.md', 'arquivos.json'];
for (const file of required) check('deliverable:' + file, fs.existsSync(path.join(__dirname, file)) && fs.statSync(path.join(__dirname, file)).size > 0);
const validation = read('validacao-final.json');
for (const name of ['backend', 'mysql', 'frontend', 'visual', 'flows', 'navigationRecheck']) {
  const result = validation[name];
  check('tests:' + name, result && result.total > 0 && result.failed === 0 && result.skipped === 0 && result.passed === result.total, result);
}
for (const name of ['gai-frontend-typescript', 'gai-frontend-node-typescript', 'gai-frontend-build', 'gai-frontend-lint', 'gai-backend-typescript', 'gai-backend-build', 'gai-backend-lint']) {
  const result = read(name + '-result.json');
  check(name, result.exit_code === 0, result.seconds);
}
for (const name of ['frontend-eslint.json', 'backend-eslint.json']) {
  const entries = read(name), errors = entries.reduce((n, x) => n + x.errorCount, 0), warnings = entries.reduce((n, x) => n + x.warningCount, 0);
  check(name, errors === 0 && warnings === 0, { files: entries.length, errors, warnings });
}
const changed = JSON.parse(fs.readFileSync(path.join(__dirname, 'arquivos.json'), 'utf8'));
check('manifest hashes', changed.every(x => !x.deleted && hash(path.join(root, x.path)) === x.sha256));
check('no backend modifications', changed.every(x => !x.path.startsWith('gai-backend/')));
const initial = read('initial-files.json');
for (const part of ['gai-frontend', 'gai-backend']) for (const name of ['package.json', 'package-lock.json']) {
  const relative = `${part}/${name}`;
  check('preserved:' + relative, hash(path.join(root, relative)) === initial.find(x => x.path === relative)?.sha256);
}
const preservation = read('preservacao.json');
check('earlier local sources', preservation.divergences.length === 0 && preservation.backendChanged.length === 0, { compared: preservation.compared, unchanged: preservation.unchanged });
const before = fs.readFileSync(path.join(out, 'baseline/gai-frontend/src/styles/globals.css'), 'utf8');
const after = fs.readFileSync(path.join(root, 'gai-frontend/src/styles/globals.css'), 'utf8');
for (const name of ['ink', 'navy', 'green', 'green-deep', 'teal']) {
  const pattern = new RegExp('--brand-' + name + ':\\s*([^;]+)');
  check('brand palette:' + name, before.match(pattern)?.[1] === after.match(pattern)?.[1]);
}
const contrast = read('visual/contrast.json');
check('semantic contrast', contrast.length === 26 && contrast.every(x => x.ratio >= 4.5), { pairs: contrast.length, minimum: Math.min(...contrast.map(x => x.ratio)) });
const observations = fs.readdirSync(path.join(out, 'visual')).filter(n => n.startsWith('observed-')).flatMap(n => {
  const result = read('visual/' + n);
  check(n, result.errors.length === 0 && result.responses.length === 0);
  return result.observations;
});
check('responsive matrix', observations.length === 96 && observations.every(x => x.document <= x.viewport + 1), { pages: observations.length, widths: [...new Set(observations.map(x => x.viewport))].sort((a,b) => a-b) });
const touch = read('visual/touch.json');
check('touch phones and tablets', touch.length === 8 && touch.every(x => x.coarse && x.document <= x.width + 1 && x.targets.length === 27 && x.targets.every(t => t.width >= 44 && t.height >= 44)), { contexts: touch.length });
const finalTouch = read('final-nav/touch.json');
check('final compact touch controls', finalTouch.length === 8 && finalTouch.every(x => x.projectTargets?.length > 0 && x.projectTargets.every(t => t.height >= 44)), { contexts: finalTouch.length });
const tooltips = read('final-nav/tooltip-checks.json');
check('chart tooltips in both themes', tooltips.length === 2 && tooltips.every(t => t.foreground === t.item), tooltips);
for (const size of [32, 180, 192, 512]) {
  const data = fs.readFileSync(path.join(root, `gai-frontend/public/brand/gai-icon-${size}.png`));
  check('raster logo:' + size, data.subarray(1, 4).toString() === 'PNG' && data.readUInt32BE(16) === size && data.readUInt32BE(20) === size);
}
for (const name of ['gai-horizontal-light', 'gai-horizontal-dark', 'gai-compact-light', 'gai-compact-dark', 'gai-symbol']) {
  const data = fs.readFileSync(path.join(root, 'gai-frontend/public/brand/' + name + '.svg'), 'utf8');
  check('vector logo:' + name, data.includes('viewBox=') && data.includes('<path') && !/<image|https?:\/\/(?!www\.w3\.org)/.test(data));
}
for (const file of required.filter(n => n.endsWith('.md'))) {
  const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const missing = [...content.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]).filter(target => !/^https?:|^#/.test(target) && !fs.existsSync(path.resolve(__dirname, target.split('#')[0])));
  check('documentation links:' + file, missing.length === 0, missing);
}
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => ['workspace', 'baseline'].includes(e.name) ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
const evidenceFiles = walk(out).filter(p => !['evidence-manifest.json', 'final-checks.json'].includes(path.basename(p)));
fs.writeFileSync(path.join(out, 'evidence-manifest.json'), JSON.stringify(evidenceFiles.map(p => ({ path: path.relative(__dirname, p).replaceAll('\\', '/'), bytes: fs.statSync(p).size, sha256: hash(p) })), null, 2));
const result = { date: '2026-10-29', runtime: { node: process.version, platform: process.platform, arch: process.arch }, passed: checks.every(c => c.passed), checks };
fs.writeFileSync(path.join(out, 'final-checks.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, failed: checks.filter(c => !c.passed) }, null, 2));
process.exitCode = result.passed ? 0 : 1;
