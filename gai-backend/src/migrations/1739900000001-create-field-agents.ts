import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFieldAgents1739900000001 implements MigrationInterface {
  name = 'CreateFieldAgents1739900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE field_agents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        document VARCHAR(50) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        metadata JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_field_agents_organization_status (organization_id, status),
        INDEX idx_field_agents_user_id (user_id),
        INDEX idx_field_agents_name (name),
        UNIQUE INDEX uq_field_agents_org_email (organization_id, email),
        UNIQUE INDEX uq_field_agents_org_document (organization_id, document),
        CONSTRAINT fk_field_agents_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_field_agents_user FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE project_field_agents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        project_id BIGINT UNSIGNED NOT NULL,
        field_agent_id BIGINT UNSIGNED NOT NULL,
        role VARCHAR(100) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        start_date DATE NULL,
        end_date DATE NULL,
        notes TEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_project_field_agents_project_status (project_id, status),
        INDEX idx_project_field_agents_agent_status (field_agent_id, status),
        INDEX idx_project_field_agents_organization_id (organization_id),
        CONSTRAINT fk_project_field_agents_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_project_field_agents_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_project_field_agents_field_agent FOREIGN KEY (field_agent_id) REFERENCES field_agents(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE field_agent_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id BIGINT UNSIGNED NOT NULL,
        field_agent_id BIGINT UNSIGNED NULL,
        project_field_agent_id BIGINT UNSIGNED NULL,
        project_id BIGINT UNSIGNED NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by BIGINT UNSIGNED NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_field_agent_audit_agent_created (field_agent_id, created_at),
        INDEX idx_field_agent_audit_project_created (project_id, created_at),
        INDEX idx_field_agent_audit_organization_id (organization_id),
        CONSTRAINT fk_field_agent_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_field_agent_audit_field_agent FOREIGN KEY (field_agent_id) REFERENCES field_agents(id),
        CONSTRAINT fk_field_agent_audit_project_field_agent FOREIGN KEY (project_field_agent_id) REFERENCES project_field_agents(id),
        CONSTRAINT fk_field_agent_audit_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_field_agent_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE field_agent_audit_logs');
    await queryRunner.query('DROP TABLE project_field_agents');
    await queryRunner.query('DROP TABLE field_agents');
  }
}
