import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryPendingIssues1740400000001 implements MigrationInterface {
  name = 'CreateInventoryPendingIssues1740400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inventory_pending_issues (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        inventory_item_id BIGINT UNSIGNED NULL,
        accounting_item_id BIGINT UNSIGNED NULL,
        type VARCHAR(60) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        old_value JSON NULL,
        new_value JSON NULL,
        resolution_notes TEXT NULL,
        resolved_by_id BIGINT UNSIGNED NULL,
        resolved_at DATETIME(3) NULL,
        ignored_by_id BIGINT UNSIGNED NULL,
        ignored_at DATETIME(3) NULL,
        created_by_id BIGINT UNSIGNED NULL,
        updated_by_id BIGINT UNSIGNED NULL,
        metadata JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_inventory_pending_issues_project_status (project_id, status),
        INDEX idx_inventory_pending_issues_project_type (project_id, type),
        INDEX idx_inventory_pending_issues_inventory_item (inventory_item_id),
        INDEX idx_inventory_pending_issues_accounting_item (accounting_item_id),
        INDEX idx_inventory_pending_issues_org_project (organization_id, project_id),
        CONSTRAINT fk_inventory_pending_issues_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_inventory_pending_issues_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_inventory_pending_issues_inventory_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
        CONSTRAINT fk_inventory_pending_issues_accounting_item FOREIGN KEY (accounting_item_id) REFERENCES inventory_accounting_items(id),
        CONSTRAINT fk_inventory_pending_issues_resolved_by FOREIGN KEY (resolved_by_id) REFERENCES users(id),
        CONSTRAINT fk_inventory_pending_issues_ignored_by FOREIGN KEY (ignored_by_id) REFERENCES users(id),
        CONSTRAINT fk_inventory_pending_issues_created_by FOREIGN KEY (created_by_id) REFERENCES users(id),
        CONSTRAINT fk_inventory_pending_issues_updated_by FOREIGN KEY (updated_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE inventory_pending_issue_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        inventory_pending_issue_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_inventory_pending_issue_audit_issue_created (inventory_pending_issue_id, created_at),
        INDEX idx_inventory_pending_issue_audit_project_created (project_id, created_at),
        INDEX idx_inventory_pending_issue_audit_organization_id (organization_id),
        CONSTRAINT fk_inventory_pending_issue_audit_issue FOREIGN KEY (inventory_pending_issue_id) REFERENCES inventory_pending_issues(id),
        CONSTRAINT fk_inventory_pending_issue_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_inventory_pending_issue_audit_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_inventory_pending_issue_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE inventory_pending_issue_audit_logs');
    await queryRunner.query('DROP TABLE inventory_pending_issues');
  }
}
