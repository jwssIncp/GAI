import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

describe('Users - Create (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let orgToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    adminToken = await loginAsAdmin(app);
    orgToken = await loginAsOrgAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users creates profile-only user without role_assignments', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        login: 'novo.usuario',
        email: 'novo@empresa.com.br',
        password: 'Senha@123456',
        organization_id: 1,
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(typeof response.body.id).toBe('number');
    expect(response.body.login).toBe('novo.usuario');
    expect(response.body.organization_id).toBe(1);
    expect(response.body.role_assignments).toEqual([]);
  });

  it('ORG_ADMIN creates user scoped to own organization', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({
        login: 'org.scoped',
        email: 'scoped@empresa.com.br',
        password: 'Senha@123456',
      })
      .expect(201);

    expect(response.body.organization_id).toBe(1);
  });

  it('POST /users returns 401 without token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({
        login: 'no.auth',
        email: 'noauth@test.com',
        password: 'Senha@123456',
      })
      .expect(401);
  });
});
