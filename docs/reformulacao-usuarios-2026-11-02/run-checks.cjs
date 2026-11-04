const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const mode = process.argv[2];
const backend = path.join(root, 'gai-backend'), frontend = path.join(root, 'gai-frontend');
const files = fs.existsSync(path.join(__dirname, 'files.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'files.json'), 'utf8')) : [];
const groups = {
  unit: [[backend, ['test/run-tests.cjs', 'unit']]],
  sqlite: [[backend, ['test/run-tests.cjs', 'sqlite', '--testPathPatterns=auth|users|organizations|contract']]],
  mysql: [[backend, ['test/run-tests.cjs', 'mysql', '--runTestsByPath', 'test/integration/users/user-lifecycle.e2e-spec.ts', 'test/integration/users/access-profiles.e2e-spec.ts', 'test/integration/auth/session-invalidation.e2e-spec.ts']]],
  frontend: [[frontend, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.config.ts']]],
  build: [[backend, ['node_modules/@nestjs/cli/bin/nest.js', 'build']], [frontend, ['node_modules/typescript/bin/tsc', '-b']], [frontend, ['node_modules/vite/bin/vite.js', 'build']]],
  lint: [[backend, ['node_modules/eslint/bin/eslint.js', ...files.filter(p => p.startsWith('gai-backend/')).map(p => p.slice(12))]], [frontend, ['node_modules/eslint/bin/eslint.js', ...files.filter(p => p.startsWith('gai-frontend/')).map(p => p.slice(13))]]],
  browser: [[frontend, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.users.config.ts']]],
};
if (!groups[mode]) throw Error('Unknown check group');
fs.mkdirSync(path.join(__dirname, 'checks'), { recursive: true });
const results = [];
for (const [cwd, args] of groups[mode]) {
  const started = Date.now();
  const logPath = path.join(__dirname, 'checks', `${mode}-${results.length + 1}.log`);
  const fd = fs.openSync(logPath, 'w');
  const result = spawnSync(process.execPath, args, { cwd, env: { ...process.env, GAI_TEST_MYSQL_WAVE2: '1' }, stdio: ['ignore', fd, fd], timeout: 1200000 });
  fs.closeSync(fd);
  const item = { command: ['node', ...args], cwd: path.relative(root, cwd), exitCode: result.status, durationMs: Date.now() - started, error: result.error?.message };
  results.push(item);
  console.log(JSON.stringify(item));
  if (result.status !== 0) break;
}
fs.writeFileSync(path.join(__dirname, 'checks', `${mode}.json`), JSON.stringify({ executedAt: new Date().toISOString(), results }, null, 2) + '\n');
process.exitCode = results.some(r => r.exitCode !== 0) ? 1 : 0;
