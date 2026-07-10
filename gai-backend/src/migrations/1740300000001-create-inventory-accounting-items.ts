import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryAccountingItems1740300000001 implements MigrationInterface {
  name = 'CreateInventoryAccountingItems1740300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE accounting_import_batches (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        original_file_name VARCHAR(255) NOT NULL,
        storage_provider VARCHAR(50) NULL,
        bucket VARCHAR(255) NULL,
        path VARCHAR(500) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        total_rows INT UNSIGNED NOT NULL DEFAULT 0,
        processed_rows INT UNSIGNED NOT NULL DEFAULT 0,
        success_rows INT UNSIGNED NOT NULL DEFAULT 0,
        failed_rows INT UNSIGNED NOT NULL DEFAULT 0,
        error_report_path VARCHAR(500) NULL,
        imported_by_id BIGINT UNSIGNED NULL,
        started_at DATETIME(3) NULL,
        finished_at DATETIME(3) NULL,
        metadata JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_accounting_import_batches_project_status (project_id, status),
        INDEX idx_accounting_import_batches_organization_project (organization_id, project_id),
        CONSTRAINT fk_accounting_import_batches_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_accounting_import_batches_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_accounting_import_batches_imported_by FOREIGN KEY (imported_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE inventory_accounting_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        plate VARCHAR(100) NULL,
        description TEXT NULL,
        accounting_account_description TEXT NULL,
        location TEXT NULL,
        acquisition_date DATE NULL,
        acquisition_value DECIMAL(15,2) NULL,
        base_code VARCHAR(100) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        investor_code VARCHAR(100) NULL,
        note_1 TEXT NULL,
        note_2 TEXT NULL,
        new_inventory_plate VARCHAR(100) NULL,
        inventory_description TEXT NULL,
        inventory_location TEXT NULL,
        metadata JSON NULL,
        imported_by_id BIGINT UNSIGNED NULL,
        import_batch_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_inventory_accounting_items_project_status (project_id, status),
        INDEX idx_inventory_accounting_items_organization_project (organization_id, project_id),
        INDEX idx_inventory_accounting_items_plate (plate),
        INDEX idx_inventory_accounting_items_base_code (base_code),
        INDEX idx_inventory_accounting_items_investor_code (investor_code),
        INDEX idx_inventory_accounting_items_import_batch_id (import_batch_id),
        CONSTRAINT fk_inventory_accounting_items_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_inventory_accounting_items_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_inventory_accounting_items_imported_by FOREIGN KEY (imported_by_id) REFERENCES users(id),
        CONSTRAINT fk_inventory_accounting_items_import_batch FOREIGN KEY (import_batch_id) REFERENCES accounting_import_batches(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE inventory_accounting_item_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        inventory_accounting_item_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_inventory_accounting_item_audit_item_created (inventory_accounting_item_id, created_at),
        INDEX idx_inventory_accounting_item_audit_project_created (project_id, created_at),
        INDEX idx_inventory_accounting_item_audit_organization_id (organization_id),
        CONSTRAINT fk_inventory_accounting_item_audit_item FOREIGN KEY (inventory_accounting_item_id) REFERENCES inventory_accounting_items(id),
        CONSTRAINT fk_inventory_accounting_item_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_inventory_accounting_item_audit_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_inventory_accounting_item_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE inventory_accounting_item_audit_logs');
    await queryRunner.query('DROP TABLE inventory_accounting_items');
    await queryRunner.query('DROP TABLE accounting_import_batches');
  }
}
