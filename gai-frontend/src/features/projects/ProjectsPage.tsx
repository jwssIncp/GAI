import { Link, useSearchParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { DataTable } from '@/components/base/DataTable';
import { FilterPanel } from '@/components/base/FilterPanel';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { SearchInput } from '@/components/base/SearchInput';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { DrawerForm } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-context';
import { useAuth } from '@/features/auth/AuthContext';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { usePermissions } from '@/features/auth/usePermissions';
import { formatDate } from '@/utils/format';
import type { CreateProjectRequest, Project, ProjectStatus, UpdateProjectRequest } from '@/types/api';
import { ProjectForm } from './ProjectForm';
import { ProjectLifecycleActions } from './ProjectLifecycleActions';
import { CompanySelect, OrganizationSelect } from './ProjectSelectors';
import { canMutateProjectOperations } from './projectLifecycle';
import { useCreateProject, useProject, useProjects, useUpdateProject } from './projectQueries';
import { projectStatuses } from './projectSchemas';

export function ProjectsPage() {
  const { user } = useAuth();
  const { isPlatformAdmin, hasPermission } = usePermissions();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInt(searchParams.get('page')) ?? 1;
  const search = searchParams.get('search') ?? '';
  const status = projectStatus(searchParams.get('status'));
  const organizationId = isPlatformAdmin ? positiveInt(searchParams.get('organization_id')) : user?.organization_id ?? undefined;
  const companyId = positiveInt(searchParams.get('company_id'));
  const params = { page, page_size: 20, search: search || undefined, status, organization_id: organizationId, company_id: companyId };
  const projects = useProjects(params);
  const createProject = useCreateProject();
  const editId = positiveInt(searchParams.get('edit'));
  const editing = useProject(editId);
  const updateProject = useUpdateProject(editId ?? 0);
  const createOpen = searchParams.get('new') === '1';
  const pageData = projects.data ? normalizePage<Project>(projects.data) : null;

  function updateParams(values: Record<string, string | number | undefined>, replace = true) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace });
  }

  function closeDrawer() {
    updateParams({ new: undefined, edit: undefined });
  }

  async function create(payload: CreateProjectRequest | UpdateProjectRequest) {
    await createProject.mutateAsync(payload as CreateProjectRequest);
    closeDrawer();
    toast({ title: 'Projeto criado', description: 'O projeto foi adicionado como rascunho.', tone: 'success' });
  }

  async function update(payload: CreateProjectRequest | UpdateProjectRequest) {
    await updateProject.mutateAsync(payload as UpdateProjectRequest);
    closeDrawer();
    toast({ title: 'Projeto atualizado', description: 'As alteracoes foram salvas.', tone: 'success' });
  }

  const columns = [
    { header: 'Projeto', cell: (item: Project) => <Link className="font-semibold text-primary transition hover:text-primary/80" to={`/app/projects/${item.id}/summary`}>{item.name}</Link> },
    { header: 'Organizacao', cell: (item: Project) => isPlatformAdmin ? `Tenant #${item.organization_id}` : 'Sua organizacao' },
    { header: 'Empresa', cell: (item: Project) => item.company_id ? `Empresa #${item.company_id}` : '-' },
    { header: 'Status', cell: (item: Project) => <StatusBadge value={item.status} /> },
    { header: 'Periodo', cell: (item: Project) => `${formatDate(item.start_date)} - ${formatDate(item.end_date)}` },
    {
      header: 'Acoes',
      cell: (item: Project) => (
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('projects:update') && canMutateProjectOperations(item.status) ? <Button type="button" variant="ghost" size="sm" onClick={() => updateParams({ edit: item.id, new: undefined }, false)}>Editar</Button> : null}
          <ProjectLifecycleActions project={item} compact />
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Projetos"
        description="Projetos de inventario patrimonial organizados por empresa e operacao."
        action={hasPermission('projects:create') ? <Button type="button" onClick={() => updateParams({ new: 1, edit: undefined }, false)}>Novo projeto</Button> : null}
      />
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => updateParams({ search: value, page: 1 })} placeholder="Buscar projeto" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" aria-label="Filtrar projeto por status" value={status ?? ''} onChange={(event) => updateParams({ status: event.target.value, page: 1 })}>
          <option value="">Todos os status</option>
          {projectStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select>
        {isPlatformAdmin ? (
          <div className="w-full md:w-72">
            <OrganizationSelect value={organizationId ? String(organizationId) : ''} onChange={(value) => updateParams({ organization_id: value, company_id: undefined, page: 1 })} />
          </div>
        ) : null}
        {hasPermission('companies:read') ? (
          <div className="w-full md:w-72">
            <CompanySelect organizationId={organizationId} value={companyId ? String(companyId) : ''} onChange={(value) => updateParams({ company_id: value, page: 1 })} />
          </div>
        ) : null}
      </FilterPanel>

      {projects.isLoading ? <LoadingState label="Carregando projetos" /> : null}
      {projects.isError ? <ErrorState message={projects.error instanceof Error ? projects.error.message : undefined} onRetry={() => void projects.refetch()} /> : null}
      {!projects.isLoading && !projects.isError && pageData ? (
        <>
          <DataTable columns={columns} items={pageData.items} getKey={(item) => item.id} />
          <Pagination page={pageData.page} totalPages={pageData.totalPages} onPageChange={(value) => updateParams({ page: value })} />
        </>
      ) : null}

      <PermissionGate permissions={['projects:create']}>
        <DrawerForm open={createOpen} onOpenChange={(open) => !open ? closeDrawer() : undefined} title="Novo projeto">
          <ProjectForm mode="create" busy={createProject.isPending} onSubmit={create} />
        </DrawerForm>
      </PermissionGate>

      <PermissionGate permissions={['projects:update']}>
        <DrawerForm open={Boolean(editId)} onOpenChange={(open) => !open ? closeDrawer() : undefined} title="Editar projeto">
          {editing.isLoading ? <LoadingState label="Carregando projeto" /> : null}
          {editing.isError ? <ErrorState message={editing.error instanceof Error ? editing.error.message : undefined} onRetry={() => void editing.refetch()} /> : null}
          {editing.data && canMutateProjectOperations(editing.data.status) ? <ProjectForm mode="edit" initial={editing.data} busy={updateProject.isPending} onSubmit={update} /> : null}
          {editing.data && !canMutateProjectOperations(editing.data.status) ? <p className="rounded-xl border border-warning/25 bg-warning-subtle/40 p-4 text-sm text-muted-foreground">O status atual mantem o projeto somente para consulta. Os dados principais nao podem ser editados.</p> : null}
        </DrawerForm>
      </PermissionGate>
    </PageContainer>
  );
}

function positiveInt(value: string | null) {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function projectStatus(value: string | null): ProjectStatus | undefined {
  return projectStatuses.includes(value as ProjectStatus) ? value as ProjectStatus : undefined;
}

function statusLabel(status: ProjectStatus) {
  return ({ draft: 'Rascunho', active: 'Ativo', paused: 'Pausado', inactive: 'Inativo', finished: 'Finalizado', cancelled: 'Cancelado', archived: 'Arquivado' })[status];
}
