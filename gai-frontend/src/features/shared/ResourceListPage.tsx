import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { normalizePage } from '@/api/pagination';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/base/DataTable';
import { FilterPanel } from '@/components/base/FilterPanel';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { SearchInput } from '@/components/base/SearchInput';
import { ErrorState, LoadingState } from '@/components/base/States';
import { DrawerForm } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-context';
import { usePermissions } from '@/features/auth/usePermissions';
import { useListState } from '@/hooks/useListState';
import type { NormalizedPage } from '@/types/api';

export function ResourceListPage<T, C>({
  title,
  entityLabel,
  description,
  queryKey,
  permissions,
  createPermissions,
  list,
  create,
  columns,
  getKey,
  form,
}: {
  title: string;
  entityLabel?: string;
  description?: string;
  queryKey: string;
  permissions?: string[];
  createPermissions?: string[];
  list: (params: any) => Promise<any>;
  create?: (payload: C) => Promise<T>;
  columns: Column<T>[];
  getKey: (item: T) => string | number;
  form?: (submit: (payload: C) => void, busy: boolean) => ReactNode;
}) {
  const { canAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const state = useListState();
  const query = useQuery({ queryKey: [queryKey, state.params], queryFn: () => list(state.params) });
  const mutation = useMutation({
    mutationFn: (payload: C) => create!(payload),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: 'Registro criado', description: `${entityLabel ?? title} foi adicionado com sucesso.`, tone: 'success' });
    },
    onError: (error) => toast({ title: 'Não foi possível salvar', description: error instanceof Error ? error.message : 'Revise os dados e tente novamente.', tone: 'error' }),
  });
  const page: NormalizedPage<T> | null = query.data ? normalizePage<T>(query.data) : null;
  const canCreate = Boolean(create && form && canAccess(createPermissions));

  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={description}
        action={canCreate ? <Button onClick={() => setOpen(true)}><Plus size={17} /> Novo</Button> : null}
      />
      <FilterPanel><SearchInput value={state.search} onChange={(value) => { state.setSearch(value); state.setPage(1); }} placeholder={`Buscar em ${title.toLowerCase()}`} /></FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : page ? (
        <>
          <DataTable columns={columns} items={page.items} getKey={getKey} />
          <Pagination page={page.page} totalPages={page.totalPages} onPageChange={state.setPage} />
        </>
      ) : null}
      {canCreate && form ? <DrawerForm open={open} onOpenChange={setOpen} title={`Novo ${entityLabel ?? title}`}>{form((payload) => mutation.mutate(payload), mutation.isPending)}</DrawerForm> : null}
      <span className="sr-only">{permissions?.join(',')}</span>
    </PageContainer>
  );
}
