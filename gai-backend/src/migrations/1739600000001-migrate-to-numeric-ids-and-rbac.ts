import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateToNumericIdsAndRbac1739600000001 implements MigrationInterface {
  name = 'MigrateToNumericIdsAndRbac1739600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryRunner.query('DROP TABLE IF EXISTS org_role_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS user_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS org_role_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS org_roles');
    await queryRunner.query('DROP TABLE IF EXISTS permissions');
    await queryRunner.query('DROP TABLE IF EXISTS auth_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS password_reset_tokens');
    await queryRunner.query('DROP TABLE IF EXISTS sessions');
    await queryRunner.query('DROP TABLE IF EXISTS organization_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TABLE IF EXISTS organizations');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');

    await queryRunner.query(`
      CREATE TABLE organizations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        legal_name VARCHAR(255) NOT NULL,
        trade_name VARCHAR(255) NULL,
        cnpj CHAR(14) NOT NULL,
        contact_email VARCHAR(255) NULL,
        contact_phone VARCHAR(20) NULL,
        status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_organizations_cnpj (cnpj),
        INDEX idx_organizations_status (status),
        INDEX idx_organizations_legal_name (legal_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(100) NOT NULL,
        resource VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        scope ENUM('PLATFORM','ORGANIZATION') NOT NULL,
        description VARCHAR(255) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_permissions_key (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE org_roles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_org_roles_org_name (organization_id, name),
        INDEX idx_org_roles_organization_id (organization_id),
        CONSTRAINT fk_org_roles_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE org_role_permissions (
        org_role_id BIGINT UNSIGNED NOT NULL,
        permission_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (org_role_id, permission_id),
        CONSTRAINT fk_org_role_perm_role FOREIGN KEY (org_role_id) REFERENCES org_roles(id),
        CONSTRAINT fk_org_role_perm_permission FOREIGN KEY (permission_id) REFERENCES permissions(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NULL,
        org_role_id BIGINT UNSIGNED NULL,
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
        INDEX idx_users_org_role_id (org_role_id),
        INDEX idx_users_status (status),
        INDEX idx_users_role (role),
        CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_users_org_role FOREIGN KEY (org_role_id) REFERENCES org_roles(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE organization_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_org_audit_org_created (organization_id, created_at),
        CONSTRAINT fk_org_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_org_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE sessions (
        id CHAR(36) NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NULL,
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
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
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
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NULL,
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
      CREATE TABLE user_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_user_audit_user_created (user_id, created_at),
        CONSTRAINT fk_user_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_user_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE org_role_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        org_role_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_org_role_audit_role_created (org_role_id, created_at),
        CONSTRAINT fk_org_role_audit_role FOREIGN KEY (org_role_id) REFERENCES org_roles(id),
        CONSTRAINT fk_org_role_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryRunner.query('DROP TABLE IF EXISTS org_role_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS user_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS auth_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS password_reset_tokens');
    await queryRunner.query('DROP TABLE IF EXISTS sessions');
    await queryRunner.query('DROP TABLE IF EXISTS organization_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TABLE IF EXISTS org_role_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS org_roles');
    await queryRunner.query('DROP TABLE IF EXISTS permissions');
    await queryRunner.query('DROP TABLE IF EXISTS organizations');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}
