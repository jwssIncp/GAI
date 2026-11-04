import { STORAGE_SIGNER } from '../../../src/common/storage/storage-signer.port';
import { FakeStorage, TEST_OBJECT_CHECKSUM } from '../storage.fake';
import { EXPORT_CONTENT_PERMISSIONS } from '../../../src/modules/export-jobs/domain/export-content-permissions';
import { ExportJobType } from '../../../src/modules/export-jobs/domain/enums/export-job-type.enum';
import { ExpenseInstallmentEntity } from '../../../src/modules/expense-accountabilities/expense-accountability.entity';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportJobEntity } from '../../../src/modules/export-jobs/infrastructure/persistence/export-job.entity';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import {
  createTestApp,
  seedTestData,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
} from '../test-app.helper';

// Regression assertions for the corrected policies, using synthetic fixtures.
// Storage is mocked here; the opt-in isolated S3 suite exercises real bytes.
describe('Technical validation: negative authorization, contracts and storage', () => {
  let app: INestApplication;
  let admin: string;
  let platform: string;
  let user: string;
  let base: string;
  let otherBase: string;
  let expenseId: number;
  let itemId: number;
  let evidenceBase: string;
  let roleId: number;
  const auth = (token = admin) => ({ Authorization: `Bearer ${token}` });
  const post = (url: string, body: object = {}, token = admin, status = 201) =>
    request(app.getHttpServer())
      .post(url)
      .set(auth(token))
      .send(body)
      .expect(status);

  async function grant(keys: string[]) {
    const repo = app.get<Repository<RolePermissionEntity>>(
      getRepositoryToken(RolePermissionEntity),
    );
    const permissions = await app
      .get<Repository<PermissionEntity>>(getRepositoryToken(PermissionEntity))
      .find();
    expect(keys.every((key) => permissions.some((p) => p.key === key))).toBe(
      true,
    );
    await repo.delete({ roleId });
    await repo.save(
      permissions
        .filter((p) => keys.includes(p.key))
        .map((p) => ({ roleId, permissionId: p.id })),
    );
  }

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    platform = await loginAsAdmin(app);
    user = await loginAsOrgUser(app);
    roleId = (
      await app
        .get<Repository<RoleEntity>>(getRepositoryToken(RoleEntity))
        .findOneByOrFail({ name: 'Operador' })
    ).id;
    const project = await post('/api/v1/projects', {
      organization_id: 1,
      company_id: 1,
      name: 'Synthetic validation A',
    });
    base = `/api/v1/projects/${project.body.id}`;
    const expense = await post(`${base}/expenses`, {
      description: 'Synthetic taxi',
      expense_date: '2026-01-31',
      amount: '100.00',
    });
    expenseId = expense.body.id;
    itemId = (
      await post(`${base}/inventory-items`, {
        description: 'Synthetic asset',
        old_plate: 'AUD-001',
      })
    ).body.id;
    const agent = await post('/api/v1/field-agents', {
      name: 'Synthetic agent',
    });
    await post(`${base}/field-agents`, { field_agent_id: agent.body.id });
    const session = await post(`${base}/inventory-sessions`, {
      name: 'Synthetic session',
    });
    const started = await post(
      `${base}/inventory-sessions/${session.body.id}/start`,
      {},
      admin,
      200,
    );
    const observation = await post(
      `${base}/inventory-sessions/${session.body.id}/rounds/${started.body.round.id}/observations`,
      {
        inventory_item_id: itemId,
        field_agent_id: agent.body.id,
        result: 'found',
        observed_plate: 'AUD-001',
        idempotency_key: 'synthetic-validation-observation',
      },
    );
    evidenceBase = `${base}/inventory-sessions/${session.body.id}/rounds/${started.body.round.id}/observations/${observation.body.id}/evidence`;
    const org = await post(
      '/api/v1/organizations',
      { legal_name: 'Synthetic B', cnpj: '11444777000161' },
      platform,
    );
    const company = await post(
      '/api/v1/companies',
      {
        organization_id: org.body.id,
        name: 'Synthetic company B',
        corporate_name: 'Synthetic B LTDA',
        document: '11444777000161',
      },
      platform,
    );
    const other = await post(
      '/api/v1/projects',
      {
        organization_id: org.body.id,
        company_id: company.body.id,
        name: 'Synthetic validation B',
      },
      platform,
    );
    otherBase = `/api/v1/projects/${other.body.id}`;
  });
  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  it.each([[], ['payments:read'], ['expenses:read']].map((reads) => [reads]))(
    'omits optional finance without both read permissions (%j)',
    async (reads) => {
      await grant(['projects:read', ...reads]);
      for (const endpoint of ['summary', 'dashboard']) {
        const result = await request(app.getHttpServer())
          .get(base + '/' + endpoint + '?include_financial=true')
          .set(auth(user))
          .expect(200);
        expect(result.body.financial).toBeUndefined();
        expect(result.body.inventory).toBeDefined();
        expect(result.body.project.id).toBe(Number(base.split('/').at(-1)));
      }
    },
  );
  it('includes financial totals only with both domain reads, preserving administrative access', async () => {
    await grant(['projects:read', 'payments:read', 'expenses:read']);
    for (const token of [user, admin, platform]) {
      const result = await request(app.getHttpServer())
        .get(base + '/summary?include_financial=true')
        .set(auth(token))
        .expect(200);
      expect(result.body.financial.total_expense_amount).toBe('100.00');
    }
    const result = await request(app.getHttpServer())
      .get(base + '/summary')
      .set(auth(user))
      .expect(200);
    expect(result.body.financial).toBeUndefined();
  });

  it('blocks cross-organization summary/collections and preserves PLATFORM_ADMIN access', async () => {
    await grant(['projects:read']);
    for (const token of [admin, user]) {
      await request(app.getHttpServer())
        .get(`${otherBase}/summary?include_financial=true`)
        .set(auth(token))
        .expect(403);
      const list = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set(auth(token))
        .expect(200);
      expect(
        list.body.items.every(
          (p: { organization_id: number }) => p.organization_id === 1,
        ),
      ).toBe(true);
    }
    await request(app.getHttpServer())
      .get(`${otherBase}/summary`)
      .set(auth(platform))
      .expect(200);
    await request(app.getHttpServer()).get(`${base}/summary`).expect(401);
  });

  it('requires verified objects and immutable declarations for images, attachments and evidence', async () => {
    const image = await post(
      base + '/inventory-items/' + itemId + '/images/upload-url',
      {
        original_name: 'absent.png',
        mime_type: 'image/png',
        size_bytes: 10,
        checksum: TEST_OBJECT_CHECKSUM,
      },
    );
    const attachment = await post(
      base + '/expenses/' + expenseId + '/attachments/upload-url',
      {
        original_name: 'absent.pdf',
        mime_type: 'application/pdf',
        size_bytes: 10,
        checksum: TEST_OBJECT_CHECKSUM,
      },
    );
    const evidence = await post(evidenceBase + '/upload-url', {
      original_name: 'absent.png',
      mime_type: 'image/png',
      size_bytes: 10,
      checksum: TEST_OBJECT_CHECKSUM,
    });
    const paths = [
      base + '/inventory-items/' + itemId + '/images/' + image.body.image.id,
      base +
        '/expenses/' +
        expenseId +
        '/attachments/' +
        attachment.body.attachment.id,
      evidenceBase + '/' + evidence.body.evidence.id,
    ];
    const uploads = [image, attachment, evidence];
    for (const [index, path] of paths.entries()) {
      await post(path + '/download-url', {}, admin, 409);
      await post(path + '/confirm-upload', {}, admin, 404);
      await post(path + '/confirm-upload', { size_bytes: 11 }, admin, 409);
      await post(
        path + '/confirm-upload',
        { checksum: 'b'.repeat(64) },
        admin,
        409,
      );
      app.get<FakeStorage>(STORAGE_SIGNER).put(uploads[index].body.upload_url);
      const confirmed = await post(
        path + '/confirm-upload',
        { size_bytes: 10, checksum: TEST_OBJECT_CHECKSUM },
        admin,
        200,
      );
      expect(confirmed.body).toMatchObject({
        status: 'uploaded',
        size_bytes: 10,
        checksum: TEST_OBJECT_CHECKSUM,
      });
      await request(app.getHttpServer())
        .post(path + '/download-url')
        .expect(401);
      await grant(['projects:read']);
      await post(path + '/download-url', {}, user, 403);
      const permission = path.includes('/images/')
        ? 'inventory-item-images:download'
        : path.includes('/attachments/')
          ? 'expenses:download-attachment'
          : 'inventory-sessions:read';
      await grant([permission]);
      await post(path + '/download-url', {}, user, 200);
      await post(
        path.replace(base, otherBase) + '/download-url',
        {},
        admin,
        path.includes('/attachments/') ? 404 : 403,
      );
      await post(
        path.replace(base, otherBase) + '/download-url',
        {},
        platform,
        path.includes('/images/') ? 403 : 404,
      );
    }
  });

  it.each([0, -1, 10485761])(
    'rejects evidence declared size %i',
    async (size_bytes) => {
      await post(
        `${evidenceBase}/upload-url`,
        { original_name: 'bad.png', mime_type: 'image/png', size_bytes },
        admin,
        400,
      );
    },
  );

  it('import files require uploaded state, object existence, size and authorization', async () => {
    const session = await post(`${base}/import-sessions`, {
      type: 'mobile_sync',
      source: 'mobile_app',
      expected_payloads: 1,
    });
    const files = `${base}/import-sessions/${session.body.id}/files`;
    const upload = await post(`${files}/upload-url`, {
      type: 'raw_backup',
      original_name: 'absent.json',
      mime_type: 'application/json',
      size_bytes: 123,
    });
    const path = `${files}/${upload.body.file.id}`;
    await post(`${path}/download-url`, {}, admin, 409);
    await post(`${path}/confirm-upload`, {}, admin, 404);
    app.get<FakeStorage>(STORAGE_SIGNER).put(upload.body.upload_url);
    await post(`${path}/confirm-upload`, { size_bytes: 124 }, admin, 409);
    const confirmed = await post(
      `${path}/confirm-upload`,
      { size_bytes: 123, checksum: TEST_OBJECT_CHECKSUM },
      admin,
      200,
    );
    expect(confirmed.body).toMatchObject({
      status: 'uploaded',
      checksum: TEST_OBJECT_CHECKSUM,
    });
    await grant(['projects:read']);
    await post(`${path}/download-url`, {}, user, 403);
    await grant(['import-files:download']);
    await post(`${path}/download-url`, {}, user, 200);
    await post(`${path.replace(base, otherBase)}/download-url`, {}, admin, 404);
    await request(app.getHttpServer()).post(`${path}/download-url`).expect(401);
  });

  it('rejects an expense attachment above the configured limit', async () => {
    const result = await post(
      `${base}/expenses/${expenseId}/attachments/upload-url`,
      {
        original_name: 'synthetic.bin',
        mime_type: 'application/octet-stream',
        size_bytes: 200 * 1024 * 1024,
      },
      admin,
      400,
    );
    expect(result.body.code).toBe('STORAGE_INVALID_SIZE');
  });

  it('characterizes ValidationPipe error message arrays for the frontend contract', async () => {
    const response = await post(
      `${evidenceBase}/upload-url`,
      { original_name: 'invalid.png', mime_type: 'image/png', size_bytes: -1 },
      admin,
      400,
    );
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
    expect(response.body.stack).toBeUndefined();
  });
  it('rejects unsupported MIME and confirmation above the image size limit', async () => {
    await post(
      `${evidenceBase}/upload-url`,
      {
        original_name: 'bad.exe',
        mime_type: 'application/octet-stream',
        size_bytes: 10,
      },
      admin,
      400,
    );
    const image = await post(
      `${base}/inventory-items/${itemId}/images/upload-url`,
      { original_name: 'limit.png', mime_type: 'image/png', size_bytes: 10 },
    );
    await post(
      `${base}/inventory-items/${itemId}/images/${image.body.image.id}/confirm-upload`,
      { size_bytes: 10485761 },
      admin,
      400,
    );
  });

  it('returns versioned reconciliation envelopes and scoped paginated records', async () => {
    const sessionBase = evidenceBase.split('/rounds/')[0];
    await grant(['projects:read']);
    await post(`${sessionBase}/reconciliations`, {}, user, 403);
    const first = await post(`${sessionBase}/reconciliations`);
    const second = await post(`${sessionBase}/reconciliations`);
    expect(first.body).toMatchObject({
      run_number: 1,
      records: expect.any(Array),
    });
    expect(second.body.run_number).toBe(2);
    expect(first.body.records).toHaveLength(1);
    const list = await request(app.getHttpServer())
      .get(`${sessionBase}/reconciliations?run_number=1`)
      .set(auth())
      .expect(200);
    expect(list.body.items).toEqual(first.body.records);
    await post(
      `${sessionBase.replace(base, otherBase)}/reconciliations`,
      {},
      admin,
      403,
    );
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const operation =
      document.paths[
        '/api/v1/projects/{projectId}/inventory-sessions/{sessionId}/reconciliations'
      ].post!;
    expect(operation.responses['201']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/InventoryReconciliationRunResponseDto',
          },
        },
      },
    });
    expect(
      document.components!.schemas!.InventoryReconciliationRunResponseDto,
    ).toMatchObject({
      required: ['run_number', 'records'],
      properties: {
        records: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/InventoryReconciliationResponseDto',
          },
        },
      },
    });
  });

  it.each([
    ['2026-01-31', ['2026-01-31', '2026-02-28', '2026-03-31']],
    ['2028-01-31', ['2028-01-31', '2028-02-29', '2028-03-31']],
    ['2028-02-29', ['2028-02-29', '2028-03-31', '2028-04-30']],
  ])(
    'preserves month end from %s while preserving every cent',
    async (first_due_date, dates) => {
      const expense = await post(`${base}/expenses`, {
        description: 'Synthetic installments',
        expense_date: first_due_date,
        amount: '100.00',
      });
      const url = `${base}/expenses/${expense.body.id}/installments/generate`;
      const result = await post(url, { count: 3, first_due_date });
      expect(
        result.body.map((row: { due_date: string }) =>
          row.due_date.slice(0, 10),
        ),
      ).toEqual(dates);
      expect(result.body.map((row: { amount: string }) => row.amount)).toEqual([
        '33.34',
        '33.33',
        '33.33',
      ]);
      const roundTrip = await request(app.getHttpServer())
        .get(`${base}/expenses/${expense.body.id}/installments`)
        .set(auth())
        .expect(200);
      expect(
        roundTrip.body.items.map((row: { due_date: string }) =>
          row.due_date.slice(0, 10),
        ),
      ).toEqual(dates);
      await post(url, { count: 3, first_due_date }, admin, 409);
    },
  );

  it('does not recalculate installments already persisted under a prior calendar', async () => {
    const expense = await post(`${base}/expenses`, {
      description: 'Historical synthetic installments',
      expense_date: '2026-01-31',
      amount: '100.00',
    });
    const url = `${base}/expenses/${expense.body.id}/installments`;
    await post(`${url}/generate`, { count: 3, first_due_date: '2026-01-31' });
    const repo = app.get<Repository<ExpenseInstallmentEntity>>(
      getRepositoryToken(ExpenseInstallmentEntity),
    );
    await repo.update(
      { expenseId: expense.body.id, installmentNumber: 2 },
      { dueDate: '2026-03-03' },
    );
    await post(
      `${url}/generate`,
      { count: 3, first_due_date: '2026-01-31' },
      admin,
      409,
    );
    const persisted = await request(app.getHttpServer())
      .get(url)
      .set(auth())
      .expect(200);
    expect(persisted.body.items[1].due_date.slice(0, 10)).toBe('2026-03-03');
    expect(
      persisted.body.items.map((row: { amount: string | number }) =>
        String(row.amount),
      ),
    ).toEqual(['33.34', '33.33', '33.33']);
  });

  it('requires domain reads at creation and revalidates downloads of existing jobs', async () => {
    await grant([
      'export-jobs:create',
      'export-jobs:read',
      'export-jobs:download',
    ]);
    await request(app.getHttpServer())
      .get(`${base}/expenses`)
      .set(auth(user))
      .expect(403);
    await post(`${base}/export-jobs`, { type: 'expenses_xlsx' }, user, 403);
    await grant([
      'export-jobs:create',
      'export-jobs:read',
      'export-jobs:download',
      'expenses:read',
    ]);
    const job = await post(
      `${base}/export-jobs`,
      { type: 'expenses_xlsx' },
      user,
    );
    const url = `${base}/export-jobs/${job.body.id}`;
    let status: string | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await request(app.getHttpServer())
        .get(url)
        .set(auth(user))
        .expect(200);
      status = response.body.status;
      if (['finished', 'failed'].includes(status!)) break;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    expect(status).toBe('finished');
    await request(app.getHttpServer()).get(`${url}/download`).expect(401);
    await request(app.getHttpServer())
      .get(`${url.replace(base, otherBase)}/download`)
      .set(auth())
      .expect(403);
    await request(app.getHttpServer())
      .get(`${url.replace(base, otherBase)}/download`)
      .set(auth(platform))
      .expect(404);
    await grant([
      'export-jobs:create',
      'export-jobs:read',
      'export-jobs:download',
    ]);
    await post(`${url}/download-url`, {}, user, 403);
    await request(app.getHttpServer())
      .get(`${url}/download`)
      .set(auth(user))
      .expect(403);
    await grant([
      'export-jobs:create',
      'export-jobs:read',
      'export-jobs:download',
      'expenses:read',
    ]);
    const file = await request(app.getHttpServer())
      .get(`${url}/download`)
      .set(auth(user))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const workbook = XLSX.read(file.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[workbook.SheetNames[0]],
    );
    expect(JSON.stringify(rows)).toContain('Synthetic taxi');
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ Descricao: 'Synthetic taxi', Valor: 100 }),
      ]),
    );
  });
  it.each(Object.values(ExportJobType))(
    'requires every content read for %s including backups',
    async (type) => {
      const reads = EXPORT_CONTENT_PERMISSIONS[type];
      const specialized = [
        ExportJobType.DRE_XLSX,
        ExportJobType.FINANCE_XLSX,
      ].includes(type);
      const jobs = app.get<Repository<ExportJobEntity>>(
        getRepositoryToken(ExportJobEntity),
      );
      const before = await jobs.count();
      for (const missing of reads) {
        await grant([
          'export-jobs:create',
          'export-jobs:download',
          ...reads.filter((key) => key !== missing),
        ]);
        await post(
          base + '/export-jobs',
          { type },
          user,
          specialized ? 409 : 403,
        );
      }
      await grant(['export-jobs:create', ...reads]);
      await post(
        base + '/export-jobs',
        { type },
        user,
        specialized ? 409 : 201,
      );
      if (specialized) expect(await jobs.count()).toBe(before);
    },
  );
});
