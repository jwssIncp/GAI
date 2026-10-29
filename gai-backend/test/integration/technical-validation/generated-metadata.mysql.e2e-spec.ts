import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, seedTestData } from '../test-app.helper';
import { RegisterGeneratedColumnMetadata1794000000001 } from '../../../src/migrations/1794000000001-register-generated-column-metadata';

describe('Generated assignment column metadata (disposable MySQL)', () => {
  let app: INestApplication, ds: DataSource;
  beforeAll(async () => {
    if (process.env.GAI_TEST_MYSQL_WAVE1 !== '1')
      throw Error('Use disposable MySQL runner');
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
  });
  afterAll(async () => {
    await app?.close();
  });
  it('loads the registered expression and unique index on a fresh migrated database', async () => {
    const qr = ds.createQueryRunner();
    try {
      const [table] = await qr.getTables(['project_field_agents']);
      const column = table.columns.find(
        (c) => c.name === 'active_assignment_key',
      )!;
      expect(column.generatedType).toBe('STORED');
      expect(column.asExpression).toContain('CONCAT');
      expect(
        table.indices.some(
          (i) => i.name === 'uq_project_field_agents_active_key' && i.isUnique,
        ),
      ).toBe(true);
      const [count] = await ds.query('SELECT COUNT(*) n FROM migrations');
      expect(Number(count.n)).toBe(33);
      expect(await ds.showMigrations()).toBe(false);
    } finally {
      await qr.release();
    }
  });
  it('registration is idempotent without rewriting assignments', async () => {
    const before = await ds.query(
        'SELECT * FROM project_field_agents ORDER BY id',
      ),
      qr = ds.createQueryRunner();
    try {
      const migration = new RegisterGeneratedColumnMetadata1794000000001();
      await migration.up(qr);
      await migration.up(qr);
      const [row] = await ds.query(
        "SELECT COUNT(*) n FROM typeorm_metadata WHERE `type`='GENERATED_COLUMN' AND `schema`=DATABASE() AND `table`='project_field_agents' AND `name`='active_assignment_key'",
      );
      expect(Number(row.n)).toBe(1);
      expect(
        await ds.query('SELECT * FROM project_field_agents ORDER BY id'),
      ).toEqual(before);
    } finally {
      await qr.release();
    }
  });
});
