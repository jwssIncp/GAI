import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { InventoryAccountingItemEntity } from '../../../src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { ReconciliationStatus } from '../../../src/modules/inventory-operations/domain/inventory-operation.enums';
import {
  InventoryReconciliationEntity,
  InventorySessionEntity,
} from '../../../src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

describe('Exportações da conciliação e dos itens com avaliação (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsOrgAdmin(app);
  });
  afterAll(async () => {
    await app.close();
  });

  async function exportWorkbook(project: number, type: string) {
    const created = (
      await http()
        .post(`/api/v1/projects/${project}/export-jobs`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type })
        .expect(201)
    ).body as { id: number };
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const job = (
        await http()
          .get(`/api/v1/projects/${project}/export-jobs/${created.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      ).body as { status: string; error_code: string | null };
      if (job.status === 'failed')
        throw new Error(`Export failed: ${job.error_code}`);
      if (job.status === 'finished') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const file = await http()
      .get(`/api/v1/projects/${project}/export-jobs/${created.id}/download`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    return XLSX.read(file.body as Buffer, { type: 'buffer' });
  }
  const rowsOf = (workbook: XLSX.WorkBook, sheet: string) =>
    XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet]);

  it('exporta a última conciliação com uma aba por situação e o Resumo em valor residual', async () => {
    const project = (
      await http()
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ organization_id: 1, company_id: 1, name: 'Conciliação XLSX' })
        .expect(201)
    ).body.id as number;
    const empty = await exportWorkbook(project, 'reconciliation_xlsx');
    expect(rowsOf(empty, 'Resumo')[0]).toMatchObject({
      Situação: 'Nenhuma conciliação executada neste projeto',
    });

    const item = (
      await http()
        .post(`/api/v1/projects/${project}/inventory-items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ old_plate: 'C-1', description: 'Torno' })
        .expect(201)
    ).body.id as number;
    const ds = app.get(DataSource);
    const accounting = ds.getRepository(InventoryAccountingItemEntity);
    const [a1, a2] = await accounting.save([
      {
        organizationId: 1,
        projectId: project,
        plate: 'C1',
        description: 'Torno contábil',
        residualValue: '100.10',
      },
      {
        organizationId: 1,
        projectId: project,
        plate: 'C2',
        description: 'Software',
        residualValue: '0.20',
        surplusClassification: 'NPI - SOFTWARE',
      },
    ]);
    const session = await ds.getRepository(InventorySessionEntity).save({
      organizationId: 1,
      projectId: project,
      name: 'Sessão',
    });
    await ds.getRepository(InventoryReconciliationEntity).save([
      {
        organizationId: 1,
        projectId: project,
        sessionId: session.id,
        runNumber: 1,
        inventoryItemId: item,
        accountingItemId: a1.id,
        status: ReconciliationStatus.MATCHED,
        physicalPlate: 'C1',
        accountingPlate: 'C1',
        evidence: {},
      },
      {
        organizationId: 1,
        projectId: project,
        sessionId: session.id,
        runNumber: 1,
        accountingItemId: a2.id,
        status: ReconciliationStatus.ACCOUNTING_SURPLUS,
        accountingPlate: 'C2',
        evidence: {},
      },
    ]);

    const workbook = await exportWorkbook(project, 'reconciliation_xlsx');
    expect(workbook.SheetNames).toEqual([
      'Conciliados',
      'Divergência de placa',
      'Sobra física',
      'Só na contabilidade',
      'Duplicidades',
      'Resumo',
    ]);
    expect(rowsOf(workbook, 'Conciliados')[0]).toMatchObject({
      Situação: 'Conciliado',
      'Descrição física': 'Torno',
      'Descrição contábil': 'Torno contábil',
      'Valor residual': 100.1,
    });
    expect(rowsOf(workbook, 'Só na contabilidade')[0]).toMatchObject({
      'Classificação da sobra': 'NPI - SOFTWARE',
      'Valor residual': 0.2,
    });
    const summary = rowsOf(workbook, 'Resumo');
    expect(summary).toContainEqual(
      expect.objectContaining({ Situação: 'Conciliado', Quantidade: 1 }),
    );
    expect(summary).toContainEqual(
      expect.objectContaining({ Situação: 'Total', Quantidade: 2 }),
    );
  });

  it('exporta os itens com as colunas da avaliação mais recente', async () => {
    const project = (
      await http()
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ organization_id: 1, company_id: 1, name: 'Itens avaliados' })
        .expect(201)
    ).body.id as number;
    const item = (
      await http()
        .post(`/api/v1/projects/${project}/inventory-items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ old_plate: 'V-1', description: 'Compressor' })
        .expect(201)
    ).body.id as number;
    for (const [valuation_date, used_value] of [
      ['2026-01-01', '10.00'],
      ['2026-02-01', '25.50'],
    ])
      await http()
        .post(`/api/v1/projects/${project}/inventory-items/${item}/valuations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ source: 'Cotação', valuation_date, used_value })
        .expect(201);
    const workbook = await exportWorkbook(
      project,
      'inventory_items_valuation_xlsx',
    );
    expect(rowsOf(workbook, 'Itens inventariados')[0]).toMatchObject({
      'Placa antiga': 'V-1',
      'Avaliação: fonte de consulta': 'Cotação',
      'Avaliação: valor usado': 25.5,
    });
  });
});
