import { InventoryPendingIssue } from '../entities/inventory-pending-issue';
import { InventoryPendingIssueAuditOperation } from '../enums/inventory-pending-issue-audit-operation.enum';
import { InventoryPendingIssueSeverity } from '../enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../enums/inventory-pending-issue-type.enum';

export interface ListInventoryPendingIssuesParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  projectId?: number;
  type?: InventoryPendingIssueType;
  status?: InventoryPendingIssueStatus;
  severity?: InventoryPendingIssueSeverity;
  inventoryItemId?: number;
  accountingItemId?: number;
  plate?: string;
  search?: string;
  includeIgnored?: boolean;
}

export interface InventoryPendingIssueAuditEntry {
  inventoryPendingIssueId: number;
  organizationId: number;
  projectId: number;
  operation: InventoryPendingIssueAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const INVENTORY_PENDING_ISSUE_REPOSITORY = Symbol(
  'INVENTORY_PENDING_ISSUE_REPOSITORY',
);

export interface InventoryPendingIssueRepository {
  findById(id: number): Promise<InventoryPendingIssue | null>;
  findOpenDuplicate(params: {
    organizationId: number;
    projectId: number;
    type: InventoryPendingIssueType;
    inventoryItemId: number | null;
    accountingItemId: number | null;
  }): Promise<InventoryPendingIssue | null>;
  list(
    params: ListInventoryPendingIssuesParams,
  ): Promise<{ items: InventoryPendingIssue[]; total: number }>;
  saveWithAudit(
    issue: InventoryPendingIssue,
    audit: InventoryPendingIssueAuditEntry,
  ): Promise<InventoryPendingIssue>;
}
