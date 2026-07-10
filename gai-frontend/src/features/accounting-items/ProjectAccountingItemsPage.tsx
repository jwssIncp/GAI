import { useMemo, useState } from 'react';
import { Eye, Pencil, RotateCcw, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
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

export function ProjectAccountingItemsPage() {
  const projectId = Number(useParams().projectId);
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

  const columns: Column<InventoryAccountingItem>[] = [
    { header: 'Placa', cell: (item) => <div className="font-medium">{item.plate ?? '-'}<div className="text-xs text-muted-foreground">#{item.id}</div></div> },
    { header: 'Descricao', cell: (item) => item.description ?? '-' },
    { header: 'Conta contabil', cell: (item) => item.accounting_account_description ?? '-' },
    { header: 'Localizacao', cell: (item) => item.location ?? '-' },
    { header: 'Aquisicao', cell: (item) => formatDate(item.acquisition_date) },
    { header: 'Valor', cell: (item) => formatMoney(item.acquisition_value) },
    { header: 'Cod. base', cell: (item) => item.base_code ?? '-' },
    { header: 'Investor', cell: (item) => item.investor_code ?? '-' },
    { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
    { header: 'Atualizado em', cell: (item) => formatDateTime(item.updated_at) },
    {
      header: 'Acoes',
      cell: (item) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" aria-label="Visualizar item contabil" onClick={() => setViewingId(item.id)}><Eye size={16} /></Button>
          <PermissionGate permissions={['inventory-accounting-items:update']}>
            <Button type="button" variant="ghost" aria-label="Editar item contabil" onClick={() => setEditing(item)}><Pencil size={16} /></Button>
          </PermissionGate>
          {item.status === 'inactive' ? (
            <PermissionGate permissions={['inventory-accounting-items:reactivate']}>
              <Button type="button" variant="ghost" aria-label="Reativar item contabil" onClick={() => setConfirm({ action: 'reactivate', item })}><RotateCcw size={16} /></Button>
            </PermissionGate>
          ) : (
            <PermissionGate permissions={['inventory-accounting-items:deactivate']}>
              <Button type="button" variant="ghost" aria-label="Desativar item contabil" onClick={() => setConfirm({ action: 'deactivate', item })}><XCircle size={16} /></Button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Base contabil" description={`Projeto #${projectId}. Itens patrimoniais importados da base contabil.`} />
      <div className="flex flex-wrap gap-2 border-b pb-3 text-sm">
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/summary`}>Resumo</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/inventory-items`}>Itens inventariados</Link>
        <span className="text-muted-foreground">/ Base contabil</span>
      </div>
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar base contabil" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value as InventoryAccountingItemStatus | ''); setPage(1); }} aria-label="Filtrar base contabil por status">
          <option value="">Todos os status</option>
          {accountingItemStatuses.map((itemStatus) => <option key={itemStatus} value={itemStatus}>{itemStatus}</option>)}
        </select>
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={plate} onChange={(event) => { setPlate(event.target.value); setPage(1); }} placeholder="Placa" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={description} onChange={(event) => { setDescription(event.target.value); setPage(1); }} placeholder="Descricao" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={baseCode} onChange={(event) => { setBaseCode(event.target.value); setPage(1); }} placeholder="Codigo base" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={investorCode} onChange={(event) => { setInvestorCode(event.target.value); setPage(1); }} placeholder="Codigo investor" />
      </FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : data ? (
        <>
          <DataTable columns={columns} items={data.items} getKey={(item) => item.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
      <AccountingImportsPanel projectId={projectId} />
      <AccountingItemDetailDrawer projectId={projectId} id={viewingId} open={Boolean(viewingId)} onOpenChange={(open) => !open && setViewingId(undefined)} />
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar item contabil">
        {editing ? <AccountingItemForm initial={editing} busy={update.isPending} onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} /> : null}
      </DrawerForm>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.action === 'deactivate' ? 'Desativar item contabil' : 'Reativar item contabil'}
        description={`Confirmar alteracao de status do item ${confirm?.item.plate ?? confirm?.item.id ?? ''}?`}
        onConfirm={() => {
          if (!confirm) return;
          const mutation = confirm.action === 'deactivate' ? deactivate : reactivate;
          mutation.mutate(confirm.item.id, { onSuccess: () => setConfirm(null) });
        }}
      />
    </PageContainer>
  );
}
