import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Onda 3. Additive only: second old plate as a real (indexed) column and the
 * server-side content hash of import payloads. No existing row is rewritten;
 * new status values fit the existing varchar(20) columns.
 */
export class MobileReconciliation1794600000001 implements MigrationInterface {
  name = 'MobileReconciliation1794600000001';

  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('inventory_items', 'old_plate_2')))
      await q.query(
        'ALTER TABLE `inventory_items` ADD COLUMN `old_plate_2` VARCHAR(100) NULL AFTER `new_plate`',
      );
    if (
      !(await q.getTable('inventory_items'))!.indices.some(
        (i) => i.name === 'idx_inventory_items_old_plate_2',
      )
    )
      await q.query(
        'CREATE INDEX `idx_inventory_items_old_plate_2` ON `inventory_items` (`old_plate_2`)',
      );
    if (!(await q.hasColumn('import_payloads', 'content_hash')))
      await q.query(
        'ALTER TABLE `import_payloads` ADD COLUMN `content_hash` VARCHAR(64) NULL AFTER `checksum`',
      );
    if (!(await q.hasTable('mobile_idempotency_keys')))
      await q.query(`CREATE TABLE \`mobile_idempotency_keys\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`organization_id\` BIGINT UNSIGNED NOT NULL,
        \`user_id\` BIGINT UNSIGNED NOT NULL,
        \`scope\` VARCHAR(30) NOT NULL,
        \`idempotency_key\` VARCHAR(100) NOT NULL,
        \`request_hash\` VARCHAR(64) NOT NULL,
        \`resource_id\` BIGINT UNSIGNED NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_mobile_idempotency_keys\` (\`organization_id\`, \`scope\`, \`idempotency_key\`),
        CONSTRAINT \`fk_mobile_idempotency_keys_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async down(q: QueryRunner): Promise<void> {
    if (await q.hasTable('mobile_idempotency_keys'))
      await q.query('DROP TABLE `mobile_idempotency_keys`');
    if (await q.hasColumn('import_payloads', 'content_hash'))
      await q.query('ALTER TABLE `import_payloads` DROP COLUMN `content_hash`');
    if (
      (await q.getTable('inventory_items'))!.indices.some(
        (i) => i.name === 'idx_inventory_items_old_plate_2',
      )
    )
      await q.query(
        'DROP INDEX `idx_inventory_items_old_plate_2` ON `inventory_items`',
      );
    if (await q.hasColumn('inventory_items', 'old_plate_2'))
      await q.query('ALTER TABLE `inventory_items` DROP COLUMN `old_plate_2`');
  }
}
