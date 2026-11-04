import { MigrationInterface, QueryRunner, Table } from 'typeorm';

// Registers an existing migration-owned expression; never rebuilds its column,
// index, assignments or any financial record. Old migrations stay unchanged.
export class RegisterGeneratedColumnMetadata1794000000001 implements MigrationInterface {
  name = 'RegisterGeneratedColumnMetadata1794000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    const name = queryRunner.connection.metadataTableName;
    await queryRunner.createTable(
      new Table({
        name,
        columns: [
          { name: 'type', type: 'varchar', length: '255', isNullable: false },
          ...['database', 'schema', 'table', 'name'].map((column) => ({
            name: column,
            type: 'varchar',
            length: '255',
            isNullable: true,
          })),
          { name: 'value', type: 'text', isNullable: true },
        ],
      }),
      true,
    );
    const table = queryRunner.connection.driver.escape(name);
    const expression =
      "CASE WHEN status = 'active' THEN CONCAT(organization_id, ':', project_id, ':', field_agent_id) ELSE NULL END";
    await queryRunner.query(
      `INSERT INTO ${table} (\`type\`,\`database\`,\`schema\`,\`table\`,\`name\`,\`value\`)
      SELECT 'GENERATED_COLUMN',DATABASE(),DATABASE(),'project_field_agents','active_assignment_key',?
      WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE \`type\`='GENERATED_COLUMN' AND \`schema\`=DATABASE() AND \`table\`='project_field_agents' AND \`name\`='active_assignment_key')`,
      [expression],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = queryRunner.connection.driver.escape(
      queryRunner.connection.metadataTableName,
    );
    // The service table can contain other owners' metadata. Retain it.
    await queryRunner.query(
      `DELETE FROM ${table} WHERE \`type\`='GENERATED_COLUMN' AND \`schema\`=DATABASE() AND \`table\`='project_field_agents' AND \`name\`='active_assignment_key'`,
    );
  }
}
