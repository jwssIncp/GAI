import { UserStatus } from '../../../../src/modules/auth/domain/enums/user.enums';
import { TypeOrmPermissionResolver } from '../../../../src/modules/auth/infrastructure/persistence/typeorm-permission-resolver';
import { PermissionScope } from '../../../../src/modules/users/domain/enums/permission-scope.enum';
import { RoleType } from '../../../../src/modules/users/domain/enums/role-type.enum';

describe('TypeOrmPermissionResolver tenant isolation', () => {
  const permissionRepo = { find: jest.fn() };
  const rolePermissionRepo = { find: jest.fn() };
  const assignmentRepo = { find: jest.fn() };
  const roleRepo = { find: jest.fn() };
  const userRepo = { findOne: jest.fn() };
  const organizationRepo = { exist: jest.fn() };

  let resolver: TypeOrmPermissionResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new TypeOrmPermissionResolver(
      permissionRepo as never,
      rolePermissionRepo as never,
      assignmentRepo as never,
      roleRepo as never,
      userRepo as never,
      organizationRepo as never,
    );
    userRepo.findOne.mockResolvedValue({
      id: 10,
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    organizationRepo.exist.mockResolvedValue(true);
    assignmentRepo.find.mockResolvedValue([
      { userId: 10, roleId: 3, isActive: true, revokedAt: null },
    ]);
    rolePermissionRepo.find.mockResolvedValue([
      { roleId: 3, permissionId: 20 },
    ]);
    permissionRepo.find.mockResolvedValue([
      {
        id: 20,
        key: 'projects:read',
        scope: PermissionScope.ORGANIZATION,
      },
    ]);
  });

  it('grants a valid organization permission only inside the same tenant', async () => {
    roleRepo.find.mockResolvedValue([
      {
        id: 3,
        type: RoleType.ORGANIZATION,
        key: null,
        organizationId: 1,
        isActive: true,
      },
    ]);

    await expect(resolver.resolveForUser(10)).resolves.toEqual([
      { key: 'projects:read', scope: PermissionScope.ORGANIZATION },
    ]);
  });

  it('does not grant permissions from an inactive role', async () => {
    roleRepo.find.mockResolvedValue([]);

    await expect(resolver.resolveForUser(10)).resolves.toEqual([]);
    expect(rolePermissionRepo.find).not.toHaveBeenCalled();
  });

  it('does not grant permissions from an inactive or revoked assignment', async () => {
    assignmentRepo.find.mockResolvedValue([]);

    await expect(resolver.resolveForUser(10)).resolves.toEqual([]);
    expect(roleRepo.find).not.toHaveBeenCalled();
  });

  it('rejects a role from another organization', async () => {
    roleRepo.find.mockResolvedValue([
      {
        id: 3,
        type: RoleType.ORGANIZATION,
        key: null,
        organizationId: 2,
        isActive: true,
      },
    ]);

    await expect(resolver.resolveForUser(10)).resolves.toEqual([]);
  });

  it('does not grant organization permissions to a user without organization', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 10,
      organizationId: null,
      status: UserStatus.ACTIVE,
    });
    roleRepo.find.mockResolvedValue([
      {
        id: 3,
        type: RoleType.ORGANIZATION,
        key: null,
        organizationId: 1,
        isActive: true,
      },
    ]);

    await expect(resolver.resolveForUser(10)).resolves.toEqual([]);
    expect(organizationRepo.exist).not.toHaveBeenCalled();
  });

  it('does not grant permissions to inactive users or users in inactive organizations', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);
    await expect(resolver.resolveForUser(10)).resolves.toEqual([]);

    userRepo.findOne.mockResolvedValueOnce({
      id: 10,
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    organizationRepo.exist.mockResolvedValueOnce(false);
    await expect(resolver.resolveForUser(10)).resolves.toEqual([]);
  });

  it('materializes the complete catalog for PLATFORM_ADMIN', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 10,
      organizationId: null,
      status: UserStatus.ACTIVE,
    });
    roleRepo.find.mockResolvedValue([
      {
        id: 1,
        type: RoleType.SYSTEM,
        key: 'PLATFORM_ADMIN',
        organizationId: null,
        isActive: true,
      },
    ]);
    permissionRepo.find.mockResolvedValue([
      { id: 20, key: 'projects:read', scope: PermissionScope.ORGANIZATION },
      { id: 21, key: 'organizations:read', scope: PermissionScope.PLATFORM },
    ]);

    await expect(resolver.resolveForUser(10)).resolves.toEqual([
      { key: 'projects:read', scope: PermissionScope.ORGANIZATION },
      { key: 'organizations:read', scope: PermissionScope.PLATFORM },
    ]);
    expect(rolePermissionRepo.find).not.toHaveBeenCalled();
  });

  it('materializes every organization permission for ORG_ADMIN', async () => {
    roleRepo.find.mockResolvedValue([
      {
        id: 2,
        type: RoleType.SYSTEM,
        key: 'ORG_ADMIN',
        organizationId: null,
        isActive: true,
      },
    ]);
    permissionRepo.find.mockResolvedValue([
      { id: 20, key: 'projects:read', scope: PermissionScope.ORGANIZATION },
    ]);

    await expect(resolver.resolveForUser(10)).resolves.toEqual([
      { key: 'projects:read', scope: PermissionScope.ORGANIZATION },
    ]);
    expect(permissionRepo.find).toHaveBeenCalledWith({
      where: { scope: PermissionScope.ORGANIZATION },
    });
    expect(rolePermissionRepo.find).not.toHaveBeenCalled();
  });
});
