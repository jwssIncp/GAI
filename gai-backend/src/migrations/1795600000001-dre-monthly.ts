import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS: Array<[string, string]> = [
  ['dre:import', 'DRE: importar planilha do ano (com pré-visualização)'],
];

/**
 * Paridade financeira, etapa 9 (DRE). Só acrescenta.
 * - dre_recognition_rules (M13): conta de cada tipo de movimento do fluxo e de
 *   cada papel da projeção;
 * - dre_report_layouts (M14): linhas ocultas, resumida e pós-operacionais;
 * - dre_imports (M15): importações de planilha;
 * - dre_monthly_values (+ versões): valores lançados conta × mês, com sinal;
 * - permissão dre:import.
 * O plano de contas (dre_accounts) e o fechamento (dre_periods) são os que já
 * existem; o fechamento passa a guardar a coluna do mês da DRE mensal no JSON.
 */
export class DreMonthly1795600000001 implements MigrationInterface {
  name = 'DreMonthly1795600000001';

  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (!(await q.hasTable('dre_recognition_rules')))
      await q.query(
        `CREATE TABLE dre_recognition_rules (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, kind VARCHAR(40) NOT NULL, account_id BIGINT UNSIGNED NOT NULL, revision INT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_dre_recognition_rule(organization_id, kind), CONSTRAINT fk_dre_rule_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_dre_rule_account FOREIGN KEY(account_id) REFERENCES dre_accounts(id), CONSTRAINT fk_dre_rule_actor FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
      );
    if (!(await q.hasTable('dre_report_layouts')))
      await q.query(
        `CREATE TABLE dre_report_layouts (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, revision INT NOT NULL, data JSON NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_dre_report_layout(organization_id), CONSTRAINT fk_dre_layout_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_dre_layout_actor FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
      );
    if (!(await q.hasTable('dre_imports')))
      await q.query(
        `CREATE TABLE dre_imports (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, year VARCHAR(4) NOT NULL, file_name VARCHAR(255) NOT NULL, checksum VARCHAR(64) NOT NULL, data JSON NOT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), INDEX idx_dre_import_year(organization_id, year), CONSTRAINT fk_dre_import_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_dre_import_actor FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
      );
    if (!(await q.hasTable('dre_monthly_values')))
      await q.query(
        `CREATE TABLE dre_monthly_values (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, account_id BIGINT UNSIGNED NOT NULL, month VARCHAR(7) NOT NULL, amount DECIMAL(15,2) NULL, origin VARCHAR(10) NOT NULL, import_id BIGINT UNSIGNED NULL, revision INT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_dre_monthly_value(organization_id, account_id, month), CONSTRAINT fk_dre_value_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_dre_value_account FOREIGN KEY(account_id) REFERENCES dre_accounts(id), CONSTRAINT fk_dre_value_import FOREIGN KEY(import_id) REFERENCES dre_imports(id), CONSTRAINT fk_dre_value_actor FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
      );
    if (!(await q.hasTable('dre_monthly_value_versions')))
      await q.query(
        `CREATE TABLE dre_monthly_value_versions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, value_id BIGINT UNSIGNED NOT NULL, revision INT NOT NULL, amount DECIMAL(15,2) NULL, origin VARCHAR(10) NOT NULL, import_id BIGINT UNSIGNED NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_dre_monthly_value_revision(value_id, revision), CONSTRAINT fk_dre_value_version_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_dre_value_version_value FOREIGN KEY(value_id) REFERENCES dre_monthly_values(id), CONSTRAINT fk_dre_value_version_import FOREIGN KEY(import_id) REFERENCES dre_imports(id), CONSTRAINT fk_dre_value_version_actor FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
      );
    for (const [key, description] of PERMISSIONS) {
      const [resource, action] = key.split(':');
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `key`=`key`',
        [key, resource, action, 'ORGANIZATION', description],
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    const keys = PERMISSIONS.map(([key]) => `'${key}'`).join(',');
    await q.query(
      `DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.\`key\` IN (${keys})`,
    );
    await q.query(`DELETE FROM permissions WHERE \`key\` IN (${keys})`);
    await q.query('DROP TABLE IF EXISTS dre_monthly_value_versions');
    await q.query('DROP TABLE IF EXISTS dre_monthly_values');
    await q.query('DROP TABLE IF EXISTS dre_imports');
    await q.query('DROP TABLE IF EXISTS dre_report_layouts');
    await q.query('DROP TABLE IF EXISTS dre_recognition_rules');
  }
}
