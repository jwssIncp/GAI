import { useMemo, useState } from 'react';
import { Camera, Eye, Pencil, Plus, RotateCcw, XCircle } from 'lucide-react';
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
import { usePermissions } from '@/features/auth/usePermissions';
import { formatDateTime } from '@/utils/format';
import { InventoryItemDetailDrawer } from './InventoryItemDetailDrawer';
import { InventoryItemForm } from './InventoryItemForm';
import { inventoryItemStatuses } from './inventoryItemSchemas';
import { useChangeInventoryItemStatus, useCreateInventoryItem, useProjectInventoryItems, useUpdateInventoryItem } from './inventoryItemsQueries';
import type { InventoryItem, InventoryItemStatus } from '@/types/api';

export function ProjectInventoryItemsPage() {
  const projectId = Number(useParams().projectId);
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
  const create = useCreateInventoryItem(projectId);
  const update = useUpdateInventoryItem(projectId);
  const deactivate = useChangeInventoryItemStatus(projectId, 'deactivate');
  const reactivate = useChangeInventoryItemStatus(projectId, 'reactivate');
  const { hasPermission } = usePermissions();
  const data = query.data ? normalizePage(query.data) : null;

  const columns: Column<InventoryItem>[] = [
    { header: 'Sequencia', cell: (item) => item.sequence ?? '-' },
    { header: 'Placa antiga', cell: (item) => item.old_plate ?? '-' },
    { header: 'Placa nova', cell: (item) => item.new_plate ?? '-' },
    { header: 'Descricao', cell: (item) => <div className="font-medium">{item.description ?? '-'}<div className="text-xs text-muted-foreground">{item.external_item_id ?? `#${item.id}`}</div></div> },
    { header: 'Marca', cell: (item) => item.brand ?? '-' },
    { header: 'Modelo', cell: (item) => item.model ?? '-' },
    { header: 'Localizacao', cell: (item) => item.location_text ?? item.unit_text ?? '-' },
    { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
    { header: 'Atualizado em', cell: (item) => formatDateTime(item.updated_at) },
    {
      header: 'Acoes',
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

  return (
    <PageContainer>
      <PageHeader
        title="Itens inventariados"
        description={`Projeto #${projectId}. Itens patrimoniais registrados no inventario.`}
        action={hasPermission('inventory-items:create') ? <Button type="button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Novo item</Button> : null}
      />
      <div className="flex gap-2 border-b pb-3 text-sm">
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/summary`}>Resumo</Link>
        <span className="text-muted-foreground">/ Itens</span>
      </div>
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar item" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value as InventoryItemStatus | ''); setPage(1); }} aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          {inventoryItemStatuses.map((itemStatus) => <option key={itemStatus} value={itemStatus}>{itemStatus}</option>)}
        </select>
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={oldPlate} onChange={(event) => { setOldPlate(event.target.value); setPage(1); }} placeholder="Placa antiga" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={newPlate} onChange={(event) => { setNewPlate(event.target.value); setPage(1); }} placeholder="Placa nova" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={description} onChange={(event) => { setDescription(event.target.value); setPage(1); }} placeholder="Descricao" />
      </FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : data ? (
        <>
          <DataTable columns={columns} items={data.items} getKey={(item) => item.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
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
        description={`Confirmar alteracao de status do item ${confirm?.item.description ?? confirm?.item.id ?? ''}?`}
        onConfirm={() => {
          if (!confirm) return;
          const mutation = confirm.action === 'deactivate' ? deactivate : reactivate;
          mutation.mutate(confirm.item.id, { onSuccess: () => setConfirm(null) });
        }}
      />
    </PageContainer>
  );
}
