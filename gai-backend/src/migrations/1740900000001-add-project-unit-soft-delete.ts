import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectUnitSoftDelete1740900000001 implements MigrationInterface {
  name = 'AddProjectUnitSoftDelete1740900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE project_units
      ADD COLUMN deleted_at DATETIME(3) NULL,
      ADD INDEX idx_project_units_project_deleted (project_id, deleted_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE project_units
      DROP INDEX idx_project_units_project_deleted,
      DROP COLUMN deleted_at
    `);
  }
}
