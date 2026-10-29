import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import { ProjectStatus } from '../../../src/modules/projects/domain/enums/project-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as XLSX from 'xlsx';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsOrgUser,
  loginAsAdmin,
} from '../test-app.helper';
import { InventoryItemEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import {
  AssetValuationEntity,
  InventoryObservationEntity,
  InventoryConsolidationEntity,
} from '../../../src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity';
import {
  ValuationBatch,
  ValuationBatchRow,
} from '../../../src/modules/inventory-operations/infrastructure/persistence/valuation-batch.entity';
import { InventoryOperationsService } from '../../../src/modules/inventory-operations/application/inventory-operations.service';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { ExportWorkbookBuilderService } from '../../../src/modules/export-jobs/application/services/export-workbook-builder.service';
import { ExportJobEntity } from '../../../src/modules/export-jobs/infrastructure/persistence/export-job.entity';
import { ExportJobType } from '../../../src/modules/export-jobs/domain/enums/export-job-type.enum';
import type { PreviewValuationBatchDto } from '../../../src/modules/inventory-operations/application/valuation-batch.dto';
describe('Batch valuations real HTTP, SQL atomicity and source preservation', () => {
  let app: INestApplication,
    ds: DataSource,
    admin: string,
    user: string,
    platform: string,
    seq = 0;
  const post = (path: string, body: object = {}, token = admin) =>
    request(app.getHttpServer())
      .post('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const get = (path: string, token = admin) =>
    request(app.getHttpServer())
      .get('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    platform = await loginAsAdmin(app);
  });
  afterAll(async () => app?.close());
  const fixture = async (n = 2) => {
    const p = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Avaliacao ' + ++seq,
      }).expect(201)
    ).body.id as number;
    const items: InventoryItemEntity[] = [];
    for (let i = 0; i < n; i++) {
      const row = (
        await post(`/projects/${p}/inventory-items`, {
          old_plate: 'B' + i,
          description: 'Avaliacao sintetica ' + i,
          new_value: '999.99',
          used_value: '333.33',
        }).expect(201)
      ).body as { id: number };
      items.push(
        await ds
          .getRepository(InventoryItemEntity)
          .findOneByOrFail({ id: row.id }),
      );
    }
    return { p, items, base: `/projects/${p}/valuation-batches` };
  };
  const input = (
    f: Awaited<ReturnType<typeof fixture>>,
    over: object = {},
  ): PreviewValuationBatchDto => ({
    selection: { kind: 'ids', ids: f.items.map((i) => i.id) },
    mode: 'common',
    common: {
      source: 'Catalogo documentado sintetico',
      valuation_date: '2026-10-27',
      new_value: '1234.56',
      used_value: '321.00',
      notes: 'Revisao tecnica manual',
    },
    command_key: 'valuation-key-' + ++seq,
    ...over,
  });
  const preview = async (
    f: Awaited<ReturnType<typeof fixture>>,
    dto = input(f),
  ) =>
    (await post(f.base + '/preview', dto).expect(201))
      .body as ValuationBatch & { items: ValuationBatchRow[] };
  const confirm = (f: Awaited<ReturnType<typeof fixture>>, b: ValuationBatch) =>
    post(f.base + `/${b.id}/confirm`, {
      revision: 1,
      preview_hash: b.previewHash,
      command_key: b.commandKey,
    });
  it('requires session, explicit organizational permissions and catalog presence', async () => {
    const f = await fixture();
    await request(app.getHttpServer())
      .get('/api/v1' + f.base)
      .expect(401);
    await get(f.base, user).expect(403);
    await post(f.base + '/preview', input(f), user).expect(403);
    const repo = ds.getRepository(PermissionEntity),
      permission = await repo.findOneByOrFail({
        key: 'asset-valuations:batch-create',
      });
    await repo.update(permission.id, { key: 'temporarily-missing-batch' });
    try {
      await post(f.base + '/preview', input(f)).expect(403);
    } finally {
      await repo.update(permission.id, { key: permission.key });
    }
  });
  it('keeps individual evaluation in the same history with valid civil dates', async () => {
    const f = await fixture(1);
    const i = f.items[0];
    await post(`/projects/${f.p}/inventory-items/${i.id}/valuations`, {
      source: 'Individual existente',
      valuation_date: '2026-10-27',
      used_value: '0.00',
    }).expect(201);
    await post(`/projects/${f.p}/inventory-items/${i.id}/valuations`, {
      source: '  ',
      valuation_date: '2026-10-27',
      used_value: '1.00',
    }).expect(400);
    await post(`/projects/${f.p}/inventory-items/${i.id}/valuations`, {
      source: 'Fonte',
      valuation_date: '2026-02-30',
      used_value: '1.00',
    }).expect(400);
    const history = (
      await get(`/projects/${f.p}/inventory-items/${i.id}/valuations`).expect(
        200,
      )
    ).body.items as { valuation_date: string }[];
    expect(history[0].valuation_date).toBe('2026-10-27');
    expect(
      await ds.getRepository(InventoryItemEntity).findOneByOrFail({ id: i.id }),
    ).toEqual(i);
  });
  it('previews without values being saved, then atomically appends one history row per item and preserves sources', async () => {
    const f = await fixture();
    const dto = input(f),
      b = await preview(f, dto);
    expect(
      await ds.getRepository(AssetValuationEntity).countBy({ projectId: f.p }),
    ).toBe(0);
    expect((await post(f.base + '/preview', dto).expect(201)).body.id).toBe(
      b.id,
    );
    await post(f.base + '/preview', {
      ...dto,
      common: { ...dto.common, new_value: '2.00' },
    }).expect(409);
    const first = await confirm(f, b).expect(201);
    expect(first.body.summary).toMatchObject({
      total_requested: 2,
      total_processed: 2,
      total_approved: 2,
      total_rejected: 0,
    });
    expect((await confirm(f, b).expect(201)).body).toEqual(first.body);
    await post(f.base + `/${b.id}/confirm`, {
      revision: 1,
      preview_hash: '0'.repeat(64),
      command_key: b.commandKey,
    }).expect(409);
    const values = await ds
      .getRepository(AssetValuationEntity)
      .findBy({ projectId: f.p });
    expect(
      values.every(
        (v) => Math.abs(v.createdAt.getTime() - Date.now()) < 120000,
      ),
    ).toBe(true);
    expect(values).toHaveLength(2);
    expect(
      values.every(
        (v) =>
          v.batchOperationId === b.id &&
          Number(v.newValue) === 1234.56 &&
          v.valuationDate === '2026-10-27',
      ),
    ).toBe(true);
    for (const item of f.items)
      expect(
        await ds
          .getRepository(InventoryItemEntity)
          .findOneByOrFail({ id: item.id }),
      ).toEqual(item);
    expect(
      await ds
        .getRepository(InventoryObservationEntity)
        .countBy({ projectId: f.p }),
    ).toBe(0);
    expect(
      await ds
        .getRepository(InventoryConsolidationEntity)
        .countBy({ projectId: f.p }),
    ).toBe(0);
    expect(
      (await get(f.base + `/${b.id}`).expect(200)).body.items.every(
        (r: { valuationId: number }) => r.valuationId > 0,
      ),
    ).toBe(true);
    const next = await preview(f);
    await confirm(f, next).expect(201);
    expect(
      await ds.getRepository(AssetValuationEntity).countBy({ projectId: f.p }),
    ).toBe(4);
  });
  it('applies individualized zero/new/used values with shared documented metadata', async () => {
    const f = await fixture();
    const b = await preview(
      f,
      input(f, {
        mode: 'individual',
        common: {
          source: 'Catalogo por item',
          valuation_date: '2026-10-27',
          notes: 'Evidencia por bem',
        },
        values: [
          { inventory_item_id: f.items[0].id, new_value: '0.00' },
          { inventory_item_id: f.items[1].id, used_value: '99.90' },
        ],
      }),
    );
    await confirm(f, b).expect(201);
    const rows = await ds
      .getRepository(AssetValuationEntity)
      .find({ where: { projectId: f.p }, order: { inventoryItemId: 'ASC' } });
    expect(Number(rows[0].newValue)).toBe(0);
    expect(rows[0].usedValue).toBeNull();
    expect(rows[1].newValue).toBeNull();
    expect(Number(rows[1].usedValue)).toBe(99.9);
  });
  it('validates mandatory fields, money, duplicate IDs and exact individualized membership', async () => {
    const f = await fixture();
    const good = input(f);
    for (const common of [
      { ...good.common, source: '' },
      { ...good.common, valuation_date: '2026-02-30' },
      { ...good.common, new_value: '-2' },
      { ...good.common, used_value: '1.999' },
    ])
      await post(f.base + '/preview', {
        ...good,
        command_key: 'invalid-' + ++seq,
        common,
      }).expect(400);
    await post(f.base + '/preview', {
      ...good,
      common: { ...good.common, new_value: null, used_value: null },
    }).expect(409);
    await post(f.base + '/preview', {
      ...good,
      selection: { kind: 'ids', ids: [f.items[0].id, f.items[0].id] },
    }).expect(400);
    await post(f.base + '/preview', {
      ...good,
      mode: 'individual',
      values: [{ inventory_item_id: f.items[0].id, new_value: '5.00' }],
    }).expect(400);
    await post(f.base + '/preview', {
      ...good,
      selection: { kind: 'ids', ids: [99999999] },
    }).expect(409);
    await post(f.base + '/preview', { ...good, selection: undefined }).expect(
      400,
    );
    expect(
      await ds.getRepository(AssetValuationEntity).countBy({ projectId: f.p }),
    ).toBe(0);
  });
  it('resolves filters and IDs across pages explicitly and invalidates preview when filter membership changes', async () => {
    const f = await fixture(23);
    const page1 = (
      await get(`/projects/${f.p}/inventory-items?page=1&page_size=20`).expect(
        200,
      )
    ).body.items as { id: number }[];
    const page2 = (
      await get(`/projects/${f.p}/inventory-items?page=2&page_size=20`).expect(
        200,
      )
    ).body.items as { id: number }[];
    const explicit = await preview(
      f,
      input(f, { selection: { kind: 'ids', ids: [page1[0].id, page2[0].id] } }),
    );
    expect(explicit.total).toBe(2);
    const selection = {
      kind: 'filters' as const,
      filters: { search: 'Avaliacao sintetica' },
      exclude_ids: [f.items[0].id],
    };
    const resolved = await post(f.base + '/selection', { selection }).expect(
      201,
    );
    expect(resolved.body.total).toBe(22);
    const b = await preview(f, input(f, { selection }));
    expect(b.total).toBe(22);
    await post(`/projects/${f.p}/inventory-items`, {
      description: 'Avaliacao sintetica nova',
    }).expect(201);
    const rejected = await confirm(f, b).expect(409);
    expect(rejected.body.details.summary.total_processed).toBe(0);
    expect(
      await ds.getRepository(AssetValuationEntity).countBy({ projectId: f.p }),
    ).toBe(0);
  });
  it('rejects foreign item, batch and organization IDs without leaking financial data', async () => {
    const f = await fixture(),
      other = await fixture();
    const b = await preview(f);
    await post(
      f.base + '/preview',
      input(f, { selection: { kind: 'ids', ids: [other.items[0].id] } }),
    ).expect(409);
    await get(other.base + `/${b.id}`).expect(404);
    await post(other.base + `/${b.id}/confirm`, {
      revision: 1,
      preview_hash: b.previewHash,
      command_key: b.commandKey,
    }).expect(404);
    const org = (
      await post(
        '/organizations',
        { legal_name: 'Avaliacao outra org', cnpj: '11444777000161' },
        platform,
      ).expect(201)
    ).body.id as number;
    const company = (
      await post(
        '/companies',
        { organization_id: org, name: 'Outra empresa' },
        platform,
      ).expect(201)
    ).body.id as number;
    const foreign = (
      await post(
        '/projects',
        { organization_id: org, company_id: company, name: 'Projeto privado' },
        platform,
      ).expect(201)
    ).body.id as number;
    await get(`/projects/${foreign}/valuation-batches`).expect(403);
    await post(
      `/projects/${foreign}/valuation-batches/preview`,
      input(f),
    ).expect(403);
  });
  it('revalidates master, status and new/backdated individual history after preview', async () => {
    const f = await fixture();
    let b = await preview(f);
    await ds
      .getRepository(InventoryItemEntity)
      .update(f.items[0].id, { description: 'Alteracao depois da previa' });
    const failed = await confirm(f, b).expect(409);
    expect(failed.body.details.errors[0].inventory_item_id).toBe(f.items[0].id);
    b = await preview(f);
    await post(`/projects/${f.p}/inventory-items/${f.items[0].id}/valuations`, {
      source: 'Individual concorrente',
      valuation_date: '2020-01-01',
      new_value: '3.00',
    }).expect(201);
    await confirm(f, b).expect(409);
    expect(
      await ds.getRepository(AssetValuationEntity).countBy({ projectId: f.p }),
    ).toBe(1);
    await ds.getRepository(InventoryItemEntity).softDelete(f.items[1].id);
    await post(f.base + '/preview', input(f)).expect(409);
  });
  it('rolls back every valuation and row result when a later item fails', async () => {
    const f = await fixture();
    const b = await preview(f);
    const service = app.get(InventoryOperationsService),
      original = service.recordValuation.bind(service);
    let calls = 0;
    const spy = jest
      .spyOn(service, 'recordValuation')
      .mockImplementation(async (...args) => {
        if (++calls === 2)
          throw new Error('Synthetic failure after first write');
        return original(...args);
      });
    try {
      await confirm(f, b).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      await ds.getRepository(AssetValuationEntity).countBy({ projectId: f.p }),
    ).toBe(0);
    expect(
      (
        await ds.getRepository(ValuationBatchRow).findBy({ batchId: b.id })
      ).every((r) => r.valuationId === null),
    ).toBe(true);
    expect(
      (await ds.getRepository(ValuationBatch).findOneByOrFail({ id: b.id }))
        .status,
    ).toBe('preview');
    await confirm(f, b).expect(201);
  });
  it('serializes same-operation replays and conflicts two previews of the same source', async () => {
    const f = await fixture();
    const a = await preview(f),
      b = await preview(f);
    if (ds.options.type === 'mysql') {
      const results = await Promise.all([confirm(f, a), confirm(f, a)]);
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(
        results[0].body.items.map(
          (r: { valuationId: number }) => r.valuationId,
        ),
      ).toEqual(
        results[1].body.items.map(
          (r: { valuationId: number }) => r.valuationId,
        ),
      );
    } else {
      await confirm(f, a).expect(201);
      await confirm(f, a).expect(201);
    }
    await confirm(f, b).expect(409);
    expect(
      await ds.getRepository(AssetValuationEntity).countBy({ projectId: f.p }),
    ).toBe(2);
  });
  it('expires previews, blocks project lifecycle and enforces configured size without truncation', async () => {
    const f = await fixture();
    const b = await preview(f);
    await ds
      .getRepository(ValuationBatch)
      .update(b.id, { expiresAt: new Date('2000-01-01') });
    await confirm(f, b).expect(409);
    await post(
      f.base + '/preview',
      input(f, {
        selection: {
          kind: 'ids',
          ids: Array.from({ length: 101 }, (_, n) => n + 1),
        },
      }),
    ).expect(409);
    await ds
      .getRepository(ProjectEntity)
      .update(f.p, { status: ProjectStatus.INACTIVE });
    await post(f.base + '/preview', input(f)).expect(409);
  });
  it('exports applied snapshots through the existing workbook with content authorization', async () => {
    const f = await fixture();
    const b = await preview(f);
    await confirm(f, b).expect(201);
    const builder = app.get(ExportWorkbookBuilderService);
    const buffer = await builder.build({
      organizationId: 1,
      projectId: f.p,
      type: ExportJobType.VALUATION_BATCHES_XLSX,
    } as ExportJobEntity);
    const book = XLSX.read(buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<{ ['Operacao ID']: number }>(
      book.Sheets['Avaliacoes em lote'],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]['Operacao ID']).toBe(b.id);
    const role = await ds
      .getRepository(RoleEntity)
      .findOneByOrFail({ name: 'Operador', organizationId: 1 });
    const grants = ds.getRepository(RolePermissionEntity);
    const existing = await grants.findBy({ roleId: role.id });
    const permission = await ds
      .getRepository(PermissionEntity)
      .findOneByOrFail({ key: 'export-jobs:create' });
    await grants.save(
      grants.create({ roleId: role.id, permissionId: permission.id }),
    );
    try {
      await post(
        `/projects/${f.p}/export-jobs`,
        { type: 'valuation_batches_xlsx' },
        user,
      ).expect(403);
    } finally {
      await grants.delete({ roleId: role.id });
      await grants.save(existing);
    }
  });
});
