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

interface InventoryItemResponseBody {
  id: number;
}

interface PendingIssueResponseBody {
  id: number;
  status: string;
  type: string;
  title: string;
  resolved_by_id: number | null;
}

interface PendingIssueListResponseBody {
  items: PendingIssueResponseBody[];
  total_items: number;
}

describe('Inventory Pending Issues (e2e)', () => {
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

  it('creates, lists, resolves and generates pending issues', async () => {
    const project = await createProject('Pendencias patrimoniais');

    const inventoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/inventory-items`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ description: 'Notebook fisico', old_plate: 'FIS-001' })
      .expect(201);
    const inventoryItem = inventoryResponse.body as InventoryItemResponseBody;

    const createIssueResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/pending-issues`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        inventory_item_id: inventoryItem.id,
        type: 'manual_issue',
        title: 'Conferir etiqueta',
        severity: 'low',
      })
      .expect(201);
    const issue = createIssueResponse.body as PendingIssueResponseBody;
    expect(issue.status).toBe('open');

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/pending-issues/${issue.id}/resolve`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ resolution_notes: 'Etiqueta conferida' })
      .expect(200)
      .expect((response) => {
        const body = response.body as PendingIssueResponseBody;
        expect(body.status).toBe('resolved');
        expect(body.resolved_by_id).toEqual(expect.any(Number));
      });

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        placa: 'CONT-001',
        descricao_01: 'Notebook contabil',
        localizacao: 'Sala 1',
        valor_aquisicao: '100.00',
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Base');
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/accounting-imports`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .attach('file', buffer, 'base-contabil.xlsx')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/pending-issues/generate`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(201)
      .expect((response) => {
        const body = response.body as { created: number; skipped: number };
        expect(typeof body.created).toBe('number');
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${project.id}/pending-issues?type=accounting_item_not_found`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as PendingIssueListResponseBody;
        expect(body.total_items).toBeGreaterThanOrEqual(1);
        expect(body.items[0].type).toBe('accounting_item_not_found');
      });
  });
});
