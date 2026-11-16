import { join } from 'path';
import { DataSource } from 'typeorm';

// Roda todas as migrations do zero num banco próprio do container MySQL
// descartável (nunca o banco da aplicação), depois reverte e reaplica.
const mysqlSuite =
  process.env.GAI_TEST_MYSQL_DISPOSABLE === '1' ? describe : describe.skip;

const port =
  process.env.GAI_TEST_MYSQL_WAVE2 === '1'
    ? 33347
    : process.env.GAI_TEST_MYSQL_WAVE1 === '1'
      ? 33337
      : process.env.GAI_TEST_MYSQL_WAVE0 === '1'
        ? 33327
        : 33317;
const base = {
  type: 'mysql' as const,
  host: '127.0.0.1',
  port,
  username: 'root',
  password: 'gai-validation-only',
  charset: 'utf8mb4',
};
const DATABASE = 'gai_users_email_optional_test';
const MIGRATION = 'UsersEmailOptional1795800000001';

mysqlSuite('Migration users.email opcional (MySQL, do zero)', () => {
  let admin: DataSource;
  let db: DataSource;

  const column = async () =>
    (
      await db.query(
        "SELECT IS_NULLABLE nullable, COLLATION_NAME collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'",
      )
    )[0] as { nullable: string; collation: string };
  const uniqueEmailIndex = async () =>
    (
      await db.query(
        "SELECT DISTINCT INDEX_NAME name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email' AND NON_UNIQUE = 0",
      )
    ).map((r: { name: string }) => r.name);
  const insert = (login: string, email: string | null) =>
    db.query(
      "INSERT INTO users (login, email, password_hash, status, password_changed_at) VALUES (?, ?, 'x', 'ACTIVE', NOW(3))",
      [login, email],
    );

  beforeAll(async () => {
    admin = new DataSource(base);
    await admin.initialize();
    await admin.query(`DROP DATABASE IF EXISTS ${DATABASE}`);
    await admin.query(`CREATE DATABASE ${DATABASE} CHARACTER SET utf8mb4`);
    db = new DataSource({
      ...base,
      database: DATABASE,
      migrations: [join(__dirname, '../../../src/migrations/*.ts')],
      synchronize: false,
    });
    await db.initialize();
  }, 300_000);

  afterAll(async () => {
    await db?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS ${DATABASE}`);
    await admin?.destroy();
  });

  it('do zero: e-mail aceita NULL e continua único', async () => {
    await db.runMigrations();
    const before = await column();
    expect(before.nullable).toBe('YES');
    expect(await uniqueEmailIndex()).toEqual(['uk_users_email']);
    await insert('campo.sem.email.um', null);
    await insert('campo.sem.email.dois', null);
    await insert('com.email', 'com.email@example.invalid');
    await expect(
      insert('outro.com.email', 'com.email@example.invalid'),
    ).rejects.toMatchObject({ driverError: { code: 'ER_DUP_ENTRY' } });
    // O CHECK de namespace continua barrando e-mail sem "@".
    await expect(insert('sem.arroba', 'semarroba')).rejects.toBeDefined();
  }, 300_000);

  it('revert preenche sem-email+<id>@invalido.local e volta ao NOT NULL; reaplica', async () => {
    const { collation } = await column();
    const last = await db.query(
      'SELECT name FROM migrations ORDER BY id DESC LIMIT 1',
    );
    expect(last[0].name).toBe(MIGRATION);
    await db.undoLastMigration();
    expect(await column()).toEqual({ nullable: 'NO', collation });
    expect(await uniqueEmailIndex()).toEqual(['uk_users_email']);
    const rows = await db.query(
      "SELECT id, email FROM users WHERE login LIKE 'campo.sem.email.%' ORDER BY id",
    );
    expect(rows).toHaveLength(2);
    for (const row of rows)
      expect(row.email).toBe(`sem-email+${row.id}@invalido.local`);
    await expect(insert('nulo.depois', null)).rejects.toBeDefined();

    await db.runMigrations();
    expect((await column()).nullable).toBe('YES');
    expect(await db.runMigrations()).toEqual([]);
  }, 300_000);
});
