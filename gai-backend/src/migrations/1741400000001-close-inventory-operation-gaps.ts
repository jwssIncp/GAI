import { MigrationInterface, QueryRunner } from 'typeorm';

export class CloseInventoryOperationGaps1741400000001 implements MigrationInterface {
  name = 'CloseInventoryOperationGaps1741400000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // utf8mb4 InnoDB max index length is 3072 bytes => 768 chars.
    // Prefix unique index keeps VARCHAR(1024) while staying under the limit.
    const sessionsColumns = (await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'inventory_sessions'
           AND COLUMN_NAME IN ('cancelled_at', 'cancellation_reason')`,
    )) as Array<{ COLUMN_NAME: string }>;
    const existing = new Set(sessionsColumns.map((c) => c.COLUMN_NAME));
    if (!existing.has('cancelled_at')) {
      await queryRunner.query(`ALTER TABLE inventory_sessions
        ADD COLUMN cancelled_at DATETIME(3) NULL AFTER finished_at`);
    }
    if (!existing.has('cancellation_reason')) {
      await queryRunner.query(`ALTER TABLE inventory_sessions
        ADD COLUMN cancellation_reason TEXT NULL AFTER cancelled_at`);
    }

    await queryRunner.query(`CREATE TABLE inventory_observation_evidence (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      session_id BIGINT UNSIGNED NOT NULL,
      round_id BIGINT UNSIGNED NOT NULL,
      observation_id BIGINT UNSIGNED NOT NULL,
      storage_provider VARCHAR(30) NOT NULL,
      bucket VARCHAR(255) NOT NULL,
      storage_key VARCHAR(1024) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes BIGINT UNSIGNED NOT NULL,
      checksum VARCHAR(128) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending_upload',
      created_by_id BIGINT UNSIGNED NULL,
      confirmed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX uq_inventory_observation_evidence_storage_key (storage_key(768)),
      INDEX idx_inventory_observation_evidence_observation_created (observation_id, created_at),
      INDEX idx_inventory_observation_evidence_scope (organization_id, project_id, session_id, round_id),
      CONSTRAINT fk_inventory_observation_evidence_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_inventory_observation_evidence_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_inventory_observation_evidence_session FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
      CONSTRAINT fk_inventory_observation_evidence_round FOREIGN KEY (round_id) REFERENCES inventory_rounds(id),
      CONSTRAINT fk_inventory_observation_evidence_observation FOREIGN KEY (observation_id) REFERENCES inventory_observations(id),
      CONSTRAINT fk_inventory_observation_evidence_actor FOREIGN KEY (created_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE inventory_observation_evidence');
    await queryRunner.query(`ALTER TABLE inventory_sessions
      DROP COLUMN cancellation_reason,
      DROP COLUMN cancelled_at`);
  }
}
