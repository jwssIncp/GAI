import { MigrationInterface, QueryRunner } from 'typeorm';

interface DuplicateActiveAssignment {
  organization_id: number;
  project_id: number;
  field_agent_id: number;
  total: number;
}

export class ProtectActiveFieldAgentAssignments1740800000001 implements MigrationInterface {
  name = 'ProtectActiveFieldAgentAssignments1740800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates = (await queryRunner.query(`
      SELECT organization_id, project_id, field_agent_id, COUNT(*) AS total
      FROM project_field_agents
      WHERE status = 'active'
      GROUP BY organization_id, project_id, field_agent_id
      HAVING COUNT(*) > 1
      LIMIT 1
    `)) as DuplicateActiveAssignment[];

    if (duplicates.length > 0) {
      throw new Error(
        'Cannot add active assignment constraint: duplicate active project field-agent assignments exist',
      );
    }

    await queryRunner.query(`
      ALTER TABLE project_field_agents
      ADD COLUMN active_assignment_key VARCHAR(64)
        GENERATED ALWAYS AS (
          CASE
            WHEN status = 'active'
            THEN CONCAT(organization_id, ':', project_id, ':', field_agent_id)
            ELSE NULL
          END
        ) STORED,
      ADD UNIQUE INDEX uq_project_field_agents_active_key (active_assignment_key)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE project_field_agents
      DROP INDEX uq_project_field_agents_active_key,
      DROP COLUMN active_assignment_key
    `);
  }
}
