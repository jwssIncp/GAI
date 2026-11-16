import { join } from 'path';
import { DataSource } from 'typeorm';
import { PERMISSION_DESCRIPTIONS_PT_BR } from '../../../src/migrations/1795700000001-permission-descriptions-pt-br';

// Migration de dados (só texto). Roda do zero num banco próprio do container
// MySQL descartável; nunca toca o banco da aplicação.
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
const DATABASE = 'gai_permission_descriptions_test';
const MIGRATION = 'PermissionDescriptionsPtBr1795700000001';
const byKey = new Map(PERMISSION_DESCRIPTIONS_PT_BR.map((r) => [r[0], r]));

mysqlSuite('Migration das descrições de permissões (pt-BR)', () => {
  let admin: DataSource;
  let db: DataSource;

  const descriptions = async () =>
    new Map<string, string>(
      (await db.query('SELECT `key`, description FROM permissions')).map(
        (r: { key: string; description: string }) => [r.key, r.description],
      ),
    );
  // Tudo o que não é texto: ids, chaves, escopos, perfis, vínculos e atribuições.
  const structure = async () =>
    JSON.stringify([
      await db.query(
        'SELECT id, `key`, resource, action, scope FROM permissions ORDER BY id',
      ),
      await db.query('SELECT * FROM role_permissions ORDER BY 1, 2'),
      await db.query('SELECT id, `key` FROM roles ORDER BY id'),
    ]);

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

  it('do zero: as chaves criadas pelas migrations ficam com o texto novo', async () => {
    await db.runMigrations();
    const now = await descriptions();
    const fromMigrations = [...now.keys()].filter((k) => byKey.has(k));
    expect(fromMigrations.length).toBeGreaterThan(0);
    for (const key of fromMigrations)
      expect(now.get(key)).toBe(byKey.get(key)![2]);
  }, 300_000);

  it('revert volta ao texto antigo; num banco como o de produção só troca textos antigos conhecidos', async () => {
    await db.undoLastMigration();
    const reverted = await descriptions();
    for (const [key, text] of reverted)
      if (byKey.has(key)) expect(text).toBe(byKey.get(key)![3]);

    // Banco como o de produção: chaves que só o seed criava, com o texto
    // antigo do seed; uma chave com o outro texto antigo; uma editada à mão.
    for (const [key, from] of PERMISSION_DESCRIPTIONS_PT_BR)
      if (!reverted.has(key)) {
        const [resource, action] = key.split(':');
        await db.query(
          "INSERT INTO permissions (`key`, resource, action, scope, description) VALUES (?, ?, ?, 'ORGANIZATION', ?)",
          [key, resource, action, from[0]],
        );
      }
    const variant = PERMISSION_DESCRIPTIONS_PT_BR.find(
      ([key, from]) => from.length === 2 && reverted.has(key),
    )!;
    const otherOld = variant[1].find((t) => t !== variant[3])!;
    await db.query('UPDATE permissions SET description = ? WHERE `key` = ?', [
      otherOld,
      variant[0],
    ]);
    const manualKey = [...reverted.keys()].find(
      (k) => byKey.has(k) && k !== variant[0],
    )!;
    await db.query('UPDATE permissions SET description = ? WHERE `key` = ?', [
      'Texto ajustado pela organização',
      manualKey,
    ]);
    const before = await structure();

    await db.runMigrations();
    const after = await descriptions();
    for (const [key, , to] of PERMISSION_DESCRIPTIONS_PT_BR)
      if (key !== manualKey) expect(after.get(key)).toBe(to);
    expect(after.get(manualKey)).toBe('Texto ajustado pela organização');
    expect(await structure()).toBe(before);

    // Rodar de novo: nada pendente, nada muda.
    expect(await db.runMigrations()).toEqual([]);
    expect(await descriptions()).toEqual(after);

    // Revert de novo: volta ao texto antigo e preserva a edição manual.
    await db.undoLastMigration();
    const undone = await descriptions();
    for (const [key, , , restore] of PERMISSION_DESCRIPTIONS_PT_BR)
      if (key !== manualKey) expect(undone.get(key)).toBe(restore);
    expect(undone.get(manualKey)).toBe('Texto ajustado pela organização');
    expect(await structure()).toBe(before);
    const executed = await db.query('SELECT name FROM migrations');
    expect(executed.map((m: { name: string }) => m.name)).not.toContain(
      MIGRATION,
    );
  }, 300_000);
});
