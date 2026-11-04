const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.chdir(root);
Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_TYPE: 'mysql',
  GAI_TEST_MYSQL_DISPOSABLE: '1',
  GAI_TEST_MYSQL_WAVE1: '1',
  GAI_TEST_MYSQL_WAVE0: '0',
  TS_NODE_PROJECT: path.join(root, 'tsconfig.json'),
});
require('ts-node/register/transpile-only');
const {
  createTestApp,
  seedTestData,
} = require('./integration/test-app.helper.ts');
(async () => {
  const app = await createTestApp(undefined, { includeHealthController: true, browserDisposableDatabase: process.env.GAI_TEST_MYSQL_WAVE2 === '1' });
  await seedTestData(app);
  if (process.env.GAI_TEST_MYSQL_WAVE2 === '1') {
    const { DataSource } = require('typeorm');
    const fixture = await require('./fixtures/navigation-seed.ts').seedNavigationReader(app.get(DataSource));
    const fs = require('node:fs');
    const output = process.env.GAI_TEST_EVIDENCE_DIR;
    if (output) { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'navigation-fixture.json'), JSON.stringify(fixture)); }
  }
  const port = process.env.GAI_TEST_MYSQL_WAVE2 === '1' ? 33349 : 33339;
  await app.listen(port, '127.0.0.1');
  console.log('GAI_REAL_API_READY', port, '-> disposable MySQL', process.env.GAI_TEST_MYSQL_WAVE2 === '1' ? 33347 : 33337);
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      app
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
