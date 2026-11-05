import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenFieldAgentIdentity1794300000001 implements MigrationInterface {
  name = 'HardenFieldAgentIdentity1794300000001';
  async up(q: QueryRunner): Promise<void> {
    const duplicates = (await q.query(
      'SELECT user_id FROM field_agents WHERE user_id IS NOT NULL AND deleted_at IS NULL GROUP BY user_id HAVING COUNT(*)>1 LIMIT 1',
    )) as unknown[];
    const inconsistent = (await q.query(
      `SELECT a.id FROM field_agents a JOIN users u ON u.id=a.user_id WHERE NOT(a.organization_id <=> u.organization_id) LIMIT 1`,
    )) as unknown[];
    const invalidLinks = (await q.query(
      `SELECT a.id FROM project_field_agents a JOIN field_agents f ON f.id=a.field_agent_id JOIN projects p ON p.id=a.project_id WHERE a.organization_id<>f.organization_id OR a.organization_id<>p.organization_id LIMIT 1`,
    )) as unknown[];
    if (duplicates.length || inconsistent.length || invalidLinks.length)
      throw new Error(
        'Field-agent preflight failed. Reconcile incompatible links with explicit authorization before migrating; no historical data was changed.',
      );
    if (!(await q.hasColumn('field_agents', 'live_user_id')))
      await q.query(
        'ALTER TABLE field_agents ADD COLUMN live_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN user_id ELSE NULL END) STORED',
      );
    for (const [table, name, columns] of [
      ['field_agents', 'uq_field_agents_live_user', 'live_user_id'],
      ['field_agents', 'uq_field_agents_scope', 'id,organization_id'],
      ['users', 'uq_users_field_scope', 'id,organization_id'],
    ]) {
      if (!(await q.getTable(table))!.indices.some((i) => i.name === name))
        await q.query(
          `ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${name}\` (${columns})`,
        );
    }
    for (const [table, name, columns, reference] of [
      [
        'field_agents',
        'fk_field_agents_user_scope',
        'user_id,organization_id',
        'users(id,organization_id)',
      ],
      [
        'project_field_agents',
        'fk_project_field_agents_agent_scope',
        'field_agent_id,organization_id',
        'field_agents(id,organization_id)',
      ],
      [
        'project_field_agents',
        'fk_project_field_agents_project_scope',
        'project_id,organization_id',
        'projects(id,organization_id)',
      ],
    ]) {
      if (!(await q.getTable(table))!.foreignKeys.some((f) => f.name === name))
        await q.query(
          `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY (${columns}) REFERENCES ${reference}`,
        );
    }
    const exists = (await q.query(
      "SELECT 1 FROM typeorm_metadata WHERE `type`='GENERATED_COLUMN' AND `schema`=DATABASE() AND `table`='field_agents' AND `name`='live_user_id'",
    )) as unknown[];
    if (!exists.length)
      await q.query(
        "INSERT INTO typeorm_metadata (`type`,`database`,`schema`,`table`,`name`,`value`) VALUES ('GENERATED_COLUMN',DATABASE(),DATABASE(),'field_agents','live_user_id',?)",
        ['CASE WHEN deleted_at IS NULL THEN user_id ELSE NULL END'],
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const [table, name] of [
      ['project_field_agents', 'fk_project_field_agents_project_scope'],
      ['project_field_agents', 'fk_project_field_agents_agent_scope'],
      ['field_agents', 'fk_field_agents_user_scope'],
    ]) {
      if ((await q.getTable(table))!.foreignKeys.some((f) => f.name === name))
        await q.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``);
    }
    for (const [table, name] of [
      ['field_agents', 'uq_field_agents_live_user'],
      ['field_agents', 'uq_field_agents_scope'],
      ['users', 'uq_users_field_scope'],
    ]) {
      if ((await q.getTable(table))!.indices.some((i) => i.name === name))
        await q.query(`ALTER TABLE \`${table}\` DROP INDEX \`${name}\``);
    }
    if (await q.hasColumn('field_agents', 'live_user_id'))
      await q.query('ALTER TABLE field_agents DROP COLUMN live_user_id');
    await q.query(
      "DELETE FROM typeorm_metadata WHERE `type`='GENERATED_COLUMN' AND `schema`=DATABASE() AND `table`='field_agents' AND `name`='live_user_id'",
    );
  }
}
