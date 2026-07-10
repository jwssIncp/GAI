import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../../data-source';
import { OrganizationStatus } from '../../modules/organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../modules/organizations/infrastructure/persistence/organization.entity';
import { UserStatus } from '../../modules/auth/domain/enums/user.enums';
import { UserEntity } from '../../modules/auth/infrastructure/persistence/user.entity';
import { Argon2PasswordHasher } from '../../modules/auth/infrastructure/security/argon2-password-hasher';
import { RoleType } from '../../modules/users/domain/enums/role-type.enum';
import { RoleEntity } from '../../modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../modules/users/infrastructure/persistence/permission.entity';
import { UserRoleAssignmentEntity } from '../../modules/users/infrastructure/persistence/user-role-assignment.entity';
import { seedPermissions } from './permissions.seed';

config();

async function ensureSystemRole(
  roleRepo: ReturnType<typeof dataSource.getRepository<RoleEntity>>,
  key: string,
  name: string,
): Promise<RoleEntity> {
  let role = await roleRepo.findOne({ where: { key, type: RoleType.SYSTEM } });
  if (!role) {
    const now = new Date();
    role = await roleRepo.save(
      roleRepo.create({
        key,
        type: RoleType.SYSTEM,
        organizationId: null,
        name,
        description: name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
    console.log(`Created system role ${key}`);
  }
  return role;
}

async function ensureAssignment(
  assignmentRepo: ReturnType<
    typeof dataSource.getRepository<UserRoleAssignmentEntity>
  >,
  userId: number,
  roleId: number,
): Promise<void> {
  const existing = await assignmentRepo.findOne({
    where: { userId, roleId, isActive: true },
  });
  if (!existing) {
    await assignmentRepo.save(
      assignmentRepo.create({
        userId,
        roleId,
        isActive: true,
        assignedBy: null,
        assignedAt: new Date(),
        revokedAt: null,
      }),
    );
  }
}

async function bootstrapSeed(): Promise<void> {
  await dataSource.initialize();
  const hasher = new Argon2PasswordHasher();

  const orgRepo = dataSource.getRepository(OrganizationEntity);
  const userRepo = dataSource.getRepository(UserEntity);
  const roleRepo = dataSource.getRepository(RoleEntity);
  const rolePermRepo = dataSource.getRepository(RolePermissionEntity);
  const assignmentRepo = dataSource.getRepository(UserRoleAssignmentEntity);
  const permissionRepo = dataSource.getRepository(PermissionEntity);

  await seedPermissions(dataSource);

  const platformAdminRole = await ensureSystemRole(
    roleRepo,
    'PLATFORM_ADMIN',
    'Platform Administrator',
  );
  const orgAdminRole = await ensureSystemRole(
    roleRepo,
    'ORG_ADMIN',
    'Organization Administrator',
  );

  const cnpj = process.env.SEED_ORG_CNPJ ?? '11222333000181';
  let organization = await orgRepo.findOne({ where: { cnpj } });

  if (!organization) {
    const now = new Date();
    organization = orgRepo.create({
      legalName: process.env.SEED_ORG_LEGAL_NAME ?? 'GAI Test Organization',
      tradeName: 'GAI Test',
      cnpj,
      contactEmail: 'org@gai.local',
      contactPhone: '11999999999',
      status: OrganizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    organization = await orgRepo.save(organization);
    console.log(`Created organization ${organization.id}`);
  }

  let operatorRole = await roleRepo.findOne({
    where: {
      organizationId: organization.id,
      name: 'Operador',
      type: RoleType.ORGANIZATION,
    },
  });
  if (!operatorRole) {
    const now = new Date();
    operatorRole = await roleRepo.save(
      roleRepo.create({
        key: null,
        type: RoleType.ORGANIZATION,
        organizationId: organization.id,
        name: 'Operador',
        description: 'Basic operator role',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const usersRead = await permissionRepo.findOne({
      where: { key: 'users:read' },
    });
    if (usersRead) {
      await rolePermRepo.save({
        roleId: operatorRole.id,
        permissionId: usersRead.id,
      });
    }
  }

  const adminLogin = process.env.SEED_ADMIN_LOGIN ?? 'platform.admin';
  let admin = await userRepo.findOne({ where: { login: adminLogin } });
  if (!admin) {
    const now = new Date();
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';
    admin = userRepo.create({
      organizationId: null,
      login: adminLogin,
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@gai.local',
      passwordHash: await hasher.hash(password),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    admin = await userRepo.save(admin);
    console.log(`Created platform admin ${admin.login}`);
  }
  await ensureAssignment(assignmentRepo, admin.id, platformAdminRole.id);

  const orgAdminLogin = process.env.SEED_ORG_ADMIN_LOGIN ?? 'org.admin';
  let orgAdmin = await userRepo.findOne({ where: { login: orgAdminLogin } });
  if (!orgAdmin) {
    const now = new Date();
    const password = process.env.SEED_ORG_ADMIN_PASSWORD ?? 'Admin@123456';
    orgAdmin = userRepo.create({
      organizationId: organization.id,
      login: orgAdminLogin,
      email: process.env.SEED_ORG_ADMIN_EMAIL ?? 'orgadmin@gai.local',
      passwordHash: await hasher.hash(password),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    orgAdmin = await userRepo.save(orgAdmin);
    console.log(`Created org admin ${orgAdmin.login}`);
  }
  await ensureAssignment(assignmentRepo, orgAdmin.id, orgAdminRole.id);

  const testLogin = process.env.SEED_TEST_USER_LOGIN ?? 'test.user';
  let testUser = await userRepo.findOne({ where: { login: testLogin } });
  if (!testUser) {
    const now = new Date();
    const password = process.env.SEED_TEST_USER_PASSWORD ?? 'Test@123456';
    testUser = userRepo.create({
      organizationId: organization.id,
      login: testLogin,
      email: process.env.SEED_TEST_USER_EMAIL ?? 'test@gai.local',
      passwordHash: await hasher.hash(password),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    testUser = await userRepo.save(testUser);
    console.log(`Created test user ${testUser.login}`);
  }
  await ensureAssignment(assignmentRepo, testUser.id, operatorRole.id);

  await dataSource.destroy();
  console.log('Bootstrap seed completed');
}

bootstrapSeed().catch((error) => {
  console.error(error);
  process.exit(1);
});
