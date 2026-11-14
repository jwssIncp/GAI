import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS: Array<[string, string]> = [
  ['asset-tag-orders:read', 'Placas de patrimônio: consultar'],
  ['asset-tag-orders:edit', 'Placas de patrimônio: lançar, editar e excluir'],
];

/**
 * Paridade financeira, etapa 5 (Placas de patrimônio), M10. Só acrescenta.
 * Valores unitários com 4 casas (placa pode custar frações de centavo);
 * totais, líquido e lucro são calculados (não gravados).
 */
export class AssetTagOrders1795100000001 implements MigrationInterface {
  name = 'AssetTagOrders1795100000001';

  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (!(await q.hasTable('asset_tag_orders')))
      await q.query(
        `CREATE TABLE asset_tag_orders (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, proposal_number VARCHAR(60) NULL, ordered_on DATE NOT NULL, quantity INT UNSIGNED NOT NULL, sequence_start INT UNSIGNED NULL, sequence_end INT UNSIGNED NULL, model VARCHAR(60) NULL, supplier_name VARCHAR(150) NOT NULL, unit_cost DECIMAL(15,4) NOT NULL, supplier_payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', supplier_expected_payment_on DATE NULL, supplier_paid_on DATE NULL, unit_price DECIMAL(15,4) NOT NULL, client_expected_receipt_on DATE NULL, client_received_on DATE NULL, expense_type_override VARCHAR(20) NULL, notes TEXT NULL, created_by_id BIGINT UNSIGNED NULL, updated_by_id BIGINT UNSIGNED NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL, PRIMARY KEY(id), INDEX idx_asset_tag_orders_org_project(organization_id, project_id), CONSTRAINT fk_asset_tag_orders_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_asset_tag_orders_project FOREIGN KEY(project_id) REFERENCES projects(id), CONSTRAINT fk_asset_tag_orders_creator FOREIGN KEY(created_by_id) REFERENCES users(id), CONSTRAINT fk_asset_tag_orders_updater FOREIGN KEY(updated_by_id) REFERENCES users(id), CHECK(sequence_end IS NULL OR sequence_start IS NULL OR sequence_end >= sequence_start)) ${engine}`,
      );
    if (!(await q.hasTable('asset_tag_order_audit_logs')))
      await q.query(
        `CREATE TABLE asset_tag_order_audit_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED NOT NULL, operation VARCHAR(40) NOT NULL, performed_by BIGINT UNSIGNED NULL, changes JSON NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id), INDEX idx_asset_tag_order_audit_order(order_id), CONSTRAINT fk_asset_tag_order_audit_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_asset_tag_order_audit_order FOREIGN KEY(order_id) REFERENCES asset_tag_orders(id), CONSTRAINT fk_asset_tag_order_audit_user FOREIGN KEY(performed_by) REFERENCES users(id)) ${engine}`,
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
    await q.query('DROP TABLE IF EXISTS asset_tag_order_audit_logs');
    await q.query('DROP TABLE IF EXISTS asset_tag_orders');
  }
}
