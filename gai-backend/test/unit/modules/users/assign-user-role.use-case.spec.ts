import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  UserRole,
  UserStatus,
} from '../../../../src/modules/auth/domain/enums/user.enums';
import { AssignUserRoleUseCase } from '../../../../src/modules/users/application/use-cases/assign-user-role.use-case';
import { UserScopeService } from '../../../../src/modules/users/application/services/user-scope.service';
import { ManagedUser } from '../../../../src/modules/users/domain/entities/managed-user';
import { RoleType } from '../../../../src/modules/users/domain/enums/role-type.enum';

describe('AssignUserRoleUseCase', () => {
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

  const targetUser = new ManagedUser({
    id: 5,
    organizationId: 1,
    login: 'target',
    email: 'target@test.com',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });

  const platformUser = new ManagedUser({
    id: 6,
    organizationId: null,
    login: 'platform.target',
    email: 'platform.target@test.com',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });

  const otherOrganizationUser = new ManagedUser({
    id: 7,
    organizationId: 2,
    login: 'other.target',
    email: 'other.target@test.com',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });

  const users = { findById: jest.fn() };
  const assignments = {
    findActiveAssignment: jest.fn(),
    assign: jest.fn(),
  };
  const roleRepo = { findOne: jest.fn() };
  const scope = new UserScopeService();
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  } as unknown as PinoLogger;

  let useCase: AssignUserRoleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new AssignUserRoleUseCase(
      users as never,
      assignments as never,
      roleRepo as never,
      scope,
      logger,
    );
  });

  it('assigns organization role to user', async () => {
    users.findById.mockResolvedValue(targetUser);
    roleRepo.findOne.mockResolvedValue({
      id: 3,
      key: null,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      name: 'Operador',
      isActive: true,
    });
    assignments.findActiveAssignment.mockResolvedValue(null);
    assignments.assign.mockResolvedValue({
      assignmentId: 9,
      roleId: 3,
      roleKey: null,
      roleName: 'Operador',
      roleType: RoleType.ORGANIZATION,
      organizationId: 1,
      isActive: true,
      assignedAt: now,
    });

    const result = await useCase.execute(5, { role_id: 3 }, platformActor);

    expect(result.assignment_id).toBe(9);
    expect(result.role_name).toBe('Operador');
    expect(assignments.assign).toHaveBeenCalled();
  });

  it('assigns PLATFORM_ADMIN role to a platform user', async () => {
    users.findById.mockResolvedValue(platformUser);
    roleRepo.findOne.mockResolvedValue({
      id: 1,
      key: UserRole.PLATFORM_ADMIN,
      type: RoleType.SYSTEM,
      organizationId: null,
      name: 'Platform Administrator',
      isActive: true,
    });
    assignments.findActiveAssignment.mockResolvedValue(null);
    assignments.assign.mockResolvedValue({
      assignmentId: 10,
      roleId: 1,
      roleKey: UserRole.PLATFORM_ADMIN,
      roleName: 'Platform Administrator',
      roleType: RoleType.SYSTEM,
      organizationId: null,
      isActive: true,
      assignedAt: now,
    });

    const result = await useCase.execute(6, { role_id: 1 }, platformActor);

    expect(result.role_key).toBe(UserRole.PLATFORM_ADMIN);
    expect(assignments.assign).toHaveBeenCalled();
  });

  it('allows ORG_ADMIN to assign an organization role inside its tenant', async () => {
    users.findById.mockResolvedValue(targetUser);
    roleRepo.findOne.mockResolvedValue({
      id: 3,
      key: null,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      name: 'Operador',
      isActive: true,
    });
    assignments.findActiveAssignment.mockResolvedValue(null);
    assignments.assign.mockResolvedValue({
      assignmentId: 11,
      roleId: 3,
      roleKey: null,
      roleName: 'Operador',
      roleType: RoleType.ORGANIZATION,
      organizationId: 1,
      isActive: true,
      assignedAt: now,
    });

    await expect(
      useCase.execute(5, { role_id: 3 }, orgActor),
    ).resolves.toBeDefined();
  });

  it('blocks PLATFORM_ADMIN from assigning organization A role to organization B user', async () => {
    users.findById.mockResolvedValue(otherOrganizationUser);
    roleRepo.findOne.mockResolvedValue({
      id: 3,
      key: null,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      isActive: true,
    });

    await expect(
      useCase.execute(7, { role_id: 3 }, platformActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assignments.assign).not.toHaveBeenCalled();
  });

  it('blocks PLATFORM_ADMIN from assigning organization role to platform user', async () => {
    users.findById.mockResolvedValue(platformUser);
    roleRepo.findOne.mockResolvedValue({
      id: 3,
      key: null,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      isActive: true,
    });

    await expect(
      useCase.execute(6, { role_id: 3 }, platformActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks ORG_ADMIN from assigning role from another organization', async () => {
    users.findById.mockResolvedValue(targetUser);
    roleRepo.findOne.mockResolvedValue({
      id: 4,
      key: null,
      type: RoleType.ORGANIZATION,
      organizationId: 2,
      isActive: true,
    });

    await expect(
      useCase.execute(5, { role_id: 4 }, orgActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks ORG_ADMIN from assigning role to another organization user', async () => {
    users.findById.mockResolvedValue(otherOrganizationUser);

    await expect(
      useCase.execute(7, { role_id: 3 }, orgActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(roleRepo.findOne).not.toHaveBeenCalled();
  });

  it('rejects an inactive role', async () => {
    users.findById.mockResolvedValue(targetUser);
    roleRepo.findOne.mockResolvedValue({
      id: 3,
      key: null,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      isActive: false,
    });

    await expect(
      useCase.execute(5, { role_id: 3 }, platformActor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns existing assignment when role already assigned', async () => {
    users.findById.mockResolvedValue(targetUser);
    roleRepo.findOne.mockResolvedValue({
      id: 3,
      type: RoleType.ORGANIZATION,
      organizationId: 1,
      isActive: true,
    });
    const existing = {
      assignmentId: 4,
      roleId: 3,
      roleKey: null,
      roleName: 'Operador',
      roleType: RoleType.ORGANIZATION,
      organizationId: 1,
      isActive: true,
      assignedAt: now,
    };
    assignments.findActiveAssignment.mockResolvedValue(existing);

    const result = await useCase.execute(5, { role_id: 3 }, platformActor);

    expect(result.assignment_id).toBe(4);
    expect(assignments.assign).not.toHaveBeenCalled();
  });

  it('throws NotFound when user does not exist', async () => {
    users.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(999, { role_id: 3 }, platformActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ORG_ADMIN cannot assign PLATFORM_ADMIN role', async () => {
    users.findById.mockResolvedValue(targetUser);
    roleRepo.findOne.mockResolvedValue({
      id: 1,
      key: UserRole.PLATFORM_ADMIN,
      type: RoleType.SYSTEM,
      organizationId: null,
      isActive: true,
    });

    await expect(
      useCase.execute(5, { role_id: 1 }, orgActor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
