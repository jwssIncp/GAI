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
import { maskDocument } from '@/features/field-agents/brazilianContact';
import { formatDate } from '@/utils/format';
import { OrganizationDetailDrawer } from './OrganizationDetailDrawer';
import { OrganizationForm } from './OrganizationForm';
import { useChangeOrganizationStatus, useCreateOrganization, useOrganizations, useUpdateOrganization } from './organizationsQueries';
import type { Organization, OrganizationStatus } from '@/types/api';

export function OrganizationsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrganizationStatus | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [viewingId, setViewingId] = useState<number | undefined>();
  const [confirm, setConfirm] = useState<{ action: 'deactivate' | 'activate'; item: Organization } | null>(null);
  const params = useMemo(
    () => ({ page, page_size: 20, search: search || undefined, status: status || undefined }),
    [page, search, status],
  );
  const query = useOrganizations(params);
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const deactivate = useChangeOrganizationStatus('deactivate');
  const activate = useChangeOrganizationStatus('activate');
  const { hasPermission } = usePermissions();
  const data = query.data ? normalizePage(query.data) : null;

  const columns: Column<Organization>[] = [
    {
      header: 'Razão social',
      cell: (item) => (
        <div className="font-medium">
          {item.legal_name}
          <div className="text-xs text-muted-foreground">{item.trade_name ?? maskDocument(item.cnpj)}</div>
        </div>
      ),
    },
    { header: 'CNPJ', cell: (item) => maskDocument(item.cnpj) },
    { header: 'Contato', cell: (item) => item.contact_email ?? '-' },
    { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
    { header: 'Criada em', cell: (item) => formatDate(item.created_at) },
    {
      header: 'Ações',
      cell: (item) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" aria-label="Visualizar organização" onClick={() => setViewingId(item.id)}>
            <Eye size={16} />
          </Button>
          <PermissionGate permissions={['organizations:write']}>
            <Button type="button" variant="ghost" aria-label="Editar organização" onClick={() => setEditing(item)}>
              <Pencil size={16} />
            </Button>
          </PermissionGate>
          {item.status === 'ACTIVE' ? (
            <PermissionGate permissions={['organizations:write']}>
              <Button type="button" variant="ghost" aria-label="Desativar organização" onClick={() => setConfirm({ action: 'deactivate', item })}>
                <UserX size={16} />
              </Button>
            </PermissionGate>
          ) : (
            <PermissionGate permissions={['organizations:write']}>
              <Button type="button" variant="ghost" aria-label="Reativar organização" onClick={() => setConfirm({ action: 'activate', item })}>
                <RotateCcw size={16} />
              </Button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Organizações"
        description="Estruturas organizacionais que centralizam usuários, empresas e operações."
        action={
          hasPermission('organizations:write') ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={17} /> Nova organização
            </Button>
          ) : null
        }
      />
      <FilterPanel>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Buscar por razão social, nome fantasia ou CNPJ"
        />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as OrganizationStatus | '');
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>
      </FilterPanel>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      ) : data ? (
        <>
          <DataTable columns={columns} items={data.items} getKey={(item) => item.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}

      <DrawerForm open={createOpen} onOpenChange={setCreateOpen} title="Nova organização">
        <OrganizationForm
          mode="create"
          busy={create.isPending}
          onSubmit={async (payload) => {
            await create.mutateAsync(payload);
            setCreateOpen(false);
          }}
        />
      </DrawerForm>
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar organização">
        {editing ? (
          <OrganizationForm
            mode="edit"
            initial={editing}
            busy={update.isPending}
            onSubmit={async (payload) => {
              await update.mutateAsync({ id: editing.id, payload });
              setEditing(null);
            }}
          />
        ) : null}
      </DrawerForm>
      <OrganizationDetailDrawer id={viewingId} open={Boolean(viewingId)} onOpenChange={(open) => !open && setViewingId(undefined)} />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`${actionLabel(confirm?.action)} organização`}
        description={`Confirmar ${actionLabel(confirm?.action).toLowerCase()} de ${confirm?.item.legal_name ?? 'organização'}?`}
        busy={deactivate.isPending || activate.isPending}
        onConfirm={() => {
          if (!confirm) return;
          const mutation = confirm.action === 'deactivate' ? deactivate : activate;
          mutation.mutate(confirm.item.id, { onSuccess: () => setConfirm(null) });
        }}
      />
    </PageContainer>
  );
}

function actionLabel(action?: 'deactivate' | 'activate') {
  return ({ deactivate: 'Desativar', activate: 'Reativar' } as const)[action ?? 'deactivate'];
}
