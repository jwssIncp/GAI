import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface ProjectResponseBody {
  id: number;
  status: string;
}

interface InventoryItemResponseBody {
  id: number;
  organization_id: number;
  project_id: number;
  old_plate: string | null;
  new_plate: string | null;
  description: string | null;
  status: string;
  deleted_at: string | null;
}

interface InventoryItemListResponseBody {
  items: InventoryItemResponseBody[];
  page: number;
  page_size: number;
  total_items: number;
}

describe('Inventory Items (e2e)', () => {
  let app: INestApplication;
  let orgAdminToken: string;
  let orgUserToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    orgAdminToken = await loginAsOrgAdmin(app);
    orgUserToken = await loginAsOrgUser(app);
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

  it('creates, lists, updates, deactivates and reactivates an item inside a project', async () => {
    const project = await createProject('Inventario com itens');

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/inventory-items`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        description: 'Notebook Dell',
        old_plate: ' abc-123 ',
        new_plate: 'gai 0001',
        used_value: '1200.50',
        metadata: { row: 10 },
      })
      .expect(201);

    const created = createResponse.body as unknown as InventoryItemResponseBody;
    expect(created.organization_id).toBe(1);
    expect(created.project_id).toBe(project.id);
    expect(created.old_plate).toBe('ABC123');
    expect(created.new_plate).toBe('GAI0001');
    expect(created.status).toBe('pending');

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/inventory-items?search=dell`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as InventoryItemListResponseBody;
        expect(body.items).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: created.id })]),
        );
        expect(body.page).toBe(1);
        expect(body.page_size).toBe(20);
        expect(typeof body.total_items).toBe('number');
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${project.id}/inventory-items/${created.id}`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ description: 'Notebook Dell Latitude', status: 'evaluated' })
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as InventoryItemResponseBody;
        expect(body.description).toBe('Notebook Dell Latitude');
        expect(body.status).toBe('evaluated');
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${created.id}/deactivate`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as InventoryItemResponseBody;
        expect(body.status).toBe('inactive');
        expect(body.deleted_at).toEqual(expect.any(String));
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${created.id}/reactivate`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as InventoryItemResponseBody;
        expect(body.status).toBe('pending');
        expect(body.deleted_at).toBeNull();
      });
  });

  it('allows an operational user with inventory item permissions', async () => {
    const project = await createProject('Inventario operador');

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/inventory-items`)
      .set('Authorization', `Bearer ${orgUserToken}`)
      .expect(200);
  });

  it('blocks item mutations when project is finished', async () => {
    const project = await createProject('Inventario finalizado');

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/activate`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/finish`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/inventory-items`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ description: 'Nao deve criar' })
      .expect(409);
  });
});
