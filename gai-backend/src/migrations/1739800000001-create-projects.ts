import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjects1739800000001 implements MigrationInterface {
  name = 'CreateProjects1739800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE projects (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        start_date DATE NULL,
        end_date DATE NULL,
        finished_at DATETIME(3) NULL,
        settings JSON NULL,
        metadata JSON NULL,
        created_by_id BIGINT UNSIGNED NULL,
        updated_by_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_projects_organization_status (organization_id, status),
        INDEX idx_projects_name (name),
        INDEX idx_projects_created_by_id (created_by_id),
        INDEX idx_projects_updated_by_id (updated_by_id),
        CONSTRAINT fk_projects_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by_id) REFERENCES users(id),
        CONSTRAINT fk_projects_updated_by FOREIGN KEY (updated_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE project_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        project_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_project_audit_project_created (project_id, created_at),
        INDEX idx_project_audit_organization_id (organization_id),
        CONSTRAINT fk_project_audit_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_project_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_project_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE project_audit_logs');
    await queryRunner.query('DROP TABLE projects');
  }
}
