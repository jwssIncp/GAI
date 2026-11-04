import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  seedTestData,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
} from '../test-app.helper';
import { EnsureOrgUserRole1794100000001 } from '../../../src/migrations/1794100000001-ensure-org-user-role';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';

describe('Access profiles: grants, tenant boundaries and live sessions', () => {
  let app: INestApplication;
  let db: DataSource;
  let platform: string;
  let admin: string;
  let operator: string;
  let basicId: number;
  let adminId: number;
  let platformId: number;
  let otherOrgId: number;
  let foreignRoleId: number;
  let counter = 0;
  const api = () => request(app.getHttpServer());
  const auth = (token = admin) => ({ Authorization: `Bearer ${token}` });
  async function newUser(organizationId = 1) {
    const login = `profile.target.${++counter}`;
    const created = await api()
      .post('/api/v1/users')
      .set(auth(platform))
      .send({
        full_name: 'Pessoa de teste',
        login,
        email: login + '@test.local',
        password: 'Temporary password 2026!',
        organization_id: organizationId,
        role_ids: [basicId],
        activation_method: 'TEMPORARY_PASSWORD',
      })
      .expect(201);
    const initial = await api()
      .post('/api/v1/auth/login')
      .send({ identifier: login, password: 'Temporary password 2026!' })
      .expect(200);
    await api()
      .post('/api/v1/auth/password/change')
      .set(auth(initial.body.access_token))
      .send({
        current_password: 'Temporary password 2026!',
        new_password: 'Personal test password 2026!',
      })
      .expect(200);
    return created.body;
  }
  function assign(userId: number, roleId: number, token = admin) {
    return api()
      .post(`/api/v1/users/${userId}/role-assignments`)
      .set(auth(token))
      .send({ role_id: roleId });
  }
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    db = app.get(DataSource);
    platform = await loginAsAdmin(app);
    admin = await loginAsOrgAdmin(app);
    operator = await loginAsOrgUser(app);
    const runner = db.createQueryRunner();
    await new EnsureOrgUserRole1794100000001().up(runner);
    await runner.release();
    basicId = Number(
      (await db.getRepository(RoleEntity).findOneByOrFail({ key: 'ORG_USER' }))
        .id,
    );
    adminId = Number(
      (await db.getRepository(RoleEntity).findOneByOrFail({ key: 'ORG_ADMIN' }))
        .id,
    );
    platformId = Number(
      (
        await db
          .getRepository(RoleEntity)
          .findOneByOrFail({ key: 'PLATFORM_ADMIN' })
      ).id,
    );
    const organization = await api()
      .post('/api/v1/organizations')
      .set(auth(platform))
      .send({ legal_name: 'Outra organização', cnpj: '12345678000195' })
      .expect(201);
    otherOrgId = organization.body.id;
    const permission = await db
      .getRepository(PermissionEntity)
      .findOneByOrFail({ key: 'projects:read' });
    const foreignRole = await api()
      .post(`/api/v1/organizations/${otherOrgId}/roles`)
      .set(auth(platform))
      .send({
        name: 'Perfil de outra organização',
        permission_ids: [Number(permission.id)],
      })
      .expect(201);
    foreignRoleId = foreignRole.body.id;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('lists only grantable profiles, scoped counts and no permission catalog', async () => {
    const result = await api()
      .get('/api/v1/access-profiles')
      .set(auth())
      .expect(200);
    expect(result.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ORG_ADMIN', administrative: true }),
        expect.objectContaining({
          key: 'ORG_USER',
          permission_count: 0,
          editable: false,
        }),
      ]),
    );
    expect(
      result.body.every(
        (role: {
          key: string;
          organization_id: number;
          permissions?: unknown;
        }) =>
          role.key !== 'PLATFORM_ADMIN' &&
          role.organization_id === 1 &&
          role.permissions === undefined,
      ),
    ).toBe(true);
    expect(
      result.body.some((role: { id: number }) => role.id === foreignRoleId),
    ).toBe(false);
    await api()
      .get(`/api/v1/access-profiles?organization_id=${otherOrgId}`)
      .set(auth())
      .expect(403);
    await api().get('/api/v1/access-profiles').expect(401);
    await api().get('/api/v1/access-profiles').set(auth(operator)).expect(403);
    const global = await api()
      .get('/api/v1/access-profiles')
      .set(auth(platform))
      .expect(200);
    expect(global.body.map((role: { key: string }) => role.key)).toEqual([
      'PLATFORM_ADMIN',
    ]);
    const scoped = await api()
      .get(`/api/v1/access-profiles?organization_id=${otherOrgId}`)
      .set(auth(platform))
      .expect(200);
    expect(
      scoped.body.some((role: { id: number }) => role.id === foreignRoleId),
    ).toBe(true);
  });

  it('never exposes platform permissions to ORG_ADMIN, including forged scope', async () => {
    for (const suffix of ['', '?scope=PLATFORM']) {
      const result = await api()
        .get(`/api/v1/permissions${suffix}`)
        .set(auth())
        .expect(200);
      expect(result.body.length).toBeGreaterThan(0);
      expect(
        result.body.every(
          (permission: { scope: string }) =>
            permission.scope === 'ORGANIZATION',
        ),
      ).toBe(true);
    }
    const global = await api()
      .get('/api/v1/permissions?scope=PLATFORM')
      .set(auth(platform))
      .expect(200);
    expect(
      global.body.every(
        (permission: { scope: string }) => permission.scope === 'PLATFORM',
      ),
    ).toBe(true);
  });

  it('regularizes ORG_USER idempotently without modifying permissions or assignments', async () => {
    const rolesBefore = await db.getRepository(RoleEntity).count();
    const linksBefore = await db
      .getRepository(UserRoleAssignmentEntity)
      .count();
    const runner = db.createQueryRunner();
    await new EnsureOrgUserRole1794100000001().up(runner);
    await new EnsureOrgUserRole1794100000001().up(runner);
    await runner.release();
    expect(await db.getRepository(RoleEntity).count()).toBe(rolesBefore);
    expect(await db.getRepository(UserRoleAssignmentEntity).count()).toBe(
      linksBefore,
    );
    const target = await newUser();
    await assign(target.id, basicId).expect(201);
    const session = await api()
      .post('/api/v1/auth/login')
      .send({
        identifier: target.login,
        password: 'Personal test password 2026!',
      })
      .expect(200);
    expect(session.body.user.permissions).toEqual([]);
  });

  it('assigns idempotently, filters linked users and revokes persisted links', async () => {
    const target = await newUser();
    const first = await assign(target.id, basicId).expect(201);
    const second = await assign(target.id, basicId).expect(201);
    expect(first.body.assignment_id).toBe(second.body.assignment_id);
    const members = await api()
      .get(
        `/api/v1/users?role_id=${basicId}&organization_id=1&search=${target.login}`,
      )
      .set(auth())
      .expect(200);
    expect(members.body.data.map((user: { id: number }) => user.id)).toEqual([
      target.id,
    ]);
    await api()
      .delete(
        `/api/v1/users/${target.id}/role-assignments/${first.body.assignment_id}`,
      )
      .set(auth())
      .expect(204);
    const after = await api()
      .get(`/api/v1/users/${target.id}`)
      .set(auth())
      .expect(200);
    expect(after.body.role_assignments).toEqual([]);
    const stored = await db
      .getRepository(UserRoleAssignmentEntity)
      .findOneByOrFail({ id: first.body.assignment_id });
    expect(Boolean(stored.isActive)).toBe(false);
    expect(stored.revokedAt).not.toBeNull();
  });

  it('blocks invalid roles, platform escalation, foreign roles and foreign users', async () => {
    const target = await newUser();
    const foreign = await newUser(otherOrgId);
    await assign(target.id, 999999).expect(400);
    await assign(target.id, platformId).expect(409);
    await assign(target.id, foreignRoleId).expect(403);
    await assign(foreign.id, basicId).expect(403);
    const valid = await assign(target.id, basicId).expect(201);
    await api()
      .delete(
        `/api/v1/users/${target.id}/role-assignments/${valid.body.assignment_id}`,
      )
      .set(auth(operator))
      .expect(403);
    await api()
      .put(`/api/v1/users/${target.id}/role-assignments`)
      .set(auth())
      .send({ role_ids: [platformId] })
      .expect(403);
    await api()
      .put(`/api/v1/users/${target.id}/role-assignments`)
      .set(auth())
      .send({ role_ids: [foreignRoleId] })
      .expect(403);
    await api()
      .put(`/api/v1/users/${foreign.id}/role-assignments`)
      .set(auth())
      .send({ role_ids: [] })
      .expect(403);
    await api()
      .get(`/api/v1/users?organization_id=${otherOrgId}`)
      .set(auth())
      .expect(403);
  });

  it('protects the last organization administrator across revoke, replacement, deactivation and transfer', async () => {
    const assignments = await api()
      .get('/api/v1/users/2/role-assignments')
      .set(auth())
      .expect(200);
    const assignment = assignments.body.find(
      (role: { role_id: number }) => role.role_id === adminId,
    );
    await api()
      .delete(`/api/v1/users/2/role-assignments/${assignment.assignment_id}`)
      .set(auth())
      .expect(409);
    await api()
      .put('/api/v1/users/2/role-assignments')
      .set(auth())
      .send({ role_ids: [basicId] })
      .expect(409);
    await api().post('/api/v1/users/2/deactivate').set(auth()).expect(409);
    await api()
      .patch('/api/v1/users/2')
      .set(auth(platform))
      .send({ organization_id: otherOrgId })
      .expect(409);
    await api().get('/api/v1/users').set(auth()).expect(200);
  });

  it('accumulates grants and refreshes existing sessions immediately after revocation and replacement', async () => {
    const target = await newUser();
    const read = await db
      .getRepository(PermissionEntity)
      .findOneByOrFail({ key: 'projects:read' });
    const companyRead = await db
      .getRepository(PermissionEntity)
      .findOneByOrFail({ key: 'companies:read' });
    const roleA = await api()
      .post('/api/v1/organizations/1/roles')
      .set(auth())
      .send({ name: 'Consulta A', permission_ids: [Number(read.id)] })
      .expect(201);
    const roleB = await api()
      .post('/api/v1/organizations/1/roles')
      .set(auth())
      .send({
        name: 'Consulta B',
        permission_ids: [Number(read.id), Number(companyRead.id)],
      })
      .expect(201);
    const session = await api()
      .post('/api/v1/auth/login')
      .send({
        identifier: target.login,
        password: 'Personal test password 2026!',
      })
      .expect(200);
    const first = await assign(target.id, roleA.body.id).expect(201);
    await assign(target.id, roleB.body.id).expect(201);
    let me = await api()
      .get('/api/v1/auth/me')
      .set(auth(session.body.access_token))
      .expect(200);
    expect(
      me.body.permissions.map((p: { key: string }) => p.key).sort(),
    ).toEqual(['companies:read', 'projects:read']);
    await api()
      .delete(
        `/api/v1/users/${target.id}/role-assignments/${first.body.assignment_id}`,
      )
      .set(auth())
      .expect(204);
    me = await api()
      .get('/api/v1/auth/me')
      .set(auth(session.body.access_token))
      .expect(200);
    expect(me.body.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'projects:read' }),
      ]),
    );
    await api()
      .put(`/api/v1/users/${target.id}/role-assignments`)
      .set(auth())
      .send({ role_ids: [basicId] })
      .expect(200);
    me = await api()
      .get('/api/v1/auth/me')
      .set(auth(session.body.access_token))
      .expect(200);
    expect(me.body.permissions).toEqual([]);
    await api()
      .get('/api/v1/projects')
      .set(auth(session.body.access_token))
      .expect(403);
  });

  it('preserves administrator requirements for the operator and blocks deactivation bypasses', async () => {
    await api().get('/api/v1/users').set(auth(operator)).expect(403);
    const operatorRole = await db
      .getRepository(RoleEntity)
      .findOneByOrFail({ name: 'Operador' });
    await api()
      .patch(`/api/v1/organizations/1/roles/${operatorRole.id}`)
      .set(auth())
      .send({ is_active: false })
      .expect(409);
    await api()
      .delete(`/api/v1/organizations/1/roles/${operatorRole.id}`)
      .set(auth())
      .expect(409);
  });

  it('allows administrative revocation when another active administrator remains', async () => {
    const first = await newUser();
    const second = await newUser();
    const assigned = await assign(first.id, adminId).expect(201);
    await assign(second.id, adminId).expect(201);
    await api()
      .delete(
        `/api/v1/users/${first.id}/role-assignments/${assigned.body.assignment_id}`,
      )
      .set(auth())
      .expect(204);
    await api()
      .post(`/api/v1/users/${second.id}/deactivate`)
      .set(auth())
      .expect(200);
  });

  it('requires an active destination organization even for platform administrators', async () => {
    const target = await newUser(otherOrgId);
    const organizations = db.getRepository(OrganizationEntity);
    await organizations.update(otherOrgId, {
      status: OrganizationStatus.INACTIVE,
    });
    try {
      await api()
        .get(`/api/v1/access-profiles?organization_id=${otherOrgId}`)
        .set(auth(platform))
        .expect(404);
      await assign(target.id, basicId, platform).expect(403);
      await api()
        .put(`/api/v1/users/${target.id}/role-assignments`)
        .set(auth(platform))
        .send({ role_ids: [basicId] })
        .expect(403);
    } finally {
      await organizations.update(otherOrgId, {
        status: OrganizationStatus.ACTIVE,
      });
    }
  });

  (process.env.GAI_TEST_MYSQL_DISPOSABLE === '1' ? it : it.skip)(
    'serializes concurrent assignment and cross-operation last-admin removal on MySQL',
    async () => {
      const target = await newUser();
      const duplicates = await Promise.all([
        assign(target.id, basicId),
        assign(target.id, basicId),
      ]);
      expect(duplicates.map((response) => response.status)).toEqual([201, 201]);
      expect(duplicates[0].body.assignment_id).toBe(
        duplicates[1].body.assignment_id,
      );
      const organization = await api()
        .post('/api/v1/organizations')
        .set(auth(platform))
        .send({ legal_name: 'Concorrência', cnpj: '11444777000161' })
        .expect(201);
      const a = await newUser(organization.body.id);
      const b = await newUser(organization.body.id);
      const grant = await assign(a.id, adminId, platform).expect(201);
      await assign(b.id, adminId, platform).expect(201);
      const results = await Promise.all([
        api()
          .delete(
            `/api/v1/users/${a.id}/role-assignments/${grant.body.assignment_id}`,
          )
          .set(auth(platform)),
        api().post(`/api/v1/users/${b.id}/deactivate`).set(auth(platform)),
      ]);
      expect(
        results.filter((response) => response.status === 409),
      ).toHaveLength(1);
      expect(
        results.filter(
          (response) => response.status >= 200 && response.status < 300,
        ),
      ).toHaveLength(1);
    },
  );
});
