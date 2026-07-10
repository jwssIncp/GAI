import { useQuery } from '@tanstack/react-query';
import { rbacApi } from '@/api/endpoints';
import { DataTable } from '@/components/base/DataTable';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { ErrorState, LoadingState } from '@/components/base/States';
import { useAuth } from '@/features/auth/AuthContext';

export function RolesPage() {
  const { user } = useAuth();
  const organizationId = user?.organization_id ?? undefined;
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: rbacApi.permissions });
  const roles = useQuery({ queryKey: ['roles', organizationId], queryFn: () => rbacApi.roles(organizationId!), enabled: Boolean(organizationId) });

  return (
    <PageContainer>
      <PageHeader title="Perfis e acessos" description="Catálogo de permissões e perfis disponíveis por organização." />
      {permissions.isLoading ? <LoadingState /> : permissions.isError ? <ErrorState message={(permissions.error as Error).message} /> : (
        <DataTable
          items={permissions.data ?? []}
          getKey={(item) => item.id}
          columns={[
            { header: 'Permissao', cell: (item) => <div className="font-medium">{item.key}<div className="text-xs text-muted-foreground">{item.description}</div></div> },
            { header: 'Recurso', cell: (item) => item.resource },
            { header: 'Acao', cell: (item) => item.action },
            { header: 'Escopo', cell: (item) => item.scope },
          ]}
        />
      )}
      {!organizationId ? <ErrorState message="Papeis customizados exigem organization_id no usuario autenticado. PLATFORM_ADMIN deve escolher uma organization em rodada futura." /> : roles.isLoading ? <LoadingState /> : roles.data ? (
        <DataTable items={roles.data} getKey={(item) => item.id} columns={[
          { header: 'Perfil', cell: (item) => item.name },
          { header: 'Ativo', cell: (item) => item.is_active ? 'Sim' : 'Nao' },
          { header: 'Permissoes', cell: (item) => item.permissions.length },
          { header: 'Descricao', cell: (item) => item.description ?? '-' },
        ]} />
      ) : null}
    </PageContainer>
  );
}
