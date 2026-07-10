import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, RotateCcw, UserX } from 'lucide-react';
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
import { FieldAgentDetailDrawer } from './FieldAgentDetailDrawer';
import { FieldAgentForm } from './FieldAgentForm';
import { useChangeFieldAgentStatus, useCreateFieldAgent, useFieldAgents, useUpdateFieldAgent } from './fieldAgentsQueries';
import { formatDate } from '@/utils/format';
import type { FieldAgent, FieldAgentStatus } from '@/types/api';

export function FieldAgentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FieldAgentStatus | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FieldAgent | null>(null);
  const [viewingId, setViewingId] = useState<number | undefined>();
  const [confirm, setConfirm] = useState<{ action: 'deactivate' | 'reactivate'; item: FieldAgent } | null>(null);
  const params = useMemo(() => ({ page, page_size: 20, search: search || undefined, status: status || undefined }), [page, search, status]);
  const query = useFieldAgents(params);
  const create = useCreateFieldAgent();
  const update = useUpdateFieldAgent();
  const deactivate = useChangeFieldAgentStatus('deactivate');
  const reactivate = useChangeFieldAgentStatus('reactivate');
  const { hasPermission } = usePermissions();
  const data = query.data ? normalizePage(query.data) : null;

  const columns: Column<FieldAgent>[] = [
    { header: 'Nome', cell: (item) => <div className="font-medium">{item.name}<div className="text-xs text-muted-foreground">#{item.id}</div></div> },
    { header: 'Email', cell: (item) => item.email ?? '-' },
    { header: 'Telefone', cell: (item) => item.phone ?? '-' },
    { header: 'Documento', cell: (item) => item.document ?? '-' },
    { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
    { header: 'Criado em', cell: (item) => formatDate(item.created_at) },
    {
      header: 'Acoes',
      cell: (item) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" aria-label="Visualizar inventariante" onClick={() => setViewingId(item.id)}><Eye size={16} /></Button>
          <PermissionGate permissions={['field-agents:update']}>
            <Button type="button" variant="ghost" aria-label="Editar inventariante" onClick={() => setEditing(item)}><Pencil size={16} /></Button>
          </PermissionGate>
          {item.status === 'active' ? (
            <PermissionGate permissions={['field-agents:deactivate']}>
              <Button type="button" variant="ghost" aria-label="Desativar inventariante" onClick={() => setConfirm({ action: 'deactivate', item })}><UserX size={16} /></Button>
            </PermissionGate>
          ) : (
            <PermissionGate permissions={['field-agents:reactivate']}>
              <Button type="button" variant="ghost" aria-label="Reativar inventariante" onClick={() => setConfirm({ action: 'reactivate', item })}><RotateCcw size={16} /></Button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Inventariantes"
        description="Cadastro e acompanhamento dos inventariantes por organization."
        action={hasPermission('field-agents:create') ? <Button type="button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Novo inventariante</Button> : null}
      />
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar por nome, email ou documento" />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={status}
          onChange={(event) => { setStatus(event.target.value as FieldAgentStatus | ''); setPage(1); }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : data ? (
        <>
          <DataTable columns={columns} items={data.items} getKey={(item) => item.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}

      <DrawerForm open={createOpen} onOpenChange={setCreateOpen} title="Novo inventariante">
        <FieldAgentForm
          mode="create"
          busy={create.isPending}
          onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })}
        />
      </DrawerForm>
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar inventariante">
        {editing ? <FieldAgentForm mode="edit" initial={editing} busy={update.isPending} onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} /> : null}
      </DrawerForm>
      <FieldAgentDetailDrawer id={viewingId} open={Boolean(viewingId)} onOpenChange={(open) => !open && setViewingId(undefined)} />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.action === 'deactivate' ? 'Desativar inventariante' : 'Reativar inventariante'}
        description={`Confirmar alteracao de status de ${confirm?.item.name ?? 'inventariante'}?`}
        onConfirm={() => {
          if (!confirm) return;
          const mutation = confirm.action === 'deactivate' ? deactivate : reactivate;
          mutation.mutate(confirm.item.id, { onSuccess: () => setConfirm(null) });
        }}
      />
    </PageContainer>
  );
}
