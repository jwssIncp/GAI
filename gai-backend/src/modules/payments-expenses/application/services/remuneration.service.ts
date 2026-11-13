import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ContractEntity } from '../../../contracts/contract.entity';
import { FieldAgentEntity } from '../../../field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../../field-agents/infrastructure/persistence/project-field-agent.entity';
import { ProjectFieldAgentStatus } from '../../../field-agents/domain/enums/project-field-agent-status.enum';
import { FinanceSettingsService } from '../../../finance-settings/finance-settings.service';
import { DreEntry, DrePeriod } from '../../../managerial-dre/dre.entity';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import {
  fromCents,
  percentOf,
  toCents,
} from '../../domain/remuneration.formulas';
import { ExpenseEntity } from '../../infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../../infrastructure/persistence/field-agent-payment.entity';
import type { PaymentsExpensesActorContext } from './payments-expenses-scope.service';

export type RemunerationStatusGroup = 'open' | 'paid' | 'cancelled' | 'all';

export interface RemunerationFilters {
  field_agent_id?: number;
  state?: string;
  status_group?: RemunerationStatusGroup;
}

const ROW_LIMIT = 5000;
const PROJECT_LIMIT = 2000;
const civil = (value: Date | string | null | undefined) =>
  value == null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
/** Decimal do banco (texto no MySQL, número no SQLite) para "0.00", sem ponto flutuante. */
const money = (value: string | number | null | undefined): string => {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(String(value ?? 0).trim());
  if (!match) throw new Error(`Valor monetário inválido: ${String(value)}`);
  return fromCents(
    toCents(`${match[1]}.${(match[2] ?? '').padEnd(2, '0').slice(0, 2)}`),
  );
};

/** Status do projeto na lista da Remuneração (mapeado dos status do GAI) e ordem do doc 06 §2.1. */
const PROJECT_STATUS: Record<string, { label: string; rank: number }> = {
  active: { label: 'Em andamento', rank: 0 },
  draft: { label: 'Em preparação', rank: 1 },
  paused: { label: 'Pausado', rank: 2 },
  finished: { label: 'Concluído', rank: 3 },
  inactive: { label: 'Inativo', rank: 4 },
  cancelled: { label: 'Cancelado', rank: 4 },
  archived: { label: 'Arquivado', rank: 4 },
};
const OPEN_PROJECT = ['draft', 'active', 'paused'];

/**
 * Leituras da Remuneração (doc 06 §2): lista de projetos da organização
 * (Tela A) e lançamentos de um projeto com contexto, totais e linhas
 * "a lançar" (Tela B). As gravações continuam no PaymentsExpensesService.
 */
@Injectable()
export class RemunerationService {
  constructor(
    private readonly ds: DataSource,
    private readonly settings: FinanceSettingsService,
  ) {}

  private organization(actor: PaymentsExpensesActorContext): number {
    if (
      actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
      !actor.organizationId
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Selecione uma organização para consultar a remuneração.',
      });
    return actor.organizationId;
  }

  private async project(
    projectId: number,
    actor: PaymentsExpensesActorContext,
  ) {
    const organizationId = this.organization(actor);
    const project = await this.ds
      .getRepository(ProjectEntity)
      .findOne({ where: { id: projectId, organizationId } });
    if (!project)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    return project;
  }

  /** Parâmetros que a tela precisa; sem versão vigente, avisa em vez de inventar valor. */
  private async parameters(organizationId: number) {
    try {
      const values = await this.settings.valuesAt(organizationId);
      return {
        settings_missing: false,
        default_daily_rate: values.default_daily_rate,
        require_approval: values.require_approval,
        technician_expense_alert_pct: values.technician_expense_alert_pct,
      };
    } catch {
      return {
        settings_missing: true,
        default_daily_rate: null,
        require_approval: null,
        technician_expense_alert_pct: null,
      };
    }
  }

  /** Lançamentos do projeto (Tela B), com filtros, totais, KPIs e linhas "a lançar". */
  async projectRemuneration(
    projectId: number,
    filters: RemunerationFilters,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.project(projectId, actor);
    const organizationId = Number(project.organizationId);
    const [links, all] = await Promise.all([
      this.ds.getRepository(ProjectFieldAgentEntity).find({
        where: { organizationId, projectId },
      }),
      this.ds.getRepository(FieldAgentPaymentEntity).find({
        where: { organizationId, projectId },
        order: { startDate: 'DESC', id: 'DESC' },
        take: ROW_LIMIT + 1,
      }),
    ]);
    if (all.length > ROW_LIMIT)
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `O projeto tem mais de ${ROW_LIMIT} lançamentos; use os filtros.`,
      });
    const agentIds = [
      ...new Set([
        ...links.map((l) => Number(l.fieldAgentId)),
        ...all.map((p) => Number(p.fieldAgentId)),
      ]),
    ];
    const agents = agentIds.length
      ? await this.ds.getRepository(FieldAgentEntity).find({
          where: { id: In(agentIds), organizationId },
          withDeleted: true,
        })
      : [];
    const agentById = new Map(agents.map((a) => [Number(a.id), a]));
    // Vinculados: só cadastros não excluídos (exclusão lógica não desfaz o vínculo antigo).
    const linked = new Map<number, string>();
    for (const link of links)
      if (
        !agentById.get(Number(link.fieldAgentId))?.deletedAt &&
        (link.status === ProjectFieldAgentStatus.ACTIVE ||
          !linked.has(Number(link.fieldAgentId)))
      )
        linked.set(Number(link.fieldAgentId), link.status);

    const group = filters.status_group ?? 'all';
    const rows = all.filter((p) => {
      if (
        filters.field_agent_id &&
        Number(p.fieldAgentId) !== filters.field_agent_id
      )
        return false;
      if (filters.state && p.state !== filters.state) return false;
      if (group === 'open')
        return (
          p.status === PaymentStatus.PENDING ||
          p.status === PaymentStatus.APPROVED
        );
      if (group === 'paid') return p.status === PaymentStatus.PAID;
      if (group === 'cancelled') return p.status === PaymentStatus.CANCELLED;
      return true;
    });

    const sum = (
      items: FieldAgentPaymentEntity[],
      key: 'totalAmount' | 'discountAmount' | 'finalAmount',
    ) => fromCents(items.reduce((s, p) => s + toCents(money(p[key])), 0n));
    // Totais e KPI excluem cancelados (decisão D-L): cancelado não é dívida.
    const valid = rows.filter((p) => p.status !== PaymentStatus.CANCELLED);
    const projectValid = all.filter(
      (p) => p.status !== PaymentStatus.CANCELLED,
    );
    const withPayments = new Set(all.map((p) => Number(p.fieldAgentId)));

    return {
      project: {
        id: Number(project.id),
        name: project.name,
        status: project.status,
      },
      parameters: await this.parameters(organizationId),
      agents: [...linked.entries()].map(([id, status]) => ({
        id,
        name: agentById.get(id)?.name ?? `#${id}`,
        state: agentById.get(id)?.state ?? null,
        link_status: status,
        has_payments: withPayments.has(id),
      })),
      // Vinculados ativos sem nenhum lançamento: a tela mostra e oferece lançar.
      to_launch: [...linked.entries()]
        .filter(([id, status]) => status === 'active' && !withPayments.has(id))
        .map(([id]) => ({
          field_agent_id: id,
          name: agentById.get(id)?.name ?? `#${id}`,
          state: agentById.get(id)?.state ?? null,
        })),
      items: rows.map((p) => ({
        id: Number(p.id),
        field_agent_id: Number(p.fieldAgentId),
        field_agent_name:
          agentById.get(Number(p.fieldAgentId))?.name ?? `#${p.fieldAgentId}`,
        state: p.state,
        start_date: civil(p.startDate),
        end_date: civil(p.endDate),
        expected_payment_date: civil(p.expectedPaymentDate),
        payment_date:
          p.status === PaymentStatus.PAID ? civil(p.paymentDate) : null,
        days: Number(p.days),
        daily_rate: money(p.dailyRate),
        additional_amount: money(p.additionalAmount),
        daily_total: money(p.dailyTotal),
        total_amount: money(p.totalAmount),
        total_manual: Boolean(p.totalManual),
        discount_amount: money(p.discountAmount),
        final_amount: money(p.finalAmount),
        status: p.status,
        notes: p.notes,
        reopened_at: p.reopenedAt ? p.reopenedAt.toISOString() : null,
        updated_at: p.updatedAt.toISOString(),
      })),
      totals: {
        count: rows.length,
        total_amount: sum(valid, 'totalAmount'),
        discount_amount: sum(valid, 'discountAmount'),
        final_amount: sum(valid, 'finalAmount'),
      },
      kpis: {
        total_final: sum(projectValid, 'finalAmount'),
        paid_final: sum(
          all.filter((p) => p.status === PaymentStatus.PAID),
          'finalAmount',
        ),
      },
    };
  }

  /** Lista de projetos da organização (Tela A, doc 06 §2.1). */
  async projects(
    filters: { search?: string; only_open?: boolean; year?: number },
    actor: PaymentsExpensesActorContext,
  ) {
    const organizationId = this.organization(actor);
    const parameters = await this.parameters(organizationId);
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
    const [contracts, expenses, payments, links] = await Promise.all([
      this.ds.getRepository(ContractEntity).find({ where }),
      this.ds.getRepository(ExpenseEntity).find({ where }),
      this.ds.getRepository(FieldAgentPaymentEntity).find({ where }),
      this.ds.getRepository(ProjectFieldAgentEntity).find({ where }),
    ]);
    // Inventariantes excluídos (exclusão lógica) não contam como técnicos do projeto.
    const liveAgentIds = new Set(
      (links.length
        ? await this.ds.getRepository(FieldAgentEntity).find({
            where: {
              organizationId,
              id: In([...new Set(links.map((l) => Number(l.fieldAgentId)))]),
            },
            select: { id: true },
          })
        : []
      ).map((agent) => Number(agent.id)),
    );
    const by = <T extends { projectId: number }>(rows: T[]) => {
      const map = new Map<number, T[]>();
      for (const row of rows) {
        const key = Number(row.projectId);
        map.set(key, [...(map.get(key) ?? []), row]);
      }
      return map;
    };
    const contractsBy = by(contracts);
    const expensesBy = by(expenses);
    const paymentsBy = by(payments);
    const linksBy = by(links);
    const alert = parameters.technician_expense_alert_pct;
    const search = filters.search?.trim().toLocaleLowerCase('pt-BR');

    const rows = projects.map((project) => {
      const id = Number(project.id);
      const live = (contractsBy.get(id) ?? []).filter(
        (c) => !['cancelled', 'archived'].includes(c.data.status),
      );
      const contractValue = live.reduce(
        (s, c) =>
          s + toCents(money(c.data.current_value ?? c.data.original_value)),
        0n,
      );
      // Até a etapa 4 (tipo por despesa), a classificação vem do contrato:
      // "despesas de campo por conta da empresa" = não reembolsáveis.
      const payers = new Set(
        live.map((c) => c.data.expenses_paid_by).filter(Boolean),
      );
      const projectExpenses = (expensesBy.get(id) ?? []).filter(
        (e) => !['cancelled', 'rejected'].includes(e.status),
      );
      const nonReimbursable = payers.has('company')
        ? projectExpenses.reduce((s, e) => s + toCents(money(e.amount)), 0n)
        : payers.has('client')
          ? 0n
          : null;
      // Despesas de inventariantes: Σ (total − descontos) sem cancelados (D-L).
      const agentsCost = (paymentsBy.get(id) ?? [])
        .filter((p) => p.status !== PaymentStatus.CANCELLED)
        .reduce((s, p) => s + toCents(money(p.finalAmount)), 0n);
      const net =
        nonReimbursable === null ? null : contractValue - nonReimbursable;
      const technicianPct = percentOf(
        fromCents(agentsCost),
        fromCents(contractValue),
      );
      const netPct =
        net !== null && net > 0n && agentsCost > 0n
          ? percentOf(fromCents(agentsCost), fromCents(net))
          : null;
      const over = (pct: string | null) =>
        pct !== null && alert !== null && toCents(pct) > toCents(alert);
      const contractedOn =
        live
          .map((c) => c.data.contracted_on)
          .filter((d): d is string => Boolean(d))
          .sort()
          .pop() ?? null;
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
        technicians: new Set(
          (linksBy.get(id) ?? [])
            .filter(
              (l) =>
                liveAgentIds.has(Number(l.fieldAgentId)) &&
                (l.status === ProjectFieldAgentStatus.ACTIVE ||
                  l.status === ProjectFieldAgentStatus.FINISHED),
            )
            .map((l) => Number(l.fieldAgentId)),
        ).size,
        contract_value: fromCents(contractValue),
        non_reimbursable_expenses:
          nonReimbursable === null ? null : fromCents(nonReimbursable),
        net_contract_value: net === null ? null : fromCents(net),
        agents_cost: fromCents(agentsCost),
        technician_pct: technicianPct,
        technician_pct_alert: over(technicianPct),
        net_pct: netPct,
        net_pct_alert: over(netPct),
        scope: [...new Set(live.flatMap((c) => c.data.services ?? []))].sort(),
        segment: live.map((c) => c.data.segment).find(Boolean) ?? null,
        state: live.map((c) => c.data.company_state).find(Boolean) ?? null,
        contracted_on: contractedOn,
        finished_at: civil(project.finishedAt),
      };
    });

    const visible = rows
      .filter((row) => !filters.only_open || OPEN_PROJECT.includes(row.status))
      .filter(
        (row) =>
          !filters.year ||
          row.contracted_on?.startsWith(String(filters.year)) ||
          false,
      )
      .filter(
        (row) =>
          !search ||
          [row.name, row.segment, row.state]
            .filter(Boolean)
            .some((v) => String(v).toLocaleLowerCase('pt-BR').includes(search)),
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
      parameters,
      items: visible.map(({ rank: _rank, ...row }) => row),
      subtotal_agents_cost: fromCents(
        visible.reduce((s, row) => s + toCents(row.agents_cost), 0n),
      ),
    };
  }

  /**
   * Reabertura bloqueada se o lançamento estiver classificado na DRE em uma
   * competência já fechada (decisão D-D).
   */
  async closedPeriodsFor(
    organizationId: number,
    paymentId: number,
  ): Promise<string[]> {
    const entry = await this.ds.getRepository(DreEntry).findOne({
      where: { organizationId, sourceKey: `payment:${paymentId}` },
    });
    const months = [
      ...new Set((entry?.data.allocations ?? []).map((a) => a.month)),
    ];
    if (!months.length) return [];
    const closed = await this.ds.getRepository(DrePeriod).find({
      where: { organizationId, month: In(months), closed: true },
    });
    return closed.map((p) => p.month).sort();
  }
}
