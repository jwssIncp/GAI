const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const backend = path.resolve(__dirname, '../gai-backend');
const env = require(path.join(backend, 'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend, '.env')));
async function main() {
  if (env.NODE_ENV !== 'local' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw Error('Requires local loopback database');
  const db = await require(path.join(backend, 'node_modules/mysql2/promise')).createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE });
  try {
    await db.query('SET TRANSACTION READ ONLY');
    await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const result = { captured_at: new Date().toISOString(), tables: {} };
    for (const table of ['projects', 'project_audit_logs', 'project_units', 'project_field_agents', 'companies', 'company_units', 'organizations', 'users']) {
      const [columns] = await db.query('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION', [table]);
      const [indexes] = await db.query('SHOW INDEX FROM `' + table + '`');
      const [rows] = await db.query('SELECT * FROM `' + table + '` ORDER BY id');
      result.tables[table] = { columns, indexes, rows: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
    }
    const [foreignKeys] = await db.query("SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND (TABLE_NAME='projects' OR REFERENCED_TABLE_NAME='projects') AND REFERENCED_TABLE_NAME IS NOT NULL");
    result.foreign_keys = foreignKeys;
    const [statuses] = await db.query('SELECT status,COUNT(*) total FROM projects GROUP BY status');
    result.statuses = statuses;
    await db.query('ROLLBACK');
    const destination = path.resolve(__dirname, '../docs/reformulacao-cadastro-projetos-2026-11-03/checks');
    fs.mkdirSync(destination, { recursive: true });
    const file = process.argv[2] === 'after' ? 'local-after.json' : 'local-before.json';
    fs.writeFileSync(path.join(destination, file), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ file, tables: Object.fromEntries(Object.entries(result.tables).map(([key, value]) => [key, { rows: value.rows, columns: value.columns.length }])) }));
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
