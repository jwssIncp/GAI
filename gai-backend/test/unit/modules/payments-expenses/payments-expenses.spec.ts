import { ExpenseAttachment } from '../../../../src/modules/payments-expenses/domain/entities/expense-attachment';
import { Expense } from '../../../../src/modules/payments-expenses/domain/entities/expense';
import { FieldAgentPayment } from '../../../../src/modules/payments-expenses/domain/entities/field-agent-payment';
import { PaymentStateConflict } from '../../../../src/modules/payments-expenses/domain/entities/payment-state-conflict';
import { ExpenseAttachmentStatus } from '../../../../src/modules/payments-expenses/domain/enums/expense-attachment-status.enum';
import { ExpenseStatus } from '../../../../src/modules/payments-expenses/domain/enums/expense-status.enum';
import { PaymentStatus } from '../../../../src/modules/payments-expenses/domain/enums/payment-status.enum';

function makePayment() {
  const now = new Date('2026-07-08T12:00:00.000Z');
  return new FieldAgentPayment({
    id: 1,
    organizationId: 1,
    projectId: 1,
    fieldAgentId: 1,
    state: 'SP',
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: new Date('2026-07-03T00:00:00.000Z'),
    paymentDate: null,
    days: 3,
    dailyRate: '100.00',
    additionalAmount: '50.00',
    dailyTotal: '0.00',
    discountAmount: '20.00',
    finalAmount: '0.00',
    status: PaymentStatus.PENDING,
    notes: null,
    approvedById: null,
    approvedAt: null,
    paidById: null,
    paidAt: null,
    createdById: 1,
    updatedById: 1,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('FieldAgentPayment domain', () => {
  it('calculates daily and final totals', () => {
    const payment = makePayment();
    expect(payment.toProps().dailyTotal).toBe('300.00');
    expect(payment.toProps().finalAmount).toBe('330.00');
  });
  it('approves and marks as paid', () => {
    const payment = makePayment();
    payment.approve(2, new Date('2026-07-04T00:00:00.000Z'));
    expect(payment.status).toBe(PaymentStatus.APPROVED);
    payment.markAsPaid(2, new Date('2026-07-05T00:00:00.000Z'), null);
    expect(payment.status).toBe(PaymentStatus.PAID);
  });
  it('rejects invalid date ranges', () => {
    expect(
      () =>
        new FieldAgentPayment({
          ...makePayment().toProps(),
          endDate: new Date('2026-06-30T00:00:00.000Z'),
        }),
    ).toThrow('end_date cannot be earlier than start_date');
  });
  it('preserves direct settlement of a pending payment and records its amount', () => {
    const payment = makePayment();
    const changes = payment.markAsPaid(
      2,
      new Date('2026-07-05T12:00:00Z'),
      null,
    );
    expect(changes.status).toEqual({
      before: PaymentStatus.PENDING,
      after: PaymentStatus.PAID,
    });
    expect(changes.final_amount).toEqual({ before: '330.00', after: '330.00' });
  });
  it('rejects every later mutation without losing settlement metadata', () => {
    const payment = makePayment();
    payment.markAsPaid(2, new Date('2026-07-05T12:00:00Z'), null);
    const before = payment.toProps();
    for (const mutate of [
      () => payment.approve(3, new Date()),
      () => payment.markAsPaid(3, new Date(), null),
      () => payment.cancel(3),
      () => payment.updateFields({ dailyRate: '1.00', updatedById: 3 }),
    ]) {
      expect(mutate).toThrow(PaymentStateConflict);
      expect(payment.toProps()).toEqual(before);
    }
  });
  it.each(['paidAt', 'paidById'] as const)(
    'fails closed on historical settlement metadata: %s',
    (field) => {
      const payment = new FieldAgentPayment({
        ...makePayment().toProps(),
        status: PaymentStatus.APPROVED,
        [field]: field === 'paidAt' ? new Date('2026-07-05T12:00:00Z') : 2,
      });
      const before = payment.toProps();
      expect(() => payment.markAsPaid(3, new Date(), null)).toThrow(
        PaymentStateConflict,
      );
      expect(() => payment.cancel(3)).toThrow(PaymentStateConflict);
      expect(payment.toProps()).toEqual(before);
    },
  );
  it('retains actual before/after amounts on edits', () => {
    const payment = makePayment();
    const changes = payment.updateFields({
      dailyRate: '101.01',
      updatedById: 2,
    });
    expect(changes.daily_total).toEqual({ before: '300.00', after: '303.03' });
    expect(changes.final_amount).toEqual({ before: '330.00', after: '333.03' });
  });
});

describe('Expense domain', () => {
  it('approves, rejects and pays according to status rules', () => {
    const props = {
      id: 1,
      organizationId: 1,
      projectId: 1,
      fieldAgentId: null,
      description: 'Taxi',
      reason: null,
      expenseDate: new Date('2026-07-02T00:00:00.000Z'),
      amount: '25.50',
      status: ExpenseStatus.PENDING,
      approvedById: null,
      approvedAt: null,
      rejectedById: null,
      rejectedAt: null,
      paidById: null,
      paidAt: null,
      createdById: 1,
      updatedById: 1,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const expense = new Expense(props);
    expense.approve(2, new Date());
    expect(expense.status).toBe(ExpenseStatus.APPROVED);
    expense.markAsPaid(2, new Date());
    expect(expense.status).toBe(ExpenseStatus.PAID);
  });
});

describe('ExpenseAttachment domain', () => {
  it('confirms upload and removes logically', () => {
    const now = new Date();
    const attachment = new ExpenseAttachment({
      id: 1,
      organizationId: 1,
      expenseId: 1,
      storageProvider: 's3',
      bucket: 'b',
      path: 'p',
      originalName: 'nota.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      checksum: null,
      status: ExpenseAttachmentStatus.PENDING_UPLOAD,
      uploadedById: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    attachment.confirmUpload({ checksum: 'abc' });
    expect(attachment.status).toBe(ExpenseAttachmentStatus.UPLOADED);
    attachment.remove();
    expect(attachment.status).toBe(ExpenseAttachmentStatus.REMOVED);
  });
});
