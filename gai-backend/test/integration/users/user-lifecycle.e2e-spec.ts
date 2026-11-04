import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createHash } from 'crypto';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { SessionEntity } from '../../../src/modules/auth/infrastructure/persistence/session.entity';
import { PasswordResetTokenEntity } from '../../../src/modules/auth/infrastructure/persistence/password-reset-token.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { UserAuditLogEntity } from '../../../src/modules/users/infrastructure/persistence/user-audit-log.entity';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { EMAIL_SENDER } from '../../../src/modules/auth/domain/ports/email-sender.port';
import { MockEmailSender } from '../../../src/modules/auth/infrastructure/email/ses-email.sender';
import { CredentialTransactionsService } from '../../../src/modules/auth/application/services/credential-transactions.service';

describe('User lifecycle: registration, credentials and tenant security', () => {
  let app: INestApplication,
    db: DataSource,
    platform: string,
    admin: string,
    operator: string;
  let sequence = 0;
  const temporary = 'Temporary password 2026!';
  const permanent = 'My personal passphrase 2026!';
  const api = () => request(app.getHttpServer());
  const auth = (token = platform) => ({ Authorization: `Bearer ${token}` });
  const payload = (extra = {}) => ({
    full_name: 'Pessoa de teste',
    login: `lifecycle.${++sequence}`,
    email: `lifecycle.${sequence}@example.com`,
    organization_id: 1,
    role_ids: [3],
    activation_method: 'TEMPORARY_PASSWORD',
    password: temporary,
    ...extra,
  });
  const create = (extra = {}, token = platform) =>
    api().post('/api/v1/users').set(auth(token)).send(payload(extra));
  const patch = (id: number, body: Record<string, unknown>, token = platform) =>
    api().patch(`/api/v1/users/${id}`).set(auth(token)).send(body);
  const login = (identifier: string, password = temporary) =>
    api().post('/api/v1/auth/login').send({ identifier, password });
  const me = (token: string) => api().get('/api/v1/auth/me').set(auth(token));
  const lastInvitation = () => {
    const mail = app.get<MockEmailSender>(EMAIL_SENDER).invitations.at(-1)!;
    return new URLSearchParams(new URL(mail.activationUrl).hash.slice(1)).get(
      'token',
    )!;
  };
  const activate = (token: string, new_password = permanent) =>
    api().post('/api/v1/auth/activation/confirm').send({ token, new_password });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    platform = await loginAsAdmin(app);
    admin = await loginAsOrgAdmin(app);
    operator = await loginAsOrgUser(app);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('creates identity, initial grants and audit atomically; forces first password change', async () => {
    const r = await create({
      login: '  CASE.PERSON  ',
      email: '  CASE@example.com  ',
      phone: '(11) 99999-0000',
      job_title: 'Analista',
    }).expect(201);
    expect(r.body).toMatchObject({
      full_name: 'Pessoa de teste',
      login: 'case.person',
      email: 'case@example.com',
      must_change_password: true,
    });
    expect(r.body).not.toHaveProperty('password_hash');
    expect(r.body.role_assignments).toHaveLength(1);
    expect(
      await db
        .getRepository(UserAuditLogEntity)
        .countBy({ userId: r.body.id, operation: 'CREATE' }),
    ).toBe(1);
    const session = await login(r.body.login).expect(200);
    expect(session.body.user.permissions).toEqual([]);
    await api()
      .get('/api/v1/users')
      .set(auth(session.body.access_token))
      .expect(403);
    await api()
      .post('/api/v1/auth/password/change')
      .set(auth(session.body.access_token))
      .send({ current_password: temporary, new_password: permanent })
      .expect(200);
    await me(session.body.access_token).expect(401);
    const next = await login(r.body.login, permanent).expect(200);
    expect(next.body.user.must_change_password).toBe(false);
    await me(next.body.access_token).expect(200);
  });

  it.each([
    ['full_name', undefined],
    ['full_name', null],
    ['full_name', '  '],
    ['login', null],
    ['login', '   '],
    ['login', ' a '],
    ['login', 'a b'],
    ['login', 'a'.repeat(101)],
    ['login', 'someone@example.com'],
    ['email', null],
    ['email', 'invalid'],
    ['role_ids', []],
    ['role_ids', null],
    ['role_ids', [3, 3]],
    ['activation_method', null],
    ['password', null],
    ['password', 'short'],
  ])('rejects invalid creation field %s (%j)', async (field, value) => {
    await create({ [field]: value }).expect(400);
  });

  it('rejects duplicate login/email and the cross-column namespace', async () => {
    const first = await create().expect(201);
    await create({ login: first.body.login.toUpperCase() }).expect(409);
    await create({ email: first.body.email.toUpperCase() }).expect(409);
    await create({ login: first.body.email }).expect(400);
    await patch(first.body.id, { login: 'other@example.com' }).expect(400);
  });
  it('rolls back user and audit when initial role is missing or ungrantable', async () => {
    for (const role_ids of [[999999], [1]]) {
      const before = await db.getRepository(UserEntity).count();
      await create({ role_ids }, admin).expect(role_ids[0] === 1 ? 403 : 400);
      expect(await db.getRepository(UserEntity).count()).toBe(before);
    }
  });
  it('rejects missing/inactive organizations without persisting an active user', async () => {
    await create({ organization_id: 999999 }).expect(403);
    const org = await db.getRepository(OrganizationEntity).save({
      legalName: 'Inativa',
      cnpj: '12345678000195',
      status: OrganizationStatus.INACTIVE,
    });
    await create({ organization_id: org.id }).expect(403);
  });
  it('protects operator, organization boundaries and platform grants', async () => {
    await create({}, operator).expect(403);
    await create({ organization_id: 999999 }, admin).expect(400);
    await patch(1, { full_name: 'Alteração proibida' }, admin).expect(403);
    const target = await create().expect(201);
    await patch(
      target.body.id,
      { organization_id: null, role_ids: [1] },
      admin,
    ).expect(403);
    await api()
      .post('/api/v1/users/1/password-reset')
      .set(auth(admin))
      .send({ password: permanent })
      .expect(403);
  });
  it('edits identification, clears optional data and rejects null required fields', async () => {
    const target = await create({
      phone: '11999990000',
      job_title: 'Analista',
    }).expect(201);
    const changed = await patch(target.body.id, {
      full_name: 'Pessoa atualizada',
      login: 'edited.person',
      phone: null,
      job_title: null,
    }).expect(200);
    expect(changed.body).toMatchObject({
      full_name: 'Pessoa atualizada',
      login: 'edited.person',
      phone: null,
      job_title: null,
    });
    for (const field of ['email', 'login', 'full_name', 'role_ids'])
      await patch(target.body.id, { [field]: null }).expect(400);
    await patch(target.body.id, { password: null }).expect(400);
  });
  it('rolls back identification edits when the new grant is invalid', async () => {
    const target = await create({ full_name: 'Identificação original' }).expect(
      201,
    );
    await patch(target.body.id, {
      full_name: 'Alteração inválida',
      role_ids: [999999],
    }).expect(400);
    expect(
      (
        await db
          .getRepository(UserEntity)
          .findOneByOrFail({ id: target.body.id })
      ).fullName,
    ).toBe('Identificação original');
    expect(
      await db
        .getRepository(UserRoleAssignmentEntity)
        .countBy({ userId: target.body.id, isActive: true }),
    ).toBe(1);
  });
  it('expires temporary credentials for both login and restricted sessions', async () => {
    const target = await create().expect(201);
    const initial = await login(target.body.login).expect(200);
    await db.getRepository(UserEntity).update(target.body.id, {
      temporaryPasswordExpiresAt: new Date(Date.now() - 1000),
    });
    await login(target.body.login).expect(401);
    await me(initial.body.access_token).expect(401);
    await api()
      .post(`/api/v1/users/${target.body.id}/password-reset`)
      .set(auth())
      .send({ password: permanent })
      .expect(200);
    expect(
      (
        await db
          .getRepository(UserEntity)
          .findOneByOrFail({ id: target.body.id })
      ).temporaryPasswordExpiresAt!.getTime(),
    ).toBeGreaterThan(Date.now());
    await login(target.body.login, permanent).expect(200);
  });
  it('resets password, updates timestamp, revokes sessions/tokens and cannot renew old sessions', async () => {
    const target = await create().expect(201);
    const old = await login(target.body.login).expect(200);
    const before = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ id: target.body.id });
    await app
      .get(CredentialTransactionsService)
      .requestReset(target.body.email, null);
    await api()
      .post(`/api/v1/users/${target.body.id}/password-reset`)
      .set(auth())
      .send({ password: permanent })
      .expect(200);
    const after = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ id: target.body.id });
    expect(after.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(
      before.passwordChangedAt.getTime(),
    );
    expect(after.authVersion).toBe(before.authVersion + 1);
    await me(old.body.access_token).expect(401);
    await login(target.body.login).expect(401);
    expect(
      (await login(target.body.login, permanent).expect(200)).body.user
        .must_change_password,
    ).toBe(true);
    const tokens = await db
      .getRepository(PasswordResetTokenEntity)
      .findBy({ userId: target.body.id });
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((token) => token.usedAt !== null)).toBe(true);
    const sessions = await db
      .getRepository(SessionEntity)
      .findBy({ userId: target.body.id });
    expect(
      sessions.find((s) => s.id === old.body.access_token)?.revokedAt,
    ).not.toBeNull();
  });
  it('invites with a hashed token, forbids pending login, activates once and invalidates replays', async () => {
    const r = await create({
      activation_method: 'INVITATION',
      password: undefined,
    }).expect(201);
    expect(r.body.status).toBe('PENDING_ACTIVATION');
    await login(r.body.login, permanent).expect(401);
    const token = lastInvitation();
    const stored = await db
      .getRepository(PasswordResetTokenEntity)
      .findOneByOrFail({ userId: r.body.id });
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(JSON.stringify(r.body)).not.toContain(token);
    await activate(token).expect(200);
    await activate(token).expect(401);
    await login(r.body.login, permanent).expect(200);
  });
  it('resends invitation, invalidating the previous token, and refuses expiry', async () => {
    const target = await create({
      activation_method: 'INVITATION',
      password: undefined,
    }).expect(201);
    const old = lastInvitation();
    await api()
      .post(`/api/v1/users/${target.body.id}/invitation/resend`)
      .set(auth())
      .expect(200);
    const next = lastInvitation();
    expect(next).not.toBe(old);
    await activate(old).expect(401);
    await db
      .getRepository(PasswordResetTokenEntity)
      .update(
        { tokenHash: createHash('sha256').update(next).digest('hex') },
        { expiresAt: new Date(Date.now() - 1000) },
      );
    await activate(next).expect(401);
    await api()
      .post(`/api/v1/users/${target.body.id}/activate`)
      .set(auth())
      .expect(409);
  });
  it('rechecks organization and grants at invitation activation', async () => {
    const target = await create({
      activation_method: 'INVITATION',
      password: undefined,
    }).expect(201);
    const token = lastInvitation();
    await db
      .getRepository(UserRoleAssignmentEntity)
      .update({ userId: target.body.id }, { isActive: false });
    await activate(token).expect(401);
    expect(
      (
        await db
          .getRepository(UserEntity)
          .findOneByOrFail({ id: target.body.id })
      ).status,
    ).toBe('PENDING_ACTIVATION');
  });
  it('refuses invitation activation after organization deactivation', async () => {
    const organization = await db.getRepository(OrganizationEntity).save({
      legalName: 'Organização do convite',
      cnpj: '55666777000188',
      status: OrganizationStatus.ACTIVE,
    });
    await create({
      organization_id: organization.id,
      role_ids: [2],
      activation_method: 'INVITATION',
      password: undefined,
    }).expect(201);
    const token = lastInvitation();
    await db
      .getRepository(OrganizationEntity)
      .update(organization.id, { status: OrganizationStatus.INACTIVE });
    await activate(token).expect(401);
  });
  it('unifies password policy across creation, own change, admin reset and recovery', async () => {
    const target = await create().expect(201);
    const current = await login(target.body.login).expect(200);
    await api()
      .post('/api/v1/auth/password/change')
      .set(auth(current.body.access_token))
      .send({ current_password: temporary, new_password: 'short' })
      .expect(400);
    await api()
      .post(`/api/v1/users/${target.body.id}/password-reset`)
      .set(auth())
      .send({ password: 'short' })
      .expect(400);
    await api()
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: 'x', new_password: 'short' })
      .expect(400);
  });
  it('expires a temporary lock, starts a fresh counter and separates administrative blocking', async () => {
    const target = await create().expect(201);
    for (let i = 0; i < 5; i++)
      await login(target.body.login, 'wrong password').expect(
        i === 4 ? 423 : 401,
      );
    await login(target.body.login).expect(423);
    await db
      .getRepository(UserEntity)
      .update(target.body.id, { lockedUntil: new Date(Date.now() - 1000) });
    await login(target.body.login, 'wrong password').expect(401);
    expect(
      (
        await db
          .getRepository(UserEntity)
          .findOneByOrFail({ id: target.body.id })
      ).failedLoginAttempts,
    ).toBe(1);
    const current = await login(target.body.login).expect(200);
    await api()
      .post(`/api/v1/users/${target.body.id}/block`)
      .set(auth())
      .expect(200);
    await me(current.body.access_token).expect(401);
    await login(target.body.login).expect(401);
    await api()
      .post(`/api/v1/users/${target.body.id}/unblock`)
      .set(auth())
      .expect(200);
    await login(target.body.login).expect(200);
  });
  it('protects the last administrator from blocking, deactivation and grant removal', async () => {
    await api().post('/api/v1/users/2/block').set(auth()).expect(409);
    await api().post('/api/v1/users/1/deactivate').set(auth()).expect(409);
    await patch(2, { role_ids: [3] }).expect(409);
  });
  it('filters names, profiles and status server-side and supports sorting', async () => {
    const result = await api()
      .get(
        '/api/v1/users?search=Pessoa%20atualizada&sort_by=name&sort_order=ASC&organization_id=1&role_id=3&status=ACTIVE',
      )
      .set(auth(admin))
      .expect(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0].login).toBe('edited.person');
    await api()
      .get('/api/v1/users?organization_id=999999')
      .set(auth(admin))
      .expect(403);
  });
  (process.env.GAI_TEST_MYSQL_DISPOSABLE === '1' ? it : it.skip)(
    'MySQL: concurrent identifiers roll back one complete registration',
    async () => {
      const shared = payload({ login: 'concurrent.identity' });
      const responses = await Promise.all([
        api().post('/api/v1/users').set(auth()).send(shared),
        api()
          .post('/api/v1/users')
          .set(auth())
          .send({ ...shared, email: 'other.concurrent@example.com' }),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
      const users = await db
        .getRepository(UserEntity)
        .findBy({ login: shared.login });
      expect(users).toHaveLength(1);
      expect(
        await db
          .getRepository(UserRoleAssignmentEntity)
          .countBy({ userId: users[0].id, isActive: true }),
      ).toBe(1);
      await expect(
        db.query("UPDATE users SET login='collision@example.com' WHERE id=?", [
          users[0].id,
        ]),
      ).rejects.toThrow();
    },
  );
  (process.env.GAI_TEST_MYSQL_DISPOSABLE === '1' ? it : it.skip)(
    'MySQL: reset serializes against login and concurrent failures are counted',
    async () => {
      const target = await create().expect(201);
      const [attempt, reset] = await Promise.all([
        login(target.body.login),
        api()
          .post(`/api/v1/users/${target.body.id}/password-reset`)
          .set(auth())
          .send({ password: permanent }),
      ]);
      expect(reset.status).toBe(200);
      expect([200, 401]).toContain(attempt.status);
      if (attempt.status === 200)
        await me(attempt.body.access_token).expect(401);
      const failures = await Promise.all(
        Array.from({ length: 5 }, () =>
          login(target.body.login, 'invalid password'),
        ),
      );
      expect(failures.map((response) => response.status).sort()).toEqual([
        401, 401, 401, 401, 423,
      ]);
      expect(
        (
          await db
            .getRepository(UserEntity)
            .findOneByOrFail({ id: target.body.id })
        ).failedLoginAttempts,
      ).toBe(5);
    },
  );
  (process.env.GAI_TEST_MYSQL_DISPOSABLE === '1' ? it : it.skip)(
    'MySQL: activation token is consumed once under concurrency',
    async () => {
      await create({
        activation_method: 'INVITATION',
        password: undefined,
      }).expect(201);
      const token = lastInvitation();
      const results = await Promise.all([activate(token), activate(token)]);
      expect(results.map((response) => response.status).sort()).toEqual([
        200, 401,
      ]);
    },
  );
});
