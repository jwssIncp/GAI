import { INestApplication } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { SessionEntity } from '../../../src/modules/auth/infrastructure/persistence/session.entity';
import { MobileRefreshTokenEntity } from '../../../src/modules/auth/infrastructure/persistence/mobile-refresh-token.entity';
import { AuthAuditLogEntity } from '../../../src/modules/auth/infrastructure/persistence/auth-audit-log.entity';
import { UserAuditLogEntity } from '../../../src/modules/users/infrastructure/persistence/user-audit-log.entity';
import { FieldAgentAuditLogEntity } from '../../../src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity';
import { EMAIL_SENDER } from '../../../src/modules/auth/domain/ports/email-sender.port';
import { MockEmailSender } from '../../../src/modules/auth/infrastructure/email/ses-email.sender';

// Senha gerada: 12 caracteres, sem 0/O/1/l/I.
const GENERATED = /^[A-HJ-NP-Za-km-z2-9]{12}$/;

interface Issued {
  field_agent_id: number;
  linked_user: { id: number; login: string; email: string | null };
  access: { status: string; temporary_password_issued_at: string | null };
  temporary_password_expires_at: string | null;
  temporary_password: string;
}

describe('Inventariante: acesso com senha temporária', () => {
  let app: INestApplication, db: DataSource;
  let admin: string, platform: string, orgUser: string, projectId: number;
  let serial = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const post = (path: string, body?: object, token = admin) =>
    api()
      .post('/api/v1' + path)
      .set(bearer(token))
      .send(body ?? {});
  const get = (path: string, token = admin) =>
    api()
      .get('/api/v1' + path)
      .set(bearer(token));
  const agent = async () =>
    (
      await post('/field-agents', {
        name: `SINTETICO Campo Temporário ${++serial}`,
      }).expect(201)
    ).body as { id: number };
  const issue = async (login?: string, email?: string) => {
    const a = await agent();
    const res = await post(`/field-agents/${a.id}/access/temporary-password`, {
      login: login ?? `campo.temp${serial}`,
      ...(email !== undefined ? { email } : {}),
    }).expect(201);
    return { agentId: a.id, res, body: res.body as Issued };
  };
  const webLogin = (identifier: string, password: string) =>
    api().post('/api/v1/auth/login').send({ identifier, password });
  const mobileLogin = (identifier: string, password: string) =>
    api()
      .post('/api/v1/mobile/auth/login')
      .send({ identifier, password, device_label: 'SINTETICO Android' });
  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    platform = await loginAsAdmin(app);
    orgUser = await loginAsOrgUser(app);
    projectId = (
      await post('/projects', {
        name: 'SINTETICO Projeto de campo',
        organization_id: 1,
        company_id: 1,
      }).expect(201)
    ).body.id as number;
  }, 300000);
  afterAll(async () => {
    if (app) await app.close();
  });

  it('cria acesso sem e-mail: senha gerada uma vez, sem cache, troca obrigatória e sem expiração por padrão', async () => {
    const { agentId, res, body } = await issue('campo.sem.email');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(body.temporary_password).toMatch(GENERATED);
    expect(body.temporary_password_expires_at).toBeNull();
    expect(body.linked_user.email).toBeNull();
    expect(body.access.status).toBe('AWAITING_FIRST_ACCESS');
    expect(body.access.temporary_password_issued_at).toEqual(
      expect.any(String),
    );
    const user = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ id: body.linked_user.id });
    expect(user).toMatchObject({
      email: null,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: null,
    });
    // Auditoria registra o fato, nunca o valor.
    const audit = await db
      .getRepository(UserAuditLogEntity)
      .findBy({ userId: user.id, operation: 'TEMPORARY_PASSWORD_ISSUED' });
    expect(audit).toHaveLength(1);
    const dump = JSON.stringify([
      await db.getRepository(UserAuditLogEntity).find(),
      await db.getRepository(FieldAgentAuditLogEntity).find(),
      await db.getRepository(AuthAuditLogEntity).find(),
    ]);
    expect(dump).not.toContain(body.temporary_password);
    expect(user.passwordHash).not.toContain(body.temporary_password);

    // Detalhe e lista mostram a situação, sem a senha.
    const detail = await get(`/field-agents/${agentId}`).expect(200);
    expect(detail.body.access).toEqual(body.access);
    expect(detail.body.linked_user.email).toBeNull();
    expect(JSON.stringify(detail.body)).not.toContain(body.temporary_password);
    const list = await get('/field-agents?page_size=100').expect(200);
    const item = list.body.items.find((i: { id: number }) => i.id === agentId);
    expect(item.access).toEqual(body.access);
    expect(JSON.stringify(list.body)).not.toContain(body.temporary_password);
    const none = list.body.items.find(
      (i: { user_id: number | null }) => i.user_id === null,
    );
    if (none)
      expect(none.access).toEqual({
        status: 'NONE',
        temporary_password_issued_at: null,
      });

    // 1º acesso: entra, mas só pode trocar a senha.
    const session = await webLogin(
      'campo.sem.email',
      body.temporary_password,
    ).expect(200);
    expect(session.body.user.must_change_password).toBe(true);
    await get('/projects', session.body.access_token)
      .expect(403)
      .expect((r) => expect(r.body.code).toBe('PASSWORD_CHANGE_REQUIRED'));
    await post(
      '/auth/password/change',
      {
        current_password: body.temporary_password,
        new_password: 'SINTETICO senha própria do campo 2026',
      },
      session.body.access_token,
    ).expect(200);
    await webLogin(
      'campo.sem.email',
      'SINTETICO senha própria do campo 2026',
    ).expect(200);
    expect(
      (await get(`/field-agents/${agentId}`).expect(200)).body.access,
    ).toEqual({ status: 'ACTIVE', temporary_password_issued_at: null });
  });

  it('valida login, e-mail opcional, duplicidade e conta já existente', async () => {
    const a = await agent();
    const path = `/field-agents/${a.id}/access/temporary-password`;
    await post(path, { login: 'com @' }).expect(400);
    await post(path, {
      login: 'campo.email.ruim',
      email: 'nao-e-email',
    }).expect(400);
    await post(path, { login: 'org.admin' }).expect(409);
    const ok = await post(path, {
      login: 'campo.com.email',
      email: 'Campo.Com.Email@Example.invalid',
      // Campo extra é ignorado/recusado: a senha nunca vem do cliente.
    }).expect(201);
    expect(ok.body.linked_user.email).toBe('campo.com.email@example.invalid');
    await post(path, { login: 'campo.outro' })
      .expect(409)
      .expect((r) =>
        expect(r.body.message).toContain('Redefinir senha temporária'),
      );
    const b = await agent();
    await post(`/field-agents/${b.id}/access/temporary-password`, {
      login: 'campo.email.repetido',
      email: 'campo.com.email@example.invalid',
    }).expect(409);
    await post(`/field-agents/${b.id}/access/temporary-password`, {
      login: 'campo.email.vazio',
      email: '',
    }).expect(201);
  });

  it('só o administrador da organização emite, redefine ou revoga', async () => {
    const a = await agent();
    for (const token of [platform, orgUser]) {
      await post(
        `/field-agents/${a.id}/access/temporary-password`,
        { login: 'campo.proibido' },
        token,
      ).expect((r) => expect([403, 404]).toContain(r.status));
      await post(
        `/field-agents/${a.id}/access/temporary-password/reset`,
        {},
        token,
      ).expect((r) => expect([403, 404]).toContain(r.status));
      await post(`/field-agents/${a.id}/access/revoke`, {}, token).expect((r) =>
        expect([403, 404]).toContain(r.status),
      );
    }
    expect(
      await db.getRepository(UserEntity).countBy({ login: 'campo.proibido' }),
    ).toBe(0);
    await post(`/field-agents/${a.id}/access/temporary-password/reset`).expect(
      409,
    );
    await post(`/field-agents/${a.id}/access/revoke`).expect(409);
  });

  it('redefinir: nova senha uma vez, encerra sessões web e do app e refresh tokens', async () => {
    const { agentId, body } = await issue('campo.redefinir');
    await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: agentId,
    }).expect(201);
    const web = await webLogin(
      'campo.redefinir',
      body.temporary_password,
    ).expect(200);
    const app1 = await mobileLogin(
      'campo.redefinir',
      body.temporary_password,
    ).expect(200);
    const reset = await post(
      `/field-agents/${agentId}/access/temporary-password/reset`,
    ).expect(200);
    expect(reset.headers['cache-control']).toBe('no-store');
    const next = reset.body as Issued;
    expect(next.temporary_password).toMatch(GENERATED);
    expect(next.temporary_password).not.toBe(body.temporary_password);
    expect(next.access.status).toBe('AWAITING_FIRST_ACCESS');
    await get('/auth/me', web.body.access_token).expect(401);
    await get('/mobile/me', app1.body.access_token).expect(401);
    await api()
      .post('/api/v1/mobile/auth/refresh')
      .send({ refresh_token: app1.body.refresh_token })
      .expect(401);
    const userId = body.linked_user.id;
    expect(
      await db
        .getRepository(SessionEntity)
        .countBy({ userId, revokedAt: IsNull() }),
    ).toBe(0);
    const openTokens = (
      await db.getRepository(MobileRefreshTokenEntity).findBy({ userId })
    ).filter((t) => !t.revokedAt);
    expect(openTokens).toHaveLength(0);
    await webLogin('campo.redefinir', body.temporary_password).expect(401);
    await webLogin('campo.redefinir', next.temporary_password).expect(200);
    const dump = JSON.stringify(
      await db.getRepository(UserAuditLogEntity).findBy({ userId }),
    );
    expect(dump).not.toContain(next.temporary_password);
    expect(
      await db.getRepository(UserAuditLogEntity).countBy({
        userId,
        operation: 'TEMPORARY_PASSWORD_ISSUED',
      }),
    ).toBe(2);
  });

  it('redefinir vale para convite pendente: invalida o convite e ativa com troca obrigatória', async () => {
    const a = await agent();
    const sender = app.get<MockEmailSender>(EMAIL_SENDER);
    await post(`/field-agents/${a.id}/invite`, {
      login: 'campo.convite.pendente',
      email: 'campo.convite.pendente@example.invalid',
    }).expect(201);
    expect(
      (await get(`/field-agents/${a.id}`).expect(200)).body.access.status,
    ).toBe('INVITATION_PENDING');
    const invitation = sender.invitations.find(
      (i) => i.to === 'campo.convite.pendente@example.invalid',
    )!;
    const token = decodeURIComponent(
      new URL(invitation.activationUrl).hash.slice('#token='.length),
    );
    const reset = await post(
      `/field-agents/${a.id}/access/temporary-password/reset`,
    ).expect(200);
    expect(reset.body.access.status).toBe('AWAITING_FIRST_ACCESS');
    await api()
      .post('/api/v1/auth/activation/confirm')
      .send({ token, new_password: 'SINTETICO senha pelo convite 2026' })
      .expect(401);
    await post(`/field-agents/${a.id}/resend-invitation`).expect(409);
    await webLogin(
      'campo.convite.pendente',
      reset.body.temporary_password as string,
    ).expect(200);
  });

  it('revogar: senha invalidada, conta inativa, sessões e refresh encerrados; redefinir reativa', async () => {
    const { agentId, body } = await issue('campo.revogar');
    await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: agentId,
    }).expect(201);
    const web = await webLogin('campo.revogar', body.temporary_password).expect(
      200,
    );
    const app1 = await mobileLogin(
      'campo.revogar',
      body.temporary_password,
    ).expect(200);
    const revoked = await post(`/field-agents/${agentId}/access/revoke`).expect(
      200,
    );
    expect(revoked.body).not.toHaveProperty('temporary_password');
    expect(revoked.body.access).toEqual({
      status: 'REVOKED',
      temporary_password_issued_at: null,
    });
    const user = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ id: body.linked_user.id });
    expect(user.status).toBe(UserStatus.INACTIVE);
    expect(user.mustChangePassword).toBe(false);
    await get('/auth/me', web.body.access_token).expect(401);
    await api()
      .post('/api/v1/mobile/auth/refresh')
      .send({ refresh_token: app1.body.refresh_token })
      .expect(401);
    await webLogin('campo.revogar', body.temporary_password)
      .expect(401)
      .expect((r) => expect(r.body.code).toBe('UNAUTHORIZED'));
    await mobileLogin('campo.revogar', body.temporary_password).expect(401);
    expect(
      (await get(`/field-agents/${agentId}`).expect(200)).body.access.status,
    ).toBe('REVOKED');
    // Revogar de novo é idempotente.
    await post(`/field-agents/${agentId}/access/revoke`).expect(200);

    const again = await post(
      `/field-agents/${agentId}/access/temporary-password/reset`,
    ).expect(200);
    expect(again.body.access.status).toBe('AWAITING_FIRST_ACCESS');
    expect(
      (
        await db
          .getRepository(UserEntity)
          .findOneByOrFail({ id: body.linked_user.id })
      ).status,
    ).toBe(UserStatus.ACTIVE);
    await mobileLogin(
      'campo.revogar',
      again.body.temporary_password as string,
    ).expect(200);
  });

  it('recusa conta associada que não é exclusiva de inventariante', async () => {
    const source = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'test.user' });
    const copy = db.getRepository(UserEntity).create({
      ...source,
      login: 'conta.administrativa',
      email: 'conta.administrativa@example.invalid',
    });
    delete (copy as Partial<UserEntity>).id;
    const user = await db.getRepository(UserEntity).save(copy);
    const a = (
      await post('/field-agents', {
        name: 'SINTETICO Campo com conta comum',
        user_id: user.id,
      }).expect(201)
    ).body as { id: number };
    const before = user.passwordHash;
    await post(`/field-agents/${a.id}/access/temporary-password/reset`)
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('NOT_FIELD_AGENT_ACCOUNT'));
    await post(`/field-agents/${a.id}/access/revoke`)
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('NOT_FIELD_AGENT_ACCOUNT'));
    expect(
      (await db.getRepository(UserEntity).findOneByOrFail({ id: user.id }))
        .passwordHash,
    ).toBe(before);
  });

  it('e-mail nulo: convite exige e-mail, recuperação genérica sem envio, buscas, opções e exportação', async () => {
    const { agentId } = await issue('campo.nulo.fluxos');
    const a = await agent();
    await post(`/field-agents/${a.id}/invite`, { login: 'campo.sem.convite' })
      .expect(400)
      .expect((r) => expect(JSON.stringify(r.body)).toContain('e-mail'));

    const sender = app.get<MockEmailSender>(EMAIL_SENDER);
    const spy = jest.spyOn(sender, 'sendPasswordResetEmail');
    try {
      const generic = await api()
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'campo.nulo.fluxos@example.invalid' })
        .expect(200);
      expect(generic.body.message).toContain('Se o e-mail estiver cadastrado');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }

    const users = await get('/users?search=campo.nulo&page_size=50').expect(
      200,
    );
    const listed = users.body.data.find(
      (u: { login: string }) => u.login === 'campo.nulo.fluxos',
    );
    expect(listed.email).toBeNull();
    await get(`/users/${listed.id}`)
      .expect(200)
      .expect((r) => expect(r.body.email).toBeNull());
    await get('/users?page_size=100').expect(200);
    const options = await get(
      '/field-agents/user-options?search=campo&page_size=100',
    ).expect(200);
    expect(Array.isArray(options.body.items)).toBe(true);
    await get(`/field-agents/user-options?current_agent_id=${agentId}`).expect(
      200,
    );
    await get('/field-agents/export').expect(200);
  });
});
