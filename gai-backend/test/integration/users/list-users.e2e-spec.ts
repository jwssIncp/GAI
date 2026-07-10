import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

describe('Users - List (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let orgToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    adminToken = await loginAsAdmin(app);
    orgToken = await loginAsOrgAdmin(app);
    userToken = await loginAsOrgUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('PLATFORM_ADMIN lists all users with role_assignments', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    expect(response.body.meta).toMatchObject({
      page: 1,
      page_size: 20,
    });
    expect(response.body.data[0]).toHaveProperty('role_assignments');
  });

  it('ORG_ADMIN lists only users from own organization', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${orgToken}`)
      .expect(200);

    for (const user of response.body.data) {
      expect(user.organization_id).toBe(1);
    }
    expect(
      response.body.data.some(
        (u: { login: string }) => u.login === 'platform.admin',
      ),
    ).toBe(false);
  });

  it('GET /users/:id returns user detail with role_assignments', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.login).toBe('platform.admin');
    expect(response.body.role_assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role_key: 'PLATFORM_ADMIN' }),
      ]),
    );
  });

  it('operational user without admin role receives 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});
