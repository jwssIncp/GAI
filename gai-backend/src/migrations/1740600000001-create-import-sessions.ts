import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateImportSessions1740600000001 implements MigrationInterface {
  name = 'CreateImportSessions1740600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE import_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL,
      type VARCHAR(40) NOT NULL, source VARCHAR(30) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open', session_uuid VARCHAR(64) NOT NULL,
      expected_payloads INT UNSIGNED NULL, received_payloads INT UNSIGNED NOT NULL DEFAULT 0, processed_payloads INT UNSIGNED NOT NULL DEFAULT 0, failed_payloads INT UNSIGNED NOT NULL DEFAULT 0,
      total_items INT UNSIGNED NOT NULL DEFAULT 0, total_images INT UNSIGNED NOT NULL DEFAULT 0, total_created INT UNSIGNED NOT NULL DEFAULT 0, total_updated INT UNSIGNED NOT NULL DEFAULT 0,
      total_deleted INT UNSIGNED NOT NULL DEFAULT 0, total_failed INT UNSIGNED NOT NULL DEFAULT 0, raw_backup_path VARCHAR(500) NULL, created_by_id BIGINT UNSIGNED NULL,
      started_at DATETIME(3) NULL, finished_at DATETIME(3) NULL, expires_at DATETIME(3) NULL, error_message TEXT NULL, metadata JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id), UNIQUE INDEX idx_import_sessions_session_uuid (session_uuid), INDEX idx_import_sessions_org_project_status (organization_id, project_id, status), INDEX idx_import_sessions_project_created (project_id, created_at),
      CONSTRAINT fk_import_sessions_org FOREIGN KEY (organization_id) REFERENCES organizations(id), CONSTRAINT fk_import_sessions_project FOREIGN KEY (project_id) REFERENCES projects(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await queryRunner.query(`CREATE TABLE import_payloads (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, import_session_id BIGINT UNSIGNED NOT NULL,
      payload_number INT UNSIGNED NOT NULL, idempotency_key VARCHAR(128) NOT NULL, checksum VARCHAR(128) NULL, status VARCHAR(20) NOT NULL DEFAULT 'received',
      items_count INT UNSIGNED NOT NULL DEFAULT 0, images_count INT UNSIGNED NOT NULL DEFAULT 0, created_count INT UNSIGNED NOT NULL DEFAULT 0, updated_count INT UNSIGNED NOT NULL DEFAULT 0,
      deleted_count INT UNSIGNED NOT NULL DEFAULT 0, failed_count INT UNSIGNED NOT NULL DEFAULT 0, raw_payload_path VARCHAR(500) NULL, received_at DATETIME(3) NOT NULL, processed_at DATETIME(3) NULL,
      error_message TEXT NULL, metadata JSON NULL, payload JSON NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id), UNIQUE INDEX idx_import_payloads_session_number (import_session_id, payload_number), UNIQUE INDEX idx_import_payloads_session_key (import_session_id, idempotency_key), INDEX idx_import_payloads_org_status (organization_id, status),
      CONSTRAINT fk_import_payloads_org FOREIGN KEY (organization_id) REFERENCES organizations(id), CONSTRAINT fk_import_payloads_session FOREIGN KEY (import_session_id) REFERENCES import_sessions(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await queryRunner.query(`CREATE TABLE import_payload_errors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, import_session_id BIGINT UNSIGNED NOT NULL, import_payload_id BIGINT UNSIGNED NOT NULL,
      \`row_number\` INT UNSIGNED NULL, item_reference VARCHAR(150) NULL, error_code VARCHAR(80) NOT NULL, error_message TEXT NOT NULL, raw_data JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (id), INDEX idx_import_payload_errors_session (import_session_id, created_at), INDEX idx_import_payload_errors_payload (import_payload_id, created_at),
      CONSTRAINT fk_import_payload_errors_org FOREIGN KEY (organization_id) REFERENCES organizations(id), CONSTRAINT fk_import_payload_errors_session FOREIGN KEY (import_session_id) REFERENCES import_sessions(id), CONSTRAINT fk_import_payload_errors_payload FOREIGN KEY (import_payload_id) REFERENCES import_payloads(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await queryRunner.query(`CREATE TABLE import_files (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, import_session_id BIGINT UNSIGNED NOT NULL, import_payload_id BIGINT UNSIGNED NULL,
      type VARCHAR(30) NOT NULL, storage_provider VARCHAR(50) NOT NULL, bucket VARCHAR(255) NOT NULL, path VARCHAR(500) NOT NULL, original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL, size_bytes BIGINT UNSIGNED NOT NULL, checksum VARCHAR(128) NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending_upload', uploaded_by_id BIGINT UNSIGNED NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id), INDEX idx_import_files_session_status (import_session_id, status),
      CONSTRAINT fk_import_files_org FOREIGN KEY (organization_id) REFERENCES organizations(id), CONSTRAINT fk_import_files_session FOREIGN KEY (import_session_id) REFERENCES import_sessions(id), CONSTRAINT fk_import_files_payload FOREIGN KEY (import_payload_id) REFERENCES import_payloads(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await queryRunner.query(`CREATE TABLE import_session_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, import_session_id BIGINT UNSIGNED NULL, import_payload_id BIGINT UNSIGNED NULL, import_file_id BIGINT UNSIGNED NULL,
      operation VARCHAR(60) NOT NULL, performed_by BIGINT UNSIGNED NULL, changes JSON NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id), INDEX idx_import_session_audit_project_created (project_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE import_session_audit_logs');
    await queryRunner.query('DROP TABLE import_files');
    await queryRunner.query('DROP TABLE import_payload_errors');
    await queryRunner.query('DROP TABLE import_payloads');
    await queryRunner.query('DROP TABLE import_sessions');
  }
}
