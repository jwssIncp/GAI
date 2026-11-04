// Read-only, aggregate inspection. Never exports passwords, hashes or session tokens.
const fs = require('node:fs');
const path = require('node:path');
const backend = path.resolve(__dirname, '../../gai-backend');
const env = require(path.join(backend, 'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend, '.env')));
const mysql = require(path.join(backend, 'node_modules/mysql2/promise'));
async function main() {
  if (env.NODE_ENV !== 'local' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw Error('Requires explicitly local loopback database');
  const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE });
  try {
    await db.query('START TRANSACTION READ ONLY');
    const result = { inspectedAt: new Date().toISOString(), target: `${env.DB_HOST}:${env.DB_PORT || 3306}/${env.DB_DATABASE}`, mode: 'READ ONLY', queries: {} };
    const queries = {
      columns: "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users','user_audit_logs','user_role_assignments','sessions','password_reset_tokens','auth_audit_logs') ORDER BY TABLE_NAME, ORDINAL_POSITION",
      constraints: "SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users','user_role_assignments','user_audit_logs') ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION",
      users: "SELECT COUNT(*) total, SUM(status='ACTIVE') active, SUM(status='INACTIVE') inactive, SUM(status='LOCKED') locked, SUM(organization_id IS NULL) platform, SUM(organization_id IS NOT NULL) organization, SUM(password_hash LIKE '$argon2id$%') argon2id_hashes, SUM(CHAR_LENGTH(TRIM(login))<3) short_trimmed_login, SUM(CHAR_LENGTH(login)>100) oversized_login, SUM(login<>TRIM(login)) untrimmed_login, SUM(BINARY email<>BINARY LOWER(TRIM(email))) unnormalized_email FROM users",
      organizations: 'SELECT id, status FROM organizations ORDER BY id',
      invalidOrganizations: "SELECT COUNT(*) missing_organization, SUM(u.status='ACTIVE') active_users FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE u.organization_id IS NOT NULL AND o.id IS NULL",
      inactiveOrganizations: "SELECT COUNT(*) users_in_inactive_organizations FROM users u JOIN organizations o ON o.id=u.organization_id WHERE o.status<>'ACTIVE'",
      usersWithoutEffectiveRole: "SELECT COUNT(*) total, SUM(u.status='ACTIVE') active FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_role_assignments a JOIN roles r ON r.id=a.role_id WHERE a.user_id=u.id AND a.is_active=1 AND a.revoked_at IS NULL AND r.is_active=1 AND ((r.type='ORGANIZATION' AND r.organization_id=u.organization_id) OR (r.type='SYSTEM' AND r.organization_id IS NULL AND ((r.`key`='PLATFORM_ADMIN' AND u.organization_id IS NULL) OR (r.`key` IN ('ORG_ADMIN','ORG_USER') AND u.organization_id IS NOT NULL)))))",
      identitiesCollidingAcrossColumns: 'SELECT COUNT(*) pairs FROM users a JOIN users b ON a.login=b.email AND a.id<>b.id',
      duplicateActiveAssignments: 'SELECT COUNT(*) duplicate_groups FROM (SELECT user_id, role_id FROM user_role_assignments WHERE is_active=1 AND revoked_at IS NULL GROUP BY user_id,role_id HAVING COUNT(*)>1) d',
      incompatibleActiveAssignments: "SELECT COUNT(*) total FROM user_role_assignments a JOIN users u ON u.id=a.user_id JOIN roles r ON r.id=a.role_id WHERE a.is_active=1 AND a.revoked_at IS NULL AND NOT ((r.type='ORGANIZATION' AND r.organization_id=u.organization_id) OR (r.type='SYSTEM' AND r.organization_id IS NULL AND ((r.`key`='PLATFORM_ADMIN' AND u.organization_id IS NULL) OR (r.`key` IN ('ORG_ADMIN','ORG_USER') AND u.organization_id IS NOT NULL))))",
      accessProfiles: "SELECT r.id,r.`key`,r.type,r.organization_id,r.is_active,(SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id=r.id) permissions,(SELECT COUNT(*) FROM user_role_assignments a WHERE a.role_id=r.id AND a.is_active=1 AND a.revoked_at IS NULL) active_assignments FROM roles r ORDER BY r.id",
      organizationAdministrators: "SELECT o.id,o.status,COUNT(DISTINCT CASE WHEN u.status='ACTIVE' AND r.is_active=1 AND r.type='SYSTEM' AND r.`key`='ORG_ADMIN' AND r.organization_id IS NULL THEN u.id END) active_administrators FROM organizations o LEFT JOIN users u ON u.organization_id=o.id LEFT JOIN user_role_assignments a ON a.user_id=u.id AND a.is_active=1 AND a.revoked_at IS NULL LEFT JOIN roles r ON r.id=a.role_id GROUP BY o.id,o.status ORDER BY o.id",
      auditOperations: 'SELECT operation,COUNT(*) total FROM user_audit_logs GROUP BY operation',
      migrations: 'SELECT name FROM migrations ORDER BY id',
    };
    for (const [key, sql] of Object.entries(queries)) { const [rows] = await db.query(sql); result.queries[key] = rows; }
    await db.rollback();
    fs.writeFileSync(path.join(__dirname, 'local-database.json'), JSON.stringify(result, null, 2) + '\n');
    const { columns, constraints, migrations, ...summary } = result.queries;
    console.log(JSON.stringify({ target: result.target, mode: result.mode, ...summary, columnCount: columns.length, constraintCount: constraints.length, appliedMigrations: migrations.length }, null, 2));
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
