import { UserRole } from '../../../auth/domain/enums/user.enums';
import { RoleType } from '../enums/role-type.enum';

export interface AssignedRole {
  assignmentId: number;
  roleId: number;
  roleKey: string | null;
  roleName: string;
  roleType: RoleType;
  organizationId: number | null;
  isActive: boolean;
  assignedAt: Date;
}

export interface AssignRoleInput {
  userId: number;
  roleId: number;
  assignedBy: number | null;
}

export const USER_ROLE_ASSIGNMENT_REPOSITORY = Symbol(
  'USER_ROLE_ASSIGNMENT_REPOSITORY',
);

export interface UserRoleAssignmentRepository {
  findActiveByUserId(userId: number): Promise<AssignedRole[]>;
  findAllActiveByUserId(userId: number): Promise<AssignedRole[]>;
  findActiveByUserIds(userIds: number[]): Promise<Map<number, AssignedRole[]>>;
  findActiveAssignment(
    userId: number,
    roleId: number,
  ): Promise<AssignedRole | null>;
  assign(input: AssignRoleInput): Promise<AssignedRole>;
  revoke(assignmentId: number, revokedAt: Date): Promise<void>;
  countActiveUsersWithSystemRole(
    roleKey: UserRole,
    excludeUserId?: number,
  ): Promise<number>;
  findUsersBySystemRole(roleKey: UserRole): Promise<number[]>;
}
