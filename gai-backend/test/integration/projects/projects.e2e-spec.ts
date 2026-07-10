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
  organization_id: number;
  company_id: number | null;
  name: string;
  status: string;
  created_by_id: number | null;
  finished_at: string | null;
}

interface ProjectListResponseBody {
  items: ProjectResponseBody[];
  page: number;
  page_size: number;
  total_items: number;
}

describe('Projects (e2e)', () => {
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

  it('creates, lists, updates and finishes a project inside the organization scope', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Inventario Matriz',
        description: 'Primeiro inventario operacional',
        start_date: '2026-07-07',
        end_date: '2026-07-31',
        settings: { allow_images: true },
        metadata: { source: 'e2e' },
      })
      .expect(201);

    const createdProject =
      createResponse.body as unknown as ProjectResponseBody;

    expect(createdProject.organization_id).toBe(1);
    expect(createdProject.company_id).toBe(1);
    expect(createdProject.name).toBe('Inventario Matriz');
    expect(createdProject.status).toBe('draft');
    expect(typeof createdProject.created_by_id).toBe('number');

    const projectId = createdProject.id;

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    const projectList = listResponse.body as unknown as ProjectListResponseBody;

    expect(projectList.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectId })]),
    );
    expect(projectList.page).toBe(1);
    expect(projectList.page_size).toBe(20);
    expect(typeof projectList.total_items).toBe('number');

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ name: 'Inventario Matriz Atualizado' })
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ProjectResponseBody;
        expect(body.name).toBe('Inventario Matriz Atualizado');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/finish`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ProjectResponseBody;
        expect(body.status).toBe('finished');
        expect(body.finished_at).toEqual(expect.any(String));
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ name: 'Nao deve alterar' })
      .expect(409);
  });

  it('allows an operational user with projects permissions', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${orgUserToken}`)
      .expect(200);
  });

  it('rejects invalid date ranges', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Datas invalidas',
        start_date: '2026-08-10',
        end_date: '2026-08-01',
      })
      .expect(400);
  });
});
