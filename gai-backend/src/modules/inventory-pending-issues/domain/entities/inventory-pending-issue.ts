import { InventoryPendingIssueSeverity } from '../enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../enums/inventory-pending-issue-type.enum';

export type JsonRecord = Record<string, unknown>;

export interface InventoryPendingIssueProps {
  id: number;
  organizationId: number;
  projectId: number;
  inventoryItemId: number | null;
  accountingItemId: number | null;
  type: InventoryPendingIssueType;
  status: InventoryPendingIssueStatus;
  severity: InventoryPendingIssueSeverity;
  title: string;
  description: string | null;
  oldValue: JsonRecord | null;
  newValue: JsonRecord | null;
  resolutionNotes: string | null;
  resolvedById: number | null;
  resolvedAt: Date | null;
  ignoredById: number | null;
  ignoredAt: Date | null;
  createdById: number | null;
  updatedById: number | null;
  metadata: JsonRecord | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class InventoryPendingIssue {
  constructor(private readonly props: InventoryPendingIssueProps) {
    this.assertTitle(props.title);
  }

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get projectId(): number {
    return this.props.projectId;
  }

  get inventoryItemId(): number | null {
    return this.props.inventoryItemId;
  }

  get accountingItemId(): number | null {
    return this.props.accountingItemId;
  }

  get type(): InventoryPendingIssueType {
    return this.props.type;
  }

  get status(): InventoryPendingIssueStatus {
    return this.props.status;
  }

  updateFields(
    fields: Partial<
      Pick<
        InventoryPendingIssueProps,
        | 'type'
        | 'status'
        | 'severity'
        | 'title'
        | 'description'
        | 'oldValue'
        | 'newValue'
        | 'metadata'
      >
    > & { updatedById: number | null },
  ): Record<string, { before: unknown; after: unknown }> {
    if (fields.title !== undefined) {
      this.assertTitle(fields.title);
    }
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [propKey, columnKey] of Object.entries(this.columnMap())) {
      const key = propKey as keyof InventoryPendingIssueProps;
      if (!(key in fields)) continue;
      const next = fields[key as keyof typeof fields];
      const current = this.props[key];
      if (JSON.stringify(current) === JSON.stringify(next)) continue;
      changes[columnKey] = { before: current, after: next };
      (this.props as unknown as Record<string, unknown>)[key] = next;
    }
    if (Object.keys(changes).length > 0) {
      this.props.updatedById = fields.updatedById;
    }
    return changes;
  }

  resolve(
    actorId: number | null,
    notes: string | null,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.requiresResolutionNotes() && !notes) {
      throw new Error('resolution_notes is required for this issue type');
    }
    return this.applyTerminalStatus(
      InventoryPendingIssueStatus.RESOLVED,
      actorId,
      notes,
      now,
    );
  }

  ignore(
    actorId: number | null,
    notes: string | null,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    const changes = this.changeStatus(InventoryPendingIssueStatus.IGNORED);
    changes.ignored_by_id = { before: this.props.ignoredById, after: actorId };
    changes.ignored_at = { before: this.props.ignoredAt, after: now };
    changes.resolution_notes = {
      before: this.props.resolutionNotes,
      after: notes,
    };
    this.props.ignoredById = actorId;
    this.props.ignoredAt = now;
    this.props.resolutionNotes = notes;
    this.props.updatedById = actorId;
    return changes;
  }

  cancel(
    actorId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    const changes = this.changeStatus(InventoryPendingIssueStatus.CANCELLED);
    this.props.updatedById = actorId;
    return changes;
  }

  toProps(): InventoryPendingIssueProps {
    return { ...this.props };
  }

  private applyTerminalStatus(
    status: InventoryPendingIssueStatus,
    actorId: number | null,
    notes: string | null,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    const changes = this.changeStatus(status);
    changes.resolution_notes = {
      before: this.props.resolutionNotes,
      after: notes,
    };
    changes.resolved_by_id = {
      before: this.props.resolvedById,
      after: actorId,
    };
    changes.resolved_at = { before: this.props.resolvedAt, after: now };
    this.props.resolutionNotes = notes;
    this.props.resolvedById = actorId;
    this.props.resolvedAt = now;
    this.props.updatedById = actorId;
    return changes;
  }

  private changeStatus(
    status: InventoryPendingIssueStatus,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === status) {
      throw new Error('Inventory pending issue already has this status');
    }
    const before = this.props.status;
    this.props.status = status;
    return { status: { before, after: status } };
  }

  private requiresResolutionNotes(): boolean {
    return [
      InventoryPendingIssueType.ACCOUNTING_ITEM_NOT_FOUND,
      InventoryPendingIssueType.PHYSICAL_ITEM_WITHOUT_ACCOUNTING_MATCH,
      InventoryPendingIssueType.PLATE_DIVERGENCE,
      InventoryPendingIssueType.DESCRIPTION_DIVERGENCE,
      InventoryPendingIssueType.LOCATION_DIVERGENCE,
      InventoryPendingIssueType.DUPLICATED_ITEM,
    ].includes(this.props.type);
  }

  private columnMap(): Record<string, string> {
    return {
      type: 'type',
      status: 'status',
      severity: 'severity',
      title: 'title',
      description: 'description',
      oldValue: 'old_value',
      newValue: 'new_value',
      metadata: 'metadata',
    };
  }

  private assertTitle(value: string): void {
    if (!value.trim()) {
      throw new Error('title is required');
    }
    if (value.length > 255) {
      throw new Error('title must be at most 255 characters');
    }
  }
}
