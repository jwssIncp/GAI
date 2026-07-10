import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryItemImages1740100000001 implements MigrationInterface {
  name = 'CreateInventoryItemImages1740100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inventory_item_images (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        inventory_item_id BIGINT UNSIGNED NOT NULL,
        storage_provider VARCHAR(30) NOT NULL,
        bucket VARCHAR(255) NOT NULL,
        path VARCHAR(1024) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes BIGINT UNSIGNED NOT NULL,
        checksum VARCHAR(128) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending_upload',
        uploaded_by_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_inventory_item_images_item_status (inventory_item_id, status),
        INDEX idx_inventory_item_images_organization_item (organization_id, inventory_item_id),
        INDEX idx_inventory_item_images_uploaded_by_id (uploaded_by_id),
        CONSTRAINT fk_inventory_item_images_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_inventory_item_images_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
        CONSTRAINT fk_inventory_item_images_uploaded_by FOREIGN KEY (uploaded_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE inventory_item_image_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        inventory_item_image_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        inventory_item_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_inventory_item_image_audit_image_created (inventory_item_image_id, created_at),
        INDEX idx_inventory_item_image_audit_item_created (inventory_item_id, created_at),
        INDEX idx_inventory_item_image_audit_organization_id (organization_id),
        CONSTRAINT fk_inventory_item_image_audit_image FOREIGN KEY (inventory_item_image_id) REFERENCES inventory_item_images(id),
        CONSTRAINT fk_inventory_item_image_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_inventory_item_image_audit_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
        CONSTRAINT fk_inventory_item_image_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE inventory_item_image_audit_logs');
    await queryRunner.query('DROP TABLE inventory_item_images');
  }
}
