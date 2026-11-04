import { MigrationInterface, QueryRunner } from 'typeorm';
import { FINANCE_PERMISSIONS } from '../modules/receivables/receivable.policy';
export class CreateReceivables1793700000001 implements MigrationInterface {
  name = 'CreateReceivables1793700000001';
  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(
      `CREATE TABLE receivables (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NULL, contract_id BIGINT UNSIGNED NULL, source_key VARCHAR(100) NULL, data JSON NOT NULL, amount DECIMAL(15,2) NOT NULL, currency VARCHAR(3) NOT NULL, revision INT NOT NULL, cancelled BOOLEAN NOT NULL DEFAULT FALSE, created_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_receivable_scope(id,organization_id), UNIQUE KEY uq_receivable_source(organization_id,source_key), INDEX idx_receivable_cohort(organization_id,company_id,project_id), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(company_id) REFERENCES companies(id), FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(contract_id) REFERENCES project_contracts(id), CHECK(amount>0)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE receivable_installments (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, receivable_id BIGINT UNSIGNED NOT NULL, position INT NOT NULL, kind VARCHAR(20) NOT NULL, due_on DATE NOT NULL, amount DECIMAL(15,2) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_receivable_installment_scope(id,receivable_id,organization_id), UNIQUE KEY uq_receivable_position(receivable_id,position), INDEX idx_receivable_due(organization_id,due_on), FOREIGN KEY(receivable_id,organization_id) REFERENCES receivables(id,organization_id), CHECK(amount>0)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE receivable_events (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, receivable_id BIGINT UNSIGNED NOT NULL, installment_id BIGINT UNSIGNED NULL, reverses_id BIGINT UNSIGNED NULL, command_key VARCHAR(100) NOT NULL, command_hash VARCHAR(64) NOT NULL, revision INT NOT NULL, operation VARCHAR(20) NOT NULL, amount DECIMAL(15,2) NULL, effective_on DATE NULL, details JSON NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_receivable_event_scope(id,receivable_id,organization_id), UNIQUE KEY uq_finance_command(organization_id,command_key), UNIQUE KEY uq_receivable_revision(receivable_id,revision), UNIQUE KEY uq_receipt_reversal(reverses_id), FOREIGN KEY(receivable_id,organization_id) REFERENCES receivables(id,organization_id), FOREIGN KEY(installment_id,receivable_id,organization_id) REFERENCES receivable_installments(id,receivable_id,organization_id), FOREIGN KEY(reverses_id,receivable_id,organization_id) REFERENCES receivable_events(id,receivable_id,organization_id), FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    await q.query(
      'ALTER TABLE export_jobs MODIFY project_id BIGINT UNSIGNED NULL, ADD finance_payload JSON NULL',
    );
    await q.query(
      'ALTER TABLE export_job_audit_logs MODIFY project_id BIGINT UNSIGNED NULL',
    );
    for (const key of FINANCE_PERMISSIONS) {
      const [resource, action] = key.split(':');
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
        [key, resource, action, 'ORGANIZATION', 'Financeiro: ' + action],
      );
    }
  }
  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Financial history must be preserved; use an explicitly reviewed forward migration.',
      ),
    );
  }
}
