import { useMemo, useState } from 'react';
import { Eye, Pencil, RotateCcw, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { DataTable, type Column } from '@/components/base/DataTable';
import { FilterPanel } from '@/components/base/FilterPanel';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { SearchInput } from '@/components/base/SearchInput';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DrawerForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';
import { AccountingImportsPanel } from './AccountingImportsPanel';
import { AccountingItemDetailDrawer } from './AccountingItemDetailDrawer';
import { AccountingItemForm } from './AccountingItemForm';
import { accountingItemStatuses } from './accountingItemSchemas';
import { useChangeAccountingItemStatus, useProjectAccountingItems, useUpdateAccountingItem } from './accountingItemsQueries';
import type { InventoryAccountingItem, InventoryAccountingItemStatus } from '@/types/api';
import { useProjectLabel } from '@/features/projects/useProjectLabel';
import { usePermissions } from '@/features/auth/usePermissions';
import { SurplusClassificationBadge, SurplusClassificationMenu } from './SurplusClassificationMenu';

/** Só a sobra (não conciliada e ativa) pode receber classificação manual. */
const classifiable = (item: InventoryAccountingItem) => item.status !== 'matched' && item.status !== 'inactive';

export function ProjectAccountingItemsPage() {
  const projectId = Number(useParams().projectId);
  const projectLabel = useProjectLabel(projectId);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InventoryAccountingItemStatus | ''>('');
  const [plate, setPlate] = useState('');
  const [description, setDescription] = useState('');
  const [baseCode, setBaseCode] = useState('');
  const [investorCode, setInvestorCode] = useState('');
  const [viewingId, setViewingId] = useState<number | undefined>();
  const [editing, setEditing] = useState<InventoryAccountingItem | null>(null);
  const [confirm, setConfirm] = useState<{ action: 'deactivate' | 'reactivate'; item: InventoryAccountingItem } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const canClassify = usePermissions().hasPermission('inventory-accounting-items:update');
  const params = useMemo(() => ({
    page,
    page_size: 20,
    search: search || undefined,
    status: status || undefined,
    plate: plate || undefined,
    description: description || undefined,
    base_code: baseCode || undefined,
    investor_code: investorCode || undefined,
  }), [baseCode, description, investorCode, page, plate, search, status]);
  const query = useProjectAccountingItems(projectId, params);
  const update = useUpdateAccountingItem(projectId);
  const deactivate = useChangeAccountingItemStatus(projectId, 'deactivate');
  const reactivate = useChangeAccountingItemStatus(projectId, 'reactivate');
  const data = query.data ? normalizePage(query.data) : null;

  const pageSelectable = (data?.items ?? []).filter(classifiable).map((item) => item.id);
  const allSelected = pageSelectable.length > 0 && pageSelectable.every((id) => selected.includes(id));
  const columns: Column<InventoryAccountingItem>[] = [
    ...(canClassify
      ? [{
          header: 'Selecionar',
          headerContent: <input type="checkbox" aria-label="Selecionar a sobra contábil desta página" checked={allSelected} disabled={!pageSelectable.length} onChange={() => setSelected(allSelected ? selected.filter((id) => !pageSelectable.includes(id)) : [...new Set([...selected, ...pageSelectable])])} />,
          cell: (item: InventoryAccountingItem) => (
            <input type="checkbox" aria-label={`Selecionar item contábil ${item.plate ?? item.id}`} disabled={!classifiable(item)} title={classifiable(item) ? undefined : 'Itens conciliados ou inativos não recebem classificação.'} checked={selected.includes(item.id)} onChange={() => setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} />
          ),
        } satisfies Column<InventoryAccountingItem>]
      : []),
    { header: 'Placa', cell: (item) => <div className="font-medium">{item.plate ?? '-'}<div className="text-xs text-muted-foreground">#{item.id}</div></div> },
    { header: 'Descrição', cell: (item) => item.description ?? '-' },
    { header: 'Conta contábil', cell: (item) => item.accounting_account_description ?? '-' },
    { header: 'Localização', cell: (item) => item.location ?? '-' },
    { header: 'Aquisição', cell: (item) => formatDate(item.acquisition_date) },
    { header: 'Valor', cell: (item) => formatMoney(item.acquisition_value), numeric: true },
    { header: 'Valor residual', cell: (item) => (item.residual_value == null ? '-' : formatMoney(item.residual_value)), numeric: true },
    { header: 'Cod. base', cell: (item) => item.base_code ?? '-' },
    { header: 'Investor', cell: (item) => item.investor_code ?? '-' },
    { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
    { header: 'Classificação', cell: (item) => <SurplusClassificationBadge value={item.surplus_classification} /> },
    { header: 'Atualizado em', cell: (item) => formatDateTime(item.updated_at) },
    {
      header: 'Ações',
      cell: (item) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" aria-label="Visualizar item contábil" onClick={() => setViewingId(item.id)}><Eye size={16} /></Button>
          <PermissionGate permissions={['inventory-accounting-items:update']}>
            <Button type="button" variant="ghost" aria-label="Editar item contábil" onClick={() => setEditing(item)}><Pencil size={16} /></Button>
          </PermissionGate>
          {item.status === 'inactive' ? (
            <PermissionGate permissions={['inventory-accounting-items:reactivate']}>
              <Button type="button" variant="ghost" aria-label="Reativar item contábil" onClick={() => setConfirm({ action: 'reactivate', item })}><RotateCcw size={16} /></Button>
            </PermissionGate>
          ) : (
            <PermissionGate permissions={['inventory-accounting-items:deactivate']}>
              <Button type="button" variant="ghost" aria-label="Desativar item contábil" onClick={() => setConfirm({ action: 'deactivate', item })}><XCircle size={16} /></Button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Base contábil" description={`${projectLabel}. Itens patrimoniais importados da base contábil.`} />
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar base contábil" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value as InventoryAccountingItemStatus | ''); setPage(1); }} aria-label="Filtrar base contábil por status">
          <option value="">Todos os status</option>
          {accountingItemStatuses.map((itemStatus) => <option key={itemStatus} value={itemStatus}>{itemStatus}</option>)}
        </select>
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={plate} onChange={(event) => { setPlate(event.target.value); setPage(1); }} placeholder="Placa" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={description} onChange={(event) => { setDescription(event.target.value); setPage(1); }} placeholder="Descrição" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={baseCode} onChange={(event) => { setBaseCode(event.target.value); setPage(1); }} placeholder="Código base" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={investorCode} onChange={(event) => { setInvestorCode(event.target.value); setPage(1); }} placeholder="Código investor" />
      </FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : data ? (
        <>
          {canClassify ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ações com a seleção">
              <span className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">Selec. contábil: {selected.length}</span>
              <SurplusClassificationMenu projectId={projectId} ids={selected} onDone={() => setSelected([])} />
              {selected.length ? <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>Limpar seleção</Button> : null}
            </div>
          ) : null}
          <DataTable columns={columns} items={data.items} getKey={(item) => item.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
      <AccountingImportsPanel projectId={projectId} />
      <AccountingItemDetailDrawer projectId={projectId} id={viewingId} open={Boolean(viewingId)} onOpenChange={(open) => !open && setViewingId(undefined)} />
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar item contábil">
        {editing ? <AccountingItemForm initial={editing} busy={update.isPending} onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} /> : null}
      </DrawerForm>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.action === 'deactivate' ? 'Desativar item contábil' : 'Reativar item contábil'}
        description={`Confirmar alteração de status do item ${confirm?.item.plate ?? confirm?.item.id ?? ''}?`}
        onConfirm={() => {
          if (!confirm) return;
          const mutation = confirm.action === 'deactivate' ? deactivate : reactivate;
          mutation.mutate(confirm.item.id, { onSuccess: () => setConfirm(null) });
        }}
      />
    </PageContainer>
  );
}
