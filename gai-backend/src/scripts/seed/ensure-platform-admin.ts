import 'reflect-metadata';
import { config } from 'dotenv';
import { IsNull } from 'typeorm';
import dataSource from '../../../data-source';
import { UserRole, UserStatus } from '../../modules/auth/domain/enums/user.enums';
import { UserEntity } from '../../modules/auth/infrastructure/persistence/user.entity';
import { Argon2PasswordHasher } from '../../modules/auth/infrastructure/security/argon2-password-hasher';
import { RoleType } from '../../modules/users/domain/enums/role-type.enum';
import { RoleEntity } from '../../modules/users/infrastructure/persistence/role.entity';
import { UserRoleAssignmentEntity } from '../../modules/users/infrastructure/persistence/user-role-assignment.entity';
import { seedPermissions } from './permissions.seed';

config();

// Idempotent: runs on every deploy. Never changes an existing password unless
// --reset-password is passed (ops workflow), which also unlocks the account.
async function ensurePlatformAdmin(): Promise<void> {
  const login = process.env.PLATFORM_ADMIN_LOGIN;
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const resetPassword = process.argv.includes('--reset-password');

  if (!login || !email || !password) {
    console.log('PLATFORM_ADMIN_* not set, skipping platform admin bootstrap');
    return;
  }

  await dataSource.initialize();
  const hasher = new Argon2PasswordHasher();
  const userRepo = dataSource.getRepository(UserEntity);
  const roleRepo = dataSource.getRepository(RoleEntity);
  const assignmentRepo = dataSource.getRepository(UserRoleAssignmentEntity);

  await seedPermissions(dataSource);

  const now = new Date();
  let role = await roleRepo.findOne({
    where: { key: UserRole.PLATFORM_ADMIN, type: RoleType.SYSTEM },
  });
  if (!role) {
    role = await roleRepo.save(
      roleRepo.create({
        key: UserRole.PLATFORM_ADMIN,
        type: RoleType.SYSTEM,
        organizationId: null,
        name: 'Platform Administrator',
        description: 'Full platform access',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
  } else if (!role.isActive) {
    await roleRepo.update(role.id, { isActive: true, updatedAt: now });
  }

  let admin = await userRepo.findOne({ where: { login } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        organizationId: null,
        login,
        email,
        passwordHash: await hasher.hash(password),
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );
    console.log(`Created platform admin ${login}`);
  } else if (resetPassword) {
    await userRepo.update(admin.id, {
      passwordHash: await hasher.hash(password),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      updatedAt: now,
    });
    console.log(`Reset password and unlocked platform admin ${login}`);
  }

  const assignment = await assignmentRepo.findOne({
    where: {
      userId: admin.id,
      roleId: role.id,
      isActive: true,
      revokedAt: IsNull(),
    },
  });
  if (!assignment) {
    await assignmentRepo.save(
      assignmentRepo.create({
        userId: admin.id,
        roleId: role.id,
        isActive: true,
        assignedBy: null,
        assignedAt: now,
        revokedAt: null,
      }),
    );
    console.log(`Assigned PLATFORM_ADMIN to ${login}`);
  }

  await dataSource.destroy();
  console.log('Platform admin ensured');
}

ensurePlatformAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
