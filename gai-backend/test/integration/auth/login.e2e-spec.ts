import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedTestData } from '../test-app.helper';

describe('Auth - Login/Logout/Me (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login returns token for valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin',
        password: 'Admin@123456',
      })
      .expect(200);

    expect(response.body.access_token).toBeDefined();
    expect(response.body.user.role_assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role_key: 'PLATFORM_ADMIN' }),
      ]),
    );
  });

  it('GET /auth/me returns current user with valid token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin',
        password: 'Admin@123456',
      });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .expect(200);

    expect(response.body.login).toBe('platform.admin');
  });

  it('POST /auth/logout invalidates session', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin',
        password: 'Admin@123456',
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .expect(401);
  });

  it('POST /auth/login returns 401 for invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin',
        password: 'WrongPassword1!',
      })
      .expect(401);
  });
});
