import { UnauthorizedException } from '@nestjs/common';
import { User } from '../../../../src/modules/auth/domain/entities/user';
import {
  UserRole,
  UserStatus,
} from '../../../../src/modules/auth/domain/enums/user.enums';
import { SessionAuthGuard } from '../../../../src/modules/auth/presentation/guards/session-auth.guard';

function makeUser(
  status = UserStatus.ACTIVE,
  organizationId: number | null = 1,
  lockedUntil: Date | null = null,
): User {
  const now = new Date();
  return new User({
    id: 10,
    organizationId,
    login: 'session.user',
    email: 'session.user@test.local',
    passwordHash: 'hash',
    status,
    failedLoginAttempts: 0,
    lockedUntil,
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

describe('SessionAuthGuard session eligibility', () => {
  const sessions = {
    findActiveById: jest.fn(),
    touch: jest.fn(),
  };
  const users = { findById: jest.fn() };
  const permissionResolver = {
    resolveForUser: jest.fn().mockResolvedValue([]),
  };
  const assignments = {
    findActiveByUserId: jest.fn().mockResolvedValue([]),
  };
  const roleAuth = {
    extractSystemRoles: jest.fn().mockReturnValue([UserRole.ORG_USER]),
    resolvePrimaryRole: jest.fn().mockReturnValue(UserRole.ORG_USER),
  };
  const config = { get: jest.fn().mockReturnValue(8) };
  const organizationGate = { isActive: jest.fn() };

  function createGuard(): SessionAuthGuard {
    return new SessionAuthGuard(
      sessions as never,
      users as never,
      permissionResolver as never,
      assignments as never,
      roleAuth as never,
      config as never,
      organizationGate,
    );
  }

  function createContext(): {
    context: never;
    request: { headers: { authorization: string }; user?: unknown };
  } {
    const request: {
      headers: { authorization: string };
      user?: unknown;
    } = { headers: { authorization: 'Bearer valid-session' } };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as never,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    sessions.findActiveById.mockResolvedValue({
      id: 'valid-session',
      userId: 10,
      organizationId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });
    users.findById.mockResolvedValue(makeUser());
    organizationGate.isActive.mockResolvedValue(true);
    permissionResolver.resolveForUser.mockResolvedValue([]);
    assignments.findActiveByUserId.mockResolvedValue([]);
  });

  it('accepts an active user in an active organization and renews afterwards', async () => {
    const { context, request } = createContext();

    await expect(createGuard().canActivate(context)).resolves.toBe(true);

    expect(organizationGate.isActive).toHaveBeenCalledWith(1);
    expect(sessions.touch).toHaveBeenCalledWith(
      'valid-session',
      expect.any(Date),
      expect.any(Date),
    );
    expect(organizationGate.isActive.mock.invocationCallOrder[0]).toBeLessThan(
      sessions.touch.mock.invocationCallOrder[0],
    );
    expect(request.user).toEqual(
      expect.objectContaining({ id: 10, sessionId: 'valid-session' }),
    );
  });

  it('rejects an inactive user without renewing the session', async () => {
    users.findById.mockResolvedValue(makeUser(UserStatus.INACTIVE));
    const { context } = createContext();

    await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(organizationGate.isActive).not.toHaveBeenCalled();
    expect(sessions.touch).not.toHaveBeenCalled();
  });

  it('rejects a currently locked user without renewing the session', async () => {
    users.findById.mockResolvedValue(
      makeUser(UserStatus.ACTIVE, 1, new Date(Date.now() + 60_000)),
    );
    const { context } = createContext();

    await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(organizationGate.isActive).not.toHaveBeenCalled();
    expect(sessions.touch).not.toHaveBeenCalled();
  });

  it('rejects a user from an inactive organization without renewing', async () => {
    organizationGate.isActive.mockResolvedValue(false);
    const { context } = createContext();

    await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(organizationGate.isActive).toHaveBeenCalledWith(1);
    expect(sessions.touch).not.toHaveBeenCalled();
  });

  it('does not require an organization for a platform user', async () => {
    users.findById.mockResolvedValue(makeUser(UserStatus.ACTIVE, null));
    const { context } = createContext();

    await expect(createGuard().canActivate(context)).resolves.toBe(true);

    expect(organizationGate.isActive).not.toHaveBeenCalled();
    expect(sessions.touch).toHaveBeenCalled();
  });
});
