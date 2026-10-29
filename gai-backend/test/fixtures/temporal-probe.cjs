// A child Node process with a different TZ, against only the fixed disposable DB.
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'tsconfig.json');
require(path.join(root, 'node_modules/ts-node/register/transpile-only'));
const { DataSource, EntitySchema } = require('typeorm');
const {
  MYSQL_UTC_OPTIONS,
} = require('../../src/common/persistence/mysql-utc-options.ts');
const {
  CIVIL_DATE_TRANSFORMER,
} = require('../../src/common/persistence/civil-date.transformer.ts');
(async () => {
  const ds = new DataSource({
    type: 'mysql',
    ...MYSQL_UTC_OPTIONS,
    host: '127.0.0.1',
    port: process.env.GAI_TEST_MYSQL_WAVE2 === '1' ? 33347 : 33337,
    username: 'root',
    password: 'gai-validation-only',
    database: 'gai_validation_disposable',
    synchronize: false,
    entities: [
      new EntitySchema({
        name: 'Probe',
        tableName: 'wave1_temporal_probe',
        columns: {
          id: { type: Number, primary: true, generated: true },
          zone: { type: String },
          civil: { type: 'date', transformer: CIVIL_DATE_TRANSFORMER },
          instant: { type: 'datetime', precision: 3 },
          created_at: { type: 'datetime', precision: 3, createDate: true },
        },
      }),
    ],
  });
  await ds.initialize();
  try {
    const repo = ds.getRepository('Probe'),
      row = await repo.save({
        zone: process.env.TZ,
        civil: new Date('2026-03-31T00:00:00Z'),
        instant: new Date('2026-03-31T23:59:59.999Z'),
      });
    const saved = await repo.findOneByOrFail({ id: row.id });
    const runners = Array.from({ length: 4 }, () => ds.createQueryRunner());
    const sessions = await Promise.all(
      runners.map(async (r) => {
        await r.connect();
        return r.query('SELECT @@session.time_zone zone');
      }),
    );
    await Promise.all(runners.map((r) => r.release()));
    const [raw] = await ds.query(
      "SELECT DATE_FORMAT(instant,'%Y-%m-%dT%H:%i:%s.%fZ') instant_raw FROM wave1_temporal_probe WHERE id=?",
      [row.id],
    );
    console.log(JSON.stringify({ saved, sessions, raw }));
  } finally {
    await ds.destroy();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
