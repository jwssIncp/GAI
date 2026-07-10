import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogAssets1740200000001 implements MigrationInterface {
  name = 'CreateCatalogAssets1740200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE catalog_assets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        description VARCHAR(255) NOT NULL,
        description_normalized VARCHAR(255) NOT NULL,
        category VARCHAR(100) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        metadata JSON NULL,
        created_by_id BIGINT UNSIGNED NULL,
        updated_by_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_catalog_assets_org_status (organization_id, status),
        INDEX idx_catalog_assets_org_category (organization_id, category),
        INDEX idx_catalog_assets_created_by_id (created_by_id),
        INDEX idx_catalog_assets_updated_by_id (updated_by_id),
        UNIQUE INDEX uq_catalog_assets_org_description_normalized (organization_id, description_normalized),
        CONSTRAINT fk_catalog_assets_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_catalog_assets_created_by FOREIGN KEY (created_by_id) REFERENCES users(id),
        CONSTRAINT fk_catalog_assets_updated_by FOREIGN KEY (updated_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE catalog_asset_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        catalog_asset_id BIGINT UNSIGNED NOT NULL,
        organization_id BIGINT UNSIGNED NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_catalog_asset_audit_asset_created (catalog_asset_id, created_at),
        INDEX idx_catalog_asset_audit_organization_id (organization_id),
        CONSTRAINT fk_catalog_asset_audit_asset FOREIGN KEY (catalog_asset_id) REFERENCES catalog_assets(id),
        CONSTRAINT fk_catalog_asset_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_catalog_asset_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE catalog_asset_audit_logs');
    await queryRunner.query('DROP TABLE catalog_assets');
  }
}
