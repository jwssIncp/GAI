import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
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

interface Item {
  id: number;
  plate: string | null;
  residual_value: string | null;
}

describe('Valor residual da base contábil (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsOrgAdmin(app);
  });
  afterAll(async () => {
    await app.close();
  });

  const xlsx = (rows: Record<string, unknown>[]) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      'Base',
    );
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  };
  const upload = (project: number, rows: Record<string, unknown>[]) =>
    request(app.getHttpServer())
      .post(`/api/v1/projects/${project}/accounting-imports`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', xlsx(rows), 'base.xlsx')
      .expect(201);
  const items = async (project: number) =>
    (
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${project}/inventory-accounting-items`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body.items as Item[];
  const summary = async (project: number) =>
    (
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${project}/summary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body.accounting as Record<string, unknown>;

  it('importa "Valor residual", preserva o valor numa reimportação sem a coluna e soma por situação', async () => {
    const project = (
      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ organization_id: 1, company_id: 1, name: 'Residual' })
        .expect(201)
    ).body.id as number;

    const batch = await upload(project, [
      { Placa: 'R-1', 'Valor residual': '100.10', 'Cód. Base': 'B1' },
      { Placa: 'R-2', 'Valor residual': '0.20', 'Cód. Base': 'B2' },
      { Placa: 'R-3', 'Valor residual': null, 'Cód. Base': 'B3' },
    ]);
    expect(batch.body.failed_rows).toBe(0);
    let rows = await items(project);
    const byPlate = (plate: string) => rows.find((r) => r.plate === plate)!;
    expect(byPlate('R1').residual_value).toBe('100.10');
    expect(byPlate('R2').residual_value).toBe('0.20');
    expect(byPlate('R3').residual_value).toBeNull();

    // Reimportação sem a coluna não apaga o valor já gravado.
    await upload(project, [
      { Placa: 'R-1', 'Cód. Base': 'B1', descricao_01: 'Atualizada' },
    ]);
    rows = await items(project);
    expect(byPlate('R1').residual_value).toBe('100.10');

    await upload(project, [
      { Placa: 'R-2', 'Cód. Base': 'B2', 'Valor residual': 'abc' },
    ]).then((r) => expect(r.body.failed_rows).toBe(1));

    let accounting = await summary(project);
    expect(accounting.total_residual_value).toBe('100.30');
    expect(accounting.residual_missing_items).toBe(1);
    expect(accounting.reconciled_residual_value).toBeNull();

    // Última execução: R-1 conciliado, R-2 sobra contábil.
    const ds = app.get(DataSource);
    const session = await ds.getRepository(InventorySessionEntity).save({
      organizationId: 1,
      projectId: project,
      name: 'Sessão residual',
    });
    await ds.getRepository(InventoryReconciliationEntity).save(
      [
        [byPlate('R1').id, ReconciliationStatus.MATCHED],
        [byPlate('R2').id, ReconciliationStatus.ACCOUNTING_SURPLUS],
        [byPlate('R3').id, ReconciliationStatus.ACCOUNTING_SURPLUS],
      ].map(([accountingItemId, status]) => ({
        organizationId: 1,
        projectId: project,
        sessionId: session.id,
        runNumber: 1,
        accountingItemId: Number(accountingItemId),
        status: status as ReconciliationStatus,
        evidence: {},
      })),
    );
    accounting = await summary(project);
    expect(accounting.reconciled_items).toBe(1);
    expect(accounting.reconciled_residual_value).toBe('100.10');
    expect(accounting.accounting_surplus_items).toBe(2);
    expect(accounting.accounting_surplus_residual_value).toBe('0.20');
  });
});
