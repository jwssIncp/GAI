import { daySummary } from '../../../../src/modules/payments-expenses/application/services/payment-day-summary';
import type { ConsolidatedRow } from '../../../../src/modules/payments-expenses/application/services/field-agent-payments.service';
import { PaymentStatus } from '../../../../src/modules/payments-expenses/domain/enums/payment-status.enum';

let next = 1;
const row = (over: Partial<ConsolidatedRow>): ConsolidatedRow => ({
  id: next++,
  project_id: 1,
  project_name: 'Projeto A',
  field_agent_id: 1,
  field_agent_name: 'Ana',
  state: 'SP',
  start_date: '2026-07-01',
  end_date: '2026-07-03',
  expected_payment_date: '2026-07-10',
  payment_date: null,
  days: 3,
  daily_rate: '100.00',
  additional_amount: '0.00',
  total_amount: '300.00',
  total_manual: false,
  discount_amount: '0.00',
  final_amount: '300.00',
  status: PaymentStatus.PENDING,
  overdue: false,
  no_expected: false,
  ...over,
});

describe('Resumo do dia (pagamentos previstos para a data)', () => {
  it('só em aberto da data; soma por inventariante entre projetos', () => {
    const summary = daySummary('2026-07-10', [
      row({ final_amount: '300.00' }),
      row({
        project_name: 'Projeto B',
        final_amount: '150.50',
        status: PaymentStatus.APPROVED,
      }),
      row({
        field_agent_id: 2,
        field_agent_name: 'Bruno',
        final_amount: '99.99',
      }),
      row({ status: PaymentStatus.PAID, payment_date: '2026-07-09' }),
      row({ status: PaymentStatus.CANCELLED }),
      row({ expected_payment_date: '2026-07-11' }),
    ]);
    expect(summary.items).toHaveLength(3);
    expect(summary.total).toBe('550.49');
    expect(summary.agents).toEqual([
      {
        field_agent_id: 1,
        name: 'Ana',
        state: 'SP',
        projects: ['Projeto A', 'Projeto B'],
        entries: 2,
        final: '450.50',
      },
      {
        field_agent_id: 2,
        name: 'Bruno',
        state: 'SP',
        projects: ['Projeto A'],
        entries: 1,
        final: '99.99',
      },
    ]);
  });

  it('dia sem pagamentos: planilha vazia com total zero', () => {
    expect(daySummary('2026-07-10', [])).toEqual({
      date: '2026-07-10',
      agents: [],
      items: [],
      total: '0.00',
    });
  });
});
