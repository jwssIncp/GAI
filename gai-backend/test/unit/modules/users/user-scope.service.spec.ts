import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import { UserScopeService } from '../../../../src/modules/users/application/services/user-scope.service';
import { RoleType } from '../../../../src/modules/users/domain/enums/role-type.enum';

describe('UserScopeService tenant boundaries', () => {
  const scope = new UserScopeService();

  it('does not turn a null organization into a global filter', () => {
    expect(() =>
      scope.assertCanFilterByOrganization(
        {
          id: 10,
          systemRoles: [UserRole.ORG_ADMIN],
          organizationId: null,
        },
        undefined,
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows explicit global filtering only for PLATFORM_ADMIN', () => {
    expect(
      scope.assertCanFilterByOrganization(
        {
          id: 1,
          systemRoles: [UserRole.PLATFORM_ADMIN],
          organizationId: null,
        },
        undefined,
      ),
    ).toBeUndefined();
  });

  it('rejects a cross-tenant organization role even for PLATFORM_ADMIN', () => {
    expect(() =>
      scope.assertCanAssignRole(
        {
          id: 1,
          systemRoles: [UserRole.PLATFORM_ADMIN],
          organizationId: null,
        },
        2,
        {
          type: RoleType.ORGANIZATION,
          key: null,
          organizationId: 1,
        },
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows organization system roles only for organization users', () => {
    expect(() =>
      scope.assertCanAssignRole(
        {
          id: 1,
          systemRoles: [UserRole.PLATFORM_ADMIN],
          organizationId: null,
        },
        1,
        {
          type: RoleType.SYSTEM,
          key: UserRole.ORG_ADMIN,
          organizationId: null,
        },
      ),
    ).not.toThrow();

    expect(() =>
      scope.assertCanAssignRole(
        {
          id: 1,
          systemRoles: [UserRole.PLATFORM_ADMIN],
          organizationId: null,
        },
        null,
        {
          type: RoleType.SYSTEM,
          key: UserRole.ORG_ADMIN,
          organizationId: null,
        },
      ),
    ).toThrow(ForbiddenException);
  });
});
