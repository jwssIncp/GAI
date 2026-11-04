import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateAssistedReconciliation1793300000001 implements MigrationInterface {
  name = 'CreateAssistedReconciliation1793300000001';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE inventory_accounting_items ADD serial_number VARCHAR(100) NULL',
    );
    await q.query(
      'CREATE INDEX idx_assisted_latest_observation ON inventory_observations (project_id,session_id,inventory_item_id,captured_at,id)',
    );
    const common =
      'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, session_id BIGINT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id)';
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(`CREATE TABLE assisted_reconciliation_runs (${common}, config JSON NOT NULL, source_hash VARCHAR(64) NOT NULL, after_item_id BIGINT UNSIGNED NOT NULL, next_item_id BIGINT UNSIGNED NULL, summary JSON NOT NULL, created_by_id BIGINT UNSIGNED NOT NULL,
      UNIQUE KEY uq_assisted_run_scope(id,organization_id,project_id,session_id), INDEX idx_assisted_runs_scope(organization_id,project_id,session_id,id), FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(session_id) REFERENCES inventory_sessions(id), FOREIGN KEY(created_by_id) REFERENCES users(id)) ${engine}`);
    await q.query(`CREATE TABLE assisted_reconciliation_candidates (${common}, run_id BIGINT UNSIGNED NOT NULL, inventory_item_id BIGINT UNSIGNED NOT NULL, accounting_item_id BIGINT UNSIGNED NULL, physical JSON NOT NULL, accounting JSON NULL, evidence JSON NULL, warnings JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', revision INT NOT NULL DEFAULT 1,
      UNIQUE KEY uq_assisted_candidate_scope(id,organization_id,project_id,session_id), UNIQUE KEY uq_assisted_candidate_pair(run_id,inventory_item_id,accounting_item_id), INDEX idx_assisted_candidates_run(run_id,id), FOREIGN KEY(run_id,organization_id,project_id,session_id) REFERENCES assisted_reconciliation_runs(id,organization_id,project_id,session_id), FOREIGN KEY(inventory_item_id) REFERENCES inventory_items(id), FOREIGN KEY(accounting_item_id) REFERENCES inventory_accounting_items(id)) ${engine}`);
    await q.query(`CREATE TABLE assisted_reconciliation_decisions (${common}, candidate_id BIGINT UNSIGNED NOT NULL, command_key VARCHAR(80) NOT NULL, fingerprint VARCHAR(64) NOT NULL, action VARCHAR(20) NOT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, revision INT NOT NULL, source_hash VARCHAR(64) NOT NULL, reconciliation_id BIGINT UNSIGNED NULL, result JSON NOT NULL,
      INDEX idx_assisted_decision_candidate(candidate_id,id), UNIQUE KEY uq_assisted_decision_command(organization_id,project_id,command_key), FOREIGN KEY(candidate_id,organization_id,project_id,session_id) REFERENCES assisted_reconciliation_candidates(id,organization_id,project_id,session_id), FOREIGN KEY(actor_id) REFERENCES users(id), FOREIGN KEY(reconciliation_id) REFERENCES inventory_reconciliations(id)) ${engine}`);
    await q.query(`CREATE TABLE assisted_reconciliation_claims (${common}, candidate_id BIGINT UNSIGNED NOT NULL, inventory_item_id BIGINT UNSIGNED NOT NULL, accounting_item_id BIGINT UNSIGNED NOT NULL,
      UNIQUE KEY uq_assisted_claim_accounting(project_id,accounting_item_id), UNIQUE KEY uq_assisted_claim_physical(project_id,inventory_item_id), FOREIGN KEY(candidate_id,organization_id,project_id,session_id) REFERENCES assisted_reconciliation_candidates(id,organization_id,project_id,session_id), FOREIGN KEY(inventory_item_id) REFERENCES inventory_items(id), FOREIGN KEY(accounting_item_id) REFERENCES inventory_accounting_items(id)) ${engine}`);
    for (const action of ['read', 'generate', 'review'])
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
        [
          `assisted-reconciliation:${action}`,
          'assisted-reconciliation',
          action,
          'ORGANIZATION',
          `Conciliação assistida: ${action}`,
        ],
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const name of ['claims', 'decisions', 'candidates', 'runs'])
      await q.query(`DROP TABLE assisted_reconciliation_${name}`);
    await q.query(
      'DROP INDEX idx_assisted_latest_observation ON inventory_observations',
    );
    await q.query(
      'ALTER TABLE inventory_accounting_items DROP COLUMN serial_number',
    );
  }
}
