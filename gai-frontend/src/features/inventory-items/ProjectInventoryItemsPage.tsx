import { useEffect, useMemo, useState } from 'react';
import { Camera, Download, Eye, Pencil, Plus, RotateCcw, XCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { exportJobsApi } from '@/api/endpoints';
import { normalizePage } from '@/api/pagination';
import { Kpi, KpiGrid } from '@/components/base/Cards';
import { DataPanel, DataPanelFilters } from '@/components/base/DataPanel';
import { DataTable, type Column } from '@/components/base/DataTable';
import { useProjectDashboard } from '@/features/projects/projectQueries';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { SearchInput } from '@/components/base/SearchInput';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DrawerForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { usePermissions } from '@/features/auth/usePermissions';
import { formatDateTime, formatMoney } from '@/utils/format';
import { InventoryItemDetailDrawer } from './InventoryItemDetailDrawer';
import { InventoryItemForm } from './InventoryItemForm';
import { inventoryItemStatusLabels, inventoryItemStatuses } from './inventoryItemSchemas';
import { useChangeInventoryItemStatus, useCreateInventoryItem, useProjectInventoryItems, useUpdateInventoryItem } from './inventoryItemsQueries';
import type { InventoryItem, InventoryItemStatus } from '@/types/api';
import { ValuationBatchPanel,type BatchSelectionState } from './ValuationBatchPanel';
import { useProjectLabel } from '@/features/projects/useProjectLabel';

/** Colunas que o usuário pode ocultar ("Colunas ▾"); a escolha fica salva neste navegador. */
const OPTIONAL_COLUMNS = ['Sequência', 'Placa antiga', 'Placa nova', 'Marca', 'Modelo', 'Localização', 'Fonte de consulta', 'Valor novo', 'Valor usado', 'Atualizado em'];
const COLUMNS_STORAGE_KEY = 'gai.inventory-items.hidden-columns';
function loadHiddenColumns(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COLUMNS_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => OPTIONAL_COLUMNS.includes(value)) : [];
  } catch {
    return [];
  }
}
function saveHiddenColumns(value: string[]) {
  try { window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(value)); } catch { /* sem armazenamento: vale só nesta visita */ }
}

function ColumnsMenu({ hidden, onChange }: { hidden: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="relative text-sm" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-lg border border-white/60 px-3.5 text-[0.8125rem] font-bold text-white hover:bg-white/15">Colunas ▾</summary>
      {/* Opções só no DOM com o menu aberto (fechado, não somam aos campos da tela). */}
      {open ? <div className="absolute right-0 z-20 mt-1 grid gap-1 rounded-md border bg-popover p-3 text-foreground shadow-elevated" role="group" aria-label="Colunas visíveis">
        {OPTIONAL_COLUMNS.map((column) => (
          <label key={column} className="flex items-center gap-2 whitespace-nowrap">
            <input type="checkbox" checked={!hidden.includes(column)} onChange={(event) => onChange(event.target.checked ? hidden.filter((h) => h !== column) : [...hidden, column])} />
            {column}
          </label>
        ))}
      </div> : null}
    </details>
  );
}

const percentLabel = (value: number) => `${Math.round(value * 10) / 10}%`.replace('.', ',');

/** KPIs do inventário no topo da aba, como no sistema anterior (dados do resumo do projeto). */
function InventoryIndicators({ projectId }: { projectId: number }) {
  const inventory = useProjectDashboard(projectId).data?.inventory;
  if (!inventory) return null;
  return (
    <KpiGrid label="Indicadores do inventário">
      <Kpi group="indicators" tinted label="Itens inventariados" value={inventory.total_items} />
      <Kpi group="indicators" label="% avaliado" value={percentLabel(Number(inventory.progress_percentage ?? 0))} hint={`${inventory.evaluated_items} avaliados`} />
      <Kpi group="indicators" label="Pendentes" value={inventory.pending_items} />
      <Kpi group="indicators" label="Divergentes" value={inventory.divergent_items} tone={inventory.divergent_items ? 'warning' : 'default'} />
      <Kpi group="indicators" label="Não encontrados" value={inventory.not_found_items} tone={inventory.not_found_items ? 'warning' : 'default'} />
      <Kpi group="indicators" label="Duplicados" value={inventory.duplicated_items} tone={inventory.duplicated_items ? 'danger' : 'default'} />
    </KpiGrid>
  );
}

export function ProjectInventoryItemsPage() {
  const projectId = Number(useParams().projectId);
  return <InventoryItemsWorkspace key={projectId} projectId={projectId}/>;
}
function InventoryItemsWorkspace({projectId}:{projectId:number}) {
  const projectLabel = useProjectLabel(projectId);
  const [selection,setSelection]=useState<BatchSelectionState>({contract:{kind:'ids',ids:[]},ids:[]});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InventoryItemStatus | ''>('');
  const [oldPlate, setOldPlate] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [description, setDescription] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [viewingId, setViewingId] = useState<number | undefined>();
  const [confirm, setConfirm] = useState<{ action: 'deactivate' | 'reactivate'; item: InventoryItem } | null>(null);
  const params = useMemo(() => ({
    page,
    page_size: 20,
    search: search || undefined,
    status: status || undefined,
    old_plate: oldPlate || undefined,
    new_plate: newPlate || undefined,
    description: description || undefined,
  }), [description, newPlate, oldPlate, page, search, status]);
  const query = useProjectInventoryItems(projectId, params);
  // Aba "Avaliação" do projeto: abre esta tela já no painel de avaliação (#avaliacao).
  const { hash } = useLocation();
  const itemsLoaded = Boolean(query.data);
  useEffect(() => {
    if (hash === '#avaliacao' && itemsLoaded) document.getElementById('avaliacao')?.scrollIntoView?.({ block: 'start' });
  }, [hash, itemsLoaded]);
  const create = useCreateInventoryItem(projectId);
  const update = useUpdateInventoryItem(projectId);
  const deactivate = useChangeInventoryItemStatus(projectId, 'deactivate');
  const reactivate = useChangeInventoryItemStatus(projectId, 'reactivate');
  const { hasPermission } = usePermissions();
  const data = query.data ? normalizePage(query.data) : null;
  const [panelHidden, setPanelHidden] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(loadHiddenColumns);
  const queryClient = useQueryClient();
  // "Exportar (Excel)" como no sistema anterior: dispara o export assíncrono de itens.
  const exportItems = useMutation({
    mutationFn: () => exportJobsApi.create(projectId, 'inventory_items_xlsx'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['export-jobs', projectId] }),
  });

  const columns: Column<InventoryItem>[] = [
    ...(hasPermission('asset-valuations:batch-create')&&hasPermission('asset-valuations:create')&&hasPermission('asset-valuations:read')?[{header:'Selecionar',cell:(item:InventoryItem)=><input type="checkbox" aria-label={`Selecionar item ${item.id}`} checked={selection.ids.includes(item.id)} onChange={()=>{const ids=selection.ids.includes(item.id)?selection.ids.filter(id=>id!==item.id):[...selection.ids,item.id];setSelection({ids,contract:{kind:'ids',ids}});}}/>}]:[]),
    { header: 'Sequência', cell: (item) => item.sequence ?? '-' },
    { header: 'Placa antiga', cell: (item) => item.old_plate ?? '-' },
    { header: 'Placa nova', cell: (item) => item.new_plate ?? '-' },
    { header: 'Descrição', cell: (item) => <div className="font-medium">{item.description ?? '-'}<div className="text-xs text-muted-foreground">{item.external_item_id ?? `#${item.id}`}</div></div> },
    { header: 'Marca', cell: (item) => item.brand ?? '-' },
    { header: 'Modelo', cell: (item) => item.model ?? '-' },
    { header: 'Localização', cell: (item) => item.location_text ?? item.unit_text ?? '-' },
    // Colunas da Avaliação do sistema anterior: fonte de consulta, valor novo e valor usado.
    { header: 'Fonte de consulta', cell: (item) => item.source || '-' },
    { header: 'Valor novo', cell: (item) => (item.new_value ? formatMoney(item.new_value) : '-'), numeric: true },
    { header: 'Valor usado', cell: (item) => (item.used_value ? formatMoney(item.used_value) : '-'), numeric: true },
    { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
    { header: 'Atualizado em', cell: (item) => formatDateTime(item.updated_at) },
    {
      header: 'Ações',
      cell: (item) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" aria-label="Visualizar item" onClick={() => setViewingId(item.id)}><Eye size={16} /></Button>
          <PermissionGate permissions={['inventory-items:update']}>
            <Button type="button" variant="ghost" aria-label="Editar item" onClick={() => setEditing(item)}><Pencil size={16} /></Button>
          </PermissionGate>
          <PermissionGate permissions={['inventory-item-images:read']}>
            <Button type="button" variant="ghost" aria-label="Acessar imagens do item" onClick={() => setViewingId(item.id)}><Camera size={16} /></Button>
          </PermissionGate>
          {item.status === 'inactive' ? (
            <PermissionGate permissions={['inventory-items:reactivate']}>
              <Button type="button" variant="ghost" aria-label="Reativar item" onClick={() => setConfirm({ action: 'reactivate', item })}><RotateCcw size={16} /></Button>
            </PermissionGate>
          ) : (
            <PermissionGate permissions={['inventory-items:deactivate']}>
              <Button type="button" variant="ghost" aria-label="Desativar item" onClick={() => setConfirm({ action: 'deactivate', item })}><XCircle size={16} /></Button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];
  const shownColumns = columns.filter((column) => !hiddenColumns.includes(column.header));

  return (
    <PageContainer>
      <PageHeader
        title="Itens inventariados"
        description={`${projectLabel}. Itens patrimoniais registrados no inventário.`}
        action={hasPermission('inventory-items:create') ? <Button type="button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Novo item</Button> : null}
      />
      <InventoryIndicators projectId={projectId} />
      <PermissionGate permissions={['asset-valuations:read','inventory-items:read']}><ValuationBatchPanel projectId={projectId} selection={selection} currentItems={data?.items??[]} filters={{search:params.search,status:params.status,old_plate:params.old_plate,new_plate:params.new_plate,description:params.description}} onSelection={setSelection} onViewItem={setViewingId}/></PermissionGate>
      <DataPanel
        title="Itens inventariados"
        titleId="itens-inventariados"
        contentId="itens-inventariados-conteudo"
        count={data ? data.totalItems : undefined}
        hidden={panelHidden}
        onToggle={() => setPanelHidden((value) => !value)}
        overflowVisible
        extra={<>
          <ColumnsMenu hidden={hiddenColumns} onChange={(next) => { setHiddenColumns(next); saveHiddenColumns(next); }} />
          {hasPermission('export-jobs:create') ? <Button type="button" size="sm" variant="secondary" disabled={exportItems.isPending} onClick={() => exportItems.mutate()}><Download size={15} /> Exportar (Excel)</Button> : null}
        </>}
      >
        <DataPanelFilters label="Filtros dos itens">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar (placa, descrição, marca, modelo, série)" />
          <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value as InventoryItemStatus | ''); setPage(1); }} aria-label="Filtrar por status">
            <option value="">Status: todos</option>
            {inventoryItemStatuses.map((itemStatus) => <option key={itemStatus} value={itemStatus}>{inventoryItemStatusLabels[itemStatus]}</option>)}
          </select>
          <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={oldPlate} onChange={(event) => { setOldPlate(event.target.value); setPage(1); }} placeholder="Placa antiga" />
          <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={newPlate} onChange={(event) => { setNewPlate(event.target.value); setPage(1); }} placeholder="Placa nova" />
          <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={description} onChange={(event) => { setDescription(event.target.value); setPage(1); }} placeholder="Descrição" />
        </DataPanelFilters>
        {exportItems.isSuccess ? <p role="status" className="border-b border-border px-5 py-2 text-sm">Exportação #{exportItems.data.id} solicitada. <Link className="font-semibold text-primary hover:underline" to={`/app/projects/${projectId}/export-jobs`}>Acompanhar e baixar em Exportações</Link></p> : null}
        {exportItems.isError ? <div className="px-5 py-2"><ErrorState message={(exportItems.error as Error).message} /></div> : null}
        {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : data ? (
          <>
            <DataTable bare columns={shownColumns} items={data.items} getKey={(item) => item.id} />
            <div className="px-5 pb-3"><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /></div>
          </>
        ) : null}
      </DataPanel>
      <DrawerForm open={createOpen} onOpenChange={setCreateOpen} title="Novo item">
        <InventoryItemForm busy={create.isPending} onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} />
      </DrawerForm>
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar item">
        {editing ? <InventoryItemForm initial={editing} busy={update.isPending} onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} /> : null}
      </DrawerForm>
      <InventoryItemDetailDrawer projectId={projectId} id={viewingId} open={Boolean(viewingId)} onOpenChange={(open) => !open && setViewingId(undefined)} />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.action === 'deactivate' ? 'Desativar item' : 'Reativar item'}
        description={`Confirmar alteração de status do item ${confirm?.item.description ?? confirm?.item.id ?? ''}?`}
        onConfirm={() => {
          if (!confirm) return;
          const mutation = confirm.action === 'deactivate' ? deactivate : reactivate;
          mutation.mutate(confirm.item.id, { onSuccess: () => setConfirm(null) });
        }}
      />
    </PageContainer>
  );
}
