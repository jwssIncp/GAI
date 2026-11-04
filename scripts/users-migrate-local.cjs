// Apply only this task's migration through the official runner, preserving existing rows.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { createHash } = require('node:crypto'), { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '../gai-backend');
const env = require(path.join(backend, 'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend, '.env')));
const mysql = require(path.join(backend, 'node_modules/mysql2/promise'));
const expected = 'ReformUserLifecycle1794100000002';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function main() {
  if (env.NODE_ENV !== 'local' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw Error('Requires explicit local loopback database.');
  const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE });
  try {
    const [applied] = await db.query('SELECT name FROM migrations');
    const names = fs.readdirSync(path.join(backend, 'src/migrations')).filter(name => /^\d+.*\.ts$/.test(name)).map(name => {
      const source = fs.readFileSync(path.join(backend, 'src/migrations', name), 'utf8');
      return source.match(/\bname\s*=\s*['"]([^'"]+)['"]/)?.[1] || source.match(/export\s+class\s+(\w+)\s+implements\s+MigrationInterface/)?.[1];
    });
    const pending = names.filter(name => !applied.some(row => row.name === name));
    if (pending.some(name => name !== expected)) throw Error('Unrelated pending migrations; refusing to execute.');
    const [columns] = await db.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' ORDER BY ORDINAL_POSITION");
    const projection = columns.map(row => '`' + row.COLUMN_NAME + '`').join(',');
    async function snapshot() {
      const result = {};
      for (const table of ['users', 'organizations', 'roles', 'permissions', 'role_permissions', 'user_role_assignments']) {
        const [rows] = await db.query(`SELECT ${table === 'users' ? projection : '*'} FROM ${table} ORDER BY ${table === 'role_permissions' ? 'role_id,permission_id' : 'id'}`);
        result[table] = { count: rows.length, digest: digest(rows) };
      }
      return result;
    }
    const before = await snapshot();
    assert.equal(before.users.count, 3, 'Expected the three existing development accounts.');
    const run = spawnSync(process.execPath, ['-r', 'ts-node/register', 'node_modules/typeorm/cli.js', 'migration:run', '-d', 'data-source.ts'], { cwd: backend, env: { ...process.env, ...env }, encoding: 'utf8' });
    if (run.status !== 0) throw Error('Official migration runner failed; inspect schema before retrying. ' + (run.stderr || '').slice(-1000));
    const after = await snapshot(); assert.deepEqual(after, before);
    const [users] = await db.query('SELECT id,login,status,organization_id,full_name,phone,job_title,must_change_password,auth_version FROM users ORDER BY id');
    const [final] = await db.query('SELECT COUNT(*) total FROM migrations');
    const output = { executedAt: new Date().toISOString(), target: `${env.DB_HOST}:${env.DB_PORT || 3306}/${env.DB_DATABASE}`, pendingBefore: pending, migration: expected, appliedMigrations: Number(final[0].total), preserved: Object.fromEntries(Object.entries(before).map(([table, value]) => [table, { rows: value.count, allExistingValuesUnchanged: value.digest === after[table].digest }])), users };
    const target = path.resolve(__dirname, '../docs/reformulacao-usuarios-2026-11-02/checks/' + (pending.length ? 'local-migration.json' : 'local-migration-idempotent.json')); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output));
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
