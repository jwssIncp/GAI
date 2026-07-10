import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Eye, Pencil, Plus, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { DataTable, type Column } from '@/components/base/DataTable';
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
import { formatDateTime } from '@/utils/format';
import { PendingIssueDetailDrawer } from './PendingIssueDetailDrawer';
import { PendingIssueForm } from './PendingIssueForm';
import {
  ignoreSchema,
  pendingIssueSeverityLabels,
  pendingIssueSeverities,
  pendingIssueStatusLabels,
  pendingIssueStatuses,
  pendingIssueTypeLabels,
  pendingIssueTypes,
  resolutionSchema,
  type IgnoreFormValues,
  type ResolutionFormValues,
} from './pendingIssueSchemas';
import {
  useCancelPendingIssue,
  useCreatePendingIssue,
  useGeneratePendingIssues,
  useIgnorePendingIssue,
  useProjectPendingIssues,
  useResolvePendingIssue,
  useUpdatePendingIssue,
} from './pendingIssuesQueries';
import type { InventoryPendingIssue, InventoryPendingIssueSeverity, InventoryPendingIssueStatus, InventoryPendingIssueType } from '@/types/api';

export function ProjectPendingIssuesPage() {
  const projectId = Number(useParams().projectId);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InventoryPendingIssueStatus | ''>('');
  const [type, setType] = useState<InventoryPendingIssueType | ''>('');
  const [severity, setSeverity] = useState<InventoryPendingIssueSeverity | ''>('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [accountingItemId, setAccountingItemId] = useState('');
  const [plate, setPlate] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryPendingIssue | null>(null);
  const [viewingId, setViewingId] = useState<number | undefined>();
  const [resolving, setResolving] = useState<InventoryPendingIssue | null>(null);
  const [ignoring, setIgnoring] = useState<InventoryPendingIssue | null>(null);
  const [canceling, setCanceling] = useState<InventoryPendingIssue | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateFeedback, setGenerateFeedback] = useState<string | null>(null);
  const params = useMemo(() => ({
    page,
    page_size: 20,
    search: search || undefined,
    status: status || undefined,
    type: type || undefined,
    severity: severity || undefined,
    inventory_item_id: inventoryItemId ? Number(inventoryItemId) : undefined,
    accounting_item_id: accountingItemId ? Number(accountingItemId) : undefined,
    plate: plate || undefined,
  }), [accountingItemId, inventoryItemId, page, plate, search, severity, status, type]);
  const query = useProjectPendingIssues(projectId, params);
  const create = useCreatePendingIssue(projectId);
  const update = useUpdatePendingIssue(projectId);
  const resolve = useResolvePendingIssue(projectId);
  const ignore = useIgnorePendingIssue(projectId);
  const cancel = useCancelPendingIssue(projectId);
  const generate = useGeneratePendingIssues(projectId);
  const { hasPermission } = usePermissions();
  const data = query.data ? normalizePage(query.data) : null;

  const columns: Column<InventoryPendingIssue>[] = [
    { header: 'Tipo', cell: (issue) => <div className="font-medium">{pendingIssueTypeLabels[issue.type]}<div className="text-xs text-muted-foreground">#{issue.id}</div></div> },
    { header: 'Titulo', cell: (issue) => issue.title },
    { header: 'Severidade', cell: (issue) => <StatusBadge value={issue.severity} /> },
    { header: 'Status', cell: (issue) => <StatusBadge value={issue.status} /> },
    { header: 'Item inventariado', cell: (issue) => issue.inventory_item_id ? `#${issue.inventory_item_id}` : '-' },
    { header: 'Item contabil', cell: (issue) => issue.accounting_item_id ? `#${issue.accounting_item_id}` : '-' },
    { header: 'Criado em', cell: (issue) => formatDateTime(issue.created_at) },
    { header: 'Resolvido em', cell: (issue) => formatDateTime(issue.resolved_at) },
    {
      header: 'Acoes',
      cell: (issue) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" aria-label="Visualizar pendencia" onClick={() => setViewingId(issue.id)}><Eye size={16} /></Button>
          <PermissionGate permissions={['inventory-pending-issues:update']}>
            <Button type="button" variant="ghost" aria-label="Editar pendencia" onClick={() => setEditing(issue)}><Pencil size={16} /></Button>
          </PermissionGate>
          <PermissionGate permissions={['inventory-pending-issues:resolve']}>
            <Button type="button" variant="ghost" aria-label="Resolver pendencia" disabled={issue.status === 'resolved'} onClick={() => setResolving(issue)}><CheckCircle2 size={16} /></Button>
          </PermissionGate>
          <PermissionGate permissions={['inventory-pending-issues:ignore']}>
            <Button type="button" variant="ghost" aria-label="Ignorar pendencia" disabled={issue.status === 'ignored'} onClick={() => setIgnoring(issue)}><ShieldAlert size={16} /></Button>
          </PermissionGate>
          <PermissionGate permissions={['inventory-pending-issues:cancel']}>
            <Button type="button" variant="ghost" aria-label="Cancelar pendencia" disabled={issue.status === 'cancelled'} onClick={() => setCanceling(issue)}><XCircle size={16} /></Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Pendencias"
        description={`Projeto #${projectId}. Divergencias, furos de placa e pendencias patrimoniais.`}
        action={(
          <div className="flex gap-2">
            {hasPermission('inventory-pending-issues:generate') ? <Button type="button" variant="secondary" onClick={() => setGenerateOpen(true)}><RefreshCw size={17} /> Gerar pendencias</Button> : null}
            {hasPermission('inventory-pending-issues:create') ? <Button type="button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Nova pendencia</Button> : null}
          </div>
        )}
      />
      <div className="flex flex-wrap gap-2 border-b pb-3 text-sm">
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/summary`}>Resumo</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/inventory-items`}>Itens inventariados</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/accounting-items`}>Base contabil</Link>
        <span className="text-muted-foreground">/ Pendencias</span>
      </div>
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar pendencia" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value as InventoryPendingIssueStatus | ''); setPage(1); }} aria-label="Filtrar pendencia por status">
          <option value="">Todos os status</option>
          {pendingIssueStatuses.map((item) => <option key={item} value={item}>{pendingIssueStatusLabels[item]}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={type} onChange={(event) => { setType(event.target.value as InventoryPendingIssueType | ''); setPage(1); }} aria-label="Filtrar pendencia por tipo">
          <option value="">Todos os tipos</option>
          {pendingIssueTypes.map((item) => <option key={item} value={item}>{pendingIssueTypeLabels[item]}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={severity} onChange={(event) => { setSeverity(event.target.value as InventoryPendingIssueSeverity | ''); setPage(1); }} aria-label="Filtrar pendencia por severidade">
          <option value="">Todas severidades</option>
          {pendingIssueSeverities.map((item) => <option key={item} value={item}>{pendingIssueSeverityLabels[item]}</option>)}
        </select>
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={inventoryItemId} onChange={(event) => { setInventoryItemId(event.target.value); setPage(1); }} placeholder="Item inventariado ID" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={accountingItemId} onChange={(event) => { setAccountingItemId(event.target.value); setPage(1); }} placeholder="Item contabil ID" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={plate} onChange={(event) => { setPlate(event.target.value); setPage(1); }} placeholder="Placa" />
      </FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : data ? (
        <>
          <DataTable columns={columns} items={data.items} getKey={(issue) => issue.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}

      <DrawerForm open={createOpen} onOpenChange={setCreateOpen} title="Nova pendencia">
        <PendingIssueForm busy={create.isPending} onSubmit={(payload) => create.mutate(payload as Parameters<typeof create.mutate>[0], { onSuccess: () => setCreateOpen(false) })} />
      </DrawerForm>
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar pendencia">
        {editing ? <PendingIssueForm initial={editing} busy={update.isPending} onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} /> : null}
      </DrawerForm>
      <PendingIssueDetailDrawer projectId={projectId} id={viewingId} open={Boolean(viewingId)} onOpenChange={(open) => !open && setViewingId(undefined)} />
      <ResolutionModal issue={resolving} busy={resolve.isPending} onOpenChange={(open) => !open && setResolving(null)} onSubmit={(notes) => resolving && resolve.mutate({ id: resolving.id, payload: { resolution_notes: notes } }, { onSuccess: () => setResolving(null) })} />
      <IgnoreModal issue={ignoring} busy={ignore.isPending} onOpenChange={(open) => !open && setIgnoring(null)} onSubmit={(notes) => ignoring && ignore.mutate({ id: ignoring.id, payload: { resolution_notes: notes || undefined } }, { onSuccess: () => setIgnoring(null) })} />
      <ConfirmDialog
        open={Boolean(canceling)}
        onOpenChange={(open) => !open && setCanceling(null)}
        title="Cancelar pendencia"
        description={`Confirmar cancelamento da pendencia ${canceling?.title ?? ''}?`}
        onConfirm={() => canceling && cancel.mutate(canceling.id, { onSuccess: () => setCanceling(null) })}
      />
      <ConfirmDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title="Gerar pendencias automaticamente"
        description="O backend comparara itens inventariados e base contabil do projeto para registrar novas pendencias sem duplicar as existentes."
        onConfirm={() => generate.mutate(undefined, { onSuccess: (result) => { setGenerateFeedback(`Geracao concluida: ${result.created} criada(s), ${result.skipped} ignorada(s).`); setGenerateOpen(false); } })}
      />
      {generateFeedback ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{generateFeedback}</p> : null}
    </PageContainer>
  );
}

function ResolutionModal({ issue, busy, onOpenChange, onSubmit }: { issue: InventoryPendingIssue | null; busy: boolean; onOpenChange: (open: boolean) => void; onSubmit: (notes: string) => void }) {
  const form = useForm<ResolutionFormValues>({ resolver: zodResolver(resolutionSchema), values: { resolution_notes: '' } });
  return (
    <ModalForm open={Boolean(issue)} onOpenChange={onOpenChange} title="Resolver pendencia">
      <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(values.resolution_notes))}>
        <FormField label="Observacoes da resolucao" error={form.formState.errors.resolution_notes?.message}>
          <textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('resolution_notes')} />
        </FormField>
        <Button loading={busy}>Resolver pendencia</Button>
      </form>
    </ModalForm>
  );
}

function IgnoreModal({ issue, busy, onOpenChange, onSubmit }: { issue: InventoryPendingIssue | null; busy: boolean; onOpenChange: (open: boolean) => void; onSubmit: (notes?: string) => void }) {
  const form = useForm<IgnoreFormValues>({ resolver: zodResolver(ignoreSchema), values: { resolution_notes: '' } });
  return (
    <ModalForm open={Boolean(issue)} onOpenChange={onOpenChange} title="Ignorar pendencia">
      <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(values.resolution_notes))}>
        <FormField label="Motivo ou observacao">
          <textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('resolution_notes')} />
        </FormField>
        <Button loading={busy}>Ignorar pendencia</Button>
      </form>
    </ModalForm>
  );
}
