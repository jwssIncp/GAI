import { closedPeriodError } from '../../../../src/modules/managerial-dre/dre-closed-period';
import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { FieldAgentPayment } from '../../../../src/modules/payments-expenses/domain/entities/field-agent-payment';
import { PaymentStateConflict } from '../../../../src/modules/payments-expenses/domain/entities/payment-state-conflict';
import { PaymentStatus } from '../../../../src/modules/payments-expenses/domain/enums/payment-status.enum';
import { PaymentsExpensesService } from '../../../../src/modules/payments-expenses/application/services/payments-expenses.service';
import { PaymentsExpensesScopeService } from '../../../../src/modules/payments-expenses/application/services/payments-expenses-scope.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
function payment(
  patch: Partial<ConstructorParameters<typeof FieldAgentPayment>[0]> = {},
) {
  const now = new Date('2026-11-13T12:00:00.000Z');
  return new FieldAgentPayment({
    id: 7,
    organizationId: 1,
    projectId: 3,
    fieldAgentId: 5,
    state: 'SP',
    startDate: d('2026-11-03'),
    endDate: d('2026-11-07'),
    paymentDate: null,
    expectedPaymentDate: d('2026-11-20'),
    days: 5,
    dailyRate: '185.00',
    additionalAmount: '50.00',
    dailyTotal: '0.00',
    totalAmount: '0.00',
    totalManual: false,
    discountAmount: '30.00',
    finalAmount: '0.00',
    status: PaymentStatus.PENDING,
    notes: null,
    approvedById: null,
    approvedAt: null,
    paidById: null,
    paidAt: null,
    reopenedById: null,
    reopenedAt: null,
    createdById: 1,
    updatedById: 1,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...patch,
  });
}

describe('Remuneração: lançamento (domínio)', () => {
  it('calcula total com adicional e final com descontos: 5 × 185 + 50 − 30', () => {
    const p = payment().toProps();
    expect([p.dailyTotal, p.totalAmount, p.finalAmount]).toEqual([
      '925.00',
      '975.00',
      '945.00',
    ]);
  });

  it('mudar as datas na edição recalcula COM o adicional', () => {
    const p = payment();
    const changes = p.updateFields({
      startDate: d('2026-11-03'),
      endDate: d('2026-11-09'),
      days: 7,
      updatedById: 2,
    });
    expect(p.toProps().totalAmount).toBe('1345.00'); // 7 × 185 + 50
    expect(p.toProps().finalAmount).toBe('1315.00');
    expect(changes.total_amount).toEqual({
      before: '975.00',
      after: '1345.00',
    });
  });

  it('total manual é preservado e marcado', () => {
    const p = payment({ totalManual: true, totalAmount: '1000.00' }).toProps();
    expect([p.totalAmount, p.finalAmount, p.totalManual]).toEqual([
      '1000.00',
      '970.00',
      true,
    ]);
  });

  it('data prevista não pode ser antes do início', () => {
    expect(() => payment({ expectedPaymentDate: d('2026-11-01') })).toThrow(
      'A data prevista de pagamento não pode ser anterior à data inicial.',
    );
  });

  it('com "exigir aprovação", pendente não pode ser pago; aprovado pode', () => {
    expect(() => payment().markAsPaid(9, new Date(), null, true)).toThrow(
      PaymentStateConflict,
    );
    const approved = payment();
    approved.approve(9, new Date());
    approved.markAsPaid(
      9,
      new Date('2026-11-21T10:00:00Z'),
      d('2026-11-21'),
      true,
    );
    expect(approved.status).toBe(PaymentStatus.PAID);
    // Sem exigência (parâmetro desligado), pendente pode ir direto a pago.
    const direct = payment();
    direct.markAsPaid(9, new Date(), d('2026-11-21'), false);
    expect(direct.status).toBe(PaymentStatus.PAID);
  });

  it('pagar sem informar data grava a data de hoje, não a prevista (bug do INVESTOR)', () => {
    const p = payment();
    const paidAt = new Date('2026-11-25T15:00:00Z');
    p.markAsPaid(9, paidAt, null, false);
    expect(p.toProps().paymentDate).toEqual(paidAt);
    expect(p.toProps().expectedPaymentDate).toEqual(d('2026-11-20'));
  });

  it('reabrir: aprovado volta a pendente e registra quem e quando (D-D)', () => {
    const p = payment();
    p.approve(9, new Date('2026-11-14T10:00:00Z'));
    const at = new Date('2026-11-15T10:00:00Z');
    const changes = p.reopen(12, at);
    const x = p.toProps();
    expect(x.status).toBe(PaymentStatus.PENDING);
    expect([
      x.approvedById,
      x.approvedAt,
      x.reopenedById,
      x.reopenedAt,
    ]).toEqual([null, null, 12, at]);
    expect(changes.status).toEqual({ before: 'approved', after: 'pending' });
    // Depois de reaberto, volta a ser editável.
    p.updateFields({ additionalAmount: '0.00', updatedById: 12 });
    expect(p.toProps().finalAmount).toBe('895.00');
  });

  it('não reabre pendente, pago ou cancelado', () => {
    expect(() => payment().reopen(1, new Date())).toThrow(PaymentStateConflict);
    const paid = payment();
    paid.markAsPaid(1, new Date(), null, false);
    expect(() => paid.reopen(1, new Date())).toThrow(PaymentStateConflict);
    const cancelled = payment();
    cancelled.cancel(1);
    expect(() => cancelled.reopen(1, new Date())).toThrow(PaymentStateConflict);
  });

  it('aprovado não pode ser editado sem reabrir', () => {
    const p = payment();
    p.approve(9, new Date());
    expect(() =>
      p.updateFields({ dailyRate: '200.00', updatedById: 9 }),
    ).toThrow(PaymentStateConflict);
  });

  it('excluir: só pendente ou cancelado; aprovado e pago não', () => {
    const p = payment();
    const at = new Date();
    expect(p.softDelete(1, at)).toEqual({
      deleted_at: { before: null, after: at },
    });
    const approved = payment();
    approved.approve(1, new Date());
    expect(() => approved.softDelete(1, new Date())).toThrow(
      PaymentStateConflict,
    );
    const paid = payment();
    paid.markAsPaid(1, new Date(), null, false);
    expect(() => paid.softDelete(1, new Date())).toThrow(PaymentStateConflict);
  });
});

describe('Remuneração: criação valida tudo antes de gravar (nada de registro vazio)', () => {
  function service(save: jest.Mock) {
    const projects = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 3, organizationId: 1, status: 'active' }),
    };
    const fieldAgents = {
      findById: jest
        .fn()
        .mockResolvedValue({ organizationId: 1, isActive: () => true }),
      hasActiveAssignment: jest.fn().mockResolvedValue(true),
    };
    const scope = new PaymentsExpensesScopeService();
    jest
      .spyOn(scope, 'assertCanAccessOrganization')
      .mockImplementation(() => undefined);
    jest
      .spyOn(scope, 'assertProjectAllowsMutation')
      .mockImplementation(() => undefined);
    return new PaymentsExpensesService(
      { savePaymentWithAudit: save } as never,
      projects as never,
      fieldAgents as never,
      {} as never,
      scope,
      { setContext: jest.fn() } as never,
      {} as never,
      // Sem competência fechada: a criação segue para a gravação.
      {
        assertPaymentMonthsOpen: jest.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
    );
  }
  const actor = { id: 9, systemRoles: [], organizationId: 1 };
  const base = {
    field_agent_id: 5,
    start_date: '2026-11-03',
    end_date: '2026-11-07',
    daily_rate: '185.00',
    additional_amount: '50.00',
  };

  it('sem data prevista: 400 e nada é gravado', async () => {
    const save = jest.fn();
    await expect(
      service(save).createPayment(3, base, actor as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('descontos maiores que o total: 400 e nada é gravado', async () => {
    const save = jest.fn();
    await expect(
      service(save).createPayment(
        3,
        {
          ...base,
          expected_payment_date: '2026-11-20',
          discount_amount: '976.00',
        },
        actor as never,
      ),
    ).rejects.toMatchObject({
      response: { message: 'Os descontos não podem ser maiores que o total.' },
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('total manual sem valor: 400 e nada é gravado', async () => {
    const save = jest.fn();
    await expect(
      service(save).createPayment(
        3,
        { ...base, expected_payment_date: '2026-11-20', total_manual: true },
        actor as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('válido: grava com data prevista, sem data de pagamento real e com o total calculado', async () => {
    const save = jest
      .fn()
      .mockImplementation((p: FieldAgentPayment) => Promise.resolve(p));
    const res = await service(save).createPayment(
      3,
      {
        ...base,
        expected_payment_date: '2026-11-20',
        discount_amount: '30.00',
      },
      actor,
    );
    expect(res).toMatchObject({
      expected_payment_date: '2026-11-20',
      payment_date: null,
      // 03/11 (terça) a 07/11 (sábado): 4 dias de segunda a sexta
      days: 4,
      total_amount: '790.00',
      total_manual: false,
      final_amount: '760.00',
      status: 'pending',
    });
  });

  it('cliente antigo que manda a previsão em payment_date continua funcionando', async () => {
    const save = jest
      .fn()
      .mockImplementation((p: FieldAgentPayment) => Promise.resolve(p));
    const res = await service(save).createPayment(
      3,
      { ...base, payment_date: '2026-11-20' },
      actor,
    );
    expect(res).toMatchObject({
      expected_payment_date: '2026-11-20',
      payment_date: null,
    });
  });

  it('erro de estado continua 409 (não vira 400)', () => {
    expect(new ConflictException().getStatus()).toBe(409);
  });
});

describe('Remuneração: reabrir respeita competência fechada na DRE (D-D)', () => {
  function service(closed: string[]) {
    const repo = {
      findPaymentById: jest.fn().mockResolvedValue({
        projectId: 3,
        organizationId: 1,
      }),
      mutatePaymentWithAudit: jest.fn(),
    };
    const scope = new PaymentsExpensesScopeService();
    jest
      .spyOn(scope, 'assertCanAccessOrganization')
      .mockImplementation(() => undefined);
    const remuneration = {
      assertPaymentMonthsOpen: jest.fn(
        async (_org: number, _id: number, action: string) => {
          if (closed.length) throw closedPeriodError(action, closed);
        },
      ),
    };
    return {
      repo,
      remuneration,
      service: new PaymentsExpensesService(
        repo as never,
        {} as never,
        {} as never,
        {} as never,
        scope,
        { setContext: jest.fn() } as never,
        {} as never,
        remuneration as never,
        {} as never,
      ),
    };
  }
  const actor = { id: 9, systemRoles: [], organizationId: 1 };

  it('lançamento classificado em mês fechado não reabre (409) e nada é gravado', async () => {
    const { service: s, repo, remuneration } = service(['2026-10']);
    await expect(
      s.reopenPayment(3, 7, { reason: 'Corrigir diária' }, actor as never),
    ).rejects.toMatchObject({ response: { code: 'DRE_PERIOD_CLOSED' } });
    expect(remuneration.assertPaymentMonthsOpen).toHaveBeenCalledWith(
      1,
      7,
      'Não é possível reabrir a diária',
    );
    expect(repo.mutatePaymentWithAudit).not.toHaveBeenCalled();
  });

  it('sem competência fechada, segue para a reabertura auditada', async () => {
    const { service: s, repo } = service([]);
    repo.mutatePaymentWithAudit.mockResolvedValue(null);
    await expect(
      s.reopenPayment(3, 7, { reason: 'Corrigir diária' }, actor as never),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    expect(repo.mutatePaymentWithAudit).toHaveBeenCalledTimes(1);
  });
});
