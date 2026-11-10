import { INestApplication } from '@nestjs/common';
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
import { AuthAuditLogEntity } from '../../../src/modules/auth/infrastructure/persistence/auth-audit-log.entity';
import { EMAIL_SENDER } from '../../../src/modules/auth/domain/ports/email-sender.port';
import { MockEmailSender } from '../../../src/modules/auth/infrastructure/email/ses-email.sender';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { RoleType } from '../../../src/modules/users/domain/enums/role-type.enum';
import {
  FIELD_ACCESS_PERMISSIONS,
  LEGACY_FIELD_ACCESS_PERMISSIONS,
} from '../../../src/modules/field-agents/domain/field-access-permissions';
import { upgradeFieldAgentRoles } from '../../../src/scripts/seed/field-agent-roles-upgrade';

describe('Onda 0: field access, project confinement and operational eligibility', () => {
  let app: INestApplication, db: DataSource, admin: string;
  let linkedProject: number, otherProject: number;
  let serial = 0;
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const post = (token: string, path: string, body?: object) =>
    api()
      .post('/api/v1' + path)
      .set(as(token))
      .send(body ?? {});
  const permissionIds = async (keys: readonly string[]) =>
    (
      await db.getRepository(PermissionEntity).findBy({ key: In([...keys]) })
    ).map((p) => p.id);
  const grantedKeys = async (roleId: number) =>
    (
      await db
        .getRepository(PermissionEntity)
        .createQueryBuilder('p')
        .innerJoin(RolePermissionEntity, 'g', 'g.permissionId=p.id')
        .where('g.roleId=:roleId', { roleId })
        .getMany()
    )
      .map((p) => p.key)
      .sort();
  const fieldRole = () =>
    db
      .getRepository(RoleEntity)
      .findOneByOrFail({ key: 'FIELD_AGENT_ORG_1', organizationId: 1 });
  const login = async (identifier: string, password: string) =>
    (
      await api()
        .post('/api/v1/auth/login')
        .send({ identifier, password })
        .expect(200)
    ).body.access_token as string;
  /** Account with a custom (non field) organization profile. */
  const customAccount = async (keys: string[]) => {
    const source = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'test.user' });
    const copy = db.getRepository(UserEntity).create({
      ...source,
      login: `onda0.${++serial}`,
      email: `onda0.${serial}@example.invalid`,
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    delete (copy as Partial<UserEntity>).id;
    const user = await db.getRepository(UserEntity).save(copy);
    const role = await db.getRepository(RoleEntity).save({
      key: `SINTETICO_CUSTOM_${serial}`,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      name: `SINTETICO Perfil ${serial}`,
      description: null,
      isActive: true,
    });
    for (const permissionId of await permissionIds(keys))
      await db
        .getRepository(RolePermissionEntity)
        .save({ roleId: role.id, permissionId });
    await db.getRepository(UserRoleAssignmentEntity).save({
      userId: user.id,
      roleId: role.id,
      isActive: true,
      assignedBy: null,
      assignedAt: new Date(),
      revokedAt: null,
    });
    return { user, token: await login(user.login, fixturePasswords.user) };
  };
  const agent = async (extra: object = {}) =>
    (
      await post(admin, '/field-agents', {
        name: `SINTETICO Campo ${++serial}`,
        ...extra,
      }).expect(201)
    ).body as { id: number };
  const assign = (agentId: number, projectId = linkedProject) =>
    post(admin, `/projects/${projectId}/field-agents`, {
      field_agent_id: agentId,
    }).expect(201);
  const item = (token: string, projectId: number) =>
    post(token, `/projects/${projectId}/inventory-items`, {
      external_item_id: `1730736000${String(++serial).padStart(6, '0')}`,
      description: `SINTETICO Item ${serial}`,
      new_plate: `P${serial}`,
    });
  const invite = async (agentId: number) => {
    const sender = app.get<MockEmailSender>(EMAIL_SENDER);
    const name = `onda0.invite${++serial}`;
    const response = await post(admin, `/field-agents/${agentId}/invite`, {
      login: name,
      email: `${name}@example.invalid`,
    });
    if (response.status !== 201) return { response, token: null };
    const invitation = sender.invitations.find(
      (value) => value.to === `${name}@example.invalid`,
    )!;
    const token = new URL(invitation.activationUrl).hash.slice(
      '#token='.length,
    );
    await api()
      .post('/api/v1/auth/activation/confirm')
      .send({
        token: decodeURIComponent(token),
        new_password: 'SINTETICO senha de campo 2026!',
      })
      .expect(200);
    return {
      response,
      token: await login(name, 'SINTETICO senha de campo 2026!'),
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    const project = async (name: string) =>
      (
        await post(admin, '/projects', {
          name,
          organization_id: 1,
          company_id: 1,
        }).expect(201)
      ).body.id as number;
    linkedProject = await project('SINTETICO Onda0 vinculado');
    otherProject = await project('SINTETICO Onda0 sem vinculo');
  }, 300000);
  afterAll(async () => {
    if (app) await app.close();
  });

  it('provisions the least-privilege field profile and lets it collect only in linked projects', async () => {
    const a = await agent();
    const { token } = await invite(a.id);
    expect(await grantedKeys((await fieldRole()).id)).toEqual(
      [...FIELD_ACCESS_PERMISSIONS].sort(),
    );
    await assign(a.id);
    const projects = await api()
      .get('/api/v1/projects')
      .set(as(token!))
      .expect(200);
    expect(projects.body.items.map((p: { id: number }) => p.id)).toEqual([
      linkedProject,
    ]);
    const created = await item(token!, linkedProject).expect(201);
    await api()
      .patch(
        `/api/v1/projects/${linkedProject}/inventory-items/${created.body.id}`,
      )
      .set(as(token!))
      .send({ location_text: 'SINTETICO Sala 2' })
      .expect(200);
    await post(
      token!,
      `/projects/${linkedProject}/inventory-items/${created.body.id}/deactivate`,
    ).expect(200);
    await item(token!, otherProject).expect(403);
    // No administrative or financial permission.
    await post(token!, `/projects/${linkedProject}/expenses`, {
      description: 'SINTETICO',
      expense_date: '2026-11-08',
      amount: '10.00',
    }).expect(403);
    // Onda 3: reconciliation is allowed (own sessions only), retry is not.
    const opened = await post(
      token!,
      `/projects/${linkedProject}/import-sessions`,
      {
        type: 'mobile_sync',
        source: 'mobile_app',
      },
    ).expect(201);
    await post(
      token!,
      `/projects/${linkedProject}/import-sessions/${opened.body.id}/retry`,
    ).expect(403);
    await post(
      token!,
      `/projects/${linkedProject}/inventory-items/${created.body.id}/reactivate`,
    ).expect(403);
    await api().get('/api/v1/field-agents').set(as(token!)).expect(403);
  });

  it('keeps legacy field profiles valid, refuses foreign grants and upgrades only on explicit request', async () => {
    const role = await fieldRole();
    const extra = await permissionIds(
      FIELD_ACCESS_PERMISSIONS.filter(
        (key) => !LEGACY_FIELD_ACCESS_PERMISSIONS.includes(key),
      ),
    );
    await db
      .getRepository(RolePermissionEntity)
      .delete({ roleId: role.id, permissionId: In(extra) });
    expect(await grantedKeys(role.id)).toEqual(
      [...LEGACY_FIELD_ACCESS_PERMISSIONS].sort(),
    );
    const legacy = await invite((await agent()).id);
    expect(legacy.response.status).toBe(201);

    const dryRun = await upgradeFieldAgentRoles(db, false);
    expect(dryRun).toEqual([
      expect.objectContaining({ roleId: role.id, action: 'upgrade' }),
    ]);
    expect(await grantedKeys(role.id)).toEqual(
      [...LEGACY_FIELD_ACCESS_PERMISSIONS].sort(),
    );
    await upgradeFieldAgentRoles(db, true);
    expect(await grantedKeys(role.id)).toEqual(
      [...FIELD_ACCESS_PERMISSIONS].sort(),
    );

    const [financial] = await permissionIds(['expenses:create']);
    await db
      .getRepository(RolePermissionEntity)
      .save({ roleId: role.id, permissionId: financial });
    const refused = await invite((await agent()).id);
    expect(refused.response.status).toBe(409);
    expect(await upgradeFieldAgentRoles(db, false)).toEqual([
      expect.objectContaining({
        action: 'skipped-foreign-permissions',
        foreign: ['expenses:create'],
      }),
    ]);
    await db
      .getRepository(RolePermissionEntity)
      .delete({ roleId: role.id, permissionId: financial });
  });

  it('confines custom-profile accounts linked to a field agent and blocks them once the agent is blocked', async () => {
    const { user, token } = await customAccount([
      'projects:read',
      'inventory-items:read',
      'inventory-items:create',
    ]);
    // Before the link the custom profile reaches every organization project.
    await item(token, otherProject).expect(201);
    const a = await agent({ user_id: user.id });
    await assign(a.id);
    const projects = await api()
      .get('/api/v1/projects')
      .set(as(token))
      .expect(200);
    expect(projects.body.items.map((p: { id: number }) => p.id)).toEqual([
      linkedProject,
    ]);
    await item(token, otherProject).expect(403);
    const created = await item(token, linkedProject).expect(201);

    await post(admin, `/field-agents/${a.id}/block`).expect(200);
    await item(token, linkedProject).expect(403);
    const after = await api()
      .get('/api/v1/projects')
      .set(as(token))
      .expect(200);
    expect(after.body.total_items).toBe(0);
    // History preserved and still visible to the organization.
    await api()
      .get(
        `/api/v1/projects/${linkedProject}/inventory-items/${created.body.id}`,
      )
      .set(as(admin))
      .expect(200)
      .expect((r) => expect(r.body.created_by_id).toBe(user.id));
  });

  it('binds expenses of linked accounts to their own active agent and maps rule violations to 409', async () => {
    const { user, token } = await customAccount([
      'projects:read',
      'expenses:create',
      'expenses:read',
    ]);
    const own = await agent({ user_id: user.id });
    const colleague = await agent();
    await assign(own.id);
    await assign(colleague.id);
    const body = {
      description: 'SINTETICO Combustivel',
      reason: 'Deslocamento',
      expense_date: '2026-11-08',
      amount: '120.50',
    };
    await post(token, `/projects/${linkedProject}/expenses`, {
      ...body,
      field_agent_id: colleague.id,
    }).expect(403);
    await post(token, `/projects/${linkedProject}/expenses`, body)
      .expect(201)
      .expect((r) => expect(r.body.field_agent_id).toBe(own.id));

    await post(admin, `/field-agents/${colleague.id}/block`).expect(200);
    await post(admin, `/projects/${linkedProject}/expenses`, {
      ...body,
      field_agent_id: colleague.id,
    })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('FIELD_AGENT_INELIGIBLE'));

    const expense = await post(
      admin,
      `/projects/${linkedProject}/expenses`,
      body,
    ).expect(201);
    await post(
      admin,
      `/projects/${linkedProject}/expenses/${expense.body.id}/mark-as-paid`,
    ).expect(200);
    await post(
      admin,
      `/projects/${linkedProject}/expenses/${expense.body.id}/cancel`,
    )
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('EXPENSE_STATE_CONFLICT'));
  });

  it('keeps unlinked custom profiles organization-wide and never audits a client-supplied forwarded IP', async () => {
    const { token } = await customAccount([
      'projects:read',
      'inventory-items:read',
      'inventory-items:create',
    ]);
    await item(token, otherProject).expect(201);
    await item(token, linkedProject).expect(201);

    await api()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.66')
      .send({ identifier: 'onda0.nobody', password: 'SINTETICO errada 1' })
      .expect(401);
    const [entry] = await db
      .getRepository(AuthAuditLogEntity)
      .find({ order: { id: 'DESC' }, take: 1 });
    expect(entry.ipAddress).not.toBe('203.0.113.66');
  });
});
