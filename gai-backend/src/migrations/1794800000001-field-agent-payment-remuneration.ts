import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paridade financeira, etapa 2 (Remuneração), M4. Só acrescenta colunas;
 * nenhuma coluna existente é alterada.
 * - expected_payment_date: data PREVISTA de pagamento (payment_date passa a ser só a real);
 * - total_amount / total_manual: total = dias × diária + adicional, ou informado à mão;
 * - reopened_by_id / reopened_at: quem reabriu para edição (decisão D-D);
 * - permissões payments:delete e payments:reopen.
 *
 * Ajuste de dados (decisão D-M, aprovado com backup e resumo):
 * - total_amount = daily_total + additional_amount em todas as linhas (é o que
 *   o final já considerava: final = daily_total + adicional − desconto);
 * - expected_payment_date = payment_date nas linhas NÃO pagas, onde a data era previsão.
 *   payment_date não é alterado.
 */
export class FieldAgentPaymentRemuneration1794800000001 implements MigrationInterface {
  name = 'FieldAgentPaymentRemuneration1794800000001';

  async up(q: QueryRunner): Promise<void> {
    const add = async (column: string, ddl: string) => {
      if (!(await q.hasColumn('field_agent_payments', column)))
        await q.query(`ALTER TABLE field_agent_payments ADD COLUMN ${ddl}`);
    };
    await add(
      'expected_payment_date',
      'expected_payment_date DATE NULL AFTER payment_date',
    );
    await add(
      'total_amount',
      'total_amount DECIMAL(15,2) NULL AFTER daily_total',
    );
    await add(
      'total_manual',
      'total_manual TINYINT(1) NOT NULL DEFAULT 0 AFTER total_amount',
    );
    await add(
      'reopened_by_id',
      'reopened_by_id BIGINT UNSIGNED NULL AFTER paid_at',
    );
    await add(
      'reopened_at',
      'reopened_at DATETIME(3) NULL AFTER reopened_by_id',
    );
    const fks = (await q.getTable('field_agent_payments'))!.foreignKeys.map(
      (fk) => fk.name,
    );
    if (!fks.includes('fk_field_agent_payments_reopened_by'))
      await q.query(
        'ALTER TABLE field_agent_payments ADD CONSTRAINT fk_field_agent_payments_reopened_by FOREIGN KEY (reopened_by_id) REFERENCES users(id)',
      );

    await q.query(
      'UPDATE field_agent_payments SET total_amount = daily_total + additional_amount WHERE total_amount IS NULL',
    );
    await q.query(
      "UPDATE field_agent_payments SET expected_payment_date = payment_date WHERE status <> 'paid' AND payment_date IS NOT NULL AND expected_payment_date IS NULL",
    );
    await q.query(
      'ALTER TABLE field_agent_payments MODIFY COLUMN total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00',
    );

    for (const [key, description] of [
      ['payments:delete', 'Remuneração: excluir lançamento (exclusão lógica)'],
      [
        'payments:reopen',
        'Remuneração: reabrir lançamento aprovado para edição',
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
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.`key` IN ('payments:delete','payments:reopen')",
    );
    await q.query(
      "DELETE FROM permissions WHERE `key` IN ('payments:delete','payments:reopen')",
    );
    const fks = (await q.getTable('field_agent_payments'))!.foreignKeys.map(
      (fk) => fk.name,
    );
    if (fks.includes('fk_field_agent_payments_reopened_by'))
      await q.query(
        'ALTER TABLE field_agent_payments DROP FOREIGN KEY fk_field_agent_payments_reopened_by',
      );
    for (const column of [
      'reopened_at',
      'reopened_by_id',
      'total_manual',
      'total_amount',
      'expected_payment_date',
    ])
      if (await q.hasColumn('field_agent_payments', column))
        await q.query(`ALTER TABLE field_agent_payments DROP COLUMN ${column}`);
  }
}
