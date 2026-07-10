import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { ProjectStatus } from '../../../src/modules/projects/domain/enums/project-status.enum';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import { RoleType } from '../../../src/modules/users/domain/enums/role-type.enum';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface CreatedUserBody {
  id: number;
  organization_id: number | null;
}

interface ProjectListBody {
  items: Array<{ id: number; organization_id: number }>;
}

describe('RBAC multi-tenancy isolation (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let orgAdminToken: string;
  let orgUserToken: string;
  let organizationBId: number;
  let roleAId: number;
  let roleBId: number;
  let inactiveRoleId: number;
  let temporaryRoleId: number;
  let organizationAUserId: number;
  let organizationBUserId: number;
  let platformUserId: number;
  let temporaryUserId: number;
  let temporaryAssignmentId: number;
  let projectBId: number;
  let temporaryUserToken: string;
  let legacyNoOrganizationToken: string;

  let userRepo: Repository<UserEntity>;
  let roleRepo: Repository<RoleEntity>;
  let assignmentRepo: Repository<UserRoleAssignmentEntity>;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    adminToken = await loginAsAdmin(app);
    orgAdminToken = await loginAsOrgAdmin(app);
    orgUserToken = await loginAsOrgUser(app);

    const organizationRepo = app.get<Repository<OrganizationEntity>>(
      getRepositoryToken(OrganizationEntity),
    );
    const permissionRepo = app.get<Repository<PermissionEntity>>(
      getRepositoryToken(PermissionEntity),
    );
    const rolePermissionRepo = app.get<Repository<RolePermissionEntity>>(
      getRepositoryToken(RolePermissionEntity),
    );
    const projectRepo = app.get<Repository<ProjectEntity>>(
      getRepositoryToken(ProjectEntity),
    );
    userRepo = app.get(getRepositoryToken(UserEntity));
    roleRepo = app.get(getRepositoryToken(RoleEntity));
    assignmentRepo = app.get(getRepositoryToken(UserRoleAssignmentEntity));

    const now = new Date();
    const organizationB = await organizationRepo.save(
      organizationRepo.create({
        legalName: 'Organization B',
        tradeName: 'Tenant B',
        cnpj: '99888777000166',
        contactEmail: 'tenant-b@gai.local',
        contactPhone: '11988887777',
        status: OrganizationStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      }),
    );
    organizationBId = Number(organizationB.id);

    const roleA = await roleRepo.findOneOrFail({
      where: {
        organizationId: 1,
        name: 'Operador',
        type: RoleType.ORGANIZATION,
      },
    });
    roleAId = Number(roleA.id);

    const projectReadPermission = await permissionRepo.findOneOrFail({
      where: { key: 'projects:read' },
    });
    const roleB = await roleRepo.save(
      roleRepo.create({
        key: null,
        type: RoleType.ORGANIZATION,
        organizationId: organizationBId,
        name: 'Tenant B Reader',
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
    roleBId = Number(roleB.id);
    await rolePermissionRepo.save(
      rolePermissionRepo.create({
        roleId: roleBId,
        permissionId: Number(projectReadPermission.id),
      }),
    );

    const inactiveRole = await roleRepo.save(
      roleRepo.create({
        key: null,
        type: RoleType.ORGANIZATION,
        organizationId: 1,
        name: 'Inactive Tenant A Role',
        description: null,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      }),
    );
    inactiveRoleId = Number(inactiveRole.id);

    const temporaryRole = await roleRepo.save(
      roleRepo.create({
        key: null,
        type: RoleType.ORGANIZATION,
        organizationId: 1,
        name: 'Temporary Project Reader',
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
    temporaryRoleId = Number(temporaryRole.id);
    await rolePermissionRepo.save(
      rolePermissionRepo.create({
        roleId: temporaryRoleId,
        permissionId: Number(projectReadPermission.id),
      }),
    );

    organizationAUserId = await createUser({
      login: 'rbac.tenant.a',
      email: 'rbac.tenant.a@gai.local',
      password: 'TenantA@123456',
      organization_id: 1,
    });
    organizationBUserId = await createUser({
      login: 'rbac.tenant.b',
      email: 'rbac.tenant.b@gai.local',
      password: 'TenantB@123456',
      organization_id: organizationBId,
    });
    platformUserId = await createUser({
      login: 'rbac.platform',
      email: 'rbac.platform@gai.local',
      password: 'Platform@123456',
    });
    temporaryUserId = await createUser({
      login: 'rbac.temporary',
      email: 'rbac.temporary@gai.local',
      password: 'Temporary@123456',
      organization_id: 1,
    });
    const legacyNoOrganizationUserId = await createUser({
      login: 'rbac.legacy.null-org',
      email: 'rbac.legacy.null-org@gai.local',
      password: 'Legacy@123456',
    });

    const seededAssignments = await assignmentRepo.save([
      assignmentRepo.create({
        userId: temporaryUserId,
        roleId: temporaryRoleId,
        isActive: true,
        assignedBy: null,
        assignedAt: now,
        revokedAt: null,
      }),
      assignmentRepo.create({
        userId: legacyNoOrganizationUserId,
        roleId: roleAId,
        isActive: true,
        assignedBy: null,
        assignedAt: now,
        revokedAt: null,
      }),
    ]);
    temporaryAssignmentId = Number(seededAssignments[0].id);

    temporaryUserToken = await login('rbac.temporary', 'Temporary@123456');
    legacyNoOrganizationToken = await login(
      'rbac.legacy.null-org',
      'Legacy@123456',
    );

    const projectB = await projectRepo.save(
      projectRepo.create({
        organizationId: organizationBId,
        companyId: null,
        name: 'Tenant B private project',
        description: null,
        status: ProjectStatus.DRAFT,
        startDate: null,
        endDate: null,
        finishedAt: null,
        settings: null,
        metadata: null,
        createdById: null,
        updatedById: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }),
    );
    projectBId = Number(projectB.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows PLATFORM_ADMIN to assign a platform role to a platform user', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/users/${platformUserId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: 1 })
      .expect(201)
      .expect((response) => {
        const body = response.body as { role_key: string };
        expect(body.role_key).toBe('PLATFORM_ADMIN');
      });

    const token = await login('rbac.platform', 'Platform@123456');
    await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('allows valid same-tenant assignment by PLATFORM_ADMIN and ORG_ADMIN', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/users/${organizationAUserId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: roleAId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${organizationAUserId}/role-assignments`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ role_id: roleAId })
      .expect(201);
  });

  it('blocks cross-tenant and null-organization custom role assignments', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/users/${organizationBUserId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: roleAId })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${platformUserId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: roleAId })
      .expect(403);

    expect(
      await assignmentRepo.count({
        where: {
          userId: organizationBUserId,
          roleId: roleAId,
          isActive: true,
        },
      }),
    ).toBe(0);
  });

  it('keeps ORG_ADMIN inside its own users and roles', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/users/${organizationAUserId}/role-assignments`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ role_id: roleBId })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${organizationBUserId}/role-assignments`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ role_id: roleBId })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationBId}/roles`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(403);
  });

  it('rejects assignment of an inactive role', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/users/${organizationAUserId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: inactiveRoleId })
      .expect(400);
  });

  it('isolates project list and detail between two organizations', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${orgUserToken}`)
      .expect(200);

    const body = response.body as ProjectListBody;
    expect(body.items.every((project) => project.organization_id === 1)).toBe(
      true,
    );
    expect(body.items.some((project) => project.id === projectBId)).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectBId}`)
      .set('Authorization', `Bearer ${orgUserToken}`)
      .expect(403);
  });

  it('does not authorize a legacy organization role assigned to a user without organization', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${legacyNoOrganizationToken}`)
      .expect(403);
  });

  it('removes effective permission immediately when an assignment is revoked', async () => {
    await request(app.getHttpServer())
      .delete(
        `/api/v1/users/${temporaryUserId}/role-assignments/${temporaryAssignmentId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${temporaryUserToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${temporaryUserId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: temporaryRoleId })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${temporaryUserToken}`)
      .expect(200);
  });

  it('removes effective permission immediately when a role becomes inactive', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${temporaryUserToken}`)
      .expect(200);

    await roleRepo.update({ id: temporaryRoleId }, { isActive: false });

    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${temporaryUserToken}`)
      .expect(403);
  });

  it('blocks organization change while incompatible assignments remain active', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${organizationAUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organization_id: organizationBId })
      .expect(409);

    const persisted = await userRepo.findOneByOrFail({
      id: organizationAUserId,
    });
    expect(persisted.organizationId).toBe(1);
  });

  it('keeps login and /auth/me working for valid users', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as CreatedUserBody;
        expect(body.organization_id).toBe(1);
      });
  });

  async function createUser(payload: {
    login: string;
    email: string;
    password: string;
    organization_id?: number;
  }): Promise<number> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    return (response.body as CreatedUserBody).id;
  }

  async function login(identifier: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(200);
    return (response.body as { access_token: string }).access_token;
  }
});
