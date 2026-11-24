import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * "Realizado" do kick-off, separado da resposta (padrão do sistema anterior): a resposta
 * registra o que foi combinado; o realizado indica que o item foi tratado. Guarda quem marcou
 * e quando. Aditiva e repetível: respostas existentes ficam como não realizadas.
 */
export class PreparationAnswerRealized1796100000001 implements MigrationInterface {
  name = 'PreparationAnswerRealized1796100000001';

  async up(q: QueryRunner): Promise<void> {
    const columns = [
      new TableColumn({
        name: 'realized',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'realized_at',
        type: 'datetime',
        precision: 3,
        isNullable: true,
      }),
      new TableColumn({
        name: 'realized_by_id',
        type: 'bigint',
        unsigned: true,
        isNullable: true,
      }),
    ];
    for (const column of columns)
      if (!(await q.hasColumn('preparation_answers', column.name)))
        await q.addColumn('preparation_answers', column);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const name of ['realized_by_id', 'realized_at', 'realized'])
      if (await q.hasColumn('preparation_answers', name))
        await q.dropColumn('preparation_answers', name);
  }
}
