import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Valor residual (líquido contábil) na base contábil: alimenta os indicadores de valor da
 * conciliação (saldo, conciliado, sobra contábil) como no sistema anterior.
 * Aditiva e repetível: linhas existentes ficam com NULL (ausência não é zero).
 */
export class AccountingResidualValue1795900000001 implements MigrationInterface {
  name = 'AccountingResidualValue1795900000001';

  async up(q: QueryRunner): Promise<void> {
    if (await q.hasColumn('inventory_accounting_items', 'residual_value'))
      return;
    await q.addColumn(
      'inventory_accounting_items',
      new TableColumn({
        name: 'residual_value',
        type: 'decimal',
        precision: 15,
        scale: 2,
        isNullable: true,
      }),
    );
  }

  async down(q: QueryRunner): Promise<void> {
    if (await q.hasColumn('inventory_accounting_items', 'residual_value'))
      await q.dropColumn('inventory_accounting_items', 'residual_value');
  }
}
