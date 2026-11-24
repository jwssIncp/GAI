import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Classificação manual da sobra contábil (NPI - COMPLEMENTO, NPI - SOFTWARE,
 * NPI - EDIFICAÇÕES E TERRENOS, ABRIR NF ou texto livre), separada do status de
 * conciliação. Aditiva e repetível: linhas existentes ficam sem classificação.
 */
export class AccountingSurplusClassification1796000000001 implements MigrationInterface {
  name = 'AccountingSurplusClassification1796000000001';

  async up(q: QueryRunner): Promise<void> {
    if (
      await q.hasColumn('inventory_accounting_items', 'surplus_classification')
    )
      return;
    await q.addColumn(
      'inventory_accounting_items',
      new TableColumn({
        name: 'surplus_classification',
        type: 'varchar',
        length: '120',
        isNullable: true,
      }),
    );
  }

  async down(q: QueryRunner): Promise<void> {
    if (
      await q.hasColumn('inventory_accounting_items', 'surplus_classification')
    )
      await q.dropColumn(
        'inventory_accounting_items',
        'surplus_classification',
      );
  }
}
