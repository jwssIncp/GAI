import { MigrationInterface, QueryRunner } from 'typeorm';
export class ReformUserLifecycle1794100000002 implements MigrationInterface {
  name = 'ReformUserLifecycle1794100000002';
  async up(q: QueryRunner): Promise<void> {
    const conflicts = (await q.query(
      "SELECT COUNT(*) total FROM users WHERE login LIKE '%@%' OR LOCATE('@', email) <= 1",
    )) as { total: string }[];
    if (Number(conflicts[0].total))
      throw new Error(
        'Legacy identities outside the login/email namespaces require explicit remediation; no identities were changed.',
      );
    await q.query(`ALTER TABLE users
      ADD full_name VARCHAR(160) NULL, ADD phone VARCHAR(30) NULL, ADD job_title VARCHAR(120) NULL,
      ADD last_login_at DATETIME(3) NULL, ADD temporary_password_expires_at DATETIME(3) NULL,
      ADD must_change_password TINYINT(1) NOT NULL DEFAULT 0,
      ADD auth_version INT NOT NULL DEFAULT 0,
      MODIFY status ENUM('ACTIVE','INACTIVE','LOCKED','BLOCKED','PENDING_ACTIVATION') NOT NULL DEFAULT 'ACTIVE',
      ADD CONSTRAINT ck_users_login_namespace CHECK (LOCATE('@', login) = 0),
      ADD CONSTRAINT ck_users_email_namespace CHECK (LOCATE('@', email) > 1)`);
    await q.query(
      'ALTER TABLE sessions ADD auth_version INT NOT NULL DEFAULT 0',
    );
    await q.query(
      "ALTER TABLE password_reset_tokens ADD purpose VARCHAR(24) NOT NULL DEFAULT 'PASSWORD_RESET'",
    );
    await q.query('CREATE INDEX idx_users_full_name ON users(full_name)');
  }
  down(): Promise<void> {
    throw new Error(
      'Additive forward-only migration; use a reviewed forward migration.',
    );
  }
}
