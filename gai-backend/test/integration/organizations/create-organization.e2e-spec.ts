import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsAdmin, seedTestData } from '../test-app.helper';

describe('Organizations - Create (e2e)', () => {
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

  it('POST /organizations creates organization with valid CNPJ', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legal_name: 'Empresa Teste LTDA',
        trade_name: 'Empresa Teste',
        cnpj: '11444777000161',
        contact_email: 'contato@empresa.test',
        contact_phone: '11988887777',
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.cnpj).toBe('11444777000161');
    expect(response.body.status).toBe('ACTIVE');
  });

  it('POST /organizations returns 409 for duplicate CNPJ', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        legal_name: 'Duplicate Org',
        cnpj: '11444777000161',
      })
      .expect(409);
  });

  it('POST /organizations returns 401 without token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send({ legal_name: 'No Auth', cnpj: '11222333000181' })
      .expect(401);
  });
});
