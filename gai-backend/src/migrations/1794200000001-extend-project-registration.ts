import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class ExtendProjectRegistration1794200000001 implements MigrationInterface {
  name = 'ExtendProjectRegistration1794200000001';
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Additive and retryable. Existing values, including tenant/company IDs, are untouched.
    for (const column of [
      new TableColumn({
        name: 'code',
        type: 'varchar',
        length: '40',
        isNullable: true,
      }),
      new TableColumn({
        name: 'project_type',
        type: 'varchar',
        length: '30',
        isNullable: true,
      }),
      new TableColumn({
        name: 'responsible_user_id',
        type: 'bigint',
        unsigned: true,
        isNullable: true,
      }),
      new TableColumn({
        name: 'planning_responsible_user_id',
        type: 'bigint',
        unsigned: true,
        isNullable: true,
      }),
      new TableColumn({
        name: 'planning_notes',
        type: 'text',
        isNullable: true,
      }),
    ]) {
      if (!(await queryRunner.hasColumn('projects', column.name)))
        await queryRunner.addColumn('projects', column);
    }
    for (const index of [
      new TableIndex({
        name: 'uq_projects_organization_code',
        columnNames: ['organization_id', 'code'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_projects_organization_type',
        columnNames: ['organization_id', 'project_type'],
      }),
      new TableIndex({
        name: 'idx_projects_responsible',
        columnNames: ['responsible_user_id'],
      }),
      new TableIndex({
        name: 'idx_projects_planning_responsible',
        columnNames: ['planning_responsible_user_id'],
      }),
    ]) {
      if (
        !(await queryRunner.getTable('projects'))!.indices.some(
          (item) => item.name === index.name,
        )
      )
        await queryRunner.createIndex('projects', index);
    }
    for (const column of [
      'responsible_user_id',
      'planning_responsible_user_id',
    ]) {
      const name = `fk_projects_${column}`;
      if (
        !(await queryRunner.getTable('projects'))!.foreignKeys.some(
          (item) => item.name === name,
        )
      )
        await queryRunner.createForeignKey(
          'projects',
          new TableForeignKey({
            name,
            columnNames: [column],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        );
    }
  }
  public down(): Promise<void> {
    // Reverting application code is compatible with these nullable columns.
    return Promise.reject(
      new Error(
        'Data-preserving migration: retain columns when rolling back the application. Destructive schema rollback requires a reviewed backup plan.',
      ),
    );
  }
}
