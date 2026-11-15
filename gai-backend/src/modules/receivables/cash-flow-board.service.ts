import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { assertNotFuture } from '../../common/finance/settlement-date';
import { AssetTagsService } from '../asset-tags/asset-tags.service';
import { CommissionsService } from '../commissions/commissions.service';
import {
  ContractAmendmentEntity,
  ContractEntity,
} from '../contracts/contract.entity';
import { ExpenseStatus } from '../payments-expenses/domain/enums/expense-status.enum';
import { PaymentStatus } from '../payments-expenses/domain/enums/payment-status.enum';
import { ExpenseInstallmentEntity } from '../expense-accountabilities/expense-accountability.entity';
import { FinanceSettingsService } from '../finance-settings/finance-settings.service';
import { civilToday } from '../finance-settings/finance-settings.policy';
import { isToReimburse } from '../payments-expenses/domain/expense.formulas';
import { ExpenseReimbursementBatchEntity } from '../payments-expenses/infrastructure/persistence/expense-parity.entities';
import { ExpenseEntity } from '../payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import type { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import {
  addDays,
  addMonths,
  amendmentProposal,
  cashFlowKpis,
  cents,
  contractProposal,
  daysBetween,
  type FlowItem,
  incomeTax,
  lastDayOfNextMonth,
  money,
  type ProposedInstallment,
} from './cash-flow.formulas';
import {
  CashFlowAuditLogEntity,
  CashOutflowSettlementEntity,
  ReceivableProposalDecisionEntity,
} from './cash-flow-parity.entities';
import { hash } from './receivable.policy';
import { assertDreMonthsOpen } from './dre-closed-period';
import { CommissionEntity } from '../commissions/commission.entity';
import { AssetTagOrderEntity } from '../asset-tags/asset-tag-order.entity';
import { ReceivableEntity } from './receivable.entity';
import { ReceivableService } from './receivable.service';

const ORIGIN_LABEL: Record<string, string> = {
  contract: 'Contrato',
  amendment: 'Aditivo',
  manual: 'Manual',
  budget: 'Orçamento',
  reimbursement: 'Reembolso',
  to_bill: 'A reembolsar (sem lote faturado)',
  asset_tag: 'Placas de patrimônio (revenda)',
  asset_tag_cost: 'Placas de patrimônio (custo)',
  field_agent_payment: 'Diárias',
  expense: 'Despesas',
  income_tax: 'Imposto de Renda',
  commission: 'Comissões',
};
const br = (civilDate: string) => civilDate.split('-').reverse().join('/');
const civil = (v: Date | string | null | undefined) =>
  v == null
    ? null
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : String(v).slice(0, 10);
/** Decimal do banco (texto no MySQL, número no SQLite) → "0.00". */
const dec = (v: string | number) => {
  const m = /^(-?\d+)(?:\.(\d*))?$/.exec(String(v));
  if (!m) throw new Error(`Valor inválido: ${String(v)}`);
  return `${m[1]}.${(m[2] ?? '').padEnd(2, '0').slice(0, 2)}`;
};

export interface Proposal {
  source_key: string;
  origin: 'contract' | 'amendment' | 'reimbursement';
  source_id: number;
  project_id: number;
  company_id: number;
  currency: string;
  issued_on: string;
  description: string;
  amount: string;
  installments: ProposedInstallment[];
  hash: string;
}

export interface BoardQuery {
  organization_id?: number;
  project_id?: number;
  /** Ano das tabelas (AAAA) ou "all" (todos; os cards seguem o mês de referência). */
  year?: string;
  month?: string;
  /** Data de referência para "em atraso" (padrão: hoje). */
  as_of?: string;
}

/** Saídas acrescentadas ao fluxo depois do cálculo (custos fixos da DRE). */
export type ExtraItems = (
  all: Awaited<ReturnType<CashFlowBoardService['items']>>,
  years: string[],
  org: number,
  today: string,
) => Promise<FlowItem[]>;

type BatchResult = {
  done: number;
  failed: number;
  results: Array<{ key: string; ok: boolean; message?: string }>;
};

/**
 * Fluxo de caixa da paridade (doc 06 §7, etapa 7): entradas (faturamento,
 * reembolsos, placas), saídas (diárias, despesas, IR derivado, comissões,
 * placas), propostas de recebível (D-F), baixas e KPIs, tudo derivado das
 * origens a cada consulta. Indicadores e simulação ficam para a etapa 8.
 */
@Injectable()
export class CashFlowBoardService {
  constructor(
    private readonly ds: DataSource,
    private readonly receivables: ReceivableService,
    private readonly settings: FinanceSettingsService,
    private readonly tags: AssetTagsService,
    private readonly commissions: CommissionsService,
  ) {}

  private paramCache = new Map<string, { tax: string; days: number } | null>();
  private async paramsAt(org: number, date: string) {
    const key = `${org}:${date}`;
    if (!this.paramCache.has(key)) {
      try {
        const v = await this.settings.valuesAt(org, date);
        this.paramCache.set(key, {
          tax: v.income_tax_pct,
          days: v.first_installment_days_after_contract,
        });
      } catch {
        this.paramCache.set(key, null);
      }
    }
    return this.paramCache.get(key)!;
  }

  async board(q: BoardQuery, actor: ProjectActorContext) {
    return (await this.boardWithItems(q, actor)).board;
  }

  /** Quadro e os movimentos completos calculados (reaproveitados pela DRE). */
  async boardWithItems(
    q: BoardQuery,
    actor: ProjectActorContext,
    extra?: ExtraItems,
  ) {
    const org = this.receivables.org(actor, q.organization_id);
    await this.receivables.require(actor, [
      'cash-flow:read',
      'receivables:read',
      'payments:read',
      'expenses:read',
    ]);
    this.paramCache.clear();
    const today = q.as_of ?? civilToday();
    const month = q.month ?? today.slice(0, 7);
    // "all": tabelas de todos os anos; os cards seguem o ano do mês de referência.
    const allYears = q.year === 'all';
    const year = !q.year || allYears ? month.slice(0, 4) : q.year;
    const all = await this.items(org, today);
    const scoped = q.project_id
      ? all.items.filter((i) => i.project_id === q.project_id)
      : [...all.items];
    // Custos fixos (sem projeto): só sem filtro de projeto.
    if (extra && !q.project_id) {
      const next = addMonths(`${month}-01`, 1).slice(0, 4);
      const years = new Set([year, next]);
      if (allYears) for (const i of all.items) years.add(i.date.slice(0, 4));
      scoped.push(...(await extra(all, [...years].sort(), org, today)));
    }
    // Tabelas: o ano escolhido + tudo o que está em aberto e vencido (nunca escondido).
    const visible = scoped
      .filter(
        (i) =>
          allYears ||
          i.date.startsWith(year) ||
          (i.overdue && i.status !== 'realized'),
      )
      .sort(
        (a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key),
      );
    const proposed = scoped.filter(
      (i) => i.status === 'proposed' && i.direction === 'in',
    );
    const board = {
      as_of: today,
      reference: { month, year },
      /** Ano das tabelas: o de referência ou "all". */
      tables_year: allYears ? 'all' : year,
      kpis: cashFlowKpis(scoped, { month, year }),
      alerts: {
        proposed_count: new Set(proposed.map((i) => i.refs.source_key)).size,
        proposed_amount: money(
          proposed.reduce((s, i) => s + cents(i.gross), 0n),
        ),
        missing_parameters_since: all.missingParametersSince,
        missing_tax_count: all.missingTax,
        undated_payments: all.undatedPayments,
        unproposed_contracts: all.unproposedContracts,
      },
      projects: all.projects,
      items: visible,
    };
    return { board, all, org };
  }

  /** Todos os movimentos da organização (sem filtro de período), já classificados. */
  async items(org: number, today: string) {
    const m = this.ds.manager;
    const projects = await m.find(ProjectEntity, {
      where: { organizationId: org },
    });
    const projectName = new Map(projects.map((p) => [Number(p.id), p.name]));
    const contracts = (
      await m.find(ContractEntity, { where: { organizationId: org } })
    ).filter((c) => !['cancelled', 'archived'].includes(c.data.status));
    // Data do contrato (prazo médio de recebimento, etapa 8).
    const contractDate = new Map(
      contracts.map((c) => [Number(c.id), c.data.contracted_on ?? null]),
    );
    const contractValue = new Map(
      contracts.map((c) => [
        Number(c.id),
        c.data.current_value ?? c.data.original_value,
      ]),
    );
    const currencyOf = new Map<number, string>();
    for (const c of contracts)
      if (!currencyOf.has(Number(c.projectId)))
        currencyOf.set(Number(c.projectId), c.data.currency);
    // Saídas usam a moeda do contrato do projeto (padrão BRL), nunca "UNSPECIFIED" (D-K).
    const cur = (projectId: number | null) =>
      (projectId ? currencyOf.get(projectId) : undefined) ?? 'BRL';
    const items: FlowItem[] = [];
    let missingTax = 0;
    let missingParametersSince: string | null = null;
    const noParams = (date: string) => {
      if (!missingParametersSince || date < missingParametersSince)
        missingParametersSince = date;
    };
    const base = (projectId: number | null) => ({
      project_id: projectId,
      project_name: projectId
        ? (projectName.get(projectId) ?? `#${projectId}`)
        : '—',
      currency: cur(projectId),
    });
    const overdue = (status: string, date: string) =>
      (status === 'open' || status === 'proposed') && date < today;
    const push = (
      i: Omit<FlowItem, 'overdue' | 'overdue_days' | 'net' | 'derived'> &
        Partial<Pick<FlowItem, 'net' | 'derived'>>,
    ) => {
      const late = !i.derived && overdue(i.status, i.date);
      items.push({
        ...i,
        net: i.net ?? i.gross,
        derived: i.derived ?? false,
        overdue: late,
        overdue_days: late ? daysBetween(i.date, today) : 0,
      });
    };
    /** IR derivado de uma entrada de faturamento, com o % vigente na data da entrada. */
    const withTax = async (
      inflow: Omit<FlowItem, 'overdue' | 'overdue_days' | 'net' | 'derived'>,
    ) => {
      const p = await this.paramsAt(org, inflow.date);
      if (!p) {
        missingTax++;
        noParams(inflow.date);
        push(inflow);
        return;
      }
      const tax = incomeTax(inflow.gross, p.tax);
      push({ ...inflow, net: money(cents(inflow.gross) - cents(tax)) });
      push({
        ...inflow,
        key: `ir:${inflow.key}`,
        direction: 'out',
        group: 'non_reimbursable',
        origin: 'income_tax',
        origin_label: ORIGIN_LABEL.income_tax,
        gross: tax,
        derived: true,
        installment: null,
        contract_pct: null,
        description: `IR ${p.tax.replace('.', ',')}% sobre ${inflow.description}`,
        refs: { of: inflow.key },
      });
    };

    const expenses = (
      await m.find(ExpenseEntity, { where: { organizationId: org } })
    ).filter(
      (e) => !e.deletedAt && !['cancelled', 'rejected'].includes(e.status),
    );
    const batches = await m.find(ExpenseReimbursementBatchEntity, {
      where: { organizationId: org },
    });
    const expenseLabel = (e: ExpenseEntity) =>
      `${e.reasonCode ?? e.description}${e.projectSequence ? ` (cód. ${e.projectSequence})` : ''}`;
    const detailOf = (list: ExpenseEntity[]) =>
      list
        .map((e) => ({
          date: civil(e.expenseDate)!,
          description: expenseLabel(e),
          amount: dec(e.amount),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    /** Lote de reembolso: data do lote e despesas que o compõem. */
    const batchInfo = (b: ExpenseReimbursementBatchEntity | undefined) =>
      b
        ? {
            reference_on: civil(b.batchDate),
            details: detailOf(
              expenses.filter(
                (e) => Number(e.reimbursementBatchId) === Number(b.id),
              ),
            ),
          }
        : {};
    const batchById = new Map(batches.map((b) => [Number(b.id), b]));
    const batchByReceivable = new Map(
      batches
        .filter((b) => b.receivableId)
        .map((b) => [Number(b.receivableId), b]),
    );

    // ───── Entradas: recebíveis confirmados ─────
    const receivables = await m.find(ReceivableEntity, {
      where: { organizationId: org },
    });
    const sourceKeys = new Set(
      receivables.map((r) => r.sourceKey).filter(Boolean),
    );
    for (const r of receivables) {
      if (r.cancelled) continue;
      const d = await this.receivables.detailFrom(m, r);
      const origin = r.data.origin;
      const group = origin === 'reimbursement' ? 'reimbursement' : 'billing';
      const n = d.installments.length;
      const value = r.contractId
        ? contractValue.get(Number(r.contractId))
        : null;
      const pct = (gross: string) =>
        group === 'billing' && value && cents(dec(value)) > 0n
          ? money(
              (cents(gross) * 10000n * 2n + cents(dec(value))) /
                (2n * cents(dec(value))),
            )
          : null;
      const reversed = new Set(
        d.events.filter((e) => e.reversesId).map((e) => Number(e.reversesId)),
      );
      for (const inst of d.installments) {
        const shared = {
          ...base(r.projectId == null ? null : Number(r.projectId)),
          currency: r.currency,
          direction: 'in' as const,
          group: group as FlowItem['group'],
          origin,
          origin_label: ORIGIN_LABEL[origin] ?? origin,
          expected_on: inst.dueOn,
          installment: {
            number: inst.position + (d.installments[0]?.position === 0 ? 1 : 0),
            of: n,
          },
          description: r.data.description,
          ...(group === 'reimbursement'
            ? batchInfo(batchByReceivable.get(Number(r.id)))
            : {}),
        };
        const make = async (
          item: Omit<FlowItem, 'overdue' | 'overdue_days' | 'net' | 'derived'>,
        ) => (group === 'billing' ? withTax(item) : push(item));
        if (cents(inst.open) > 0n)
          await make({
            ...shared,
            key: `rcv:${r.id}:${inst.id}`,
            date: inst.dueOn,
            realized_on: null,
            status: 'open',
            gross: inst.open,
            contract_pct: pct(inst.open),
            refs: {
              receivable_id: Number(r.id),
              installment_id: Number(inst.id),
              open: inst.open,
            },
          });
        // Recebimento estornado: uma linha só, com status "estornado" (fora dos
        // KPIs; a parcela volta a aparecer em aberto). O evento de estorno não
        // vira linha negativa.
        const reversalOf = new Map(
          d.events
            .filter((x) => x.reversesId)
            .map((x) => [Number(x.reversesId), x.effectiveOn]),
        );
        for (const e of d.events.filter(
          (x) =>
            x.installmentId === inst.id &&
            x.operation === 'receipt' &&
            x.amount &&
            x.effectiveOn,
        )) {
          const wasReversed = reversed.has(Number(e.id));
          await make({
            ...shared,
            key: `rcv-event:${e.id}`,
            date: e.effectiveOn!,
            realized_on: e.effectiveOn,
            status: wasReversed ? 'reversed' : 'realized',
            gross: dec(e.amount!),
            contract_pct: pct(dec(e.amount!)),
            description: r.data.description,
            refs: {
              receivable_id: Number(r.id),
              event_id: wasReversed ? null : Number(e.id),
              reversed_on: wasReversed
                ? (reversalOf.get(Number(e.id)) ?? null)
                : null,
              contracted_on: r.contractId
                ? (contractDate.get(Number(r.contractId)) ?? null)
                : null,
            },
          });
        }
      }
    }

    // ───── Entradas propostas e não confirmadas (D-F) ─────
    const proposals = await this.proposals(org, m, sourceKeys);
    for (const p of proposals.items) {
      const shared = {
        ...base(p.project_id),
        currency: p.currency,
        direction: 'in' as const,
        group: (p.origin === 'reimbursement'
          ? 'reimbursement'
          : 'billing') as FlowItem['group'],
        origin: p.origin,
        origin_label: ORIGIN_LABEL[p.origin],
        realized_on: null,
        status: 'proposed' as const,
        description: `${p.description} (previsto, não confirmado)`,
        ...(p.origin === 'reimbursement'
          ? batchInfo(batchById.get(p.source_id))
          : {}),
      };
      for (const inst of p.installments) {
        const item = {
          ...shared,
          key: `prop:${p.source_key}:${inst.number}`,
          date: inst.due_on,
          expected_on: inst.due_on,
          gross: inst.amount,
          installment: { number: inst.number, of: p.installments.length },
          contract_pct: null,
          refs: { source_key: p.source_key },
        };
        if (p.origin === 'reimbursement') push(item);
        else await withTax(item);
      }
    }

    // ───── Entradas: a reembolsar sem lote faturado (informativo, doc 06 §7.2) ─────
    const batchStatus = new Map(batches.map((b) => [Number(b.id), b.status]));
    const toBill = new Map<
      string,
      {
        projectId: number;
        date: string;
        total: bigint;
        count: number;
        list: ExpenseEntity[];
      }
    >();
    for (const e of expenses) {
      const status = e.reimbursementBatchId
        ? (batchStatus.get(Number(e.reimbursementBatchId)) ?? null)
        : null;
      if (
        !isToReimburse({
          expenseType: e.expenseType,
          status: e.status,
          batchStatus: status,
        })
      )
        continue;
      const date = lastDayOfNextMonth(civil(e.expenseDate)!);
      const key = `${Number(e.projectId)}:${date}`;
      const g = toBill.get(key) ?? {
        projectId: Number(e.projectId),
        date,
        total: 0n,
        count: 0,
        list: [],
      };
      g.total += cents(dec(e.amount));
      g.count++;
      g.list.push(e);
      toBill.set(key, g);
    }
    for (const g of toBill.values())
      push({
        ...base(g.projectId),
        key: `to_bill:${g.projectId}:${g.date}`,
        direction: 'in',
        group: 'reimbursement',
        origin: 'to_bill',
        origin_label: ORIGIN_LABEL.to_bill,
        date: g.date,
        expected_on: g.date,
        realized_on: null,
        status: 'open',
        gross: money(g.total),
        installment: null,
        contract_pct: null,
        description: `${g.count} despesa(s) reembolsável(is) ainda não faturada(s) ao cliente`,
        refs: {},
        reference_on: null,
        details: detailOf(g.list),
      });

    // ───── Saídas: diárias (baixa só em Pagamento de inventariantes) ─────
    let undatedPayments = 0;
    const payments = await m.find(FieldAgentPaymentEntity, {
      where: { organizationId: org },
    });
    for (const p of payments) {
      if (p.deletedAt || p.status === PaymentStatus.CANCELLED) continue;
      const paid = p.status === PaymentStatus.PAID && p.paymentDate;
      const date = paid ? civil(p.paymentDate) : civil(p.expectedPaymentDate);
      if (!date) {
        undatedPayments++;
        continue;
      }
      push({
        ...base(Number(p.projectId)),
        key: `field_agent_payment:${p.id}`,
        direction: 'out',
        group: 'non_reimbursable',
        origin: 'field_agent_payment',
        origin_label: ORIGIN_LABEL.field_agent_payment,
        date,
        expected_on: civil(p.expectedPaymentDate),
        realized_on: paid ? date : null,
        status: paid ? 'realized' : 'open',
        gross: dec(p.finalAmount),
        installment: null,
        contract_pct: null,
        description: `Diárias de ${civil(p.startDate)} a ${civil(p.endDate)}`,
        refs: { payment_id: Number(p.id) },
      });
    }

    // ───── Saídas: despesas (à vista, a prazo por parcela, faturada) ─────
    const installments = expenses.length
      ? await m.find(ExpenseInstallmentEntity, {
          where: {
            organizationId: org,
            expenseId: In(expenses.map((e) => Number(e.id))),
          },
          order: { installmentNumber: 'ASC' },
        })
      : [];
    const settlements = new Map(
      (
        await m.find(CashOutflowSettlementEntity, {
          where: { organizationId: org },
        })
      )
        .filter((s) => s.paidOn)
        .map((s) => [s.sourceKey, civil(s.paidOn)!]),
    );
    for (const e of expenses) {
      const projectId = Number(e.projectId);
      const group =
        e.expenseType === 'reimbursable' ? 'to_reimburse' : 'non_reimbursable';
      const label = expenseLabel(e);
      const paidAt =
        e.status === ExpenseStatus.PAID && e.paidAt ? civil(e.paidAt) : null;
      const shared = {
        ...base(projectId),
        direction: 'out' as const,
        group: group as FlowItem['group'],
        origin: 'expense',
        origin_label: ORIGIN_LABEL.expense,
        contract_pct: null,
        reference_on: civil(e.expenseDate),
      };
      const settleable = (
        key: string,
        expected: string,
        amount: string,
        installment: FlowItem['installment'],
      ) => {
        const paidOn = settlements.get(key) ?? paidAt;
        push({
          ...shared,
          key,
          date: paidOn ?? expected,
          expected_on: expected,
          realized_on: paidOn,
          status: paidOn ? 'realized' : 'open',
          gross: amount,
          installment,
          description: label,
          refs: {
            settle_key: key,
            settled_here: settlements.has(key) ? 1 : 0,
            expense_id: Number(e.id),
          },
        });
      };
      if (e.paymentMethod === 'installments') {
        const own = installments.filter(
          (i) => Number(i.expenseId) === Number(e.id),
        );
        for (const i of own)
          settleable(
            `expense:${e.id}:installment:${i.installmentNumber}`,
            civil(i.dueDate)!,
            dec(i.amount),
            {
              number: Number(i.installmentNumber),
              of: own.length,
            },
          );
      } else if (e.paymentMethod === 'invoiced')
        settleable(
          `expense:${e.id}`,
          civil(e.invoicedPaymentDate) ?? civil(e.expenseDate)!,
          dec(e.amount),
          null,
        );
      else if (e.paymentMethod === 'cash')
        // À vista: paga na data do lançamento (doc 06 §7.3).
        push({
          ...shared,
          key: `expense:${e.id}`,
          date: civil(e.expenseDate)!,
          expected_on: civil(e.expenseDate),
          realized_on: civil(e.expenseDate),
          status: 'realized',
          gross: dec(e.amount),
          installment: null,
          description: label,
          refs: { expense_id: Number(e.id) },
        });
      // Antigas sem forma de pagamento: pagas na baixa; senão previstas na data da despesa.
      else
        settleable(
          `expense:${e.id}`,
          civil(e.expenseDate)!,
          dec(e.amount),
          null,
        );
    }

    // ───── Saídas e entradas de comissões e placas (eventos das etapas 5 e 6) ─────
    for (const ev of await this.commissions.events(org))
      push({
        ...base(ev.project_id),
        key: ev.key,
        direction: 'out',
        group: 'non_reimbursable',
        origin: 'commission',
        origin_label: ORIGIN_LABEL.commission,
        date: ev.date,
        expected_on: ev.realized ? null : ev.date,
        realized_on: ev.realized ? ev.date : null,
        status: ev.realized ? 'realized' : 'open',
        gross: ev.amount,
        installment: null,
        contract_pct: null,
        description: ev.description,
        refs: { settle_key: `commission:${ev.source_id}` },
      });
    for (const ev of await this.tags.events(org))
      push({
        ...base(ev.project_id),
        key: ev.key,
        direction: ev.direction === 'inflow' ? 'in' : 'out',
        group: ev.direction === 'inflow' ? 'other_in' : 'non_reimbursable',
        origin: ev.direction === 'inflow' ? 'asset_tag' : 'asset_tag_cost',
        origin_label:
          ORIGIN_LABEL[
            ev.direction === 'inflow' ? 'asset_tag' : 'asset_tag_cost'
          ],
        date: ev.date,
        expected_on: ev.realized ? null : ev.date,
        realized_on: ev.realized ? ev.date : null,
        status: ev.realized ? 'realized' : 'open',
        gross: ev.amount,
        installment: null,
        contract_pct: null,
        description: ev.description,
        refs:
          ev.direction === 'inflow'
            ? {}
            : { settle_key: `asset_tag_order:${ev.source_id}` },
      });

    return {
      items,
      missingTax,
      missingParametersSince,
      undatedPayments,
      unproposedContracts: proposals.skipped,
      projects: projects
        .map((p) => ({ id: Number(p.id), name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    };
  }

  /** Propostas de recebível (D-F): contrato, aditivo e lote de reembolso faturado sem recebível. */
  async proposals(
    org: number,
    m: EntityManager,
    existing?: Set<string | null>,
  ) {
    const keys =
      existing ??
      new Set(
        (
          await m.find(ReceivableEntity, { where: { organizationId: org } })
        ).map((r) => r.sourceKey),
      );
    const discarded = new Set(
      (
        await m.find(ReceivableProposalDecisionEntity, {
          where: { organizationId: org, decision: 'discarded' },
        })
      ).map((d) => `${d.sourceKey}#${d.proposalHash}`),
    );
    const items: Proposal[] = [];
    const skipped: Array<{ source_key: string; reason: string }> = [];
    const accept = (p: Omit<Proposal, 'hash'>) => {
      const h = hash({ amount: p.amount, installments: p.installments });
      if (!discarded.has(`${p.source_key}#${h}`)) items.push({ ...p, hash: h });
    };
    const contracts = await m.find(ContractEntity, {
      where: { organizationId: org },
    });
    const eligible = contracts.filter((c) =>
      ['active', 'suspended', 'completed'].includes(c.data.status),
    );
    for (const c of eligible) {
      const key = `contract:${c.id}`;
      if (keys.has(key)) continue;
      const value = c.data.original_value;
      if (!value || cents(dec(value)) <= 0n) continue;
      if (!c.data.contracted_on) {
        skipped.push({
          source_key: key,
          reason: `Contrato ${c.number} sem data de assinatura.`,
        });
        continue;
      }
      const params = await this.paramsAt(org, c.data.contracted_on);
      if (!params) {
        skipped.push({
          source_key: key,
          reason: `Contrato ${c.number}: sem parâmetros vigentes em ${br(c.data.contracted_on)}.`,
        });
        continue;
      }
      accept({
        source_key: key,
        origin: 'contract',
        source_id: Number(c.id),
        project_id: Number(c.projectId),
        company_id: Number(c.companyId),
        currency: c.data.currency,
        issued_on: c.data.contracted_on,
        description: `Contrato ${c.number}`,
        amount: dec(value),
        installments: contractProposal({
          value: dec(value),
          contractedOn: c.data.contracted_on,
          firstInstallmentDays: params.days,
          plan: c.data.payment_plan ?? null,
        }),
      });
    }
    const amendments = eligible.length
      ? await m.find(ContractAmendmentEntity, {
          where: {
            organizationId: org,
            contractId: In(eligible.map((c) => Number(c.id))),
          },
        })
      : [];
    for (const a of amendments) {
      const key = `amendment:${a.id}`;
      if (keys.has(key) || !a.valueDelta || cents(dec(a.valueDelta)) <= 0n)
        continue;
      const c = eligible.find((x) => Number(x.id) === Number(a.contractId))!;
      const dated = civil(a.datedOn)!;
      const params = await this.paramsAt(org, dated);
      if (!params) {
        skipped.push({
          source_key: key,
          reason: `Contrato ${c.number} / aditivo ${a.identifier}: sem parâmetros vigentes em ${br(dated)}.`,
        });
        continue;
      }
      accept({
        source_key: key,
        origin: 'amendment',
        source_id: Number(a.id),
        project_id: Number(c.projectId),
        company_id: Number(c.companyId),
        currency: c.data.currency,
        issued_on: dated,
        description: `Contrato ${c.number} / aditivo ${a.identifier}`,
        amount: dec(a.valueDelta),
        installments: amendmentProposal({
          value: dec(a.valueDelta),
          datedOn: dated,
          installments: c.data.amendment_installments?.[a.identifier] ?? 1,
          firstInstallmentDays: params.days,
        }),
      });
    }
    const batches = await m.find(ExpenseReimbursementBatchEntity, {
      where: {
        organizationId: org,
        status: In(['billed', 'received']),
        receivableId: IsNull(),
      },
    });
    for (const b of batches) {
      const key = `reimbursement:${b.id}`;
      if (keys.has(key)) continue;
      const own = await m.find(ExpenseEntity, {
        where: { organizationId: org, reimbursementBatchId: Number(b.id) },
      });
      const total = own
        .filter((e) => !['cancelled', 'rejected'].includes(e.status))
        .reduce((s, e) => s + cents(dec(e.amount)), 0n);
      if (total <= 0n) continue;
      const batchDate = civil(b.batchDate)!;
      const params = b.expectedReceiptOn
        ? null
        : await this.paramsAt(org, batchDate);
      const due =
        civil(b.expectedReceiptOn) ??
        (params ? addDays(batchDate, params.days) : null);
      if (!due) {
        skipped.push({
          source_key: key,
          reason: `Lote ${b.number} sem previsão de recebimento e sem parâmetros.`,
        });
        continue;
      }
      const contract = contracts.find(
        (c) => Number(c.projectId) === Number(b.projectId),
      );
      const project = await m.findOne(ProjectEntity, {
        where: { id: Number(b.projectId), organizationId: org },
      });
      accept({
        source_key: key,
        origin: 'reimbursement',
        source_id: Number(b.id),
        project_id: Number(b.projectId),
        company_id: Number(project?.companyId),
        currency: contract?.data.currency ?? 'BRL',
        issued_on: batchDate,
        description: `Reembolso — lote ${b.number}`,
        amount: money(total),
        installments: [{ number: 1, due_on: due, amount: money(total) }],
      });
    }
    return { items, skipped };
  }

  // ───────────── ações ─────────────

  /** Confirma propostas: cria o recebível com as parcelas propostas (idempotente pela origem). */
  async confirmProposals(
    keys: string[],
    actor: ProjectActorContext,
    organizationId?: number,
  ): Promise<BatchResult> {
    const org = this.receivables.org(actor, organizationId);
    await this.receivables.require(actor, [
      'cash-flow:read',
      'receivables:read',
      'receivables:edit',
    ]);
    this.paramCache.clear();
    const { items } = await this.proposals(org, this.ds.manager);
    return this.each(keys, async (key) => {
      const p = items.find((x) => x.source_key === key);
      if (!p)
        throw new ConflictException({
          message: 'Proposta não encontrada (já confirmada ou descartada).',
        });
      const today = civilToday();
      const issued = [p.issued_on, today, p.installments[0].due_on].sort()[0];
      const dto = {
        organization_id: org,
        company_id: p.company_id,
        project_id: p.project_id,
        origin: p.origin,
        source_id: p.source_id,
        description: p.description,
        amount: p.amount,
        currency: p.currency,
        issued_on: issued,
        reason: 'Confirmação da proposta do fluxo de caixa (D-F)',
        payment: {
          mode: 'amounts',
          count: p.installments.length,
          first_due_on: p.installments[0].due_on,
          amounts: p.installments.map((i) => i.amount),
          dates: p.installments.map((i) => i.due_on),
        },
      };
      const preview = await this.receivables.preview(dto, actor);
      const created = await this.receivables.create(
        {
          ...dto,
          preview_hash: preview.preview_hash,
          command_key: `cf-${randomUUID()}`,
        },
        actor,
      );
      if (p.origin === 'reimbursement')
        await this.ds.manager.update(
          ExpenseReimbursementBatchEntity,
          { id: p.source_id, organizationId: org },
          { receivableId: Number(created.id) },
        );
      await this.audit(org, actor, 'CONFIRM_PROPOSAL', key, {
        receivable_id: Number(created.id),
        hash: p.hash,
      });
    });
  }

  /** Descarta propostas (com justificativa); voltam se a origem mudar (outro hash). */
  async discardProposals(
    keys: string[],
    reason: string,
    actor: ProjectActorContext,
    organizationId?: number,
  ) {
    const org = this.receivables.org(actor, organizationId);
    await this.receivables.require(actor, [
      'cash-flow:read',
      'receivables:read',
      'receivables:edit',
    ]);
    if (reason.trim().length < 5)
      throw new BadRequestException({
        message: 'Justificativa obrigatória (5 caracteres).',
      });
    this.paramCache.clear();
    const { items } = await this.proposals(org, this.ds.manager);
    return this.each(keys, async (key) => {
      const p = items.find((x) => x.source_key === key);
      if (!p)
        throw new ConflictException({ message: 'Proposta não encontrada.' });
      await this.ds.manager.save(ReceivableProposalDecisionEntity, {
        organizationId: org,
        sourceKey: key,
        proposalHash: p.hash,
        decision: 'discarded',
        reason: reason.trim(),
        actorId: actor.id,
      });
      await this.audit(org, actor, 'DISCARD_PROPOSAL', key, {
        reason: reason.trim(),
        hash: p.hash,
      });
    });
  }

  /** Baixa em lote: recebe o saldo de cada parcela na data informada. */
  async receive(
    items: Array<{ receivable_id: number; installment_id: number }>,
    receivedOn: string,
    actor: ProjectActorContext,
  ) {
    await this.receivables.require(actor, [
      'cash-flow:read',
      'receivables:read',
      'receivables:receive',
    ]);
    return this.each(
      items.map((i) => `${i.receivable_id}:${i.installment_id}`),
      async (key) => {
        const [id, installmentId] = key.split(':').map(Number);
        const d = await this.receivables.detail(id, actor);
        const inst = d.installments.find((i) => i.id === installmentId);
        if (!inst || cents(inst.open) <= 0n)
          throw new ConflictException({
            message: 'Parcela sem saldo em aberto.',
          });
        await this.receivables.receive(
          id,
          {
            revision: d.revision,
            command_key: `cf-${randomUUID()}`,
            reason: 'Baixa em lote no fluxo de caixa',
            installment_id: installmentId,
            amount: inst.open,
            received_on: receivedOn,
            method: 'Baixa no fluxo de caixa',
            reference: `fluxo-${randomUUID()}`,
          },
          actor,
        );
      },
    );
  }

  /** Desfazer recebimento = estorno (com data de hoje). */
  async undoReceipts(
    items: Array<{ receivable_id: number; event_id: number }>,
    actor: ProjectActorContext,
  ) {
    await this.receivables.require(actor, [
      'cash-flow:read',
      'receivables:read',
      'receivables:reverse',
    ]);
    return this.each(
      items.map((i) => `${i.receivable_id}:${i.event_id}`),
      async (key) => {
        const [id, eventId] = key.split(':').map(Number);
        const d = await this.receivables.detail(id, actor);
        await this.receivables.reverse(
          id,
          eventId,
          {
            revision: d.revision,
            command_key: `cf-${randomUUID()}`,
            reason: 'Desfeito no fluxo de caixa',
            reversed_on: civilToday(),
          },
          actor,
        );
      },
    );
  }

  /**
   * Alterar a data de recebimento: estorno + novo recebimento na nova data, na
   * mesma transação de cada recebível (exige receber e estornar).
   */
  async redateReceipts(
    items: Array<{ receivable_id: number; event_id: number }>,
    receivedOn: string,
    reason: string,
    actor: ProjectActorContext,
  ) {
    await this.receivables.require(actor, [
      'cash-flow:read',
      'receivables:read',
      'receivables:receive',
      'receivables:reverse',
    ]);
    assertNotFuture(receivedOn, 'A data de recebimento');
    return this.each(
      items.map((i) => `${i.receivable_id}:${i.event_id}`),
      async (key) => {
        const [id, eventId] = key.split(':').map(Number);
        const d = await this.receivables.detail(id, actor);
        await this.receivables.redateReceipt(
          id,
          eventId,
          {
            revision: d.revision,
            command_key: `cf-${randomUUID()}`,
            reason,
            received_on: receivedOn,
          },
          actor,
        );
      },
    );
  }

  /** Reprogramar a data prevista de parcelas (evento auditado em cada recebível). */
  async reschedule(
    items: Array<{ receivable_id: number; installment_id: number }>,
    dueOn: string,
    reason: string,
    actor: ProjectActorContext,
  ) {
    await this.receivables.require(actor, [
      'cash-flow:read',
      'receivables:read',
      'receivables:reschedule',
    ]);
    return this.each(
      items.map((i) => `${i.receivable_id}:${i.installment_id}`),
      async (key) => {
        const [id, installmentId] = key.split(':').map(Number);
        const d = await this.receivables.detail(id, actor);
        await this.receivables.reschedule(
          id,
          {
            revision: d.revision,
            command_key: `cf-${randomUUID()}`,
            reason,
            installment_id: installmentId,
            due_on: dueOn,
          },
          actor,
        );
      },
    );
  }

  /**
   * Baixa de saídas no fluxo: despesas (pela identidade da despesa/parcela),
   * comissões e placas (gravam a data de pagamento na própria origem).
   * Diárias têm baixa só em Pagamento de inventariantes.
   */
  async settle(
    keys: string[],
    paidOn: string | null,
    actor: ProjectActorContext,
    organizationId?: number,
  ) {
    const org = this.receivables.org(actor, organizationId);
    await this.receivables.require(actor, ['cash-flow:read']);
    assertNotFuture(paidOn, 'A data de pagamento');
    return this.each(keys, async (key) => {
      const [kind, rawId] = key.split(':');
      const id = Number(rawId);
      if (kind === 'commission') {
        await this.receivables.require(actor, ['commissions:edit']);
        const row = await this.ds.manager.findOne(CommissionEntity, {
          where: { id, organizationId: org },
        });
        await this.assertRepayOpen(org, row?.paidOn, paidOn);
        await this.commissions.update(id, { paid_on: paidOn }, actor);
      } else if (kind === 'asset_tag_order') {
        await this.receivables.require(actor, ['asset-tag-orders:edit']);
        const row = await this.ds.manager.findOne(AssetTagOrderEntity, {
          where: { id, organizationId: org },
        });
        await this.assertRepayOpen(org, row?.supplierPaidOn, paidOn);
        await this.tags.update(
          id,
          paidOn ? { supplier_paid_on: paidOn } : { supplier_paid: false },
          actor,
        );
      } else if (kind === 'expense') {
        await this.receivables.require(actor, ['expenses:mark-as-paid']);
        const expense = await this.ds.manager.findOne(ExpenseEntity, {
          where: { id, organizationId: org },
        });
        if (
          !expense ||
          expense.deletedAt ||
          ['cancelled', 'rejected'].includes(expense.status)
        )
          throw new ConflictException({ message: 'Despesa não encontrada.' });
        const parts = key.split(':');
        const valid =
          (parts.length === 2 &&
            expense.paymentMethod !== 'cash' &&
            expense.paymentMethod !== 'installments') ||
          (parts.length === 4 &&
            parts[2] === 'installment' &&
            expense.paymentMethod === 'installments');
        if (!valid)
          throw new ConflictException({
            message: 'Esta saída não tem baixa no fluxo.',
          });
        const repo = this.ds.manager.getRepository(CashOutflowSettlementEntity);
        const current = await repo.findOne({
          where: { organizationId: org, sourceKey: key },
        });
        const before = current?.paidOn ? civil(current.paidOn) : null;
        if (!paidOn && !before)
          throw new ConflictException({
            message: 'Saída sem baixa feita no fluxo.',
          });
        await this.assertRepayOpen(org, before, paidOn);
        await repo.save(
          current
            ? Object.assign(current, { paidOn, updatedById: actor.id })
            : repo.create({
                organizationId: org,
                projectId: Number(expense.projectId),
                sourceKey: key,
                paidOn,
                updatedById: actor.id,
              }),
        );
        await this.audit(
          org,
          actor,
          paidOn ? 'SETTLE_OUTFLOW' : 'UNDO_OUTFLOW',
          key,
          { paid_on: { before, after: paidOn } },
        );
      } else
        throw new ConflictException({
          message: 'Esta saída não tem baixa no fluxo.',
        });
    });
  }

  /**
   * Alterar a data de pagamento (já pago → nova data): recusado se a data
   * original ou a nova cair em competência fechada da DRE.
   */
  private async assertRepayOpen(
    org: number,
    before: string | Date | null | undefined,
    paidOn: string | null,
  ) {
    const original = before ? civil(before) : null;
    if (!original || !paidOn || original === paidOn) return;
    await assertDreMonthsOpen(
      this.ds.manager,
      org,
      [original, paidOn],
      'Não é possível alterar a data de pagamento',
    );
  }

  private async audit(
    org: number,
    actor: ProjectActorContext,
    operation: string,
    key: string,
    changes: Record<string, unknown>,
  ) {
    await this.ds.manager.save(CashFlowAuditLogEntity, {
      organizationId: org,
      operation,
      targetKey: key,
      changes,
      performedBy: actor.id,
    });
  }

  private async each(
    keys: string[],
    run: (key: string) => Promise<unknown>,
  ): Promise<BatchResult> {
    const unique = [...new Set(keys)];
    if (!unique.length || unique.length > 200)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Selecione de 1 a 200 itens.',
      });
    const results: BatchResult['results'] = [];
    for (const key of unique) {
      try {
        await run(key);
        results.push({ key, ok: true });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        const body = error.getResponse() as { message?: string } | string;
        results.push({
          key,
          ok: false,
          message:
            typeof body === 'string' ? body : (body.message ?? error.message),
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
