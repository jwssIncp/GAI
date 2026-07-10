import { Injectable } from '@nestjs/common';
import { UserRole } from '../../domain/enums/user.enums';
import { AssignedRole } from '../../../users/domain/ports/user-role-assignment.repository.port';

const ROLE_PRIORITY: Record<UserRole, number> = {
  [UserRole.PLATFORM_ADMIN]: 3,
  [UserRole.ORG_ADMIN]: 2,
  [UserRole.ORG_USER]: 1,
};

@Injectable()
export class RoleAuthorizationService {
  extractSystemRoles(assignments: AssignedRole[]): UserRole[] {
    const roles = new Set<UserRole>();
    for (const assignment of assignments) {
      if (!assignment.roleKey) {
        continue;
      }
      if (this.isUserRole(assignment.roleKey)) {
        roles.add(assignment.roleKey);
      }
    }
    return [...roles];
  }

  resolvePrimaryRole(systemRoles: UserRole[]): UserRole | null {
    if (systemRoles.length === 0) {
      return null;
    }
    return systemRoles.reduce((highest, current) =>
      ROLE_PRIORITY[current] > ROLE_PRIORITY[highest] ? current : highest,
    );
  }

  hasSystemRole(systemRoles: UserRole[], role: UserRole): boolean {
    return systemRoles.includes(role);
  }

  canManageUsers(systemRoles: UserRole[]): boolean {
    return (
      this.hasSystemRole(systemRoles, UserRole.PLATFORM_ADMIN) ||
      this.hasSystemRole(systemRoles, UserRole.ORG_ADMIN)
    );
  }

  private isUserRole(value: string): value is UserRole {
    return Object.values(UserRole).includes(value as UserRole);
  }
}
