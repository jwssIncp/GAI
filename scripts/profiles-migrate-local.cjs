// Local-only wrapper around the official TypeORM migration runner.
// Refuse unrelated pending work and verify that existing access data survives.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '../gai-backend');
const env = require(path.join(backend, 'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend, '.env')));
const expected = 'EnsureOrgUserRole1794100000001';
const mysql = require(path.join(backend, 'node_modules/mysql2/promise'));
async function main() {
  if (env.NODE_ENV !== 'local' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw Error('Only an explicitly local loopback database is permitted.');
  const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE });
  try {
    const [applied] = await db.query('SELECT name FROM migrations');
    const names = fs.readdirSync(path.join(backend, 'src/migrations')).filter((name) => /^\d+.*\.ts$/.test(name)).map((name) => {
      const source = fs.readFileSync(path.join(backend, 'src/migrations', name), 'utf8');
      return source.match(/\bname\s*=\s*['"]([^'"]+)['"]/)?.[1] || source.match(/export\s+class\s+(\w+)\s+implements\s+MigrationInterface/)?.[1];
    });
    const pending = names.filter((name) => !applied.some((row) => row.name === name));
    if (pending.some((name) => name !== expected)) throw Error('Unrelated pending migrations; refusing to execute.');
    async function snapshot() {
      const result = {};
      for (const table of ['roles', 'permissions', 'role_permissions', 'user_role_assignments']) {
        // These tables contain access metadata only, with no passwords or tokens.
        const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY ${table === 'role_permissions' ? 'role_id, permission_id' : 'id'}`);
        result[table] = table === 'roles' ? rows.filter((row) => row.key !== 'ORG_USER') : rows;
      }
      for (const table of ['users', 'organizations']) {
        const [rows] = await db.query(`SELECT id, organization_id FROM ${table === 'users' ? 'users' : '(SELECT id, NULL AS organization_id FROM organizations) orgs'} ORDER BY id`);
        result[table] = rows;
      }
      return result;
    }
    const before = await snapshot();
    const executed = spawnSync(process.execPath, ['-r', 'ts-node/register', 'node_modules/typeorm/cli.js', 'migration:run', '-d', 'data-source.ts'], { cwd: backend, env: { ...process.env, ...env }, encoding: 'utf8' });
    if (executed.status !== 0) throw Error(executed.stderr || executed.stdout || 'Migration runner failed');
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Existing access data changed unexpectedly; investigate the local database.');
    const [roles] = await db.query("SELECT id, `key`, type, organization_id, is_active FROM roles WHERE `key` = 'ORG_USER'");
    if (roles.length !== 1 || roles[0].type !== 'SYSTEM' || roles[0].organization_id !== null) throw Error('Unexpected ORG_USER registration.');
    const [grants] = await db.query('SELECT COUNT(*) AS total FROM role_permissions WHERE role_id = ?', [roles[0].id]);
    console.log(JSON.stringify({ target: `${env.DB_HOST}:${env.DB_PORT || 3306}/${env.DB_DATABASE}`, migration: expected, pendingBefore: pending, role: roles[0], permissionCount: Number(grants[0].total), preserved: Object.fromEntries(Object.entries(before).map(([key, value]) => [key, value.length])) }, null, 2));
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
