import { fixturePasswords } from '../../fixtures/passwords';
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
        password: fixturePasswords.admin,
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
        password: fixturePasswords.admin,
      });
    const loginBody = login.body as unknown as LoginBody;

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
      .expect(200);
    const body = response.body as unknown as CurrentUserBody;

    expect(body.login).toBe('platform.admin');
    // a sessão web desliza com o uso: o /me informa a validade já estendida
    const extended = (body as unknown as { session_expires_at: string })
      .session_expires_at;
    expect(new Date(extended).getTime()).toBeGreaterThanOrEqual(
      new Date(
        (loginBody as unknown as { expires_at: string }).expires_at,
      ).getTime(),
    );
    expect(body.permissions).toEqual(
      expect.arrayContaining([{ key: 'projects:read', scope: 'ORGANIZATION' }]),
    );
  });

  it('login e GET /auth/me trazem o nome da organização do usuário', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'org.admin', password: fixturePasswords.orgAdmin })
      .expect(200);
    const loginBody = login.body as unknown as {
      access_token: string;
      user: { organization_name: string | null };
    };
    // nome fantasia tem prioridade sobre a razão social
    expect(loginBody.user.organization_name).toBe('GAI Test');
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
      .expect(200);
    expect(
      (me.body as { organization_name: string | null }).organization_name,
    ).toBe('GAI Test');
    // usuário da plataforma não tem organização
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'platform.admin', password: fixturePasswords.admin });
    expect(
      (admin.body as { user: { organization_name: string | null } }).user
        .organization_name,
    ).toBeNull();
  });

  it('POST /auth/logout invalidates session', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin',
        password: fixturePasswords.admin,
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
