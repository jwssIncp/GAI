import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as XLSX from 'xlsx';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

interface ProjectResponseBody {
  id: number;
}

interface AccountingImportBatchResponseBody {
  id: number;
  status: string;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
}

interface AccountingItemListResponseBody {
  items: Array<{
    id: number;
    plate: string | null;
    description: string | null;
    acquisition_value: string | null;
  }>;
  total_items: number;
}

describe('Inventory Accounting Items (e2e)', () => {
  let app: INestApplication;
  let orgAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    orgAdminToken = await loginAsOrgAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createProject(name: string): Promise<ProjectResponseBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ organization_id: 1, company_id: 1, name })
      .expect(201);
    return response.body as ProjectResponseBody;
  }

  it('imports XLSX accounting items and lists normalized rows', async () => {
    const project = await createProject('Base contabil importada');
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        placa: ' abc-123 ',
        descricao_01: ' Notebook Dell ',
        descricao_conta_contabil: ' Equipamentos ',
        localizacao: ' Sala 1 ',
        data_aquisicao: '2024-01-15',
        valor_aquisicao: '1234.50',
        cod_base: 'BASE-1',
        status: 'pending',
        codigo_investor: 'INV-1',
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Base');
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const importResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/accounting-imports`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .attach('file', buffer, 'base-contabil.xlsx')
      .expect(201);

    const batch = importResponse.body as AccountingImportBatchResponseBody;
    expect(batch.status).toBe('finished');
    expect(batch.total_rows).toBe(1);
    expect(batch.success_rows).toBe(1);
    expect(batch.failed_rows).toBe(0);

    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${project.id}/inventory-accounting-items?plate=abc-123`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as AccountingItemListResponseBody;
        expect(body.total_items).toBe(1);
        expect(body.items[0]).toEqual(
          expect.objectContaining({
            plate: 'ABC123',
            description: 'Notebook Dell',
            acquisition_value: '1234.50',
          }),
        );
      });
    const list = await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/inventory-accounting-items`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);
    const id = (list.body as AccountingItemListResponseBody).items[0].id;
    const itemUrl = `/api/v1/projects/${project.id}/inventory-accounting-items/${id}`;
    for (const acquisition_date of ['2026-02-30', '0999-01-01', '']) {
      await request(app.getHttpServer())
        .patch(itemUrl)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ acquisition_date })
        .expect(400);
      await request(app.getHttpServer())
        .get(itemUrl)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(200)
        .expect((response) =>
          expect(response.body.acquisition_date).toBe('2024-01-15'),
        );
    }
    const invalidWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      invalidWorkbook,
      XLSX.utils.json_to_sheet(
        ['2026-02-30', '0999-01-01', '2026-13-01'].map(
          (data_aquisicao, index) => ({
            placa: `INVALID${index}`,
            data_aquisicao,
          }),
        ),
      ),
      'Invalid dates',
    );
    const invalidBuffer = XLSX.write(invalidWorkbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/accounting-imports`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .attach('file', invalidBuffer, 'invalid-dates.xlsx')
      .expect(201)
      .expect((response) => {
        expect(response.body.success_rows).toBe(0);
        expect(response.body.failed_rows).toBe(3);
      });
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/inventory-accounting-items`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => expect(response.body.total_items).toBe(1));
  });
});
