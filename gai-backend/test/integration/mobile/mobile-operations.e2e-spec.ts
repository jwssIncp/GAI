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
import { InventoryItemSyncCounterEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item-sync-counter.entity';
import { ImportFileEntity } from '../../../src/modules/import-sessions/infrastructure/persistence/import-file.entity';

const FINANCIAL = [
  'expenses:create',
  'expenses:read',
  'expenses:upload-attachment',
];

describe('Onda 3: plates, expenses and mobile reconciliation', () => {
  let app: INestApplication,
    db: DataSource,
    admin: string,
    storage: FakeStorage;
  let projectId: number, otherProject: number;
  let serial = 0;
  type Tech = { token: string; userId: number; agentId: number; name: string };
  let tech: Tech, colleague: Tech, payer: Tech;
  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const adminPost = (path: string, body?: object) =>
    api()
      .post('/api/v1' + path)
      .set(bearer(admin))
      .send(body ?? {});
  const m = (path: string, project = projectId) =>
    `/api/v1/mobile/projects/${project}${path}`;
  const post = (t: Tech, path: string, body?: object, project = projectId) =>
    api()
      .post(m(path, project))
      .set(bearer(t.token))
      .send(body ?? {});
  const get = (
    t: Tech,
    path: string,
    query: object = {},
    project = projectId,
  ) => api().get(m(path, project)).query(query).set(bearer(t.token));
  const put = (t: Tech, id: string, body: object) =>
    api()
      .put(m(`/items/${id}`))
      .set(bearer(t.token))
      .send(body);
  const ext = () => `17307${String(++serial).padStart(11, '0')}`;

  const technician = async (extra: string[] = []): Promise<Tech> => {
    const source = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'test.user' });
    const name = `SINTETICO Tecnico ${++serial}`;
    const copy = db.getRepository(UserEntity).create({
      ...source,
      login: `ops.${serial}`,
      email: `ops.${serial}@example.invalid`,
      fullName: name,
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    delete (copy as Partial<UserEntity>).id;
    const user = await db.getRepository(UserEntity).save(copy);
    const role = await db.getRepository(RoleEntity).save({
      key: `SINTETICO_OPS_${serial}`,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      name: `SINTETICO Ops ${serial}`,
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
      await adminPost('/field-agents', { name, user_id: user.id }).expect(201)
    ).body as { id: number };
    await adminPost(`/projects/${projectId}/field-agents`, {
      field_agent_id: agent.id,
    }).expect(201);
    const login = await api()
      .post('/api/v1/mobile/auth/login')
      .send({ identifier: user.login, password: fixturePasswords.user })
      .expect(200);
    return {
      token: login.body.access_token,
      userId: user.id,
      agentId: agent.id,
      name,
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    storage = app.get<FakeStorage>(STORAGE_SIGNER);
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    const project = async (name: string) =>
      (
        await adminPost('/projects', {
          name,
          organization_id: 1,
          company_id: 1,
        }).expect(201)
      ).body.id as number;
    projectId = await project('SINTETICO Ops A');
    otherProject = await project('SINTETICO Ops B');
    tech = await technician();
    colleague = await technician();
    payer = await technician(FINANCIAL);
  }, 300000);
  afterAll(async () => {
    if (app) await app.close();
  });

  it('reports missing and duplicated plates read-only, including old_plate_2', async () => {
    for (const plate of ['1', '2', '3', '5', '9', 'A-10'])
      await put(tech, ext(), { new_plate: plate, unit_text: 'SEDE' }).expect(
        201,
      );
    await put(tech, ext(), {
      new_plate: '251',
      location_text: 'RECEPCAO',
    }).expect(201);
    await put(colleague, ext(), {
      new_plate: '251',
      location_text: 'SALA 2',
    }).expect(201);
    const editing = ext();
    await put(tech, editing, { new_plate: '30', old_plate: '777' }).expect(201);
    await put(colleague, ext(), {
      new_plate: '31',
      old_plate_2: '7-7-7',
    }).expect(201);
    const gone = ext();
    await put(tech, gone, { new_plate: '4' }).expect(201);
    await api()
      .delete(m(`/items/${gone}`))
      .set(bearer(tech.token))
      .expect(200);

    const seqBefore = await db
      .getRepository(InventoryItemSyncCounterEntity)
      .findOneByOrFail({ projectId });
    const report = (await get(tech, '/plates/report', { to: 12 }).expect(200))
      .body;
    expect(report.missing_new_plates).toMatchObject({
      from: 1,
      to: 12,
      ranges: ['4', '6-8', '10-12'],
      count: 7,
    });
    expect(report.totals.non_numeric_new_plates).toBe(1);
    expect(report.duplicated_new_plates).toHaveLength(1);
    expect(report.duplicated_new_plates[0].plate).toBe('251');
    expect(
      report.duplicated_new_plates[0].items
        .map((i: { technician: { name: string } }) => i.technician.name)
        .sort(),
    ).toEqual([tech.name, colleague.name].sort());
    expect(
      report.duplicated_new_plates[0].items
        .map((i: { location_text: string }) => i.location_text)
        .sort(),
    ).toEqual(['RECEPCAO', 'SALA 2']);
    expect(report.duplicated_old_plates).toEqual([
      expect.objectContaining({ plate: '777', items: expect.any(Array) }),
    ]);
    expect(report.duplicated_old_plates[0].items).toHaveLength(2);
    const seqAfter = await db
      .getRepository(InventoryItemSyncCounterEntity)
      .findOneByOrFail({ projectId });
    expect(seqAfter.lastSeq).toBe(seqBefore.lastSeq);

    await get(tech, '/plates/check', { plate: '25-1' })
      .expect(200)
      .expect((r) =>
        expect(r.body).toMatchObject({ plate: '251', exists: true }),
      );
    await get(tech, '/plates/check', { plate: '4' })
      .expect(200)
      .expect((r) => expect(r.body.exists).toBe(false));
    const old = (
      await get(tech, '/plates/check', { plate: '777', kind: 'old' }).expect(
        200,
      )
    ).body;
    expect(
      old.matches
        .flatMap((x: { matched_fields: string[] }) => x.matched_fields)
        .sort(),
    ).toEqual(['old_plate', 'old_plate_2']);
    const excluded = (
      await get(tech, '/plates/check', {
        plate: '777',
        exclude_external_id: editing,
      }).expect(200)
    ).body;
    expect(excluded.matches).toHaveLength(1);
    await get(tech, '/plates/check', { plate: '---' }).expect(400);
    await get(tech, '/plates/report', { from: 10, to: 2 }).expect(400);
    await get(tech, '/plates/report', {}, otherProject).expect(403);
  });

  it('creates own expenses idempotently with receipt photos and never grants finance to field profiles', async () => {
    const body = {
      client_expense_id: 'exp-0001-device-a',
      description: 'SINTETICO Combustivel',
      reason: 'Deslocamento',
      expense_date: '2026-11-08',
      amount: '120.50',
    };
    await post(tech, '/expenses', body).expect(403);
    const created = await post(payer, '/expenses', body).expect(201);
    expect(created.body.expense).toMatchObject({
      field_agent_id: payer.agentId,
      amount: '120.50',
      status: 'pending',
    });
    await post(payer, '/expenses', body)
      .expect(200)
      .expect((r) =>
        expect(r.body).toMatchObject({
          result: 'existing',
          expense: { id: created.body.expense.id },
        }),
      );
    await post(payer, '/expenses', { ...body, amount: '99.00' })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('IDEMPOTENCY_KEY_REUSED'));
    const parallel = await Promise.all(
      [1, 2, 3].map(() =>
        post(payer, '/expenses', {
          ...body,
          client_expense_id: 'exp-0002-device-a',
        }),
      ),
    );
    expect(parallel.map((r) => r.status).filter((s) => s === 201)).toHaveLength(
      1,
    );
    expect(parallel.every((r) => [200, 201, 409].includes(r.status))).toBe(
      true,
    );
    await post(payer, '/expenses', {
      ...body,
      client_expense_id: 'exp-0003-device-a',
      expense_date: '08/11/2026',
    }).expect(400);
    await post(payer, '/expenses', {
      ...body,
      client_expense_id: 'exp-0004-device-a',
      amount: '12,50',
    }).expect(400);
    await post(payer, '/expenses', {
      ...body,
      client_expense_id: 'exp-0005-device-a',
      field_agent_id: tech.agentId,
    }).expect(400);

    const expenseId = created.body.expense.id as number;
    const upload = await post(
      payer,
      `/expenses/${expenseId}/attachments/upload-url`,
      {
        original_name: 'nota.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 201000,
      },
    ).expect(201);
    expect(upload.body.upload_headers['Content-Type']).toBe('image/jpeg');
    storage.put(upload.body.upload_url);
    const attachmentId = upload.body.attachment.id as number;
    await post(
      payer,
      `/expenses/${expenseId}/attachments/${attachmentId}/confirm-upload`,
      {},
    )
      .expect(200)
      .expect((r) => expect(r.body.result).toBe('confirmed'));
    await post(
      payer,
      `/expenses/${expenseId}/attachments/${attachmentId}/confirm-upload`,
      {},
    )
      .expect(200)
      .expect((r) => expect(r.body.result).toBe('already_confirmed'));
    const listed = await get(payer, '/expenses').expect(200);
    expect(
      listed.body.items.every(
        (e: { field_agent_id: number }) => e.field_agent_id === payer.agentId,
      ),
    ).toBe(true);
    const otherPayer = await technician(FINANCIAL);
    await post(otherPayer, `/expenses/${expenseId}/attachments/upload-url`, {
      original_name: 'x.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 10,
    }).expect(404);
  });

  it('reconciles with linked photos, partial failures, idempotent replays and own-session isolation', async () => {
    const session = (
      await post(tech, '/import-sessions', {
        unidade: 'SEDE',
        expected_payloads: 2,
      }).expect(201)
    ).body;
    expect(session).toMatchObject({
      status: 'open',
      unidade: 'SEDE',
      pending_payloads: 2,
    });
    const ttlDays =
      (new Date(session.expires_at).getTime() - Date.now()) / 86400000;
    expect(ttlDays).toBeGreaterThan(6.9);
    const uuid = session.session_uuid as string;

    const file = async (
      type: 'image' | 'raw_backup',
      mime: string,
      size: number,
      confirm = true,
    ) => {
      const r = await post(tech, `/import-sessions/${uuid}/files/upload-url`, {
        type,
        original_name: type === 'image' ? 'foto.jpg' : 'backup.zip',
        mime_type: mime,
        size_bytes: size,
      }).expect(201);
      if (confirm) {
        storage.put(r.body.upload_url);
        await post(
          tech,
          `/import-sessions/${uuid}/files/${r.body.file_id}/confirm-upload`,
          {},
        ).expect(200);
      }
      return r.body as { file_id: number; expires_in_seconds: number };
    };
    const photo = await file('image', 'image/jpeg', 150000);
    const unconfirmed = await file('image', 'image/jpeg', 150000, false);
    await post(tech, `/import-sessions/${uuid}/files/upload-url`, {
      type: 'image',
      original_name: 'x.pdf',
      mime_type: 'application/pdf',
      size_bytes: 100,
    }).expect(400);
    await post(tech, `/import-sessions/${uuid}/files/upload-url`, {
      type: 'raw_backup',
      original_name: 'big.zip',
      mime_type: 'application/zip',
      size_bytes: 101 * 1024 * 1024,
    }).expect(400);
    const backup = await file('raw_backup', 'application/zip', 5 * 1024 * 1024);
    expect(backup.expires_in_seconds).toBe(1800);

    const deleted = ext();
    await put(tech, deleted, { description: 'APAGADO' }).expect(201);
    await api()
      .delete(m(`/items/${deleted}`))
      .set(bearer(tech.token))
      .expect(200);
    const withPhoto = ext();
    const plain = ext();
    const badPhoto = ext();
    const payload1 = {
      payload_number: 1,
      idempotency_key: `${uuid}-1`,
      items: [
        {
          operation: 'upsert',
          external_item_id: withPhoto,
          new_plate: '900',
          old_plate_2: '88',
          extra_fields: { Setor: 'TI' },
          images: [{ file_id: photo.file_id }],
        },
        {
          operation: 'upsert',
          external_item_id: plain,
          description: 'SEM FOTO',
        },
        {
          operation: 'upsert',
          external_item_id: deleted,
          description: 'RESSUSCITAR',
        },
        {
          operation: 'upsert',
          external_item_id: badPhoto,
          images: [{ file_id: unconfirmed.file_id }],
        },
      ],
    };
    const first = (
      await post(tech, `/import-sessions/${uuid}/payloads`, payload1).expect(
        201,
      )
    ).body;
    expect(first).toMatchObject({
      status: 'partially_processed',
      created_count: 2,
      failed_count: 2,
    });
    // Replay after timeout: same answer, nothing applied twice.
    await post(tech, `/import-sessions/${uuid}/payloads`, payload1)
      .expect(201)
      .expect((r) =>
        expect(r.body).toMatchObject({ created_count: 2, failed_count: 2 }),
      );
    await post(tech, `/import-sessions/${uuid}/payloads`, {
      ...payload1,
      items: payload1.items.slice(0, 1),
    })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('PAYLOAD_IDEMPOTENCY_CONFLICT'));
    // No partial writes for failed items; the deleted item stays deleted.
    await get(tech, `/items/${badPhoto}`).expect(404);
    await get(tech, `/items/${deleted}`)
      .expect(200)
      .expect((r) =>
        expect(r.body).toMatchObject({ deleted: true, description: 'APAGADO' }),
      );
    const linked = (await get(tech, `/items/${withPhoto}/images`).expect(200))
      .body;
    expect(linked.items).toHaveLength(1);
    expect(linked.items[0].status).toBe('uploaded');
    const item = (await get(tech, `/items/${withPhoto}`).expect(200)).body;
    expect(item).toMatchObject({
      old_plate_2: '88',
      extra_fields: { Setor: 'TI' },
      source: 'mobile_app',
    });
    expect(
      (
        await db
          .getRepository(ImportFileEntity)
          .findOneByOrFail({ id: photo.file_id })
      ).status,
    ).toBe('processed');
    // A file of another session can never be referenced.
    const other = (await post(tech, '/import-sessions', {}).expect(201)).body
      .session_uuid as string;
    await post(tech, `/import-sessions/${other}/payloads`, {
      payload_number: 1,
      idempotency_key: `${other}-1`,
      items: [
        {
          operation: 'upsert',
          external_item_id: ext(),
          images: [{ file_id: photo.file_id }],
        },
      ],
    }).expect(400);

    // Chunked processing (2 items per transaction) applies everything.
    process.env.IMPORT_ITEMS_PER_TRANSACTION = '2';
    try {
      const items = Array.from({ length: 5 }, () => ({
        operation: 'upsert',
        external_item_id: ext(),
        description: 'LOTE',
      }));
      await post(tech, `/import-sessions/${uuid}/payloads`, {
        payload_number: 2,
        idempotency_key: `${uuid}-2`,
        items,
      })
        .expect(201)
        .expect((r) =>
          expect(r.body).toMatchObject({
            status: 'processed',
            created_count: 5,
          }),
        );
    } finally {
      delete process.env.IMPORT_ITEMS_PER_TRANSACTION;
    }

    const errors = (
      await get(tech, `/import-sessions/${uuid}/errors`).expect(200)
    ).body;
    expect(errors.items).toHaveLength(2);
    expect(
      errors.items.map((e: { payload_number: number }) => e.payload_number),
    ).toEqual([1, 1]);
    expect(
      errors.items.map((e: { item_id: string }) => e.item_id).sort(),
    ).toEqual([badPhoto, deleted].sort());

    await get(colleague, `/import-sessions/${uuid}`).expect(404);
    await api()
      .get(`/api/v1/projects/${projectId}/import-sessions/by-uuid/${uuid}`)
      .set(bearer(admin))
      .expect(200);

    const done = (
      await post(tech, `/import-sessions/${uuid}/finish`).expect(200)
    ).body;
    expect(done).toMatchObject({
      status: 'finished_with_errors',
      success_items: 7,
      failed_items: 2,
      payloads_with_errors: 1,
      backup_uploaded: true,
      pending_payloads: 0,
    });
    await post(tech, `/import-sessions/${uuid}/finish`).expect(409);
    await post(tech, `/import-sessions/${uuid}/payloads`, {
      payload_number: 3,
      idempotency_key: `${uuid}-3`,
      items: [],
    }).expect(409);

    // Imported items are delivered by the Onda 2 incremental sync.
    const synced = (await get(tech, '/items/sync', { limit: 500 }).expect(200))
      .body;
    expect(
      synced.items.find(
        (i: { external_item_id: string }) => i.external_item_id === withPhoto,
      ).images,
    ).toHaveLength(1);
  });

  it('marks an all-failed payload and session as failed and processes concurrent payloads consistently', async () => {
    const uuid = (await post(tech, '/import-sessions', {}).expect(201)).body
      .session_uuid as string;
    const failing = ext();
    await put(tech, failing, { description: 'X' }).expect(201);
    await api()
      .delete(m(`/items/${failing}`))
      .set(bearer(tech.token))
      .expect(200);
    await post(tech, `/import-sessions/${uuid}/payloads`, {
      payload_number: 1,
      idempotency_key: `${uuid}-1`,
      items: [
        { operation: 'upsert', external_item_id: failing, description: 'Y' },
      ],
    })
      .expect(201)
      .expect((r) =>
        expect(r.body).toMatchObject({ status: 'failed', failed_count: 1 }),
      );
    const concurrent = await Promise.all(
      [2, 3, 4].map((n) =>
        post(tech, `/import-sessions/${uuid}/payloads`, {
          payload_number: n,
          idempotency_key: `${uuid}-${n}`,
          items: [
            {
              operation: 'upsert',
              external_item_id: ext(),
              description: `P${n}`,
            },
            {
              operation: 'upsert',
              external_item_id: ext(),
              description: `P${n}`,
            },
          ],
        }),
      ),
    );
    expect(concurrent.map((r) => r.status)).toEqual([201, 201, 201]);
    const status = (await get(tech, `/import-sessions/${uuid}`).expect(200))
      .body;
    expect(status).toMatchObject({
      received_payloads: 4,
      total_items: 7,
      success_items: 6,
      failed_items: 1,
    });
    expect(
      await db
        .getRepository(InventoryItemEntity)
        .countBy({ projectId, description: In(['P2', 'P3', 'P4']) }),
    ).toBe(6);

    const allFailed = (await post(tech, '/import-sessions', {}).expect(201))
      .body.session_uuid as string;
    await post(tech, `/import-sessions/${allFailed}/payloads`, {
      payload_number: 1,
      idempotency_key: `${allFailed}-1`,
      items: [{ operation: 'upsert', external_item_id: failing }],
    }).expect(201);
    await post(tech, `/import-sessions/${allFailed}/finish`)
      .expect(200)
      .expect((r) => expect(r.body.status).toBe('failed'));
  });
});
