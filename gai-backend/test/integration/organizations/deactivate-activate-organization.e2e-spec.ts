import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsAdmin, seedTestData } from '../test-app.helper';

describe('Organizations - Deactivate/Activate (e2e)', () => {
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
        legal_name: 'Lifecycle Test Org',
        cnpj: '11444777000161',
      });
    orgId = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('deactivates and reactivates organization', async () => {
    const deactivated = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(deactivated.body.status).toBe('INACTIVE');

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(activated.body.status).toBe('ACTIVE');
  });
});
