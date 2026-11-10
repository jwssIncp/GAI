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
import { InventoryItemAuditLogEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryItemImageEntity } from '../../../src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';

interface Item {
  id: number;
  external_item_id: string | null;
  version: number;
  deleted: boolean;
  description: string | null;
  new_plate: string | null;
  extra_fields: Record<string, string>;
  images?: Array<{ id: number; status: string }>;
}

describe('Onda 2: mobile item sync, idempotency, conflicts and photos', () => {
  let app: INestApplication, db: DataSource, admin: string;
  let projectA: number, projectB: number;
  let tech1: { token: string; userId: number; agentId: number };
  let tech2: { token: string; userId: number; agentId: number };
  let serial = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const adminPost = (path: string, body?: object) =>
    api()
      .post('/api/v1' + path)
      .set(bearer(admin))
      .send(body ?? {});
  const ext = () => `1730736${String(++serial).padStart(9, '0')}`;
  const base = (projectId = projectA) =>
    `/api/v1/mobile/projects/${projectId}/items`;
  const put = (
    token: string,
    externalId: string,
    body: object,
    projectId = projectA,
  ) =>
    api()
      .put(`${base(projectId)}/${externalId}`)
      .set(bearer(token))
      .send(body);
  const del = (token: string, externalId: string, query = '') =>
    api().delete(`${base()}/${externalId}${query}`).set(bearer(token));
  const sync = (
    token: string,
    cursor?: string,
    limit = 200,
    projectId = projectA,
  ) =>
    api()
      .get(`${base(projectId)}/sync`)
      .query({ ...(cursor ? { cursor } : {}), limit })
      .set(bearer(token));
  const rows = (externalId: string) =>
    db.getRepository(InventoryItemEntity).find({
      where: { projectId: projectA, externalItemId: externalId },
      withDeleted: true,
    });

  const technician = async (projects: number[]) => {
    const source = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'test.user' });
    const copy = db.getRepository(UserEntity).create({
      ...source,
      login: `sync.${++serial}`,
      email: `sync.${serial}@example.invalid`,
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    delete (copy as Partial<UserEntity>).id;
    const user = await db.getRepository(UserEntity).save(copy);
    const role = await db.getRepository(RoleEntity).save({
      key: `SINTETICO_SYNC_${serial}`,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      name: `SINTETICO Coleta ${serial}`,
      description: null,
      isActive: true,
    });
    for (const p of await db
      .getRepository(PermissionEntity)
      .findBy({ key: In([...FIELD_ACCESS_PERMISSIONS]) }))
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
        name: `SINTETICO Tecnico ${serial}`,
        user_id: user.id,
      }).expect(201)
    ).body as { id: number };
    for (const projectId of projects)
      await adminPost(`/projects/${projectId}/field-agents`, {
        field_agent_id: agent.id,
      }).expect(201);
    const login = await api()
      .post('/api/v1/mobile/auth/login')
      .send({ identifier: user.login, password: fixturePasswords.user })
      .expect(200);
    return {
      token: login.body.access_token as string,
      userId: user.id,
      agentId: agent.id,
    };
  };
  const collect = async (token: string, limit: number, cursor?: string) => {
    const items: Item[] = [];
    let next = cursor;
    for (let guard = 0; guard < 50; guard++) {
      const page = (await sync(token, next, limit).expect(200)).body as {
        items: Item[];
        next_cursor: string;
        has_more: boolean;
      };
      items.push(...page.items);
      next = page.next_cursor;
      if (!page.has_more) break;
    }
    return { items, cursor: next! };
  };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
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
    projectA = await project('SINTETICO Sync A');
    projectB = await project('SINTETICO Sync B');
    tech1 = await technician([projectA]);
    tech2 = await technician([projectA]);
  }, 300000);
  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates with a 16-digit string id, re-sends idempotently and updates with version control', async () => {
    const id = '0001730736000123';
    const body = {
      new_plate: '251-A',
      old_plate: '12345',
      old_plate_2: 'x-9',
      unit_text: 'SEDE',
      description: 'CADEIRA GIRATÓRIA',
      year: 2019,
      used_value: '150',
      extra_fields: { Patrimônio: '123', Setor: 'TI' },
    };
    const created = await put(tech1.token, id, body).expect(201);
    expect(created.body.result).toBe('created');
    const item = created.body.item as Item & Record<string, unknown>;
    expect(item).toMatchObject({
      external_item_id: id,
      new_plate: '251A',
      old_plate_2: 'X9',
      used_value: '150.00',
      extra_fields: { Patrimônio: '123', Setor: 'TI' },
      created_by_id: tech1.userId,
      deleted: false,
    });
    expect(item.version).toBeGreaterThan(0);
    // Timeout/retry: identical body without version is a no-op.
    await put(tech1.token, id, body)
      .expect(200)
      .expect((r) =>
        expect(r.body).toMatchObject({
          result: 'unchanged',
          item: { version: item.version },
        }),
      );
    expect(await rows(id)).toHaveLength(1);
    // A change needs the known version.
    await put(tech1.token, id, { description: 'CADEIRA PRETA' })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('VERSION_CONFLICT'));
    const updated = await put(tech1.token, id, {
      description: 'CADEIRA PRETA',
      base_version: item.version,
    }).expect(200);
    expect(updated.body.result).toBe('updated');
    expect(updated.body.item.version).toBeGreaterThan(item.version);
    const audits = await db
      .getRepository(InventoryItemAuditLogEntity)
      .find({ where: { inventoryItemId: item.id }, order: { id: 'ASC' } });
    expect(audits.map((a) => a.operation)).toEqual(['create', 'update']);
    expect(audits[1].performedBy).toBe(tech1.userId);
    expect(audits[1].changes).toMatchObject({
      description: { before: 'CADEIRA GIRATÓRIA', after: 'CADEIRA PRETA' },
      _context: { after: { channel: 'mobile', field_agent_id: tech1.agentId } },
    });
  });

  it('never silently overwrites another technician and validates identifiers', async () => {
    const id = ext();
    const first = (
      await put(tech1.token, id, { description: 'MESA' }).expect(201)
    ).body.item as Item;
    await put(tech1.token, id, {
      description: 'MESA REDONDA',
      base_version: first.version,
    }).expect(200);
    const stale = await put(tech2.token, id, {
      description: 'MESA QUADRADA',
      base_version: first.version,
    }).expect(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
    expect(stale.body.details.item.description).toBe('MESA REDONDA');
    // Same content as the server: converges without conflict.
    await put(tech2.token, id, {
      description: 'MESA REDONDA',
      base_version: first.version,
    }).expect(200);

    await put(tech1.token, 'A'.repeat(100), { description: 'LONGO' }).expect(
      201,
    );
    await put(tech1.token, 'A'.repeat(101), { description: 'LONGO' }).expect(
      400,
    );
    await put(tech1.token, 'id%20com%20espaco', {}).expect(400);
    await put(tech1.token, ext(), { status: 'pending' }).expect(400);
    await put(tech1.token, ext(), { created_by_id: 1 }).expect(400);
    await put(tech1.token, ext(), { extra_fields: { campo: 12 } }).expect(400);
    await put(tech1.token, ext(), { used_value: '12,50' }).expect(400);
    await put(tech1.token, ext(), { description: 'X', base_version: 7 }).expect(
      404,
    );
  });

  it('serializes concurrent creates of the same external id into one row', async () => {
    const same = ext();
    const identical = await Promise.all(
      Array.from({ length: 5 }, () =>
        put(tech1.token, same, { description: 'PARALELO' }),
      ),
    );
    expect(identical.map((r) => r.status).sort()).toEqual([
      200, 200, 200, 200, 201,
    ]);
    expect(await rows(same)).toHaveLength(1);

    const contested = ext();
    const results = await Promise.all([
      put(tech1.token, contested, { description: 'VERSAO 1' }),
      put(tech2.token, contested, { description: 'VERSAO 2' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await rows(contested)).toHaveLength(1);
  });

  it('deletes idempotently and refuses stale resends and reactivation', async () => {
    const id = ext();
    const item = (
      await put(tech1.token, id, { description: 'APAGAR' }).expect(201)
    ).body.item as Item;
    await del(tech1.token, id, `?base_version=${item.version - 1}`).expect(409);
    const deleted = await del(tech1.token, id).expect(200);
    expect(deleted.body).toMatchObject({
      result: 'deleted',
      item: { deleted: true },
    });
    await del(tech1.token, id)
      .expect(200)
      .expect((r) => expect(r.body.result).toBe('already_deleted'));
    // Offline edit replayed after the deletion.
    await put(tech2.token, id, {
      description: 'EDITADO OFFLINE',
      base_version: item.version,
    })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('ITEM_DELETED'));
    await put(tech1.token, id, { description: 'APAGAR' }).expect(409);
    await api()
      .post(
        `/api/v1/projects/${projectA}/inventory-items/${item.id}/reactivate`,
      )
      .set(bearer(tech1.token))
      .expect(403);
    await del(tech1.token, ext()).expect(404);
    expect((await rows(id))[0].deletedAt).not.toBeNull();
  });

  it('pages by cursor, resumes after failures and never loses concurrent changes', async () => {
    const project = await adminPost('/projects', {
      name: `SINTETICO Sync C ${++serial}`,
      organization_id: 1,
      company_id: 1,
    }).expect(201);
    const pid = project.body.id as number;
    await adminPost(`/projects/${pid}/field-agents`, {
      field_agent_id: tech1.agentId,
    }).expect(201);
    const syncP = (cursor?: string, limit = 2) =>
      sync(tech1.token, cursor, limit, pid).expect(200);
    // Legacy item (no external id, version 0) and a web-created item.
    const legacy = await adminPost(`/projects/${pid}/inventory-items`, {
      description: 'LEGADO',
    }).expect(201);
    await db.query('UPDATE inventory_items SET sync_seq = 0 WHERE id = ?', [
      legacy.body.id,
    ]);
    const ids = [ext(), ext(), ext(), ext()];
    for (const id of ids)
      await put(tech1.token, id, { description: id }, pid).expect(201);

    const first = (await syncP()).body;
    expect(first.items.map((i: Item) => i.external_item_id)).toEqual([
      null,
      ids[0],
    ]);
    expect(first.has_more).toBe(true);
    // A change to an already-downloaded item and to a pending one while paging.
    const seen = first.items[1] as Item;
    await put(
      tech1.token,
      ids[0],
      { description: 'MUDOU', base_version: seen.version },
      pid,
    ).expect(200);
    const pending = (
      await api()
        .get(`${base(pid)}/${ids[2]}`)
        .set(bearer(tech1.token))
        .expect(200)
    ).body as Item;
    await del(tech1.token, ids[2]).expect(404); // other project: not found here
    await api()
      .delete(`${base(pid)}/${ids[2]}?base_version=${pending.version}`)
      .set(bearer(tech1.token))
      .expect(200);
    // Resume with the cursor (as after a crash): every change arrives once.
    const rest: Item[] = [];
    let cursor = first.next_cursor as string;
    for (;;) {
      const page = (await syncP(cursor)).body;
      rest.push(...page.items);
      cursor = page.next_cursor;
      if (!page.has_more) break;
    }
    expect(rest.map((i) => i.external_item_id)).toEqual([
      ids[1],
      ids[3],
      ids[0],
      ids[2],
    ]);
    expect(rest.find((i) => i.external_item_id === ids[0])!.description).toBe(
      'MUDOU',
    );
    expect(rest.find((i) => i.external_item_id === ids[2])!.deleted).toBe(true);
    // Up to date: same cursor, nothing new.
    const idle = (await syncP(cursor)).body;
    expect(idle).toMatchObject({
      items: [],
      has_more: false,
      next_cursor: cursor,
    });
    // Web edits are synchronized too.
    await api()
      .patch(`/api/v1/projects/${pid}/inventory-items/${legacy.body.id}`)
      .set(bearer(admin))
      .send({ description: 'LEGADO EDITADO NA WEB' })
      .expect(200);
    const web = (await syncP(cursor)).body;
    expect(web.items.map((i: Item) => i.description)).toEqual([
      'LEGADO EDITADO NA WEB',
    ]);
    // Cursors are bound to their project and validated.
    await sync(tech1.token, cursor, 10, projectA).expect(400);
    await sync(tech1.token, 'lixo', 10, pid).expect(400);
    await sync(tech1.token, undefined, 501, pid).expect(400);
  });

  it('links multiple photos with idempotent confirmation and authorized URLs', async () => {
    const id = ext();
    const item = (
      await put(tech1.token, id, { description: 'COM FOTOS' }).expect(201)
    ).body.item as Item;
    const storage = app.get<FakeStorage>(STORAGE_SIGNER);
    const upload = async () => {
      const r = await api()
        .post(`${base()}/${id}/images/upload-url`)
        .set(bearer(tech1.token))
        .send({
          original_name: 'foto.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 183244,
        })
        .expect(201);
      expect(r.body.upload_headers).toEqual({
        'Content-Type': 'image/jpeg',
        'Content-Length': '183244',
      });
      return r.body as { image: { id: number }; upload_url: string };
    };
    const confirm = (imageId: number) =>
      api()
        .post(`${base()}/${id}/images/${imageId}/confirm-upload`)
        .set(bearer(tech1.token))
        .send({});
    const a = await upload();
    const b = await upload();
    storage.put(a.upload_url);
    storage.put(b.upload_url);
    const confirmed = await confirm(a.image.id).expect(200);
    expect(confirmed.body.result).toBe('confirmed');
    expect(confirmed.body.item_version).toBeGreaterThan(item.version);
    await confirm(a.image.id)
      .expect(200)
      .expect((r) => expect(r.body.result).toBe('already_confirmed'));
    await confirm(b.image.id).expect(200);
    const listed = await api()
      .get(`${base()}/${id}/images`)
      .set(bearer(tech1.token))
      .expect(200);
    expect(listed.body.items).toHaveLength(2);
    for (const image of listed.body.items)
      expect(image.download_url).toContain('X-Amz-Signature');
    const synced = (await collect(tech1.token, 500)).items.find(
      (i) => i.external_item_id === id,
    )!;
    expect(synced.images!.map((i) => i.status)).toEqual([
      'uploaded',
      'uploaded',
    ]);

    // Image of another item cannot be addressed through this item.
    const other = ext();
    await put(tech1.token, other, { description: 'OUTRO' }).expect(201);
    await api()
      .post(`${base()}/${other}/images/${a.image.id}/confirm-upload`)
      .set(bearer(tech1.token))
      .send({})
      .expect((r) => expect([403, 404]).toContain(r.status));

    await api()
      .delete(`${base()}/${id}/images/${b.image.id}`)
      .set(bearer(tech1.token))
      .expect(200);
    await api()
      .delete(`${base()}/${id}/images/${b.image.id}`)
      .set(bearer(tech1.token))
      .expect(200)
      .expect((r) => expect(r.body.result).toBe('already_removed'));

    // Abandoned uploads (past the confirmation window) do not consume the quota.
    const third = await upload();
    await upload()
      .then(() => undefined)
      .catch(() => undefined);
    await db.getRepository(InventoryItemImageEntity).update(
      { inventoryItemId: item.id, status: 'pending_upload' as never },
      {
        createdAt: new Date(Date.now() - 3600000),
      },
    );
    await upload();
    expect(third.image.id).toEqual(expect.any(Number));
  });

  it('blocks deactivated agents, unlinked projects and other organizations', async () => {
    const blocked = await technician([projectA]);
    await put(blocked.token, ext(), { description: 'OK' }).expect(201);
    await adminPost(`/field-agents/${blocked.agentId}/block`).expect(200);
    await put(blocked.token, ext(), { description: 'BLOQUEADO' }).expect(403);
    await sync(blocked.token).expect(403);

    await put(
      tech1.token,
      ext(),
      { description: 'SEM VINCULO' },
      projectB,
    ).expect(403);
    await sync(tech1.token, undefined, 10, projectB).expect(403);

    const org = await db.getRepository(OrganizationEntity).save({
      legalName: 'SINTETICO Org Sync',
      cnpj: '99888777000166',
      status: OrganizationStatus.ACTIVE,
    });
    const foreign = await db.getRepository(ProjectEntity).save(
      db.getRepository(ProjectEntity).create({
        ...(await db
          .getRepository(ProjectEntity)
          .findOneByOrFail({ id: projectA })),
        id: undefined,
        organizationId: org.id,
        companyId: null,
        name: 'SINTETICO Alheio',
      }),
    );
    await put(tech1.token, ext(), { description: 'ALHEIO' }, foreign.id).expect(
      403,
    );
    await sync(tech1.token, undefined, 10, foreign.id).expect(403);
  });

  it('keeps web APIs working and maps duplicate external ids to 409', async () => {
    const id = ext();
    await put(tech1.token, id, { description: 'MOBILE' }).expect(201);
    await adminPost(`/projects/${projectA}/inventory-items`, {
      external_item_id: id,
      description: 'WEB DUPLICADO',
    })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('EXTERNAL_ITEM_ID_CONFLICT'));
    await adminPost(`/projects/${projectA}/inventory-items`, {
      description: 'WEB SEM ID',
    }).expect(201);
    await adminPost(`/projects/${projectA}/inventory-items`, {
      description: 'WEB SEM ID 2',
    }).expect(201);
    await api()
      .get(`/api/v1/projects/${projectA}/inventory-items`)
      .set(bearer(admin))
      .expect(200);
  });
});
