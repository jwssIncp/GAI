import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedTestData } from '../test-app.helper';

interface CurrentUserBody {
  login: string;
  role_assignments: Array<{ role_key: string | null }>;
  permissions: Array<{ key: string; scope: string }>;
}

interface LoginBody {
  access_token: string;
  user: CurrentUserBody;
}

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
    const body = response.body as unknown as LoginBody;

    expect(body.access_token).toBeDefined();
    expect(body.user.role_assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role_key: 'PLATFORM_ADMIN' }),
      ]),
    );
    expect(body.user.permissions).toEqual(
      expect.arrayContaining([
        { key: 'projects:activate', scope: 'ORGANIZATION' },
        { key: 'projects:finish', scope: 'ORGANIZATION' },
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
    const loginBody = login.body as unknown as LoginBody;

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
      .expect(200);
    const body = response.body as unknown as CurrentUserBody;

    expect(body.login).toBe('platform.admin');
    expect(body.permissions).toEqual(
      expect.arrayContaining([{ key: 'projects:read', scope: 'ORGANIZATION' }]),
    );
  });

  it('POST /auth/logout invalidates session', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin',
        password: 'Admin@123456',
      });
    const loginBody = login.body as unknown as LoginBody;

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
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
