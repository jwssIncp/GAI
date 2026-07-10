import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

describe('Users - Role Assignments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let orgToken: string;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    adminToken = await loginAsAdmin(app);
    orgToken = await loginAsOrgAdmin(app);

    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        login: 'assign.target',
        email: 'assign@empresa.com.br',
        password: 'Senha@123456',
        organization_id: 1,
      })
      .expect(201);

    userId = created.body.id as number;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users/:userId/role-assignments assigns organization role', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/users/${userId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: 3 })
      .expect(201);

    expect(response.body.assignment_id).toBeDefined();
    expect(response.body.role_id).toBe(3);
    expect(response.body.role_name).toBe('Operador');
    expect(response.body.role_type).toBe('ORGANIZATION');
  });

  it('GET /users/:userId/role-assignments lists active assignments', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role_id: 3, role_name: 'Operador' }),
      ]),
    );
  });

  it('DELETE /users/:userId/role-assignments/:assignmentId revokes assignment', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const assignmentId = list.body[0].assignment_id as number;

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${userId}/role-assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(after.body).toEqual([]);
  });

  it('ORG_ADMIN cannot assign PLATFORM_ADMIN role', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/users/${userId}/role-assignments`)
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ role_id: 1 })
      .expect(409);
  });
});
