const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const report = path.join(root, 'docs/reformulacao-cadastro-projetos-2026-11-03');
const checks = path.join(report, 'checks');
fs.mkdirSync(checks, { recursive: true });
const baseline = JSON.parse(fs.readFileSync(path.join(report, 'baseline-manifest.json'), 'utf8'));
const added = [
  'scripts/projects-checks.cjs',
  'scripts/projects-inspect-local.cjs',
  'scripts/projects-migrate-local.cjs',
  'docs/reformulacao-cadastro-projetos-2026-11-03/README.md',
  'gai-backend/src/migrations/1794200000001-extend-project-registration.ts',
  'gai-backend/src/modules/projects/domain/enums/project-type.enum.ts',
  'gai-backend/src/modules/projects/application/dto/project-registration-fields.dto.ts',
  'gai-backend/src/modules/projects/application/dto/project-json.validator.ts',
  'gai-backend/src/modules/projects/application/dto/project-options-query.dto.ts',
  'gai-backend/src/modules/projects/application/services/project-registration.service.ts',
  'gai-backend/test/unit/modules/projects/project-registration.spec.ts',
  'gai-backend/test/integration/projects/project-registration.e2e-spec.ts',
  'gai-frontend/src/features/projects/projectFields.ts',
  'gai-frontend/src/features/projects/projectFields.test.ts',
  'gai-frontend/src/features/projects/SidebarProjects.test.tsx',
  'gai-frontend/src/features/projects/ProjectRegistrationSelect.tsx',
  'gai-frontend/src/features/projects/ProjectCreatePage.tsx',
  'gai-frontend/src/features/projects/ProjectRegistrationDetails.tsx',
  'gai-frontend/e2e/project-registration-real.spec.ts',
  'gai-frontend/playwright.projects.config.ts',
];
const changed = Object.keys(baseline).filter(file => fs.existsSync(path.join(root, file)) && crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') !== baseline[file]);
const files = [...new Set([...changed, ...added.filter(file => fs.existsSync(path.join(root, file)))])];
fs.writeFileSync(path.join(report, 'modified-files.json'), JSON.stringify(files, null, 2) + '\n');
const mode = process.argv[2];
const backend = path.join(root, 'gai-backend'), frontend = path.join(root, 'gai-frontend');
const configs = {
  format: { cwd: backend, args: ['node_modules/prettier/bin/prettier.cjs', '--write', ...files.filter(file => /\.(ts|tsx|yaml)$/.test(file) && !['gai-frontend/src/layouts/Sidebar.tsx', 'gai-frontend/src/types/api.ts', 'gai-frontend/src/api/endpoints.ts', 'gai-frontend/src/router/router.tsx', 'gai-frontend/src/features/projects/ProjectSummaryPage.tsx', 'gai-frontend/src/features/projects/ProjectSummaryPage.test.tsx'].includes(file)).map(file => path.join(root, file))] },
  'lint-backend': { cwd: backend, args: ['node_modules/eslint/bin/eslint.js', ...files.filter(file => file.startsWith('gai-backend/') && file.endsWith('.ts')).map(file => path.relative(backend, path.join(root, file)))] },
  'lint-frontend': { cwd: frontend, args: ['node_modules/eslint/bin/eslint.js', ...files.filter(file => file.startsWith('gai-frontend/') && /\.(ts|tsx)$/.test(file)).map(file => path.relative(frontend, path.join(root, file)))] },
  'build-backend': { cwd: backend, args: ['node_modules/@nestjs/cli/bin/nest.js', 'build'] },
  'build-frontend': { cwd: frontend, args: ['node_modules/typescript/bin/tsc', '-b'] },
  'bundle-frontend': { cwd: frontend, args: ['node_modules/vite/bin/vite.js', 'build'], env: { VITE_API_BASE_URL: '/api/v1' } },
  unit: { cwd: backend, args: ['test/run-tests.cjs', 'unit'] },
  sqlite: { cwd: backend, args: ['test/run-tests.cjs', 'sqlite'] },
  mysql: { cwd: backend, args: ['test/run-tests.cjs', 'mysql'], env: { GAI_TEST_MYSQL_WAVE2: '1' } },
  frontend: { cwd: frontend, args: ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.config.ts'] },
  browser: { cwd: frontend, args: ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.projects.config.ts'] },
};
if (!configs[mode]) throw Error('Unknown check: ' + mode);
const config = configs[mode];
const args = [...config.args, ...process.argv.slice(3)];
const evidenceName = process.env.GAI_PROJECTS_CHECK_LABEL || mode;
if (!/^[a-z0-9-]+$/.test(evidenceName)) throw Error('Invalid evidence label');
const log = path.join(checks, evidenceName + '.log');
const descriptor = fs.openSync(log, 'w');
const started = new Date();
const result = spawnSync(process.execPath, args, { cwd: config.cwd, env: { ...process.env, ...config.env }, stdio: ['ignore', descriptor, descriptor], windowsHide: true });
fs.closeSync(descriptor);
const output = { command: ['node', ...args], cwd: path.relative(root, config.cwd), started_at: started.toISOString(), duration_seconds: (Date.now() - started.getTime()) / 1000, exit_code: result.status, error: result.error?.message, log: path.relative(root, log) };
fs.writeFileSync(path.join(checks, evidenceName + '.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ check: mode, exit_code: output.exit_code, duration_seconds: output.duration_seconds, log: output.log }));
if (result.status !== 0) console.log(fs.readFileSync(log, 'utf8').slice(-9000));
process.exitCode = result.status ?? 1;
