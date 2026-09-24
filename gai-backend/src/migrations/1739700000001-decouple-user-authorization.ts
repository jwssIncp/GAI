import { MigrationInterface, QueryRunner } from 'typeorm';

export class DecoupleUserAuthorization1739700000001 implements MigrationInterface {
  name = 'DecoupleUserAuthorization1739700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE roles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(100) NULL,
        type ENUM('SYSTEM','ORGANIZATION') NOT NULL,
        organization_id BIGINT UNSIGNED NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_roles_key (\`key\`),
        UNIQUE KEY uk_roles_org_name (organization_id, name),
        INDEX idx_roles_organization_id (organization_id),
        INDEX idx_roles_type (type),
        CONSTRAINT fk_roles_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      INSERT INTO roles (\`key\`, type, organization_id, name, description, is_active)
      VALUES
        ('PLATFORM_ADMIN', 'SYSTEM', NULL, 'Platform Administrator', 'Full platform access', 1),
        ('ORG_ADMIN', 'SYSTEM', NULL, 'Organization Administrator', 'Full organization access', 1)
    `);

    await queryRunner.query(`
      INSERT INTO roles (type, organization_id, name, description, is_active, created_at, updated_at)
      SELECT 'ORGANIZATION', organization_id, name, description, is_active, created_at, updated_at
      FROM org_roles
    `);

    await queryRunner.query(`
      CREATE TABLE role_permissions (
        role_id BIGINT UNSIGNED NOT NULL,
        permission_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_perm_role FOREIGN KEY (role_id) REFERENCES roles(id),
        CONSTRAINT fk_role_perm_permission FOREIGN KEY (permission_id) REFERENCES permissions(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT nr.id, orp.permission_id
      FROM org_role_permissions orp
      INNER JOIN org_roles oro ON oro.id = orp.org_role_id
      INNER JOIN roles nr ON nr.type = 'ORGANIZATION'
        AND nr.organization_id = oro.organization_id
        AND nr.name = oro.name
    `);

    await queryRunner.query(`
      CREATE TABLE user_role_assignments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        role_id BIGINT UNSIGNED NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        assigned_by BIGINT UNSIGNED NULL,
        assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        revoked_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_user_role_assignments_user_id (user_id),
        INDEX idx_user_role_assignments_role_id (role_id),
        CONSTRAINT fk_ura_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_ura_role FOREIGN KEY (role_id) REFERENCES roles(id),
        CONSTRAINT fk_ura_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      INSERT INTO user_role_assignments (user_id, role_id, is_active, assigned_at)
      SELECT u.id, r.id, 1, NOW(3)
      FROM users u
      INNER JOIN roles r ON r.\`key\` = u.role
      WHERE u.role IN ('PLATFORM_ADMIN', 'ORG_ADMIN')
    `);

    await queryRunner.query(`
      INSERT INTO user_role_assignments (user_id, role_id, is_active, assigned_at)
      SELECT u.id, nr.id, 1, NOW(3)
      FROM users u
      INNER JOIN org_roles oro ON oro.id = u.org_role_id
      INNER JOIN roles nr ON nr.type = 'ORGANIZATION'
        AND nr.organization_id = oro.organization_id
        AND nr.name = oro.name
      WHERE u.role = 'ORG_USER' AND u.org_role_id IS NOT NULL
    `);

    await queryRunner.query(
      'ALTER TABLE org_role_audit_logs DROP FOREIGN KEY fk_org_role_audit_role',
    );
    await queryRunner.query(`
      UPDATE org_role_audit_logs oal
      INNER JOIN org_roles oro ON oro.id = oal.org_role_id
      INNER JOIN roles nr ON nr.type = 'ORGANIZATION'
        AND nr.organization_id = oro.organization_id
        AND nr.name = oro.name
      SET oal.org_role_id = nr.id
    `);
    await queryRunner.query(`
      ALTER TABLE org_role_audit_logs
      CHANGE org_role_id role_id BIGINT UNSIGNED NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE org_role_audit_logs
      ADD CONSTRAINT fk_role_audit_role FOREIGN KEY (role_id) REFERENCES roles(id)
    `);
    await queryRunner.query(`
      RENAME TABLE org_role_audit_logs TO role_audit_logs
    `);

    await queryRunner.query(
      'ALTER TABLE users DROP FOREIGN KEY fk_users_org_role',
    );
    await queryRunner.query(
      'ALTER TABLE users DROP INDEX idx_users_org_role_id',
    );
    await queryRunner.query('ALTER TABLE users DROP INDEX idx_users_role');
    await queryRunner.query('ALTER TABLE users DROP COLUMN org_role_id');
    await queryRunner.query('ALTER TABLE users DROP COLUMN role');

    await queryRunner.query('DROP TABLE IF EXISTS org_role_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS org_roles');
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error('DecoupleUserAuthorization1739700000001 is not reversible'),
    );
  }
}
