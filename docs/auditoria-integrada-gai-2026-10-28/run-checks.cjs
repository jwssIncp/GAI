const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const evidence = path.join(__dirname, 'evidencias');
fs.mkdirSync(evidence, { recursive: true });
const lane = process.argv[2];
const checks = {
  backend: [
    ['backend-tests', 'gai-backend', ['node_modules/jest/bin/jest.js', '--runInBand', '--json', '--outputFile=' + path.join(evidence, 'backend-jest.json')]],
    ['backend-typescript', 'gai-backend', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false', '--pretty', 'false']],
    ['backend-build', 'gai-backend', ['node_modules/@nestjs/cli/bin/nest.js', 'build', '--path', '../docs/auditoria-integrada-gai-2026-10-28/tsconfig.audit.json']],
    ['backend-lint', 'gai-backend', ['node_modules/eslint/bin/eslint.js', '{src,apps,libs,test}/**/*.ts', '--format', 'json', '--output-file', path.join(evidence, 'backend-eslint.json')]],
  ],
  frontend: [
    ['frontend-tests', 'gai-frontend', ['node_modules/vitest/vitest.mjs', 'run', '--reporter=json', '--outputFile=' + path.join(evidence, 'frontend-vitest.json')]],
    ['frontend-typescript', 'gai-frontend', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json', '--noEmit', '--incremental', 'false', '--pretty', 'false']],
    ['frontend-node-typescript', 'gai-frontend', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.node.json', '--noEmit', '--incremental', 'false', '--pretty', 'false']],
    ['frontend-build', 'gai-frontend', ['node_modules/vite/bin/vite.js', 'build', '--outDir', path.join(evidence, 'build-frontend')]],
    ['frontend-lint', 'gai-frontend', ['node_modules/eslint/bin/eslint.js', '.', '--format', 'json', '--output-file', path.join(evidence, 'frontend-eslint.json')]],
  ],
};
if (!checks[lane]) throw Error('Unknown lane');
const results = [];
for (const [name, dir, args] of checks[lane]) {
  const fd = fs.openSync(path.join(evidence, name + '.log'), 'w');
  const start = new Date();
  const r = spawnSync(process.execPath, args, { cwd: path.join(root, dir), env: { ...process.env, GAI_TEST_MYSQL_DISPOSABLE: '0', GAI_TEST_S3_DISPOSABLE: '0' }, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  const item = { name, start: start.toISOString(), seconds: (Date.now() - start) / 1000, exit_code: r.status, error: r.error?.message, command: ['node', ...args] };
  results.push(item);
  fs.writeFileSync(path.join(evidence, lane + '-checks.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(item));
}
process.exitCode = results.some(r => r.exit_code !== 0) ? 1 : 0;
