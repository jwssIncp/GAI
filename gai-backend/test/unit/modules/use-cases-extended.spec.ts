import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { ConfirmPasswordResetUseCase } from '../../../src/modules/auth/application/use-cases/confirm-password-reset.use-case';
import { RequestPasswordResetUseCase } from '../../../src/modules/auth/application/use-cases/request-password-reset.use-case';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/login.use-case';
import { UpdateOrganizationUseCase } from '../../../src/modules/organizations/application/use-cases/update-organization.use-case';
import { DeactivateOrganizationUseCase } from '../../../src/modules/organizations/application/use-cases/deactivate-organization.use-case';
import { User } from '../../../src/modules/auth/domain/entities/user';
import {
  UserRole,
  UserStatus,
} from '../../../src/modules/auth/domain/enums/user.enums';
import { Organization } from '../../../src/modules/organizations/domain/entities/organization';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { Cnpj } from '../../../src/modules/organizations/domain/value-objects/cnpj';

describe('Auth use cases (extended)', () => {
  const now = new Date();
  const adminUser = new User({
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

  it('LoginUseCase succeeds with valid credentials', async () => {
    const users = {
      findByLoginOrEmail: jest.fn().mockResolvedValue(adminUser),
      save: jest.fn().mockResolvedValue(adminUser),
    };
    const sessions = { create: jest.fn().mockResolvedValue({}) };
    const hasher = {
      verify: jest.fn().mockResolvedValue(true),
      hash: jest.fn(),
    };
    const orgGate = { isActive: jest.fn() };
    const audit = { save: jest.fn() };
    const configService = {
      get: (_key: string, fallback?: unknown) => fallback,
    } as ConfigService;
    const logger = {
      setContext: jest.fn(),
      info: jest.fn(),
    } as unknown as PinoLogger;

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
    const useCase = new LoginUseCase(
      users as never,
      sessions as never,
      hasher,
      orgGate,
      audit,
      assignments as never,
      configService,
      logger,
    );

    const result = await useCase.execute(
      { identifier: 'admin', password: 'Admin@123456' },
      '127.0.0.1',
    );
    expect(result.access_token).toBeDefined();
    expect(result.user.role_assignments[0].role_key).toBe(
      UserRole.PLATFORM_ADMIN,
    );
  });

  it('RequestPasswordResetUseCase returns generic message when user missing', async () => {
    const users = { findByEmail: jest.fn().mockResolvedValue(null) };
    const tokens = { invalidateAllForUser: jest.fn(), create: jest.fn() };
    const emailSender = { sendPasswordResetEmail: jest.fn() };
    const audit = { save: jest.fn() };
    const configService = { get: () => 1 } as unknown as ConfigService;
    const logger = {
      setContext: jest.fn(),
      info: jest.fn(),
    } as unknown as PinoLogger;

    const useCase = new RequestPasswordResetUseCase(
      users as never,
      tokens as never,
      emailSender,
      audit,
      configService,
      logger,
    );

    const result = await useCase.execute({ email: 'missing@test.com' }, null);
    expect(result.message).toContain('If the email is registered');
  });

  it('ConfirmPasswordResetUseCase rejects invalid token', async () => {
    const tokens = { findValidByHash: jest.fn().mockResolvedValue(null) };
    const useCase = new ConfirmPasswordResetUseCase(
      tokens as never,
      {} as never,
      {} as never,
      {} as never,
      { save: jest.fn() },
      { setContext: jest.fn(), info: jest.fn() } as never,
    );

    await expect(
      useCase.execute({ token: 'bad', new_password: 'NewPass@123456' }, null),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('Organization use cases (extended)', () => {
  const org = new Organization({
    id: 1,
    legalName: 'Org',
    tradeName: 'Trade',
    cnpj: Cnpj.fromPersisted('11222333000181'),
    contactEmail: 'a@b.com',
    contactPhone: '11999999999',
    status: OrganizationStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('UpdateOrganizationUseCase rejects CNPJ change', async () => {
    const repository = { findById: jest.fn() };
    const logger = { setContext: jest.fn(), info: jest.fn() } as never;
    const useCase = new UpdateOrganizationUseCase(repository as never, logger);

    await expect(
      useCase.execute(1, { cnpj: '11222333000181' } as never, null),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('DeactivateOrganizationUseCase deactivates active org', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(org),
      saveWithAudit: jest.fn().mockImplementation(async (o: Organization) => o),
    };
    const sessions = {
      revokeAllForOrganization: jest.fn().mockResolvedValue(3),
    };
    const logger = { setContext: jest.fn(), info: jest.fn() } as never;
    const useCase = new DeactivateOrganizationUseCase(
      repository as never,
      sessions as never,
      logger,
    );

    const result = await useCase.execute(1, 1);
    expect(result.status).toBe(OrganizationStatus.INACTIVE);
    expect(sessions.revokeAllForOrganization).toHaveBeenCalledWith(
      1,
      expect.any(Date),
    );
  });
});
