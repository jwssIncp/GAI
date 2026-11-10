import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Onda 2 (mobile item sync). Preflight first (MySQL DDL is not transactional):
 * if any (project_id, external_item_id) is duplicated the migration stops with
 * an explicit error and changes nothing. Duplicates are never merged or
 * deleted automatically; see docs/onda-2-sincronizacao-mobile (saneamento).
 * Existing rows keep sync_seq = 0 (no historical row is rewritten); NULL
 * external ids are not constrained.
 */
export class MobileItemSync1794500000001 implements MigrationInterface {
  name = 'MobileItemSync1794500000001';

  async up(q: QueryRunner): Promise<void> {
    const duplicates = (await q.query(
      `SELECT project_id, external_item_id, COUNT(*) AS total
         FROM inventory_items
        WHERE external_item_id IS NOT NULL
        GROUP BY project_id, external_item_id
       HAVING COUNT(*) > 1
        LIMIT 20`,
    )) as Array<{
      project_id: number;
      external_item_id: string;
      total: number;
    }>;
    if (duplicates.length)
      throw new Error(
        `MobileItemSync preflight failed: ${duplicates.length}${duplicates.length === 20 ? '+' : ''} duplicated (project_id, external_item_id) group(s), e.g. project ${duplicates[0].project_id}. ` +
          'Run `npm run items:external-duplicates` and follow the saneamento procedure in docs/onda-2-sincronizacao-mobile/README.md. No data or schema was changed.',
      );
    if (!(await q.hasColumn('inventory_items', 'sync_seq')))
      await q.query(
        'ALTER TABLE `inventory_items` ADD COLUMN `sync_seq` BIGINT UNSIGNED NOT NULL DEFAULT 0',
      );
    if (!(await q.hasTable('inventory_item_sync_counters')))
      await q.query(`CREATE TABLE \`inventory_item_sync_counters\` (
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`last_seq\` BIGINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (\`project_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    const indices = (await q.getTable('inventory_items'))!.indices.map(
      (i) => i.name,
    );
    if (!indices.includes('uq_inventory_items_project_external'))
      await q.query(
        'CREATE UNIQUE INDEX `uq_inventory_items_project_external` ON `inventory_items` (`project_id`, `external_item_id`)',
      );
    if (!indices.includes('idx_inventory_items_project_sync'))
      await q.query(
        'CREATE INDEX `idx_inventory_items_project_sync` ON `inventory_items` (`project_id`, `sync_seq`, `id`)',
      );
  }

  async down(q: QueryRunner): Promise<void> {
    const indices = (await q.getTable('inventory_items'))!.indices.map(
      (i) => i.name,
    );
    if (indices.includes('idx_inventory_items_project_sync'))
      await q.query(
        'DROP INDEX `idx_inventory_items_project_sync` ON `inventory_items`',
      );
    if (indices.includes('uq_inventory_items_project_external'))
      await q.query(
        'DROP INDEX `uq_inventory_items_project_external` ON `inventory_items`',
      );
    if (await q.hasTable('inventory_item_sync_counters'))
      await q.query('DROP TABLE `inventory_item_sync_counters`');
    if (await q.hasColumn('inventory_items', 'sync_seq'))
      await q.query('ALTER TABLE `inventory_items` DROP COLUMN `sync_seq`');
  }
}
