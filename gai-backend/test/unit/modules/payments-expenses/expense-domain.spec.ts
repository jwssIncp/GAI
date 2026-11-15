import { Expense } from '../../../../src/modules/payments-expenses/domain/entities/expense';
import { ExpenseStatus } from '../../../../src/modules/payments-expenses/domain/enums/expense-status.enum';

const make = (status = ExpenseStatus.PENDING) =>
  new Expense({
    id: 1,
    organizationId: 1,
    projectId: 10,
    fieldAgentId: 5,
    description: 'Táxi',
    reason: 'Motivo original',
    expenseDate: new Date('2026-10-05T00:00:00Z'),
    amount: '100.00',
    status,
    approvedById: status === ExpenseStatus.APPROVED ? 7 : null,
    approvedAt: status === ExpenseStatus.APPROVED ? new Date() : null,
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
    expenseType: 'reimbursable',
  });

describe('Despesa (domínio, etapa 4)', () => {
  it('rejeitar grava o motivo da rejeição sem sobrescrever o motivo original (bug corrigido)', () => {
    const e = make();
    const changes = e.reject(9, new Date(), 'Sem nota');
    expect(e.toProps()).toMatchObject({
      status: ExpenseStatus.REJECTED,
      reason: 'Motivo original',
      rejectionReason: 'Sem nota',
    });
    expect(changes.rejection_reason).toEqual({
      before: null,
      after: 'Sem nota',
    });
    expect(changes.reason).toBeUndefined();
  });

  it('reabrir: só aprovada; volta a pendente, limpa a aprovação e registra quem e quando', () => {
    expect(() => make(ExpenseStatus.PENDING).reopen(9, new Date())).toThrow(
      /Só despesas aprovadas/,
    );
    const e = make(ExpenseStatus.APPROVED);
    const now = new Date('2026-11-13T12:00:00Z');
    e.reopen(9, now);
    expect(e.toProps()).toMatchObject({
      status: ExpenseStatus.PENDING,
      approvedById: null,
      approvedAt: null,
      reopenedById: 9,
      reopenedAt: now,
    });
    // depois de reaberta, pode ser editada
    expect(e.updateFields({ amount: '90.00', updatedById: 9 })).toEqual({
      amount: { before: '100.00', after: '90.00' },
    });
  });

  it('edição só em pendente, com os campos novos; campo igual não gera alteração', () => {
    const e = make();
    const changes = e.updateFields({
      expenseType: 'non_reimbursable',
      reasonCode: 'Transporte',
      depositedAmount: '150.00',
      paymentMethod: null,
      updatedById: 2,
    });
    expect(Object.keys(changes).sort()).toEqual([
      'deposited_amount',
      'expense_type',
      'reason_code',
    ]);
    expect(() =>
      make(ExpenseStatus.APPROVED).updateFields({
        amount: '1.00',
        updatedById: 2,
      }),
    ).toThrow(/Reabra para edição/);
  });

  it('excluir: paga não; exclusão lógica com data; tipo e lote registram antes/depois', () => {
    expect(() => make(ExpenseStatus.PAID).remove(1, new Date())).toThrow(
      /paga/,
    );
    const e = make();
    e.remove(1, new Date('2026-11-13T00:00:00Z'));
    expect(e.deletedAt).toEqual(new Date('2026-11-13T00:00:00Z'));
    expect(() => e.remove(1, new Date())).toThrow(/já excluída/);
    const t = make();
    expect(t.changeType(1, 'reimbursable')).toEqual({});
    expect(t.changeType(1, 'non_reimbursable')).toEqual({
      expense_type: { before: 'reimbursable', after: 'non_reimbursable' },
    });
    expect(t.setBatch(1, 3)).toEqual({
      reimbursement_batch_id: { before: null, after: 3 },
    });
  });
});
