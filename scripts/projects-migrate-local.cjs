const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '../gai-backend');
const report = path.resolve(__dirname, '../docs/reformulacao-cadastro-projetos-2026-11-03/checks');
const env = require(path.join(backend, 'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend, '.env')));
const expected = 'ExtendProjectRegistration1794200000001';
async function main() {
  if (env.NODE_ENV !== 'local' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw Error('Requires explicit local loopback database');
  const original = JSON.parse(fs.readFileSync(path.join(report, 'local-before.json'), 'utf8'));
  const db = await require(path.join(backend, 'node_modules/mysql2/promise')).createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE });
  try {
    const [applied] = await db.query('SELECT name FROM migrations');
    const migrationNames = fs.readdirSync(path.join(backend, 'src/migrations')).filter(file => /^\d.*\.ts$/.test(file)).map(file => {
      const source = fs.readFileSync(path.join(backend, 'src/migrations', file), 'utf8');
      return source.match(/\bname\s*=\s*['"]([^'"]+)['"]/)?.[1] || source.match(/export\s+class\s+(\w+)\s+implements\s+MigrationInterface/)?.[1];
    });
    const pending = migrationNames.filter(name => !applied.some(row => row.name === name));
    if (pending.some(name => name !== expected)) throw Error('Unrelated migration pending; refusing to run');
    async function snapshot() {
      const values = {};
      for (const [table, baseline] of Object.entries(original.tables)) {
        const projection = baseline.columns.map(column => '`' + column.COLUMN_NAME + '`').join(',');
        const [rows] = await db.query('SELECT ' + projection + ' FROM `' + table + '` ORDER BY id');
        values[table] = { rows: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
      }
      return values;
    }
    const before = await snapshot();
    assert.equal(before.projects.rows, original.tables.projects.rows, 'Projects changed since diagnosis; review before migrating');
    assert.equal(before.projects.sha256, original.tables.projects.sha256, 'Project values changed since diagnosis; review before migrating');
    const result = spawnSync(process.execPath, ['-r', 'ts-node/register', 'node_modules/typeorm/cli.js', 'migration:run', '-d', 'data-source.ts'], { cwd: backend, env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true });
    fs.writeFileSync(path.join(report, 'local-migration-runner.log'), (result.stdout || '') + (result.stderr || ''));
    if (result.status !== 0) throw Error('Official migration runner failed; inspect local-migration-runner.log');
    const after = await snapshot();
    assert.deepEqual(after, before, 'Original row values must remain unchanged');
    const output = { executed_at: new Date().toISOString(), migration: expected, pending_before: pending, preservation: Object.fromEntries(Object.entries(before).map(([table, value]) => [table, { rows: value.rows, all_original_values_unchanged: value.sha256 === after[table].sha256 }])), new_columns_nullable: true, data_backfill: false };
    fs.writeFileSync(path.join(report, pending.length ? 'local-migration.json' : 'local-migration-idempotent.json'), JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output));
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
