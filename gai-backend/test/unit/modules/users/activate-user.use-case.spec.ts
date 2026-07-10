import { PinoLogger } from 'nestjs-pino';
import {
  UserRole,
  UserStatus,
} from '../../../../src/modules/auth/domain/enums/user.enums';
import { ActivateUserUseCase } from '../../../../src/modules/users/application/use-cases/activate-user.use-case';
import { UserScopeService } from '../../../../src/modules/users/application/services/user-scope.service';
import { ManagedUser } from '../../../../src/modules/users/domain/entities/managed-user';

describe('ActivateUserUseCase session invalidation', () => {
  const actor = {
    id: 1,
    systemRoles: [UserRole.ORG_ADMIN],
    organizationId: 1,
  };
  const repository = {
    findById: jest.fn(),
    saveWithAudit: jest.fn(),
  };
  const assignments = { findActiveByUserId: jest.fn() };
  const sessions = { revokeAllForUser: jest.fn() };
  const loggerMock = {
    setContext: jest.fn(),
    info: jest.fn(),
  };
  const logger = loggerMock as unknown as PinoLogger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('revokes historical sessions before reactivating the user', async () => {
    const now = new Date();
    const user = new ManagedUser({
      id: 5,
      organizationId: 1,
      login: 'inactive.user',
      email: 'inactive.user@test.local',
      passwordHash: 'hash',
      status: UserStatus.INACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    repository.findById.mockResolvedValue(user);
    repository.saveWithAudit.mockImplementation((managedUser: ManagedUser) =>
      Promise.resolve(managedUser),
    );
    assignments.findActiveByUserId.mockResolvedValue([]);
    sessions.revokeAllForUser.mockResolvedValue(1);
    const useCase = new ActivateUserUseCase(
      repository as never,
      assignments as never,
      sessions as never,
      new UserScopeService(),
      logger,
    );

    const result = await useCase.execute(5, actor);

    expect(result.status).toBe(UserStatus.ACTIVE);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(5, expect.any(Date));
    expect(sessions.revokeAllForUser.mock.invocationCallOrder[0]).toBeLessThan(
      repository.saveWithAudit.mock.invocationCallOrder[0],
    );
    expect(loggerMock.info).toHaveBeenCalledWith({
      operation: 'ACTIVATE_USER',
      userId: 5,
      sessionsRevoked: 1,
      result: 'SUCCESS',
    });
  });
});
