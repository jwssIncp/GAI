import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../../data-source';

config();

/**
 * Read-only diagnostic for the Onda 2 unique key (project_id, external_item_id).
 * Prints duplicated groups with the ids involved; never writes. Run against
 * homolog/production with a read-only database user before migrating.
 */
async function run(): Promise<void> {
  await dataSource.initialize();
  const groups = await dataSource.query<Array<Record<string, unknown>>>(
    `SELECT i.project_id, i.external_item_id, COUNT(*) AS total,
            GROUP_CONCAT(i.id ORDER BY i.id) AS item_ids,
            SUM(i.deleted_at IS NOT NULL) AS deleted_rows
       FROM inventory_items i
      WHERE i.external_item_id IS NOT NULL
      GROUP BY i.project_id, i.external_item_id
     HAVING COUNT(*) > 1
      ORDER BY i.project_id, i.external_item_id`,
  );
  await dataSource.destroy();
  console.log(
    JSON.stringify({ duplicated_groups: groups.length, groups }, null, 2),
  );
  if (groups.length) process.exitCode = 2;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
