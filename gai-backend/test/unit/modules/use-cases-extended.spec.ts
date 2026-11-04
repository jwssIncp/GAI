import { UnauthorizedException } from '@nestjs/common';
import { ConfirmPasswordResetUseCase } from '../../../src/modules/auth/application/use-cases/confirm-password-reset.use-case';
import { RequestPasswordResetUseCase } from '../../../src/modules/auth/application/use-cases/request-password-reset.use-case';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/login.use-case';
import { UpdateOrganizationUseCase } from '../../../src/modules/organizations/application/use-cases/update-organization.use-case';
import { DeactivateOrganizationUseCase } from '../../../src/modules/organizations/application/use-cases/deactivate-organization.use-case';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { Organization } from '../../../src/modules/organizations/domain/entities/organization';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { Cnpj } from '../../../src/modules/organizations/domain/value-objects/cnpj';

describe('Auth transactional facades', () => {
  it('returns the authenticated session with effective grants', async () => {
    const now = new Date();
    const credentials = {
      authenticate: jest.fn().mockResolvedValue({
        user: {
          id: 1,
          login: 'person',
          email: 'person@example.com',
          status: UserStatus.ACTIVE,
          organizationId: 1,
          mustChangePassword: false,
        },
        session: { id: 'synthetic-session', expiresAt: now },
      }),
    };
    const assignments = { findActiveByUserId: jest.fn().mockResolvedValue([]) };
    const permissions = {
      resolveForUser: jest
        .fn()
        .mockResolvedValue([{ key: 'projects:read', scope: 'ORGANIZATION' }]),
    };
    const result = await new LoginUseCase(
      credentials as never,
      assignments as never,
      permissions as never,
    ).execute(
      { identifier: 'person', password: 'valid legacy password' },
      null,
    );
    expect(result.access_token).toBe('synthetic-session');
    expect(result.user.permissions).toHaveLength(1);
  });
  it('delegates a public reset request without exposing tokens', async () => {
    const service = {
      requestReset: jest
        .fn()
        .mockResolvedValue({ message: 'Solicitação recebida' }),
    };
    const result = await new RequestPasswordResetUseCase(
      service as never,
    ).execute({ email: 'person@example.com' }, null);
    expect(result).toEqual({ message: 'Solicitação recebida' });
    expect(service.requestReset).toHaveBeenCalledWith(
      'person@example.com',
      null,
    );
  });
  it('propagates invalid or used token rejection from the transaction', async () => {
    const service = {
      consumeToken: jest.fn().mockRejectedValue(new UnauthorizedException()),
    };
    await expect(
      new ConfirmPasswordResetUseCase(service as never).execute(
        { token: 'synthetic', new_password: 'A valid new passphrase' },
        null,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.consumeToken).toHaveBeenCalledWith(
      'synthetic',
      'A valid new passphrase',
      'PASSWORD_RESET',
      null,
    );
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
