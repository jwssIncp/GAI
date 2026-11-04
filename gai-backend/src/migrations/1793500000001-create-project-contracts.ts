import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateProjectContracts1793500000001 implements MigrationInterface {
  name = 'CreateProjectContracts1793500000001';
  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(
      `CREATE TABLE project_contracts (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NOT NULL, number VARCHAR(100) NOT NULL, revision INT NOT NULL, data JSON NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_contract_scope(id,organization_id,project_id), UNIQUE KEY uq_contract_number(organization_id,number), INDEX idx_contract_project(organization_id,project_id), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(company_id) REFERENCES companies(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE project_contract_versions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, contract_id BIGINT UNSIGNED NOT NULL, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, revision INT NOT NULL, data JSON NOT NULL, operation VARCHAR(20) NOT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_contract_revision(contract_id,revision), INDEX idx_contract_version_period(organization_id,recorded_at), FOREIGN KEY(contract_id,organization_id,project_id) REFERENCES project_contracts(id,organization_id,project_id), FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE project_contract_amendments (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, contract_id BIGINT UNSIGNED NOT NULL, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, identifier VARCHAR(100) NOT NULL, dated_on DATE NOT NULL, type VARCHAR(20) NOT NULL, value_delta DECIMAL(15,2) NULL, ends_on DATE NULL, scope TEXT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, revision INT NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_contract_amendment(contract_id,identifier), FOREIGN KEY(contract_id,organization_id,project_id) REFERENCES project_contracts(id,organization_id,project_id), FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE commercial_report_snapshots (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, payload JSON NOT NULL, PRIMARY KEY(id), INDEX idx_commercial_reports_org(organization_id,id), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    for (const key of [
      'contracts:read',
      'contracts:edit',
      'contracts:amend',
      'contracts:archive',
      'commercial-indicators:read',
    ]) {
      const [resource, action] = key.split(':');
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
        [key, resource, action, 'ORGANIZATION', 'Gestão contratual: ' + action],
      );
    }
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'commercial_report_snapshots',
      'project_contract_amendments',
      'project_contract_versions',
      'project_contracts',
    ])
      await q.query(`DROP TABLE ${table}`);
  }
}
