import 'reflect-metadata';
import { RemunerationService } from '../../../../src/modules/payments-expenses/application/services/remuneration.service';
import { ContractEntity } from '../../../../src/modules/contracts/contract.entity';
import { ExpenseEntity } from '../../../../src/modules/payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../../../../src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { ProjectEntity } from '../../../../src/modules/projects/infrastructure/persistence/project.entity';
import { ProjectFieldAgentEntity } from '../../../../src/modules/field-agents/infrastructure/persistence/project-field-agent.entity';
import { FieldAgentEntity } from '../../../../src/modules/field-agents/infrastructure/persistence/field-agent.entity';

const contract = (projectId: number, data: Record<string, unknown>) => ({
  projectId,
  data: { status: 'active', services: [], ...data },
});
const payment = (
  projectId: number,
  finalAmount: string,
  status = 'approved',
) => ({
  projectId,
  finalAmount,
  status,
});

function service(
  tables: Map<unknown, unknown[]>,
  alertPct: string | null = '30.00',
) {
  const ds = {
    getRepository: (entity: unknown) => ({
      find: jest.fn().mockResolvedValue(tables.get(entity) ?? []),
    }),
  };
  const settings = {
    valuesAt: alertPct
      ? jest.fn().mockResolvedValue({
          default_daily_rate: '185.00',
          require_approval: true,
          technician_expense_alert_pct: alertPct,
        })
      : jest.fn().mockRejectedValue(new Error('missing')),
  };
  return new RemunerationService(ds as never, settings as never);
}
const actor = { id: 1, systemRoles: [], organizationId: 1 };

describe('Remuneração: lista de projetos (doc 06 §2.1)', () => {
  const tables = new Map<unknown, unknown[]>([
    [
      ProjectEntity,
      [
        { id: 1, name: 'Alfa', status: 'active', finishedAt: null },
        {
          id: 2,
          name: 'Beta',
          status: 'finished',
          finishedAt: new Date('2026-10-01T00:00:00Z'),
        },
        { id: 3, name: 'Gama', status: 'draft', finishedAt: null },
        { id: 4, name: 'Delta', status: 'active', finishedAt: null },
      ],
    ],
    [
      ContractEntity,
      [
        contract(1, {
          current_value: '10000.00',
          expenses_paid_by: 'company',
          contracted_on: '2026-03-01',
          services: ['Inventário', 'CPC 27'],
          segment: 'Indústria',
          company_state: 'SP',
        }),
        contract(2, {
          current_value: '20000.00',
          expenses_paid_by: 'client',
          contracted_on: '2025-01-01',
        }),
        contract(3, { current_value: '5000.00', contracted_on: '2026-05-01' }),
        contract(4, {
          current_value: '8000.00',
          expenses_paid_by: 'client',
          contracted_on: '2026-06-01',
        }),
        contract(4, { current_value: '99999.00', status: 'cancelled' }),
      ],
    ],
    [
      ExpenseEntity,
      [
        // Etapa 4: vale o tipo real de cada despesa, não o do contrato.
        {
          projectId: 1,
          amount: '2000.00',
          status: 'approved',
          expenseType: 'non_reimbursable',
        },
        {
          projectId: 1,
          amount: '500.00',
          status: 'rejected',
          expenseType: 'non_reimbursable',
        },
        {
          projectId: 1,
          amount: '700.00',
          status: 'paid',
          expenseType: 'reimbursable',
        },
        {
          projectId: 1,
          amount: '300.00',
          status: 'pending',
          expenseType: null,
        },
        {
          projectId: 1,
          amount: '900.00',
          status: 'approved',
          expenseType: 'non_reimbursable',
          deletedAt: new Date(),
        },
        // Contrato "por conta do cliente", mas a despesa foi classificada como da empresa.
        {
          projectId: 2,
          amount: '150.00',
          status: 'approved',
          expenseType: 'non_reimbursable',
        },
        {
          projectId: 2,
          amount: '400.00',
          status: 'approved',
          expenseType: 'reimbursable',
        },
      ],
    ],
    [
      FieldAgentPaymentEntity,
      [
        payment(1, '2400.00'),
        payment(1, '800.00', 'paid'),
        payment(1, '5000.00', 'cancelled'),
        payment(2, '1000.00', 'paid'),
        payment(4, '100.00'),
      ],
    ],
    [
      ProjectFieldAgentEntity,
      [
        { projectId: 1, fieldAgentId: 10, status: 'active' },
        { projectId: 1, fieldAgentId: 11, status: 'finished' },
        { projectId: 1, fieldAgentId: 12, status: 'inactive' },
        { projectId: 1, fieldAgentId: 10, status: 'finished' },
        // Inventariante excluído (exclusão lógica): o vínculo antigo não conta.
        { projectId: 1, fieldAgentId: 13, status: 'active' },
      ],
    ],
    // find() sem withDeleted devolve só os não excluídos (o 13 está excluído).
    [FieldAgentEntity, [{ id: 10 }, { id: 11 }, { id: 12 }]],
  ]);

  it('calcula as colunas do projeto Alfa (contrato 10.000, despesas da empresa 2.000, inventariantes 3.200)', async () => {
    const { items } = await service(tables).projects({}, actor);
    const alfa = items.find((row) => row.name === 'Alfa')!;
    expect(alfa).toMatchObject({
      technicians: 2, // ativos e concluídos, sem duplicar; inativo e excluído fora; sem "Despesas gerais"
      contract_value: '10000.00',
      non_reimbursable_expenses: '2000.00', // rejeitada, excluída, reembolsável e não classificada fora
      unclassified_expenses: 1,
      net_contract_value: '8000.00',
      agents_cost: '3200.00', // cancelado fora (D-L)
      technician_pct: '32.00',
      technician_pct_alert: true, // > 30%
      net_pct: '40.00',
      net_pct_alert: true,
      scope: ['CPC 27', 'Inventário'],
      status_label: 'Em andamento',
    });
  });

  it('o tipo da despesa decide, não o contrato; sem despesas = 0', async () => {
    const { items } = await service(tables).projects({}, actor);
    const beta = items.find((row) => row.name === 'Beta')!;
    expect(beta).toMatchObject({
      non_reimbursable_expenses: '150.00', // contrato do cliente, despesa da empresa
      net_contract_value: '19850.00',
      technician_pct: '5.00',
      technician_pct_alert: false,
      unclassified_expenses: 0,
    });
    const gama = items.find((row) => row.name === 'Gama')!;
    expect(gama).toMatchObject({
      non_reimbursable_expenses: '0.00',
      net_contract_value: '5000.00',
      net_pct: null, // sem custo de inventariantes
    });
    const delta = items.find((row) => row.name === 'Delta')!;
    expect(delta.contract_value).toBe('8000.00'); // contrato cancelado fora
  });

  it('ordem: em andamento (contrato mais recente) › em preparação › concluídos', async () => {
    const { items, subtotal_agents_cost } = await service(tables).projects(
      {},
      actor,
    );
    expect(items.map((row) => row.name)).toEqual([
      'Delta',
      'Alfa',
      'Gama',
      'Beta',
    ]);
    expect(subtotal_agents_cost).toBe('4300.00');
  });

  it('filtros: só em aberto, busca por nome/segmento/UF e ano do contrato', async () => {
    const s = service(tables);
    expect(
      (await s.projects({ only_open: true }, actor as never)).items.map(
        (r) => r.name,
      ),
    ).toEqual(['Delta', 'Alfa', 'Gama']);
    expect(
      (await s.projects({ search: 'indús' }, actor as never)).items.map(
        (r) => r.name,
      ),
    ).toEqual(['Alfa']);
    expect(
      (await s.projects({ search: 'sp' }, actor as never)).items.map(
        (r) => r.name,
      ),
    ).toEqual(['Alfa']);
    expect(
      (await s.projects({ year: 2025 }, actor as never)).items.map(
        (r) => r.name,
      ),
    ).toEqual(['Beta']);
  });

  it('sem parâmetros financeiros, não alerta (não inventa 30%)', async () => {
    const { items, parameters } = await service(tables, null).projects(
      {},
      actor,
    );
    expect(parameters.settings_missing).toBe(true);
    expect(items.find((row) => row.name === 'Alfa')!.technician_pct_alert).toBe(
      false,
    );
  });
});

describe('Remuneração do projeto: vinculados e "a lançar"', () => {
  it('inventariante excluído não aparece como vinculado nem "a lançar"; o lançamento antigo continua com o nome', async () => {
    const tables = new Map<unknown, unknown[]>([
      [
        ProjectFieldAgentEntity,
        [
          { projectId: 1, fieldAgentId: 10, status: 'active' },
          { projectId: 1, fieldAgentId: 11, status: 'active' },
          { projectId: 1, fieldAgentId: 12, status: 'active' },
        ],
      ],
      [
        FieldAgentPaymentEntity,
        [
          {
            id: 5,
            projectId: 1,
            fieldAgentId: 12,
            status: 'paid',
            state: 'SP',
            startDate: '2026-11-01',
            endDate: '2026-11-01',
            expectedPaymentDate: null,
            paymentDate: '2026-11-05',
            days: 1,
            dailyRate: '185.00',
            additionalAmount: '0.00',
            dailyTotal: '185.00',
            totalAmount: '185.00',
            totalManual: false,
            discountAmount: '0.00',
            finalAmount: '185.00',
            notes: null,
            reopenedAt: null,
            updatedAt: new Date('2026-11-05T00:00:00Z'),
          },
        ],
      ],
      [
        FieldAgentEntity,
        [
          { id: 10, name: 'Ana', state: 'SP', deletedAt: null },
          {
            id: 11,
            name: 'Bruno (excluído)',
            state: 'RJ',
            deletedAt: new Date(),
          },
          {
            id: 12,
            name: 'Carla (excluída)',
            state: 'MG',
            deletedAt: new Date(),
          },
        ],
      ],
    ]);
    const ds = {
      getRepository: (entity: unknown) => ({
        find: jest.fn().mockResolvedValue(tables.get(entity) ?? []),
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          organizationId: 1,
          name: 'Alfa',
          status: 'active',
        }),
      }),
    };
    const settings = {
      valuesAt: jest.fn().mockResolvedValue({
        default_daily_rate: '185.00',
        require_approval: true,
        technician_expense_alert_pct: '30.00',
      }),
    };
    const data = await new RemunerationService(
      ds as never,
      settings as never,
    ).projectRemuneration(1, {}, actor);
    expect(data.agents.map((a) => a.id)).toEqual([10]);
    expect(data.to_launch.map((a) => a.field_agent_id)).toEqual([10]);
    expect(data.items[0]).toMatchObject({
      field_agent_name: 'Carla (excluída)',
      final_amount: '185.00',
      payment_date: '2026-11-05',
    });
  });
});
