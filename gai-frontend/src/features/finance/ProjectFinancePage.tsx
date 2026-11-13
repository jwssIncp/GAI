import { FieldAgentSelect } from '@/features/field-agents/FieldAgentSelect';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, CreditCard, Eye, Pencil, Plus, Receipt, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
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
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';
import { ExpenseAttachmentsPanel } from './ExpenseAttachmentsPanel';
import { ExpenseForm } from './ExpenseForm';
import {
  expenseStatusLabels,
  expenseStatuses,
  rejectExpenseSchema,
  type RejectExpenseValues,
} from './financeSchemas';
import {
  useCreateExpense,
  useExpenseAction,
  useExpenses,
  useFinanceFieldAgents,
  useUpdateExpense,
} from './financeQueries';
import type { Expense, ExpenseStatus, FieldAgent } from '@/types/api';
import { useProjectLabel } from '@/features/projects/useProjectLabel';

/**
 * Projeto › Financeiro › Despesas. A remuneração (diárias) passou para a aba
 * própria (etapa 2 da paridade); o endereço antigo ?tab=payments redireciona.
 */
export function ProjectFinancePage() {
  const projectId = Number(useParams().projectId);
  const projectLabel = useProjectLabel(projectId);
  const [searchParams] = useSearchParams();
  const fieldAgents = useFinanceFieldAgents();
  const agents = fieldAgents.data?.items ?? [];
  if (searchParams.get('tab') === 'payments')
    return <Navigate to={`/app/projects/${projectId}/finance/remuneration`} replace />;

  return (
    <PageContainer>
      <PageHeader title="Despesas" description={`${projectLabel}. Despesas do projeto e comprovantes.`} />
      <ExpensesTab projectId={projectId} fieldAgents={agents} />
    </PageContainer>
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
    { header: 'Ações', cell: (expense) => (
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
        <DateInput aria-label="Início da despesa" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} />
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
    <FieldAgentSelect value={value} onChange={onChange} selectedLabel={agents.find(agent => String(agent.id) === value)?.name} allStatuses ariaLabel="Filtrar por inventariante" />
  );
}

function ExpenseDetailDrawer({ expense, onOpenChange }: { expense: Expense | null; onOpenChange: (open: boolean) => void }) {
  return (
    <DrawerForm open={Boolean(expense)} onOpenChange={onOpenChange} title="Detalhes da despesa">
      {expense ? (
        <dl className="grid gap-3 text-sm">
          <Detail label="Status" value={<StatusBadge value={expense.status} />} />
          <Detail label="Descrição" value={expense.description} />
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
