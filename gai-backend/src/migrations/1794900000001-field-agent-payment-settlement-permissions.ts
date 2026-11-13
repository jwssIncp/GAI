import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paridade financeira, etapa 3 (Pagamento de inventariantes): só permissões.
 * - payments:revert-payment: voltar um lançamento pago para em aberto (decisão D-C);
 * - payments:reschedule: alterar a data prevista ou a data de pagamento.
 * A baixa em lote continua em payments:mark-as-paid.
 */
export class FieldAgentPaymentSettlementPermissions1794900000001 implements MigrationInterface {
  name = 'FieldAgentPaymentSettlementPermissions1794900000001';

  async up(q: QueryRunner): Promise<void> {
    for (const [key, description] of [
      [
        'payments:revert-payment',
        'Pagamento de inventariantes: voltar pago para em aberto',
      ],
      [
        'payments:reschedule',
        'Pagamento de inventariantes: alterar data prevista ou de pagamento',
      ],
    ]) {
      const [resource, action] = key.split(':');
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `key`=`key`',
        [key, resource, action, 'ORGANIZATION', description],
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.`key` IN ('payments:revert-payment','payments:reschedule')",
    );
    await q.query(
      "DELETE FROM permissions WHERE `key` IN ('payments:revert-payment','payments:reschedule')",
    );
  }
}
