import { Organization } from '../../../src/modules/organizations/domain/entities/organization';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { Cnpj } from '../../../src/modules/organizations/domain/value-objects/cnpj';
import { User } from '../../../src/modules/auth/domain/entities/user';
import {
  UserRole,
  UserStatus,
} from '../../../src/modules/auth/domain/enums/user.enums';
import { LogoutUseCase } from '../../../src/modules/auth/application/use-cases/logout.use-case';
import { GetCurrentUserUseCase } from '../../../src/modules/auth/application/use-cases/get-current-user.use-case';
import { UnauthorizedException } from '@nestjs/common';

describe('Organization entity', () => {
  const baseProps = {
    id: 1,
    legalName: 'Org',
    tradeName: null,
    cnpj: Cnpj.fromPersisted('11222333000181'),
    contactEmail: null,
    contactPhone: null,
    status: OrganizationStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('deactivates and activates', () => {
    const org = new Organization({ ...baseProps });
    org.deactivate();
    expect(org.status).toBe(OrganizationStatus.INACTIVE);
    org.activate();
    expect(org.status).toBe(OrganizationStatus.ACTIVE);
  });

  it('tracks field updates', () => {
    const org = new Organization({ ...baseProps });
    const changes = org.updateFields({ legalName: 'New Name' });
    expect(changes.legal_name?.after).toBe('New Name');
  });
});

describe('User entity', () => {
  const now = new Date();
  const user = new User({
    id: 1,
    organizationId: null,
    login: 'user',
    email: 'u@test.com',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  it('locks after failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      user.recordFailedLogin(5, 30, now);
    }
    expect(user.isLocked(now)).toBe(true);
  });

  it('resets on successful login', () => {
    user.recordSuccessfulLogin(now);
    expect(user.failedLoginAttempts).toBe(0);
  });
});

describe('LogoutUseCase', () => {
  it('revokes session and writes audit', async () => {
    const sessions = {
      findById: jest.fn().mockResolvedValue({ id: 's1', revokedAt: null }),
      revoke: jest.fn(),
    };
    const audit = { save: jest.fn() };
    const logger = { setContext: jest.fn(), info: jest.fn() } as never;
    const useCase = new LogoutUseCase(sessions as never, audit, logger);

    await useCase.execute('s1', 1, '127.0.0.1');
    expect(sessions.revoke).toHaveBeenCalled();
  });

  it('rejects missing session', async () => {
    const sessions = { findById: jest.fn().mockResolvedValue(null) };
    const audit = { save: jest.fn() };
    const logger = { setContext: jest.fn(), info: jest.fn() } as never;
    const useCase = new LogoutUseCase(sessions as never, audit, logger);

    await expect(useCase.execute('s1', 1, null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('GetCurrentUserUseCase', () => {
  it('returns current user dto', async () => {
    const now = new Date();
    const users = {
      findById: jest.fn().mockResolvedValue(
        new User({
          id: 1,
          organizationId: null,
          login: 'admin',
          email: 'a@test.com',
          passwordHash: 'hash',
          status: UserStatus.ACTIVE,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      ),
    };
    const assignments = {
      findActiveByUserId: jest.fn().mockResolvedValue([]),
    };
    const useCase = new GetCurrentUserUseCase(
      users as never,
      assignments as never,
      { resolveForUser: jest.fn().mockResolvedValue([]) },
    );
    const result = await useCase.execute(1);
    expect(result.login).toBe('admin');
  });
});
