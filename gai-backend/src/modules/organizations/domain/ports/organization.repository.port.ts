import { Organization } from '../entities/organization';
import { OrganizationStatus } from '../enums/organization-status.enum';
import { OrganizationAuditOperation } from '../enums/organization-audit-operation.enum';

export interface ListOrganizationsParams {
  page: number;
  pageSize: number;
  status?: OrganizationStatus;
  search?: string;
}

export interface OrganizationAuditEntry {
  organizationId: number;
  operation: OrganizationAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');

export interface OrganizationRepository {
  save(organization: Organization): Promise<Organization>;
  findById(id: number): Promise<Organization | null>;
  findByCnpj(cnpj: string): Promise<Organization | null>;
  list(params: ListOrganizationsParams): Promise<{
    items: Organization[];
    total: number;
  }>;
  saveWithAudit(
    organization: Organization,
    audit: OrganizationAuditEntry,
  ): Promise<Organization>;
}
