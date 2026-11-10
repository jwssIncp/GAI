import { randomBytes } from 'crypto';
import { INestApplication } from '@nestjs/common';
import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  PutBucketVersioningCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { ConfiguredStorageSignerService } from '../../../src/common/storage/configured-storage-signer.service';
import { syntheticStorageEnv } from '../../storage-test.config';
import { fixturePasswords } from '../../fixtures/passwords';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { RoleType } from '../../../src/modules/users/domain/enums/role-type.enum';
import { FIELD_ACCESS_PERMISSIONS } from '../../../src/modules/field-agents/domain/field-access-permissions';

// Real S3 protocol (isolated MinIO on loopback, synthetic credentials) for the
// mobile flows: item photos, imported photos, expense receipts and ~100 MiB backups.
const isolated =
  process.env.GAI_TEST_S3_DISPOSABLE === '1' ? describe : describe.skip;
isolated('Onda 4: mobile flows against real S3 (isolated)', () => {
  let app: INestApplication,
    db: DataSource,
    signer: ConfiguredStorageSignerService,
    client: S3Client;
  let admin: string, token: string, projectId: number;
  const bucket = 'gai-isolated-tests';
  const jpeg = Buffer.concat([
    Buffer.from('ffd8ffe000104a464946', 'hex'),
    randomBytes(2048),
  ]);
  const api = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const m = (path: string) => `/api/v1/mobile/projects/${projectId}${path}`;
  const put = (url: string, body: Buffer, headers: Record<string, string>) =>
    fetch(url, { method: 'PUT', headers, body: new Uint8Array(body) });

  beforeAll(async () => {
    jest.replaceProperty(process, 'env', {
      ...syntheticStorageEnv(),
      STORAGE_MAX_SIZE_BYTES: '104857600',
      STORAGE_PRESIGNED_URL_MAX_TTL_SECONDS: '1800',
      STORAGE_ALLOWED_MIME_TYPES:
        'image/jpeg,image/png,application/zip,application/json',
    });
    client = new S3Client({
      region: 'us-east-1',
      endpoint: 'http://127.0.0.1:33318',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'gai-validation',
        secretAccessKey: 'gai-validation-only',
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    await client
      .send(new CreateBucketCommand({ Bucket: bucket }))
      .catch((error: unknown) => {
        if (!(error instanceof BucketAlreadyOwnedByYou)) throw error;
      });
    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: 'Enabled' },
      }),
    );
    signer = new ConfiguredStorageSignerService();
    app = await createTestApp(signer);
    db = app.get(DataSource);
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    projectId = (
      await api()
        .post('/api/v1/projects')
        .set(bearer(admin))
        .send({
          name: 'SINTETICO S3 mobile',
          organization_id: 1,
          company_id: 1,
        })
        .expect(201)
    ).body.id;
    const source = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'test.user' });
    const copy = db.getRepository(UserEntity).create({
      ...source,
      login: 's3.mobile',
      email: 's3.mobile@example.invalid',
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    delete (copy as Partial<UserEntity>).id;
    const user = await db.getRepository(UserEntity).save(copy);
    const role = await db.getRepository(RoleEntity).save({
      key: 'SINTETICO_S3_MOBILE',
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      name: 'SINTETICO S3',
      description: null,
      isActive: true,
    });
    for (const p of await db.getRepository(PermissionEntity).findBy({
      key: In([
        ...FIELD_ACCESS_PERMISSIONS,
        'expenses:create',
        'expenses:read',
        'expenses:upload-attachment',
      ]),
    }))
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
      await api()
        .post('/api/v1/field-agents')
        .set(bearer(admin))
        .send({ name: 'SINTETICO S3', user_id: user.id })
        .expect(201)
    ).body.id;
    await api()
      .post(`/api/v1/projects/${projectId}/field-agents`)
      .set(bearer(admin))
      .send({ field_agent_id: agent })
      .expect(201);
    token = (
      await api()
        .post('/api/v1/mobile/auth/login')
        .send({ identifier: 's3.mobile', password: fixturePasswords.user })
        .expect(200)
    ).body.access_token;
  }, 300000);
  afterAll(async () => {
    await app?.close();
    signer?.onModuleDestroy();
    client?.destroy();
    jest.restoreAllMocks();
  });

  it('uploads, verifies and serves an item photo; rejects bytes that do not match the type', async () => {
    await api()
      .put(m('/items/1730736000999001'))
      .set(bearer(token))
      .send({ description: 'FOTO S3' })
      .expect(201);
    const upload = async (body: Buffer) => {
      const r = await api()
        .post(m('/items/1730736000999001/images/upload-url'))
        .set(bearer(token))
        .send({
          original_name: 'foto.jpg',
          mime_type: 'image/jpeg',
          size_bytes: body.length,
        })
        .expect(201);
      expect(
        (await put(r.body.upload_url, body, r.body.upload_headers)).status,
      ).toBe(200);
      return r.body.image.id as number;
    };
    const ok = await upload(jpeg);
    await api()
      .post(m(`/items/1730736000999001/images/${ok}/confirm-upload`))
      .set(bearer(token))
      .send({})
      .expect(200);
    const listed = await api()
      .get(m('/items/1730736000999001/images'))
      .set(bearer(token))
      .expect(200);
    const served = await fetch(listed.body.items[0].download_url);
    expect(Buffer.from(await served.arrayBuffer())).toEqual(jpeg);

    const fake = await upload(
      Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), randomBytes(64)]),
    );
    await api()
      .post(m(`/items/1730736000999001/images/${fake}/confirm-upload`))
      .set(bearer(token))
      .send({})
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('STORAGE_CONTENT_MISMATCH'));
  });

  it('links an imported photo, stores an expense receipt and verifies a ~100 MiB backup', async () => {
    const session = (
      await api()
        .post(m('/import-sessions'))
        .set(bearer(token))
        .send({})
        .expect(201)
    ).body;
    const uuid = session.session_uuid as string;
    const file = async (type: string, mime: string, body: Buffer) => {
      const r = await api()
        .post(m(`/import-sessions/${uuid}/files/upload-url`))
        .set(bearer(token))
        .send({
          type,
          original_name: type === 'image' ? 'f.jpg' : 'b.zip',
          mime_type: mime,
          size_bytes: body.length,
        })
        .expect(201);
      expect(
        (await put(r.body.upload_url, body, r.body.upload_headers)).status,
      ).toBe(200);
      const started = Date.now();
      await api()
        .post(
          m(`/import-sessions/${uuid}/files/${r.body.file_id}/confirm-upload`),
        )
        .set(bearer(token))
        .send({})
        .expect(200);
      return {
        id: r.body.file_id as number,
        ttl: r.body.expires_in_seconds as number,
        ms: Date.now() - started,
      };
    };
    const photo = await file('image', 'image/jpeg', jpeg);
    await api()
      .post(m(`/import-sessions/${uuid}/payloads`))
      .set(bearer(token))
      .send({
        payload_number: 1,
        idempotency_key: `${uuid}-1`,
        items: [
          {
            operation: 'upsert',
            external_item_id: '1730736000999002',
            images: [{ file_id: photo.id }],
          },
        ],
      })
      .expect(201)
      .expect((r) => expect(r.body.status).toBe('processed'));
    const linked = await api()
      .get(m('/items/1730736000999002/images'))
      .set(bearer(token))
      .expect(200);
    expect(
      Buffer.from(
        await (await fetch(linked.body.items[0].download_url)).arrayBuffer(),
      ),
    ).toEqual(jpeg);

    const zip = Buffer.concat([
      Buffer.from('504b0304', 'hex'),
      randomBytes(100 * 1024 * 1024 - 1024),
    ]);
    const backup = await file('raw_backup', 'application/zip', zip);
    expect(backup.ttl).toBe(1800);
    console.log(`backup ${zip.length} bytes confirmed in ${backup.ms} ms`);
    await api()
      .get(m(`/import-sessions/${uuid}`))
      .set(bearer(token))
      .expect(200)
      .expect((r) => expect(r.body.backup_uploaded).toBe(true));

    const expense = await api()
      .post(m('/expenses'))
      .set(bearer(token))
      .send({
        client_expense_id: 's3-expense-0001',
        description: 'SINTETICO',
        expense_date: '2026-11-08',
        amount: '10.00',
      })
      .expect(201);
    const attachment = await api()
      .post(m(`/expenses/${expense.body.expense.id}/attachments/upload-url`))
      .set(bearer(token))
      .send({
        original_name: 'nota.jpg',
        mime_type: 'image/jpeg',
        size_bytes: jpeg.length,
      })
      .expect(201);
    expect(
      (
        await put(
          attachment.body.upload_url,
          jpeg,
          attachment.body.upload_headers,
        )
      ).status,
    ).toBe(200);
    await api()
      .post(
        m(
          `/expenses/${expense.body.expense.id}/attachments/${attachment.body.attachment.id}/confirm-upload`,
        ),
      )
      .set(bearer(token))
      .send({})
      .expect(200)
      .expect((r) => expect(r.body.result).toBe('confirmed'));
  }, 600000);
});
