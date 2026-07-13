import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  STORAGE_SIGNER,
  type StorageSigner,
} from '../../../../common/storage/storage-signer.port';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../../field-agents/domain/ports/field-agent.repository.port';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { ExpenseAttachment } from '../../domain/entities/expense-attachment';
import { Expense } from '../../domain/entities/expense';
import { FieldAgentPayment } from '../../domain/entities/field-agent-payment';
import { ExpenseAttachmentStatus } from '../../domain/enums/expense-attachment-status.enum';
import { ExpenseStatus } from '../../domain/enums/expense-status.enum';
import { PaymentExpenseAuditOperation } from '../../domain/enums/payment-expense-audit-operation.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import {
  PAYMENTS_EXPENSES_REPOSITORY,
  type PaymentsExpensesRepository,
} from '../../domain/ports/payments-expenses.repository.port';
import {
  ConfirmExpenseAttachmentUploadDto,
  CreateExpenseAttachmentUploadDto,
  ExpenseInputDto,
  MarkAsPaidDto,
  PaymentInputDto,
  RejectExpenseDto,
} from '../dto/payments-expenses-inputs';
import {
  ListExpensesQueryDto,
  ListPaymentsQueryDto,
} from '../dto/payments-expenses-query.dto';
import {
  AttachmentDownloadUrlResponseDto,
  AttachmentUploadUrlResponseDto,
  ExpenseAttachmentResponseDto,
  ExpenseListResponseDto,
  ExpenseResponseDto,
  PaymentListResponseDto,
  PaymentResponseDto,
  PaymentSummaryResponseDto,
} from '../dto/payments-expenses-response.dto';
import {
  PaymentsExpensesActorContext,
  PaymentsExpensesScopeService,
} from './payments-expenses-scope.service';

@Injectable()
export class PaymentsExpensesService {
  constructor(
    @Inject(PAYMENTS_EXPENSES_REPOSITORY)
    private readonly repo: PaymentsExpensesRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly fieldAgents: FieldAgentRepository,
    @Inject(STORAGE_SIGNER) private readonly storageSigner: StorageSigner,
    private readonly scope: PaymentsExpensesScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PaymentsExpensesService.name);
  }

  async createPayment(
    projectId: number,
    dto: PaymentInputDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<PaymentResponseDto> {
    const project = await this.getProject(projectId, actor, true);
    await this.assertFieldAgent(
      project.organizationId,
      projectId,
      dto.field_agent_id,
    );
    const startDate = this.requiredDate(dto.start_date, 'start_date');
    const endDate = this.requiredDate(dto.end_date, 'end_date');
    const now = new Date();
    const payment = new FieldAgentPayment({
      id: 0,
      organizationId: project.organizationId,
      projectId,
      fieldAgentId: dto.field_agent_id,
      state: this.scope.cleanText(dto.state) ?? null,
      startDate,
      endDate,
      paymentDate: this.scope.parseDate(dto.payment_date),
      days: this.scope.daysBetweenInclusive(startDate, endDate),
      dailyRate: dto.daily_rate,
      additionalAmount: dto.additional_amount ?? '0.00',
      dailyTotal: '0.00',
      discountAmount: dto.discount_amount ?? '0.00',
      finalAmount: '0.00',
      status: PaymentStatus.PENDING,
      notes: this.scope.cleanText(dto.notes) ?? null,
      approvedById: null,
      approvedAt: null,
      paidById: null,
      paidAt: null,
      createdById: actor.id,
      updatedById: actor.id,
      metadata: dto.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    const saved = await this.repo.savePaymentWithAudit(payment, {
      organizationId: project.organizationId,
      projectId,
      operation: PaymentExpenseAuditOperation.CREATE_PAYMENT,
      performedBy: actor.id,
      changes: { status: { before: null, after: PaymentStatus.PENDING } },
    });
    return PaymentResponseDto.fromDomain(saved);
  }
  async listPayments(
    projectId: number,
    query: ListPaymentsQueryDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<PaymentListResponseDto> {
    const project = await this.getProject(projectId, actor, false);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repo.listPayments({
      page,
      pageSize,
      organizationId: project.organizationId,
      projectId,
      fieldAgentId: query.field_agent_id,
      status: query.status,
      state: query.state,
      startDate: query.start_date,
      endDateExclusive: this.scope.nextDateString(query.end_date),
      paymentDate: query.payment_date,
      paymentDateExclusive: this.scope.nextDateString(query.payment_date),
      search: query.search,
    });
    return {
      items: items.map((item) => PaymentResponseDto.fromDomain(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
  async getPayment(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<PaymentResponseDto> {
    return PaymentResponseDto.fromDomain(
      await this.findPayment(projectId, id, actor),
    );
  }
  async updatePayment(
    projectId: number,
    id: number,
    dto: PaymentInputDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<PaymentResponseDto> {
    const payment = await this.findPayment(projectId, id, actor);
    await this.getProject(projectId, actor, true);
    const startDate = this.requiredDate(dto.start_date, 'start_date');
    const endDate = this.requiredDate(dto.end_date, 'end_date');
    const changes = payment.updateFields({
      state: this.scope.cleanText(dto.state) ?? null,
      startDate,
      endDate,
      paymentDate: this.scope.parseDate(dto.payment_date),
      days: this.scope.daysBetweenInclusive(startDate, endDate),
      dailyRate: dto.daily_rate,
      additionalAmount: dto.additional_amount ?? '0.00',
      discountAmount: dto.discount_amount ?? '0.00',
      notes: this.scope.cleanText(dto.notes) ?? null,
      metadata: dto.metadata ?? null,
      updatedById: actor.id,
    });
    const saved = await this.repo.savePaymentWithAudit(payment, {
      organizationId: payment.organizationId,
      projectId,
      paymentId: payment.id,
      operation: PaymentExpenseAuditOperation.UPDATE_PAYMENT,
      performedBy: actor.id,
      changes,
    });
    return PaymentResponseDto.fromDomain(saved);
  }
  async approvePayment(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<PaymentResponseDto> {
    return this.paymentTransition(projectId, id, actor, 'approve');
  }
  async markPaymentPaid(
    projectId: number,
    id: number,
    dto: MarkAsPaidDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<PaymentResponseDto> {
    return this.paymentTransition(projectId, id, actor, 'paid', dto);
  }
  async cancelPayment(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<PaymentResponseDto> {
    return this.paymentTransition(projectId, id, actor, 'cancel');
  }
  async paymentSummary(
    projectId: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<PaymentSummaryResponseDto> {
    const all = await this.repo.listPayments({
      page: 1,
      pageSize: 100,
      organizationId: (await this.getProject(projectId, actor, false))
        .organizationId,
      projectId,
    });
    const sums = { pending: 0, approved: 0, paid: 0, cancelled: 0 };
    for (const item of all.items)
      sums[item.status] += Number(item.toProps().finalAmount);
    return {
      total_pending: sums.pending.toFixed(2),
      total_approved: sums.approved.toFixed(2),
      total_paid: sums.paid.toFixed(2),
      total_cancelled: sums.cancelled.toFixed(2),
      total_count: all.total,
    };
  }

  async createExpense(
    projectId: number,
    dto: ExpenseInputDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseResponseDto> {
    const project = await this.getProject(projectId, actor, true);
    if (dto.field_agent_id)
      await this.assertFieldAgent(
        project.organizationId,
        projectId,
        dto.field_agent_id,
      );
    const now = new Date();
    const expense = new Expense({
      id: 0,
      organizationId: project.organizationId,
      projectId,
      fieldAgentId: dto.field_agent_id ?? null,
      description: this.scope.cleanText(dto.description) ?? dto.description,
      reason: this.scope.cleanText(dto.reason) ?? null,
      expenseDate: this.requiredDate(dto.expense_date, 'expense_date'),
      amount: dto.amount,
      status: ExpenseStatus.PENDING,
      approvedById: null,
      approvedAt: null,
      rejectedById: null,
      rejectedAt: null,
      paidById: null,
      paidAt: null,
      createdById: actor.id,
      updatedById: actor.id,
      metadata: dto.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    const saved = await this.repo.saveExpenseWithAudit(expense, {
      organizationId: project.organizationId,
      projectId,
      operation: PaymentExpenseAuditOperation.CREATE_EXPENSE,
      performedBy: actor.id,
      changes: { status: { before: null, after: ExpenseStatus.PENDING } },
    });
    return ExpenseResponseDto.fromDomain(saved);
  }
  async listExpenses(
    projectId: number,
    query: ListExpensesQueryDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseListResponseDto> {
    const project = await this.getProject(projectId, actor, false);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repo.listExpenses({
      page,
      pageSize,
      organizationId: project.organizationId,
      projectId,
      fieldAgentId: query.field_agent_id,
      status: query.status,
      startDate: query.start_date,
      endDateExclusive: this.scope.nextDateString(query.end_date),
      search: query.search,
    });
    return {
      items: items.map((item) => ExpenseResponseDto.fromDomain(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
  async getExpense(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseResponseDto> {
    return ExpenseResponseDto.fromDomain(
      await this.findExpense(projectId, id, actor),
    );
  }
  async updateExpense(
    projectId: number,
    id: number,
    dto: ExpenseInputDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseResponseDto> {
    const expense = await this.findExpense(projectId, id, actor);
    await this.getProject(projectId, actor, true);
    if (dto.field_agent_id)
      await this.assertFieldAgent(
        expense.organizationId,
        projectId,
        dto.field_agent_id,
      );
    const changes = expense.updateFields({
      fieldAgentId: dto.field_agent_id ?? null,
      description: this.scope.cleanText(dto.description) ?? dto.description,
      reason: this.scope.cleanText(dto.reason) ?? null,
      expenseDate: this.requiredDate(dto.expense_date, 'expense_date'),
      amount: dto.amount,
      metadata: dto.metadata ?? null,
      updatedById: actor.id,
    });
    const saved = await this.repo.saveExpenseWithAudit(expense, {
      organizationId: expense.organizationId,
      projectId,
      expenseId: expense.id,
      operation: PaymentExpenseAuditOperation.UPDATE_EXPENSE,
      performedBy: actor.id,
      changes,
    });
    return ExpenseResponseDto.fromDomain(saved);
  }
  async approveExpense(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseResponseDto> {
    return this.expenseTransition(projectId, id, actor, 'approve');
  }
  async rejectExpense(
    projectId: number,
    id: number,
    dto: RejectExpenseDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseResponseDto> {
    return this.expenseTransition(projectId, id, actor, 'reject', dto.reason);
  }
  async markExpensePaid(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseResponseDto> {
    return this.expenseTransition(projectId, id, actor, 'paid');
  }
  async cancelExpense(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseResponseDto> {
    return this.expenseTransition(projectId, id, actor, 'cancel');
  }

  async createAttachmentUploadUrl(
    projectId: number,
    expenseId: number,
    dto: CreateExpenseAttachmentUploadDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<AttachmentUploadUrlResponseDto> {
    const expense = await this.findExpense(projectId, expenseId, actor);
    await this.getProject(projectId, actor, true);
    const now = new Date();
    const attachment = new ExpenseAttachment({
      id: 0,
      organizationId: expense.organizationId,
      expenseId,
      storageProvider: this.scope.storageProvider(),
      bucket: this.scope.storageBucket(),
      path: this.scope.buildExpenseAttachmentPath({
        organizationId: expense.organizationId,
        expenseId,
        storageKey: randomUUID(),
        originalName: dto.original_name,
      }),
      originalName: dto.original_name,
      mimeType: dto.mime_type.toLowerCase(),
      sizeBytes: dto.size_bytes,
      checksum: dto.checksum ?? null,
      status: ExpenseAttachmentStatus.PENDING_UPLOAD,
      uploadedById: actor.id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    const saved = await this.repo.saveAttachmentWithAudit(attachment, {
      organizationId: expense.organizationId,
      projectId,
      expenseId,
      operation: PaymentExpenseAuditOperation.CREATE_ATTACHMENT_UPLOAD_URL,
      performedBy: actor.id,
      changes: {
        status: { before: null, after: ExpenseAttachmentStatus.PENDING_UPLOAD },
      },
    });
    const signed = await this.storageSigner.createUploadUrl({
      bucket: saved.bucket,
      path: saved.path,
      mimeType: saved.mimeType,
      expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
    });
    return {
      attachment: ExpenseAttachmentResponseDto.fromDomain(saved),
      upload_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }
  async confirmAttachment(
    projectId: number,
    expenseId: number,
    attachmentId: number,
    dto: ConfirmExpenseAttachmentUploadDto,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseAttachmentResponseDto> {
    const attachment = await this.findAttachment(
      projectId,
      expenseId,
      attachmentId,
      actor,
    );
    const changes = attachment.confirmUpload({
      checksum: dto.checksum,
      sizeBytes: dto.size_bytes,
    });
    return ExpenseAttachmentResponseDto.fromDomain(
      await this.repo.saveAttachmentWithAudit(attachment, {
        organizationId: attachment.organizationId,
        projectId,
        expenseId,
        expenseAttachmentId: attachment.id,
        operation: PaymentExpenseAuditOperation.CONFIRM_ATTACHMENT_UPLOAD,
        performedBy: actor.id,
        changes,
      }),
    );
  }
  async listAttachments(
    projectId: number,
    expenseId: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseAttachmentResponseDto[]> {
    await this.findExpense(projectId, expenseId, actor);
    return (await this.repo.listAttachments(expenseId)).map((item) =>
      ExpenseAttachmentResponseDto.fromDomain(item),
    );
  }
  async downloadAttachment(
    projectId: number,
    expenseId: number,
    attachmentId: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<AttachmentDownloadUrlResponseDto> {
    const attachment = await this.findAttachment(
      projectId,
      expenseId,
      attachmentId,
      actor,
    );
    if (attachment.status !== ExpenseAttachmentStatus.UPLOADED)
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only uploaded attachments can be downloaded',
      });
    const signed = await this.storageSigner.createDownloadUrl({
      bucket: attachment.bucket,
      path: attachment.path,
      mimeType: attachment.mimeType,
      expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
    });
    await this.repo.audit({
      organizationId: attachment.organizationId,
      projectId,
      expenseId,
      expenseAttachmentId: attachment.id,
      operation: PaymentExpenseAuditOperation.DOWNLOAD_ATTACHMENT_URL,
      performedBy: actor.id,
      changes: { download_url_generated: { before: false, after: true } },
    });
    return {
      attachment: ExpenseAttachmentResponseDto.fromDomain(attachment),
      download_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }
  async removeAttachment(
    projectId: number,
    expenseId: number,
    attachmentId: number,
    actor: PaymentsExpensesActorContext,
  ): Promise<ExpenseAttachmentResponseDto> {
    const attachment = await this.findAttachment(
      projectId,
      expenseId,
      attachmentId,
      actor,
    );
    const changes = attachment.remove();
    return ExpenseAttachmentResponseDto.fromDomain(
      await this.repo.saveAttachmentWithAudit(attachment, {
        organizationId: attachment.organizationId,
        projectId,
        expenseId,
        expenseAttachmentId: attachment.id,
        operation: PaymentExpenseAuditOperation.REMOVE_ATTACHMENT,
        performedBy: actor.id,
        changes,
      }),
    );
  }

  private async paymentTransition(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
    action: 'approve' | 'paid' | 'cancel',
    dto?: MarkAsPaidDto,
  ) {
    const payment = await this.findPayment(projectId, id, actor);
    await this.getProject(projectId, actor, true);
    const changes =
      action === 'approve'
        ? payment.approve(actor.id, new Date())
        : action === 'paid'
          ? payment.markAsPaid(
              actor.id,
              new Date(),
              this.scope.parseDate(dto?.payment_date),
            )
          : payment.cancel(actor.id);
    const operation =
      action === 'approve'
        ? PaymentExpenseAuditOperation.APPROVE_PAYMENT
        : action === 'paid'
          ? PaymentExpenseAuditOperation.MARK_PAYMENT_AS_PAID
          : PaymentExpenseAuditOperation.CANCEL_PAYMENT;
    return PaymentResponseDto.fromDomain(
      await this.repo.savePaymentWithAudit(payment, {
        organizationId: payment.organizationId,
        projectId,
        paymentId: payment.id,
        operation,
        performedBy: actor.id,
        changes,
      }),
    );
  }
  private async expenseTransition(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
    action: 'approve' | 'reject' | 'paid' | 'cancel',
    reason?: string,
  ) {
    const expense = await this.findExpense(projectId, id, actor);
    await this.getProject(projectId, actor, true);
    const changes =
      action === 'approve'
        ? expense.approve(actor.id, new Date())
        : action === 'reject'
          ? expense.reject(actor.id, new Date(), reason ?? '')
          : action === 'paid'
            ? expense.markAsPaid(actor.id, new Date())
            : expense.cancel(actor.id);
    const operation =
      action === 'approve'
        ? PaymentExpenseAuditOperation.APPROVE_EXPENSE
        : action === 'reject'
          ? PaymentExpenseAuditOperation.REJECT_EXPENSE
          : action === 'paid'
            ? PaymentExpenseAuditOperation.MARK_EXPENSE_AS_PAID
            : PaymentExpenseAuditOperation.CANCEL_EXPENSE;
    return ExpenseResponseDto.fromDomain(
      await this.repo.saveExpenseWithAudit(expense, {
        organizationId: expense.organizationId,
        projectId,
        expenseId: expense.id,
        operation,
        performedBy: actor.id,
        changes,
      }),
    );
  }
  private async getProject(
    projectId: number,
    actor: PaymentsExpensesActorContext,
    mutation: boolean,
  ) {
    const project = await this.projects.findById(projectId);
    if (!project)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    if (mutation) this.scope.assertProjectAllowsMutation(project);
    return project;
  }
  private async assertFieldAgent(
    organizationId: number,
    projectId: number,
    fieldAgentId: number,
  ): Promise<void> {
    const agent = await this.fieldAgents.findById(fieldAgentId);
    if (!agent || agent.organizationId !== organizationId)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid field_agent_id',
      });
    if (
      !(await this.fieldAgents.hasActiveAssignment(
        organizationId,
        projectId,
        fieldAgentId,
      ))
    )
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'field_agent is not assigned to project',
      });
  }
  private async findPayment(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ) {
    const payment = await this.repo.findPaymentById(id);
    if (!payment || payment.projectId !== projectId)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payment not found',
      });
    this.scope.assertCanAccessOrganization(actor, payment.organizationId);
    return payment;
  }
  private async findExpense(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ) {
    const expense = await this.repo.findExpenseById(id);
    if (!expense || expense.projectId !== projectId)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Expense not found',
      });
    this.scope.assertCanAccessOrganization(actor, expense.organizationId);
    return expense;
  }
  private async findAttachment(
    projectId: number,
    expenseId: number,
    attachmentId: number,
    actor: PaymentsExpensesActorContext,
  ) {
    const expense = await this.findExpense(projectId, expenseId, actor);
    const attachment = await this.repo.findAttachmentById(attachmentId);
    if (!attachment || attachment.expenseId !== expense.id)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Attachment not found',
      });
    return attachment;
  }
  private requiredDate(value: string, field: string): Date {
    const date = this.scope.parseDate(value);
    if (!date)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} must be a real date`,
      });
    return date;
  }
}
