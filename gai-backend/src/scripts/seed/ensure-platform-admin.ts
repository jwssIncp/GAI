import 'reflect-metadata';
import { config } from 'dotenv';
import { isEmail } from 'class-validator';
import { IsNull } from 'typeorm';
import dataSource from '../../../data-source';
import {
  UserRole,
  UserStatus,
} from '../../modules/auth/domain/enums/user.enums';
import { UserEntity } from '../../modules/auth/infrastructure/persistence/user.entity';
import { Argon2PasswordHasher } from '../../modules/auth/infrastructure/security/argon2-password-hasher';
import { Password } from '../../modules/auth/domain/value-objects/password';
import { LOGIN_PATTERN } from '../../common/validation/user-input';
import { rotateCredential } from '../../modules/auth/infrastructure/persistence/credential-rotation';
import { lockUser } from '../../modules/auth/application/services/credential-transactions.service';
import { lockAccessAdministration } from '../../modules/users/infrastructure/persistence/access-administration-lock';
import { UserAuditLogEntity } from '../../modules/users/infrastructure/persistence/user-audit-log.entity';
import { RoleType } from '../../modules/users/domain/enums/role-type.enum';
import { RoleEntity } from '../../modules/users/infrastructure/persistence/role.entity';
import { UserRoleAssignmentEntity } from '../../modules/users/infrastructure/persistence/user-role-assignment.entity';
import { seedPermissions } from './permissions.seed';
config();
// Operations entry point; never executed by the user-module implementation task.
// Existing passwords remain unchanged unless an operator explicitly passes --reset-password.
async function ensurePlatformAdmin(): Promise<void> {
  const requestedLogin = process.env.PLATFORM_ADMIN_LOGIN,
    requestedEmail = process.env.PLATFORM_ADMIN_EMAIL,
    password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!requestedLogin || !requestedEmail || !password) {
    console.log('PLATFORM_ADMIN_* not set, skipping platform admin bootstrap');
    return;
  }
  const login = requestedLogin.trim().toLowerCase(),
    email = requestedEmail.trim().toLowerCase();
  await dataSource.initialize();
  try {
    await seedPermissions(dataSource);
    await dataSource.transaction(async (manager) => {
      await lockAccessAdministration(manager);
      const roles = manager.getRepository(RoleEntity),
        users = manager.getRepository(UserEntity);
      let role = await roles.findOneBy({
        key: UserRole.PLATFORM_ADMIN,
        type: RoleType.SYSTEM,
        organizationId: IsNull(),
      });
      if (!role)
        role = await roles.save({
          key: UserRole.PLATFORM_ADMIN,
          type: RoleType.SYSTEM,
          organizationId: null,
          name: 'Platform Administrator',
          description: 'Full platform access',
          isActive: true,
        });
      else if (!role.isActive) {
        role.isActive = true;
        await roles.save(role);
      }
      const existing = await users.findOneBy({ login });
      let admin = existing ? await lockUser(manager, existing.id) : null;
      const hasher = new Argon2PasswordHasher();
      if (!admin) {
        if (!LOGIN_PATTERN.test(login) || !isEmail(email))
          throw Error('Invalid platform administrator identity.');
        const hash = await hasher.hash(Password.create(password).getValue());
        admin = await users.save({
          organizationId: null,
          login,
          email,
          passwordHash: hash,
          status: UserStatus.ACTIVE,
          passwordChangedAt: new Date(),
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(
            Date.now() +
              Number(process.env.TEMPORARY_PASSWORD_TTL_HOURS || 24) * 3600000,
          ),
        });
        await manager.getRepository(UserAuditLogEntity).save({
          userId: admin.id,
          operation: 'BOOTSTRAP_CREATE',
          performedBy: null,
          changes: { login: { before: null, after: admin.login } },
        });
      } else if (process.argv.includes('--reset-password')) {
        await rotateCredential(
          manager,
          admin,
          await hasher.hash(Password.create(password).getValue()),
          true,
          Number(process.env.TEMPORARY_PASSWORD_TTL_HOURS || 24),
        );
        await manager.getRepository(UserAuditLogEntity).save({
          userId: admin.id,
          operation: 'PASSWORD_RESET',
          performedBy: null,
          changes: {
            password: { before: '[redacted]', after: '[redacted]' },
          },
        });
      }
      const assignments = manager.getRepository(UserRoleAssignmentEntity);
      if (
        !(await assignments.existsBy({
          userId: admin.id,
          roleId: role.id,
          isActive: true,
          revokedAt: IsNull(),
        }))
      )
        await assignments.save({
          userId: admin.id,
          roleId: role.id,
          isActive: true,
          assignedBy: null,
          assignedAt: new Date(),
        });
    });
    console.log(
      'Platform administrator bootstrap completed; credentials were not logged.',
    );
  } finally {
    await dataSource.destroy();
  }
}
ensurePlatformAdmin().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Platform administrator bootstrap failed',
  );
  process.exitCode = 1;
});
