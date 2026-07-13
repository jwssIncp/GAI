import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExportJobs1741000000001 implements MigrationInterface {
  name = 'CreateExportJobs1741000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE export_jobs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        type VARCHAR(60) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        file_name VARCHAR(255) NULL,
        mime_type VARCHAR(120) NULL,
        size_bytes BIGINT UNSIGNED NULL,
        file_content MEDIUMBLOB NULL,
        checksum VARCHAR(64) NULL,
        requested_by_id BIGINT UNSIGNED NULL,
        retry_of_id BIGINT UNSIGNED NULL,
        attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
        requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        started_at DATETIME(3) NULL,
        finished_at DATETIME(3) NULL,
        expires_at DATETIME(3) NULL,
        error_code VARCHAR(100) NULL,
        error_message TEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_export_jobs_org_project_status (organization_id, project_id, status),
        INDEX idx_export_jobs_project_type_created (project_id, type, created_at),
        INDEX idx_export_jobs_status_created (status, created_at),
        INDEX idx_export_jobs_expires_at (expires_at),
        CONSTRAINT fk_export_jobs_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_export_jobs_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_export_jobs_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id),
        CONSTRAINT fk_export_jobs_retry_of FOREIGN KEY (retry_of_id) REFERENCES export_jobs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE export_job_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        export_job_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_export_job_audit_job_created (export_job_id, created_at),
        INDEX idx_export_job_audit_org_project (organization_id, project_id),
        CONSTRAINT fk_export_job_audit_job FOREIGN KEY (export_job_id) REFERENCES export_jobs(id),
        CONSTRAINT fk_export_job_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_export_job_audit_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_export_job_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE export_job_audit_logs');
    await queryRunner.query('DROP TABLE export_jobs');
  }
}
