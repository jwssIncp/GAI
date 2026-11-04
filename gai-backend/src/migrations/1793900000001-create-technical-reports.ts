import { MigrationInterface, QueryRunner } from 'typeorm';
import { REPORT_PERMISSIONS } from '../modules/technical-reports/report.dto';
export class CreateTechnicalReports1793900000001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const base =
      'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,organization_id BIGINT UNSIGNED NOT NULL';
    const tail =
      ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(
      `CREATE TABLE technical_report_templates (${base},revision INT NOT NULL,archived BOOLEAN NOT NULL,data JSON NOT NULL,published_version_id BIGINT UNSIGNED NULL,PRIMARY KEY(id),UNIQUE KEY uq_tr_template_scope(id,organization_id),INDEX idx_technical_templates_org(organization_id,id),FOREIGN KEY(organization_id) REFERENCES organizations(id))${tail}`,
    );
    await q.query(
      `CREATE TABLE technical_report_template_versions (${base},template_id BIGINT UNSIGNED NOT NULL,revision INT NOT NULL,operation VARCHAR(20) NOT NULL,data JSON NOT NULL,hash VARCHAR(64) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,recorded_at DATETIME(3) NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_technical_template_revision(template_id,revision),UNIQUE KEY uq_tr_template_version_scope(id,organization_id),FOREIGN KEY(template_id,organization_id) REFERENCES technical_report_templates(id,organization_id),FOREIGN KEY(actor_id) REFERENCES users(id))${tail}`,
    );
    await q.query(
      `CREATE TABLE technical_report_responsibles (${base},user_id BIGINT UNSIGNED NOT NULL,data JSON NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_technical_responsible_user(organization_id,user_id),FOREIGN KEY(organization_id) REFERENCES organizations(id),FOREIGN KEY(user_id) REFERENCES users(id))${tail}`,
    );
    await q.query(
      `CREATE TABLE technical_reports (${base},project_id BIGINT UNSIGNED NOT NULL,revision INT NOT NULL,status VARCHAR(20) NOT NULL,data JSON NOT NULL,approved_version_id BIGINT UNSIGNED NULL,PRIMARY KEY(id),UNIQUE KEY uq_tr_report_scope(id,organization_id,project_id),INDEX idx_technical_reports_project(organization_id,project_id,id),FOREIGN KEY(organization_id) REFERENCES organizations(id),FOREIGN KEY(project_id) REFERENCES projects(id))${tail}`,
    );
    await q.query(
      `CREATE TABLE technical_report_versions (${base},project_id BIGINT UNSIGNED NOT NULL,report_id BIGINT UNSIGNED NOT NULL,revision INT NOT NULL,status VARCHAR(20) NOT NULL,data JSON NOT NULL,validation JSON NOT NULL,hash VARCHAR(64) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,recorded_at DATETIME(3) NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_technical_report_revision(report_id,revision),UNIQUE KEY uq_tr_version_scope(id,organization_id,project_id),FOREIGN KEY(report_id,organization_id,project_id) REFERENCES technical_reports(id,organization_id,project_id),FOREIGN KEY(actor_id) REFERENCES users(id))${tail}`,
    );
    await q.query(
      `CREATE TABLE technical_report_commands (${base},command_key VARCHAR(100) NOT NULL,hash VARCHAR(64) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,operation VARCHAR(80) NOT NULL,reason TEXT NOT NULL,recorded_at DATETIME(3) NOT NULL,result JSON NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_technical_report_command(organization_id,command_key),FOREIGN KEY(organization_id) REFERENCES organizations(id),FOREIGN KEY(actor_id) REFERENCES users(id))${tail}`,
    );
    await q.query(
      'ALTER TABLE technical_report_templates ADD CONSTRAINT fk_tr_published_version FOREIGN KEY(published_version_id,organization_id) REFERENCES technical_report_template_versions(id,organization_id)',
    );
    await q.query(
      'ALTER TABLE technical_reports ADD CONSTRAINT fk_tr_approved_version FOREIGN KEY(approved_version_id,organization_id,project_id) REFERENCES technical_report_versions(id,organization_id,project_id)',
    );
    for (const key of REPORT_PERMISSIONS)
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
        [
          key,
          'technical-reports',
          key.split(':')[1],
          'ORGANIZATION',
          'Laudos técnicos: ' + key.split(':')[1],
        ],
      );
  }
  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Histórico documental preservado: reversão destrutiva não suportada.',
      ),
    );
  }
}
