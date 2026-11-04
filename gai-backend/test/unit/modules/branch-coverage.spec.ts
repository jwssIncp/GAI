import {
  ConflictException,
  ExecutionContext,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { RolesGuard } from '../../../src/modules/auth/presentation/guards/roles.guard';
import { SessionAuthGuard } from '../../../src/modules/auth/presentation/guards/session-auth.guard';
import { User } from '../../../src/modules/auth/domain/entities/user';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { Reflector } from '@nestjs/core';
import { GetOrganizationUseCase } from '../../../src/modules/organizations/application/use-cases/get-organization.use-case';
import { ListOrganizationsUseCase } from '../../../src/modules/organizations/application/use-cases/list-organizations.use-case';
import { UpdateOrganizationUseCase } from '../../../src/modules/organizations/application/use-cases/update-organization.use-case';
import { Organization } from '../../../src/modules/organizations/domain/entities/organization';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { DeactivateOrganizationUseCase } from '../../../src/modules/organizations/application/use-cases/deactivate-organization.use-case';
import { DevAdminGuard } from '../../../src/modules/auth/presentation/guards/dev-admin.guard';
import { Cnpj } from '../../../src/modules/organizations/domain/value-objects/cnpj';
import { TypeOrmOrganizationRepository } from '../../../src/modules/organizations/infrastructure/persistence/typeorm-organization.repository';

describe('Branch coverage boosters', () => {
  const now = new Date();

  const mockPermissionResolver = {
    resolveForUser: jest.fn().mockResolvedValue([]),
  } as never;
  const mockConfigService = { get: () => 8 } as never;

  const makeUser = (
    overrides: Partial<ConstructorParameters<typeof User>[0]> = {},
  ) =>
    new User({
      id: 1,
      organizationId: 1,
      login: 'user',
      email: 'user@test.com',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });

  const mockAssignments = {
    findActiveByUserId: jest.fn().mockResolvedValue([]),
  } as never;

  const mockRoleAuth = {
    extractSystemRoles: jest.fn().mockReturnValue([]),
    resolvePrimaryRole: jest.fn().mockReturnValue(null),
  } as never;

  it('HttpExceptionFilter maps common HTTP statuses', () => {
    const filter = new HttpExceptionFilter();
    const statuses = [
      HttpStatus.BAD_REQUEST,
      HttpStatus.UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      HttpStatus.NOT_FOUND,
      HttpStatus.CONFLICT,
      HttpStatus.LOCKED,
      HttpStatus.INTERNAL_SERVER_ERROR,
    ];

    for (const status of statuses) {
      const json = jest.fn();
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status: jest.fn().mockReturnThis(), json }),
        }),
      };
      filter.catch(new HttpException('msg', status), host as never);
      expect(json).toHaveBeenCalled();
    }

    const stringHost = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        }),
      }),
    };
    filter.catch(new HttpException('plain', 400), stringHost as never);
  });

  it('RolesGuard allows when no roles required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('SessionAuthGuard accepts valid bearer session', async () => {
    const sessions = {
      findActiveById: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 1,
      }),
      touch: jest.fn(),
    };
    const users = {
      findById: jest.fn().mockResolvedValue(makeUser({ organizationId: null })),
    };
    const guard = new SessionAuthGuard(
      sessions as never,
      users as never,
      mockPermissionResolver,
      mockAssignments,
      mockRoleAuth,
      mockConfigService,
      { isActive: jest.fn().mockResolvedValue(true) },
    );
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: 'Bearer session-1' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request.user).toBeDefined();
  });

  it('organization read/update use cases handle not found and no-op update', async () => {
    const getUseCase = new GetOrganizationUseCase({
      findById: jest.fn().mockResolvedValue(null),
    } as never);
    await expect(getUseCase.execute(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const org = new Organization({
      id: 1,
      legalName: 'Org',
      tradeName: null,
      cnpj: Cnpj.fromPersisted('11222333000181'),
      contactEmail: null,
      contactPhone: null,
      status: OrganizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    const updateUseCase = new UpdateOrganizationUseCase(
      { findById: jest.fn().mockResolvedValue(org) } as never,
      { setContext: jest.fn(), info: jest.fn() } as never,
    );
    const unchanged = await updateUseCase.execute(1, {}, null);
    expect(unchanged.id).toBe(1);

    const listUseCase = new ListOrganizationsUseCase({
      list: jest.fn().mockResolvedValue({ items: [org], total: 1 }),
    } as never);
    const listed = await listUseCase.execute({ page: 1, page_size: 10 });
    expect(listed.total_items).toBe(1);
  });

  it('TypeOrmOrganizationRepository maps entities', async () => {
    const orgEntity = {
      id: 1,
      legalName: 'Org',
      tradeName: null,
      cnpj: '11222333000181',
      contactEmail: null,
      contactPhone: null,
      status: OrganizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };
    const orgRepo = {
      create: jest.fn((data: Record<string, unknown>) => ({
        ...orgEntity,
        ...data,
      })),
      findOne: jest.fn().mockResolvedValue(orgEntity),
      createQueryBuilder: jest.fn().mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[orgEntity], 1]),
      }),
      save: jest.fn().mockResolvedValue(orgEntity),
      manager: {
        transaction: jest.fn(
          async (cb: (manager: unknown) => Promise<unknown>) =>
            cb({
              getRepository: () => ({
                save: jest.fn().mockResolvedValue(orgEntity),
              }),
            }),
        ),
      },
    };
    const auditRepo = { save: jest.fn() };
    const repository = new TypeOrmOrganizationRepository(
      orgRepo as never,
      auditRepo as never,
    );

    expect(await repository.findById(1)).not.toBeNull();
    expect(await repository.findByCnpj('11222333000181')).not.toBeNull();
    const listed = await repository.list({
      page: 1,
      pageSize: 10,
      search: 'Org',
    });
    expect(listed.total).toBe(1);
    await repository.save(
      new Organization({
        id: 1,
        legalName: 'Org',
        tradeName: null,
        cnpj: Cnpj.fromPersisted('11222333000181'),
        contactEmail: null,
        contactPhone: null,
        status: OrganizationStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      }),
    );
  });

  it('DeactivateOrganizationUseCase returns conflict when already inactive', async () => {
    const org = new Organization({
      id: 1,
      legalName: 'Org',
      tradeName: null,
      cnpj: Cnpj.fromPersisted('11222333000181'),
      contactEmail: null,
      contactPhone: null,
      status: OrganizationStatus.INACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    const useCase = new DeactivateOrganizationUseCase(
      { findById: jest.fn().mockResolvedValue(org) } as never,
      { revokeAllForOrganization: jest.fn() } as never,
      { setContext: jest.fn(), info: jest.fn() } as never,
    );
    await expect(useCase.execute(1, null)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('DevAdminGuard blocks production environment', () => {
    const guard = new DevAdminGuard({ get: () => 'production' } as never);
    const context = { switchToHttp: () => ({ getRequest: () => ({}) }) };
    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('User entity handles LOCKED status and password update', () => {
    const lockedUser = makeUser({ status: UserStatus.LOCKED });
    expect(lockedUser.canLogin(now)).toBe(false);
    lockedUser.updatePasswordHash('new-hash', now);
    expect(lockedUser.status).toBe(UserStatus.ACTIVE);
  });

  it('Organization entity updates all optional fields', () => {
    const org = new Organization({
      id: 1,
      legalName: 'Org',
      tradeName: 'Old',
      cnpj: Cnpj.fromPersisted('11222333000181'),
      contactEmail: 'old@test.com',
      contactPhone: '11999999999',
      status: OrganizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    const changes = org.updateFields({
      legalName: 'New Org',
      tradeName: 'New Trade',
      contactEmail: 'new@test.com',
      contactPhone: '11888888888',
    });
    expect(Object.keys(changes).length).toBe(4);
  });

  it('Cnpj equals compares values', () => {
    const a = Cnpj.fromPersisted('11222333000181');
    const b = Cnpj.fromPersisted('11222333000181');
    expect(a.equals(b)).toBe(true);
  });

  it('SessionAuthGuard rejects invalid session and missing user', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer bad' } }),
      }),
    };
    const guard = new SessionAuthGuard(
      {
        findActiveById: jest.fn().mockResolvedValue(null),
        touch: jest.fn(),
      } as never,
      {} as never,
      mockPermissionResolver,
      mockAssignments,
      mockRoleAuth,
      mockConfigService,
      { isActive: jest.fn().mockResolvedValue(true) },
    );
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const guard2 = new SessionAuthGuard(
      {
        findActiveById: jest.fn().mockResolvedValue({ id: 's1', userId: 1 }),
        touch: jest.fn(),
      } as never,
      { findById: jest.fn().mockResolvedValue(null) } as never,
      mockPermissionResolver,
      mockAssignments,
      mockRoleAuth,
      { get: () => 8 } as never,
      { isActive: jest.fn().mockResolvedValue(true) },
    );
    await expect(guard2.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('Organization entity rejects duplicate state transitions', () => {
    const org = new Organization({
      id: 1,
      legalName: 'Org',
      tradeName: null,
      cnpj: Cnpj.fromPersisted('11222333000181'),
      contactEmail: null,
      contactPhone: null,
      status: OrganizationStatus.INACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    expect(() => org.deactivate()).toThrow('already inactive');
    org.activate();
    expect(() => org.activate()).toThrow('already active');
  });
});
