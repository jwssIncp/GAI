import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateBudgets1793600000001 implements MigrationInterface {
  name = 'CreateBudgets1793600000001';
  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(
      `CREATE TABLE budget_pricing_versions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, name VARCHAR(100) NOT NULL, version INT NOT NULL, valid_from DATE NOT NULL, valid_to DATE NOT NULL, \`values\` JSON NOT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_budget_pricing_scope(id,organization_id), UNIQUE KEY uq_budget_pricing_version(organization_id,name,version), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE budgets (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NULL, number VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL, revision INT NOT NULL, head_version_id BIGINT UNSIGNED NULL, approved_version_id BIGINT UNSIGNED NULL, created_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_budget_scope(id,organization_id), UNIQUE KEY uq_budget_number(organization_id,number), INDEX idx_budget_list(organization_id,status,id), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(company_id) REFERENCES companies(id), FOREIGN KEY(project_id) REFERENCES projects(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE budget_versions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, budget_id BIGINT UNSIGNED NOT NULL, pricing_id BIGINT UNSIGNED NOT NULL, version INT NOT NULL, kind VARCHAR(20) NOT NULL, name VARCHAR(120) NOT NULL, base_version_id BIGINT UNSIGNED NULL, snapshot JSON NOT NULL, hash VARCHAR(64) NOT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_budget_version_scope(id,budget_id,organization_id), UNIQUE KEY uq_budget_version(budget_id,version), FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id), FOREIGN KEY(pricing_id,organization_id) REFERENCES budget_pricing_versions(id,organization_id), FOREIGN KEY(base_version_id,budget_id,organization_id) REFERENCES budget_versions(id,budget_id,organization_id), FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    await q.query(
      'ALTER TABLE budgets ADD CONSTRAINT fk_budget_head FOREIGN KEY(head_version_id,id,organization_id) REFERENCES budget_versions(id,budget_id,organization_id), ADD CONSTRAINT fk_budget_approved FOREIGN KEY(approved_version_id,id,organization_id) REFERENCES budget_versions(id,budget_id,organization_id)',
    );
    await q.query(
      `CREATE TABLE budget_audit_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, budget_id BIGINT UNSIGNED NOT NULL, revision INT NOT NULL, operation VARCHAR(30) NOT NULL, details JSON NOT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_budget_audit_revision(budget_id,revision), FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id), FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    for (const action of ['read', 'edit', 'configure-prices', 'approve'])
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
        [
          'budgets:' + action,
          'budgets',
          action,
          'ORGANIZATION',
          'Orçamentos: ' + action,
        ],
      );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE budgets DROP FOREIGN KEY fk_budget_head, DROP FOREIGN KEY fk_budget_approved',
    );
    for (const table of [
      'budget_audit_logs',
      'budget_versions',
      'budgets',
      'budget_pricing_versions',
    ])
      await q.query(`DROP TABLE ${table}`);
  }
}
