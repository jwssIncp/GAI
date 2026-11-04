const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const out = path.join(__dirname, 'evidencias'), backend = path.join(out, 'workspace/gai-backend');
const archive = path.join(out, 'attempts/volume-matrix-initial');
fs.mkdirSync(archive, { recursive: true });
for (const name of ['volume-final', 'volume-final.log', 'volume-final-result.json', 'volume-final-jest.json']) {
  const file = path.join(out, name);
  if (fs.existsSync(file)) fs.cpSync(file, path.join(archive, name), { recursive: true });
}
fs.copyFileSync(path.resolve(__dirname, '../../gai-backend/test/integration/technical-reports/report-volume.mysql.e2e-spec.ts'), path.join(backend, 'test/integration/technical-reports/report-volume.mysql.e2e-spec.ts'));
const fd = fs.openSync(path.join(out, 'volume-final.log'), 'w'), start = Date.now();
const result = spawnSync(process.execPath, ['test/run-tests.cjs', 'mysql', '--runTestsByPath', 'test/integration/technical-reports/report-volume.mysql.e2e-spec.ts', '--json', '--outputFile=' + path.join(out, 'volume-final-jest.json')], { cwd: backend, env: { ...process.env, GAI_TEST_MYSQL_WAVE2: '1', GAI_TEST_EVIDENCE_DIR: path.join(out, 'volume-final') }, stdio: ['ignore', fd, fd] });
fs.closeSync(fd);
const data = { name: 'volume-final', exit_code: result.status, seconds: (Date.now() - start) / 1000, error: result.error?.message };
fs.writeFileSync(path.join(out, 'volume-final-result.json'), JSON.stringify(data, null, 2));
console.log(JSON.stringify(data)); process.exitCode = result.status || 0;
