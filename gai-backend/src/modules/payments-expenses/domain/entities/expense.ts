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
  /** Etapa 4 (M5). Opcionais: nulos nas despesas antigas ("não classificada"). */
  expenseType?: string | null;
  reasonCode?: string | null;
  paymentMethod?: string | null;
  /** Data civil AAAA-MM-DD (só na forma "faturado"). */
  invoicedPaymentDate?: string | null;
  depositedAmount?: string | null;
  projectSequence?: number | null;
  rejectionReason?: string | null;
  reimbursementBatchId?: number | null;
  reopenedAt?: Date | null;
  reopenedById?: number | null;
}

/** Campos da despesa que a edição (só em pendente) pode alterar. */
export const EXPENSE_EDITABLE = [
  'fieldAgentId',
  'description',
  'reason',
  'expenseDate',
  'amount',
  'metadata',
  'expenseType',
  'reasonCode',
  'paymentMethod',
  'invoicedPaymentDate',
  'depositedAmount',
] as const;

export class Expense {
  constructor(private readonly props: ExpenseProps) {
    if (!props.description.trim())
      throw new Error('A descrição é obrigatória.');
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(props.amount))
      throw new Error('O valor deve ser um número decimal.');
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
  get expenseType(): string | null {
    return this.props.expenseType ?? null;
  }
  get reimbursementBatchId(): number | null {
    return this.props.reimbursementBatchId ?? null;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  updateFields(
    fields: Partial<Pick<ExpenseProps, (typeof EXPENSE_EDITABLE)[number]>> & {
      updatedById: number | null;
    },
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== ExpenseStatus.PENDING)
      throw new Error(
        'Só despesas pendentes podem ser editadas. Reabra para edição antes.',
      );
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of EXPENSE_EDITABLE) {
      if (!(key in fields)) continue;
      const next = fields[key];
      if (
        JSON.stringify(this.props[key] ?? null) === JSON.stringify(next ?? null)
      )
        continue;
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
  /** O motivo da rejeição vai para coluna própria: o motivo original da despesa fica intacto. */
  reject(actorId: number, now: Date, reason: string) {
    if (!reason.trim()) throw new Error('Informe o motivo.');
    const changes = this.transition(
      ExpenseStatus.REJECTED,
      actorId,
      'rejected',
      now,
    );
    changes.rejection_reason = {
      before: this.props.rejectionReason ?? null,
      after: reason,
    };
    this.props.rejectionReason = reason;
    return changes;
  }
  /** Reabrir para edição (D-D): aprovada volta a pendente, com registro de quem e quando. */
  reopen(
    actorId: number,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== ExpenseStatus.APPROVED)
      throw new Error('Só despesas aprovadas podem ser reabertas para edição.');
    const changes = {
      status: { before: this.props.status, after: ExpenseStatus.PENDING },
      approved_by_id: { before: this.props.approvedById, after: null },
      approved_at: { before: this.props.approvedAt, after: null },
      reopened_by_id: {
        before: this.props.reopenedById ?? null,
        after: actorId,
      },
      reopened_at: { before: this.props.reopenedAt ?? null, after: now },
    };
    this.props.status = ExpenseStatus.PENDING;
    this.props.approvedById = null;
    this.props.approvedAt = null;
    this.props.reopenedById = actorId;
    this.props.reopenedAt = now;
    this.props.updatedById = actorId;
    return changes;
  }
  /** Tipo de despesa (reembolsável ou não), alternado na lista com confirmação. */
  changeType(
    actorId: number,
    type: string,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.deletedAt) throw new Error('Despesa excluída.');
    const before = this.props.expenseType ?? null;
    if (before === type) return {};
    this.props.expenseType = type;
    this.props.updatedById = actorId;
    return { expense_type: { before, after: type } };
  }
  /** Inclui ou tira a despesa de um lote de reembolso. */
  setBatch(
    actorId: number,
    batchId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    const before = this.props.reimbursementBatchId ?? null;
    if (before === batchId) return {};
    this.props.reimbursementBatchId = batchId;
    this.props.updatedById = actorId;
    return { reimbursement_batch_id: { before, after: batchId } };
  }
  /** Exclusão lógica (paga não se exclui; canceladas e rejeitadas podem sair da lista). */
  remove(
    actorId: number,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.deletedAt) throw new Error('Despesa já excluída.');
    if (this.props.status === ExpenseStatus.PAID)
      throw new Error('Despesa paga não pode ser excluída.');
    this.props.deletedAt = now;
    this.props.updatedById = actorId;
    return { deleted_at: { before: null, after: now } };
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
      throw new Error('Só despesas pendentes ou aprovadas podem ser pagas.');
    return this.transition(ExpenseStatus.PAID, actorId, 'paid', now);
  }
  cancel(actorId: number): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === ExpenseStatus.PAID)
      throw new Error('Despesas pagas não podem ser canceladas.');
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
      throw new Error('Despesas pagas não podem mudar de situação.');
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
