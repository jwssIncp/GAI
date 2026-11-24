import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * E-mail ao cliente do kick-off: o modelo do e-mail fica na versão do modelo da organização
 * (nada de texto fixo no código) e a versão editada fica no kick-off, como texto simples,
 * com a revisão das respostas em que se baseia e um controle de concorrência próprio.
 * Aditiva e repetível.
 */
export class PreparationClientEmail1796200000001 implements MigrationInterface {
  name = 'PreparationClientEmail1796200000001';

  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('preparation_template_versions', 'email')))
      await q.addColumn(
        'preparation_template_versions',
        new TableColumn({ name: 'email', type: 'json', isNullable: true }),
      );
    const columns = [
      new TableColumn({ name: 'email_text', type: 'text', isNullable: true }),
      new TableColumn({
        name: 'email_source_revision',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'email_version',
        type: 'int',
        isNullable: false,
        default: 0,
      }),
      new TableColumn({
        name: 'email_updated_by_id',
        type: 'bigint',
        unsigned: true,
        isNullable: true,
      }),
      new TableColumn({
        name: 'email_updated_at',
        type: 'datetime',
        precision: 3,
        isNullable: true,
      }),
    ];
    for (const column of columns)
      if (!(await q.hasColumn('project_preparations', column.name)))
        await q.addColumn('project_preparations', column);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const name of [
      'email_updated_at',
      'email_updated_by_id',
      'email_version',
      'email_source_revision',
      'email_text',
    ])
      if (await q.hasColumn('project_preparations', name))
        await q.dropColumn('project_preparations', name);
    if (await q.hasColumn('preparation_template_versions', 'email'))
      await q.dropColumn('preparation_template_versions', 'email');
  }
}
