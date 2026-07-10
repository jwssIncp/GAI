import { UserRole, UserStatus } from '../../../auth/domain/enums/user.enums';
import { ManagedUser } from '../entities/managed-user';
import { UserAuditOperation } from '../enums/user-audit-operation.enum';

export interface ListUsersParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  status?: UserStatus;
  role?: UserRole;
  search?: string;
}

export interface UserAuditEntry {
  userId: number;
  operation: UserAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const USER_MANAGEMENT_REPOSITORY = Symbol('USER_MANAGEMENT_REPOSITORY');

export interface UserManagementRepository {
  findById(id: number): Promise<ManagedUser | null>;
  findByLogin(login: string): Promise<ManagedUser | null>;
  findByEmail(email: string): Promise<ManagedUser | null>;
  list(
    params: ListUsersParams,
  ): Promise<{ items: ManagedUser[]; total: number }>;
  countActivePlatformAdmins(excludeUserId?: number): Promise<number>;
  saveWithAudit(user: ManagedUser, audit: UserAuditEntry): Promise<ManagedUser>;
}
