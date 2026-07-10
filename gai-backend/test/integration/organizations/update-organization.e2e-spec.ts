import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsAdmin, seedTestData } from '../test-app.helper';

describe('Organizations - Update (e2e)', () => {
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
        legal_name: 'Update Test Org',
        cnpj: '11444777000161',
      });
    orgId = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('PATCH /organizations/:id updates trade_name', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ trade_name: 'Updated Trade Name' })
      .expect(200);

    expect(response.body.trade_name).toBe('Updated Trade Name');
  });
});
