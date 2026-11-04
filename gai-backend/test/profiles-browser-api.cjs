const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.chdir(root);
Object.assign(process.env, {
  NODE_ENV: 'test', DB_TYPE: 'sqlite', GAI_TEST_MYSQL_DISPOSABLE: '0',
  GAI_TEST_MYSQL_WAVE0: '0', GAI_TEST_MYSQL_WAVE1: '0', GAI_TEST_MYSQL_WAVE2: '0',
  TS_NODE_PROJECT: path.join(root, 'tsconfig.json'),
});
require('ts-node/register/transpile-only');
const { createTestApp, seedTestData } = require('./integration/test-app.helper.ts');
const { DataSource } = require('typeorm');
const { EnsureOrgUserRole1794100000001 } = require('../src/migrations/1794100000001-ensure-org-user-role.ts');
(async () => {
  const app = await createTestApp(undefined, { includeHealthController: true });
  await seedTestData(app);
  const runner = app.get(DataSource).createQueryRunner();
  await new EnsureOrgUserRole1794100000001().up(runner);
  await runner.release();
  // Mirror the audited local Operador without altering the shared fixtures.
  // This database exists only in memory for this browser process.
  await app.get(DataSource).query(`DELETE FROM role_permissions WHERE role_id =
    (SELECT id FROM roles WHERE name = 'Operador' AND organization_id = 1)
    AND permission_id <> (SELECT id FROM permissions WHERE \`key\` = 'users:read')`);
  await app.listen(33429, '127.0.0.1');
  console.log('Profiles browser API: SQLite in memory only, loopback port 33429');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit(0)));
})().catch((error) => { console.error(error); process.exitCode = 1; });
