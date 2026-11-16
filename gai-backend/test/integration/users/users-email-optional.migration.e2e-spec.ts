import { DataSource } from 'typeorm';
import { UsersEmailOptional1795800000001 } from '../../../src/migrations/1795800000001-users-email-optional';

// As demais migrations do projeto são só MySQL. Aqui a migration roda isolada
// num SQLite em memória, com a tabela users no estado anterior (e-mail NOT
// NULL e único). O teste do zero, com todas as migrations, é o .mysql.
describe('Migration users.email opcional (SQLite isolado)', () => {
  let db: DataSource;
  const migration = new UsersEmailOptional1795800000001();
  const run = async (step: 'up' | 'down') => {
    const runner = db.createQueryRunner();
    try {
      await migration[step](runner);
    } finally {
      await runner.release();
    }
  };
  const insert = (login: string, email: string | null) =>
    db.query(
      "INSERT INTO users (login, email, password_hash, status) VALUES (?, ?, 'x', 'ACTIVE')",
      [login, email],
    );
  const emails = (): Promise<
    Array<{ id: number; login: string; email: string | null }>
  > => db.query('SELECT id, login, email FROM users ORDER BY id');

  beforeAll(async () => {
    db = new DataSource({ type: 'sqlite', database: ':memory:' });
    await db.initialize();
    await db.query(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      CONSTRAINT uk_users_login UNIQUE (login),
      CONSTRAINT uk_users_email UNIQUE (email)
    )`);
    await insert('antes', 'antes@example.invalid');
  });
  afterAll(async () => {
    await db?.destroy();
  });

  it('antes: e-mail obrigatório', async () => {
    await expect(insert('nulo.antes', null)).rejects.toThrow(/NOT NULL/i);
  });

  it('up: aceita NULL (vários) e mantém a unicidade dos preenchidos', async () => {
    await run('up');
    await insert('campo.um', null);
    await insert('campo.dois', null);
    await expect(insert('repetido', 'antes@example.invalid')).rejects.toThrow(
      /UNIQUE/i,
    );
    expect((await emails()).map((r) => r.email)).toEqual([
      'antes@example.invalid',
      null,
      null,
    ]);
  });

  it('down: preenche sem-email+<id>@invalido.local e volta ao NOT NULL', async () => {
    await run('down');
    const rows = await emails();
    expect(rows[0].email).toBe('antes@example.invalid');
    for (const row of rows.slice(1))
      expect(row.email).toBe(`sem-email+${row.id}@invalido.local`);
    await expect(insert('nulo.depois', null)).rejects.toThrow(/NOT NULL/i);
    await expect(insert('repetido', 'antes@example.invalid')).rejects.toThrow(
      /UNIQUE/i,
    );
  });
});
