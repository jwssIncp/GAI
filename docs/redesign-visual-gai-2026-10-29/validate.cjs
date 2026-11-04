const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const out = path.join(__dirname, 'evidencias');
const workspace = path.join(out, 'workspace');
const mode = process.argv[2];
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    ['node_modules', 'dist', '.git', 'coverage', 'test-results', 'playwright-report'].includes(e.name) || (/^\.env(?:\.|$)/.test(e.name) && e.name !== '.env.example') ? [] :
      e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
function sync() {
  for (const part of ['gai-backend', 'gai-frontend']) {
    const source = path.join(root, part), target = path.join(workspace, part);
    fs.mkdirSync(target, { recursive: true });
    for (const file of files(source)) {
      const destination = path.join(target, path.relative(source, file));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(file, destination);
    }
  }
}
function run(name, part, args, env = {}) {
  const cwd = path.join(workspace, part), log = path.join(out, name + '.log');
  if (fs.existsSync(log)) {
    const attempt = path.join(out, 'attempts', name + '-' + Date.now());
    fs.mkdirSync(attempt, { recursive: true });
    for (const suffix of ['.log', '-result.json', '', '-vitest.json', '-jest.json']) {
      const prior = path.join(out, name + suffix);
      if (fs.existsSync(prior)) fs.renameSync(prior, path.join(attempt, name + suffix));
    }
  }
  const fd = fs.openSync(log, 'w'), start = Date.now();
  const result = spawnSync(process.execPath, args, { cwd,
    env: { ...process.env, GAI_TEST_MYSQL_WAVE2: '1', GAI_TEST_EVIDENCE_DIR: path.join(out, name), ...env },
    stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  const item = { name, command: ['node', ...args], cwd, exit_code: result.status,
    seconds: (Date.now() - start) / 1000, error: result.error?.message };
  fs.writeFileSync(path.join(out, name + '-result.json'), JSON.stringify(item, null, 2));
  console.log(JSON.stringify(item));
  return item.exit_code === 0;
}
fs.mkdirSync(out, { recursive: true });
if (mode === 'init') {
  const baseline = path.join(out, 'baseline');
  if (fs.existsSync(baseline)) throw Error('Initial baseline already exists; refusing overwrite');
  const entries = [];
  for (const part of ['gai-frontend', 'gai-backend']) for (const file of files(path.join(root, part))) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    entries.push({ path: relative, sha256: hash(file) });
    const destination = path.join(baseline, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }
  fs.writeFileSync(path.join(out, 'initial-files.json'), JSON.stringify(entries, null, 2));
  const git = spawnSync('git', ['status', '--porcelain', '--', 'gai-frontend/src', 'gai-backend/src', 'gai-frontend/e2e', 'gai-frontend/package.json', 'gai-frontend/package-lock.json'], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(path.join(out, 'initial-git-status.txt'), git.stdout);
  sync();
  for (const part of ['gai-frontend', 'gai-backend']) {
    const previous = path.join(root, 'docs/correcoes-onda-2-integracao-2026-10-29/evidencias/workspace', part, 'node_modules');
    fs.cpSync(previous, path.join(workspace, part, 'node_modules'), { recursive: true });
  }
  console.log('Preserved baseline and copied isolated dependencies');
} else if (mode === 'sync') sync();
else if (mode === 'frontend') {
  process.exitCode = run('frontend', 'gai-frontend', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.config.ts', '--reporter=json', '--outputFile=' + path.join(out, 'frontend-vitest.json')]) ? 0 : 1;
} else if (['default', 'mysql', 'unit', 'sqlite'].includes(mode)) {
  process.exitCode = run(mode, 'gai-backend', ['test/run-tests.cjs', mode, '--json', '--outputFile=' + path.join(out, mode + '-jest.json'), ...process.argv.slice(3)]) ? 0 : 1;
} else if (mode === 'e2e') {
  process.exitCode = run('e2e', 'gai-backend', ['test/run-tests.cjs', 'e2e', ...process.argv.slice(3)]) ? 0 : 1;
} else if (mode === 'before' || mode === 'visual' || mode === 'final-nav') {
  process.exitCode = run(mode, 'gai-frontend', ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.redesign.config.ts', ...process.argv.slice(3)], { GAI_VISUAL_STAGE: mode }) ? 0 : 1;
} else if (mode === 'frontend-lint') {
  process.exitCode = run('gai-frontend-lint', 'gai-frontend', ['node_modules/eslint/bin/eslint.js', '.', '--format', 'json', '--output-file', path.join(out, 'frontend-eslint.json')]) ? 0 : 1;
} else if (mode === 'frontend-assets') {
  const results = [
    run('gai-frontend-build', 'gai-frontend', ['node_modules/vite/bin/vite.js', 'build'], { VITE_API_BASE_URL: '/api/v1' }),
    run('gai-frontend-lint', 'gai-frontend', ['node_modules/eslint/bin/eslint.js', '.', '--format', 'json', '--output-file', path.join(out, 'frontend-eslint.json')]),
  ];
  process.exitCode = results.every(Boolean) ? 0 : 1;
} else if (mode === 'frontend-checks' || mode === 'backend-checks') {
  const part = mode.startsWith('frontend') ? 'gai-frontend' : 'gai-backend';
  const checks = part === 'gai-frontend' ? [
    ['typescript', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json', '--noEmit', '--incremental', 'false']],
    ['node-typescript', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.node.json', '--noEmit', '--incremental', 'false']],
    ['build', ['node_modules/vite/bin/vite.js', 'build']],
    ['lint', ['node_modules/eslint/bin/eslint.js', '.', '--format', 'json', '--output-file', path.join(out, 'frontend-eslint.json')]],
  ] : [
    ['typescript', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']],
    ['build', ['node_modules/@nestjs/cli/bin/nest.js', 'build']],
    ['lint', ['node_modules/eslint/bin/eslint.js', '{src,apps,libs,test}/**/*.ts', '--format', 'json', '--output-file', path.join(out, 'backend-eslint.json')]],
  ];
  const results = checks.map(([name, args]) => run(part + '-' + name, part, args, { VITE_API_BASE_URL: '/api/v1' }));
  process.exitCode = results.every(Boolean) ? 0 : 1;
} else if (mode === 'manifest') {
  const initial = JSON.parse(fs.readFileSync(path.join(out, 'initial-files.json'), 'utf8'));
  const prior = new Map(initial.filter(e => !/(?:^|\/)\.env(?:\.|$)/.test(e.path) || e.path.endsWith('/.env.example')).map(e => [e.path, e.sha256]));
  const changed = [];
  for (const part of ['gai-frontend', 'gai-backend']) for (const file of files(path.join(root, part))) {
    const relative = path.relative(root, file).replaceAll('\\', '/'), sha256 = hash(file);
    if (prior.get(relative) !== sha256) changed.push({ path: relative, before_sha256: prior.get(relative) ?? null, sha256 });
    prior.delete(relative);
  }
  for (const [relative, sha256] of prior) changed.push({ path: relative, before_sha256: sha256, deleted: true });
  for (const name of fs.readdirSync(__dirname)) {
    const file = path.join(__dirname, name);
    if (name === 'arquivos.json' || !fs.statSync(file).isFile()) continue;
    changed.push({ path: path.relative(root, file).replaceAll('\\', '/'), before_sha256: null, sha256: hash(file), kind: 'documentation-or-validation' });
  }
  fs.writeFileSync(path.join(__dirname, 'arquivos.json'), JSON.stringify(changed, null, 2));
  console.log(changed.length + ' application files changed relative to preserved local baseline');
} else throw Error('Unknown mode: ' + mode);
