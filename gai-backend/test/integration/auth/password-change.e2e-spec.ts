import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { SessionEntity } from '../../../src/modules/auth/infrastructure/persistence/session.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import {
  EMAIL_SENDER,
  EmailSender,
} from '../../../src/modules/auth/domain/ports/email-sender.port';
import { MockEmailSender } from '../../../src/modules/auth/infrastructure/email/ses-email.sender';
import {
  PASSWORD_HASHER,
  PasswordHasher,
} from '../../../src/modules/auth/domain/ports/password-hasher.port';

describe('Password change: persistence, eight-character policy and fresh sessions', () => {
  let app: INestApplication, db: DataSource, platform: string, orgAdmin: string;
  let sequence = 0;
  let operatorRoleId: number;
  const expectedPermissions = new Map<string, unknown[]>();
  const temporary = 'tttttttt';
  const permanent = 'nnnnnnnn';
  const api = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const create = (extra = {}, actor = platform) =>
    api()
      .post('/api/v1/users')
      .set(auth(actor))
      .send({
        full_name: 'Pessoa senha descartável',
        login: `password.case.${++sequence}`,
        email: `password.case.${sequence}@example.test`,
        organization_id: 1,
        role_ids: [operatorRoleId],
        activation_method: 'TEMPORARY_PASSWORD',
        password: temporary,
        ...extra,
      });
  const login = (identifier: string, password: string) =>
    api().post('/api/v1/auth/login').send({ identifier, password });
  const me = (token: string) => api().get('/api/v1/auth/me').set(auth(token));
  const change = (
    token: string,
    current_password: string,
    new_password: string,
  ) =>
    api()
      .post('/api/v1/auth/password/change')
      .set(auth(token))
      .send({ current_password, new_password });
  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    platform = await loginAsAdmin(app);
    orgAdmin = await loginAsOrgAdmin(app);
    operatorRoleId = (
      await db.getRepository(RoleEntity).findOneByOrFail({
        name: 'Operador',
        organizationId: 1,
      })
    ).id;
    for (const [role, token] of [
      ['PLATFORM_ADMIN', platform],
      ['ORG_ADMIN', orgAdmin],
      ['ORG_USER', await loginAsOrgUser(app)],
    ])
      expectedPermissions.set(
        role,
        (await me(token).expect(200)).body.permissions,
      );
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it.each([
    ['PLATFORM_ADMIN', null, 1],
    ['ORG_ADMIN', 1, 2],
    ['ORG_USER', 1, null],
  ] as const)(
    'completes first access for %s and preserves scope after reload, renewal and a second login',
    async (role, organization_id, systemRoleId) => {
      const roleId = systemRoleId ?? operatorRoleId;
      const created = await create({
        organization_id,
        role_ids: [roleId],
      }).expect(201);
      const first = await login(created.body.login, temporary).expect(200);
      expect(first.body.user.must_change_password).toBe(true);
      expect(first.body.user.permissions).toEqual([]);
      const before = await db
        .getRepository(UserEntity)
        .findOneByOrFail({ id: created.body.id });
      await change(first.body.access_token, temporary, permanent).expect(200);
      const saved = await db
        .getRepository(UserEntity)
        .findOneByOrFail({ id: created.body.id });
      expect(saved.mustChangePassword).toBe(false);
      expect(saved.temporaryPasswordExpiresAt).toBeNull();
      expect(saved.authVersion).toBe(before.authVersion + 1);
      const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);
      expect(await hasher.verify(permanent, saved.passwordHash)).toBe(true);
      expect(await hasher.verify(temporary, saved.passwordHash)).toBe(false);
      await me(first.body.access_token).expect(401);
      await login(created.body.login, temporary).expect(401);
      const next = await login(created.body.login, permanent).expect(200);
      expect(next.body.user).toMatchObject({
        must_change_password: false,
        organization_id,
      });
      expect(
        next.body.user.role_assignments.map(
          (r: { role_id: number }) => r.role_id,
        ),
      ).toEqual([roleId]);
      expect(next.body.user.permissions.length).toBeGreaterThan(0);
      expect(next.body.user.permissions).toEqual(expectedPermissions.get(role));
      if (role !== 'PLATFORM_ADMIN')
        expect(
          next.body.user.permissions.every(
            (p: { scope: string }) => p.scope !== 'GLOBAL',
          ),
        ).toBe(true);
      const sessions = db.getRepository(SessionEntity);
      const shortened = new Date(Date.now() + 60000);
      await sessions.update(
        { id: next.body.access_token },
        { expiresAt: shortened },
      );
      expect(
        (await me(next.body.access_token).expect(200)).body
          .must_change_password,
      ).toBe(false);
      expect(
        (
          await sessions.findOneByOrFail({ id: next.body.access_token })
        ).expiresAt.getTime(),
      ).toBeGreaterThan(shortened.getTime());
      await api()
        .post('/api/v1/auth/logout')
        .set(auth(next.body.access_token))
        .expect(204);
      await me(next.body.access_token).expect(401);
      const again = await login(created.body.login, permanent).expect(200);
      expect(again.body.access_token).not.toBe(next.body.access_token);
      expect(
        (await me(again.body.access_token).expect(200)).body,
      ).toMatchObject({ must_change_password: false, organization_id });
    },
  );

  it.each([7, 8, 15])(
    'enforces the boundary at user registration and first change (%i characters)',
    async (length) => {
      const result = await create({ password: 't'.repeat(length) }).expect(
        length === 7 ? 400 : 201,
      );
      if (length === 7) return;
      const session = await login(result.body.login, 't'.repeat(length)).expect(
        200,
      );
      await change(
        session.body.access_token,
        't'.repeat(length),
        'x'.repeat(7),
      ).expect(400);
      await change(
        session.body.access_token,
        't'.repeat(length),
        'n'.repeat(length),
      ).expect(200);
      expect(
        (await login(result.body.login, 'n'.repeat(length)).expect(200)).body
          .user.must_change_password,
      ).toBe(false);
    },
  );

  it.each([7, 8, 15])(
    'preserves administrative resets and accepts only valid temporary passwords (%i characters)',
    async (length) => {
      const target = await create().expect(201);
      const old = await login(target.body.login, temporary).expect(200);
      const reset = () =>
        api()
          .post(`/api/v1/users/${target.body.id}/password-reset`)
          .set(auth(orgAdmin))
          .send({ password: 'r'.repeat(length) });
      await reset().expect(length === 7 ? 400 : 200);
      if (length === 7) {
        await me(old.body.access_token).expect(200);
        return;
      }
      await me(old.body.access_token).expect(401);
      const fresh = await login(target.body.login, 'r'.repeat(length)).expect(
        200,
      );
      expect(fresh.body.user.must_change_password).toBe(true);
      await change(
        fresh.body.access_token,
        'r'.repeat(length),
        permanent,
      ).expect(200);
      expect(
        (await login(target.body.login, permanent).expect(200)).body.user
          .must_change_password,
      ).toBe(false);
    },
  );

  it.each([7, 8, 15])(
    'recovers access, clears mandatory change and consumes the token once (%i characters)',
    async (length) => {
      const target = await create().expect(201);
      const old = await login(target.body.login, temporary).expect(200);
      const delivery = jest.spyOn(
        app.get<EmailSender>(EMAIL_SENDER),
        'sendPasswordResetEmail',
      );
      await api()
        .post('/api/v1/auth/password-reset/request')
        .send({ email: target.body.email })
        .expect(200);
      const token = delivery.mock.calls.at(-1)![0].resetToken;
      const confirm = (password: string) =>
        api()
          .post('/api/v1/auth/password-reset/confirm')
          .send({ token, new_password: password });
      await confirm('n'.repeat(length)).expect(length === 7 ? 400 : 200);
      if (length === 7) {
        await me(old.body.access_token).expect(200);
        delivery.mockRestore();
        return;
      }
      await me(old.body.access_token).expect(401);
      await login(target.body.login, temporary).expect(401);
      const fresh = await login(target.body.login, 'n'.repeat(length)).expect(
        200,
      );
      expect(
        (await me(fresh.body.access_token).expect(200)).body
          .must_change_password,
      ).toBe(false);
      await confirm('n'.repeat(length)).expect(401);
      delivery.mockRestore();
    },
  );

  it.each([7, 8, 15])(
    'uses the same policy for invitation activation (%i characters)',
    async (length) => {
      const target = await create({
        activation_method: 'INVITATION',
        password: undefined,
      }).expect(201);
      const invitation = app
        .get<MockEmailSender>(EMAIL_SENDER)
        .invitations.at(-1)!;
      const token = new URLSearchParams(
        new URL(invitation.activationUrl).hash.slice(1),
      ).get('token');
      await api()
        .post('/api/v1/auth/activation/confirm')
        .send({ token, new_password: 'a'.repeat(length) })
        .expect(length === 7 ? 400 : 200);
      if (length === 7) return;
      expect(
        (await login(target.body.login, 'a'.repeat(length)).expect(200)).body
          .user.must_change_password,
      ).toBe(false);
    },
  );

  it('rejects organization tampering and out-of-scope credential resets', async () => {
    const target = await create({
      organization_id: null,
      role_ids: [1],
    }).expect(201);
    await api()
      .post(`/api/v1/users/${target.body.id}/password-reset`)
      .set(auth(orgAdmin))
      .send({ password: temporary })
      .expect(403);
    await create({ organization_id: 2 }, orgAdmin).expect(400);
  });
});
