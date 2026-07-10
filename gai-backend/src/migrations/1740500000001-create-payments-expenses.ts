import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentsExpenses1740500000001 implements MigrationInterface {
  name = 'CreatePaymentsExpenses1740500000001';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE field_agent_payments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, field_agent_id BIGINT UNSIGNED NOT NULL,
      state VARCHAR(2) NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, payment_date DATE NULL, days INT UNSIGNED NOT NULL DEFAULT 0,
      daily_rate DECIMAL(15,2) NOT NULL, additional_amount DECIMAL(15,2) NOT NULL DEFAULT 0, daily_total DECIMAL(15,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0, final_amount DECIMAL(15,2) NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT NULL, approved_by_id BIGINT UNSIGNED NULL, approved_at DATETIME(3) NULL, paid_by_id BIGINT UNSIGNED NULL, paid_at DATETIME(3) NULL,
      created_by_id BIGINT UNSIGNED NULL, updated_by_id BIGINT UNSIGNED NULL, metadata JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id), INDEX idx_field_agent_payments_project_status (project_id, status), INDEX idx_field_agent_payments_field_agent (field_agent_id),
      CONSTRAINT fk_payments_org FOREIGN KEY (organization_id) REFERENCES organizations(id), CONSTRAINT fk_payments_project FOREIGN KEY (project_id) REFERENCES projects(id), CONSTRAINT fk_payments_agent FOREIGN KEY (field_agent_id) REFERENCES field_agents(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await queryRunner.query(`CREATE TABLE expenses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, field_agent_id BIGINT UNSIGNED NULL,
      description TEXT NOT NULL, reason TEXT NULL, expense_date DATE NOT NULL, amount DECIMAL(15,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending',
      approved_by_id BIGINT UNSIGNED NULL, approved_at DATETIME(3) NULL, rejected_by_id BIGINT UNSIGNED NULL, rejected_at DATETIME(3) NULL, paid_by_id BIGINT UNSIGNED NULL, paid_at DATETIME(3) NULL,
      created_by_id BIGINT UNSIGNED NULL, updated_by_id BIGINT UNSIGNED NULL, metadata JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id), INDEX idx_expenses_project_status (project_id, status), INDEX idx_expenses_field_agent (field_agent_id),
      CONSTRAINT fk_expenses_org FOREIGN KEY (organization_id) REFERENCES organizations(id), CONSTRAINT fk_expenses_project FOREIGN KEY (project_id) REFERENCES projects(id), CONSTRAINT fk_expenses_agent FOREIGN KEY (field_agent_id) REFERENCES field_agents(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await queryRunner.query(`CREATE TABLE expense_attachments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, expense_id BIGINT UNSIGNED NOT NULL,
      storage_provider VARCHAR(50) NOT NULL, bucket VARCHAR(255) NOT NULL, path VARCHAR(500) NOT NULL, original_name VARCHAR(255) NOT NULL, mime_type VARCHAR(100) NOT NULL, size_bytes BIGINT UNSIGNED NOT NULL,
      checksum VARCHAR(128) NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending_upload', uploaded_by_id BIGINT UNSIGNED NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id), INDEX idx_expense_attachments_expense_status (expense_id, status),
      CONSTRAINT fk_expense_attachments_org FOREIGN KEY (organization_id) REFERENCES organizations(id), CONSTRAINT fk_expense_attachments_expense FOREIGN KEY (expense_id) REFERENCES expenses(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await queryRunner.query(`CREATE TABLE payment_expense_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, payment_id BIGINT UNSIGNED NULL, expense_id BIGINT UNSIGNED NULL, expense_attachment_id BIGINT UNSIGNED NULL,
      operation VARCHAR(60) NOT NULL, performed_by BIGINT UNSIGNED NULL, changes JSON NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id), INDEX idx_payment_expense_audit_project_created (project_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE payment_expense_audit_logs');
    await queryRunner.query('DROP TABLE expense_attachments');
    await queryRunner.query('DROP TABLE expenses');
    await queryRunner.query('DROP TABLE field_agent_payments');
  }
}
