import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Cadastro do inventariante: cidade de residência e indicação (texto livre), e o tipo de
 * cada documento anexado (ficha cadastral, CNH, exame, certificado ou outro). Documentos já
 * anexados ficam como "outro". Aditiva e repetível.
 */
export class FieldAgentCityReferralDocumentCategory1796400000001 implements MigrationInterface {
  name = 'FieldAgentCityReferralDocumentCategory1796400000001';

  async up(q: QueryRunner): Promise<void> {
    const agentColumns = [
      new TableColumn({
        name: 'city',
        type: 'varchar',
        length: '120',
        isNullable: true,
      }),
      new TableColumn({
        name: 'referral',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    ];
    for (const column of agentColumns)
      if (!(await q.hasColumn('field_agents', column.name)))
        await q.addColumn('field_agents', column);
    if (!(await q.hasColumn('field_agent_documents', 'category')))
      await q.addColumn(
        'field_agent_documents',
        new TableColumn({
          name: 'category',
          type: 'varchar',
          length: '30',
          isNullable: false,
          default: "'other'",
        }),
      );
  }

  async down(q: QueryRunner): Promise<void> {
    if (await q.hasColumn('field_agent_documents', 'category'))
      await q.dropColumn('field_agent_documents', 'category');
    for (const name of ['referral', 'city'])
      if (await q.hasColumn('field_agents', name))
        await q.dropColumn('field_agents', name);
  }
}
