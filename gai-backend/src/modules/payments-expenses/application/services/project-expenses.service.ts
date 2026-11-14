import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { assertNotFuture } from '../../../../common/finance/settlement-date';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { ContractEntity } from '../../../contracts/contract.entity';
import { ExpenseInstallmentEntity } from '../../../expense-accountabilities/expense-accountability.entity';
import { ProjectFieldAgentStatus } from '../../../field-agents/domain/enums/project-field-agent-status.enum';
import { FieldAgentEntity } from '../../../field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../../field-agents/infrastructure/persistence/project-field-agent.entity';
import { FinanceSettingsService } from '../../../finance-settings/finance-settings.service';
import { civilToday } from '../../../finance-settings/finance-settings.policy';
import { ProjectStatusTransitionPolicy } from '../../../projects/domain/services/project-status-transition.policy';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import type { Expense } from '../../domain/entities/expense';
import { ExpenseAttachmentStatus } from '../../domain/enums/expense-attachment-status.enum';
import { PaymentExpenseAuditOperation } from '../../domain/enums/payment-expense-audit-operation.enum';
import {
  BILLED_BATCH,
  COUNTED_EXPENSE,
  contractShare,
  defaultExpenseType,
  type ExpenseType,
  isToReimburse,
  lineBalance,
  agentBalance,
} from '../../domain/expense.formulas';
import {
  PAYMENTS_EXPENSES_REPOSITORY,
  type PaymentsExpensesRepository,
} from '../../domain/ports/payments-expenses.repository.port';
import {
  fromCents,
  percentOf,
  toCents,
} from '../../domain/remuneration.formulas';
import { ExpenseAttachmentEntity } from '../../infrastructure/persistence/expense-attachment.entity';
import {
  ExpenseAdvanceEntity,
  ExpenseReimbursementBatchEntity,
  ProjectFinancialClosureEntity,
  ReimbursementBatchStatus,
} from '../../infrastructure/persistence/expense-parity.entities';
import { ExpenseEntity } from '../../infrastructure/persistence/expense.entity';
import { PaymentExpenseAuditLogEntity } from '../../infrastructure/persistence/payment-expense-audit-log.entity';
import { ExpenseRulesService } from './expense-rules.service';
import type { PaymentsExpensesActorContext } from './payments-expenses-scope.service';
import { money, OPEN_PROJECT, PROJECT_STATUS } from './remuneration.service';

export interface ExpenseBoardFilters {
  expense_type?: 'reimbursable' | 'non_reimbursable' | 'unclassified';
  /** Prestação de contas: "billed" = em lote faturado; "pending" = ainda não. */
  billing?: 'billed' | 'pending';
  status?: string;
  start_date?: string;
  end_date?: string;
  /** Id do técnico ou "none" (despesas gerais, sem técnico). */
  field_agent_id?: string;
  search?: string;
  batch_id?: number;
}

const ROW_LIMIT = 5000;
const PROJECT_LIMIT = 2000;
const BATCH_LIMIT = 500;
export const EXPENSE_TYPE_LABEL: Record<string, string> = {
  reimbursable: 'Reembolsável',
  non_reimbursable: 'Não reembolsável',
};
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'À vista',
  installments: 'A prazo',
  invoiced: 'Faturado',
};
export const BATCH_STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  billed: 'Faturado',
  received: 'Recebido',
  cancelled: 'Cancelado',
};
const civil = (value: Date | string | null | undefined) =>
  value == null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
const sum = (values: string[]) =>
  fromCents(values.reduce((s, v) => s + toCents(v), 0n));
const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

type BatchTransition = {
  operation: string;
  changes: Record<string, { before: unknown; after: unknown }>;
};

/** Uma linha da lista de despesas do projeto (Tela B). */
export interface ExpenseBoardItem {
  id: number;
  sequence: number | null;
  expense_type: string | null;
  expense_type_label: string;
  contract_type_label: string;
  reason_code: string | null;
  description: string;
  legacy_reason: string | null;
  expense_date: string;
  field_agent_id: number | null;
  field_agent_name: string;
  payment_method: string | null;
  payment_method_label: string;
  installments: Array<{ number: number; due_date: string; amount: string }>;
  invoiced_payment_date: string | null;
  attachments: number;
  amount: string;
  deposited_amount: string | null;
  balance: string | null;
  status: string;
  rejection_reason: string | null;
  batch: {
    id: number;
    number: number;
    status: string;
    batch_date: string;
  } | null;
  to_reimburse: boolean;
  reopened_at: string | null;
  updated_at: string;
}

/**
 * Despesas do projeto na paridade com o INVESTOR (doc 06 §3, etapa 4):
 * lista de projetos, acompanhamento do projeto, tipo e exclusão em lote,
 * lotes de reembolso ao cliente (D-B), adiantamentos e conclusão do financeiro.
 * Criar, editar, aprovar e pagar continuam no PaymentsExpensesService.
 */
@Injectable()
export class ProjectExpensesService {
  constructor(
    private readonly ds: DataSource,
    private readonly settings: FinanceSettingsService,
    private readonly rules: ExpenseRulesService,
    @Inject(PAYMENTS_EXPENSES_REPOSITORY)
    private readonly repo: PaymentsExpensesRepository,
  ) {}

  organization(actor: PaymentsExpensesActorContext): number {
    if (
      actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
      !actor.organizationId
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Selecione uma organização para consultar as despesas.',
      });
    return actor.organizationId;
  }

  async project(
    projectId: number,
    actor: PaymentsExpensesActorContext,
    mutation = false,
  ) {
    const organizationId = this.organization(actor);
    const project = await this.ds
      .getRepository(ProjectEntity)
      .findOneBy({ id: projectId, organizationId });
    if (!project)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Projeto não encontrado.',
      });
    if (
      mutation &&
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
    )
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'O status do projeto bloqueia esta operação.',
      });
    return { ...project, id: Number(project.id), organizationId };
  }

  /** Lista de projetos (Tela A, doc 06 §3.1) com a regra única de "A reembolsar". */
  async projects(
    filters: { search?: string; only_open?: boolean; year?: number },
    actor: PaymentsExpensesActorContext,
  ) {
    const organizationId = this.organization(actor);
    const projects = await this.ds.getRepository(ProjectEntity).find({
      where: { organizationId },
      take: PROJECT_LIMIT + 1,
    });
    if (projects.length > PROJECT_LIMIT)
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `Mais de ${PROJECT_LIMIT} projetos; use os filtros.`,
      });
    const ids = projects.map((p) => Number(p.id));
    const where = { organizationId, projectId: In(ids.length ? ids : [0]) };
    const [contracts, expenses, batches, closures] = await Promise.all([
      this.ds.getRepository(ContractEntity).find({ where }),
      this.ds.getRepository(ExpenseEntity).find({ where }),
      this.ds.getRepository(ExpenseReimbursementBatchEntity).find({ where }),
      this.ds
        .getRepository(ProjectFinancialClosureEntity)
        .find({ where: { ...where, reopenedAt: IsNull() } }),
    ]);
    const batchStatus = new Map(batches.map((b) => [Number(b.id), b.status]));
    const closed = new Set(closures.map((c) => Number(c.projectId)));
    const group = <T extends { projectId: number }>(rows: T[]) => {
      const map = new Map<number, T[]>();
      for (const row of rows)
        map.set(Number(row.projectId), [
          ...(map.get(Number(row.projectId)) ?? []),
          row,
        ]);
      return map;
    };
    const contractsBy = group(contracts);
    const expensesBy = group(expenses);
    const search = filters.search ? fold(filters.search.trim()) : '';
    const rows = projects.map((project) => {
      const id = Number(project.id);
      const live = (contractsBy.get(id) ?? []).filter(
        (c) => !['cancelled', 'archived'].includes(c.data.status),
      );
      const contractValue = sum(
        live.map((c) => money(c.data.current_value ?? c.data.original_value)),
      );
      const counted = (expensesBy.get(id) ?? []).filter(
        (e) => COUNTED_EXPENSE(e.status) && !e.deletedAt,
      );
      const of = (type: string) =>
        sum(
          counted
            .filter((e) => e.expenseType === type)
            .map((e) => money(e.amount)),
        );
      const reimbursable = of('reimbursable');
      const nonReimbursable = of('non_reimbursable');
      const toReimburse = sum(
        counted
          .filter((e) =>
            isToReimburse({
              expenseType: e.expenseType,
              status: e.status,
              batchStatus: e.reimbursementBatchId
                ? (batchStatus.get(Number(e.reimbursementBatchId)) ?? null)
                : null,
            }),
          )
          .map((e) => money(e.amount)),
      );
      const pct = contractShare(reimbursable, nonReimbursable, contractValue);
      const status = PROJECT_STATUS[project.status] ?? {
        label: project.status,
        rank: 4,
      };
      return {
        id,
        name: project.name,
        status: project.status,
        status_label: status.label,
        rank: status.rank,
        contract_value: contractValue,
        to_reimburse: toReimburse,
        reimbursable,
        non_reimbursable: nonReimbursable,
        unclassified_count: counted.filter((e) => !e.expenseType).length,
        expenses_count: counted.length,
        contract_pct: pct,
        contract_pct_alert: pct !== null && toCents(pct) > toCents('100.00'),
        finance_closed: closed.has(id),
        scope: [...new Set(live.flatMap((c) => c.data.services ?? []))].sort(),
        segment: live.map((c) => c.data.segment).find(Boolean) ?? null,
        state: live.map((c) => c.data.company_state).find(Boolean) ?? null,
        contracted_on:
          live
            .map((c) => c.data.contracted_on)
            .filter((d): d is string => Boolean(d))
            .sort()
            .pop() ?? null,
        finished_at: civil(project.finishedAt),
      };
    });
    const visible = rows
      .filter((r) => !filters.only_open || OPEN_PROJECT.includes(r.status))
      .filter(
        (r) =>
          !filters.year || r.contracted_on?.startsWith(String(filters.year)),
      )
      .filter(
        (r) =>
          !search ||
          [r.name, r.segment, r.state]
            .filter(Boolean)
            .some((v) => fold(String(v)).includes(search)),
      )
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          (a.rank === 3
            ? (b.finished_at ?? '').localeCompare(a.finished_at ?? '')
            : (b.contracted_on ?? '').localeCompare(a.contracted_on ?? '')) ||
          a.name.localeCompare(b.name, 'pt-BR'),
      );
    return {
      items: visible.map(({ rank: _rank, ...row }) => row),
      // Selo: total "A reembolsar" de todos os projetos (não só dos filtrados).
      total_to_reimburse: sum(rows.map((r) => r.to_reimburse)),
      subtotal_to_reimburse: sum(visible.map((r) => r.to_reimburse)),
    };
  }

  /** Acompanhamento do projeto (Tela B, doc 06 §3.2). Lotes e adiantamentos têm rotas e permissões próprias. */
  async board(
    projectId: number,
    filters: ExpenseBoardFilters,
    actor: PaymentsExpensesActorContext,
  ) {
    const {
      batches: _batches,
      advances: _advances,
      ...board
    } = await this.details(projectId, filters, actor);
    return board;
  }

  /** Lotes de reembolso do projeto (reimbursement-batches:read). */
  async batches(projectId: number, actor: PaymentsExpensesActorContext) {
    return (await this.details(projectId, {}, actor)).batches;
  }

  /** Adiantamentos do projeto (expense-advances:read). */
  async advances(projectId: number, actor: PaymentsExpensesActorContext) {
    return (await this.details(projectId, {}, actor)).advances;
  }

  private async details(
    projectId: number,
    filters: ExpenseBoardFilters,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor);
    const organizationId = project.organizationId;
    const where = { organizationId, projectId };
    const [
      expenses,
      contracts,
      links,
      advances,
      batches,
      closure,
      attachments,
      installments,
    ] = await Promise.all([
      this.ds.getRepository(ExpenseEntity).find({ where, take: ROW_LIMIT + 1 }),
      this.ds.getRepository(ContractEntity).find({ where }),
      this.ds.getRepository(ProjectFieldAgentEntity).find({ where }),
      this.ds.getRepository(ExpenseAdvanceEntity).find({ where }),
      this.ds
        .getRepository(ExpenseReimbursementBatchEntity)
        .find({ where, order: { number: 'ASC' } }),
      this.rules.closure(projectId),
      this.ds
        .getRepository(ExpenseAttachmentEntity)
        .createQueryBuilder('a')
        .innerJoin(ExpenseEntity, 'e', 'e.id = a.expense_id')
        .select('a.expense_id', 'expense_id')
        .addSelect('COUNT(*)', 'n')
        .where('e.project_id = :projectId', { projectId })
        .andWhere('a.status = :uploaded', {
          uploaded: ExpenseAttachmentStatus.UPLOADED,
        })
        .andWhere('a.deleted_at IS NULL')
        .groupBy('a.expense_id')
        .getRawMany<{ expense_id: number | string; n: number | string }>(),
      this.ds
        .getRepository(ExpenseInstallmentEntity)
        .find({ where, order: { installmentNumber: 'ASC' } }),
    ]);
    if (expenses.length > ROW_LIMIT)
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `Mais de ${ROW_LIMIT} despesas no projeto.`,
      });
    const live = expenses.filter((e) => !e.deletedAt);
    const agentIds = [
      ...new Set([
        ...links.map((l) => Number(l.fieldAgentId)),
        ...live
          .filter((e) => e.fieldAgentId)
          .map((e) => Number(e.fieldAgentId)),
        ...advances.map((a) => Number(a.fieldAgentId)),
      ]),
    ];
    const agents = agentIds.length
      ? await this.ds.getRepository(FieldAgentEntity).find({
          where: { organizationId, id: In(agentIds) },
          withDeleted: true,
        })
      : [];
    const agentName = new Map(agents.map((a) => [Number(a.id), a.name]));
    const nameOf = (id: number | null) =>
      id ? (agentName.get(id) ?? `#${id}`) : 'Despesas gerais';
    const batchById = new Map(batches.map((b) => [Number(b.id), b]));
    const attachmentCount = new Map(
      attachments.map((a) => [Number(a.expense_id), Number(a.n)]),
    );
    const installmentsBy = new Map<number, ExpenseInstallmentEntity[]>();
    for (const i of installments)
      installmentsBy.set(Number(i.expenseId), [
        ...(installmentsBy.get(Number(i.expenseId)) ?? []),
        i,
      ]);
    const liveContracts = contracts.filter(
      (c) => !['cancelled', 'archived'].includes(c.data.status),
    );
    const payers = new Set(
      liveContracts.map((c) => c.data.expenses_paid_by).filter(Boolean),
    );
    const contractType = defaultExpenseType([...payers]);
    const contractTypeLabel = contractType
      ? EXPENSE_TYPE_LABEL[contractType]
      : payers.size > 1
        ? 'Misto'
        : 'Não informado';

    const items: ExpenseBoardItem[] = live
      .map((e) => {
        const batch = e.reimbursementBatchId
          ? batchById.get(Number(e.reimbursementBatchId))
          : undefined;
        const amount = money(e.amount);
        const deposited =
          e.depositedAmount == null ? null : money(e.depositedAmount);
        const agentId = e.fieldAgentId ? Number(e.fieldAgentId) : null;
        return {
          id: Number(e.id),
          sequence:
            e.projectSequence == null ? null : Number(e.projectSequence),
          expense_type: e.expenseType,
          expense_type_label: e.expenseType
            ? EXPENSE_TYPE_LABEL[e.expenseType]
            : 'Não classificada',
          contract_type_label: contractTypeLabel,
          reason_code: e.reasonCode,
          description: e.description,
          legacy_reason: e.reason,
          expense_date: civil(e.expenseDate)!,
          field_agent_id: agentId,
          field_agent_name: nameOf(agentId),
          payment_method: e.paymentMethod,
          payment_method_label: e.paymentMethod
            ? PAYMENT_METHOD_LABEL[e.paymentMethod]
            : '—',
          installments: (installmentsBy.get(Number(e.id)) ?? []).map((i) => ({
            number: Number(i.installmentNumber),
            due_date: civil(i.dueDate)!,
            amount: money(i.amount),
          })),
          invoiced_payment_date: civil(e.invoicedPaymentDate),
          attachments: attachmentCount.get(Number(e.id)) ?? 0,
          amount,
          deposited_amount: deposited,
          balance: lineBalance(deposited, amount),
          status: e.status,
          rejection_reason: e.rejectionReason,
          batch: batch
            ? {
                id: Number(batch.id),
                number: Number(batch.number),
                status: batch.status,
                batch_date: civil(batch.batchDate)!,
              }
            : null,
          to_reimburse: isToReimburse({
            expenseType: e.expenseType,
            status: e.status,
            batchStatus: batch?.status ?? null,
          }),
          reopened_at: e.reopenedAt
            ? new Date(e.reopenedAt).toISOString()
            : null,
          updated_at: new Date(e.updatedAt).toISOString(),
        };
      })
      .sort(
        (a, b) =>
          b.expense_date.localeCompare(a.expense_date) ||
          (b.sequence ?? 0) - (a.sequence ?? 0),
      );

    const counted = items.filter((i) => COUNTED_EXPENSE(i.status));
    const total = sum(counted.map((i) => i.amount));
    const ofType = (type: string | null) =>
      counted.filter((i) => i.expense_type === type);
    const reimbursable = sum(ofType('reimbursable').map((i) => i.amount));
    const nonReimbursable = sum(
      ofType('non_reimbursable').map((i) => i.amount),
    );
    const unclassified = ofType(null);
    const contractValue = sum(
      liveContracts.map((c) =>
        money(c.data.current_value ?? c.data.original_value),
      ),
    );

    // Resumo por inventariante: todos os vinculados, mesmo sem lançamento.
    const liveAdvances = advances.filter((a) => !a.deletedAt);
    const summaryIds = [
      ...new Set([
        ...links
          .filter(
            (l) =>
              l.status === ProjectFieldAgentStatus.ACTIVE ||
              l.status === ProjectFieldAgentStatus.FINISHED,
          )
          .map((l) => Number(l.fieldAgentId))
          .filter((id) => {
            const agent = agents.find((a) => Number(a.id) === id);
            return agent && !agent.deletedAt;
          }),
        ...counted.map((i) => i.field_agent_id),
        ...liveAdvances.map((a) => Number(a.fieldAgentId)),
      ]),
    ];
    const summary = summaryIds
      .map((id) => {
        const own = counted.filter((i) => i.field_agent_id === id);
        const adv = liveAdvances
          .filter((a) => Number(a.fieldAgentId) === id)
          .map((a) => money(a.amount));
        const spent = own.map((i) => i.amount);
        return {
          field_agent_id: id,
          name: nameOf(id),
          entries: own.length,
          advances: sum(adv),
          advances_count: adv.length,
          expenses: sum(spent),
          // Despesas gerais não recebem adiantamento: não há saldo a mostrar.
          balance: id === null ? null : agentBalance(adv, spent),
        };
      })
      .sort((a, b) =>
        a.field_agent_id === null
          ? 1
          : b.field_agent_id === null
            ? -1
            : a.name.localeCompare(b.name, 'pt-BR'),
      );

    const filtered = this.filter(items, filters);
    const closedBy = closure?.closedById
      ? await this.ds.getRepository(UserEntity).findOne({
          where: { id: closure.closedById },
          select: { id: true, fullName: true },
        })
      : null;
    const parameters = await this.parameters(organizationId);
    return {
      project: { id: projectId, name: project.name, status: project.status },
      today: civilToday(),
      closure: closure
        ? {
            closed_at: new Date(closure.closedAt).toISOString(),
            closed_by: closedBy?.fullName ?? null,
            reason: closure.closeReason,
          }
        : null,
      parameters,
      default_expense_type: contractType,
      contract_type_label: contractTypeLabel,
      kpis: {
        total,
        count: counted.length,
        reimbursable,
        reimbursable_pct: percentOf(reimbursable, total),
        non_reimbursable: nonReimbursable,
        non_reimbursable_pct: percentOf(nonReimbursable, total),
        unclassified: sum(unclassified.map((i) => i.amount)),
        unclassified_count: unclassified.length,
        to_reimburse: sum(
          counted.filter((i) => i.to_reimburse).map((i) => i.amount),
        ),
        contract_value: contractValue,
        contract_pct: contractShare(
          reimbursable,
          nonReimbursable,
          contractValue,
        ),
      },
      summary,
      agents: summaryIds
        .filter((id): id is number => id !== null)
        .map((id) => ({
          id,
          name: nameOf(id),
          linked: links.some(
            (l) =>
              Number(l.fieldAgentId) === id &&
              l.status === ProjectFieldAgentStatus.ACTIVE,
          ),
        })),
      batches: batches.map((b) => {
        const inBatch = counted.filter((i) => i.batch?.id === Number(b.id));
        return {
          id: Number(b.id),
          number: Number(b.number),
          batch_date: civil(b.batchDate)!,
          expected_receipt_on: civil(b.expectedReceiptOn),
          status: b.status,
          status_label: BATCH_STATUS_LABEL[b.status] ?? b.status,
          receivable_id: b.receivableId ? Number(b.receivableId) : null,
          notes: b.notes,
          count: inBatch.length,
          amount: sum(inBatch.map((i) => i.amount)),
          billed_at: b.billedAt ? new Date(b.billedAt).toISOString() : null,
        };
      }),
      advances: liveAdvances
        .map((a) => ({
          id: Number(a.id),
          field_agent_id: Number(a.fieldAgentId),
          field_agent_name: nameOf(Number(a.fieldAgentId)),
          advanced_on: civil(a.advancedOn)!,
          amount: money(a.amount),
          notes: a.notes,
          deposited_by_name: a.depositedByName,
        }))
        .sort((a, b) => b.advanced_on.localeCompare(a.advanced_on)),
      items: filtered,
      totals: {
        count: filtered.length,
        amount: sum(
          filtered
            .filter((i) => COUNTED_EXPENSE(i.status))
            .map((i) => i.amount),
        ),
        // Rodapé "sem reembolso do cliente": o que a empresa absorve.
        non_reimbursable_amount: sum(
          filtered
            .filter(
              (i) =>
                COUNTED_EXPENSE(i.status) &&
                i.expense_type === 'non_reimbursable',
            )
            .map((i) => i.amount),
        ),
      },
    };
  }

  filter(items: ExpenseBoardItem[], f: ExpenseBoardFilters) {
    const term = f.search ? fold(f.search.trim()) : '';
    return items.filter((i) => {
      if (f.expense_type === 'unclassified' && i.expense_type) return false;
      if (
        f.expense_type &&
        f.expense_type !== 'unclassified' &&
        i.expense_type !== f.expense_type
      )
        return false;
      const billed = BILLED_BATCH(i.batch?.status);
      if (f.billing === 'billed' && !billed) return false;
      if (f.billing === 'pending' && billed) return false;
      if (f.status && i.status !== f.status) return false;
      if (f.start_date && i.expense_date < f.start_date) return false;
      if (f.end_date && i.expense_date > f.end_date) return false;
      if (f.batch_id && i.batch?.id !== f.batch_id) return false;
      if (f.field_agent_id === 'none' && i.field_agent_id !== null)
        return false;
      if (
        f.field_agent_id &&
        f.field_agent_id !== 'none' &&
        i.field_agent_id !== Number(f.field_agent_id)
      )
        return false;
      if (term) {
        const hay = [
          i.reason_code,
          i.description,
          i.legacy_reason,
          i.field_agent_name,
          i.expense_date.split('-').reverse().join('/'),
          i.sequence === null ? null : String(i.sequence),
        ]
          .filter(Boolean)
          .map((v) => fold(String(v)));
        if (!hay.some((v) => v.includes(term))) return false;
      }
      return true;
    });
  }

  private async parameters(organizationId: number) {
    try {
      const v = await this.settings.valuesAt(organizationId);
      return {
        configured: true,
        reasons: v.expense_reasons,
        attachment_max_bytes: v.expense_attachment_max_bytes,
        attachment_max_files: v.expense_attachment_max_files,
      };
    } catch {
      return {
        configured: false,
        reasons: null,
        attachment_max_bytes: null,
        attachment_max_files: null,
      };
    }
  }

  // ───────────── lote: tipo e exclusão ─────────────

  /** Alterna o tipo de despesa (com confirmação na tela), item a item. */
  async changeType(
    projectId: number,
    ids: number[],
    type: ExpenseType,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    return this.each(ids, async (id) => {
      const expense = await this.expense(project.organizationId, projectId, id);
      await this.rules.assertNotBilled(expense.reimbursementBatchId);
      await this.rules.assertDreOpen(project.organizationId, id);
      const changes = this.rule(() => expense.changeType(actor.id, type));
      if (!Object.keys(changes).length) return;
      // Reembolsável que vira não reembolsável sai do lote aberto.
      if (type !== 'reimbursable' && expense.reimbursementBatchId)
        Object.assign(changes, expense.setBatch(actor.id, null));
      await this.repo.saveExpenseWithAudit(expense, {
        organizationId: project.organizationId,
        projectId,
        expenseId: id,
        operation: PaymentExpenseAuditOperation.CHANGE_EXPENSE_TYPE,
        performedBy: actor.id,
        changes,
      });
    });
  }

  /** Exclusão lógica em lote (paga, em lote faturado ou em DRE fechada: recusada). */
  async remove(
    projectId: number,
    ids: number[],
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    return this.each(ids, async (id) => {
      const expense = await this.expense(project.organizationId, projectId, id);
      await this.rules.assertNotBilled(expense.reimbursementBatchId);
      await this.rules.assertDreOpen(project.organizationId, id);
      const changes = this.rule(() => {
        const out = expense.remove(actor.id, new Date());
        if (expense.reimbursementBatchId)
          Object.assign(out, expense.setBatch(actor.id, null));
        return out;
      });
      await this.repo.saveExpenseWithAudit(expense, {
        organizationId: project.organizationId,
        projectId,
        expenseId: id,
        operation: PaymentExpenseAuditOperation.DELETE_EXPENSE,
        performedBy: actor.id,
        changes,
      });
    });
  }

  // ───────────── lotes de reembolso (D-B) ─────────────

  /** "Prestar conta": cria um lote com as despesas escolhidas ou inclui num lote aberto. */
  async addToBatch(
    projectId: number,
    dto: {
      ids: number[];
      batch_id?: number;
      batch_date?: string;
      expected_receipt_on?: string | null;
      notes?: string | null;
    },
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    let batch: ExpenseReimbursementBatchEntity;
    if (dto.batch_id) {
      batch = await this.batch(project.organizationId, projectId, dto.batch_id);
      if (batch.status !== ReimbursementBatchStatus.OPEN)
        throw new ConflictException({
          code: 'REIMBURSEMENT_BATCH_NOT_OPEN',
          message: `O lote ${batch.number} não está aberto.`,
        });
    } else
      batch = await this.createBatch(
        project.organizationId,
        projectId,
        dto,
        actor,
      );
    const result = await this.each(dto.ids, async (id) => {
      const expense = await this.expense(project.organizationId, projectId, id);
      if (expense.expenseType !== 'reimbursable')
        throw new ConflictException({
          code: 'NOT_REIMBURSABLE',
          message: 'Só despesas reembolsáveis entram no lote de reembolso.',
        });
      if (!COUNTED_EXPENSE(expense.status))
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Despesa rejeitada ou cancelada não entra no lote.',
        });
      if (
        expense.reimbursementBatchId &&
        expense.reimbursementBatchId !== Number(batch.id)
      ) {
        const other = await this.ds
          .getRepository(ExpenseReimbursementBatchEntity)
          .findOneBy({ id: expense.reimbursementBatchId });
        if (other && other.status !== ReimbursementBatchStatus.CANCELLED)
          throw new ConflictException({
            code: 'IN_ANOTHER_BATCH',
            message: `A despesa já está no lote ${other.number}.`,
          });
      }
      const changes = expense.setBatch(actor.id, Number(batch.id));
      if (!Object.keys(changes).length) return;
      await this.repo.saveExpenseWithAudit(expense, {
        organizationId: project.organizationId,
        projectId,
        expenseId: id,
        operation: PaymentExpenseAuditOperation.ADD_TO_REIMBURSEMENT_BATCH,
        performedBy: actor.id,
        changes: {
          ...changes,
          batch_number: { before: null, after: batch.number },
        },
      });
    });
    return {
      batch_id: Number(batch.id),
      batch_number: Number(batch.number),
      ...result,
    };
  }

  async removeFromBatch(
    projectId: number,
    batchId: number,
    ids: number[],
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    const batch = await this.batch(project.organizationId, projectId, batchId);
    if (batch.status !== ReimbursementBatchStatus.OPEN)
      throw new ConflictException({
        code: 'REIMBURSEMENT_BATCH_NOT_OPEN',
        message: `O lote ${batch.number} não está aberto.`,
      });
    return this.each(ids, async (id) => {
      const expense = await this.expense(project.organizationId, projectId, id);
      if (expense.reimbursementBatchId !== batchId)
        throw new ConflictException({
          code: 'CONFLICT',
          message: `A despesa não está no lote ${batch.number}.`,
        });
      await this.repo.saveExpenseWithAudit(expense, {
        organizationId: project.organizationId,
        projectId,
        expenseId: id,
        operation: PaymentExpenseAuditOperation.REMOVE_FROM_REIMBURSEMENT_BATCH,
        performedBy: actor.id,
        changes: expense.setBatch(actor.id, null),
      });
    });
  }

  /** Faturar o lote: as despesas saem de "A reembolsar" (o recebível vem na etapa 7). */
  async billBatch(
    projectId: number,
    batchId: number,
    dto: { expected_receipt_on?: string | null },
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    return this.transitionBatch(
      project.organizationId,
      projectId,
      batchId,
      actor,
      async (batch, m) => {
        if (batch.status !== ReimbursementBatchStatus.OPEN)
          throw new ConflictException({
            code: 'REIMBURSEMENT_BATCH_NOT_OPEN',
            message: `O lote ${batch.number} não está aberto.`,
          });
        const count = await m.getRepository(ExpenseEntity).count({
          where: { reimbursementBatchId: batchId },
        });
        if (!count)
          throw new ConflictException({
            code: 'EMPTY_BATCH',
            message: 'Inclua ao menos uma despesa antes de faturar o lote.',
          });
        const now = new Date();
        const before = {
          status: batch.status,
          expected: batch.expectedReceiptOn,
        };
        batch.status = ReimbursementBatchStatus.BILLED;
        batch.billedAt = now;
        batch.billedById = actor.id;
        if (dto.expected_receipt_on !== undefined)
          batch.expectedReceiptOn = dto.expected_receipt_on;
        return {
          operation: PaymentExpenseAuditOperation.BILL_REIMBURSEMENT_BATCH,
          changes: {
            status: { before: before.status, after: batch.status },
            expected_receipt_on: {
              before: before.expected,
              after: batch.expectedReceiptOn,
            },
            billed_at: { before: null, after: now },
          },
        };
      },
    );
  }

  /** Reabrir um lote faturado (enquanto não houver recebível vinculado). */
  async reopenBatch(
    projectId: number,
    batchId: number,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    return this.transitionBatch(
      project.organizationId,
      projectId,
      batchId,
      actor,
      (batch) => {
        if (batch.status !== ReimbursementBatchStatus.BILLED)
          throw new ConflictException({
            code: 'CONFLICT',
            message: `Só lote faturado pode ser reaberto (lote ${batch.number}: ${BATCH_STATUS_LABEL[batch.status]}).`,
          });
        if (batch.receivableId)
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'O lote já gerou recebível; estorne o recebível antes.',
          });
        batch.status = ReimbursementBatchStatus.OPEN;
        batch.billedAt = null;
        batch.billedById = null;
        return {
          operation: PaymentExpenseAuditOperation.REOPEN_REIMBURSEMENT_BATCH,
          changes: { status: { before: 'billed', after: 'open' } },
        };
      },
    );
  }

  /** Cancelar um lote aberto: as despesas voltam a ficar sem lote. */
  async cancelBatch(
    projectId: number,
    batchId: number,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    return this.transitionBatch(
      project.organizationId,
      projectId,
      batchId,
      actor,
      async (batch, m) => {
        if (batch.status !== ReimbursementBatchStatus.OPEN)
          throw new ConflictException({
            code: 'REIMBURSEMENT_BATCH_NOT_OPEN',
            message: `Só lote aberto pode ser cancelado (lote ${batch.number}).`,
          });
        const released = await m.getRepository(ExpenseEntity).find({
          where: { reimbursementBatchId: batchId },
          select: { id: true },
        });
        await m
          .getRepository(ExpenseEntity)
          .update(
            { reimbursementBatchId: batchId },
            { reimbursementBatchId: null, updatedById: actor.id },
          );
        batch.status = ReimbursementBatchStatus.CANCELLED;
        return {
          operation: PaymentExpenseAuditOperation.CANCEL_REIMBURSEMENT_BATCH,
          changes: {
            status: { before: 'open', after: 'cancelled' },
            released_expense_ids: {
              before: null,
              after: released.map((e) => Number(e.id)),
            },
          },
        };
      },
    );
  }

  private async createBatch(
    organizationId: number,
    projectId: number,
    dto: {
      batch_date?: string;
      expected_receipt_on?: string | null;
      notes?: string | null;
    },
    actor: PaymentsExpensesActorContext,
  ) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.ds.transaction(async (m) => {
          const row = await m
            .getRepository(ExpenseReimbursementBatchEntity)
            .createQueryBuilder('b')
            .select('MAX(b.number)', 'max')
            .where('b.projectId = :projectId', { projectId })
            .getRawOne<{ max: number | string | null }>();
          const repo = m.getRepository(ExpenseReimbursementBatchEntity);
          const batch = await repo.save(
            repo.create({
              organizationId,
              projectId,
              number: Number(row?.max ?? 0) + 1,
              batchDate: dto.batch_date ?? civilToday(),
              expectedReceiptOn: dto.expected_receipt_on ?? null,
              status: ReimbursementBatchStatus.OPEN,
              notes: dto.notes?.trim() || null,
              createdById: actor.id,
            }),
          );
          await this.audit(m, {
            organizationId,
            projectId,
            operation: PaymentExpenseAuditOperation.CREATE_REIMBURSEMENT_BATCH,
            performedBy: actor.id,
            changes: {
              batch_id: { before: null, after: Number(batch.id) },
              number: { before: null, after: batch.number },
              batch_date: { before: null, after: batch.batchDate },
            },
          });
          return batch;
        });
      } catch (error) {
        if (
          !/duplicate|unique/i.test(String((error as Error)?.message)) ||
          attempt >= 3
        )
          throw error;
      }
    }
  }

  private async transitionBatch(
    organizationId: number,
    projectId: number,
    batchId: number,
    actor: PaymentsExpensesActorContext,
    apply: (
      batch: ExpenseReimbursementBatchEntity,
      m: EntityManager,
    ) => BatchTransition | Promise<BatchTransition>,
  ) {
    return this.ds.transaction(async (m) => {
      const batch = await m
        .getRepository(ExpenseReimbursementBatchEntity)
        .findOne({ where: { id: batchId, organizationId, projectId } });
      if (!batch)
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Lote não encontrado.',
        });
      const { operation, changes } = await apply(batch, m);
      await m.getRepository(ExpenseReimbursementBatchEntity).save(batch);
      await this.audit(m, {
        organizationId,
        projectId,
        operation,
        performedBy: actor.id,
        changes: { batch_id: { before: batchId, after: batchId }, ...changes },
      });
      return {
        id: batchId,
        number: Number(batch.number),
        status: batch.status,
      };
    });
  }

  // ───────────── concluir / reabrir financeiro (M8) ─────────────

  async closeFinance(
    projectId: number,
    reason: string,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor);
    return this.ds.transaction(async (m) => {
      const open = await m
        .getRepository(ProjectFinancialClosureEntity)
        .findOne({
          where: { projectId, reopenedAt: IsNull() },
        });
      if (open)
        throw new ConflictException({
          code: 'PROJECT_FINANCE_CLOSED',
          message: 'O financeiro do projeto já está concluído.',
        });
      const repo = m.getRepository(ProjectFinancialClosureEntity);
      const now = new Date();
      const row = await repo.save(
        repo.create({
          organizationId: project.organizationId,
          projectId,
          closedAt: now,
          closedById: actor.id,
          closeReason: reason.trim(),
        }),
      );
      await this.audit(m, {
        organizationId: project.organizationId,
        projectId,
        operation: PaymentExpenseAuditOperation.CLOSE_PROJECT_FINANCE,
        performedBy: actor.id,
        changes: {
          closed_at: { before: null, after: now },
          reason: { before: null, after: reason.trim() },
        },
      });
      return { closure_id: Number(row.id), closed_at: now.toISOString() };
    });
  }

  async reopenFinance(
    projectId: number,
    reason: string,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor);
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(ProjectFinancialClosureEntity);
      const open = await repo.findOne({
        where: { projectId, reopenedAt: IsNull() },
        order: { id: 'DESC' },
      });
      if (!open)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'O financeiro do projeto não está concluído.',
        });
      const now = new Date();
      open.reopenedAt = now;
      open.reopenedById = actor.id;
      open.reopenReason = reason.trim();
      await repo.save(open);
      await this.audit(m, {
        organizationId: project.organizationId,
        projectId,
        operation: PaymentExpenseAuditOperation.REOPEN_PROJECT_FINANCE,
        performedBy: actor.id,
        changes: {
          reopened_at: { before: null, after: now },
          reason: { before: null, after: reason.trim() },
        },
      });
      return { reopened_at: now.toISOString() };
    });
  }

  // ───────────── adiantamentos (M6) ─────────────

  async saveAdvance(
    projectId: number,
    id: number | null,
    dto: {
      field_agent_id: number;
      advanced_on: string;
      amount: string;
      notes?: string | null;
      deposited_by_name?: string | null;
    },
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    const link = await this.ds.getRepository(ProjectFieldAgentEntity).findOne({
      where: {
        organizationId: project.organizationId,
        projectId,
        fieldAgentId: dto.field_agent_id,
      },
    });
    const agent = link
      ? await this.ds.getRepository(FieldAgentEntity).findOneBy({
          id: dto.field_agent_id,
          organizationId: project.organizationId,
        })
      : null;
    if (!agent)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'O técnico precisa estar vinculado ao projeto.',
        details: [
          {
            field: 'field_agent_id',
            message: 'Técnico não vinculado ao projeto.',
          },
        ],
      });
    assertNotFuture(dto.advanced_on, 'A data do depósito do adiantamento');
    if (toCents(dto.amount) <= 0n)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'O valor depositado deve ser positivo.',
        details: [{ field: 'amount', message: 'Informe um valor positivo.' }],
      });
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(ExpenseAdvanceEntity);
      const current = id
        ? await repo.findOne({
            where: { id, organizationId: project.organizationId, projectId },
          })
        : null;
      if (id && !current)
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Adiantamento não encontrado.',
        });
      const next = {
        fieldAgentId: dto.field_agent_id,
        advancedOn: dto.advanced_on,
        amount: dto.amount,
        notes: dto.notes?.trim() || null,
        depositedByName: dto.deposited_by_name?.trim() || null,
      };
      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const [key, value] of Object.entries(next)) {
        const before = current
          ? key === 'amount'
            ? money(current.amount)
            : key === 'advancedOn'
              ? civil(current.advancedOn)
              : (current as unknown as Record<string, unknown>)[key]
          : null;
        const text = (v: unknown) =>
          typeof v === 'string' || typeof v === 'number' ? String(v) : '';
        if (text(before) !== text(value))
          changes[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = {
            before,
            after: value,
          };
      }
      const saved = await repo.save(
        current
          ? Object.assign(current, next, { updatedById: actor.id })
          : repo.create({
              ...next,
              organizationId: project.organizationId,
              projectId,
              createdById: actor.id,
              updatedById: actor.id,
            }),
      );
      await this.audit(m, {
        organizationId: project.organizationId,
        projectId,
        operation: current
          ? PaymentExpenseAuditOperation.UPDATE_ADVANCE
          : PaymentExpenseAuditOperation.CREATE_ADVANCE,
        performedBy: actor.id,
        changes: {
          advance_id: { before: null, after: Number(saved.id) },
          ...changes,
        },
      });
      return { id: Number(saved.id) };
    });
  }

  async removeAdvance(
    projectId: number,
    id: number,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(ExpenseAdvanceEntity);
      const current = await repo.findOne({
        where: { id, organizationId: project.organizationId, projectId },
      });
      if (!current)
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Adiantamento não encontrado.',
        });
      await repo.softDelete({ id });
      await this.audit(m, {
        organizationId: project.organizationId,
        projectId,
        operation: PaymentExpenseAuditOperation.DELETE_ADVANCE,
        performedBy: actor.id,
        changes: {
          advance_id: { before: id, after: null },
          amount: { before: money(current.amount), after: null },
        },
      });
      return { id };
    });
  }

  // ───────────── auxiliares ─────────────

  private async expense(
    organizationId: number,
    projectId: number,
    id: number,
  ): Promise<Expense> {
    const expense = await this.repo.findExpenseById(id);
    if (
      !expense ||
      expense.organizationId !== organizationId ||
      expense.projectId !== projectId ||
      expense.deletedAt
    )
      throw new ConflictException({
        code: 'NOT_FOUND',
        message: 'Despesa não encontrada.',
      });
    return expense;
  }

  private async batch(organizationId: number, projectId: number, id: number) {
    const batch = await this.ds
      .getRepository(ExpenseReimbursementBatchEntity)
      .findOne({ where: { id, organizationId, projectId } });
    if (!batch)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Lote não encontrado.',
      });
    return batch;
  }

  private audit(
    m: EntityManager,
    entry: {
      organizationId: number;
      projectId: number;
      operation: string;
      performedBy: number;
      changes: Record<string, { before: unknown; after: unknown }>;
    },
  ) {
    return m.getRepository(PaymentExpenseAuditLogEntity).save({
      ...entry,
      paymentId: null,
      expenseId: null,
      expenseAttachmentId: null,
    });
  }

  /** Regras do domínio (Error simples) viram item recusado no lote. */
  private rule<T>(apply: () => T): T {
    try {
      return apply();
    } catch (error) {
      if (error instanceof Error && error.constructor === Error)
        throw new ConflictException({
          code: 'CONFLICT',
          message: error.message,
        });
      throw error;
    }
  }

  /** Cada item é executado e relatado; o lote não para no primeiro erro. */
  async each(ids: number[], run: (id: number) => Promise<unknown>) {
    const unique = [...new Set(ids)];
    if (!unique.length || unique.length > BATCH_LIMIT)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Selecione de 1 a ${BATCH_LIMIT} despesas.`,
      });
    const results: Array<{ id: number; ok: boolean; message?: string }> = [];
    for (const id of unique) {
      try {
        await run(id);
        results.push({ id, ok: true });
      } catch (error) {
        if (
          !(error instanceof ConflictException) &&
          !(error instanceof BadRequestException) &&
          !(error instanceof NotFoundException)
        )
          throw error;
        const response = error.getResponse() as { message?: string };
        results.push({
          id,
          ok: false,
          message: response.message ?? 'Não foi possível concluir.',
        });
      }
    }
    return {
      done: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }
}
