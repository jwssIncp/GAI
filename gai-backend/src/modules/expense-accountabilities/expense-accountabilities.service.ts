import { assertDreMonthsOpen } from '../managerial-dre/dre-closed-period';
import { monthlyDueDate } from './monthly-due-date.policy';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../auth/domain/enums/user.enums';
import { ProjectFieldAgentStatus } from '../field-agents/domain/enums/project-field-agent-status.enum';
import { FieldAgentEntity } from '../field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../field-agents/infrastructure/persistence/project-field-agent.entity';
import { ExpenseEntity } from '../payments-expenses/infrastructure/persistence/expense.entity';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import {
  AddAccountabilityExpenseDto,
  CreateExpenseAccountabilityDto,
  GenerateExpenseInstallmentsDto,
  ExpenseAccountabilityListQueryDto,
  ExpenseInstallmentListQueryDto,
} from './expense-accountability.dto';
import {
  ExpenseAccountabilityAuditLogEntity,
  ExpenseAccountabilityEntity,
  ExpenseAccountabilityItemEntity,
  ExpenseAccountabilityStatus,
  ExpenseInstallmentEntity,
} from './expense-accountability.entity';
import { InstallmentAllocationPolicy } from './installment-allocation.policy';

export interface ExpenseAccountabilityActor {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class ExpenseAccountabilitiesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectFieldAgentEntity)
    private readonly assignments: Repository<ProjectFieldAgentEntity>,
    @InjectRepository(ExpenseEntity)
    private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(ExpenseAccountabilityEntity)
    private readonly accountabilities: Repository<ExpenseAccountabilityEntity>,
    @InjectRepository(ExpenseAccountabilityItemEntity)
    private readonly items: Repository<ExpenseAccountabilityItemEntity>,
    @InjectRepository(ExpenseInstallmentEntity)
    private readonly installments: Repository<ExpenseInstallmentEntity>,
  ) {}

  async create(
    projectId: number,
    dto: CreateExpenseAccountabilityDto,
    actor: ExpenseAccountabilityActor,
  ) {
    const project = await this.project(projectId, actor, true);
    const start = this.date(dto.period_start);
    const end = this.date(dto.period_end);
    if (end < start)
      throw new ConflictException({
        code: 'INVALID_ACCOUNTABILITY_PERIOD',
        message: 'O fim do período não pode ser anterior ao início.',
      });
    const assignment = await this.assignments.findOne({
      where: {
        organizationId: project.organizationId,
        projectId,
        fieldAgentId: dto.field_agent_id,
        status: ProjectFieldAgentStatus.ACTIVE,
      },
    });
    if (!assignment)
      throw new ConflictException({
        code: 'FIELD_AGENT_NOT_ASSIGNED',
        message: 'O inventariante precisa estar vinculado e ativo no projeto.',
      });
    return this.dataSource
      .transaction(async (manager) => {
        const row = await manager
          .getRepository(ExpenseAccountabilityEntity)
          .save({
            organizationId: project.organizationId,
            projectId,
            fieldAgentId: dto.field_agent_id,
            periodStart: start,
            periodEnd: end,
            status: ExpenseAccountabilityStatus.OPEN,
            totalAmount: '0.00',
            notes: dto.notes?.trim() || null,
            responsibleById: actor.id,
            closedById: null,
            closedAt: null,
          });
        await this.audit(manager, row, null, 'CREATE', actor.id, {
          status: row.status,
        });
        return this.response(row, []);
      })
      .then((r) => this.withNames([r]).then(([x]) => x));
  }

  async list(
    projectId: number,
    query: ExpenseAccountabilityListQueryDto,
    actor: ExpenseAccountabilityActor,
  ) {
    const project = await this.project(projectId, actor, false);
    const qb = this.accountabilities
      .createQueryBuilder('a')
      .where('a.organizationId = :organizationId', {
        organizationId: project.organizationId,
      })
      .andWhere('a.projectId = :projectId', { projectId });
    if (query.field_agent_id)
      qb.andWhere('a.fieldAgentId = :fieldAgentId', {
        fieldAgentId: query.field_agent_id,
      });
    if (query.status)
      qb.andWhere('a.status = :status', { status: query.status });
    if (query.period_start)
      qb.andWhere('a.periodEnd >= :periodStart', {
        periodStart: query.period_start,
      });
    if (query.period_end)
      qb.andWhere('a.periodStart <= :periodEnd', {
        periodEnd: query.period_end,
      });
    const [rows, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    const items = await this.withNames(
      await Promise.all(
        rows.map(async (row) =>
          this.response(
            row,
            await this.items.find({ where: { accountabilityId: row.id } }),
          ),
        ),
      ),
    );
    return this.paginate(items, query.page, query.page_size, total);
  }

  async addExpense(
    projectId: number,
    id: number,
    dto: AddAccountabilityExpenseDto,
    actor: ExpenseAccountabilityActor,
  ) {
    const project = await this.project(projectId, actor, true);
    const accountability = await this.requireAccountability(projectId, id);
    if (accountability.status !== ExpenseAccountabilityStatus.OPEN)
      throw new ConflictException({
        code: 'ACCOUNTABILITY_NOT_OPEN',
        message: 'Só prestações de contas abertas podem ser alteradas.',
      });
    const expense = await this.expenses.findOne({
      where: {
        id: dto.expense_id,
        organizationId: project.organizationId,
        projectId,
      },
    });
    if (!expense) this.notFound('Despesa não encontrada.');
    if (expense.fieldAgentId !== accountability.fieldAgentId)
      throw new ConflictException({
        code: 'EXPENSE_FIELD_AGENT_MISMATCH',
        message:
          'A despesa precisa ser do inventariante da prestação de contas.',
      });
    const expenseDate = this.date(this.dateKey(expense.expenseDate));
    if (
      expenseDate < this.date(this.dateKey(accountability.periodStart)) ||
      expenseDate > this.date(this.dateKey(accountability.periodEnd))
    )
      throw new ConflictException({
        code: 'EXPENSE_OUTSIDE_ACCOUNTABILITY_PERIOD',
        message:
          'A data da despesa precisa estar dentro do período da prestação de contas.',
      });
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        if (
          await manager
            .getRepository(ExpenseAccountabilityItemEntity)
            .findOne({ where: { expenseId: expense.id } })
        )
          throw new ConflictException({
            code: 'EXPENSE_ALREADY_ACCOUNTED',
            message: 'A despesa já está em uma prestação de contas.',
          });
        const link = await manager
          .getRepository(ExpenseAccountabilityItemEntity)
          .save({
            organizationId: project.organizationId,
            projectId,
            accountabilityId: id,
            expenseId: expense.id,
          });
        await this.audit(
          manager,
          accountability,
          expense.id,
          'ADD_EXPENSE',
          actor.id,
          { amount: expense.amount },
        );
        const links = await manager
          .getRepository(ExpenseAccountabilityItemEntity)
          .find({ where: { accountabilityId: id } });
        return this.response(accountability, links.length ? links : [link]);
      });
      return (await this.withNames([saved]))[0];
    } catch (error) {
      if (this.isDuplicateExpenseMembership(error)) {
        throw new ConflictException({
          code: 'EXPENSE_ALREADY_ACCOUNTED',
          message: 'A despesa já está em uma prestação de contas.',
        });
      }
      throw error;
    }
  }

  async get(projectId: number, id: number, actor: ExpenseAccountabilityActor) {
    await this.project(projectId, actor, false);
    const row = await this.requireAccountability(projectId, id);
    const [item] = await this.withNames([
      this.response(
        row,
        await this.items.find({ where: { accountabilityId: id } }),
      ),
    ]);
    return item;
  }

  async close(
    projectId: number,
    id: number,
    actor: ExpenseAccountabilityActor,
  ) {
    await this.project(projectId, actor, true);
    return this.dataSource
      .transaction(async (manager) => {
        const repo = manager.getRepository(ExpenseAccountabilityEntity);
        const row = await repo.findOne({
          where: { id, projectId },
          ...(manager.connection.options.type === 'mysql'
            ? { lock: { mode: 'pessimistic_write' as const } }
            : {}),
        });
        if (!row) this.notFound('Prestação de contas não encontrada.');
        if (row.status !== ExpenseAccountabilityStatus.OPEN)
          throw new ConflictException({
            code: 'ACCOUNTABILITY_NOT_OPEN',
            message: 'Só prestações de contas abertas podem ser fechadas.',
          });
        const links = await manager
          .getRepository(ExpenseAccountabilityItemEntity)
          .find({ where: { accountabilityId: id } });
        if (!links.length)
          throw new ConflictException({
            code: 'ACCOUNTABILITY_EMPTY',
            message: 'Inclua ao menos uma despesa.',
          });
        const expenses = await manager
          .getRepository(ExpenseEntity)
          .createQueryBuilder('e')
          .where('e.id IN (:...ids)', {
            ids: links.map((link) => link.expenseId),
          })
          .getMany();
        const totalCents = expenses.reduce(
          (sum, expense) => sum + Math.round(Number(expense.amount) * 100),
          0,
        );
        row.totalAmount = (totalCents / 100).toFixed(2);
        row.status = ExpenseAccountabilityStatus.CLOSED;
        row.closedById = actor.id;
        row.closedAt = new Date();
        await repo.save(row);
        await this.audit(manager, row, null, 'CLOSE', actor.id, {
          total_amount: row.totalAmount,
          expense_count: links.length,
        });
        return this.response(row, links);
      })
      .then((r) => this.withNames([r]).then(([x]) => x));
  }

  async generateInstallments(
    projectId: number,
    expenseId: number,
    dto: GenerateExpenseInstallmentsDto,
    actor: ExpenseAccountabilityActor,
  ) {
    const project = await this.project(projectId, actor, true);
    const expense = await this.expenses.findOne({
      where: {
        id: expenseId,
        organizationId: project.organizationId,
        projectId,
      },
    });
    if (!expense) this.notFound('Despesa não encontrada.');
    if (await this.installments.count({ where: { expenseId } }))
      throw new ConflictException({
        code: 'INSTALLMENTS_ALREADY_EXIST',
        message: 'A despesa já tem parcelas geradas.',
      });
    const amounts = InstallmentAllocationPolicy.allocate(
      expense.amount,
      dto.count,
    );
    const first = this.date(dto.first_due_date);
    // As parcelas entram no fluxo (e na DRE) pelo vencimento.
    await assertDreMonthsOpen(
      this.dataSource.manager,
      project.organizationId,
      Array.from({ length: dto.count }, (_, i) => monthlyDueDate(first, i)),
      'Não é possível gerar as parcelas',
    );
    return this.dataSource.transaction(async (manager) => {
      const rows = [] as ExpenseInstallmentEntity[];
      for (let i = 0; i < dto.count; i++) {
        const due = monthlyDueDate(first, i);
        rows.push(
          manager.getRepository(ExpenseInstallmentEntity).create({
            organizationId: project.organizationId,
            projectId,
            expenseId,
            installmentNumber: i + 1,
            installmentCount: dto.count,
            dueDate: due.toISOString().slice(0, 10),
            amount: amounts[i],
            origin: dto.origin?.trim() || null,
          }),
        );
      }
      const saved = await manager
        .getRepository(ExpenseInstallmentEntity)
        .save(rows);
      await manager.getRepository(ExpenseAccountabilityAuditLogEntity).save({
        organizationId: project.organizationId,
        projectId,
        accountabilityId: null,
        expenseId,
        operation: 'GENERATE_INSTALLMENTS',
        performedBy: actor.id,
        changes: { count: dto.count, total_amount: expense.amount },
      });
      return saved.map((row) => this.installmentResponse(row));
    });
  }
  async listInstallments(
    projectId: number,
    expenseId: number,
    query: ExpenseInstallmentListQueryDto,
    actor: ExpenseAccountabilityActor,
  ) {
    const project = await this.project(projectId, actor, false);
    if (
      !(await this.expenses.findOne({
        where: {
          id: expenseId,
          organizationId: project.organizationId,
          projectId,
        },
      }))
    )
      this.notFound('Despesa não encontrada.');
    const [items, total] = await this.installments.findAndCount({
      where: { projectId, expenseId },
      order: { installmentNumber: 'ASC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return this.paginate(
      items.map((row) => this.installmentResponse(row)),
      query.page,
      query.page_size,
      total,
    );
  }

  private async project(
    id: number,
    actor: ExpenseAccountabilityActor,
    mutation: boolean,
  ) {
    const row = await this.projects.findOne({ where: { id } });
    if (!row) this.notFound('Projeto não encontrado.');
    if (
      !actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) &&
      actor.organizationId !== row.organizationId
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Você não tem permissão para esta ação.',
      });
    if (
      mutation &&
      ['inactive', 'finished', 'cancelled', 'archived'].includes(row.status)
    )
      throw new ConflictException({
        code: 'PROJECT_STATUS_BLOCKS_OPERATION',
        message: 'A situação do projeto não permite esta operação.',
      });
    return row;
  }
  private async requireAccountability(projectId: number, id: number) {
    const row = await this.accountabilities.findOne({
      where: { id, projectId },
    });
    if (!row) this.notFound('Prestação de contas não encontrada.');
    return row;
  }
  private date(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  private dateKey(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.slice(0, 10);
  }
  private isDuplicateExpenseMembership(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as {
      code?: string;
      errno?: number;
      sqlMessage?: string;
      message?: string;
    };
    const message = driverError.sqlMessage ?? driverError.message ?? '';
    return (
      (driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062) &&
      message.includes('uq_expense_accountability_items_expense')
    );
  }
  private notFound(message: string): never {
    throw new NotFoundException({ code: 'NOT_FOUND', message });
  }
  private async audit(
    manager: import('typeorm').EntityManager,
    row: ExpenseAccountabilityEntity,
    expenseId: number | null,
    operation: string,
    actorId: number,
    changes: Record<string, unknown>,
  ) {
    await manager.getRepository(ExpenseAccountabilityAuditLogEntity).save({
      organizationId: row.organizationId,
      projectId: row.projectId,
      accountabilityId: row.id,
      expenseId,
      operation,
      performedBy: actorId,
      changes,
    });
  }
  private response(
    row: ExpenseAccountabilityEntity,
    links: ExpenseAccountabilityItemEntity[],
  ) {
    return {
      id: row.id,
      organization_id: row.organizationId,
      project_id: row.projectId,
      field_agent_id: row.fieldAgentId,
      period_start: row.periodStart,
      period_end: row.periodEnd,
      status: row.status,
      total_amount: row.totalAmount,
      notes: row.notes,
      responsible_by_id: row.responsibleById,
      closed_by_id: row.closedById,
      closed_at: row.closedAt,
      expense_ids: links.map((link) => link.expenseId),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
  /**
   * Nome do inventariante e código/descrição das despesas, em lote: a tela não
   * mostra "#id" e não depende de outras permissões de leitura.
   */
  private async withNames(items: Array<ReturnType<typeof this.response>>) {
    if (!items.length) return [];
    const agentIds = [...new Set(items.map((i) => Number(i.field_agent_id)))];
    const expenseIds = [
      ...new Set(items.flatMap((i) => i.expense_ids.map(Number))),
    ];
    const [agents, expenses] = await Promise.all([
      this.dataSource.manager.find(FieldAgentEntity, {
        where: { id: In(agentIds) },
        withDeleted: true,
        select: { id: true, name: true },
      }),
      expenseIds.length
        ? this.expenses.find({
            where: { id: In(expenseIds) },
            withDeleted: true,
            select: {
              id: true,
              projectSequence: true,
              description: true,
              amount: true,
            },
          })
        : [],
    ]);
    const agent = new Map(agents.map((a) => [Number(a.id), a.name]));
    const expense = new Map(expenses.map((e) => [Number(e.id), e]));
    return items.map((i) => ({
      ...i,
      field_agent_name: agent.get(Number(i.field_agent_id)) ?? null,
      expenses: i.expense_ids.map((id) => {
        const e = expense.get(Number(id));
        return {
          id,
          project_sequence: e?.projectSequence ?? null,
          description: e?.description ?? null,
          amount: e?.amount ?? null,
        };
      }),
    }));
  }
  private installmentResponse(row: ExpenseInstallmentEntity) {
    return {
      id: row.id,
      expense_id: row.expenseId,
      installment_number: row.installmentNumber,
      installment_count: row.installmentCount,
      due_date: row.dueDate,
      amount: row.amount,
      origin: row.origin,
      created_at: row.createdAt,
    };
  }
  private paginate<T>(
    items: T[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    return {
      items,
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
