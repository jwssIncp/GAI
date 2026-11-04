const path = require('node:path'),
  { spawnSync } = require('node:child_process');
const mode = process.argv[2] || 'default',
  configs = {
    default: 'jest.config.cjs',
    unit: 'test/jest.unit.cjs',
    sqlite: 'test/jest.sqlite.cjs',
    mysql: 'test/jest.mysql.cjs',
    s3: 'test/jest.s3.cjs',
  };
const root = path.resolve(__dirname, '..');
if (mode === 'e2e') {
  const frontend = path.join(root, '../gai-frontend');
  const fs = require('node:fs');
  for (const file of fs.readdirSync(path.join(frontend, 'e2e'))) {
    if (!file.endsWith('.ts')) continue;
    const source = fs.readFileSync(path.join(frontend, 'e2e', file), 'utf8');
    if (/https?:\/\/(localhost|127\.0\.0\.1):3000\b/.test(source))
      throw Error('Persistent API target in browser test: ' + file + '. Use the configured relative /api/v1 target.');
  }
  for (const args of [
    [path.join(frontend, 'node_modules/typescript/bin/tsc'), '-b'],
    [path.join(frontend, 'node_modules/vite/bin/vite.js'), 'build'],
  ]) {
    const build = spawnSync(process.execPath, args, {
      cwd: frontend,
      env: { ...process.env, VITE_API_BASE_URL: '/api/v1' },
      stdio: 'inherit',
    });
    if (build.status !== 0) process.exit(build.status ?? 1);
  }
  const r = spawnSync(
    process.execPath,
    [
      path.join(root, '../gai-frontend/node_modules/@playwright/test/cli.js'),
      'test',
      '--config=playwright.real.config.ts',
      ...process.argv.slice(3),
    ],
    { cwd: path.join(root, '../gai-frontend'), stdio: 'inherit' },
  );
  process.exitCode = r.status || (r.error ? 1 : 0);
} else {
  if (!configs[mode]) throw Error('Unknown test engine: ' + mode);
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DB_TYPE: 'sqlite',
    GAI_TEST_MYSQL_DISPOSABLE: '0',
    GAI_TEST_MYSQL_WAVE0: '0',
    GAI_TEST_MYSQL_WAVE1: '0',
    GAI_TEST_MYSQL_WAVE2: '0',
    GAI_TEST_S3_DISPOSABLE: '0',
  };
  if (mode === 'mysql')
    Object.assign(env, {
      DB_TYPE: 'mysql',
      GAI_TEST_MYSQL_DISPOSABLE: '1',
      GAI_TEST_MYSQL_WAVE1: '1',
      GAI_TEST_MYSQL_WAVE2: process.env.GAI_TEST_MYSQL_WAVE2 === '1' ? '1' : '0',
    });
  if (mode === 's3') env.GAI_TEST_S3_DISPOSABLE = '1';
  const r = spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules/jest/bin/jest.js'),
      '--config=' + configs[mode],
      '--runInBand',
      ...process.argv.slice(3),
    ],
    { cwd: root, env, stdio: 'inherit' },
  );
  process.exitCode = r.status || (r.error ? 1 : 0);
}
