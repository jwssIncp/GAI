import { ExpenseStatus } from '../payments-expenses/domain/enums/expense-status.enum';
import { PaymentStatus } from '../payments-expenses/domain/enums/payment-status.enum';
import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { ExpenseEntity } from '../payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { ExpenseInstallmentEntity } from '../expense-accountabilities/expense-accountability.entity';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { FinanceFilterDto } from './receivable.dto';
import { ReceivableService } from './receivable.service';
import { decimal, invalid, scaled, signed } from './receivable.policy';
export interface CashMovement {
  source: string;
  source_id: number;
  receivable_id: number | null;
  installment_id: number | null;
  company_id: number;
  project_id: number | null;
  contract_id: number | null;
  currency: string;
  direction: 'in' | 'out';
  view: 'expected' | 'actual';
  on: string;
  amount: string;
  description: string;
  status: string;
  overdue: boolean;
}
function date(value: Date | string) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}
export function aggregateCash(rows: CashMovement[]) {
  type Bucket = {
    currency: string;
    expected_in: bigint;
    expected_out: bigint;
    actual_in: bigint;
    actual_out: bigint;
    overdue: bigint;
  };
  const totals = new Map<string, Bucket>(),
    monthly = new Map<string, Bucket & { month: string }>(),
    clients = new Map<string, Bucket & { company_id: number }>(),
    projects = new Map<string, Bucket & { project_id: number | null }>();
  const zero = (currency: string): Bucket => ({
    currency,
    expected_in: 0n,
    expected_out: 0n,
    actual_in: 0n,
    actual_out: 0n,
    overdue: 0n,
  });
  for (const r of rows) {
    const a = totals.get(r.currency) ?? zero(r.currency);
    totals.set(r.currency, a);
    const mk = r.on.slice(0, 7) + ':' + r.currency,
      m = monthly.get(mk) ?? { ...zero(r.currency), month: r.on.slice(0, 7) };
    monthly.set(mk, m);
    const ck = r.company_id + ':' + r.currency,
      c = clients.get(ck) ?? { ...zero(r.currency), company_id: r.company_id };
    clients.set(ck, c);
    const pk = r.project_id + ':' + r.currency,
      p = projects.get(pk) ?? { ...zero(r.currency), project_id: r.project_id };
    projects.set(pk, p);
    const key: 'expected_in' | 'expected_out' | 'actual_in' | 'actual_out' =
      `${r.view}_${r.direction}`;
    for (const b of [a, m, c, p]) {
      b[key] += signed(r.amount);
      if (r.view === 'expected' && r.direction === 'in' && r.overdue)
        b.overdue += scaled(r.amount);
    }
  }
  const serialize = <T extends Bucket>(b: T) => ({
    ...b,
    expected_in: decimal(b.expected_in),
    expected_out: decimal(b.expected_out),
    actual_in: decimal(b.actual_in),
    actual_out: decimal(b.actual_out),
    overdue: decimal(b.overdue),
    actual_net: decimal(b.actual_in - b.actual_out),
    projected_net: decimal(
      b.actual_in - b.actual_out + b.expected_in - b.expected_out,
    ),
  });
  return {
    totals: [...totals.values()].map(serialize),
    monthly: [...monthly.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(serialize),
    by_client: [...clients.values()].map(serialize),
    by_project: [...projects.values()].map(serialize),
  };
}
@Injectable()
export class CashFlowService {
  constructor(private readonly receivables: ReceivableService) {}
  async report(f: FinanceFilterDto, actor: ProjectActorContext) {
    return this.receivables.ds.transaction('REPEATABLE READ', (m) =>
      this.from(m, f, actor),
    );
  }
  async from(
    m: EntityManager,
    f: FinanceFilterDto,
    actor: ProjectActorContext,
  ) {
    const org = await this.receivables.filterReferences(m, f, actor),
      rows: CashMovement[] = [];
    const incoming = f.direction !== 'out',
      outgoing = f.direction !== 'in';
    const required = [
      'cash-flow:read',
      ...(incoming ? ['receivables:read'] : []),
      ...(outgoing
        ? ['payments:read', 'expenses:read', 'expense-installments:read']
        : []),
    ];
    await this.receivables.require(actor, required);
    if (incoming)
      for (const r of await this.receivables.cohort(m, f, actor)) {
        const d = await this.receivables.detailFrom(m, r);
        if (
          f.status &&
          (f.status === 'overdue' ? !d.overdue : d.status !== f.status)
        )
          continue;
        const base = {
          company_id: r.companyId,
          project_id: r.projectId,
          contract_id: r.contractId,
          currency: r.currency,
          direction: 'in' as const,
          receivable_id: r.id,
          description: r.data.description,
          status: d.status,
        };
        if (!r.cancelled)
          for (const i of d.installments)
            if (scaled(i.open) > 0n)
              rows.push({
                ...base,
                source: 'receivable_installment',
                source_id: i.id,
                installment_id: i.id,
                view: 'expected',
                on: i.dueOn,
                amount: i.open,
                overdue: i.overdue,
              });
        for (const e of d.events)
          if (e.amount && e.effectiveOn)
            rows.push({
              ...base,
              source: 'receivable_event',
              source_id: e.id,
              installment_id: e.installmentId,
              view: 'actual',
              on: e.effectiveOn,
              amount: e.amount,
              overdue: false,
            });
      }
    const limitations = [
      'Fluxo parcial de movimentos conhecidos; não representa saldo bancário nem DRE.',
      'Moeda das saídas legadas não informada: valores separados em UNSPECIFIED, sem conversão ou compensação com BRL/USD/EUR.',
      'Despesas registradas sem vencimento não entram no previsto; prestações de contas não são somadas novamente.',
      'Parcelas de despesas não têm baixa individual: a baixa integral da despesa remove sua agenda prevista.',
    ];
    let undatedExpenses = 0,
      undatedPayments = 0;
    if (outgoing) {
      const projects = await m.find(ProjectEntity, {
        where: {
          organizationId: org,
          ...(f.project_id ? { id: f.project_id } : {}),
          ...(f.company_id ? { companyId: f.company_id } : {}),
        },
        take: 10001,
      });
      if (projects.length > 10000)
        invalid('Refine a organização: limite de projetos excedido.');
      const pm = new Map(projects.map((p) => [Number(p.id), p]));
      const match = (projectId: number) => {
        const p = pm.get(Number(projectId));
        return p &&
          (!f.project_id || Number(p.id) === f.project_id) &&
          (!f.company_id || Number(p.companyId) === f.company_id)
          ? p
          : undefined;
      };
      // Legacy outflows have no contract link. A contract filter cannot infer it.
      if (f.contract_id)
        limitations.push(
          'Saídas não possuem vínculo contratual; excluídas no filtro por contrato.',
        );
      const expenses = await m.find(ExpenseEntity, {
        where: {
          organizationId: org,
          projectId: In(projects.map((p) => Number(p.id))),
        },
        take: 10001,
      });
      const payments = await m.find(FieldAgentPaymentEntity, {
        where: {
          organizationId: org,
          projectId: In(projects.map((p) => Number(p.id))),
        },
        take: 10001,
      });
      const installments = await m.find(ExpenseInstallmentEntity, {
        where: {
          organizationId: org,
          projectId: In(projects.map((p) => Number(p.id))),
        },
        take: 50001,
      });
      if (
        expenses.length > 10000 ||
        payments.length > 10000 ||
        installments.length > 50000
      )
        invalid('Limite de fontes de saída excedido. Refine o escopo.');
      const today = new Date().toISOString().slice(0, 10);
      for (const e of expenses) {
        const p = match(e.projectId);
        if (!p || f.contract_id) continue;
        const status = e.status === ExpenseStatus.PAID ? 'paid' : 'open';
        if (f.status && f.status !== 'overdue' && f.status !== status) continue;
        const base = {
          company_id: Number(p.companyId),
          project_id: Number(p.id),
          contract_id: null,
          currency: 'UNSPECIFIED',
          direction: 'out' as const,
          receivable_id: null,
          installment_id: null,
          description: e.description,
          status,
        };
        if (e.status === ExpenseStatus.PAID && e.paidAt)
          rows.push({
            ...base,
            source: 'expense',
            source_id: Number(e.id),
            view: 'actual',
            on: date(e.paidAt),
            amount: e.amount,
            overdue: false,
          });
        else if (e.status === ExpenseStatus.APPROVED) {
          const parts = installments.filter(
            (i) => Number(i.expenseId) === Number(e.id),
          );
          if (!parts.length) undatedExpenses++;
          // Do not trust an inconsistent allocation as an additional obligation.
          else if (
            parts.reduce((s, i) => s + scaled(i.amount), 0n) !==
            scaled(e.amount)
          )
            limitations.push(
              `Despesa ${e.id}: parcelas divergentes excluídas da previsão.`,
            );
          else
            for (const i of parts)
              rows.push({
                ...base,
                source: 'expense_installment',
                source_id: Number(i.id),
                view: 'expected',
                on: date(i.dueDate),
                amount: i.amount,
                overdue: date(i.dueDate) < today,
              });
        }
      }
      for (const pmt of payments) {
        const p = match(pmt.projectId);
        if (!p || f.contract_id) continue;
        const status = pmt.status === PaymentStatus.PAID ? 'paid' : 'open';
        if (f.status && f.status !== 'overdue' && f.status !== status) continue;
        const base = {
          company_id: Number(p.companyId),
          project_id: Number(p.id),
          contract_id: null,
          currency: 'UNSPECIFIED',
          direction: 'out' as const,
          receivable_id: null,
          installment_id: null,
          description: `Pagamento de inventariante #${pmt.id}`,
          status,
          source: 'field_agent_payment',
          source_id: Number(pmt.id),
          amount: pmt.finalAmount,
        };
        if (pmt.status === PaymentStatus.PAID && pmt.paymentDate)
          rows.push({
            ...base,
            view: 'actual',
            on: date(pmt.paymentDate),
            overdue: false,
          });
        else if (pmt.status === PaymentStatus.APPROVED) {
          if (pmt.paymentDate)
            rows.push({
              ...base,
              view: 'expected',
              on: date(pmt.paymentDate),
              overdue: date(pmt.paymentDate) < today,
            });
          else undatedPayments++;
        }
      }
    }
    if (rows.length > 50000)
      invalid('Refine os filtros: limite de 50.000 movimentos.');
    const filtered = rows.filter(
      (r) =>
        (!f.date_from || r.on >= f.date_from) &&
        (!f.date_to || r.on <= f.date_to) &&
        (!f.view || f.view === 'all' || r.view === f.view) &&
        (f.status !== 'overdue' || r.overdue),
    );
    filtered.sort(
      (a, b) =>
        a.on.localeCompare(b.on) ||
        a.source.localeCompare(b.source) ||
        a.source_id - b.source_id,
    );
    return {
      filters: f,
      as_of: new Date().toISOString(),
      complete: false,
      limitations: [...new Set(limitations)],
      undated_expenses: undatedExpenses,
      undated_payments: undatedPayments,
      definitions: {
        period:
          'Limites inclusivos: previsto por vencimento, realizado por data efetiva; estornos negativos na data do estorno.',
        overdue:
          'Saldo positivo com vencimento anterior ao dia UTC atual; cancelados excluídos.',
        projected_net:
          'Entradas realizadas - saídas realizadas + entradas abertas previstas - saídas abertas previstas; por moeda, sem saldo inicial.',
        status:
          'Status do recebível no momento da consulta; nas saídas, paid ou open.',
      },
      ...aggregateCash(filtered),
      movements: filtered,
    };
  }
}
