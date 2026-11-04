const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.chdir(root);
Object.assign(process.env, {
  NODE_ENV: 'test', DB_TYPE: 'sqlite', GAI_TEST_MYSQL_DISPOSABLE: '0',
  GAI_TEST_MYSQL_WAVE0: '0', GAI_TEST_MYSQL_WAVE1: '0', GAI_TEST_MYSQL_WAVE2: '0',
  TS_NODE_PROJECT: path.join(root, 'tsconfig.json'),
});
require('ts-node/register/transpile-only');
console.log('Loading company test application');
const { createTestApp, seedTestData } = require('./integration/test-app.helper.ts');
(async () => {
  console.log('Initializing company test application');
  const app = await createTestApp(undefined, { includeHealthController: true });
  console.log('Seeding company test application');
  await seedTestData(app);
  await app.listen(33419, '127.0.0.1');
  console.log('Company browser API ready: SQLite in memory only, port 33419');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit(0)));
})().catch((error) => { console.error(error); process.exitCode = 1; });
