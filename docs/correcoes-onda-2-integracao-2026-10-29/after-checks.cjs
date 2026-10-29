const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const out = path.join(__dirname, 'evidencias'), backend = path.join(out, 'workspace/gai-backend');
const minimum = Number(process.argv[2]);
const backendMinimum = Number(process.argv[3] || minimum);
if (!Number.isFinite(minimum)) throw Error('Expected minimum result timestamp');
const checks = ['backend-checks.json', 'frontend-checks.json', 'frontend-result.json', 'e2e-result.json'];
const read = file => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
function run(name, executable, args, cwd = path.resolve(__dirname, '../..'), env = {}) {
  const fd = fs.openSync(path.join(out, name + '.log'), 'w'), start = Date.now();
  const result = spawnSync(executable, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd] }); fs.closeSync(fd);
  const data = { name, command: [executable, ...args], exit_code: result.status, seconds: (Date.now() - start) / 1000, error: result.error?.message };
  fs.writeFileSync(path.join(out, name + '-result.json'), JSON.stringify(data, null, 2)); console.log(JSON.stringify(data));
  if (result.status !== 0) throw Error(name + ' failed');
}
(async () => {
  const deadline = Date.now() + 30 * 60 * 1000;
  const ready = () => {
    try {
      if (!checks.every(file => fs.existsSync(path.join(out, file)) && fs.statSync(path.join(out, file)).mtimeMs >= (file === 'backend-checks.json' ? backendMinimum : minimum))) return false;
      const stats = read('e2e/playwright.json').stats;
      return stats.expected + stats.unexpected + stats.skipped + stats.flaky === 14;
    } catch { return false; }
  };
  while (!ready()) {
    if (Date.now() > deadline) throw Error('Final checks did not finish within 30 minutes');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  for (const file of checks) {
    const data = read(file), rows = Array.isArray(data) ? data : [data];
    if (rows.some(row => row.exit_code !== 0)) throw Error('Gate failed: ' + file);
  }
  const browser = read('e2e/playwright.json');
  if (browser.stats.expected !== 14 || browser.stats.unexpected || browser.stats.skipped || browser.stats.flaky) throw Error('Incomplete browser gate');
  if (read('mysql-result.json').exit_code !== 0 || read('mysql-jest.json').numPassedTests !== 325) throw Error('Incomplete MySQL gate');
  run('save-mysql-final', process.execPath, [path.join(__dirname, 'save-database.cjs'), 'mysql-final']);
  run('save-browser-final', process.execPath, [path.join(__dirname, 'save-database.cjs'), 'browser-final', 'navigation']);
  const name = 'documents-final'; fs.mkdirSync(path.join(out, name), { recursive: true });
  // Recheck document capacity with the concurrent compilation/test jobs closed.
  // A prior loaded run returned an explicit timeout and saved no partial PDF.
  run(name, process.execPath, ['test/run-tests.cjs', 'mysql', '--runTestsByPath', 'test/integration/technical-reports/report-volume.mysql.e2e-spec.ts', 'test/integration/technical-reports/reports.e2e-spec.ts', 'test/integration/documents/documents.e2e-spec.ts', '--json', '--outputFile=' + path.join(out, name + '-jest.json')], backend, { GAI_TEST_MYSQL_WAVE2: '1', GAI_TEST_EVIDENCE_DIR: path.join(out, name) });
  run('inspect-final-documents', path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'), [path.join(__dirname, 'inspect-documents.py'), path.join(out, name)]);
  run('save-documents-final', process.execPath, [path.join(__dirname, 'save-database.cjs'), 'documents-final']);
  fs.writeFileSync(path.join(out, 'post-checks.json'), JSON.stringify({ at: new Date().toISOString(), complete: true, visual_review_pending: true }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
