import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompaniesCompanyUnits1740700000001 implements MigrationInterface {
  name = 'CreateCompaniesCompanyUnits1740700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE companies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(255) NOT NULL,
        corporate_name VARCHAR(255) NULL,
        document VARCHAR(20) NULL,
        state_registration VARCHAR(50) NULL,
        municipal_registration VARCHAR(50) NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        zipcode VARCHAR(20) NULL,
        address VARCHAR(255) NULL,
        number VARCHAR(50) NULL,
        complement VARCHAR(255) NULL,
        district VARCHAR(120) NULL,
        city VARCHAR(120) NULL,
        state VARCHAR(50) NULL,
        country VARCHAR(80) NULL DEFAULT 'BR',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        metadata JSON NULL,
        created_by_id BIGINT UNSIGNED NULL,
        updated_by_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE INDEX idx_companies_organization_document (organization_id, document),
        INDEX idx_companies_organization_status (organization_id, status),
        INDEX idx_companies_organization_city_state (organization_id, city, state),
        INDEX idx_companies_name (name),
        CONSTRAINT fk_companies_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_companies_created_by FOREIGN KEY (created_by_id) REFERENCES users(id),
        CONSTRAINT fk_companies_updated_by FOREIGN KEY (updated_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE company_units (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        company_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(80) NULL,
        zipcode VARCHAR(20) NULL,
        address VARCHAR(255) NULL,
        number VARCHAR(50) NULL,
        complement VARCHAR(255) NULL,
        district VARCHAR(120) NULL,
        city VARCHAR(120) NULL,
        state VARCHAR(50) NULL,
        country VARCHAR(80) NULL DEFAULT 'BR',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        metadata JSON NULL,
        created_by_id BIGINT UNSIGNED NULL,
        updated_by_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_company_units_organization_company_status (organization_id, company_id, status),
        INDEX idx_company_units_organization_company_code (organization_id, company_id, code),
        INDEX idx_company_units_organization_city_state (organization_id, city, state),
        INDEX idx_company_units_name (name),
        CONSTRAINT fk_company_units_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_company_units_company FOREIGN KEY (company_id) REFERENCES companies(id),
        CONSTRAINT fk_company_units_created_by FOREIGN KEY (created_by_id) REFERENCES users(id),
        CONSTRAINT fk_company_units_updated_by FOREIGN KEY (updated_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      ALTER TABLE projects
      ADD COLUMN company_id BIGINT UNSIGNED NULL AFTER organization_id,
      ADD INDEX idx_projects_company_id (company_id),
      ADD CONSTRAINT fk_projects_company FOREIGN KEY (company_id) REFERENCES companies(id)
    `);

    await queryRunner.query(`
      CREATE TABLE project_units (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        company_unit_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX uq_project_units_project_unit (project_id, company_unit_id),
        INDEX idx_project_units_organization_project (organization_id, project_id),
        INDEX idx_project_units_organization_unit (organization_id, company_unit_id),
        CONSTRAINT fk_project_units_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_project_units_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_project_units_company_unit FOREIGN KEY (company_unit_id) REFERENCES company_units(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE company_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_company_audit_company_created (company_id, created_at),
        INDEX idx_company_audit_organization_id (organization_id),
        CONSTRAINT fk_company_audit_company FOREIGN KEY (company_id) REFERENCES companies(id),
        CONSTRAINT fk_company_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_company_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE company_unit_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_unit_id BIGINT UNSIGNED NOT NULL,
        company_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_company_unit_audit_unit_created (company_unit_id, created_at),
        INDEX idx_company_unit_audit_organization_id (organization_id),
        CONSTRAINT fk_company_unit_audit_unit FOREIGN KEY (company_unit_id) REFERENCES company_units(id),
        CONSTRAINT fk_company_unit_audit_company FOREIGN KEY (company_id) REFERENCES companies(id),
        CONSTRAINT fk_company_unit_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_company_unit_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE project_unit_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        project_id BIGINT UNSIGNED NOT NULL,
        company_unit_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_project_unit_audit_project_created (project_id, created_at),
        INDEX idx_project_unit_audit_organization_id (organization_id),
        CONSTRAINT fk_project_unit_audit_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_project_unit_audit_unit FOREIGN KEY (company_unit_id) REFERENCES company_units(id),
        CONSTRAINT fk_project_unit_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_project_unit_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE project_unit_audit_logs');
    await queryRunner.query('DROP TABLE company_unit_audit_logs');
    await queryRunner.query('DROP TABLE company_audit_logs');
    await queryRunner.query('DROP TABLE project_units');
    await queryRunner.query(
      'ALTER TABLE projects DROP FOREIGN KEY fk_projects_company',
    );
    await queryRunner.query(
      'ALTER TABLE projects DROP INDEX idx_projects_company_id',
    );
    await queryRunner.query('ALTER TABLE projects DROP COLUMN company_id');
    await queryRunner.query('DROP TABLE company_units');
    await queryRunner.query('DROP TABLE companies');
  }
}
