import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsAdmin, seedTestData } from '../test-app.helper';

describe('Organizations - List/Get (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let orgId: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsAdmin(app);

    const created = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legal_name: 'List Test Org',
        cnpj: '11444777000161',
      });
    orgId = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /organizations returns paginated list', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/organizations?page=1&page_size=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.page).toBe(1);
    expect(response.body.page_size).toBe(10);
    expect(response.body.total_items).toBeGreaterThan(0);
  });

  it('GET /organizations/:id returns organization', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.id).toBe(orgId);
  });

  it('GET /organizations/:id returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/organizations/999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
