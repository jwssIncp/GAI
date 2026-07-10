import { UserRole } from '../../../auth/domain/enums/user.enums';
import { RoleType } from '../enums/role-type.enum';

export interface RoleScopeDescriptor {
  type: RoleType;
  key: string | null;
  organizationId: number | null;
}

export function isRoleCompatibleWithUserOrganization(
  role: RoleScopeDescriptor,
  userOrganizationId: number | null,
): boolean {
  if (role.type === RoleType.ORGANIZATION) {
    return (
      role.organizationId !== null &&
      userOrganizationId !== null &&
      role.organizationId === userOrganizationId
    );
  }

  if (role.type !== RoleType.SYSTEM || role.organizationId !== null) {
    return false;
  }

  if (role.key === UserRole.PLATFORM_ADMIN) {
    return userOrganizationId === null;
  }

  if (role.key === UserRole.ORG_ADMIN || role.key === UserRole.ORG_USER) {
    return userOrganizationId !== null;
  }

  return false;
}

export function isOrganizationSystemRole(role: RoleScopeDescriptor): boolean {
  return (
    role.type === RoleType.SYSTEM &&
    role.organizationId === null &&
    (role.key === UserRole.ORG_ADMIN || role.key === UserRole.ORG_USER)
  );
}
