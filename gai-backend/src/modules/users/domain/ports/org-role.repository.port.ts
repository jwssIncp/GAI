import { OrgRole } from '../entities/org-role';
import { OrgRoleAuditOperation } from '../enums/org-role-audit-operation.enum';

export interface OrgRoleAuditEntry {
  orgRoleId: number;
  operation: OrgRoleAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const ORG_ROLE_REPOSITORY = Symbol('ORG_ROLE_REPOSITORY');

export interface OrgRoleRepository {
  findById(id: number): Promise<OrgRole | null>;
  findByIdAndOrganization(
    id: number,
    organizationId: number,
  ): Promise<OrgRole | null>;
  findByNameInOrganization(
    organizationId: number,
    name: string,
  ): Promise<OrgRole | null>;
  listByOrganization(
    organizationId: number,
    includeInactive: boolean,
  ): Promise<OrgRole[]>;
  countActiveUsersWithRole(orgRoleId: number): Promise<number>;
  saveWithAudit(
    role: OrgRole,
    permissionIds: number[],
    audit: OrgRoleAuditEntry,
  ): Promise<OrgRole>;
}
