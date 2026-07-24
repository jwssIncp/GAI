import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectDashboardIndexes1741100000001 implements MigrationInterface {
  name = 'AddProjectDashboardIndexes1741100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX idx_inventory_items_project_updated
      ON inventory_items (project_id, updated_at)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_inventory_items_project_unit
      ON inventory_items (project_id, unit_text)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX idx_inventory_items_project_unit ON inventory_items',
    );
    await queryRunner.query(
      'DROP INDEX idx_inventory_items_project_updated ON inventory_items',
    );
  }
}
