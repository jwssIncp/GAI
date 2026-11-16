import { QueryFailedError } from 'typeorm';
import { ExpenseAccountabilitiesService } from '../../../../src/modules/expense-accountabilities/expense-accountabilities.service';
import { ExpenseAccountabilityStatus } from '../../../../src/modules/expense-accountabilities/expense-accountability.entity';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';

describe('ExpenseAccountabilitiesService', () => {
  it.each([true, false])(
    'maps only the expense membership constraint (matching=%s)',
    async (matching) => {
      const duplicate = new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('Duplicate entry'), {
          code: 'ER_DUP_ENTRY',
          errno: 1062,
          sqlMessage:
            "Duplicate entry '5' for key 'expense_accountability_items.uq_expense_accountability_items_expense'",
        }),
      );
      const failure = matching
        ? duplicate
        : new QueryFailedError(
            'INSERT',
            [],
            Object.assign(new Error('unrelated unique constraint'), {
              code: 'ER_DUP_ENTRY',
              errno: 1062,
            }),
          );
      const dataSource = {
        transaction: jest.fn().mockRejectedValue(failure),
      };
      const projects = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 1, organizationId: 1, status: 'active' }),
      };
      const accountabilities = {
        findOne: jest.fn().mockResolvedValue({
          id: 2,
          projectId: 1,
          organizationId: 1,
          fieldAgentId: 7,
          status: ExpenseAccountabilityStatus.OPEN,
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
        }),
      };
      const expenses = {
        findOne: jest.fn().mockResolvedValue({
          id: 5,
          organizationId: 1,
          projectId: 1,
          fieldAgentId: 7,
          expenseDate: '2026-08-10',
          amount: '50.00',
        }),
      };
      const service = new ExpenseAccountabilitiesService(
        dataSource as never,
        projects as never,
        {} as never,
        expenses as never,
        accountabilities as never,
        {} as never,
        {} as never,
      );

      const operation = service.addExpense(
        1,
        2,
        { expense_id: 5 },
        {
          id: 2,
          systemRoles: [UserRole.ORG_ADMIN],
          organizationId: 1,
        },
      );
      if (!matching) {
        await expect(operation).rejects.toBe(failure);
        return;
      }
      await expect(operation).rejects.toMatchObject({
        status: 409,
        response: {
          code: 'EXPENSE_ALREADY_ACCOUNTED',
        },
      });
    },
  );

  it('detalhe traz o nome do inventariante e o código das despesas, sem "#id"', async () => {
    const dataSource = {
      manager: {
        find: jest.fn().mockResolvedValue([{ id: 7, name: 'Ana Campo' }]),
      },
    };
    const projects = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 1, organizationId: 1, status: 'active' }),
    };
    const accountabilities = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        projectId: 1,
        organizationId: 1,
        fieldAgentId: 7,
        status: ExpenseAccountabilityStatus.OPEN,
      }),
    };
    const items = {
      find: jest.fn().mockResolvedValue([{ expenseId: 5 }, { expenseId: 6 }]),
    };
    const expenses = {
      find: jest.fn().mockResolvedValue([
        {
          id: 5,
          projectSequence: 12,
          description: 'Pedágio',
          amount: '9.90',
        },
      ]),
    };
    const service = new ExpenseAccountabilitiesService(
      dataSource as never,
      projects as never,
      {} as never,
      expenses as never,
      accountabilities as never,
      items as never,
      {} as never,
    );
    const result = await service.get(1, 2, {
      id: 2,
      systemRoles: [UserRole.ORG_ADMIN],
      organizationId: 1,
    });
    expect(result.field_agent_name).toBe('Ana Campo');
    expect(result.expenses).toEqual([
      { id: 5, project_sequence: 12, description: 'Pedágio', amount: '9.90' },
      { id: 6, project_sequence: null, description: null, amount: null },
    ]);
  });

  it('projeto inexistente: mensagem em português', async () => {
    const service = new ExpenseAccountabilitiesService(
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.get(1, 2, {
        id: 2,
        systemRoles: [UserRole.ORG_ADMIN],
        organizationId: 1,
      }),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND', message: 'Projeto não encontrado.' },
    });
  });
});
