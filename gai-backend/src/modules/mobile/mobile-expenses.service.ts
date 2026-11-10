import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../auth/presentation/guards/session-auth.guard';
import {
  ConfirmExpenseAttachmentUploadDto,
  CreateExpenseAttachmentUploadDto,
  ExpenseInputDto,
} from '../payments-expenses/application/dto/payments-expenses-inputs';
import { ListExpensesQueryDto } from '../payments-expenses/application/dto/payments-expenses-query.dto';
import { PaymentsExpensesService } from '../payments-expenses/application/services/payments-expenses.service';
import { ExpenseAttachmentStatus } from '../payments-expenses/domain/enums/expense-attachment-status.enum';
import { MobileExpenseCreateDto } from './dto/mobile-operations.dto';
import { MobileAccessService } from './mobile-access.service';
import { MobileIdempotencyKeyEntity } from './mobile-idempotency-key.entity';

/**
 * Field expenses (legacy "Financeiro") over the shared expense module: same
 * validation and status workflow, field agent taken from the session (Onda 0),
 * financial permissions granted explicitly (never by the field profile) and
 * idempotent creation through a client key.
 */
@Injectable()
export class MobileExpensesService {
  constructor(
    private readonly db: DataSource,
    private readonly access: MobileAccessService,
    private readonly expenses: PaymentsExpensesService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    projectId: number,
    dto: MobileExpenseCreateDto,
  ) {
    const access = await this.access.assertProject(actor, projectId, true);
    const { client_expense_id: key, ...body } = dto;
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ projectId, ...body }))
      .digest('hex');
    const keys = this.db.getRepository(MobileIdempotencyKeyEntity);
    let claim: MobileIdempotencyKeyEntity;
    try {
      claim = await keys.save({
        organizationId: access.organizationId,
        userId: actor.id,
        scope: 'expense',
        idempotencyKey: key,
        requestHash,
        resourceId: null,
      });
    } catch {
      const existing = await keys.findOneBy({
        organizationId: access.organizationId,
        scope: 'expense',
        idempotencyKey: key,
      });
      if (!existing)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Tente novamente.',
        });
      if (existing.userId !== actor.id || existing.requestHash !== requestHash)
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'client_expense_id já usado com outros dados.',
        });
      if (!existing.resourceId)
        throw new ConflictException({
          code: 'REQUEST_IN_PROGRESS',
          message: 'A mesma despesa ainda está sendo registrada.',
        });
      return {
        result: 'existing' as const,
        expense: await this.expenses.getExpense(
          projectId,
          Number(existing.resourceId),
          this.ctx(actor),
        ),
      };
    }
    try {
      const expense = await this.expenses.createExpense(
        projectId,
        Object.assign(new ExpenseInputDto(), body),
        this.ctx(actor),
      );
      await keys.update({ id: claim.id }, { resourceId: expense.id });
      return { result: 'created' as const, expense };
    } catch (error) {
      await keys.delete({ id: claim.id });
      throw error;
    }
  }

  async list(
    actor: AuthenticatedUser,
    projectId: number,
    page = 1,
    pageSize = 50,
  ) {
    const access = await this.access.assertProject(actor, projectId, false);
    return this.expenses.listExpenses(
      projectId,
      Object.assign(new ListExpensesQueryDto(), {
        page,
        page_size: pageSize,
        field_agent_id: access.agent.id,
      }),
      this.ctx(actor),
    );
  }

  async requestAttachment(
    actor: AuthenticatedUser,
    projectId: number,
    expenseId: number,
    dto: CreateExpenseAttachmentUploadDto,
  ) {
    await this.own(actor, projectId, expenseId, true);
    const result = await this.expenses.createAttachmentUploadUrl(
      projectId,
      expenseId,
      dto,
      this.ctx(actor),
    );
    return {
      ...result,
      upload_headers: {
        'Content-Type': dto.mime_type,
        'Content-Length': String(dto.size_bytes),
      },
    };
  }

  async confirmAttachment(
    actor: AuthenticatedUser,
    projectId: number,
    expenseId: number,
    attachmentId: number,
    dto: ConfirmExpenseAttachmentUploadDto,
  ) {
    await this.own(actor, projectId, expenseId, true);
    const current = (
      await this.expenses.listAttachments(projectId, expenseId, this.ctx(actor))
    ).find((attachment) => attachment.id === attachmentId);
    if (current?.status === ExpenseAttachmentStatus.UPLOADED)
      return { result: 'already_confirmed' as const, attachment: current };
    return {
      result: 'confirmed' as const,
      attachment: await this.expenses.confirmAttachment(
        projectId,
        expenseId,
        attachmentId,
        dto,
        this.ctx(actor),
      ),
    };
  }

  /** The app only touches expenses of its own field agent. */
  private async own(
    actor: AuthenticatedUser,
    projectId: number,
    expenseId: number,
    mutate: boolean,
  ) {
    const access = await this.access.assertProject(actor, projectId, mutate);
    const expense = await this.expenses.getExpense(
      projectId,
      expenseId,
      this.ctx(actor),
    );
    if (expense.field_agent_id !== access.agent.id)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Despesa não encontrada.',
      });
    return expense;
  }

  private ctx(actor: AuthenticatedUser) {
    return {
      id: actor.id,
      systemRoles: actor.systemRoles,
      organizationId: actor.organizationId,
    };
  }
}
