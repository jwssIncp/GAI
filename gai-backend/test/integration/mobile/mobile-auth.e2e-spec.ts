import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';
import { fixturePasswords } from '../../fixtures/passwords';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { SessionEntity } from '../../../src/modules/auth/infrastructure/persistence/session.entity';
import { MobileRefreshTokenEntity } from '../../../src/modules/auth/infrastructure/persistence/mobile-refresh-token.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { RoleType } from '../../../src/modules/users/domain/enums/role-type.enum';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import { ProjectFieldAgentEntity } from '../../../src/modules/field-agents/infrastructure/persistence/project-field-agent.entity';

interface Tokens {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  session_expires_at: string;
}

describe('Onda 1: mobile authentication, rotation and identity', () => {
  let app: INestApplication, db: DataSource, admin: string;
  let projectA: number, projectB: number;
  let serial = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const adminPost = (path: string, body?: object) =>
    api()
      .post('/api/v1' + path)
      .set(bearer(admin))
      .send(body ?? {});
  const sha = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const mobileLogin = (identifier: string, password = fixturePasswords.user) =>
    api()
      .post('/api/v1/mobile/auth/login')
      .send({ identifier, password, device_label: 'SINTETICO Android' });
  const refresh = (token: string) =>
    api().post('/api/v1/mobile/auth/refresh').send({ refresh_token: token });
  const me = (access: string) =>
    api().get('/api/v1/mobile/me').set(bearer(access));
  const rowOf = (token: string) =>
    db
      .getRepository(MobileRefreshTokenEntity)
      .findOneByOrFail({ tokenHash: sha(token) });

  /** Synthetic account (custom profile) linked to a field agent. */
  const fieldAccount = async (
    keys: string[] = ['projects:read', 'inventory-items:read'],
    projects: number[] = [projectA],
  ) => {
    const source = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'test.user' });
    const copy = db.getRepository(UserEntity).create({
      ...source,
      login: `mobile.${++serial}`,
      email: `mobile.${serial}@example.invalid`,
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    delete (copy as Partial<UserEntity>).id;
    const user = await db.getRepository(UserEntity).save(copy);
    const role = await db.getRepository(RoleEntity).save({
      key: `SINTETICO_MOBILE_${serial}`,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      name: `SINTETICO Mobile ${serial}`,
      description: null,
      isActive: true,
    });
    for (const permission of await db
      .getRepository(PermissionEntity)
      .findBy({ key: In(keys) }))
      await db
        .getRepository(RolePermissionEntity)
        .save({ roleId: role.id, permissionId: permission.id });
    await db.getRepository(UserRoleAssignmentEntity).save({
      userId: user.id,
      roleId: role.id,
      isActive: true,
      assignedBy: null,
      assignedAt: new Date(),
      revokedAt: null,
    });
    const agent = (
      await adminPost('/field-agents', {
        name: `SINTETICO Campo ${serial}`,
        user_id: user.id,
      }).expect(201)
    ).body as { id: number };
    for (const projectId of projects)
      await adminPost(`/projects/${projectId}/field-agents`, {
        field_agent_id: agent.id,
      }).expect(201);
    return { user, agent };
  };
  const loggedIn = async (
    ...args: Parameters<typeof fieldAccount>
  ): Promise<Tokens & { user: UserEntity; agent: { id: number } }> => {
    const account = await fieldAccount(...args);
    const tokens = (await mobileLogin(account.user.login).expect(200))
      .body as Tokens;
    return { ...tokens, ...account };
  };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    const project = async (name: string) =>
      (
        await adminPost('/projects', {
          name,
          organization_id: 1,
          company_id: 1,
        }).expect(201)
      ).body.id as number;
    projectA = await project('SINTETICO Mobile A');
    projectB = await project('SINTETICO Mobile B');
  }, 300000);
  afterAll(async () => {
    if (app) await app.close();
  });

  it('logs in, stores only the refresh hash and returns identity with linked projects', async () => {
    const t = await loggedIn();
    expect(t.access_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.refresh_token).toMatch(/^gmr_[A-Za-z0-9_-]{43}$/);
    const access = new Date(t.access_token_expires_at).getTime();
    expect(access - Date.now()).toBeLessThanOrEqual(15 * 60000 + 1000);
    expect(new Date(t.refresh_token_expires_at).getTime()).toBeLessThanOrEqual(
      new Date(t.session_expires_at).getTime(),
    );
    const row = await rowOf(t.refresh_token);
    expect(Object.values(row)).not.toContain(t.refresh_token);
    expect(row.deviceLabel).toBe('SINTETICO Android');
    const session = await db
      .getRepository(SessionEntity)
      .findOneByOrFail({ id: t.access_token });
    expect(session.clientType).toBe('mobile');
    expect(session.refreshFamilyId).toBe(row.familyId);

    const body = (await me(t.access_token).expect(200)).body;
    expect(body.user).toMatchObject({ id: t.user.id, email: t.user.email });
    expect(body.organization.id).toBe(1);
    expect(body.field_agent).toMatchObject({
      id: t.agent.id,
      status: 'active',
    });
    expect(body.projects.map((p: { id: number }) => p.id)).toEqual([projectA]);
    expect(body.projects[0].assignment.id).toEqual(expect.any(Number));
    expect(body.permissions).toEqual(
      expect.arrayContaining(['projects:read', 'inventory-items:read']),
    );
    expect(body.permissions).not.toContain('inventory-items:create');
    // Mobile access sessions never slide on activity.
    const after = await db
      .getRepository(SessionEntity)
      .findOneByOrFail({ id: t.access_token });
    expect(after.expiresAt.getTime()).toBe(session.expiresAt.getTime());
  });

  it('rejects invalid credentials, malformed bodies and accounts without field access', async () => {
    const { user } = await fieldAccount();
    await mobileLogin(user.login, 'SINTETICO senha errada').expect(401);
    await mobileLogin('mobile.inexistente').expect(401);
    await api()
      .post('/api/v1/mobile/auth/login')
      .send({ identifier: user.login })
      .expect(400);
    await api()
      .post('/api/v1/mobile/auth/login')
      .send({ email: user.login, password: fixturePasswords.user })
      .expect(400);
    await refresh('not-a-token').expect(400);
    // Organization admin without a field agent: valid password, no app access.
    const orgAdmin = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'org.admin' });
    await mobileLogin('org.admin', fixturePasswords.orgAdmin)
      .expect(403)
      .expect((r) => expect(r.body.code).toBe('MOBILE_ACCESS_DENIED'));
    expect(
      await db
        .getRepository(SessionEntity)
        .countBy({ userId: orgAdmin.id, clientType: 'mobile' }),
    ).toBe(0);
  });

  it('rotates refresh tokens, revokes the previous access and detects reuse', async () => {
    const t = await loggedIn();
    const second = (await refresh(t.refresh_token).expect(200)).body as Tokens;
    expect(second.refresh_token).not.toBe(t.refresh_token);
    expect(second.session_expires_at).toBe(t.session_expires_at);
    await me(t.access_token).expect(401);
    await me(second.access_token).expect(200);
    // Immediate duplicate (lost response / retry): refused, family kept.
    await refresh(t.refresh_token)
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('REFRESH_TOKEN_ALREADY_ROTATED'));
    const third = (await refresh(second.refresh_token).expect(200))
      .body as Tokens;
    // Replay after the grace window: theft assumed, whole family revoked.
    await db
      .getRepository(MobileRefreshTokenEntity)
      .update(
        { tokenHash: sha(t.refresh_token) },
        { rotatedAt: new Date(Date.now() - 120000) },
      );
    await refresh(t.refresh_token)
      .expect(401)
      .expect((r) => expect(r.body.code).toBe('REFRESH_TOKEN_REUSED'));
    await refresh(third.refresh_token).expect(401);
    await me(third.access_token).expect(401);
  });

  it('lets exactly one of concurrent renewals win', async () => {
    const t = await loggedIn();
    const results = await Promise.all([
      refresh(t.refresh_token),
      refresh(t.refresh_token),
      refresh(t.refresh_token),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    const winner = results.find((r) => r.status === 200)!.body as Tokens;
    await me(winner.access_token).expect(200);
    await refresh(winner.refresh_token).expect(200);
  });

  it('enforces access expiry, refresh expiry and the absolute session limit', async () => {
    const t = await loggedIn();
    await db
      .getRepository(SessionEntity)
      .update({ id: t.access_token }, { expiresAt: new Date(Date.now() - 1) });
    await me(t.access_token).expect(401);
    // Near the absolute limit a renewal can never extend the session.
    const cap = new Date(Date.now() + 5000);
    await db
      .getRepository(MobileRefreshTokenEntity)
      .update(
        { tokenHash: sha(t.refresh_token) },
        { familyExpiresAt: cap, expiresAt: cap },
      );
    const renewed = (await refresh(t.refresh_token).expect(200)).body as Tokens;
    for (const value of [
      renewed.access_token_expires_at,
      renewed.refresh_token_expires_at,
      renewed.session_expires_at,
    ])
      expect(new Date(value).getTime()).toBeLessThanOrEqual(cap.getTime());
    await db
      .getRepository(MobileRefreshTokenEntity)
      .update(
        { tokenHash: sha(renewed.refresh_token) },
        { expiresAt: new Date(Date.now() - 1) },
      );
    await refresh(renewed.refresh_token)
      .expect(401)
      .expect((r) => expect(r.body.code).toBe('SESSION_EXPIRED'));
    await me(renewed.access_token).expect(401);
  });

  it('logs out idempotently and invalidates the whole session', async () => {
    const t = await loggedIn();
    await api()
      .post('/api/v1/mobile/auth/logout')
      .send({ refresh_token: t.refresh_token })
      .expect(204);
    await me(t.access_token).expect(401);
    await refresh(t.refresh_token)
      .expect(401)
      .expect((r) => expect(r.body.code).toBe('INVALID_REFRESH_TOKEN'));
    await api()
      .post('/api/v1/mobile/auth/logout')
      .send({ refresh_token: t.refresh_token })
      .expect(204);
    await api()
      .post('/api/v1/mobile/auth/logout')
      .send({ refresh_token: `gmr_${'A'.repeat(43)}` })
      .expect(204);
  });

  it('invalidates sessions after field-agent block, credential change and deactivation', async () => {
    const blocked = await loggedIn();
    await adminPost(`/field-agents/${blocked.agent.id}/block`).expect(200);
    await me(blocked.access_token).expect(403);
    await refresh(blocked.refresh_token)
      .expect(403)
      .expect((r) => expect(r.body.code).toBe('MOBILE_ACCESS_DENIED'));
    expect((await rowOf(blocked.refresh_token)).revokedReason).toBe(
      'field_agent_ineligible',
    );

    const rotated = await loggedIn();
    await db
      .getRepository(UserEntity)
      .increment({ id: rotated.user.id }, 'authVersion', 1);
    await me(rotated.access_token).expect(401);
    await refresh(rotated.refresh_token)
      .expect(401)
      .expect((r) => expect(r.body.code).toBe('SESSION_REVOKED'));

    const inactive = await loggedIn();
    await db
      .getRepository(UserEntity)
      .update(inactive.user.id, { status: UserStatus.INACTIVE });
    await refresh(inactive.refresh_token).expect(401);
    await db
      .getRepository(UserEntity)
      .update(inactive.user.id, { status: UserStatus.ACTIVE });
    // Revocation is permanent: reactivating the account needs a new login.
    await refresh(inactive.refresh_token).expect(401);
  });

  it('returns no projects without links and never leaks other organizations', async () => {
    const lonely = await loggedIn(['projects:read'], []);
    const body = (await me(lonely.access_token).expect(200)).body;
    expect(body.projects).toEqual([]);
    await api()
      .get('/api/v1/projects')
      .set(bearer(lonely.access_token))
      .expect(200)
      .expect((r) => expect(r.body.total_items).toBe(0));

    const other = await db.getRepository(OrganizationEntity).save({
      legalName: 'SINTETICO Outra organizacao',
      cnpj: '11444777000161',
      status: OrganizationStatus.ACTIVE,
    });
    const foreign = await db.getRepository(ProjectEntity).save(
      db.getRepository(ProjectEntity).create({
        ...(await db.getRepository(ProjectEntity).findOneByOrFail({
          id: projectA,
        })),
        id: undefined,
        organizationId: other.id,
        companyId: null,
        name: 'SINTETICO Projeto alheio',
      }),
    );
    // A link row pointing at another organization's project is refused by the
    // composite (project_id, organization_id) foreign key.
    await expect(
      db.getRepository(ProjectFieldAgentEntity).save({
        organizationId: 1,
        projectId: foreign.id,
        fieldAgentId: lonely.agent.id,
        status: 'active',
      } as Partial<ProjectFieldAgentEntity>),
    ).rejects.toThrow(/FOREIGN KEY/);
    const again = (await me(lonely.access_token).expect(200)).body;
    expect(again.projects).toEqual([]);
    await api()
      .get(`/api/v1/projects/${foreign.id}`)
      .set(bearer(lonely.access_token))
      .expect(403);
  });

  it('keeps custom profiles confined to linked projects', async () => {
    const t = await loggedIn([
      'projects:read',
      'inventory-items:read',
      'inventory-items:create',
      'expenses:create',
    ]);
    const body = (await me(t.access_token).expect(200)).body;
    expect(body.projects.map((p: { id: number }) => p.id)).toEqual([projectA]);
    expect(body.permissions).toEqual(
      expect.arrayContaining(['inventory-items:create', 'expenses:create']),
    );
    await api()
      .post(`/api/v1/projects/${projectB}/inventory-items`)
      .set(bearer(t.access_token))
      .send({ description: 'SINTETICO' })
      .expect(403);
    await api()
      .post(`/api/v1/projects/${projectA}/inventory-items`)
      .set(bearer(t.access_token))
      .send({ description: 'SINTETICO' })
      .expect(201);
  });

  it('keeps web login, sliding web sessions and web logout unchanged', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ identifier: 'org.admin', password: fixturePasswords.orgAdmin })
      .expect(200);
    expect(login.body).toEqual(
      expect.objectContaining({
        access_token: expect.any(String),
        expires_at: expect.any(String),
        user: expect.objectContaining({ login: 'org.admin' }),
      }),
    );
    expect(login.body.refresh_token).toBeUndefined();
    const token = login.body.access_token as string;
    const session = await db
      .getRepository(SessionEntity)
      .findOneByOrFail({ id: token });
    expect(session.clientType).toBe('web');
    await db
      .getRepository(SessionEntity)
      .update({ id: token }, { expiresAt: new Date(Date.now() + 60000) });
    await api().get('/api/v1/auth/me').set(bearer(token)).expect(200);
    const slid = await db
      .getRepository(SessionEntity)
      .findOneByOrFail({ id: token });
    expect(slid.expiresAt.getTime()).toBeGreaterThan(Date.now() + 3600000);
    await api().post('/api/v1/auth/logout').set(bearer(token)).expect(204);
    await api().get('/api/v1/auth/me').set(bearer(token)).expect(401);
  });
});
