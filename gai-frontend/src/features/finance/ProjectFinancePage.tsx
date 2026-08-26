import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, CreditCard, Eye, FileText, Pencil, Plus, Receipt, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { MetricCard } from '@/components/base/Cards';
import { DataTable, type Column } from '@/components/base/DataTable';
import { DateInput } from '@/components/base/Inputs';
import { FilterPanel } from '@/components/base/FilterPanel';
import { FormField } from '@/components/base/FormField';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { SearchInput } from '@/components/base/SearchInput';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DrawerForm, ModalForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { usePermissions } from '@/features/auth/usePermissions';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';
import { ExpenseAttachmentsPanel } from './ExpenseAttachmentsPanel';
import { ExpenseForm } from './ExpenseForm';
import {
  expenseStatusLabels,
  expenseStatuses,
  paidDateSchema,
  paymentStatusLabels,
  paymentStatuses,
  rejectExpenseSchema,
  type PaidDateValues,
  type RejectExpenseValues,
} from './financeSchemas';
import {
  useCreateExpense,
  useCreatePayment,
  useExpenseAction,
  useExpenses,
  useFinanceFieldAgents,
  usePaymentAction,
  usePayments,
  usePaymentSummary,
  useUpdateExpense,
  useUpdatePayment,
} from './financeQueries';
import { PaymentForm } from './PaymentForm';
import type { Expense, ExpenseStatus, FieldAgent, FieldAgentPayment, PaymentStatus } from '@/types/api';

type Tab = 'payments' | 'expenses';

export function ProjectFinancePage() {
  const projectId = Number(useParams().projectId);
  const [tab, setTab] = useState<Tab>('payments');
  const fieldAgents = useFinanceFieldAgents();
  const agents = fieldAgents.data?.items ?? [];

  return (
    <PageContainer>
      <PageHeader title="Financeiro do projeto" description={`Projeto #${projectId}. Pagamentos de inventariantes, despesas e comprovantes.`} />
      <div className="flex flex-wrap gap-2 border-b pb-3 text-sm">
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/summary`}>Resumo</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/inventory-items`}>Itens inventariados</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/pending-issues`}>Pendencias</Link>
        <span className="text-muted-foreground">/ Financeiro</span>
        <PermissionGate permissions={['expense-accountabilities:read']}><Link className="text-primary hover:underline" to={`/app/projects/${projectId}/finance/accountabilities`}>Prestacao de contas</Link></PermissionGate>
      </div>
      <PaymentSummaryCards projectId={projectId} />
      <div className="flex w-fit gap-1 rounded-xl border border-border/70 bg-muted/45 p-1.5 shadow-inner" role="group" aria-label="Visões financeiras">
        <button type="button" aria-pressed={tab === 'payments'} className={tabClass(tab === 'payments')} onClick={() => setTab('payments')}>Pagamentos</button>
        <button type="button" aria-pressed={tab === 'expenses'} className={tabClass(tab === 'expenses')} onClick={() => setTab('expenses')}>Despesas</button>
      </div>
      {tab === 'payments' ? <PaymentsTab projectId={projectId} fieldAgents={agents} /> : <ExpensesTab projectId={projectId} fieldAgents={agents} />}
    </PageContainer>
  );
}

function tabClass(active: boolean) {
  return cn('inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold transition', active ? 'bg-card text-primary shadow-panel' : 'text-muted-foreground hover:bg-card/50 hover:text-foreground');
}

function PaymentSummaryCards({ projectId }: { projectId: number }) {
  const summary = usePaymentSummary(projectId);
  if (summary.isLoading) return <LoadingState label="Carregando resumo financeiro" />;
  if (summary.isError) return <ErrorState message={(summary.error as Error).message} onRetry={() => summary.refetch()} />;
  const data = summary.data;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Pendentes" value={formatMoney(data?.total_pending)} icon={<Receipt size={18} />} />
      <MetricCard label="Aprovados" value={formatMoney(data?.total_approved)} icon={<CheckCircle2 size={18} />} />
      <MetricCard label="Pagos" value={formatMoney(data?.total_paid)} icon={<CreditCard size={18} />} />
      <MetricCard label="Cancelados" value={formatMoney(data?.total_cancelled)} icon={<XCircle size={18} />} />
      <MetricCard label="Registros" value={data?.total_count ?? 0} icon={<FileText size={18} />} />
    </div>
  );
}

function PaymentsTab({ projectId, fieldAgents }: { projectId: number; fieldAgents: FieldAgent[] }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [fieldAgentId, setFieldAgentId] = useState('');
  const [state, setState] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FieldAgentPayment | null>(null);
  const [viewing, setViewing] = useState<FieldAgentPayment | null>(null);
  const [approving, setApproving] = useState<FieldAgentPayment | null>(null);
  const [paying, setPaying] = useState<FieldAgentPayment | null>(null);
  const [canceling, setCanceling] = useState<FieldAgentPayment | null>(null);
  const { hasPermission } = usePermissions();
  const params = useMemo(() => ({
    page,
    page_size: 20,
    search: search || undefined,
    status: status || undefined,
    field_agent_id: fieldAgentId ? Number(fieldAgentId) : undefined,
    state: state || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    payment_date: paymentDate || undefined,
  }), [endDate, fieldAgentId, page, paymentDate, search, startDate, state, status]);
  const query = usePayments(projectId, params);
  const create = useCreatePayment(projectId);
  const update = useUpdatePayment(projectId);
  const approve = usePaymentAction(projectId, 'approve');
  const markPaid = usePaymentAction(projectId, 'mark-as-paid');
  const cancel = usePaymentAction(projectId, 'cancel');
  const data = query.data ? normalizePage(query.data) : null;
  const columns: Column<FieldAgentPayment>[] = [
    { header: 'Inventariante', cell: (payment) => <div className="font-medium">#{payment.field_agent_id}<div className="text-xs text-muted-foreground">Pagamento #{payment.id}</div></div> },
    { header: 'Periodo', cell: (payment) => `${formatDate(payment.start_date)} - ${formatDate(payment.end_date)}` },
    { header: 'Dias', cell: (payment) => payment.days },
    { header: 'Diaria', cell: (payment) => formatMoney(payment.daily_rate) },
    { header: 'Total', cell: (payment) => <span className="font-medium">{formatMoney(payment.final_amount)}</span> },
    { header: 'Status', cell: (payment) => <StatusBadge value={payment.status} /> },
    { header: 'Pago em', cell: (payment) => formatDate(payment.payment_date) },
    { header: 'Acoes', cell: (payment) => (
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" aria-label="Visualizar pagamento" onClick={() => setViewing(payment)}><Eye size={16} /></Button>
        <PermissionGate permissions={['payments:update']}><Button type="button" variant="ghost" aria-label="Editar pagamento" disabled={payment.status === 'paid' || payment.status === 'cancelled'} onClick={() => setEditing(payment)}><Pencil size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['payments:approve']}><Button type="button" variant="ghost" aria-label="Aprovar pagamento" disabled={payment.status !== 'pending'} onClick={() => setApproving(payment)}><CheckCircle2 size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['payments:mark-as-paid']}><Button type="button" variant="ghost" aria-label="Marcar pagamento como pago" disabled={payment.status !== 'approved'} onClick={() => setPaying(payment)}><CreditCard size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['payments:cancel']}><Button type="button" variant="ghost" aria-label="Cancelar pagamento" disabled={payment.status === 'paid' || payment.status === 'cancelled'} onClick={() => setCanceling(payment)}><XCircle size={16} /></Button></PermissionGate>
      </div>
    ) },
  ];

  return (
    <>
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar pagamento" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value as PaymentStatus | ''); setPage(1); }} aria-label="Filtrar pagamento por status">
          <option value="">Todos status</option>
          {paymentStatuses.map((item) => <option key={item} value={item}>{paymentStatusLabels[item]}</option>)}
        </select>
        <AgentSelect value={fieldAgentId} onChange={(value) => { setFieldAgentId(value); setPage(1); }} agents={fieldAgents} />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={state} onChange={(event) => { setState(event.target.value); setPage(1); }} placeholder="UF/Estado" />
        <DateInput aria-label="Inicio do pagamento" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} />
        <DateInput aria-label="Fim do pagamento" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} />
        <DateInput aria-label="Data de pagamento" value={paymentDate} onChange={(event) => { setPaymentDate(event.target.value); setPage(1); }} />
      </FilterPanel>
      {hasPermission('payments:create') ? <div className="flex justify-end"><Button type="button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Novo pagamento</Button></div> : null}
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : data ? (
        <>
          <DataTable columns={columns} items={data.items} getKey={(payment) => payment.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
      <DrawerForm open={createOpen} onOpenChange={setCreateOpen} title="Novo pagamento">
        <PaymentForm fieldAgents={fieldAgents} busy={create.isPending} onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} />
      </DrawerForm>
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar pagamento">
        {editing ? <PaymentForm initial={editing} fieldAgents={fieldAgents} busy={update.isPending} onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} /> : null}
      </DrawerForm>
      <PaymentDetailDrawer payment={viewing} onOpenChange={(open) => !open && setViewing(null)} />
      <ConfirmDialog open={Boolean(approving)} onOpenChange={(open) => !open && setApproving(null)} title="Aprovar pagamento" description={`Aprovar pagamento #${approving?.id ?? ''}?`} onConfirm={() => approving && approve.mutate({ id: approving.id }, { onSuccess: () => setApproving(null) })} />
      <MarkPaymentPaidModal payment={paying} busy={markPaid.isPending} onOpenChange={(open) => !open && setPaying(null)} onSubmit={(payload) => paying && markPaid.mutate({ id: paying.id, payload }, { onSuccess: () => setPaying(null) })} />
      <ConfirmDialog open={Boolean(canceling)} onOpenChange={(open) => !open && setCanceling(null)} title="Cancelar pagamento" description={`Cancelar pagamento #${canceling?.id ?? ''}?`} onConfirm={() => canceling && cancel.mutate({ id: canceling.id }, { onSuccess: () => setCanceling(null) })} />
    </>
  );
}

function ExpensesTab({ projectId, fieldAgents }: { projectId: number; fieldAgents: FieldAgent[] }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ExpenseStatus | ''>('');
  const [fieldAgentId, setFieldAgentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [attachments, setAttachments] = useState<Expense | null>(null);
  const [approving, setApproving] = useState<Expense | null>(null);
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const [paying, setPaying] = useState<Expense | null>(null);
  const [canceling, setCanceling] = useState<Expense | null>(null);
  const { hasPermission } = usePermissions();
  const params = useMemo(() => ({
    page,
    page_size: 20,
    search: search || undefined,
    status: status || undefined,
    field_agent_id: fieldAgentId ? Number(fieldAgentId) : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  }), [endDate, fieldAgentId, page, search, startDate, status]);
  const query = useExpenses(projectId, params);
  const create = useCreateExpense(projectId);
  const update = useUpdateExpense(projectId);
  const approve = useExpenseAction(projectId, 'approve');
  const reject = useExpenseAction(projectId, 'reject');
  const markPaid = useExpenseAction(projectId, 'mark-as-paid');
  const cancel = useExpenseAction(projectId, 'cancel');
  const data = query.data ? normalizePage(query.data) : null;
  const columns: Column<Expense>[] = [
    { header: 'Despesa', cell: (expense) => <div className="font-medium">{expense.description}<div className="text-xs text-muted-foreground">#{expense.id}</div></div> },
    { header: 'Data', cell: (expense) => formatDate(expense.expense_date) },
    { header: 'Inventariante', cell: (expense) => expense.field_agent_id ? `#${expense.field_agent_id}` : '-' },
    { header: 'Valor', cell: (expense) => <span className="font-medium">{formatMoney(expense.amount)}</span> },
    { header: 'Status', cell: (expense) => <StatusBadge value={expense.status} /> },
    { header: 'Atualizada em', cell: (expense) => formatDateTime(expense.updated_at) },
    { header: 'Acoes', cell: (expense) => (
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" aria-label="Visualizar despesa" onClick={() => setViewing(expense)}><Eye size={16} /></Button>
        <Button type="button" variant="ghost" aria-label="Comprovantes da despesa" onClick={() => setAttachments(expense)}><Receipt size={16} /></Button>
        <PermissionGate permissions={['expenses:update']}><Button type="button" variant="ghost" aria-label="Editar despesa" disabled={expense.status === 'paid' || expense.status === 'cancelled'} onClick={() => setEditing(expense)}><Pencil size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['expenses:approve']}><Button type="button" variant="ghost" aria-label="Aprovar despesa" disabled={expense.status !== 'pending'} onClick={() => setApproving(expense)}><CheckCircle2 size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['expenses:reject']}><Button type="button" variant="ghost" aria-label="Rejeitar despesa" disabled={expense.status !== 'pending'} onClick={() => setRejecting(expense)}><XCircle size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['expenses:mark-as-paid']}><Button type="button" variant="ghost" aria-label="Marcar despesa como paga" disabled={expense.status !== 'approved'} onClick={() => setPaying(expense)}><CreditCard size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['expenses:cancel']}><Button type="button" variant="ghost" aria-label="Cancelar despesa" disabled={expense.status === 'paid' || expense.status === 'cancelled'} onClick={() => setCanceling(expense)}><XCircle size={16} /></Button></PermissionGate>
      </div>
    ) },
  ];

  return (
    <>
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar despesa" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value as ExpenseStatus | ''); setPage(1); }} aria-label="Filtrar despesa por status">
          <option value="">Todos status</option>
          {expenseStatuses.map((item) => <option key={item} value={item}>{expenseStatusLabels[item]}</option>)}
        </select>
        <AgentSelect value={fieldAgentId} onChange={(value) => { setFieldAgentId(value); setPage(1); }} agents={fieldAgents} />
        <DateInput aria-label="Inicio da despesa" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} />
        <DateInput aria-label="Fim da despesa" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} />
      </FilterPanel>
      {hasPermission('expenses:create') ? <div className="flex justify-end"><Button type="button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Nova despesa</Button></div> : null}
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : data ? (
        <>
          <DataTable columns={columns} items={data.items} getKey={(expense) => expense.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
      <DrawerForm open={createOpen} onOpenChange={setCreateOpen} title="Nova despesa">
        <ExpenseForm fieldAgents={fieldAgents} busy={create.isPending} onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} />
      </DrawerForm>
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar despesa">
        {editing ? <ExpenseForm initial={editing} fieldAgents={fieldAgents} busy={update.isPending} onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} /> : null}
      </DrawerForm>
      <ExpenseDetailDrawer expense={viewing} onOpenChange={(open) => !open && setViewing(null)} />
      <DrawerForm open={Boolean(attachments)} onOpenChange={(open) => !open && setAttachments(null)} title="Comprovantes da despesa">
        {attachments ? <ExpenseAttachmentsPanel projectId={projectId} expense={attachments} /> : null}
      </DrawerForm>
      <ConfirmDialog open={Boolean(approving)} onOpenChange={(open) => !open && setApproving(null)} title="Aprovar despesa" description={`Aprovar despesa #${approving?.id ?? ''}?`} onConfirm={() => approving && approve.mutate({ id: approving.id }, { onSuccess: () => setApproving(null) })} />
      <RejectExpenseModal expense={rejecting} busy={reject.isPending} onOpenChange={(open) => !open && setRejecting(null)} onSubmit={(payload) => rejecting && reject.mutate({ id: rejecting.id, payload }, { onSuccess: () => setRejecting(null) })} />
      <ConfirmDialog open={Boolean(paying)} onOpenChange={(open) => !open && setPaying(null)} title="Marcar despesa como paga" description={`Confirmar pagamento da despesa #${paying?.id ?? ''}?`} onConfirm={() => paying && markPaid.mutate({ id: paying.id }, { onSuccess: () => setPaying(null) })} />
      <ConfirmDialog open={Boolean(canceling)} onOpenChange={(open) => !open && setCanceling(null)} title="Cancelar despesa" description={`Cancelar despesa #${canceling?.id ?? ''}?`} onConfirm={() => canceling && cancel.mutate({ id: canceling.id }, { onSuccess: () => setCanceling(null) })} />
    </>
  );
}

function AgentSelect({ value, onChange, agents }: { value: string; onChange: (value: string) => void; agents: Array<{ id: number; name: string }> }) {
  return (
    <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Filtrar por inventariante">
      <option value="">Todos inventariantes</option>
      {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
    </select>
  );
}

function PaymentDetailDrawer({ payment, onOpenChange }: { payment: FieldAgentPayment | null; onOpenChange: (open: boolean) => void }) {
  return (
    <DrawerForm open={Boolean(payment)} onOpenChange={onOpenChange} title="Detalhes do pagamento">
      {payment ? (
        <dl className="grid gap-3 text-sm">
          <Detail label="Status" value={<StatusBadge value={payment.status} />} />
          <Detail label="Periodo" value={`${formatDate(payment.start_date)} - ${formatDate(payment.end_date)}`} />
          <Detail label="Dias" value={payment.days} />
          <Detail label="Diaria" value={formatMoney(payment.daily_rate)} />
          <Detail label="Total diario" value={formatMoney(payment.daily_total)} />
          <Detail label="Adicional" value={formatMoney(payment.additional_amount)} />
          <Detail label="Desconto" value={formatMoney(payment.discount_amount)} />
          <Detail label="Final" value={formatMoney(payment.final_amount)} />
          <Detail label="Observacoes" value={payment.notes ?? '-'} />
        </dl>
      ) : null}
    </DrawerForm>
  );
}

function ExpenseDetailDrawer({ expense, onOpenChange }: { expense: Expense | null; onOpenChange: (open: boolean) => void }) {
  return (
    <DrawerForm open={Boolean(expense)} onOpenChange={onOpenChange} title="Detalhes da despesa">
      {expense ? (
        <dl className="grid gap-3 text-sm">
          <Detail label="Status" value={<StatusBadge value={expense.status} />} />
          <Detail label="Descricao" value={expense.description} />
          <Detail label="Data" value={formatDate(expense.expense_date)} />
          <Detail label="Valor" value={formatMoney(expense.amount)} />
          <Detail label="Inventariante" value={expense.field_agent_id ? `#${expense.field_agent_id}` : '-'} />
          <Detail label="Motivo" value={expense.reason ?? '-'} />
        </dl>
      ) : null}
    </DrawerForm>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function MarkPaymentPaidModal({ payment, busy, onOpenChange, onSubmit }: { payment: FieldAgentPayment | null; busy: boolean; onOpenChange: (open: boolean) => void; onSubmit: (payload: { payment_date?: string }) => void }) {
  const form = useForm<PaidDateValues>({ resolver: zodResolver(paidDateSchema), values: { payment_date: '' } });
  return (
    <ModalForm open={Boolean(payment)} onOpenChange={onOpenChange} title="Marcar pagamento como pago">
      <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(paidDateSchema.parse(values)))}>
        <FormField label="Data de pagamento">
          <DateInput {...form.register('payment_date')} />
        </FormField>
        <Button loading={busy}>Confirmar pagamento</Button>
      </form>
    </ModalForm>
  );
}

function RejectExpenseModal({ expense, busy, onOpenChange, onSubmit }: { expense: Expense | null; busy: boolean; onOpenChange: (open: boolean) => void; onSubmit: (payload: { reason: string }) => void }) {
  const form = useForm<RejectExpenseValues>({ resolver: zodResolver(rejectExpenseSchema), values: { reason: '' } });
  return (
    <ModalForm open={Boolean(expense)} onOpenChange={onOpenChange} title="Rejeitar despesa">
      <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(rejectExpenseSchema.parse(values)))}>
        <FormField label="Motivo" error={form.formState.errors.reason?.message}>
          <textarea aria-label="Motivo" className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('reason')} />
        </FormField>
        <Button variant="danger" loading={busy}>Rejeitar despesa</Button>
      </form>
    </ModalForm>
  );
}
