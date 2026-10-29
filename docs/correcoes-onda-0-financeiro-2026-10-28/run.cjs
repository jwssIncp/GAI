const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), backend = path.join(root, 'gai-backend');
const evidence = path.join(__dirname, 'evidencias');
process.env.NODE_ENV = 'test';
process.env.GAI_TEST_MYSQL_DISPOSABLE = '1';
process.env.GAI_TEST_MYSQL_WAVE0 = '1';
process.env.TS_NODE_PROJECT = path.join(backend, 'tsconfig.json');
const mode = process.argv[2];
if (mode === 'server') {
  require(path.join(backend, 'node_modules/ts-node/register/transpile-only'));
  const { createTestApp, seedTestData } = require(path.join(backend, 'test/integration/test-app.helper.ts'));
  (async () => {
    const app = await createTestApp(); await seedTestData(app);
    await app.listen(33329, '127.0.0.1');
    console.log('WAVE0_READY PID=' + process.pid);
  })().catch(e => { console.error(e); process.exitCode = 1; });
} else {
  const suites = mode === 'regression' ? ['--testPathPatterns=test/integration'] : mode === 'unit' ? ['--testPathPatterns=test/unit'] : ['--runTestsByPath', 'test/integration/payments-expenses/payment-integrity.mysql.e2e-spec.ts'];
  const args = ['node_modules/jest/bin/jest.js', '--runInBand', '--testTimeout=300000', ...suites, '--json', '--outputFile=' + path.join(evidence, mode + '-jest.json')];
  const fd = fs.openSync(path.join(evidence, mode + '.log'), 'w'), start = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: backend, env: { ...process.env, GAI_TEST_S3_DISPOSABLE: '0' }, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  const result = { mode, exit_code: r.status, seconds: (Date.now()-start)/1000, command: args, target: '127.0.0.1:33327/gai_validation_disposable' };
  fs.writeFileSync(path.join(evidence, mode + '-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); process.exitCode = r.status || 0;
}
