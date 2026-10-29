import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateManagerialDre1793800000001 implements MigrationInterface {
  name = 'CreateManagerialDre1793800000001';
  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(
      `CREATE TABLE dre_accounts (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,organization_id BIGINT UNSIGNED NOT NULL,code VARCHAR(40) NOT NULL,revision INT NOT NULL,data JSON NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_dre_account_scope(id,organization_id),UNIQUE KEY uq_dre_account_code(organization_id,code),FOREIGN KEY(organization_id) REFERENCES organizations(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE dre_account_versions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,organization_id BIGINT UNSIGNED NOT NULL,account_id BIGINT UNSIGNED NOT NULL,revision INT NOT NULL,data JSON NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,recorded_at DATETIME(3) NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_dre_account_revision(account_id,revision),FOREIGN KEY(account_id,organization_id) REFERENCES dre_accounts(id,organization_id),FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE dre_entries (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,organization_id BIGINT UNSIGNED NOT NULL,project_id BIGINT UNSIGNED NULL,economic_key VARCHAR(180) NOT NULL,source_key VARCHAR(100) NULL,revision INT NOT NULL,data JSON NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_dre_entry_scope(id,organization_id),UNIQUE KEY uq_dre_economic_key(organization_id,economic_key),UNIQUE KEY uq_dre_source(organization_id,source_key),INDEX idx_dre_scope(organization_id,project_id,id),FOREIGN KEY(organization_id) REFERENCES organizations(id),FOREIGN KEY(project_id) REFERENCES projects(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE dre_entry_versions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,organization_id BIGINT UNSIGNED NOT NULL,entry_id BIGINT UNSIGNED NOT NULL,revision INT NOT NULL,data JSON NOT NULL,hash VARCHAR(64) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,recorded_at DATETIME(3) NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_dre_entry_revision(entry_id,revision),FOREIGN KEY(entry_id,organization_id) REFERENCES dre_entries(id,organization_id),FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE dre_periods (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,organization_id BIGINT UNSIGNED NOT NULL,month VARCHAR(7) NOT NULL,revision INT NOT NULL,closed BOOLEAN NOT NULL,data JSON NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_dre_period(organization_id,month),FOREIGN KEY(organization_id) REFERENCES organizations(id)) ${engine}`,
    );
    await q.query(
      `CREATE TABLE dre_commands (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,organization_id BIGINT UNSIGNED NOT NULL,command_key VARCHAR(100) NOT NULL,hash VARCHAR(64) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,recorded_at DATETIME(3) NOT NULL,operation VARCHAR(40) NOT NULL,result JSON NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(id),UNIQUE KEY uq_dre_command(organization_id,command_key),INDEX idx_dre_command_history(organization_id,operation,id),FOREIGN KEY(organization_id) REFERENCES organizations(id),FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
    );
    for (const action of [
      'read',
      'configure',
      'classify',
      'adjust',
      'periods',
      'export',
    ])
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
        [
          'dre:' + action,
          'dre',
          action,
          'ORGANIZATION',
          'DRE gerencial: ' + action,
        ],
      );
  }
  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Histórico gerencial deve ser preservado. Use migration corretiva revisada.',
      ),
    );
  }
}
