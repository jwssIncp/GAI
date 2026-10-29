import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { ProjectStatus } from '../../../projects/domain/enums/project-status.enum';
import { ExpenseAttachment } from '../../domain/entities/expense-attachment';
import { Expense } from '../../domain/entities/expense';
import { FieldAgentPayment } from '../../domain/entities/field-agent-payment';
import { ExpenseAttachmentStatus } from '../../domain/enums/expense-attachment-status.enum';
import {
  ListExpensesParams,
  ListPaymentsParams,
  PaymentExpenseAuditEntry,
  PaymentSummary,
  PaymentsExpensesRepository,
} from '../../domain/ports/payments-expenses.repository.port';
import { ExpenseAttachmentEntity } from './expense-attachment.entity';
import { ExpenseEntity } from './expense.entity';
import { FieldAgentPaymentEntity } from './field-agent-payment.entity';
import { PaymentExpenseAuditLogEntity } from './payment-expense-audit-log.entity';

@Injectable()
export class TypeOrmPaymentsExpensesRepository implements PaymentsExpensesRepository {
  constructor(
    @InjectRepository(FieldAgentPaymentEntity)
    private readonly paymentRepo: Repository<FieldAgentPaymentEntity>,
    @InjectRepository(ExpenseEntity)
    private readonly expenseRepo: Repository<ExpenseEntity>,
    @InjectRepository(ExpenseAttachmentEntity)
    private readonly attachmentRepo: Repository<ExpenseAttachmentEntity>,
  ) {}

  async findPaymentById(id: number): Promise<FieldAgentPayment | null> {
    const entity = await this.paymentRepo
      .createQueryBuilder('payment')
      .withDeleted()
      .where('payment.id = :id', { id })
      .getOne();
    return entity ? this.toPayment(entity) : null;
  }
  async listPayments(
    params: ListPaymentsParams,
  ): Promise<{ items: FieldAgentPayment[]; total: number }> {
    const qb = this.paymentRepo
      .createQueryBuilder('payment')
      .withDeleted()
      .where('payment.organizationId = :organizationId', params)
      .andWhere('payment.projectId = :projectId', params);
    if (params.fieldAgentId)
      qb.andWhere('payment.fieldAgentId = :fieldAgentId', params);
    if (params.status) qb.andWhere('payment.status = :status', params);
    if (params.state) qb.andWhere('payment.state = :state', params);
    if (params.search)
      qb.andWhere('LOWER(payment.notes) LIKE :term', {
        term: `%${params.search.toLowerCase()}%`,
      });
    qb.orderBy('payment.createdAt', 'DESC');
    if (this.hasPaymentDateFilters(params)) {
      const filtered = (await qb.getMany()).filter((payment) =>
        this.matchesPaymentDateFilters(payment, params),
      );
      const offset = (params.page - 1) * params.pageSize;
      return {
        items: filtered
          .slice(offset, offset + params.pageSize)
          .map((e) => this.toPayment(e)),
        total: filtered.length,
      };
    }
    qb.skip((params.page - 1) * params.pageSize).take(params.pageSize);
    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((e) => this.toPayment(e)), total };
  }
  async savePaymentWithAudit(
    payment: FieldAgentPayment,
    audit: PaymentExpenseAuditEntry,
  ): Promise<FieldAgentPayment> {
    if (payment.id > 0)
      throw new Error('Existing payments require mutatePaymentWithAudit');
    return this.paymentRepo.manager.transaction(async (manager) => {
      return this.persistPayment(manager, payment, audit);
    });
  }
  async mutatePaymentWithAudit(
    projectId: number,
    paymentId: number,
    mutate: (
      payment: FieldAgentPayment,
      projectStatus: ProjectStatus,
    ) => PaymentExpenseAuditEntry,
  ): Promise<FieldAgentPayment | null> {
    return this.paymentRepo.manager.transaction(async (manager) => {
      const projectQuery = manager
        .getRepository(ProjectEntity)
        .createQueryBuilder('project')
        .where('project.id = :projectId', { projectId });
      const paymentQuery = manager
        .getRepository(FieldAgentPaymentEntity)
        .createQueryBuilder('payment')
        .withDeleted()
        .where('payment.id = :paymentId', { paymentId })
        .andWhere('payment.projectId = :projectId', { projectId });
      if (manager.connection.options.type !== 'sqlite') {
        // Shared project lock first: lifecycle writes wait, while independent
        // payment rows in the same project can proceed concurrently.
        projectQuery.setLock('pessimistic_read');
        paymentQuery.setLock('pessimistic_write');
      }
      const project = await projectQuery.getOne();
      if (!project) return null;
      // A locking read sees the latest committed row even at REPEATABLE READ.
      const entity = await paymentQuery
        .andWhere('payment.organizationId = :organizationId', {
          organizationId: project.organizationId,
        })
        .getOne();
      if (!entity) return null;
      const payment = this.toPayment(entity);
      const audit = mutate(payment, project.status);
      return this.persistPayment(manager, payment, audit);
    });
  }
  async summarizePayments(
    organizationId: number,
    projectId: number,
  ): Promise<PaymentSummary> {
    const qb = this.paymentRepo
      .createQueryBuilder('payment')
      .withDeleted()
      .where('payment.organizationId = :organizationId', { organizationId })
      .andWhere('payment.projectId = :projectId', { projectId })
      .select('COUNT(*)', 'total_count');
    for (const status of ['pending', 'approved', 'paid', 'cancelled']) {
      qb.addSelect(
        `ROUND(COALESCE(SUM(CASE WHEN payment.status = :${status} THEN payment.finalAmount ELSE 0 END), 0), 2)`,
        `total_${status}`,
      ).setParameter(status, status);
    }
    const row = await qb.getRawOne<Record<string, string | number>>();
    return {
      total_pending: this.decimalTotal(row!.total_pending),
      total_approved: this.decimalTotal(row!.total_approved),
      total_paid: this.decimalTotal(row!.total_paid),
      total_cancelled: this.decimalTotal(row!.total_cancelled),
      total_count: Number(row!.total_count),
    };
  }
  private decimalTotal(value: string | number): string {
    // MySQL SUM(DECIMAL) stays a decimal string, including totals beyond the
    // precision of JS Number. SQLite's ROUND is only a test compatibility path.
    const match = /^(-?\d+)(?:\.(\d{0,2})0*)?$/.exec(String(value));
    if (!match) throw new Error('Invalid decimal payment total');
    return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`;
  }
  private async persistPayment(
    manager: EntityManager,
    payment: FieldAgentPayment,
    audit: PaymentExpenseAuditEntry,
  ): Promise<FieldAgentPayment> {
    const saved = await manager
      .getRepository(FieldAgentPaymentEntity)
      .save(this.toPaymentEntity(payment));
    await manager.getRepository(PaymentExpenseAuditLogEntity).save({
      ...audit,
      changes: {
        final_amount: {
          before: payment.id > 0 ? payment.toProps().finalAmount : null,
          after: payment.toProps().finalAmount,
        },
        ...audit.changes,
      },
      organizationId: payment.organizationId,
      projectId: payment.projectId,
      paymentId: saved.id,
    });
    return this.toPayment(saved);
  }
  async findExpenseById(id: number): Promise<Expense | null> {
    const entity = await this.expenseRepo
      .createQueryBuilder('expense')
      .withDeleted()
      .where('expense.id = :id', { id })
      .getOne();
    return entity ? this.toExpense(entity) : null;
  }
  async listExpenses(
    params: ListExpensesParams,
  ): Promise<{ items: Expense[]; total: number }> {
    const qb = this.expenseRepo
      .createQueryBuilder('expense')
      .withDeleted()
      .where('expense.organizationId = :organizationId', params)
      .andWhere('expense.projectId = :projectId', params);
    if (params.fieldAgentId)
      qb.andWhere('expense.fieldAgentId = :fieldAgentId', params);
    if (params.status) qb.andWhere('expense.status = :status', params);
    if (params.search)
      qb.andWhere(
        '(LOWER(expense.description) LIKE :term OR LOWER(expense.reason) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    qb.orderBy('expense.createdAt', 'DESC');
    if (this.hasExpenseDateFilters(params)) {
      const filtered = (await qb.getMany()).filter((expense) =>
        this.matchesExpenseDateFilters(expense, params),
      );
      const offset = (params.page - 1) * params.pageSize;
      return {
        items: filtered
          .slice(offset, offset + params.pageSize)
          .map((e) => this.toExpense(e)),
        total: filtered.length,
      };
    }
    qb.skip((params.page - 1) * params.pageSize).take(params.pageSize);
    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((e) => this.toExpense(e)), total };
  }
  async saveExpenseWithAudit(
    expense: Expense,
    audit: PaymentExpenseAuditEntry,
  ): Promise<Expense> {
    return this.expenseRepo.manager.transaction(async (manager) => {
      const saved = await manager
        .getRepository(ExpenseEntity)
        .save(this.toExpenseEntity(expense));
      await manager
        .getRepository(PaymentExpenseAuditLogEntity)
        .save({ ...audit, expenseId: audit.expenseId ?? saved.id });
      return this.toExpense(saved);
    });
  }
  async findAttachmentById(id: number): Promise<ExpenseAttachment | null> {
    const entity = await this.attachmentRepo
      .createQueryBuilder('attachment')
      .withDeleted()
      .where('attachment.id = :id', { id })
      .getOne();
    return entity ? this.toAttachment(entity) : null;
  }
  async listAttachments(expenseId: number): Promise<ExpenseAttachment[]> {
    const entities = await this.attachmentRepo.find({ where: { expenseId } });
    return entities.map((e) => this.toAttachment(e));
  }
  async saveAttachmentWithAudit(
    attachment: ExpenseAttachment,
    audit: PaymentExpenseAuditEntry,
  ): Promise<ExpenseAttachment> {
    return this.attachmentRepo.manager.transaction(async (manager) => {
      const saved = await manager
        .getRepository(ExpenseAttachmentEntity)
        .save(this.toAttachmentEntity(attachment));
      await manager.getRepository(PaymentExpenseAuditLogEntity).save({
        ...audit,
        expenseAttachmentId: audit.expenseAttachmentId ?? saved.id,
      });
      return this.toAttachment(saved);
    });
  }
  async audit(audit: PaymentExpenseAuditEntry): Promise<void> {
    await this.paymentRepo.manager
      .getRepository(PaymentExpenseAuditLogEntity)
      .save(audit);
  }
  private toPaymentEntity(p: FieldAgentPayment): FieldAgentPaymentEntity {
    const x = p.toProps();
    const e = this.paymentRepo.create(x as Partial<FieldAgentPaymentEntity>);
    e.startDate = this.dateKey(x.startDate) as unknown as Date;
    e.endDate = this.dateKey(x.endDate) as unknown as Date;
    e.paymentDate = x.paymentDate
      ? (this.dateKey(x.paymentDate) as unknown as Date)
      : null;
    if (x.id > 0) e.id = x.id;
    else delete (e as Partial<FieldAgentPaymentEntity>).id;
    return e;
  }
  private toExpenseEntity(p: Expense): ExpenseEntity {
    const x = p.toProps();
    const e = this.expenseRepo.create(x as Partial<ExpenseEntity>);
    e.expenseDate = this.dateKey(x.expenseDate) as unknown as Date;
    if (x.id > 0) e.id = x.id;
    else delete (e as Partial<ExpenseEntity>).id;
    return e;
  }
  private toAttachmentEntity(p: ExpenseAttachment): ExpenseAttachmentEntity {
    const x = p.toProps();
    const e = this.attachmentRepo.create(x as Partial<ExpenseAttachmentEntity>);
    if (x.id > 0) e.id = x.id;
    else delete (e as Partial<ExpenseAttachmentEntity>).id;
    return e;
  }
  private toPayment(e: FieldAgentPaymentEntity): FieldAgentPayment {
    return new FieldAgentPayment({
      ...e,
      id: Number(e.id),
      organizationId: Number(e.organizationId),
      projectId: Number(e.projectId),
      fieldAgentId: Number(e.fieldAgentId),
      days: Number(e.days),
      dailyRate: this.money(e.dailyRate),
      additionalAmount: this.money(e.additionalAmount),
      dailyTotal: this.money(e.dailyTotal),
      discountAmount: this.money(e.discountAmount),
      finalAmount: this.money(e.finalAmount),
      startDate: this.date(e.startDate),
      endDate: this.date(e.endDate),
      paymentDate: this.nullDate(e.paymentDate),
      createdAt: this.date(e.createdAt),
      updatedAt: this.date(e.updatedAt),
      deletedAt: this.nullDate(e.deletedAt),
    });
  }
  private toExpense(e: ExpenseEntity): Expense {
    return new Expense({
      ...e,
      id: Number(e.id),
      organizationId: Number(e.organizationId),
      projectId: Number(e.projectId),
      fieldAgentId: e.fieldAgentId === null ? null : Number(e.fieldAgentId),
      amount: this.money(e.amount),
      expenseDate: this.date(e.expenseDate),
      createdAt: this.date(e.createdAt),
      updatedAt: this.date(e.updatedAt),
      deletedAt: this.nullDate(e.deletedAt),
    });
  }
  private toAttachment(e: ExpenseAttachmentEntity): ExpenseAttachment {
    return new ExpenseAttachment({
      ...e,
      id: Number(e.id),
      organizationId: Number(e.organizationId),
      expenseId: Number(e.expenseId),
      sizeBytes: Number(e.sizeBytes),
      status: e.status ?? ExpenseAttachmentStatus.PENDING_UPLOAD,
      createdAt: this.date(e.createdAt),
      updatedAt: this.date(e.updatedAt),
      deletedAt: this.nullDate(e.deletedAt),
    });
  }
  private money(v: string | number): string {
    return Number(v).toFixed(2);
  }
  private date(v: Date | string): Date {
    return v instanceof Date ? v : new Date(v);
  }
  private nullDate(v: Date | string | null): Date | null {
    return v === null ? null : this.date(v);
  }
  private hasPaymentDateFilters(params: ListPaymentsParams): boolean {
    return Boolean(
      params.startDate || params.endDateExclusive || params.paymentDate,
    );
  }
  private hasExpenseDateFilters(params: ListExpensesParams): boolean {
    return Boolean(params.startDate || params.endDateExclusive);
  }
  private matchesPaymentDateFilters(
    payment: FieldAgentPaymentEntity,
    params: ListPaymentsParams,
  ): boolean {
    const startDate = this.dateKey(payment.startDate);
    const endDate = this.dateKey(payment.endDate);
    const paymentDate = this.nullDateKey(payment.paymentDate);
    return (
      (!params.startDate || startDate >= params.startDate) &&
      (!params.endDateExclusive || endDate < params.endDateExclusive) &&
      (!params.paymentDate ||
        (paymentDate !== null &&
          paymentDate >= params.paymentDate &&
          paymentDate < params.paymentDateExclusive!))
    );
  }
  private matchesExpenseDateFilters(
    expense: ExpenseEntity,
    params: ListExpensesParams,
  ): boolean {
    const expenseDate = this.dateKey(expense.expenseDate);
    return (
      (!params.startDate || expenseDate >= params.startDate) &&
      (!params.endDateExclusive || expenseDate < params.endDateExclusive)
    );
  }
  private dateKey(v: Date | string): string {
    return this.date(v).toISOString().slice(0, 10);
  }
  private nullDateKey(v: Date | string | null): string | null {
    return v === null ? null : this.dateKey(v);
  }
}
