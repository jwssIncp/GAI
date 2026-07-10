import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { LoginUseCase } from '../../../../src/modules/auth/application/use-cases/login.use-case';
import { AuthAuditResult } from '../../../../src/modules/auth/domain/enums/auth-audit.enums';
import {
  UserRole,
  UserStatus,
} from '../../../../src/modules/auth/domain/enums/user.enums';
import { User } from '../../../../src/modules/auth/domain/entities/user';

describe('LoginUseCase', () => {
  const now = new Date();
  const baseUser = new User({
    id: 1,
    organizationId: null,
    login: 'admin',
    email: 'admin@test.com',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const users = {
    findByLoginOrEmail: jest.fn(),
    save: jest.fn(),
  };
  const sessions = { create: jest.fn() };
  const hasher = { verify: jest.fn(), hash: jest.fn() };
  const orgGate = { isActive: jest.fn() };
  const audit = { save: jest.fn() };
  const assignments = {
    findActiveByUserId: jest.fn().mockResolvedValue([
      {
        assignmentId: 1,
        roleId: 1,
        roleKey: UserRole.PLATFORM_ADMIN,
        roleName: 'Platform Administrator',
        roleType: 'SYSTEM',
        organizationId: null,
        isActive: true,
        assignedAt: now,
      },
    ]),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const map: Record<string, unknown> = {
        'auth.lockoutMaxAttempts': 5,
        'auth.lockoutDurationMinutes': 30,
        'auth.sessionTtlHours': 8,
      };
      return map[key] ?? fallback;
    }),
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
  } as unknown as PinoLogger;

  let useCase: LoginUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new LoginUseCase(
      users as never,
      sessions as never,
      hasher,
      orgGate,
      audit,
      assignments as never,
      configService as unknown as ConfigService,
      logger,
    );
  });

  it('locks account after max failed attempts', async () => {
    users.findByLoginOrEmail.mockResolvedValue(baseUser);
    hasher.verify.mockResolvedValue(false);
    users.save.mockImplementation(async (user: User) => user);
    sessions.create.mockResolvedValue({});

    for (let i = 0; i < 4; i++) {
      await expect(
        useCase.execute({ identifier: 'admin', password: 'wrong' }, null),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    await expect(
      useCase.execute({ identifier: 'admin', password: 'wrong' }, null),
    ).rejects.toMatchObject({ status: HttpStatus.LOCKED });

    expect(audit.save).toHaveBeenCalledWith(
      expect.objectContaining({ result: AuthAuditResult.FAILURE }),
    );
  });
});
