import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { InventoryAccountingItemEntity } from '../../../src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

interface Item {
  id: number;
  plate: string | null;
  surplus_classification: string | null;
}

describe('Classificação da sobra contábil (e2e)', () => {
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

  it('classifica em lote, limpa, rejeita conciliados e preserva na reimportação', async () => {
    const http = () => request(app.getHttpServer());
    const project = (
      await http()
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ organization_id: 1, company_id: 1, name: 'Sobra' })
        .expect(201)
    ).body.id as number;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        { placa: 'S-1', cod_base: 'B1' },
        { placa: 'S-2', cod_base: 'B2' },
        { placa: 'S-3', cod_base: 'B3' },
      ]),
      'Base',
    );
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;
    const upload = () =>
      http()
        .post(`/api/v1/projects/${project}/accounting-imports`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buffer, 'base.xlsx')
        .expect(201);
    await upload();
    const list = async () =>
      (
        await http()
          .get(`/api/v1/projects/${project}/inventory-accounting-items`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      ).body.items as Item[];
    const byPlate = (rows: Item[], plate: string) =>
      rows.find((r) => r.plate === plate)!;
    let rows = await list();
    const url = `/api/v1/projects/${project}/inventory-accounting-items/classification`;

    await http()
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ids: [byPlate(rows, 'S1').id, byPlate(rows, 'S2').id],
        classification: ' NPI - SOFTWARE ',
      })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual({ updated: 2, classification: 'NPI - SOFTWARE' }),
      );
    rows = await list();
    expect(byPlate(rows, 'S1').surplus_classification).toBe('NPI - SOFTWARE');
    expect(byPlate(rows, 'S3').surplus_classification).toBeNull();

    // Reimportar a base não apaga a classificação manual.
    await upload();
    rows = await list();
    expect(byPlate(rows, 'S2').surplus_classification).toBe('NPI - SOFTWARE');

    // Limpar.
    await http()
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [byPlate(rows, 'S2').id], classification: null })
      .expect(200);
    rows = await list();
    expect(byPlate(rows, 'S2').surplus_classification).toBeNull();

    // Conciliado não recebe classificação; nada é gravado no lote.
    await app
      .get(DataSource)
      .getRepository(InventoryAccountingItemEntity)
      .update(byPlate(rows, 'S3').id, { status: 'matched' as never });
    await http()
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ids: [byPlate(rows, 'S2').id, byPlate(rows, 'S3').id],
        classification: 'ABRIR NF',
      })
      .expect(409);
    rows = await list();
    expect(byPlate(rows, 'S2').surplus_classification).toBeNull();

    // Validação: lista vazia, texto longo e item de outro projeto.
    await http()
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [], classification: 'ABRIR NF' })
      .expect(400);
    await http()
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [byPlate(rows, 'S1').id], classification: 'x'.repeat(121) })
      .expect(400);
    await http()
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [999999], classification: 'ABRIR NF' })
      .expect(404);
  });
});
