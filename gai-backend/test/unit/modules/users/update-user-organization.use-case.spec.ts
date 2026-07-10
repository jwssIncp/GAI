import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  UserRole,
  UserStatus,
} from '../../../../src/modules/auth/domain/enums/user.enums';
import { UserScopeService } from '../../../../src/modules/users/application/services/user-scope.service';
import { UpdateUserUseCase } from '../../../../src/modules/users/application/use-cases/update-user.use-case';
import { ManagedUser } from '../../../../src/modules/users/domain/entities/managed-user';
import { RoleType } from '../../../../src/modules/users/domain/enums/role-type.enum';

describe('UpdateUserUseCase organization isolation', () => {
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
    findById: jest.fn(),
    findByEmail: jest.fn(),
    saveWithAudit: jest.fn(),
  };
  const assignments = {
    findAllActiveByUserId: jest.fn(),
    findActiveByUserId: jest.fn(),
  };
  const passwordHasher = { hash: jest.fn() };
  const loggerWarn = jest.fn();
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: loggerWarn,
  } as unknown as PinoLogger;

  let user: ManagedUser;
  let useCase: UpdateUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    user = new ManagedUser({
      id: 5,
      organizationId: 1,
      login: 'target',
      email: 'target@test.com',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    repository.findById.mockResolvedValue(user);
    repository.saveWithAudit.mockResolvedValue(user);
    assignments.findActiveByUserId.mockResolvedValue([]);
    useCase = new UpdateUserUseCase(
      repository as never,
      assignments as never,
      passwordHasher as never,
      new UserScopeService(),
      logger,
    );
  });

  it('blocks organization change while an incompatible assignment is active', async () => {
    assignments.findAllActiveByUserId.mockResolvedValue([
      {
        assignmentId: 10,
        roleId: 3,
        roleKey: null,
        roleName: 'Organization A role',
        roleType: RoleType.ORGANIZATION,
        organizationId: 1,
        isActive: true,
        assignedAt: now,
      },
    ]);

    await expect(
      useCase.execute(5, { organization_id: 2 }, platformActor),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.saveWithAudit).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'DENIED_ACTIVE_ASSIGNMENTS' }),
    );
  });

  it('allows PLATFORM_ADMIN to change organization after assignments are revoked', async () => {
    assignments.findAllActiveByUserId.mockResolvedValue([]);

    const result = await useCase.execute(
      5,
      { organization_id: 2 },
      platformActor,
    );

    expect(result.organization_id).toBe(2);
    expect(repository.saveWithAudit).toHaveBeenCalled();
  });

  it('blocks ORG_ADMIN from moving a user to another organization', async () => {
    await expect(
      useCase.execute(5, { organization_id: 2 }, orgActor),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(assignments.findAllActiveByUserId).not.toHaveBeenCalled();
  });
});
