const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const backend = path.resolve(__dirname, '../../gai-backend');
const mysql = require(path.join(backend, 'node_modules/mysql2/promise'));
const env = require(path.join(backend, 'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend, '.env')));
Object.assign(process.env, { TS_NODE_PROJECT: path.join(backend, 'tsconfig.json'), NODE_ENV: 'test', DB_TYPE: 'mysql', GAI_TEST_MYSQL_DISPOSABLE: '1' });
require(path.join(backend, 'node_modules/ts-node/register/transpile-only'));
const { DataSource } = require(path.join(backend, 'node_modules/typeorm'));
const { ReformUserLifecycle1794100000002 } = require(path.join(backend, 'src/migrations/1794100000002-reform-user-lifecycle.ts'));
async function main() {
  if (env.NODE_ENV !== 'local' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw Error('Only local schema inspection is permitted.');
  const local = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE });
  const schemas = [];
  try { await local.query('START TRANSACTION READ ONLY'); for (const table of ['organizations', 'users', 'sessions', 'password_reset_tokens']) { const [rows] = await local.query(`SHOW CREATE TABLE ${table}`); schemas.push(rows[0]['Create Table']); } await local.rollback(); } finally { await local.end(); }
  const connection = { host: '127.0.0.1', port: 33347, username: 'root', password: 'gai-validation-only', database: 'gai_users_migration_disposable' };
  const server = await mysql.createConnection({ host: connection.host, port: connection.port, user: connection.username, password: connection.password });
  let db;
  try {
    await server.query('DROP DATABASE IF EXISTS gai_users_migration_disposable');
    await server.query('CREATE DATABASE gai_users_migration_disposable CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    db = new DataSource({ type: 'mysql', ...connection, migrations: [ReformUserLifecycle1794100000002] }); await db.initialize();
    for (const schema of schemas) await db.query(schema);
    await db.query("INSERT INTO organizations (id,legal_name,cnpj,status) VALUES (1,'Synthetic migration organization','11222333000181','ACTIVE')");
    for (let id=1; id<=3; id++) await db.query("INSERT INTO users (id,organization_id,login,email,password_hash,status,password_changed_at) VALUES (?,?,?,?,?,'ACTIVE',NOW(3))", [id,id===1?null:1,`legacy.${id}`,`legacy.${id}@example.com`,'synthetic-placeholder-hash']);
    const before = await db.query('SELECT * FROM users ORDER BY id');
    await db.runMigrations();
    const columns = Object.keys(before[0]).map(column => '`' + column + '`').join(',');
    const after = await db.query(`SELECT ${columns} FROM users ORDER BY id`);
    assert.deepEqual(after, before);
    const defaults = await db.query('SELECT full_name,phone,job_title,last_login_at,temporary_password_expires_at,must_change_password,auth_version FROM users');
    assert.equal(defaults.every(row => row.full_name===null && row.phone===null && row.job_title===null && row.temporary_password_expires_at===null && row.must_change_password===0 && row.auth_version===0), true);
    await assert.rejects(db.query("UPDATE users SET login='collision@example.com' WHERE id=1"));
    await assert.rejects(db.query("UPDATE users SET email='legacy.2' WHERE id=1"));
    assert.deepEqual(await db.runMigrations(), []);
    const result={ target:'127.0.0.1:33347/gai_users_migration_disposable', realLocalSchemaClonedWithoutData:true, syntheticLegacyUsers:3, originalColumnsAndValuesPreserved:true, nullableIdentityDefaults:true, namespaceConstraintsEnforced:true, secondOfficialRunNoop:true };
    fs.mkdirSync(path.join(__dirname,'checks'),{recursive:true}); fs.writeFileSync(path.join(__dirname,'checks/migration-disposable.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
  } finally { if(db?.isInitialized)await db.destroy(); await server.query('DROP DATABASE IF EXISTS gai_users_migration_disposable'); await server.end(); }
}
main().catch(error=>{console.error(error.code || error.message);process.exitCode=1;});
