import { ExpenseStatus } from '../enums/expense-status.enum';
import { JsonRecord } from './field-agent-payment';

export interface ExpenseProps {
  id: number;
  organizationId: number;
  projectId: number;
  fieldAgentId: number | null;
  description: string;
  reason: string | null;
  expenseDate: Date;
  amount: string;
  status: ExpenseStatus;
  approvedById: number | null;
  approvedAt: Date | null;
  rejectedById: number | null;
  rejectedAt: Date | null;
  paidById: number | null;
  paidAt: Date | null;
  createdById: number | null;
  updatedById: number | null;
  metadata: JsonRecord | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Expense {
  constructor(private readonly props: ExpenseProps) {
    if (!props.description.trim()) throw new Error('description is required');
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(props.amount))
      throw new Error('amount must be a decimal string');
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
  get fieldAgentId(): number | null {
    return this.props.fieldAgentId;
  }
  get status(): ExpenseStatus {
    return this.props.status;
  }
  updateFields(
    fields: Partial<
      Pick<
        ExpenseProps,
        | 'fieldAgentId'
        | 'description'
        | 'reason'
        | 'expenseDate'
        | 'amount'
        | 'metadata'
      >
    > & { updatedById: number | null },
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== ExpenseStatus.PENDING)
      throw new Error('Only pending expenses can be updated');
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of [
      'fieldAgentId',
      'description',
      'reason',
      'expenseDate',
      'amount',
      'metadata',
    ] as const) {
      if (!(key in fields)) continue;
      const next = fields[key];
      if (JSON.stringify(this.props[key]) === JSON.stringify(next)) continue;
      changes[key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] = {
        before: this.props[key],
        after: next,
      };
      (this.props as unknown as Record<string, unknown>)[key] = next;
    }
    if (Object.keys(changes).length > 0)
      this.props.updatedById = fields.updatedById;
    return changes;
  }
  approve(
    actorId: number,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    return this.transition(ExpenseStatus.APPROVED, actorId, 'approved', now);
  }
  reject(actorId: number, now: Date, reason: string) {
    if (!reason.trim()) throw new Error('reason is required');
    const changes = this.transition(
      ExpenseStatus.REJECTED,
      actorId,
      'rejected',
      now,
    );
    changes.reason = { before: this.props.reason, after: reason };
    this.props.reason = reason;
    return changes;
  }
  markAsPaid(
    actorId: number,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (
      ![ExpenseStatus.PENDING, ExpenseStatus.APPROVED].includes(
        this.props.status,
      )
    )
      throw new Error(
        'Only pending or approved expenses can be marked as paid',
      );
    return this.transition(ExpenseStatus.PAID, actorId, 'paid', now);
  }
  cancel(actorId: number): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === ExpenseStatus.PAID)
      throw new Error('Paid expenses cannot be cancelled');
    const before = this.props.status;
    this.props.status = ExpenseStatus.CANCELLED;
    this.props.updatedById = actorId;
    return { status: { before, after: ExpenseStatus.CANCELLED } };
  }
  toProps(): ExpenseProps {
    return { ...this.props };
  }
  private transition(
    status: ExpenseStatus,
    actorId: number,
    key: 'approved' | 'rejected' | 'paid',
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === ExpenseStatus.PAID)
      throw new Error('Paid expenses cannot change status');
    const before = this.props.status;
    this.props.status = status;
    this.props.updatedById = actorId;
    (this.props as unknown as Record<string, unknown>)[`${key}ById`] = actorId;
    (this.props as unknown as Record<string, unknown>)[`${key}At`] = now;
    return {
      status: { before, after: status },
      [`${key}_by_id`]: { before: null, after: actorId },
      [`${key}_at`]: { before: null, after: now },
    };
  }
}
