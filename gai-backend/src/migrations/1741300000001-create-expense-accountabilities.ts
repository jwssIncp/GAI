import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateExpenseAccountabilities1741300000001 implements MigrationInterface {
  name = 'CreateExpenseAccountabilities1741300000001';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE expense_accountabilities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL, field_agent_id BIGINT UNSIGNED NOT NULL,
      period_start DATE NOT NULL, period_end DATE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open',
      total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00, notes TEXT NULL,
      responsible_by_id BIGINT UNSIGNED NULL, closed_by_id BIGINT UNSIGNED NULL, closed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY(id), INDEX idx_expense_accountabilities_project_status(project_id,status),
      CONSTRAINT fk_expense_accountabilities_org FOREIGN KEY(organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_expense_accountabilities_project FOREIGN KEY(project_id) REFERENCES projects(id),
      CONSTRAINT fk_expense_accountabilities_agent FOREIGN KEY(field_agent_id) REFERENCES field_agents(id),
      CONSTRAINT fk_expense_accountabilities_responsible FOREIGN KEY(responsible_by_id) REFERENCES users(id),
      CONSTRAINT fk_expense_accountabilities_closed_by FOREIGN KEY(closed_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE expense_accountability_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL, accountability_id BIGINT UNSIGNED NOT NULL, expense_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
      UNIQUE INDEX uq_expense_accountability_items_expense(expense_id),
      CONSTRAINT fk_expense_accountability_items_org FOREIGN KEY(organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_expense_accountability_items_project FOREIGN KEY(project_id) REFERENCES projects(id),
      CONSTRAINT fk_expense_accountability_items_parent FOREIGN KEY(accountability_id) REFERENCES expense_accountabilities(id),
      CONSTRAINT fk_expense_accountability_items_expense FOREIGN KEY(expense_id) REFERENCES expenses(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE expense_installments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL, expense_id BIGINT UNSIGNED NOT NULL,
      installment_number INT UNSIGNED NOT NULL, installment_count INT UNSIGNED NOT NULL,
      due_date DATE NOT NULL, amount DECIMAL(15,2) NOT NULL, origin VARCHAR(255) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
      UNIQUE INDEX uq_expense_installments_expense_number(expense_id,installment_number),
      CONSTRAINT fk_expense_installments_org FOREIGN KEY(organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_expense_installments_project FOREIGN KEY(project_id) REFERENCES projects(id),
      CONSTRAINT fk_expense_installments_expense FOREIGN KEY(expense_id) REFERENCES expenses(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE expense_accountability_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL, accountability_id BIGINT UNSIGNED NULL, expense_id BIGINT UNSIGNED NULL,
      operation VARCHAR(60) NOT NULL, performed_by BIGINT UNSIGNED NULL, changes JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
      INDEX idx_expense_accountability_audit_project(project_id,created_at),
      CONSTRAINT fk_expense_accountability_audit_org FOREIGN KEY(organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_expense_accountability_audit_project FOREIGN KEY(project_id) REFERENCES projects(id),
      CONSTRAINT fk_expense_accountability_audit_parent FOREIGN KEY(accountability_id) REFERENCES expense_accountabilities(id),
      CONSTRAINT fk_expense_accountability_audit_expense FOREIGN KEY(expense_id) REFERENCES expenses(id),
      CONSTRAINT fk_expense_accountability_audit_actor FOREIGN KEY(performed_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE expense_accountability_audit_logs');
    await q.query('DROP TABLE expense_installments');
    await q.query('DROP TABLE expense_accountability_items');
    await q.query('DROP TABLE expense_accountabilities');
  }
}
