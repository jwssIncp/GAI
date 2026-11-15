import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paridade financeira, etapa 8 (Indicadores): permissão para simular uma venda
 * no fluxo de caixa (a simulação não grava nada). Só acrescenta.
 */
export class CashFlowSimulatePermission1795500000001 implements MigrationInterface {
  name = 'CashFlowSimulatePermission1795500000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `key`=`key`',
      [
        'cash-flow:simulate',
        'cash-flow',
        'simulate',
        'ORGANIZATION',
        'Fluxo de caixa: simular venda nos indicadores',
      ],
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.`key` = 'cash-flow:simulate'",
    );
    await q.query("DELETE FROM permissions WHERE `key` = 'cash-flow:simulate'");
  }
}
