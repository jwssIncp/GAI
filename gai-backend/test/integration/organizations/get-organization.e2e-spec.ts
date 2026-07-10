import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsAdmin, seedTestData } from '../test-app.helper';

describe('Organizations - Get by id (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /organizations/:id returns seeded organization from list', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const org = list.body.items.find(
      (item: { cnpj: string }) => item.cnpj === '11222333000181',
    );
    expect(org).toBeDefined();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${org.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.cnpj).toBe('11222333000181');
  });
});
