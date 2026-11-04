const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), evidence = path.join(__dirname, 'evidencias');
const files = [
  'src/modules/payments-expenses/application/services/payments-expenses.service.ts',
  'src/modules/payments-expenses/domain/entities/field-agent-payment.ts',
  'src/modules/payments-expenses/domain/entities/payment-state-conflict.ts',
  'src/modules/payments-expenses/domain/ports/payments-expenses.repository.port.ts',
  'src/modules/payments-expenses/infrastructure/persistence/typeorm-payments-expenses.repository.ts',
  'test/integration/test-app.helper.ts',
  'test/integration/payments-expenses/payment-integrity.mysql.e2e-spec.ts',
  'test/unit/modules/payments-expenses/payments-expenses.spec.ts',
];
const lanes = {
 backend: [
  ['typescript', 'gai-backend', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']],
  ['build', 'gai-backend', ['node_modules/@nestjs/cli/bin/nest.js', 'build', '--path', '../docs/correcoes-onda-0-financeiro-2026-10-28/tsconfig.wave0.json']],
  ['lint-changed', 'gai-backend', ['node_modules/eslint/bin/eslint.js', ...files, '--format', 'json', '--output-file', path.join(evidence, 'eslint-changed.json')]],
 ],
 frontend: [['frontend-tests', 'gai-frontend', ['node_modules/vitest/vitest.mjs', 'run', '--reporter=json', '--outputFile=' + path.join(evidence, 'frontend-vitest.json')]]],
};
lanes.final = lanes.backend.filter(c => c[0] !== 'build');
const results = [];
for (const [name, dir, args] of lanes[process.argv[2]]) {
 const fd = fs.openSync(path.join(evidence, name + '.log'), 'w'), start = Date.now();
 const r = spawnSync(process.execPath, args, { cwd: path.join(root, dir), env: process.env, stdio: ['ignore', fd, fd] }); fs.closeSync(fd);
 const result = { name, exit_code: r.status, seconds: (Date.now()-start)/1000, command: args }; results.push(result);
 fs.writeFileSync(path.join(evidence, process.argv[2] + '-checks.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(result));
}
process.exitCode = results.some(r => r.exit_code !== 0) ? 1 : 0;
