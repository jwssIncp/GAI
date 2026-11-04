const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const mode = process.argv[2];
const backend = path.join(root, 'gai-backend');
const frontend = path.join(root, 'gai-frontend');
const evidence = path.join(__dirname, 'checks');
fs.mkdirSync(evidence, { recursive: true });
const groups = {
  backend: [
    [backend, 'lint', ['node_modules/eslint/bin/eslint.js', 'src/modules/users', 'src/scripts/seed/bootstrap.ts', 'src/migrations/1794100000001-ensure-org-user-role.ts', 'test/integration/users/access-profiles.e2e-spec.ts', 'test/unit/modules/users/assign-user-role.use-case.spec.ts', 'test/unit/modules/users/deactivate-user.use-case.spec.ts', 'test/unit/modules/users/revoke-user-role-assignment.use-case.spec.ts']],
    [backend, 'build', ['node_modules/@nestjs/cli/bin/nest.js', 'build']],
    [backend, 'unit', ['test/run-tests.cjs', 'unit', '--testPathPatterns=test/unit/modules/(users|auth)/']],
    [backend, 'integration', ['test/run-tests.cjs', 'sqlite', '--testPathPatterns=test/integration/(users/|auth/rbac|auth/session-invalidation)']],
  ],
  frontend: [
    [frontend, 'lint', ['node_modules/eslint/bin/eslint.js', 'src/features/roles', 'src/features/users', 'src/features/auth/AuthProvider.tsx', 'src/features/auth/permissions.ts', 'src/features/auth/permissions.test.ts', 'src/api/endpoints.ts', 'src/types/api.ts', 'e2e/profiles.spec.ts', 'vite.profiles.config.ts', 'playwright.profiles.config.ts']],
    [frontend, 'types', ['node_modules/typescript/bin/tsc', '-b']],
    [frontend, 'build', ['node_modules/vite/bin/vite.js', 'build']],
    [frontend, 'tests', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.config.ts']],
  ],
  mysql: [[backend, 'integration', ['test/run-tests.cjs', 'mysql', '--runTestsByPath', 'test/integration/users/access-profiles.e2e-spec.ts']]],
  browser: [[frontend, 'e2e', ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.profiles.config.ts']]],
};
if (!groups[mode]) throw Error('Use backend, frontend, mysql or browser. MySQL requires the disposable loopback server on port 33347.');
const result = [];
for (const [cwd, name, args] of groups[mode]) {
  const start = Date.now();
  const run = spawnSync(process.execPath, args, { cwd, env: { ...process.env, GAI_TEST_MYSQL_WAVE2: '1' }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const log = `${mode}-${name}.log`;
  fs.writeFileSync(path.join(evidence, log), (run.stdout || '') + (run.stderr || '') + (run.error ? String(run.error) : ''));
  result.push({ name, status: run.status, seconds: Math.round((Date.now() - start) / 1000), log });
  fs.writeFileSync(path.join(evidence, `${mode}.json`), JSON.stringify(result, null, 2));
  console.log(`${mode}/${name}: exit ${run.status}`);
}
if (result.some((item) => item.status !== 0)) process.exitCode = 1;
