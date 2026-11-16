import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentStateConflict } from './payment-state-conflict';
import {
  RemunerationRuleError,
  remunerationTotals,
} from '../remuneration.formulas';

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
  expectedPaymentDate: Date | null;
  days: number;
  dailyRate: string;
  additionalAmount: string;
  dailyTotal: string;
  totalAmount: string;
  totalManual: boolean;
  discountAmount: string;
  finalAmount: string;
  status: PaymentStatus;
  notes: string | null;
  approvedById: number | null;
  approvedAt: Date | null;
  paidById: number | null;
  paidAt: Date | null;
  reopenedById: number | null;
  reopenedAt: Date | null;
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
    this.assertExpected(props.startDate, props.expectedPaymentDate);
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
        | 'expectedPaymentDate'
        | 'days'
        | 'dailyRate'
        | 'additionalAmount'
        | 'discountAmount'
        | 'totalAmount'
        | 'totalManual'
        | 'notes'
        | 'metadata'
      >
    > & { updatedById: number | null },
  ): Record<string, { before: unknown; after: unknown }> {
    this.assertNotPaid();
    if (this.props.status !== PaymentStatus.PENDING) {
      throw new PaymentStateConflict(
        'Só pagamentos pendentes podem ser alterados.',
      );
    }
    const previousDailyTotal = this.props.dailyTotal;
    const previousTotal = this.props.totalAmount;
    const previousFinalAmount = this.props.finalAmount;
    const changes = this.apply(fields);
    if (Object.keys(changes).length > 0)
      this.props.updatedById = fields.updatedById;
    this.assertDates(
      this.props.startDate,
      this.props.endDate,
      this.props.paymentDate,
    );
    this.assertExpected(this.props.startDate, this.props.expectedPaymentDate);
    this.recalculate();
    changes.total_amount = {
      before: previousTotal,
      after: this.props.totalAmount,
    };
    changes.daily_total = {
      before: previousDailyTotal,
      after: this.props.dailyTotal,
    };
    changes.final_amount = {
      before: previousFinalAmount,
      after: this.props.finalAmount,
    };
    return changes;
  }

  approve(
    actorId: number,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    this.assertNotPaid();
    if (this.props.status !== PaymentStatus.PENDING)
      throw new PaymentStateConflict(
        'Só pagamentos pendentes podem ser aprovados.',
      );
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

  /**
   * Baixa. Com o parâmetro "exigir aprovação" ligado, só lançamentos aprovados
   * podem ser pagos; desligado, pendentes também (decisão D-A).
   */
  markAsPaid(
    actorId: number,
    paidAt: Date,
    paymentDate: Date | null,
    requireApproval = false,
  ): Record<string, { before: unknown; after: unknown }> {
    this.assertNotPaid();
    if (requireApproval && this.props.status !== PaymentStatus.APPROVED)
      throw new PaymentStateConflict(
        'A organização exige aprovação antes do pagamento: aprove o lançamento primeiro.',
      );
    if (
      ![PaymentStatus.PENDING, PaymentStatus.APPROVED].includes(
        this.props.status,
      )
    )
      throw new PaymentStateConflict(
        'Só pagamentos pendentes ou aprovados podem ser pagos.',
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
    changes.final_amount = {
      before: this.props.finalAmount,
      after: this.props.finalAmount,
    };
    this.props.paymentDate = effectivePaymentDate;
    this.props.paidById = actorId;
    this.props.paidAt = paidAt;
    this.props.updatedById = actorId;
    return changes;
  }

  /**
   * Reabrir para edição (decisão D-D): aprovado volta a pendente de aprovação,
   * registrando quem reabriu e quando. Pago e cancelado não reabrem.
   */
  reopen(
    actorId: number,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    this.assertNotPaid();
    if (this.props.status !== PaymentStatus.APPROVED)
      throw new PaymentStateConflict(
        'Só lançamentos aprovados podem ser reabertos para edição.',
      );
    const changes = this.statusChange(PaymentStatus.PENDING);
    changes.approved_by_id = { before: this.props.approvedById, after: null };
    changes.approved_at = { before: this.props.approvedAt, after: null };
    changes.reopened_by_id = {
      before: this.props.reopenedById,
      after: actorId,
    };
    changes.reopened_at = { before: this.props.reopenedAt, after: now };
    this.props.approvedById = null;
    this.props.approvedAt = null;
    this.props.reopenedById = actorId;
    this.props.reopenedAt = now;
    this.props.updatedById = actorId;
    return changes;
  }

  /** Exclusão lógica: só pendente ou cancelado (aprovado precisa ser reaberto; pago nunca). */
  softDelete(
    actorId: number,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    this.assertNotPaid();
    if (
      ![PaymentStatus.PENDING, PaymentStatus.CANCELLED].includes(
        this.props.status,
      )
    )
      throw new PaymentStateConflict(
        'Só lançamentos pendentes ou cancelados podem ser excluídos. Reabra o lançamento aprovado antes.',
      );
    if (this.props.deletedAt)
      throw new PaymentStateConflict('Lançamento já excluído.');
    this.props.deletedAt = now;
    this.props.updatedById = actorId;
    return { deleted_at: { before: null, after: now } };
  }

  /**
   * Voltar para em aberto (decisão D-C): desfaz a baixa, limpando só a data de
   * pagamento e quem pagou; a previsão é preservada. Volta para "aprovado" se o
   * lançamento tinha sido aprovado; senão (pago direto, sem exigência), "pendente".
   */
  revertPayment(
    actorId: number,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== PaymentStatus.PAID)
      throw new PaymentStateConflict(
        'Só lançamentos pagos podem voltar para em aberto.',
      );
    const target = this.props.approvedById
      ? PaymentStatus.APPROVED
      : PaymentStatus.PENDING;
    const changes = this.statusChange(target);
    changes.payment_date = { before: this.props.paymentDate, after: null };
    changes.paid_by_id = { before: this.props.paidById, after: null };
    changes.paid_at = { before: this.props.paidAt, after: null };
    this.props.paymentDate = null;
    this.props.paidById = null;
    this.props.paidAt = null;
    this.props.updatedById = actorId;
    return changes;
  }

  /** Alterar a data real de um lançamento pago (não muda valores nem status). */
  changePaymentDate(
    actorId: number,
    paymentDate: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== PaymentStatus.PAID)
      throw new PaymentStateConflict(
        'Só lançamentos pagos têm data de pagamento.',
      );
    this.assertDates(this.props.startDate, this.props.endDate, paymentDate);
    const changes = {
      payment_date: { before: this.props.paymentDate, after: paymentDate },
    };
    this.props.paymentDate = paymentDate;
    this.props.updatedById = actorId;
    return changes;
  }

  /** Alterar a data prevista de um lançamento em aberto (pendente ou aprovado). */
  changeExpectedDate(
    actorId: number,
    expected: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (
      ![PaymentStatus.PENDING, PaymentStatus.APPROVED].includes(
        this.props.status,
      )
    )
      throw new PaymentStateConflict(
        'Só lançamentos em aberto têm a previsão alterada.',
      );
    this.assertExpected(this.props.startDate, expected);
    const changes = {
      expected_payment_date: {
        before: this.props.expectedPaymentDate,
        after: expected,
      },
    };
    this.props.expectedPaymentDate = expected;
    this.props.updatedById = actorId;
    return changes;
  }

  cancel(actorId: number): Record<string, { before: unknown; after: unknown }> {
    this.assertNotPaid();
    const changes = this.statusChange(PaymentStatus.CANCELLED);
    this.props.updatedById = actorId;
    return changes;
  }

  toProps(): FieldAgentPaymentProps {
    return { ...this.props };
  }

  private assertNotPaid(): void {
    // Also fail closed for historical rows left inconsistent by a stale write.
    // Reads remain possible; this does not rewrite or repair historical data.
    if (
      this.props.status === PaymentStatus.PAID ||
      this.props.paidAt ||
      this.props.paidById !== null
    )
      throw new PaymentStateConflict(
        'O pagamento já foi pago; não é possível alterá-lo.',
      );
  }

  private apply(
    fields: Record<string, unknown>,
  ): Record<string, { before: unknown; after: unknown }> {
    const map: Record<string, keyof FieldAgentPaymentProps> = {
      state: 'state',
      startDate: 'startDate',
      endDate: 'endDate',
      expectedPaymentDate: 'expectedPaymentDate',
      days: 'days',
      dailyRate: 'dailyRate',
      additionalAmount: 'additionalAmount',
      discountAmount: 'discountAmount',
      totalAmount: 'totalAmount',
      totalManual: 'totalManual',
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

  /** Fórmulas do doc 06 §2.3 em centavos exatos (remuneration.formulas). */
  private recalculate(): void {
    try {
      const totals = remunerationTotals({
        days: Number(this.props.days),
        dailyRate: this.props.dailyRate,
        additionalAmount: this.props.additionalAmount,
        discountAmount: this.props.discountAmount,
        manualTotal: this.props.totalManual ? this.props.totalAmount : null,
      });
      this.props.dailyTotal = totals.dailyTotal;
      this.props.totalAmount = totals.totalAmount;
      this.props.finalAmount = totals.finalAmount;
    } catch (error) {
      if (error instanceof RemunerationRuleError)
        throw new Error(error.message);
      throw error;
    }
  }
  private assertExpected(startDate: Date, expected: Date | null): void {
    if (expected && expected.getTime() < startDate.getTime())
      throw new Error(
        'A data prevista de pagamento não pode ser anterior à data inicial.',
      );
  }

  private assertMoney(value: string): void {
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(value))
      throw new Error('Os valores em R$ devem ser números decimais.');
  }
  private assertDays(value: number): void {
    if (!Number.isInteger(value) || value < 0)
      throw new Error(
        'O número de dias deve ser um inteiro maior ou igual a zero.',
      );
  }
  private assertDates(
    startDate: Date,
    endDate: Date,
    paymentDate: Date | null,
  ): void {
    if (endDate.getTime() < startDate.getTime())
      throw new Error('A data final não pode ser anterior à data inicial.');
    if (paymentDate && paymentDate.getTime() < startDate.getTime())
      throw new Error(
        'A data de pagamento não pode ser anterior à data inicial.',
      );
  }
  private toColumn(prop: keyof FieldAgentPaymentProps): string {
    return prop.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  }
}
