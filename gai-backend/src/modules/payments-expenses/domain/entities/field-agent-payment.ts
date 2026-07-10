import { PaymentStatus } from '../enums/payment-status.enum';

export type JsonRecord = Record<string, unknown>;

export interface FieldAgentPaymentProps {
  id: number;
  organizationId: number;
  projectId: number;
  fieldAgentId: number;
  state: string | null;
  startDate: Date;
  endDate: Date;
  paymentDate: Date | null;
  days: number;
  dailyRate: string;
  additionalAmount: string;
  dailyTotal: string;
  discountAmount: string;
  finalAmount: string;
  status: PaymentStatus;
  notes: string | null;
  approvedById: number | null;
  approvedAt: Date | null;
  paidById: number | null;
  paidAt: Date | null;
  createdById: number | null;
  updatedById: number | null;
  metadata: JsonRecord | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class FieldAgentPayment {
  constructor(private readonly props: FieldAgentPaymentProps) {
    this.assertDates(props.startDate, props.endDate, props.paymentDate);
    this.assertMoney(props.dailyRate);
    this.assertMoney(props.additionalAmount);
    this.assertMoney(props.discountAmount);
    this.assertDays(props.days);
    this.recalculate();
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
  get fieldAgentId(): number {
    return this.props.fieldAgentId;
  }
  get status(): PaymentStatus {
    return this.props.status;
  }

  updateFields(
    fields: Partial<
      Pick<
        FieldAgentPaymentProps,
        | 'state'
        | 'startDate'
        | 'endDate'
        | 'paymentDate'
        | 'days'
        | 'dailyRate'
        | 'additionalAmount'
        | 'discountAmount'
        | 'notes'
        | 'metadata'
      >
    > & { updatedById: number | null },
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== PaymentStatus.PENDING) {
      throw new Error('Only pending payments can be updated');
    }
    const changes = this.apply(fields);
    if (Object.keys(changes).length > 0)
      this.props.updatedById = fields.updatedById;
    this.assertDates(
      this.props.startDate,
      this.props.endDate,
      this.props.paymentDate,
    );
    this.recalculate();
    changes.daily_total = { before: null, after: this.props.dailyTotal };
    changes.final_amount = { before: null, after: this.props.finalAmount };
    return changes;
  }

  approve(
    actorId: number,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== PaymentStatus.PENDING)
      throw new Error('Only pending payments can be approved');
    const changes = this.statusChange(PaymentStatus.APPROVED);
    changes.approved_by_id = {
      before: this.props.approvedById,
      after: actorId,
    };
    changes.approved_at = { before: this.props.approvedAt, after: now };
    this.props.approvedById = actorId;
    this.props.approvedAt = now;
    this.props.updatedById = actorId;
    return changes;
  }

  markAsPaid(
    actorId: number,
    paidAt: Date,
    paymentDate: Date | null,
  ): Record<string, { before: unknown; after: unknown }> {
    if (
      ![PaymentStatus.PENDING, PaymentStatus.APPROVED].includes(
        this.props.status,
      )
    )
      throw new Error(
        'Only pending or approved payments can be marked as paid',
      );
    const effectivePaymentDate = paymentDate ?? paidAt;
    this.assertDates(
      this.props.startDate,
      this.props.endDate,
      effectivePaymentDate,
    );
    const changes = this.statusChange(PaymentStatus.PAID);
    changes.payment_date = {
      before: this.props.paymentDate,
      after: effectivePaymentDate,
    };
    changes.paid_by_id = { before: this.props.paidById, after: actorId };
    changes.paid_at = { before: this.props.paidAt, after: paidAt };
    this.props.paymentDate = effectivePaymentDate;
    this.props.paidById = actorId;
    this.props.paidAt = paidAt;
    this.props.updatedById = actorId;
    return changes;
  }

  cancel(actorId: number): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === PaymentStatus.PAID)
      throw new Error('Paid payments cannot be cancelled');
    const changes = this.statusChange(PaymentStatus.CANCELLED);
    this.props.updatedById = actorId;
    return changes;
  }

  toProps(): FieldAgentPaymentProps {
    return { ...this.props };
  }

  private apply(
    fields: Record<string, unknown>,
  ): Record<string, { before: unknown; after: unknown }> {
    const map: Record<string, keyof FieldAgentPaymentProps> = {
      state: 'state',
      startDate: 'startDate',
      endDate: 'endDate',
      paymentDate: 'paymentDate',
      days: 'days',
      dailyRate: 'dailyRate',
      additionalAmount: 'additionalAmount',
      discountAmount: 'discountAmount',
      notes: 'notes',
      metadata: 'metadata',
    };
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, prop] of Object.entries(map)) {
      if (!(key in fields)) continue;
      const next = fields[key];
      if (JSON.stringify(this.props[prop]) === JSON.stringify(next)) continue;
      changes[this.toColumn(prop)] = { before: this.props[prop], after: next };
      (this.props as unknown as Record<string, unknown>)[prop] = next;
    }
    return changes;
  }

  private statusChange(
    status: PaymentStatus,
  ): Record<string, { before: unknown; after: unknown }> {
    const before = this.props.status;
    this.props.status = status;
    return { status: { before, after: status } };
  }

  private recalculate(): void {
    const dailyTotal = Number(this.props.days) * Number(this.props.dailyRate);
    const finalAmount =
      dailyTotal +
      Number(this.props.additionalAmount) -
      Number(this.props.discountAmount);
    if (finalAmount < 0) throw new Error('final_amount cannot be negative');
    this.props.dailyTotal = dailyTotal.toFixed(2);
    this.props.finalAmount = finalAmount.toFixed(2);
  }

  private assertMoney(value: string): void {
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(value))
      throw new Error('monetary values must be decimal strings');
  }
  private assertDays(value: number): void {
    if (!Number.isInteger(value) || value < 0)
      throw new Error('days must be an integer greater than or equal to zero');
  }
  private assertDates(
    startDate: Date,
    endDate: Date,
    paymentDate: Date | null,
  ): void {
    if (endDate.getTime() < startDate.getTime())
      throw new Error('end_date cannot be earlier than start_date');
    if (paymentDate && paymentDate.getTime() < startDate.getTime())
      throw new Error('payment_date cannot be earlier than start_date');
  }
  private toColumn(prop: keyof FieldAgentPaymentProps): string {
    return prop.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  }
}
