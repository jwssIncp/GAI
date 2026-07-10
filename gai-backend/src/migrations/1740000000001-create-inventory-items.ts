import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryItems1740000000001 implements MigrationInterface {
  name = 'CreateInventoryItems1740000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inventory_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        external_item_id VARCHAR(100) NULL,
        sequence VARCHAR(50) NULL,
        old_plate VARCHAR(100) NULL,
        new_plate VARCHAR(100) NULL,
        unit_text VARCHAR(255) NULL,
        address_text TEXT NULL,
        location_text TEXT NULL,
        description TEXT NULL,
        brand VARCHAR(100) NULL,
        model VARCHAR(100) NULL,
        serial_number VARCHAR(100) NULL,
        capacity VARCHAR(100) NULL,
        year INT NULL,
        notes TEXT NULL,
        source VARCHAR(50) NULL,
        used_value DECIMAL(15,2) NULL,
        new_value DECIMAL(15,2) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        metadata JSON NULL,
        created_by_id BIGINT UNSIGNED NULL,
        updated_by_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_inventory_items_project_status (project_id, status),
        INDEX idx_inventory_items_organization_project (organization_id, project_id),
        INDEX idx_inventory_items_old_plate (old_plate),
        INDEX idx_inventory_items_new_plate (new_plate),
        INDEX idx_inventory_items_external_item_id (external_item_id),
        INDEX idx_inventory_items_created_by_id (created_by_id),
        INDEX idx_inventory_items_updated_by_id (updated_by_id),
        CONSTRAINT fk_inventory_items_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_inventory_items_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_inventory_items_created_by FOREIGN KEY (created_by_id) REFERENCES users(id),
        CONSTRAINT fk_inventory_items_updated_by FOREIGN KEY (updated_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE inventory_item_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        inventory_item_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_inventory_item_audit_item_created (inventory_item_id, created_at),
        INDEX idx_inventory_item_audit_project_created (project_id, created_at),
        INDEX idx_inventory_item_audit_organization_id (organization_id),
        CONSTRAINT fk_inventory_item_audit_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
        CONSTRAINT fk_inventory_item_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_inventory_item_audit_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_inventory_item_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE inventory_item_audit_logs');
    await queryRunner.query('DROP TABLE inventory_items');
  }
}
