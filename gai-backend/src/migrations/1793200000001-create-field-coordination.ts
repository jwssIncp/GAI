import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateFieldCoordination1793200000001 implements MigrationInterface {
  name = 'CreateFieldCoordination1793200000001';
  async up(q: QueryRunner): Promise<void> {
    const common =
      'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id)';
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(
      'ALTER TABLE projects ADD UNIQUE INDEX uq_field_project_scope (id,organization_id)',
    );
    await q.query(`CREATE TABLE field_templates (${common}, name VARCHAR(200) NOT NULL, description TEXT NULL, current_version INT NOT NULL, archived_at DATETIME(3) NULL,
      UNIQUE KEY uq_field_template_org(id,organization_id), INDEX idx_field_templates_org(organization_id,archived_at),
      FOREIGN KEY(organization_id) REFERENCES organizations(id)) ${engine}`);
    await q.query(`CREATE TABLE field_template_versions (${common}, template_id BIGINT UNSIGNED NOT NULL, version INT NOT NULL, name VARCHAR(200) NOT NULL, description TEXT NULL, definition JSON NOT NULL, created_by_id BIGINT UNSIGNED NOT NULL,
      UNIQUE KEY uq_field_template_version(template_id,version), UNIQUE KEY uq_field_version_org(id,organization_id),
      FOREIGN KEY(template_id,organization_id) REFERENCES field_templates(id,organization_id), FOREIGN KEY(created_by_id) REFERENCES users(id)) ${engine}`);
    await q.query(`CREATE TABLE field_checklists (${common}, project_id BIGINT UNSIGNED NOT NULL, template_version_id BIGINT UNSIGNED NOT NULL, title VARCHAR(200) NOT NULL, snapshot JSON NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open', revision INT NOT NULL DEFAULT 1, created_by_id BIGINT UNSIGNED NOT NULL,
      completed_by_id BIGINT UNSIGNED NULL, completed_at DATETIME(3) NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_field_checklist_scope(id,organization_id,project_id), INDEX idx_field_checklists_scope(organization_id,project_id),
      FOREIGN KEY(project_id,organization_id) REFERENCES projects(id,organization_id), FOREIGN KEY(template_version_id,organization_id) REFERENCES field_template_versions(id,organization_id),
      FOREIGN KEY(created_by_id) REFERENCES users(id), FOREIGN KEY(completed_by_id) REFERENCES users(id)) ${engine}`);
    await q.query(`CREATE TABLE field_tasks (${common}, project_id BIGINT UNSIGNED NOT NULL, checklist_id BIGINT UNSIGNED NOT NULL, stable_id VARCHAR(80) NOT NULL, group_id VARCHAR(80) NOT NULL,
      title VARCHAR(200) NOT NULL, definition JSON NOT NULL, position INT NOT NULL, required BOOLEAN NOT NULL, applicable BOOLEAN NOT NULL DEFAULT TRUE,
      state VARCHAR(30) NOT NULL DEFAULT 'pending', priority VARCHAR(20) NOT NULL DEFAULT 'normal', responsible_user_id BIGINT UNSIGNED NULL, field_agent_id BIGINT UNSIGNED NULL,
      start_date DATE NULL, due_date DATE NULL, completed_at DATETIME(3) NULL, notes TEXT NULL, reason TEXT NULL, linked_issue_id BIGINT UNSIGNED NULL,
      approved_by_id BIGINT UNSIGNED NULL, approved_at DATETIME(3) NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_field_task_stable(checklist_id,stable_id), INDEX idx_field_task_filter(organization_id,project_id,checklist_id,state,due_date),
      FOREIGN KEY(checklist_id,organization_id,project_id) REFERENCES field_checklists(id,organization_id,project_id),
      FOREIGN KEY(responsible_user_id) REFERENCES users(id), FOREIGN KEY(field_agent_id) REFERENCES field_agents(id), FOREIGN KEY(linked_issue_id) REFERENCES inventory_pending_issues(id), FOREIGN KEY(approved_by_id) REFERENCES users(id)) ${engine}`);
    await q.query(`CREATE TABLE field_audit_logs (${common}, project_id BIGINT UNSIGNED NULL, checklist_id BIGINT UNSIGNED NULL, template_id BIGINT UNSIGNED NULL, performed_by_id BIGINT UNSIGNED NOT NULL, operation VARCHAR(60) NOT NULL, changes JSON NOT NULL,
      INDEX idx_field_audit_scope(organization_id,project_id,checklist_id,id), FOREIGN KEY(checklist_id,organization_id,project_id) REFERENCES field_checklists(id,organization_id,project_id),
      FOREIGN KEY(template_id,organization_id) REFERENCES field_templates(id,organization_id), FOREIGN KEY(performed_by_id) REFERENCES users(id)) ${engine}`);
    await q.query(`CREATE TABLE field_commands (${common}, project_id BIGINT UNSIGNED NOT NULL, command_key VARCHAR(80) NOT NULL, fingerprint VARCHAR(64) NOT NULL, result JSON NULL,
      UNIQUE KEY uq_field_command(organization_id,project_id,command_key), FOREIGN KEY(project_id,organization_id) REFERENCES projects(id,organization_id)) ${engine}`);
    for (const action of ['read', 'edit', 'coordinate'])
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
        [
          `field-coordination:${action}`,
          'field-coordination',
          action,
          'ORGANIZATION',
          `Coordenação de campo: ${action}`,
        ],
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'field_commands',
      'field_audit_logs',
      'field_tasks',
      'field_checklists',
      'field_template_versions',
      'field_templates',
    ])
      await q.query(`DROP TABLE ${table}`);
    await q.query('ALTER TABLE projects DROP INDEX uq_field_project_scope');
    // Catalog and custom grants are preserved. Rollback is destructive and only for disposable tests.
  }
}
