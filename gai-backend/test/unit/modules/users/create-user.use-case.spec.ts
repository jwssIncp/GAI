import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CreateUserUseCase } from '../../../../src/modules/users/application/use-cases/create-user.use-case';
import { UserScopeService } from '../../../../src/modules/users/application/services/user-scope.service';
import { ManagedUser } from '../../../../src/modules/users/domain/entities/managed-user';
import {
  UserRole,
  UserStatus,
} from '../../../../src/modules/auth/domain/enums/user.enums';

describe('CreateUserUseCase', () => {
  const now = new Date();
  const platformActor = {
    id: 1,
    systemRoles: [UserRole.PLATFORM_ADMIN],
    organizationId: null,
  };
  const orgActor = {
    id: 2,
    systemRoles: [UserRole.ORG_ADMIN],
    organizationId: 1,
  };

  const repository = {
    findByLogin: jest.fn(),
    findByEmail: jest.fn(),
    saveWithAudit: jest.fn(),
  };
  const hasher = { hash: jest.fn().mockResolvedValue('hashed') };
  const scope = new UserScopeService();
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
  } as unknown as PinoLogger;

  let useCase: CreateUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateUserUseCase(
      repository as never,
      hasher as never,
      scope,
      logger,
    );
  });

  it('creates user with profile-only fields', async () => {
    repository.findByLogin.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);
    repository.saveWithAudit.mockImplementation(
      async (user: ManagedUser) =>
        new ManagedUser({ ...user.toProps(), id: 10 }),
    );

    const result = await useCase.execute(
      {
        login: 'novo.user',
        email: 'novo@test.com',
        password: 'Senha@123456',
        organization_id: 1,
      },
      platformActor,
    );

    expect(result.id).toBe(10);
    expect(result.login).toBe('novo.user');
    expect(result.role_assignments).toEqual([]);
    expect(repository.saveWithAudit).toHaveBeenCalled();
  });

  it('ORG_ADMIN creates user scoped to own organization', async () => {
    repository.findByLogin.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);
    repository.saveWithAudit.mockImplementation(
      async (user: ManagedUser) =>
        new ManagedUser({ ...user.toProps(), id: 11 }),
    );

    const result = await useCase.execute(
      {
        login: 'org.user',
        email: 'org@test.com',
        password: 'Senha@123456',
      },
      orgActor,
    );

    expect(result.organization_id).toBe(1);
  });

  it('throws conflict for duplicate login', async () => {
    repository.findByLogin.mockResolvedValue(
      new ManagedUser({
        id: 5,
        organizationId: 1,
        login: 'dup',
        email: 'other@test.com',
        passwordHash: 'x',
        status: UserStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await expect(
      useCase.execute(
        { login: 'dup', email: 'new@test.com', password: 'Senha@123456' },
        platformActor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('non-admin actor cannot create users', async () => {
    const regularActor = {
      id: 3,
      systemRoles: [UserRole.ORG_USER],
      organizationId: 1,
    };

    await expect(
      useCase.execute(
        {
          login: 'blocked',
          email: 'blocked@test.com',
          password: 'Senha@123456',
        },
        regularActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
