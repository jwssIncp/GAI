import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E-mail opcional SÓ para conta de inventariante criada com senha temporária
 * (as demais contas seguem com e-mail obrigatório pela validação da API).
 *
 * up: users.email passa a aceitar NULL. A unicidade (uk_users_email) continua:
 * MySQL e SQLite aceitam vários NULL num índice UNIQUE, e o CHECK
 * ck_users_email_namespace (LOCATE('@', email) > 1) é satisfeito por NULL.
 *
 * down: preenche sem-email+<id>@invalido.local nas linhas nulas (único por id)
 * e volta ao NOT NULL.
 *
 * Portável: SQL próprio no MySQL (MODIFY mantém o índice único, o CHECK e a
 * collation da tabela); nos demais drivers, changeColumn do TypeORM.
 */
export class UsersEmailOptional1795800000001 implements MigrationInterface {
  name = 'UsersEmailOptional1795800000001';

  async up(q: QueryRunner): Promise<void> {
    await this.setNullable(q, true);
  }

  async down(q: QueryRunner): Promise<void> {
    const mysql = q.connection.options.type === 'mysql';
    await q.query(
      mysql
        ? "UPDATE users SET email = CONCAT('sem-email+', id, '@invalido.local') WHERE email IS NULL"
        : "UPDATE users SET email = 'sem-email+' || id || '@invalido.local' WHERE email IS NULL",
    );
    await this.setNullable(q, false);
  }

  private async setNullable(q: QueryRunner, nullable: boolean): Promise<void> {
    if (q.connection.options.type === 'mysql') {
      await q.query(
        `ALTER TABLE users MODIFY email VARCHAR(255) ${nullable ? 'NULL' : 'NOT NULL'}`,
      );
      return;
    }
    const table = await q.getTable('users');
    const column = table?.findColumnByName('email');
    if (!table || !column) throw new Error('users.email não encontrado.');
    const changed = column.clone();
    changed.isNullable = nullable;
    await q.changeColumn(table, column, changed);
  }
}
