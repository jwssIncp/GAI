'use strict';
// Executed inside the backend container (cwd /app) via reset-admin.sh.
// Keep this file small: it travels base64-encoded in ECS overrides (8 KB limit).
const mysql = require('mysql2/promise');
const argon2 = require('argon2');

const decode = (v) => (v ? Buffer.from(v, 'base64').toString('utf8') : '');

async function main() {
  const login = decode(process.env.ADMIN_LOGIN_B64) || 'platform.admin';
  const email = decode(process.env.ADMIN_EMAIL_B64) || 'admin@gai.local';
  const password = decode(process.env.ADMIN_PASSWORD_B64);
  if (!password) throw new Error('ADMIN_PASSWORD_B64 is required');

  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  console.log('[diag] conectado ao banco', process.env.DB_DATABASE);

  try {
    const [m] = await db.query('SELECT COUNT(*) AS n FROM migrations');
    console.log('[diag] migrations aplicadas:', m[0].n);
  } catch (e) {
    console.log('[diag] tabela migrations ausente - rode o deploy antes:', e.message);
    await db.end();
    process.exit(1);
  }

  const [audit] = await db.query(
    'SELECT created_at, result, user_id, metadata FROM auth_audit_logs ORDER BY id DESC LIMIT 5',
  );
  audit.forEach((a) => console.log('[diag] login recente:', JSON.stringify(a)));

  const [users] = await db.query(
    'SELECT id, login, email, status, organization_id, failed_login_attempts, locked_until FROM users',
  );
  console.log('[diag] total de usuarios:', users.length);
  users.forEach((u) => console.log('[diag] usuario:', JSON.stringify(u)));

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const [existing] = await db.query('SELECT id FROM users WHERE login = ?', [login]);
  let userId;
  if (existing.length) {
    userId = existing[0].id;
    await db.query(
      `UPDATE users SET password_hash = ?, status = 'ACTIVE', failed_login_attempts = 0,
       locked_until = NULL, password_changed_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
      [hash, userId],
    );
    console.log(`[fix] senha redefinida e desbloqueado: ${login} (id ${userId})`);
  } else {
    const [r] = await db.query(
      `INSERT INTO users (organization_id, login, email, password_hash, status,
       failed_login_attempts, locked_until, password_changed_at, created_at, updated_at)
       VALUES (NULL, ?, ?, ?, 'ACTIVE', 0, NULL, NOW(3), NOW(3), NOW(3))`,
      [login, email, hash],
    );
    userId = r.insertId;
    console.log(`[fix] usuario criado: ${login} (id ${userId})`);
  }

  const [roles] = await db.query(
    "SELECT id FROM roles WHERE `key` = 'PLATFORM_ADMIN' AND type = 'SYSTEM' LIMIT 1",
  );
  if (!roles.length) {
    console.log('[warn] role PLATFORM_ADMIN nao existe - rode o seed para criar roles/permissoes');
  } else {
    const roleId = roles[0].id;
    const [assigned] = await db.query(
      'SELECT id FROM user_role_assignments WHERE user_id = ? AND role_id = ? AND is_active = 1',
      [userId, roleId],
    );
    if (!assigned.length) {
      await db.query(
        `INSERT INTO user_role_assignments (user_id, role_id, is_active, assigned_by, assigned_at, revoked_at, created_at)
         VALUES (?, ?, 1, NULL, NOW(3), NULL, NOW(3))`,
        [userId, roleId],
      );
      console.log('[fix] role PLATFORM_ADMIN atribuida');
    } else {
      console.log('[ok] role PLATFORM_ADMIN ja atribuida');
    }
  }

  const [check] = await db.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  console.log('[ok] senha confere no banco:', await argon2.verify(check[0].password_hash, password));

  await db.end();
  console.log('[ok] reset-admin concluido');
}

main().catch((e) => {
  console.error('[erro]', e);
  process.exit(1);
});
