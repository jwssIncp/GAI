import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryOperations1741200000001 implements MigrationInterface {
  name = 'CreateInventoryOperations1741200000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE inventory_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      started_at DATETIME(3) NULL,
      finished_at DATETIME(3) NULL,
      created_by_id BIGINT UNSIGNED NULL,
      metadata JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX idx_inventory_sessions_org_project (organization_id, project_id),
      INDEX idx_inventory_sessions_project_status (project_id, status),
      CONSTRAINT fk_inventory_sessions_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_inventory_sessions_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_inventory_sessions_created_by FOREIGN KEY (created_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE inventory_rounds (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      session_id BIGINT UNSIGNED NOT NULL,
      round_number INT UNSIGNED NOT NULL,
      kind VARCHAR(20) NOT NULL,
      inventory_item_id BIGINT UNSIGNED NULL,
      reason TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      requested_by_id BIGINT UNSIGNED NULL,
      started_at DATETIME(3) NOT NULL,
      finished_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE INDEX uq_inventory_rounds_session_number (session_id, round_number),
      INDEX idx_inventory_rounds_target (inventory_item_id, status),
      CONSTRAINT fk_inventory_rounds_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_inventory_rounds_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_inventory_rounds_session FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
      CONSTRAINT fk_inventory_rounds_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
      CONSTRAINT fk_inventory_rounds_requested_by FOREIGN KEY (requested_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE inventory_observations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      session_id BIGINT UNSIGNED NOT NULL,
      round_id BIGINT UNSIGNED NOT NULL,
      inventory_item_id BIGINT UNSIGNED NOT NULL,
      field_agent_id BIGINT UNSIGNED NOT NULL,
      prior_observation_id BIGINT UNSIGNED NULL,
      idempotency_key VARCHAR(100) NULL,
      result VARCHAR(30) NOT NULL,
      observed_plate VARCHAR(100) NULL,
      observed_serial_number VARCHAR(100) NULL,
      unit_text VARCHAR(255) NULL,
      sector_text VARCHAR(255) NULL,
      location_text TEXT NULL,
      notes TEXT NULL,
      captured_at DATETIME(3) NOT NULL,
      received_at DATETIME(3) NOT NULL,
      created_by_id BIGINT UNSIGNED NULL,
      PRIMARY KEY (id),
      UNIQUE INDEX uq_inventory_observations_org_idempotency (organization_id, idempotency_key),
      UNIQUE INDEX uq_inventory_observations_round_item (round_id, inventory_item_id),
      INDEX idx_inventory_observations_item_captured (inventory_item_id, captured_at),
      CONSTRAINT fk_inventory_observations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_inventory_observations_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_inventory_observations_session FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
      CONSTRAINT fk_inventory_observations_round FOREIGN KEY (round_id) REFERENCES inventory_rounds(id),
      CONSTRAINT fk_inventory_observations_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
      CONSTRAINT fk_inventory_observations_agent FOREIGN KEY (field_agent_id) REFERENCES field_agents(id),
      CONSTRAINT fk_inventory_observations_prior FOREIGN KEY (prior_observation_id) REFERENCES inventory_observations(id),
      CONSTRAINT fk_inventory_observations_created_by FOREIGN KEY (created_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE inventory_plate_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      inventory_item_id BIGINT UNSIGNED NOT NULL,
      observation_id BIGINT UNSIGNED NULL,
      previous_plate VARCHAR(100) NULL,
      observed_plate VARCHAR(100) NULL,
      source VARCHAR(30) NOT NULL,
      recorded_by_id BIGINT UNSIGNED NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX idx_inventory_plate_history_item_created (inventory_item_id, created_at),
      CONSTRAINT fk_inventory_plate_history_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_inventory_plate_history_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_inventory_plate_history_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
      CONSTRAINT fk_inventory_plate_history_observation FOREIGN KEY (observation_id) REFERENCES inventory_observations(id),
      CONSTRAINT fk_inventory_plate_history_actor FOREIGN KEY (recorded_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE inventory_reconciliations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      session_id BIGINT UNSIGNED NOT NULL,
      run_number INT UNSIGNED NOT NULL,
      inventory_item_id BIGINT UNSIGNED NULL,
      observation_id BIGINT UNSIGNED NULL,
      accounting_item_id BIGINT UNSIGNED NULL,
      status VARCHAR(30) NOT NULL,
      physical_plate VARCHAR(100) NULL,
      accounting_plate VARCHAR(100) NULL,
      evidence JSON NOT NULL,
      created_by_id BIGINT UNSIGNED NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX idx_inventory_reconciliations_session_run (session_id, run_number),
      INDEX idx_inventory_reconciliations_item_status (inventory_item_id, status),
      CONSTRAINT fk_inventory_reconciliations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_inventory_reconciliations_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_inventory_reconciliations_session FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
      CONSTRAINT fk_inventory_reconciliations_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
      CONSTRAINT fk_inventory_reconciliations_observation FOREIGN KEY (observation_id) REFERENCES inventory_observations(id),
      CONSTRAINT fk_inventory_reconciliations_accounting FOREIGN KEY (accounting_item_id) REFERENCES inventory_accounting_items(id),
      CONSTRAINT fk_inventory_reconciliations_actor FOREIGN KEY (created_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE inventory_consolidations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      session_id BIGINT UNSIGNED NOT NULL,
      reconciliation_id BIGINT UNSIGNED NOT NULL,
      inventory_item_id BIGINT UNSIGNED NULL,
      decision VARCHAR(20) NOT NULL,
      notes TEXT NULL,
      evidence_snapshot JSON NOT NULL,
      decided_by_id BIGINT UNSIGNED NULL,
      decided_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE INDEX uq_inventory_consolidations_reconciliation (reconciliation_id),
      CONSTRAINT fk_inventory_consolidations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_inventory_consolidations_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_inventory_consolidations_session FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
      CONSTRAINT fk_inventory_consolidations_reconciliation FOREIGN KEY (reconciliation_id) REFERENCES inventory_reconciliations(id),
      CONSTRAINT fk_inventory_consolidations_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
      CONSTRAINT fk_inventory_consolidations_actor FOREIGN KEY (decided_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE asset_valuations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      inventory_item_id BIGINT UNSIGNED NOT NULL,
      source VARCHAR(255) NOT NULL,
      new_value DECIMAL(15,2) NULL,
      used_value DECIMAL(15,2) NULL,
      valuation_date DATE NOT NULL,
      notes TEXT NULL,
      responsible_by_id BIGINT UNSIGNED NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX idx_asset_valuations_item_date (inventory_item_id, valuation_date),
      CONSTRAINT fk_asset_valuations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_asset_valuations_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_asset_valuations_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
      CONSTRAINT fk_asset_valuations_actor FOREIGN KEY (responsible_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await queryRunner.query(`CREATE TABLE inventory_operation_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL,
      entity VARCHAR(50) NOT NULL,
      entity_id BIGINT UNSIGNED NULL,
      operation VARCHAR(60) NOT NULL,
      performed_by BIGINT UNSIGNED NULL,
      changes JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX idx_inventory_operation_audit_project_created (project_id, created_at),
      CONSTRAINT fk_inventory_operation_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_inventory_operation_audit_project FOREIGN KEY (project_id) REFERENCES projects(id),
      CONSTRAINT fk_inventory_operation_audit_actor FOREIGN KEY (performed_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE inventory_operation_audit_logs');
    await queryRunner.query('DROP TABLE asset_valuations');
    await queryRunner.query('DROP TABLE inventory_consolidations');
    await queryRunner.query('DROP TABLE inventory_reconciliations');
    await queryRunner.query('DROP TABLE inventory_plate_history');
    await queryRunner.query('DROP TABLE inventory_observations');
    await queryRunner.query('DROP TABLE inventory_rounds');
    await queryRunner.query('DROP TABLE inventory_sessions');
  }
}
