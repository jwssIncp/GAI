import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS: Array<[string, string]> = [
  ['commissions:read', 'Comissões: consultar comissões e parceiros'],
  ['commissions:edit', 'Comissões: lançar, editar e excluir'],
  ['commission-partners:edit', 'Parceiros de comissão: cadastrar e excluir'],
];

/**
 * Paridade financeira, etapa 6 (Comissões e parceiros), M11 e M12. Só acrescenta.
 * O valor da comissão é calculado (valor × % / 100) a menos que haja valor manual.
 */
export class Commissions1795200000001 implements MigrationInterface {
  name = 'Commissions1795200000001';

  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (!(await q.hasTable('commission_partners')))
      await q.query(
        `CREATE TABLE commission_partners (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, name VARCHAR(150) NOT NULL, company VARCHAR(150) NULL, name_key VARCHAR(310) NOT NULL, created_by_id BIGINT UNSIGNED NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL, PRIMARY KEY(id), UNIQUE KEY uq_commission_partners_key(organization_id, name_key), CONSTRAINT fk_commission_partners_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_commission_partners_creator FOREIGN KEY(created_by_id) REFERENCES users(id)) ${engine}`,
      );
    if (!(await q.hasTable('commissions')))
      await q.query(
        `CREATE TABLE commissions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, contract_id BIGINT UNSIGNED NULL, partner_id BIGINT UNSIGNED NOT NULL, partner_name_snapshot VARCHAR(310) NOT NULL, contract_value DECIMAL(15,2) NOT NULL, percent DECIMAL(5,2) NOT NULL, amount_manual DECIMAL(15,2) NULL, expected_payment_on DATE NULL, paid_on DATE NULL, notes TEXT NULL, created_by_id BIGINT UNSIGNED NULL, updated_by_id BIGINT UNSIGNED NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL, PRIMARY KEY(id), INDEX idx_commissions_org_project(organization_id, project_id), CONSTRAINT fk_commissions_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_commissions_project FOREIGN KEY(project_id) REFERENCES projects(id), CONSTRAINT fk_commissions_contract FOREIGN KEY(contract_id) REFERENCES project_contracts(id), CONSTRAINT fk_commissions_partner FOREIGN KEY(partner_id) REFERENCES commission_partners(id), CONSTRAINT fk_commissions_creator FOREIGN KEY(created_by_id) REFERENCES users(id), CONSTRAINT fk_commissions_updater FOREIGN KEY(updated_by_id) REFERENCES users(id), CHECK(percent >= 0 AND percent <= 100)) ${engine}`,
      );
    if (!(await q.hasTable('commission_audit_logs')))
      await q.query(
        `CREATE TABLE commission_audit_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, commission_id BIGINT UNSIGNED NULL, partner_id BIGINT UNSIGNED NULL, operation VARCHAR(40) NOT NULL, performed_by BIGINT UNSIGNED NULL, changes JSON NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id), INDEX idx_commission_audit_target(commission_id, partner_id), CONSTRAINT fk_commission_audit_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_commission_audit_commission FOREIGN KEY(commission_id) REFERENCES commissions(id), CONSTRAINT fk_commission_audit_partner FOREIGN KEY(partner_id) REFERENCES commission_partners(id), CONSTRAINT fk_commission_audit_user FOREIGN KEY(performed_by) REFERENCES users(id)) ${engine}`,
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
    await q.query('DROP TABLE IF EXISTS commission_audit_logs');
    await q.query('DROP TABLE IF EXISTS commissions');
    await q.query('DROP TABLE IF EXISTS commission_partners');
  }
}
