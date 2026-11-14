import 'reflect-metadata';
import { FieldAgentPaymentsService } from '../../../../src/modules/payments-expenses/application/services/field-agent-payments.service';
import { FieldAgentPayment } from '../../../../src/modules/payments-expenses/domain/entities/field-agent-payment';
import { PaymentStateConflict } from '../../../../src/modules/payments-expenses/domain/entities/payment-state-conflict';
import { PaymentStatus } from '../../../../src/modules/payments-expenses/domain/enums/payment-status.enum';
import { FieldAgentPaymentEntity } from '../../../../src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { FieldAgentEntity } from '../../../../src/modules/field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectEntity } from '../../../../src/modules/projects/infrastructure/persistence/project.entity';
import * as policy from '../../../../src/modules/finance-settings/finance-settings.policy';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const actor = { id: 9, systemRoles: [], organizationId: 1 };

// Hoje fixo: 2026-11-13 (mês de referência 2026-11; próximo mês 2026-12).
beforeEach(() =>
  jest.spyOn(policy, 'civilToday').mockReturnValue('2026-11-13'),
);
afterEach(() => jest.restoreAllMocks());

const row = (
  id: number,
  patch: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id,
  organizationId: 1,
  projectId: 10,
  fieldAgentId: 100,
  state: 'SP',
  startDate: '2026-11-01',
  endDate: '2026-11-05',
  expectedPaymentDate: '2026-11-20',
  paymentDate: null,
  days: 5,
  dailyRate: '185.00',
  additionalAmount: '0.00',
  totalAmount: '925.00',
  totalManual: false,
  discountAmount: '0.00',
  finalAmount: '925.00',
  status: 'pending',
  ...patch,
});

function service(
  rows: Record<string, unknown>[],
  extra: Record<string, unknown> = {},
) {
  const tables = new Map<unknown, unknown[]>([
    [FieldAgentPaymentEntity, rows],
    [
      ProjectEntity,
      [
        { id: 10, name: 'Alfa' },
        { id: 11, name: 'Beta' },
      ],
    ],
    [
      FieldAgentEntity,
      [
        { id: 100, name: 'Ana' },
        { id: 101, name: 'Bruno' },
      ],
    ],
  ]);
  const ds = {
    getRepository: (e: unknown) => ({
      find: jest.fn().mockResolvedValue(tables.get(e) ?? []),
    }),
  };
  const settings = {
    valuesAt: jest.fn().mockResolvedValue({ require_approval: true }),
  };
  const remuneration = { closedPeriodsFor: jest.fn().mockResolvedValue([]) };
  return {
    remuneration,
    s: new FieldAgentPaymentsService(
      ds as never,
      (extra.repo ?? {}) as never,
      settings as never,
      remuneration as never,
    ),
  };
}

const data = [
  row(1), // pendente, previsto 20/11 (mês), 925
  row(2, {
    status: 'approved',
    expectedPaymentDate: '2026-11-10',
    finalAmount: '500.00',
  }), // aprovado e ATRASADO
  row(3, {
    status: 'paid',
    expectedPaymentDate: '2026-10-30',
    paymentDate: '2026-11-02',
    finalAmount: '1000.00',
  }), // pago no mês
  row(4, {
    fieldAgentId: 101,
    projectId: 11,
    status: 'pending',
    expectedPaymentDate: '2026-12-05',
    finalAmount: '300.00',
  }), // próximo mês
  row(5, {
    status: 'cancelled',
    expectedPaymentDate: '2026-11-25',
    finalAmount: '9999.00',
  }), // cancelado: fora
  row(6, {
    fieldAgentId: 101,
    projectId: 11,
    status: 'paid',
    expectedPaymentDate: '2026-09-30',
    paymentDate: '2026-10-01',
    finalAmount: '200.00',
  }),
];

describe('Pagamento de inventariantes: KPIs (doc 06 §4.1 + atraso)', () => {
  it('calcula os 8 KPIs e o de atraso, sem cancelados', async () => {
    const { kpis } = await service(data).s.list({}, actor);
    expect(kpis).toEqual({
      reference_month: '2026-11',
      total: '2925.00', // 925 + 500 + 1000 + 300 + 200
      paid: '1200.00', // 1000 + 200
      open: '1725.00', // 925 + 500 + 300
      field_agents: 2,
      expected_in_month: '1425.00', // previstos em 11/2026: 925 (1) + 500 (2); o 3 foi previsto em 10/2026
      paid_in_month: '1000.00',
      open_in_month: '1425.00',
      open_next_month: '300.00',
      overdue: '500.00', // previsão 10/11 < hoje e em aberto
      overdue_count: 1,
      no_expected: '0.00',
      no_expected_count: 0,
    });
  });

  it('diária antiga sem previsão: KPI próprio, no topo da lista e filtro; nada de previsão automática', async () => {
    const withLegacy = [
      ...data,
      row(7, {
        status: 'approved',
        expectedPaymentDate: null,
        finalAmount: '150.00',
      }),
    ];
    const s = service(withLegacy).s;
    const all = await s.list({}, actor);
    expect([all.kpis.no_expected, all.kpis.no_expected_count]).toEqual([
      '150.00',
      1,
    ]);
    const legacy = all.items.find((i) => i.id === 7)!;
    expect([
      legacy.no_expected,
      legacy.overdue,
      legacy.expected_payment_date,
    ]).toEqual([true, false, null]);
    // Sem previsão e atrasados no topo (sem previsão antes), depois os demais em aberto.
    expect(all.items.map((i) => i.id)).toEqual([7, 2, 1, 4, 6, 3, 5]);
    expect(
      (await s.list({ no_expected: true }, actor as never)).items.map(
        (i) => i.id,
      ),
    ).toEqual([7]);
    // Pago sem previsão (histórico) não conta como pendência.
    const paidLegacy = await service([
      row(8, {
        status: 'paid',
        expectedPaymentDate: null,
        paymentDate: '2026-07-01',
      }),
    ]).s.list({}, actor);
    expect(paidLegacy.kpis.no_expected_count).toBe(0);
  });
});

describe('Pagamento de inventariantes: facetas, resumo e ordem', () => {
  it('facetas em cascata: cada filtro conta com os OUTROS filtros aplicados', async () => {
    const { facets } = await service(data).s.list(
      { field_agent_id: 101 },
      actor,
    );
    expect(facets.project_id).toEqual({
      total: 2,
      options: [{ value: '11', label: 'Beta', count: 2 }],
    });
    expect(facets.field_agent_id.total).toBe(6); // o próprio filtro não se restringe
    expect(facets.status.options[0]).toEqual({
      value: 'open',
      label: 'Em aberto',
      count: 1,
    });
  });

  it('resumo por inventariante: por padrão só quem tem valor em aberto; com filtro de pagos, todos', async () => {
    const paid = await service(data).s.list(
      { project_id: 11, status: 'paid' },
      actor,
    );
    expect(paid.summary.show_all).toBe(true);
    expect(paid.summary.rows).toEqual([
      {
        field_agent_id: 101,
        name: 'Bruno',
        entries: 1,
        days: 5,
        final: '200.00',
        paid: '200.00',
        open: '0.00',
      },
    ]);
    const def = await service(data).s.list({}, actor);
    expect(
      def.summary.rows.map((r) => [r.name, r.entries, r.final, r.paid, r.open]),
    ).toEqual([
      ['Ana', 3, '2425.00', '1000.00', '1425.00'],
      ['Bruno', 2, '500.00', '200.00', '300.00'],
    ]);
    expect(def.summary.subtotal).toEqual({
      final: '2925.00',
      paid: '1200.00',
      open: '1725.00',
    });
  });

  it('em aberto primeiro (previsão mais antiga antes), depois os demais; marca atrasados', async () => {
    const { items } = await service(data).s.list({}, actor);
    expect(items.map((i) => i.id)).toEqual([2, 1, 4, 6, 3, 5]);
    expect(items.find((i) => i.id === 2)!.overdue).toBe(true);
    expect(items.find((i) => i.id === 1)!.overdue).toBe(false);
  });

  it('filtros de mês, data e status em aberto', async () => {
    const s = service(data).s;
    expect(
      (await s.list({ expected_month: '2026-12' }, actor as never)).items.map(
        (i) => i.id,
      ),
    ).toEqual([4]);
    expect(
      (await s.list({ paid_month: '2026-11' }, actor as never)).items.map(
        (i) => i.id,
      ),
    ).toEqual([3]);
    expect(
      (await s.list({ payment_date: '2026-10-01' }, actor as never)).items.map(
        (i) => i.id,
      ),
    ).toEqual([6]);
    expect(
      (await s.list({ status: 'open' }, actor as never)).items.map((i) => i.id),
    ).toEqual([2, 1, 4]);
  });
});

function payment(
  status: PaymentStatus,
  patch: Partial<ConstructorParameters<typeof FieldAgentPayment>[0]> = {},
) {
  const now = new Date('2026-11-10T12:00:00Z');
  const approved = status !== PaymentStatus.PENDING;
  return new FieldAgentPayment({
    id: 1,
    organizationId: 1,
    projectId: 10,
    fieldAgentId: 100,
    state: 'SP',
    startDate: d('2026-11-01'),
    endDate: d('2026-11-05'),
    paymentDate: null,
    expectedPaymentDate: d('2026-11-20'),
    days: 5,
    dailyRate: '185.00',
    additionalAmount: '0.00',
    dailyTotal: '0.00',
    totalAmount: '0.00',
    totalManual: false,
    discountAmount: '0.00',
    finalAmount: '0.00',
    status,
    notes: null,
    approvedById: approved ? 7 : null,
    approvedAt: approved ? now : null,
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

describe('Pagamento de inventariantes: baixa em lote e voltar para em aberto', () => {
  function withRepo(payments: Map<number, FieldAgentPayment>) {
    const repo = {
      findPaymentById: jest.fn((id: number) =>
        Promise.resolve(payments.get(id) ?? null),
      ),
      mutatePaymentWithAudit: jest.fn(
        (
          _project: number,
          id: number,
          fn: (p: FieldAgentPayment, s: string) => unknown,
        ) => {
          const p = payments.get(id)!;
          fn(p, 'active');
          return Promise.resolve(p);
        },
      ),
    };
    return { repo, ...service([], { repo }) };
  }

  it('"hoje" grava a data de hoje, NÃO a previsão (bug do INVESTOR)', async () => {
    const p = payment(PaymentStatus.APPROVED);
    const { s } = withRepo(new Map([[1, p]]));
    expect(
      await s.pay({ ids: [1], date_mode: 'today' }, actor as never),
    ).toEqual({
      done: 1,
      failed: 0,
      results: [{ id: 1, ok: true }],
    });
    expect(p.toProps().paymentDate).toEqual(d('2026-11-13'));
    expect(p.toProps().expectedPaymentDate).toEqual(d('2026-11-20'));
  });

  it('data escolhida para todos e data individual por lançamento', async () => {
    const a = payment(PaymentStatus.APPROVED, { id: 1 });
    const b = payment(PaymentStatus.APPROVED, { id: 2 });
    await withRepo(
      new Map([
        [1, a],
        [2, b],
      ]),
    ).s.pay(
      { ids: [1, 2], date_mode: 'chosen', payment_date: '2026-11-10' },
      actor,
    );
    expect([a.toProps().paymentDate, b.toProps().paymentDate]).toEqual([
      d('2026-11-10'),
      d('2026-11-10'),
    ]);
    const c = payment(PaymentStatus.APPROVED, { id: 3 });
    const e = payment(PaymentStatus.APPROVED, { id: 4 });
    await withRepo(
      new Map([
        [3, c],
        [4, e],
      ]),
    ).s.pay(
      {
        ids: [3, 4],
        date_mode: 'individual',
        dates: { '3': '2026-11-11', '4': '2026-11-12' },
      },
      actor,
    );
    expect([c.toProps().paymentDate, e.toProps().paymentDate]).toEqual([
      d('2026-11-11'),
      d('2026-11-12'),
    ]);
  });

  it('baixa com data futura é recusada (data escolhida e data por lançamento)', async () => {
    const a = payment(PaymentStatus.APPROVED, { id: 1 });
    const repo = withRepo(new Map([[1, a]]));
    await expect(
      repo.s.pay(
        { ids: [1], date_mode: 'chosen', payment_date: '2099-01-01' },
        actor,
      ),
    ).rejects.toThrow(/não pode ser futura/);
    const result = await repo.s.pay(
      { ids: [1], date_mode: 'individual', dates: { '1': '2099-01-01' } },
      actor,
    );
    expect(result.results[0]).toMatchObject({
      ok: false,
      message: expect.stringMatching(/não pode ser futura/),
    });
    expect(a.toProps().paymentDate).toBeNull();
  });

  it('o lote relata cada item: pendente com exigência de aprovação não é pago, o aprovado sim', async () => {
    const pending = payment(PaymentStatus.PENDING, { id: 1 });
    const approved = payment(PaymentStatus.APPROVED, { id: 2 });
    const result = await withRepo(
      new Map([
        [1, pending],
        [2, approved],
      ]),
    ).s.pay({ ids: [1, 2], date_mode: 'today' }, actor);
    expect(result.done).toBe(1);
    expect(result.results[0]).toMatchObject({ id: 1, ok: false });
    expect([pending.status, approved.status]).toEqual([
      PaymentStatus.PENDING,
      PaymentStatus.PAID,
    ]);
  });

  it('data anterior ao início é recusada no item, sem pagar', async () => {
    const p = payment(PaymentStatus.APPROVED);
    const result = await withRepo(new Map([[1, p]])).s.pay(
      { ids: [1], date_mode: 'chosen', payment_date: '2026-10-01' },
      actor,
    );
    expect(result.failed).toBe(1);
    expect(p.status).toBe(PaymentStatus.APPROVED);
  });

  it('voltar para em aberto: aprovado volta a aprovado, limpa só a baixa e mantém a previsão (D-C)', async () => {
    const p = payment(PaymentStatus.APPROVED);
    p.markAsPaid(9, new Date(), d('2026-11-13'), true);
    await withRepo(new Map([[1, p]])).s.revert([1], actor);
    const x = p.toProps();
    expect([
      x.status,
      x.paymentDate,
      x.paidById,
      x.paidAt,
      x.expectedPaymentDate,
    ]).toEqual([PaymentStatus.APPROVED, null, null, null, d('2026-11-20')]);
  });

  it('pago direto (sem exigência de aprovação) volta a pendente', () => {
    const p = payment(PaymentStatus.PENDING);
    p.markAsPaid(9, new Date(), d('2026-11-13'), false);
    p.revertPayment(9);
    expect(p.status).toBe(PaymentStatus.PENDING);
  });

  it('voltar para em aberto é bloqueado em competência fechada da DRE', async () => {
    const p = payment(PaymentStatus.APPROVED);
    p.markAsPaid(9, new Date(), d('2026-11-13'), true);
    const ctx = withRepo(new Map([[1, p]]));
    ctx.remuneration.closedPeriodsFor.mockResolvedValue(['2026-11']);
    const result = await ctx.s.revert([1], actor);
    expect(result.results[0]).toMatchObject({
      ok: false,
      message: 'Classificado na DRE em competência fechada (2026-11).',
    });
    expect(p.status).toBe(PaymentStatus.PAID);
  });

  it('só pago volta para em aberto; cada data só no estado certo', () => {
    expect(() => payment(PaymentStatus.APPROVED).revertPayment(1)).toThrow(
      PaymentStateConflict,
    );
    expect(() =>
      payment(PaymentStatus.APPROVED).changePaymentDate(1, d('2026-11-15')),
    ).toThrow(PaymentStateConflict);
    const paid = payment(PaymentStatus.APPROVED);
    paid.markAsPaid(1, new Date(), d('2026-11-13'), true);
    expect(() => paid.changeExpectedDate(1, d('2026-11-30'))).toThrow(
      PaymentStateConflict,
    );
    expect(paid.changePaymentDate(1, d('2026-11-14'))).toEqual({
      payment_date: { before: d('2026-11-13'), after: d('2026-11-14') },
    });
    const open = payment(PaymentStatus.PENDING);
    expect(() => open.changeExpectedDate(1, d('2026-10-01'))).toThrow(
      'A data prevista de pagamento não pode ser anterior à data inicial.',
    );
    open.changeExpectedDate(1, d('2026-11-30'));
    expect(open.toProps().expectedPaymentDate).toEqual(d('2026-11-30'));
  });

  it('erro de programação no item não é engolido como falha', async () => {
    const repo = {
      findPaymentById: jest.fn().mockRejectedValue(new TypeError('boom')),
    };
    await expect(
      service([], { repo }).s.pay(
        { ids: [1], date_mode: 'today' },
        actor as never,
      ),
    ).rejects.toThrow('boom');
  });
});
