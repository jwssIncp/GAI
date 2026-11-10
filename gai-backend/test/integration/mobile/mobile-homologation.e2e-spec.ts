import { INestApplication } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';
import { FakeStorage } from '../storage.fake';
import { fixturePasswords } from '../../fixtures/passwords';
import { STORAGE_SIGNER } from '../../../src/common/storage/storage-signer.port';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { RoleType } from '../../../src/modules/users/domain/enums/role-type.enum';
import { FIELD_ACCESS_PERMISSIONS } from '../../../src/modules/field-agents/domain/field-access-permissions';
import { InventoryItemEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import { ImportPayloadEntity } from '../../../src/modules/import-sessions/infrastructure/persistence/import-payload.entity';
import { MobileRefreshTokenEntity } from '../../../src/modules/auth/infrastructure/persistence/mobile-refresh-token.entity';
import { MobileIdempotencyKeyEntity } from '../../../src/modules/mobile/mobile-idempotency-key.entity';
import { mobileRetention } from '../../../src/scripts/seed/mobile-retention';

const MYSQL = process.env.GAI_TEST_MYSQL_DISPOSABLE === '1';

/** Onda 4 homologation: real concurrency (MySQL), sync integrity, recovery,
 * retention and performance. Also runs on SQLite (serialized transactions). */
describe('Onda 4: mobile homologation (concurrency, integrity, recovery)', () => {
  let app: INestApplication, db: DataSource, admin: string, projectId: number;
  let devices: Array<{ token: string; userId: number; agentId: number }>;
  let serial = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const m = (path: string, project = projectId) =>
    `/api/v1/mobile/projects/${project}${path}`;
  const ext = () => `1730740${String(++serial).padStart(9, '0')}`;
  const adminPost = (path: string, body?: object) =>
    api()
      .post('/api/v1' + path)
      .set(bearer(admin))
      .send(body ?? {});

  const technician = async (extra: string[] = []) => {
    const source = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'test.user' });
    const copy = db.getRepository(UserEntity).create({
      ...source,
      login: `hom.${++serial}`,
      email: `hom.${serial}@example.invalid`,
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    delete (copy as Partial<UserEntity>).id;
    const user = await db.getRepository(UserEntity).save(copy);
    const role = await db.getRepository(RoleEntity).save({
      key: `SINTETICO_HOM_${serial}`,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      name: `SINTETICO Hom ${serial}`,
      description: null,
      isActive: true,
    });
    for (const p of await db
      .getRepository(PermissionEntity)
      .findBy({ key: In([...FIELD_ACCESS_PERMISSIONS, ...extra]) }))
      await db
        .getRepository(RolePermissionEntity)
        .save({ roleId: role.id, permissionId: p.id });
    await db.getRepository(UserRoleAssignmentEntity).save({
      userId: user.id,
      roleId: role.id,
      isActive: true,
      assignedBy: null,
      assignedAt: new Date(),
      revokedAt: null,
    });
    const agent = (
      await adminPost('/field-agents', {
        name: `SINTETICO Hom ${serial}`,
        user_id: user.id,
      }).expect(201)
    ).body.id as number;
    await adminPost(`/projects/${projectId}/field-agents`, {
      field_agent_id: agent,
    }).expect(201);
    const login = await api()
      .post('/api/v1/mobile/auth/login')
      .send({ identifier: user.login, password: fixturePasswords.user })
      .expect(200);
    return {
      token: login.body.access_token as string,
      userId: user.id,
      agentId: agent,
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    projectId = (
      await adminPost('/projects', {
        name: 'SINTETICO Homologacao',
        organization_id: 1,
        company_id: 1,
      }).expect(201)
    ).body.id;
    devices = [];
    for (let i = 0; i < 4; i++) devices.push(await technician());
  }, 600000);
  afterAll(async () => {
    if (app) await app.close();
  });

  it('keeps one row per external id and unique, ordered versions under concurrent devices', async () => {
    const shared = ext();
    const own = Array.from({ length: 24 }, () => ext());
    const results = await Promise.all([
      ...own.map((id, i) =>
        api()
          .put(m(`/items/${id}`))
          .set(bearer(devices[i % 4].token))
          .send({ description: `C${i}`, new_plate: String(1000 + i) }),
      ),
      ...devices.flatMap((d) =>
        [1, 2].map(() =>
          api()
            .put(m(`/items/${shared}`))
            .set(bearer(d.token))
            .send({ description: 'MESMO ITEM' }),
        ),
      ),
    ]);
    expect(
      results
        .filter((r) => ![200, 201].includes(r.status))
        .map((r) => r.status),
    ).toEqual([]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(25);
    expect(
      await db
        .getRepository(InventoryItemEntity)
        .countBy({ projectId, externalItemId: shared }),
    ).toBe(1);

    // Same base version from four devices: exactly one wins.
    const base = (
      await api()
        .get(m(`/items/${shared}`))
        .set(bearer(devices[0].token))
        .expect(200)
    ).body.version as number;
    const contested = await Promise.all(
      devices.map((d, i) =>
        api()
          .put(m(`/items/${shared}`))
          .set(bearer(d.token))
          .send({ description: `DEVICE ${i}`, base_version: base }),
      ),
    );
    expect(contested.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);

    const rows = await db
      .getRepository(InventoryItemEntity)
      .find({ where: { projectId }, withDeleted: true });
    const versions = rows.map((r) => r.syncSeq);
    expect(new Set(versions).size).toBe(versions.length);
    expect(Math.min(...versions)).toBeGreaterThan(0);

    // Paging while other devices keep writing: every item arrives, no duplicates
    // within a pass, and each later change arrives again with a higher version.
    const seen = new Map<string, number>();
    let cursor: string | undefined;
    let writes = 0;
    for (let guard = 0; guard < 100; guard++) {
      const page = (
        await api()
          .get(m('/items/sync'))
          .query({ ...(cursor ? { cursor } : {}), limit: 5 })
          .set(bearer(devices[1].token))
          .expect(200)
      ).body;
      for (const item of page.items) {
        const previous = seen.get(item.external_item_id);
        if (previous !== undefined)
          expect(item.version).toBeGreaterThan(previous);
        seen.set(item.external_item_id, item.version);
      }
      if (writes < 5) {
        const target = own[writes++ * 3];
        const current = (
          await api()
            .get(m(`/items/${target}`))
            .set(bearer(devices[2].token))
        ).body.version;
        await api()
          .put(m(`/items/${target}`))
          .set(bearer(devices[2].token))
          .send({ notes: `paging ${writes}`, base_version: current })
          .expect(200);
      }
      cursor = page.next_cursor;
      if (!page.has_more) break;
    }
    expect(seen.size).toBe(25);
    const final = await db
      .getRepository(InventoryItemEntity)
      .find({ where: { projectId, externalItemId: In(own) } });
    for (const row of final)
      expect(seen.get(row.externalItemId!)).toBe(row.syncSeq);
  }, 300000);

  it('applies explicit nulls in mobile reconciliation like PUT, but not in web imports', async () => {
    const id = ext();
    await api()
      .put(m(`/items/${id}`))
      .set(bearer(devices[0].token))
      .send({ description: 'X', brand: 'MARCA', extra_fields: { Setor: 'TI' } })
      .expect(201);
    const uuid = (
      await api()
        .post(m('/import-sessions'))
        .set(bearer(devices[0].token))
        .send({})
        .expect(201)
    ).body.session_uuid;
    await api()
      .post(m(`/import-sessions/${uuid}/payloads`))
      .set(bearer(devices[0].token))
      .send({
        payload_number: 1,
        idempotency_key: `${uuid}-1`,
        items: [
          {
            operation: 'upsert',
            external_item_id: id,
            brand: null,
            extra_fields: null,
          },
        ],
      })
      .expect(201);
    const after = (
      await api()
        .get(m(`/items/${id}`))
        .set(bearer(devices[0].token))
        .expect(200)
    ).body;
    expect(after).toMatchObject({
      brand: null,
      extra_fields: {},
      description: 'X',
    });

    const web = (
      await adminPost(`/projects/${projectId}/import-sessions`, {
        type: 'inventory_items_import',
        source: 'web_admin',
      }).expect(201)
    ).body;
    await adminPost(
      `/projects/${projectId}/import-sessions/${web.id}/payloads`,
      {
        payload_number: 1,
        idempotency_key: 'web-null-1',
        items: [
          { operation: 'upsert', external_item_id: id, description: null },
        ],
      },
    ).expect(201);
    expect(
      (
        await api()
          .get(m(`/items/${id}`))
          .set(bearer(devices[0].token))
      ).body.description,
    ).toBe('X');
  });

  it('recovers an interrupted payload (stuck in processing) through reprocess', async () => {
    const web = (
      await adminPost(`/projects/${projectId}/import-sessions`, {
        type: 'inventory_items_import',
        source: 'web_admin',
      }).expect(201)
    ).body;
    const payload = (
      await adminPost(
        `/projects/${projectId}/import-sessions/${web.id}/payloads`,
        {
          payload_number: 1,
          idempotency_key: 'crash-1',
          items: [
            {
              operation: 'upsert',
              external_item_id: ext(),
              description: 'RECUPERADO',
            },
          ],
        },
      ).expect(201)
    ).body;
    // Simulate a crash between chunks: still processing, last touched 20 min ago.
    await db.getRepository(ImportPayloadEntity).update(payload.id, {
      status: 'processing' as ImportPayloadEntity['status'],
      updatedAt: new Date(Date.now() - 20 * 60000),
    });
    await adminPost(
      `/projects/${projectId}/import-sessions/${web.id}/finish`,
    ).expect(409);
    await adminPost(
      `/projects/${projectId}/import-sessions/${web.id}/payloads/${payload.id}/reprocess`,
    )
      .expect(200)
      .expect((r) => expect(r.body.status).toBe('processed'));
    const session = (
      await api()
        .get(`/api/v1/projects/${projectId}/import-sessions/${web.id}`)
        .set(bearer(admin))
        .expect(200)
    ).body;
    expect(session).toMatchObject({ received_payloads: 1, total_items: 1 });
    await adminPost(
      `/projects/${projectId}/import-sessions/${web.id}/finish`,
    ).expect(200);
    expect(
      (
        await db
          .getRepository(ImportPayloadEntity)
          .findOneByOrFail({ id: payload.id })
      ).status,
    ).toBe('processed');
  });

  it('limits expense receipts separately from backups', async () => {
    const payer = await technician([
      'expenses:create',
      'expenses:read',
      'expenses:upload-attachment',
    ]);
    const expense = (
      await api()
        .post(m('/expenses'))
        .set(bearer(payer.token))
        .send({
          client_expense_id: 'hom-expense-0001',
          description: 'SINTETICO',
          expense_date: '2026-11-08',
          amount: '1.00',
        })
        .expect(201)
    ).body.expense;
    await api()
      .post(m(`/expenses/${expense.id}/attachments/upload-url`))
      .set(bearer(payer.token))
      .send({
        original_name: 'nota.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 21 * 1024 * 1024,
      })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('STORAGE_INVALID_SIZE'));
    const ok = await api()
      .post(m(`/expenses/${expense.id}/attachments/upload-url`))
      .set(bearer(payer.token))
      .send({
        original_name: 'nota.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 2 * 1024 * 1024,
      })
      .expect(201);
    app.get<FakeStorage>(STORAGE_SIGNER).put(ok.body.upload_url);
  });

  it('purges only unusable refresh tokens and idempotency keys (dry-run first)', async () => {
    const t = devices[3];
    const old = new Date(Date.now() - 40 * 86400000);
    const tokens = db.getRepository(MobileRefreshTokenEntity);
    const live = await tokens.countBy({ userId: t.userId });
    await tokens.save({
      familyId: 'aaaaaaaa-0000-4000-8000-000000000001',
      tokenHash: 'f'.repeat(64),
      userId: t.userId,
      organizationId: 1,
      sessionId: 'aaaaaaaa-0000-4000-8000-000000000002',
      authVersion: 0,
      expiresAt: old,
      familyExpiresAt: old,
      rotatedAt: null,
      revokedAt: null,
      revokedReason: null,
      replacedById: null,
      deviceLabel: null,
    });
    await db.getRepository(MobileIdempotencyKeyEntity).save({
      organizationId: 1,
      userId: t.userId,
      scope: 'expense',
      idempotencyKey: 'hom-stale-claim-1',
      requestHash: 'a'.repeat(64),
      resourceId: null,
      createdAt: new Date(Date.now() - 2 * 86400000),
    });
    const dry = await mobileRetention(db, { apply: false });
    expect(dry).toMatchObject({
      refresh_tokens: 1,
      stale_idempotency_claims: 1,
    });
    expect(await tokens.countBy({ userId: t.userId })).toBe(live + 1);
    await mobileRetention(db, { apply: true });
    expect(await tokens.countBy({ userId: t.userId })).toBe(live);
    expect(
      await db
        .getRepository(MobileIdempotencyKeyEntity)
        .countBy({ idempotencyKey: 'hom-stale-claim-1' }),
    ).toBe(0);
    await api().get('/api/v1/mobile/me').set(bearer(t.token)).expect(200);
  });

  it('builds the plate report for a large project within budget', async () => {
    const big = (
      await adminPost('/projects', {
        name: 'SINTETICO Grande',
        organization_id: 1,
        company_id: 1,
      }).expect(201)
    ).body.id as number;
    await adminPost(`/projects/${big}/field-agents`, {
      field_agent_id: devices[0].agentId,
    }).expect(201);
    const total = MYSQL ? 100000 : 20000;
    const stamp = '2026-11-09 10:00:00.000';
    for (let start = 0; start < total; start += 2000) {
      const values: string[] = [];
      for (let i = start; i < Math.min(start + 2000, total); i++) {
        const plate = i % 97 === 0 ? 'NULL' : `'${(i * 2) % 15000}'`;
        values.push(
          `(1, ${big}, 'BIG${i}', ${plate}, 'pending', 'bench', '${stamp}', '${stamp}', 0)`,
        );
      }
      await db.query(
        `INSERT INTO inventory_items (organization_id, project_id, external_item_id, new_plate, status, source, created_at, updated_at, sync_seq) VALUES ${values.join(',')}`,
      );
    }
    const started = Date.now();
    const report = (
      await api()
        .get(m('/plates/report', big))
        .set(bearer(devices[0].token))
        .expect(200)
    ).body;
    const elapsed = Date.now() - started;
    console.log(
      `plate report: ${total} items in ${elapsed} ms (${MYSQL ? 'mysql' : 'sqlite'})`,
    );
    expect(report.totals.items).toBe(total);
    expect(report.duplicated_new_plates.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(15000);
  }, 600000);
});
