import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS: Array<[string, string]> = [
  [
    'receivables:reschedule',
    'Recebíveis: reprogramar a data prevista de uma parcela',
  ],
];

/**
 * Paridade financeira, etapa 7 (Fluxo de caixa). Só acrescenta.
 * - receivable_proposal_decisions: propostas de recebível descartadas (D-F);
 * - cash_outflow_settlements: baixa manual de saída pela identidade da origem;
 * - cash_flow_audit_logs: auditoria das ações do fluxo;
 * - permissão receivables:reschedule (reprogramar parcela, evento auditado).
 * Novas origens de recebível (reembolso) e o evento "reprogramar" usam colunas
 * que já existem (JSON e varchar), sem alterar nenhuma.
 */
export class CashFlowParity1795400000001 implements MigrationInterface {
  name = 'CashFlowParity1795400000001';

  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (!(await q.hasTable('receivable_proposal_decisions')))
      await q.query(
        `CREATE TABLE receivable_proposal_decisions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, source_key VARCHAR(100) NOT NULL, proposal_hash VARCHAR(64) NOT NULL, decision VARCHAR(20) NOT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NULL, decided_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id), UNIQUE KEY uq_receivable_proposal_decision(organization_id, source_key, proposal_hash), CONSTRAINT fk_receivable_proposal_decision_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_receivable_proposal_decision_actor FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
      );
    if (!(await q.hasTable('cash_outflow_settlements')))
      await q.query(
        `CREATE TABLE cash_outflow_settlements (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NULL, source_key VARCHAR(100) NOT NULL, paid_on DATE NULL, updated_by_id BIGINT UNSIGNED NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY(id), UNIQUE KEY uq_cash_outflow_settlement(organization_id, source_key), CONSTRAINT fk_cash_outflow_settlement_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_cash_outflow_settlement_project FOREIGN KEY(project_id) REFERENCES projects(id), CONSTRAINT fk_cash_outflow_settlement_user FOREIGN KEY(updated_by_id) REFERENCES users(id)) ${engine}`,
      );
    if (!(await q.hasTable('cash_flow_audit_logs')))
      await q.query(
        `CREATE TABLE cash_flow_audit_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, operation VARCHAR(40) NOT NULL, target_key VARCHAR(100) NOT NULL, changes JSON NOT NULL, performed_by BIGINT UNSIGNED NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id), INDEX idx_cash_flow_audit_target(organization_id, target_key), CONSTRAINT fk_cash_flow_audit_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_cash_flow_audit_user FOREIGN KEY(performed_by) REFERENCES users(id)) ${engine}`,
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
    await q.query('DROP TABLE IF EXISTS cash_flow_audit_logs');
    await q.query('DROP TABLE IF EXISTS cash_outflow_settlements');
    await q.query('DROP TABLE IF EXISTS receivable_proposal_decisions');
  }
}
