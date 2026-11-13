import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { FieldAgentEntity } from '../../../field-agents/infrastructure/persistence/field-agent.entity';
import { FinanceSettingsService } from '../../../finance-settings/finance-settings.service';
import { civilToday } from '../../../finance-settings/finance-settings.policy';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { ProjectStatusTransitionPolicy } from '../../../projects/domain/services/project-status-transition.policy';
import { FieldAgentPayment } from '../../domain/entities/field-agent-payment';
import { PaymentStateConflict } from '../../domain/entities/payment-state-conflict';
import { PaymentExpenseAuditOperation } from '../../domain/enums/payment-expense-audit-operation.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import {
  PAYMENTS_EXPENSES_REPOSITORY,
  type PaymentExpenseAuditEntry,
  type PaymentsExpensesRepository,
} from '../../domain/ports/payments-expenses.repository.port';
import { fromCents, toCents } from '../../domain/remuneration.formulas';
import { FieldAgentPaymentEntity } from '../../infrastructure/persistence/field-agent-payment.entity';
import type { PaymentsExpensesActorContext } from './payments-expenses-scope.service';
import { RemunerationService } from './remuneration.service';

export type PaymentStatusFilter =
  | 'open'
  | 'pending'
  | 'approved'
  | 'paid'
  | 'cancelled';

/** Filtros da tela consolidada (doc 06 §4.1). Datas civis; meses em AAAA-MM. */
export interface ConsolidatedFilters {
  project_id?: number;
  field_agent_id?: number;
  status?: PaymentStatusFilter;
  expected_month?: string;
  paid_month?: string;
  expected_date?: string;
  payment_date?: string;
}

export type PayDateMode = 'today' | 'chosen' | 'individual';

const ROW_LIMIT = 10000;
export const BATCH_LIMIT = 500;
const OPEN = new Set<string>([PaymentStatus.PENDING, PaymentStatus.APPROVED]);
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

const civil = (value: Date | string | null | undefined) =>
  value == null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
const money = (value: string | number | null | undefined): string => {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(String(value ?? 0).trim());
  if (!match) throw new Error(`Valor monetário inválido: ${String(value)}`);
  return fromCents(
    toCents(`${match[1]}.${(match[2] ?? '').padEnd(2, '0').slice(0, 2)}`),
  );
};
const nextMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

export interface ConsolidatedRow {
  id: number;
  project_id: number;
  project_name: string;
  field_agent_id: number;
  field_agent_name: string;
  state: string | null;
  start_date: string;
  end_date: string;
  expected_payment_date: string | null;
  payment_date: string | null;
  days: number;
  daily_rate: string;
  additional_amount: string;
  total_amount: string;
  total_manual: boolean;
  discount_amount: string;
  final_amount: string;
  status: PaymentStatus;
  overdue: boolean;
}

/**
 * Pagamento de inventariantes (doc 06 §4): consolida a remuneração de todos os
 * projetos da organização e grava a baixa nos próprios lançamentos.
 */
@Injectable()
export class FieldAgentPaymentsService {
  constructor(
    private readonly ds: DataSource,
    @Inject(PAYMENTS_EXPENSES_REPOSITORY)
    private readonly repo: PaymentsExpensesRepository,
    private readonly settings: FinanceSettingsService,
    private readonly remuneration: RemunerationService,
  ) {}

  private organization(actor: PaymentsExpensesActorContext): number {
    if (
      actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
      !actor.organizationId
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Selecione uma organização para consultar os pagamentos.',
      });
    return actor.organizationId;
  }

  /** Todos os lançamentos não excluídos da organização, já com nomes. */
  private async rows(organizationId: number, today: string) {
    const payments = await this.ds.getRepository(FieldAgentPaymentEntity).find({
      where: { organizationId },
      take: ROW_LIMIT + 1,
    });
    if (payments.length > ROW_LIMIT)
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `Mais de ${ROW_LIMIT} lançamentos na organização.`,
      });
    const projectIds = [...new Set(payments.map((p) => Number(p.projectId)))];
    const agentIds = [...new Set(payments.map((p) => Number(p.fieldAgentId)))];
    const [projects, agents] = await Promise.all([
      projectIds.length
        ? this.ds.getRepository(ProjectEntity).find({
            where: { id: In(projectIds), organizationId },
            withDeleted: true,
            select: { id: true, name: true },
          })
        : [],
      agentIds.length
        ? this.ds.getRepository(FieldAgentEntity).find({
            where: { id: In(agentIds), organizationId },
            withDeleted: true,
            select: { id: true, name: true },
          })
        : [],
    ]);
    const projectName = new Map(projects.map((p) => [Number(p.id), p.name]));
    const agentName = new Map(agents.map((a) => [Number(a.id), a.name]));
    return payments.map((p): ConsolidatedRow => {
      const expected = civil(p.expectedPaymentDate);
      return {
        id: Number(p.id),
        project_id: Number(p.projectId),
        project_name: projectName.get(Number(p.projectId)) ?? `#${p.projectId}`,
        field_agent_id: Number(p.fieldAgentId),
        field_agent_name:
          agentName.get(Number(p.fieldAgentId)) ?? `#${p.fieldAgentId}`,
        state: p.state,
        start_date: civil(p.startDate)!,
        end_date: civil(p.endDate)!,
        expected_payment_date: expected,
        payment_date:
          p.status === PaymentStatus.PAID ? civil(p.paymentDate) : null,
        days: Number(p.days),
        daily_rate: money(p.dailyRate),
        additional_amount: money(p.additionalAmount),
        total_amount: money(p.totalAmount),
        total_manual: Boolean(p.totalManual),
        discount_amount: money(p.discountAmount),
        final_amount: money(p.finalAmount),
        status: p.status,
        // Atraso: previsão anterior a hoje e ainda em aberto (decisão 7).
        overdue: OPEN.has(p.status) && expected !== null && expected < today,
      };
    });
  }

  private static matches(
    row: ConsolidatedRow,
    f: ConsolidatedFilters,
    skip?: keyof ConsolidatedFilters,
  ) {
    const on = (key: keyof ConsolidatedFilters) =>
      key !== skip && f[key] !== undefined && f[key] !== '';
    if (on('project_id') && row.project_id !== f.project_id) return false;
    if (on('field_agent_id') && row.field_agent_id !== f.field_agent_id)
      return false;
    if (on('status')) {
      if (
        f.status === 'open'
          ? !OPEN.has(row.status)
          : (row.status as string) !== f.status
      )
        return false;
    }
    if (
      on('expected_month') &&
      !row.expected_payment_date?.startsWith(f.expected_month!)
    )
      return false;
    if (on('paid_month') && !row.payment_date?.startsWith(f.paid_month!))
      return false;
    if (on('expected_date') && row.expected_payment_date !== f.expected_date)
      return false;
    if (on('payment_date') && row.payment_date !== f.payment_date) return false;
    return true;
  }

  /** Tela consolidada: KPIs, facetas em cascata, resumo por inventariante e lançamentos. */
  async list(
    filters: ConsolidatedFilters,
    actor: PaymentsExpensesActorContext,
  ) {
    const organizationId = this.organization(actor);
    const today = civilToday();
    const month = today.slice(0, 7);
    const all = await this.rows(organizationId, today);
    const rows = all.filter((r) =>
      FieldAgentPaymentsService.matches(r, filters),
    );

    const sum = (list: ConsolidatedRow[]) =>
      fromCents(list.reduce((s, r) => s + toCents(r.final_amount), 0n));
    const valid = rows.filter((r) => r.status !== PaymentStatus.CANCELLED);
    const open = rows.filter((r) => OPEN.has(r.status));
    const paid = rows.filter((r) => r.status === PaymentStatus.PAID);
    const overdue = rows.filter((r) => r.overdue);
    const kpis = {
      reference_month: month,
      total: sum(valid),
      paid: sum(paid),
      open: sum(open),
      field_agents: new Set(valid.map((r) => r.field_agent_id)).size,
      expected_in_month: sum(
        valid.filter((r) => r.expected_payment_date?.startsWith(month)),
      ),
      paid_in_month: sum(paid.filter((r) => r.payment_date?.startsWith(month))),
      open_in_month: sum(
        open.filter((r) => r.expected_payment_date?.startsWith(month)),
      ),
      open_next_month: sum(
        open.filter((r) =>
          r.expected_payment_date?.startsWith(nextMonth(month)),
        ),
      ),
      overdue: sum(overdue),
      overdue_count: overdue.length,
    };

    // Facetas em cascata: cada filtro lista o que sobra com os OUTROS filtros aplicados.
    const facet = (
      key: keyof ConsolidatedFilters,
      pick: (r: ConsolidatedRow) => [string, string] | null,
    ) => {
      const base = all.filter((r) =>
        FieldAgentPaymentsService.matches(r, filters, key),
      );
      const counts = new Map<string, { label: string; count: number }>();
      for (const r of base) {
        const v = pick(r);
        if (!v) continue;
        const item = counts.get(v[0]) ?? { label: v[1], count: 0 };
        item.count += 1;
        counts.set(v[0], item);
      }
      return {
        total: base.length,
        options: [...counts.entries()]
          .map(([value, { label, count }]) => ({ value, label, count }))
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      };
    };
    const statusFacet = facet('status', (r) => [
      r.status,
      STATUS_LABEL[r.status] ?? r.status,
    ]);
    const openCount = all
      .filter((r) => FieldAgentPaymentsService.matches(r, filters, 'status'))
      .filter((r) => OPEN.has(r.status)).length;
    const facets = {
      project_id: facet('project_id', (r) => [
        String(r.project_id),
        r.project_name,
      ]),
      field_agent_id: facet('field_agent_id', (r) => [
        String(r.field_agent_id),
        r.field_agent_name,
      ]),
      status: {
        ...statusFacet,
        options: [
          {
            value: 'open',
            label: 'Em aberto (pendente e aprovado)',
            count: openCount,
          },
          ...statusFacet.options,
        ],
      },
      expected_month: facet('expected_month', (r) =>
        r.expected_payment_date
          ? [
              r.expected_payment_date.slice(0, 7),
              r.expected_payment_date.slice(0, 7),
            ]
          : null,
      ),
      paid_month: facet('paid_month', (r) =>
        r.payment_date
          ? [r.payment_date.slice(0, 7), r.payment_date.slice(0, 7)]
          : null,
      ),
      expected_date: facet('expected_date', (r) =>
        r.expected_payment_date
          ? [r.expected_payment_date, r.expected_payment_date]
          : null,
      ),
      payment_date: facet('payment_date', (r) =>
        r.payment_date ? [r.payment_date, r.payment_date] : null,
      ),
    };

    // Resumo por inventariante: por padrão só quem tem valor em aberto; com filtro de pagos, todos.
    const byAgent = new Map<
      number,
      {
        field_agent_id: number;
        name: string;
        entries: number;
        days: number;
        final: bigint;
        paid: bigint;
        open: bigint;
      }
    >();
    for (const r of valid) {
      const a = byAgent.get(r.field_agent_id) ?? {
        field_agent_id: r.field_agent_id,
        name: r.field_agent_name,
        entries: 0,
        days: 0,
        final: 0n,
        paid: 0n,
        open: 0n,
      };
      a.entries += 1;
      a.days += r.days;
      a.final += toCents(r.final_amount);
      if (r.status === PaymentStatus.PAID) a.paid += toCents(r.final_amount);
      if (OPEN.has(r.status)) a.open += toCents(r.final_amount);
      byAgent.set(r.field_agent_id, a);
    }
    const showAll = filters.status === 'paid';
    const summary = [...byAgent.values()]
      .filter((a) => showAll || a.open > 0n)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((a) => ({
        ...a,
        final: fromCents(a.final),
        paid: fromCents(a.paid),
        open: fromCents(a.open),
      }));
    const subtotal = (key: 'final' | 'paid' | 'open') =>
      fromCents(summary.reduce((s, a) => s + toCents(a[key]), 0n));

    // Em aberto primeiro; dentro do grupo, previsão mais antiga primeiro.
    const items = [...rows].sort(
      (a, b) =>
        Number(!OPEN.has(a.status)) - Number(!OPEN.has(b.status)) ||
        (a.expected_payment_date ?? '9999').localeCompare(
          b.expected_payment_date ?? '9999',
        ) ||
        a.id - b.id,
    );
    const require = await this.requireApproval(organizationId);
    return {
      today,
      require_approval: require,
      kpis,
      facets,
      summary: {
        rows: summary,
        show_all: showAll,
        subtotal: {
          final: subtotal('final'),
          paid: subtotal('paid'),
          open: subtotal('open'),
        },
      },
      items,
    };
  }

  private async requireApproval(organizationId: number): Promise<boolean> {
    try {
      return (await this.settings.valuesAt(organizationId)).require_approval;
    } catch {
      return false; // sem parâmetros: comportamento anterior do GAI
    }
  }

  private async mutate(
    id: number,
    actor: PaymentsExpensesActorContext,
    apply: (
      payment: FieldAgentPayment,
    ) => Omit<
      PaymentExpenseAuditEntry,
      'organizationId' | 'projectId' | 'paymentId' | 'performedBy'
    >,
  ) {
    const organizationId = this.organization(actor);
    const found = await this.repo.findPaymentById(id);
    if (
      !found ||
      found.organizationId !== organizationId ||
      found.toProps().deletedAt
    )
      throw new ConflictException({
        code: 'NOT_FOUND',
        message: 'Lançamento não encontrado.',
      });
    const saved = await this.repo.mutatePaymentWithAudit(
      found.projectId,
      id,
      (payment, projectStatus) => {
        if (
          !ProjectStatusTransitionPolicy.allowsOperationalMutation(
            projectStatus,
          )
        )
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'O status do projeto bloqueia esta operação.',
          });
        const entry = apply(payment);
        return {
          ...entry,
          organizationId,
          projectId: payment.projectId,
          paymentId: payment.id,
          performedBy: actor.id,
        };
      },
    );
    if (!saved)
      throw new ConflictException({
        code: 'NOT_FOUND',
        message: 'Lançamento não encontrado.',
      });
    return saved;
  }

  /** Executa cada item e relata o resultado de cada um (o lote não para no primeiro erro). */
  private async each(ids: number[], run: (id: number) => Promise<unknown>) {
    const unique = [...new Set(ids)];
    if (!unique.length || unique.length > BATCH_LIMIT)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Selecione de 1 a ${BATCH_LIMIT} lançamentos.`,
      });
    const results: Array<{ id: number; ok: boolean; message?: string }> = [];
    for (const id of unique) {
      try {
        await run(id);
        results.push({ id, ok: true });
      } catch (error) {
        const response =
          error instanceof PaymentStateConflict
            ? { message: error.message }
            : error instanceof ConflictException ||
                error instanceof BadRequestException
              ? (error.getResponse() as { message?: string })
              : // Regras do domínio lançam Error simples; TypeError e afins não são engolidos.
                error instanceof Error && error.constructor === Error
                ? { message: error.message }
                : null;
        if (!response) throw error;
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

  private date(value: string | undefined | null, label: string): Date {
    if (
      !value ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    )
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${label}: data inválida.`,
      });
    return new Date(`${value}T00:00:00.000Z`);
  }

  /**
   * Baixa em lote: data de hoje (fuso da operação), uma data para todos ou
   * uma data por lançamento. Pagar sem escolher grava HOJE, nunca a previsão.
   */
  async pay(
    dto: {
      ids: number[];
      date_mode: PayDateMode;
      payment_date?: string;
      dates?: Record<string, string>;
    },
    actor: PaymentsExpensesActorContext,
  ) {
    const organizationId = this.organization(actor);
    const requireApproval = await this.requireApproval(organizationId);
    const today = civilToday();
    const dateFor = (id: number) =>
      dto.date_mode === 'today'
        ? this.date(today, 'Data de hoje')
        : dto.date_mode === 'chosen'
          ? this.date(dto.payment_date, 'Data do pagamento')
          : this.date(dto.dates?.[String(id)], `Data do lançamento #${id}`);
    if (dto.date_mode === 'chosen')
      this.date(dto.payment_date, 'Data do pagamento');
    return this.each(dto.ids, (id) =>
      this.mutate(id, actor, (payment) => ({
        operation: PaymentExpenseAuditOperation.MARK_PAYMENT_AS_PAID,
        changes: payment.markAsPaid(
          actor.id,
          new Date(),
          dateFor(id),
          requireApproval,
        ),
      })),
    );
  }

  /** Voltar para em aberto (D-C), com permissão própria; bloqueado em competência fechada da DRE. */
  async revert(ids: number[], actor: PaymentsExpensesActorContext) {
    const organizationId = this.organization(actor);
    return this.each(ids, async (id) => {
      const closed = await this.remuneration.closedPeriodsFor(
        organizationId,
        id,
      );
      if (closed.length)
        throw new ConflictException({
          code: 'DRE_PERIOD_CLOSED',
          message: `Classificado na DRE em competência fechada (${closed.join(', ')}).`,
        });
      return this.mutate(id, actor, (payment) => ({
        operation: PaymentExpenseAuditOperation.REVERT_PAYMENT,
        changes: payment.revertPayment(actor.id),
      }));
    });
  }

  /** Editar a data de pagamento (pago) ou a data prevista (em aberto) de um lançamento. */
  async changeDate(
    id: number,
    dto: { kind: 'payment' | 'expected'; date: string },
    actor: PaymentsExpensesActorContext,
  ) {
    const organizationId = this.organization(actor);
    const date = this.date(
      dto.date,
      dto.kind === 'payment' ? 'Data de pagamento' : 'Data prevista',
    );
    if (dto.kind === 'payment') {
      const closed = await this.remuneration.closedPeriodsFor(
        organizationId,
        id,
      );
      if (closed.length)
        throw new ConflictException({
          code: 'DRE_PERIOD_CLOSED',
          message: `Classificado na DRE em competência fechada (${closed.join(', ')}).`,
        });
    }
    try {
      await this.mutate(id, actor, (payment) =>
        dto.kind === 'payment'
          ? {
              operation: PaymentExpenseAuditOperation.CHANGE_PAYMENT_DATE,
              changes: payment.changePaymentDate(actor.id, date),
            }
          : {
              operation: PaymentExpenseAuditOperation.CHANGE_EXPECTED_DATE,
              changes: payment.changeExpectedDate(actor.id, date),
            },
      );
    } catch (error) {
      if (error instanceof PaymentStateConflict)
        throw new ConflictException({
          code: 'CONFLICT',
          message: error.message,
        });
      if (error instanceof Error && error.constructor === Error)
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: error.message,
        });
      throw error;
    }
    return { ok: true };
  }
}
