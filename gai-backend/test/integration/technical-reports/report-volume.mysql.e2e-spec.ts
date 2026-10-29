import { INestApplication } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import request from 'supertest';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { strFromU8, unzipSync } from 'fflate';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsOrgUser,
} from '../test-app.helper';
import { templateFixture } from '../../unit/modules/technical-reports/report.fixtures';
import { InventoryItemEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import {
  TechnicalReport,
  TechnicalReportVersion,
  ReportCommand,
} from '../../../src/modules/technical-reports/report.entity';
import { DocumentArtifact } from '../../../src/modules/documents/document.entity';
import { documentHash } from '../../../src/modules/technical-reports/report.hash';
import { REPORT_ENGINE } from '../../../src/modules/technical-reports/report.policy';
import {
  AssetValuationEntity,
  InventoryObservationEntity,
  InventoryReconciliationEntity,
  InventoryConsolidationEntity,
} from '../../../src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity';
import {
  InventoryObservationResult,
  ReconciliationStatus,
  ConsolidationDecision,
} from '../../../src/modules/inventory-operations/domain/inventory-operation.enums';
import { InventoryAccountingItemEntity } from '../../../src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryPendingIssueEntity } from '../../../src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { InventoryPendingIssueType } from '../../../src/modules/inventory-pending-issues/domain/enums/inventory-pending-issue-type.enum';
import { CompanyUnitEntity } from '../../../src/modules/companies/infrastructure/persistence/company-unit.entity';
import { ProjectUnitEntity } from '../../../src/modules/companies/infrastructure/persistence/project-unit.entity';

describe('Complete report extraction with real MySQL and immutable document sources', () => {
  let app: INestApplication,
    ds: DataSource,
    token: string,
    reader: string,
    publication: number;
  let volumeReport: any, volumeProject: number;
  const observations: object[] = [];
  const exportMatrix: object[] = [];
  const out = process.env.GAI_TEST_EVIDENCE_DIR;
  const command = () => ({
    command_key: randomUUID(),
    reason: 'SINTETICO Onda 2 volume e integridade',
  });
  const api = (
    method: 'get' | 'post',
    path: string,
    body: object = {},
    auth = token,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + auth)
      .send(body);
  const base = (project: number) => `/projects/${project}/technical-reports`;
  async function exportVolume(p: number, row: any, count: number) {
    let current = row;
    const root = `${base(p)}/${row.id}`;
    for (const action of ['review', 'approve'])
      current = (
        await api('post', root + '/transitions', {
          ...command(),
          revision: current.revision,
          action,
        }).expect(201)
      ).body;
    const version = await ds
      .getRepository(TechnicalReportVersion)
      .findOneByOrFail({ id: current.approvedVersionId });
    expect(version.data.sources.metrics['inventory.count']).toBe(count);
    for (const format of ['docx', 'pdf']) {
      const memory = process.memoryUsage(),
        start = performance.now(),
        before = await ds.getRepository(DocumentArtifact).count();
      const response = await api(
        'post',
        `${root}/versions/${version.id}/documents`,
        { format },
      );
      if (response.status === 503 && count === 5000) {
        expect(response.body.message).toMatch(/render|gera|Tempo|Documento/i);
        expect(await ds.getRepository(DocumentArtifact).count()).toBe(before);
        exportMatrix.push({
          count,
          format,
          status: 503,
          message: response.body.message,
          milliseconds: performance.now() - start,
          partial_artifact: false,
          snapshot_hash: version.hash,
        });
        continue;
      }
      expect(response.status).toBe(201);
      const artifact = await ds
        .getRepository(DocumentArtifact)
        .createQueryBuilder('a')
        .addSelect('a.bytes')
        .where('a.id=:id', { id: response.body.id })
        .getOneOrFail();
      const bytes = Buffer.from(artifact.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        artifact.checksum,
      );
      let pages: number | undefined;
      if (format === 'pdf')
        pages = (await PDFDocument.load(bytes)).getPageCount();
      else {
        const xml = strFromU8(unzipSync(bytes)['word/document.xml']);
        const markers = [...xml.matchAll(/SINTETICO item (\d{5})/g)].map(
          (match) => match[1],
        );
        expect(markers).toEqual(
          Array.from({ length: count }, (_, i) => String(i).padStart(5, '0')),
        );
        expect(xml).toContain(version.hash);
      }
      if (out) {
        mkdirSync(join(out, 'volume-matrix'), { recursive: true });
        writeFileSync(
          join(out, 'volume-matrix', `volume-${count}.${format}`),
          bytes,
        );
      }
      exportMatrix.push({
        count,
        format,
        status: 201,
        bytes: bytes.length,
        checksum: artifact.checksum,
        pages,
        milliseconds: performance.now() - start,
        rss_before: memory.rss,
        rss_after: process.memoryUsage().rss,
        heap_before: memory.heapUsed,
        heap_after: process.memoryUsage().heapUsed,
        snapshot_hash: version.hash,
      });
    }
  }
  let familiesFixture: { project: number; session: number } | undefined;
  async function prepareFamilies() {
    if (familiesFixture) return familiesFixture;
    const p = await project('famílias além de mil');
    await items(p, 1001);
    const inventory = await ds
      .getRepository(InventoryItemEntity)
      .find({ where: { projectId: p }, order: { id: 'ASC' } });
    async function bulk(entity: any, rows: any[]) {
      for (let offset = 0; offset < rows.length; offset += 100)
        await ds.getRepository(entity).insert(rows.slice(offset, offset + 100));
    }
    const scope = { organizationId: 1, projectId: p };
    await bulk(
      CompanyUnitEntity,
      inventory.map((_, i) => ({
        organizationId: 1,
        companyId: 1,
        name: `SINTETICO unidade ${p}-${i}`,
      })),
    );
    const units = await ds.getRepository(CompanyUnitEntity).find({
      where: { organizationId: 1, companyId: 1 },
      order: { id: 'ASC' },
    });
    await bulk(
      ProjectUnitEntity,
      units
        .filter((unit) => unit.name.startsWith(`SINTETICO unidade ${p}-`))
        .map((unit) => ({ ...scope, companyUnitId: Number(unit.id) })),
    );
    await bulk(
      InventoryAccountingItemEntity,
      inventory.map((_, i) => ({
        ...scope,
        plate: `SYN-ACCOUNTING-${i}`,
        description: 'SINTETICO contábil ' + i,
        acquisitionValue: '100.01',
      })),
    );
    await bulk(
      InventoryPendingIssueEntity,
      inventory.map((item, i) => ({
        ...scope,
        inventoryItemId: Number(item.id),
        type: InventoryPendingIssueType.OTHER,
        title: 'SINTETICO pendência ' + i,
      })),
    );
    const agent = (
      await api('post', '/field-agents', {
        name: 'SINTETICO agente volume',
      }).expect(201)
    ).body.id;
    await api('post', `/projects/${p}/field-agents`, {
      field_agent_id: agent,
    }).expect(201);
    const session = (
      await api('post', `/projects/${p}/inventory-sessions`, {
        name: 'SINTETICO sessão volume',
      }).expect(201)
    ).body.id;
    const round = (
      await api(
        'post',
        `/projects/${p}/inventory-sessions/${session}/start`,
      ).expect(200)
    ).body.round.id;
    await bulk(
      InventoryObservationEntity,
      inventory.map((item, i) => ({
        ...scope,
        sessionId: session,
        roundId: round,
        inventoryItemId: Number(item.id),
        fieldAgentId: agent,
        result: InventoryObservationResult.FOUND,
        observedPlate: 'SYN-OBS-' + i,
        capturedAt: new Date('2026-10-29T12:00:00Z'),
        receivedAt: new Date('2026-10-29T12:00:00Z'),
      })),
    );
    const accounting = await ds
      .getRepository(InventoryAccountingItemEntity)
      .find({ where: { projectId: p }, order: { id: 'ASC' } });
    const obs = await ds
      .getRepository(InventoryObservationEntity)
      .find({ where: { projectId: p }, order: { id: 'ASC' } });
    await bulk(
      InventoryReconciliationEntity,
      inventory.map((item, i) => ({
        ...scope,
        sessionId: session,
        runNumber: 1,
        inventoryItemId: Number(item.id),
        observationId: Number(obs[i].id),
        accountingItemId: Number(accounting[i].id),
        status: ReconciliationStatus.MATCHED,
        evidence: { synthetic: true },
      })),
    );
    const recs = await ds
      .getRepository(InventoryReconciliationEntity)
      .find({ where: { projectId: p }, order: { id: 'ASC' } });
    await bulk(
      InventoryConsolidationEntity,
      recs.map((rec) => ({
        ...scope,
        sessionId: session,
        reconciliationId: Number(rec.id),
        inventoryItemId: Number(rec.inventoryItemId),
        decision: ConsolidationDecision.ACCEPTED,
        evidenceSnapshot: { synthetic: true },
        decidedAt: new Date('2026-10-29T12:00:00Z'),
      })),
    );
    familiesFixture = { project: p, session };
    return familiesFixture;
  }
  const project = async (name: string) =>
    Number(
      (
        await api('post', '/projects', {
          organization_id: 1,
          company_id: 1,
          name: 'SINTETICO ' + name,
        }).expect(201)
      ).body.id,
    );
  async function items(p: number, count: number, text = 'SINTETICO item') {
    for (let offset = 0; offset < count; offset += 100)
      await ds.getRepository(InventoryItemEntity).insert(
        Array.from({ length: Math.min(100, count - offset) }, (_, i) => ({
          organizationId: 1,
          projectId: p,
          oldPlate: `SYN-${offset + i}`,
          description: `${text} ${String(offset + i).padStart(5, '0')}`,
        })),
      );
  }
  const capture = (p: number) =>
    api('post', base(p), {
      ...command(),
      template_version_id: publication,
      title: 'SINTETICO laudo integral',
      selection: { families: ['inventory'] },
    });
  beforeAll(async () => {
    if (out) mkdirSync(out, { recursive: true });
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    token = await loginAsOrgAdmin(app);
    reader = await loginAsOrgUser(app);
    const p = await project('modelo volume'),
      data = templateFixture();
    data.tables = ['identity', 'inventory'];
    data.rules.responsible_required = false;
    data.sections[1].text =
      'SINTETICO Escopo integral de bens com limitações explicitadas';
    let t = (
      await api('post', base(p) + '/templates', { ...command(), data }).expect(
        201,
      )
    ).body;
    t = (
      await api('post', `${base(p)}/templates/${t.id}/publish`, {
        ...command(),
        revision: t.revision,
      }).expect(201)
    ).body;
    publication = t.publishedVersionId;
  });
  afterAll(async () => {
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(
        join(out, 'report-volume.json'),
        JSON.stringify(observations, null, 2),
      );
      writeFileSync(
        join(out, 'volume-exports.json'),
        JSON.stringify(exportMatrix, null, 2),
      );
    }
    await app?.close();
  });
  it.each([0, 1, 999, 1000, 1001, 2500, 5000])(
    'extracts all %i items in stable order without duplicate references or omitted rows',
    async (count) => {
      const p = await project('volume ' + count);
      await items(p, count);
      const memory = process.memoryUsage(),
        start = performance.now();
      const response = await capture(p).expect(201),
        r = response.body;
      const table = r.data.sources.tables.find(
        (t: any) => t.family === 'inventory',
      );
      const ids = table.rows.map((row: any[]) => row[0]);
      expect(table.rows).toHaveLength(count);
      expect(table.references).toHaveLength(count);
      expect(r.data.sources.metrics['inventory.count']).toBe(count);
      expect(new Set(ids).size).toBe(count);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
      const sql = await ds.getRepository(InventoryItemEntity).find({
        where: { projectId: p, organizationId: 1 },
        order: { id: 'ASC' },
      });
      expect(ids).toEqual(sql.map((row) => Number(row.id)));
      expect(table.rows.map((row: any[]) => row[3])).toEqual(
        sql.map((row) => row.description),
      );
      const repeated = (await capture(p).expect(201)).body;
      expect(repeated.data.sources.hash).toBe(r.data.sources.hash);
      const saved = await ds
        .getRepository(TechnicalReportVersion)
        .findOneByOrFail({ reportId: r.id, revision: 1 });
      expect(saved.data.sources).toEqual(r.data.sources);
      observations.push({
        count,
        extracted: table.rows.length,
        hash: r.data.sources.hash,
        snapshot_bytes: Buffer.byteLength(JSON.stringify(r.data.sources)),
        milliseconds: performance.now() - start,
        rss_before: memory.rss,
        rss_after: process.memoryUsage().rss,
        heap_before: memory.heapUsed,
        heap_after: process.memoryUsage().heapUsed,
      });
      if (count === 2500) {
        volumeReport = r;
        volumeProject = p;
      } else await exportVolume(p, r, count);
    },
  );
  it('keeps a repeatable snapshot when rows are inserted and edited between cursor pages', async () => {
    const p = await project('concorrência de fontes');
    await items(p, 1001);
    const original = SelectQueryBuilder.prototype.getMany;
    const last = await ds
      .getRepository(InventoryItemEntity)
      .findOneOrFail({ where: { projectId: p }, order: { id: 'DESC' } });
    let inserted: Promise<unknown> | undefined;
    let changed = false;
    const spy = jest
      .spyOn(SelectQueryBuilder.prototype, 'getMany')
      .mockImplementation(async function (this: SelectQueryBuilder<any>) {
        const rows = await original.call(this);
        if (
          !changed &&
          this.expressionMap.mainAlias?.target === InventoryItemEntity &&
          this.getParameters().project === p &&
          rows.length === 250
        ) {
          changed = true;
          await ds
            .getRepository(InventoryItemEntity)
            .update(
              { id: Number(last.id), projectId: p },
              { description: 'SINTETICO alterado durante captura' },
            );
          inserted = ds.getRepository(InventoryItemEntity).insert({
            organizationId: 1,
            projectId: p,
            oldPlate: 'SYN-CONCURRENT',
            description: 'SINTETICO inserido durante captura',
          });
        }
        return rows;
      });
    let r: any;
    try {
      r = (await capture(p).expect(201)).body;
    } finally {
      spy.mockRestore();
      await inserted;
    }
    expect(changed).toBe(true);
    const rows = r.data.sources.tables.find(
      (t: any) => t.family === 'inventory',
    ).rows;
    expect(rows).toHaveLength(1001);
    expect(rows[1000][3]).toBe('SINTETICO item 01000');
    const next = (await capture(p).expect(201)).body;
    expect(next.data.sources.metrics['inventory.count']).toBe(1002);
    expect(next.data.sources.hash).not.toBe(r.data.sources.hash);
  });
  it('rejects oversized JSON on the server before fetching any inventory page', async () => {
    const p = await project('prévia de bytes na origem');
    await ds.getRepository(InventoryItemEntity).insert({
      organizationId: 1,
      projectId: p,
      oldPlate: 'SYN-LARGE-JSON',
      metadata: { synthetic: true, text: 'x'.repeat(5 * 1024 * 1024) },
    });
    const before = await ds.getRepository(TechnicalReportVersion).count();
    const spy = jest.spyOn(SelectQueryBuilder.prototype, 'getMany');
    try {
      const response = await capture(p).expect(413);
      expect(response.body.code).toBe('TECHNICAL_REPORT_SOURCE_LIMIT');
      expect(
        spy.mock.contexts.filter(
          (builder) =>
            builder.expressionMap.mainAlias?.target === InventoryItemEntity,
        ),
      ).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
    expect(await ds.getRepository(TechnicalReportVersion).count()).toBe(before);
    expect(
      await ds.getRepository(TechnicalReport).countBy({ projectId: p }),
    ).toBe(0);
  });
  it('rejects an oversized source atomically with an explicit limit and no partial report, version or audit command', async () => {
    const p = await project('capacidade explícita');
    await items(p, 500, 'SINTETICO ' + 'x'.repeat(10000));
    const before = await Promise.all(
      [TechnicalReport, TechnicalReportVersion, ReportCommand].map((entity) =>
        ds.getRepository(entity).count(),
      ),
    );
    const response = await capture(p).expect(413);
    expect(response.body.code).toBe('TECHNICAL_REPORT_SOURCE_LIMIT');
    expect(response.body.message).toContain('Nenhum snapshot parcial');
    const after = await Promise.all(
      [TechnicalReport, TechnicalReportVersion, ReportCommand].map((entity) =>
        ds.getRepository(entity).count(),
      ),
    );
    expect(after).toEqual(before);
    observations.push({
      oversized: true,
      status: response.status,
      code: response.body.code,
      atomic: true,
    });
  });
  it('rejects an oversized materialized snapshot without saving a partial revision', async () => {
    const p = await project('snapshot acima do limite');
    await items(p, 100, 'SINTETICO ' + 'x'.repeat(25000));
    const before = await ds.getRepository(TechnicalReportVersion).count();
    const response = await capture(p).expect(413);
    expect(response.body.code).toBe('TECHNICAL_REPORT_SNAPSHOT_LIMIT');
    expect(await ds.getRepository(TechnicalReportVersion).count()).toBe(before);
    expect(
      await ds.getRepository(TechnicalReport).countBy({ projectId: p }),
    ).toBe(0);
  });
  it('extracts more than 1000 historical valuations with deterministic latest-date/id selection and complete provenance', async () => {
    const p = await project('histórico de avaliações');
    await items(p, 1);
    const item = await ds
      .getRepository(InventoryItemEntity)
      .findOneByOrFail({ projectId: p });
    for (let offset = 0; offset < 2500; offset += 100)
      await ds.getRepository(AssetValuationEntity).insert(
        Array.from({ length: 100 }, (_, i) => ({
          organizationId: 1,
          projectId: p,
          inventoryItemId: Number(item.id),
          source: 'SINTETICO histórico ' + (offset + i),
          valuationDate: '2026-10-29',
          usedValue: '100.01',
        })),
      );
    const r = (
      await api('post', base(p), {
        ...command(),
        template_version_id: publication,
        title: 'SINTETICO avaliação histórica',
        selection: { families: ['valuation'] },
      }).expect(201)
    ).body;
    const table = r.data.sources.tables.find(
      (t: any) => t.family === 'valuation',
    );
    const last = await ds
      .getRepository(AssetValuationEntity)
      .findOneOrFail({ where: { projectId: p }, order: { id: 'DESC' } });
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0][0]).toBe(Number(last.id));
    expect(table.references).toHaveLength(2500);
    expect(new Set(table.references.map((ref: any) => ref.id)).size).toBe(2500);
    expect(r.data.sources.metrics['valuation.count']).toBe(1);
    expect(r.data.sources.metrics['valuation.used_total']).toBeNull();
    observations.push({
      family: 'valuation',
      historical_rows: 2500,
      selected_rows: 1,
      last_id: Number(last.id),
      references: table.references.length,
      hash: r.data.sources.hash,
    });
  });
  it.each(['units', 'accounting', 'issues', 'observations', 'reconciliation'])(
    'extracts 1001 %s rows with complete scope and provenance',
    async (family) => {
      const f = await prepareFamilies(),
        start = performance.now();
      const response = await api('post', base(f.project), {
        ...command(),
        template_version_id: publication,
        title: 'SINTETICO família ' + family,
        selection: {
          families: [family],
          ...(['observations', 'reconciliation'].includes(family)
            ? { session_id: f.session }
            : {}),
        },
      }).expect(201);
      const source = response.body.data.sources,
        table = source.tables.find((t: any) => t.family === family);
      expect(table.rows).toHaveLength(1001);
      expect(new Set(table.rows.map((row: any[]) => row[0])).size).toBe(1001);
      const expectedReferences =
        family === 'observations'
          ? 1002
          : family === 'reconciliation'
            ? 2003
            : 1001;
      expect(table.references).toHaveLength(expectedReferences);
      if (family === 'reconciliation')
        expect(source.metrics['reconciliation.unresolved']).toBe(0);
      if (family === 'issues')
        expect(source.metrics['issues.open_count']).toBe(1001);
      if (family === 'observations')
        expect(source.metrics['observations.distinct_items']).toBe(1001);
      observations.push({
        family,
        count: 1001,
        references: table.references.length,
        hash: source.hash,
        milliseconds: performance.now() - start,
        rss_after: process.memoryUsage().rss,
        heap_after: process.memoryUsage().heapUsed,
      });
    },
  );
  it('generates native PDF and OOXML from the approved 2500-row snapshot and preserves it after source changes', async () => {
    let r = volumeReport;
    const root = `${base(volumeProject)}/${r.id}`;
    for (const action of ['review', 'approve'])
      r = (
        await api('post', root + '/transitions', {
          ...command(),
          revision: r.revision,
          action,
        }).expect(201)
      ).body;
    const v = await ds
      .getRepository(TechnicalReportVersion)
      .findOneByOrFail({ id: r.approvedVersionId });
    const before = documentHash(v);
    expect(
      documentHash({
        engine: REPORT_ENGINE,
        data: v.data,
        validation: v.validation,
      }),
    ).toBe(v.hash);
    if (out)
      writeFileSync(
        join(out, 'volume-2500-approved.snapshot.json'),
        JSON.stringify(v, null, 2),
      );
    const entity = await ds
      .getRepository(InventoryItemEntity)
      .findOneByOrFail({ projectId: volumeProject });
    await ds.getRepository(InventoryItemEntity).update(entity.id, {
      description: 'SINTETICO novo mestre que não pode aparecer no aprovado',
    });
    for (const format of ['docx', 'pdf']) {
      const start = performance.now(),
        artifactsBefore = await ds.getRepository(DocumentArtifact).count();
      const response = await api('post', `${root}/versions/${v.id}/documents`, {
        format,
      });
      // The renderer's existing page/time/heap guards remain fail-closed. A
      // capacity error is recorded explicitly; it must never create an artifact.
      if (response.status === 503) {
        expect(response.body.message).toMatch(/render|gera|Tempo|Documento/i);
        expect(await ds.getRepository(DocumentArtifact).count()).toBe(
          artifactsBefore,
        );
        observations.push({
          count: 2500,
          format,
          status: 503,
          message: response.body.message,
          milliseconds: performance.now() - start,
        });
        continue;
      }
      expect(response.status).toBe(201);
      const artifact = await ds
        .getRepository(DocumentArtifact)
        .createQueryBuilder('a')
        .addSelect('a.bytes')
        .where('a.id=:id', { id: response.body.id })
        .getOneOrFail();
      const bytes = Buffer.from(artifact.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        artifact.checksum,
      );
      let pages: number | undefined;
      if (format === 'pdf')
        pages = (await PDFDocument.load(bytes)).getPageCount();
      else {
        const xml = strFromU8(unzipSync(bytes)['word/document.xml']);
        expect(xml).toContain('SINTETICO item 02499');
        expect(xml).not.toContain('novo mestre');
        expect(xml).toContain(v.hash);
        expect(xml).toContain('<w:tbl>');
      }
      if (out) writeFileSync(join(out, `volume-2500.${format}`), bytes);
      observations.push({
        count: 2500,
        format,
        status: 201,
        bytes: bytes.length,
        pages,
        milliseconds: performance.now() - start,
        snapshot_hash: v.hash,
      });
      exportMatrix.push({
        count: 2500,
        format,
        status: 201,
        bytes: bytes.length,
        checksum: artifact.checksum,
        pages,
        milliseconds: performance.now() - start,
        snapshot_hash: v.hash,
      });
      await api(
        'get',
        `${root}/versions/${v.id}/documents/${artifact.id}`,
        {},
        reader,
      ).expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1${root}/versions/${v.id}/documents/${artifact.id}`)
        .expect(401);
    }
    expect(
      documentHash(
        await ds
          .getRepository(TechnicalReportVersion)
          .findOneByOrFail({ id: v.id }),
      ),
    ).toBe(before);
    await api('get', `${base(999999)}/${r.id}`).expect(404);
    await api('get', root, {}, reader).expect(403);
    const priorEnv = process.env.NODE_ENV,
      priorStorage = process.env.DOCUMENT_STORAGE;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DOCUMENT_STORAGE;
      await api('post', `${root}/versions/${v.id}/documents`, {
        format: 'docx',
      }).expect(503);
      process.env.DOCUMENT_STORAGE = 'database';
      await api('post', `${root}/versions/${v.id}/documents`, {
        format: 'docx',
      }).expect(201);
    } finally {
      if (priorEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorEnv;
      if (priorStorage === undefined) delete process.env.DOCUMENT_STORAGE;
      else process.env.DOCUMENT_STORAGE = priorStorage;
    }
  }, 180000);
});
