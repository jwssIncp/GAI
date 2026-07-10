import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

describe('Organizations - Error flows (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let orgUserToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    adminToken = await loginAsAdmin(app);
    orgUserToken = await loginAsOrgUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /organizations returns 400 VALIDATION_ERROR for invalid CNPJ', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        legal_name: 'Invalid CNPJ Org',
        cnpj: '00000000000000',
      })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'cnpj' })]),
    );
  });

  it('POST /organizations returns 409 CONFLICT for duplicate CNPJ', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        legal_name: 'First Org',
        cnpj: '11444777000161',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        legal_name: 'Duplicate Org',
        cnpj: '11444777000161',
      })
      .expect(409);

    expect(response.body.code).toBe('CONFLICT');
    expect(response.body.message).toContain('CNPJ');
  });

  it('POST /organizations returns 403 FORBIDDEN for ORG_USER role', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${orgUserToken}`)
      .send({
        legal_name: 'Forbidden Org',
        cnpj: '07524515000198',
      })
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('POST /organizations/:id/deactivate returns 409 when already inactive', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        legal_name: 'Inactive Flow Org',
        cnpj: '19131243000197',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(response.body.code).toBe('CONFLICT');
    expect(response.body.message).toContain('inactive');
  });
});
