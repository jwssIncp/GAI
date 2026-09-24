import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '../../../src/common/interceptors/correlation-id.interceptor';
import { buildPaginatedResult } from '../../../src/common/pagination/paginated-result';
import appConfig from '../../../src/common/config/app.config';
import authConfig from '../../../src/common/config/auth.config';
import { RolesGuard } from '../../../src/modules/auth/presentation/guards/roles.guard';
import { SessionAuthGuard } from '../../../src/modules/auth/presentation/guards/session-auth.guard';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../src/modules/auth/domain/enums/user.enums';
import { UnauthorizedException } from '@nestjs/common';
import { DevAdminGuard } from '../../../src/modules/auth/presentation/guards/dev-admin.guard';
import { ActivateOrganizationUseCase } from '../../../src/modules/organizations/application/use-cases/activate-organization.use-case';
import { Organization } from '../../../src/modules/organizations/domain/entities/organization';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { Cnpj } from '../../../src/modules/organizations/domain/value-objects/cnpj';
import { MockEmailSender } from '../../../src/modules/auth/infrastructure/email/ses-email.sender';

describe('Common infrastructure', () => {
  it('buildPaginatedResult calculates pages', () => {
    const result = buildPaginatedResult(['a', 'b'], 2, 10, 25);
    expect(result.total_pages).toBe(3);
    expect(result.total_items).toBe(25);
  });

  it('HttpExceptionFilter formats validation errors', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: jest.fn().mockReturnThis(), json }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid',
        details: [{ field: 'cnpj', message: 'bad' }],
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('HttpExceptionFilter handles unknown errors', () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: jest.fn().mockReturnThis(),
          json,
        }),
      }),
    } as unknown as ArgumentsHost;

    try {
      filter.catch(new Error('boom'), host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('HttpExceptionFilter does not serialize a sensitive non-Error value', () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const password = 'filter-password-must-not-leak';
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: jest.fn().mockReturnThis(),
          json,
        }),
      }),
    } as unknown as ArgumentsHost;

    try {
      filter.catch({ request: { body: { password } } }, host);

      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(password);
      expect(errorSpy).toHaveBeenCalledWith(
        'Unexpected non-Error exception (object)',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('CorrelationIdInterceptor sets header', async () => {
    const interceptor = new CorrelationIdInterceptor();
    const setHeader = jest.fn();
    const request = { headers: {} as Record<string, string> };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ setHeader }),
      }),
    };

    await lastValueFrom(
      interceptor.intercept(context as never, { handle: () => of(true) }),
    );

    expect(setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      expect.any(String),
    );
  });
});

describe('Config factories', () => {
  it('loads app and auth config', () => {
    expect(appConfig().port).toBeGreaterThan(0);
    expect(authConfig().lockoutMaxAttempts).toBeGreaterThan(0);
  });
});

describe('RolesGuard', () => {
  it('allows when role matches', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.PLATFORM_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { systemRoles: [UserRole.PLATFORM_ADMIN] },
        }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(true);
  });

  it('denies when role mismatches', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.PLATFORM_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { systemRoles: [UserRole.ORG_USER] } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(false);
  });
});

describe('SessionAuthGuard', () => {
  it('rejects missing bearer token', async () => {
    const guard = new SessionAuthGuard(
      {} as never,
      {} as never,
      { resolveForUser: jest.fn().mockResolvedValue([]) } as never,
      { findActiveByUserId: jest.fn().mockResolvedValue([]) } as never,
      {
        extractSystemRoles: jest.fn().mockReturnValue([]),
        resolvePrimaryRole: jest.fn().mockReturnValue(null),
      } as never,
      { get: () => 8 } as never,
      { isActive: jest.fn().mockResolvedValue(true) },
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    };
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('DevAdminGuard', () => {
  it('sets dev admin user in non-production', () => {
    const guard = new DevAdminGuard({
      get: () => 'test',
    } as never);
    const request: { user?: unknown } = {};
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
    expect(request.user).toBeDefined();
  });
});

describe('MockEmailSender', () => {
  it('logs mock email without exposing its password reset token', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const sender = new MockEmailSender();
    const resetToken = 'mock-reset-token-must-not-leak';

    try {
      await expect(
        sender.sendPasswordResetEmail({
          to: 'a@b.com',
          resetToken,
        }),
      ).resolves.toBeUndefined();

      expect(logSpy).toHaveBeenCalledWith({
        operation: 'PASSWORD_RESET_EMAIL_DISPATCHED',
        provider: 'mock',
        recipientConfigured: true,
      });
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain(resetToken);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('ActivateOrganizationUseCase', () => {
  it('activates inactive organization', async () => {
    const org = new Organization({
      id: 1,
      legalName: 'Org',
      tradeName: null,
      cnpj: Cnpj.fromPersisted('11222333000181'),
      contactEmail: null,
      contactPhone: null,
      status: OrganizationStatus.INACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const repository = {
      findById: jest.fn().mockResolvedValue(org),
      saveWithAudit: jest.fn().mockImplementation(async (o: Organization) => o),
    };
    const sessions = {
      revokeAllForOrganization: jest.fn().mockResolvedValue(1),
    };
    const logger = { setContext: jest.fn(), info: jest.fn() } as never;

    const useCase = new ActivateOrganizationUseCase(
      repository as never,
      sessions as never,
      logger,
    );
    const result = await useCase.execute(1, 1);
    expect(result.status).toBe(OrganizationStatus.ACTIVE);
    expect(sessions.revokeAllForOrganization).toHaveBeenCalledWith(
      1,
      expect.any(Date),
    );
  });
});
