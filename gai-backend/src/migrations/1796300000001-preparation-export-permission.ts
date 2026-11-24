import { MigrationInterface, QueryRunner } from 'typeorm';

const KEY = 'project-preparation:export';

/**
 * Permissão própria para exportar o kick-off em planilha (contém contatos dos focais — LGPD).
 * Para não tirar de ninguém o que já fazia (a tela exportava CSV só com a leitura), os papéis
 * que já consultam a preparação recebem a nova permissão. Repetível.
 */
export class PreparationExportPermission1796300000001 implements MigrationInterface {
  name = 'PreparationExportPermission1796300000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `key`=`key`',
      [
        KEY,
        'project-preparation',
        'export',
        'ORGANIZATION',
        'Exportar o kick-off em planilha (inclui contatos dos focais)',
      ],
    );
    await q.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT rp.role_id, target.id
         FROM role_permissions rp
         JOIN permissions source ON source.id = rp.permission_id AND source.\`key\` = 'project-preparation:read'
         JOIN permissions target ON target.\`key\` = ?
        WHERE NOT EXISTS (
          SELECT 1 FROM role_permissions existing
           WHERE existing.role_id = rp.role_id AND existing.permission_id = target.id
        )`,
      [KEY],
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.`key` = ?',
      [KEY],
    );
    await q.query('DELETE FROM permissions WHERE `key` = ?', [KEY]);
  }
}
