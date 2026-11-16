import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { AuthAuditLogEntity } from '../../../src/modules/auth/infrastructure/persistence/auth-audit-log.entity';

// Expiração LIGADA só neste arquivo (o padrão é sem expiração).
describe('Inventariante: senha temporária com expiração configurada', () => {
  const previous = process.env.FIELD_AGENT_TEMPORARY_PASSWORD_TTL_HOURS;
  let app: INestApplication, db: DataSource, admin: string;
  let agentId: number, userId: number, password: string;
  const api = () => request(app.getHttpServer());
  const post = (path: string, body?: object) =>
    api()
      .post('/api/v1' + path)
      .set({ Authorization: `Bearer ${admin}` })
      .send(body ?? {});
  const webLogin = (identifier: string, secret: string) =>
    api().post('/api/v1/auth/login').send({ identifier, password: secret });
  const mobileLogin = (identifier: string, secret: string) =>
    api()
      .post('/api/v1/mobile/auth/login')
      .send({ identifier, password: secret, device_label: 'SINTETICO' });
  const expire = () =>
    db.getRepository(UserEntity).update(userId, {
      temporaryPasswordExpiresAt: new Date(Date.now() - 1000),
    });

  beforeAll(async () => {
    process.env.FIELD_AGENT_TEMPORARY_PASSWORD_TTL_HOURS = '2';
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    const projectId = (
      await post('/projects', {
        name: 'SINTETICO Projeto expiração',
        organization_id: 1,
        company_id: 1,
      }).expect(201)
    ).body.id as number;
    agentId = (
      await post('/field-agents', { name: 'SINTETICO Campo expira' }).expect(
        201,
      )
    ).body.id as number;
    await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: agentId,
    }).expect(201);
  }, 300000);
  afterAll(async () => {
    if (previous === undefined)
      delete process.env.FIELD_AGENT_TEMPORARY_PASSWORD_TTL_HOURS;
    else process.env.FIELD_AGENT_TEMPORARY_PASSWORD_TTL_HOURS = previous;
    if (app) await app.close();
  });

  it('emite com validade configurada; os demais usuários seguem com a validade geral', async () => {
    const created = await post(
      `/field-agents/${agentId}/access/temporary-password`,
      { login: 'campo.expira' },
    ).expect(201);
    password = created.body.temporary_password as string;
    userId = created.body.linked_user.id as number;
    const expiresAt = new Date(
      created.body.temporary_password_expires_at as string,
    ).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now() + 1.9 * 3600000);
    expect(expiresAt).toBeLessThan(Date.now() + 2.1 * 3600000);
  });

  it('login web: senha correta e vencida = 403 TEMPORARY_PASSWORD_EXPIRED; senha errada = 401 genérico', async () => {
    await expire();
    await webLogin('campo.expira', 'SINTETICO senha errada')
      .expect(401)
      .expect((r) => expect(r.body.code).toBe('UNAUTHORIZED'));
    await webLogin('campo.expira', password)
      .expect(403)
      .expect((r) => expect(r.body.code).toBe('TEMPORARY_PASSWORD_EXPIRED'));
    const audit = await db.getRepository(AuthAuditLogEntity).findBy({ userId });
    expect(
      audit.some(
        (a) =>
          (a.metadata as { reason?: string } | null)?.reason ===
          'temporary_password_expired',
      ),
    ).toBe(true);
  });

  it('login do app: mesmo código; refresh também recusa com TEMPORARY_PASSWORD_EXPIRED', async () => {
    await mobileLogin('campo.expira', password)
      .expect(403)
      .expect((r) => expect(r.body.code).toBe('TEMPORARY_PASSWORD_EXPIRED'));
    await mobileLogin('campo.expira', 'SINTETICO senha errada').expect(401);

    const reset = await post(
      `/field-agents/${agentId}/access/temporary-password/reset`,
    ).expect(200);
    password = reset.body.temporary_password as string;
    const tokens = await mobileLogin('campo.expira', password).expect(200);
    expect(tokens.body.user.must_change_password).toBe(true);
    await expire();
    await api()
      .post('/api/v1/mobile/auth/refresh')
      .send({ refresh_token: tokens.body.refresh_token })
      .expect(403)
      .expect((r) => expect(r.body.code).toBe('TEMPORARY_PASSWORD_EXPIRED'));
    // A família foi encerrada: repetir o refresh não reabre nada.
    await api()
      .post('/api/v1/mobile/auth/refresh')
      .send({ refresh_token: tokens.body.refresh_token })
      .expect(401);
  });
});
