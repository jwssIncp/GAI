import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectPreparation1793100000001 implements MigrationInterface {
  name = 'CreateProjectPreparation1793100000001';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE preparation_templates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(200) NOT NULL, kind VARCHAR(30) NOT NULL, current_version INT NOT NULL DEFAULT 1,
      archived_at DATETIME(3) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY(id), UNIQUE KEY uq_prep_template_org(id,organization_id), INDEX idx_preparation_templates_org_kind(organization_id,kind),
      CONSTRAINT fk_prep_template_org FOREIGN KEY(organization_id) REFERENCES organizations(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE preparation_template_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      template_id BIGINT UNSIGNED NOT NULL, version INT NOT NULL, name VARCHAR(200) NOT NULL,
      questions JSON NOT NULL, created_by_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
      UNIQUE KEY uq_preparation_template_version(template_id,version), UNIQUE KEY uq_prep_version_org(id,organization_id),
      CONSTRAINT fk_prep_version_template FOREIGN KEY(template_id,organization_id) REFERENCES preparation_templates(id,organization_id),
      CONSTRAINT fk_prep_version_actor FOREIGN KEY(created_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE project_preparations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL, template_version_id BIGINT UNSIGNED NOT NULL,
      kind VARCHAR(30) NOT NULL, title VARCHAR(200) NOT NULL, snapshot JSON NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft', revision INT NOT NULL DEFAULT 1,
      responsible_user_id BIGINT UNSIGNED NULL, scheduled_date DATE NULL, due_date DATE NULL, notes TEXT NULL,
      created_by_id BIGINT UNSIGNED NOT NULL, approved_by_id BIGINT UNSIGNED NULL, approved_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY(id), UNIQUE KEY uq_prep_instance_scope(id,organization_id,project_id),
      INDEX idx_project_preparations_scope(organization_id,project_id,kind),
      CONSTRAINT fk_prep_instance_org FOREIGN KEY(organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_prep_instance_project FOREIGN KEY(project_id) REFERENCES projects(id),
      CONSTRAINT fk_prep_instance_version FOREIGN KEY(template_version_id,organization_id) REFERENCES preparation_template_versions(id,organization_id),
      CONSTRAINT fk_prep_instance_creator FOREIGN KEY(created_by_id) REFERENCES users(id),
      CONSTRAINT fk_prep_instance_responsible FOREIGN KEY(responsible_user_id) REFERENCES users(id),
      CONSTRAINT fk_prep_instance_approver FOREIGN KEY(approved_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE preparation_answers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NOT NULL, preparation_id BIGINT UNSIGNED NOT NULL, question_id VARCHAR(80) NOT NULL,
      state VARCHAR(30) NOT NULL, value JSON NULL, notes TEXT NULL, responsible_user_id BIGINT UNSIGNED NULL,
      due_date DATE NULL, answered_by_id BIGINT UNSIGNED NOT NULL, answered_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY(id), UNIQUE KEY uq_preparation_answer_question(preparation_id,question_id),
      INDEX idx_preparation_answers_scope(organization_id,project_id),
      CONSTRAINT fk_prep_answer_instance FOREIGN KEY(preparation_id,organization_id,project_id) REFERENCES project_preparations(id,organization_id,project_id),
      CONSTRAINT fk_prep_answer_actor FOREIGN KEY(answered_by_id) REFERENCES users(id),
      CONSTRAINT fk_prep_answer_responsible FOREIGN KEY(responsible_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE preparation_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL,
      project_id BIGINT UNSIGNED NULL, preparation_id BIGINT UNSIGNED NULL, template_id BIGINT UNSIGNED NULL,
      operation VARCHAR(60) NOT NULL, performed_by_id BIGINT UNSIGNED NOT NULL, changes JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
      INDEX idx_preparation_audit_scope(organization_id,project_id,preparation_id,id),
      CONSTRAINT fk_prep_audit_org FOREIGN KEY(organization_id) REFERENCES organizations(id),
      CONSTRAINT fk_prep_audit_instance FOREIGN KEY(preparation_id,organization_id,project_id) REFERENCES project_preparations(id,organization_id,project_id),
      CONSTRAINT fk_prep_audit_template FOREIGN KEY(template_id,organization_id) REFERENCES preparation_templates(id,organization_id),
      CONSTRAINT fk_prep_audit_actor FOREIGN KEY(performed_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    for (const [action, description] of [
      ['read', 'Consultar preparação, modelos e comunicação'],
      ['edit', 'Gerenciar modelos e respostas de preparação'],
      ['approve', 'Aprovar e reabrir preparação de projetos'],
    ]) {
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope), description=VALUES(description)',
        [
          `project-preparation:${action}`,
          'project-preparation',
          action,
          'ORGANIZATION',
          description,
        ],
      );
    }
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'preparation_audit_logs',
      'preparation_answers',
      'project_preparations',
      'preparation_template_versions',
      'preparation_templates',
    ])
      await q.query(`DROP TABLE ${table}`);
    // Preserve catalog/grants on rollback; no route is authorized merely by a
    // catalog entry, and destructive removal could erase configured profiles.
  }
}
