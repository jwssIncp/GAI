import { ConflictException, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  UserRole,
  UserStatus,
} from '../../../../src/modules/auth/domain/enums/user.enums';
import { DeactivateUserUseCase } from '../../../../src/modules/users/application/use-cases/deactivate-user.use-case';
import { UserScopeService } from '../../../../src/modules/users/application/services/user-scope.service';
import { ManagedUser } from '../../../../src/modules/users/domain/entities/managed-user';
import { RoleType } from '../../../../src/modules/users/domain/enums/role-type.enum';

describe('DeactivateUserUseCase', () => {
  const now = new Date();
  const platformActor = {
    id: 1,
    systemRoles: [UserRole.PLATFORM_ADMIN],
    organizationId: null,
  };

  const orgUser = new ManagedUser({
    id: 5,
    organizationId: 1,
    login: 'org.user',
    email: 'org@test.com',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });

  const repository = {
    findById: jest.fn(),
    countActivePlatformAdmins: jest.fn(),
    saveWithAudit: jest.fn(),
  };
  const assignments = { findActiveByUserId: jest.fn() };
  const sessions = { revokeAllForUser: jest.fn() };
  const scope = new UserScopeService();
  const loggerMock = {
    setContext: jest.fn(),
    info: jest.fn(),
  };
  const logger = loggerMock as unknown as PinoLogger;

  let useCase: DeactivateUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new DeactivateUserUseCase(
      repository as never,
      assignments as never,
      sessions as never,
      scope,
      logger,
    );
  });

  it('deactivates non-platform-admin user', async () => {
    repository.findById.mockResolvedValue(orgUser);
    assignments.findActiveByUserId.mockResolvedValue([
      {
        assignmentId: 3,
        roleId: 3,
        roleKey: null,
        roleName: 'Operador',
        roleType: RoleType.ORGANIZATION,
        organizationId: 1,
        isActive: true,
        assignedAt: now,
      },
    ]);
    repository.saveWithAudit.mockImplementation((user: ManagedUser) =>
      Promise.resolve(user),
    );
    sessions.revokeAllForUser.mockResolvedValue(2);

    const result = await useCase.execute(5, platformActor);

    expect(result.status).toBe(UserStatus.INACTIVE);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(5, expect.any(Date));
    expect(repository.saveWithAudit).toHaveBeenCalled();
    expect(sessions.revokeAllForUser.mock.invocationCallOrder[0]).toBeLessThan(
      repository.saveWithAudit.mock.invocationCallOrder[0],
    );
    expect(loggerMock.info).toHaveBeenCalledWith({
      operation: 'DEACTIVATE_USER',
      userId: 5,
      sessionsRevoked: 2,
      result: 'SUCCESS',
    });
  });

  it('throws Conflict when deactivating last PLATFORM_ADMIN', async () => {
    const platformUser = new ManagedUser({
      id: 1,
      organizationId: null,
      login: 'platform.admin',
      email: 'admin@test.com',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    repository.findById.mockResolvedValue(platformUser);
    assignments.findActiveByUserId.mockResolvedValue([
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
    repository.countActivePlatformAdmins.mockResolvedValue(0);

    await expect(useCase.execute(1, platformActor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('throws NotFound when user does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute(999, platformActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
