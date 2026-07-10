import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1739500000002 implements MigrationInterface {
  name = 'CreateAuthTables1739500000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NULL,
        login VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('PLATFORM_ADMIN','ORG_ADMIN','ORG_USER') NOT NULL DEFAULT 'ORG_USER',
        status ENUM('ACTIVE','INACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
        failed_login_attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME(3) NULL,
        password_changed_at DATETIME(3) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_users_login (login),
        UNIQUE KEY uk_users_email (email),
        INDEX idx_users_organization_id (organization_id),
        INDEX idx_users_status (status),
        CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE sessions (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        organization_id CHAR(36) NULL,
        expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        last_activity_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        INDEX idx_sessions_user_id (user_id),
        INDEX idx_sessions_expires_at (expires_at),
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_sessions_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        used_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_reset_tokens_user_id (user_id),
        INDEX idx_reset_tokens_hash (token_hash),
        CONSTRAINT fk_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE auth_audit_logs (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NULL,
        operation VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45) NULL,
        result VARCHAR(20) NOT NULL,
        metadata JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        CONSTRAINT fk_auth_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      ALTER TABLE organization_audit_logs
      ADD CONSTRAINT fk_org_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE organization_audit_logs DROP FOREIGN KEY fk_org_audit_performed_by',
    );
    await queryRunner.query('DROP TABLE IF EXISTS auth_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS password_reset_tokens');
    await queryRunner.query('DROP TABLE IF EXISTS sessions');
    await queryRunner.query('DROP TABLE IF EXISTS users');
  }
}
