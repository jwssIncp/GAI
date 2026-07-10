import { ConflictException, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  UserRole,
  UserStatus,
} from '../../../../src/modules/auth/domain/enums/user.enums';
import { RevokeUserRoleAssignmentUseCase } from '../../../../src/modules/users/application/use-cases/revoke-user-role-assignment.use-case';
import { UserScopeService } from '../../../../src/modules/users/application/services/user-scope.service';
import { ManagedUser } from '../../../../src/modules/users/domain/entities/managed-user';
import { RoleType } from '../../../../src/modules/users/domain/enums/role-type.enum';

describe('RevokeUserRoleAssignmentUseCase', () => {
  const now = new Date();
  const platformActor = {
    id: 1,
    systemRoles: [UserRole.PLATFORM_ADMIN],
    organizationId: null,
  };

  const targetUser = new ManagedUser({
    id: 5,
    organizationId: null,
    login: 'admin2',
    email: 'admin2@test.com',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });

  const users = { findById: jest.fn() };
  const assignments = {
    findAllActiveByUserId: jest.fn(),
    countActiveUsersWithSystemRole: jest.fn(),
    revoke: jest.fn(),
  };
  const scope = new UserScopeService();
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
  } as unknown as PinoLogger;

  let useCase: RevokeUserRoleAssignmentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RevokeUserRoleAssignmentUseCase(
      users as never,
      assignments as never,
      scope,
      logger,
    );
  });

  it('revokes organization role assignment', async () => {
    users.findById.mockResolvedValue(targetUser);
    assignments.findAllActiveByUserId.mockResolvedValue([
      {
        assignmentId: 7,
        roleId: 3,
        roleKey: null,
        roleName: 'Operador',
        roleType: RoleType.ORGANIZATION,
        organizationId: 1,
        isActive: true,
        assignedAt: now,
      },
    ]);

    await useCase.execute(5, 7, platformActor);

    expect(assignments.revoke).toHaveBeenCalledWith(7, expect.any(Date));
  });

  it('throws Conflict when revoking last PLATFORM_ADMIN assignment', async () => {
    users.findById.mockResolvedValue(targetUser);
    assignments.findAllActiveByUserId.mockResolvedValue([
      {
        assignmentId: 1,
        roleId: 1,
        roleKey: UserRole.PLATFORM_ADMIN,
        roleName: 'Platform Administrator',
        roleType: RoleType.SYSTEM,
        organizationId: null,
        isActive: true,
        assignedAt: now,
      },
    ]);
    assignments.countActiveUsersWithSystemRole.mockResolvedValue(0);

    await expect(useCase.execute(5, 1, platformActor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws NotFound when assignment does not exist', async () => {
    users.findById.mockResolvedValue(targetUser);
    assignments.findAllActiveByUserId.mockResolvedValue([]);

    await expect(useCase.execute(5, 99, platformActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
