import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateValuationBatches1793400000001 implements MigrationInterface {
  name = 'CreateValuationBatches1793400000001';
  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(
      `CREATE TABLE asset_valuation_batches (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,organization_id BIGINT UNSIGNED NOT NULL,project_id BIGINT UNSIGNED NOT NULL,command_key VARCHAR(80) NOT NULL,fingerprint VARCHAR(64) NOT NULL,preview_hash VARCHAR(64) NOT NULL,request JSON NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'preview',revision INT NOT NULL DEFAULT 1,total INT NOT NULL,created_by_id BIGINT UNSIGNED NOT NULL,confirmed_by_id BIGINT UNSIGNED NULL,confirmed_at DATETIME(3) NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),expires_at DATETIME(3) NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_valuation_batch_scope(id,organization_id,project_id),UNIQUE KEY uq_valuation_batch_command(organization_id,project_id,command_key),INDEX idx_valuation_batches_project(organization_id,project_id,id),FOREIGN KEY(project_id) REFERENCES projects(id),FOREIGN KEY(created_by_id) REFERENCES users(id),FOREIGN KEY(confirmed_by_id) REFERENCES users(id)) ${engine}`,
    );
    await q.query(
      'ALTER TABLE asset_valuations ADD batch_operation_id BIGINT UNSIGNED NULL, ADD UNIQUE INDEX uq_asset_valuation_batch_item(batch_operation_id,inventory_item_id), ADD CONSTRAINT fk_asset_valuation_batch FOREIGN KEY(batch_operation_id,organization_id,project_id) REFERENCES asset_valuation_batches(id,organization_id,project_id)',
    );
    await q.query(
      `CREATE TABLE asset_valuation_batch_rows (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,batch_id BIGINT UNSIGNED NOT NULL,organization_id BIGINT UNSIGNED NOT NULL,project_id BIGINT UNSIGNED NOT NULL,inventory_item_id BIGINT UNSIGNED NOT NULL,snapshot JSON NOT NULL,proposed JSON NOT NULL,valuation_id BIGINT UNSIGNED NULL,PRIMARY KEY(id),UNIQUE KEY uq_valuation_batch_item(batch_id,inventory_item_id),FOREIGN KEY(batch_id,organization_id,project_id) REFERENCES asset_valuation_batches(id,organization_id,project_id),FOREIGN KEY(inventory_item_id) REFERENCES inventory_items(id),FOREIGN KEY(valuation_id) REFERENCES asset_valuations(id)) ${engine}`,
    );
    await q.query(
      'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
      [
        'asset-valuations:batch-create',
        'asset-valuations',
        'batch-create',
        'ORGANIZATION',
        'Registrar avaliações patrimoniais em lote',
      ],
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE asset_valuation_batch_rows');
    await q.query(
      'ALTER TABLE asset_valuations DROP FOREIGN KEY fk_asset_valuation_batch, DROP INDEX uq_asset_valuation_batch_item, DROP COLUMN batch_operation_id',
    );
    await q.query('DROP TABLE asset_valuation_batches');
  }
}
