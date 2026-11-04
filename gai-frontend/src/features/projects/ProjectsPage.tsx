import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { normalizePage } from "@/api/pagination";
import { DataTable } from "@/components/base/DataTable";
import { FilterPanel } from "@/components/base/FilterPanel";
import { MetricCard } from "@/components/base/Cards";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { Pagination } from "@/components/base/Pagination";
import { SearchInput } from "@/components/base/SearchInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-context";
import { useAuth } from "@/features/auth/AuthContext";
import { PermissionGate } from "@/features/auth/PermissionGate";
import { usePermissions } from "@/features/auth/usePermissions";
import { formatDate } from "@/utils/format";
import type {
  Project,
  ProjectStatus,
  ProjectType,
  UpdateProjectRequest,
} from "@/types/api";
import { ProjectForm } from "./ProjectForm";
import { ProjectCreatePage } from "./ProjectCreatePage";
import { ProjectLifecycleActions } from "./ProjectLifecycleActions";
import { ProjectRegistrationSelect } from "./ProjectRegistrationSelect";
import { OrganizationSelect } from "./ProjectSelectors";
import { canMutateProjectOperations } from "./projectLifecycle";
import { useProject, useProjects, useUpdateProject } from "./projectQueries";
import { projectStatuses } from "./projectSchemas";
import {
  formatProjectDate,
  projectTypeLabels,
  projectSelectClass,
} from "./projectFields";
import { navigationHref } from "./navigationContext";

export function ProjectsPage() {
  const { user } = useAuth();
  const { isPlatformAdmin, hasPermission } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInt(searchParams.get("page")) ?? 1;
  const search = searchParams.get("search") ?? "";
  const status = projectStatuses.includes(
    searchParams.get("status") as ProjectStatus,
  )
    ? (searchParams.get("status") as ProjectStatus)
    : undefined;
  const organizationId = isPlatformAdmin
    ? positiveInt(searchParams.get("organization_id"))
    : (user?.organization_id ?? undefined);
  const companyId = positiveInt(searchParams.get("company_id"));
  const typeValue = searchParams.get("project_type");
  const projectType =
    typeValue && Object.hasOwn(projectTypeLabels, typeValue)
      ? (typeValue as ProjectType)
      : undefined;
  const sortBy = [
    "name",
    "code",
    "start_date",
    "end_date",
    "created_at",
  ].includes(searchParams.get("sort_by") ?? "")
    ? (searchParams.get("sort_by") as
        | "name"
        | "code"
        | "start_date"
        | "end_date"
        | "created_at")
    : "created_at";
  const sortOrder =
    searchParams.get("sort_order") === "ASC"
      ? ("ASC" as const)
      : ("DESC" as const);
  const projects = useProjects({
    page,
    page_size: 20,
    search: search || undefined,
    status,
    organization_id: organizationId,
    company_id: companyId,
    project_type: projectType,
    sort_by: sortBy,
    sort_order: sortOrder,
  });
  const editId = positiveInt(searchParams.get("edit"));
  const editing = useProject(editId);
  const updateProject = useUpdateProject(editId ?? 0);
  const pageData = projects.data ? normalizePage<Project>(projects.data) : null;

  function updateParams(
    values: Record<string, string | number | undefined>,
    replace = true,
  ) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace });
  }
  function closeEditor() {
    const back = searchParams.get("return_to");
    if (back && /^\/app\/projects\/\d+\/summary(?:\?|#|$)/.test(back))
      navigate(back);
    else
      updateParams({ new: undefined, edit: undefined, return_to: undefined });
  }
  async function update(payload: UpdateProjectRequest) {
    await updateProject.mutateAsync(payload);
    toast({
      title: "Projeto atualizado",
      description: "As alterações foram salvas.",
      tone: "success",
    });
  }

  if (searchParams.get("new") === "1")
    return (
      <PermissionGate permissions={["projects:create"]}>
        <ProjectCreatePage />
      </PermissionGate>
    );
  if (editId)
    return (
      <PageContainer>
        <PageHeader
          title="Editar projeto"
          description="Atualize o cadastro e o planejamento, preservando os vínculos do projeto."
        />
        <PermissionGate permissions={["projects:update"]}>
          {editing.isLoading ? (
            <LoadingState label="Carregando projeto" />
          ) : null}
          {editing.isError ? (
            <ErrorState
              message={
                editing.error instanceof Error
                  ? editing.error.message
                  : undefined
              }
              onRetry={() => void editing.refetch()}
            />
          ) : null}
          {editing.data && canMutateProjectOperations(editing.data.status) ? (
            <ProjectForm
              key={editId}
              mode="edit"
              initial={editing.data}
              busy={updateProject.isPending}
              onSubmit={update}
              onCancel={closeEditor}
              onComplete={closeEditor}
            />
          ) : null}
          {editing.data && !canMutateProjectOperations(editing.data.status) ? (
            <div className="premium-panel grid gap-4 p-5">
              <p>
                O status atual mantém o projeto somente para consulta. Os dados
                principais não podem ser editados.
              </p>
              <Button type="button" variant="secondary" onClick={closeEditor}>
                Voltar
              </Button>
            </div>
          ) : null}
        </PermissionGate>
      </PageContainer>
    );

  const columns = [
    {
      header: "Projeto",
      cell: (item: Project) => (
        <div className="grid gap-1">
          <Link
            className="font-semibold text-primary hover:underline"
            to={navigationHref(
              `/app/projects/${item.id}/summary`,
              searchParams,
            )}
          >
            {item.name}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            {item.code || `#${item.id}`}
          </span>
        </div>
      ),
    },
    {
      header: "Empresa",
      cell: (item: Project) => item.company_name || "Empresa não disponível",
    },
    {
      header: "Tipo",
      cell: (item: Project) =>
        item.project_type
          ? projectTypeLabels[item.project_type]
          : "Não definido",
    },
    {
      header: "Status",
      cell: (item: Project) => <StatusBadge value={item.status} />,
    },
    {
      header: "Responsável",
      cell: (item: Project) => item.responsible_user_name || "Não definido",
    },
    {
      header: "Período previsto",
      cell: (item: Project) =>
        `${formatProjectDate(item.start_date)} – ${formatProjectDate(item.end_date)}`,
    },
    {
      header: "Criado em",
      cell: (item: Project) => formatDate(item.created_at),
    },
    ...(isPlatformAdmin
      ? [
          {
            header: "Organização",
            cell: (item: Project) => `Organização #${item.organization_id}`,
          },
        ]
      : []),
    {
      header: "Ações",
      cell: (item: Project) => (
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission("projects:update") &&
          canMutateProjectOperations(item.status) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                updateParams({ edit: item.id, new: undefined }, false)
              }
            >
              Editar
            </Button>
          ) : null}
          <ProjectLifecycleActions project={item} compact />
        </div>
      ),
    },
  ];
  return (
    <PageContainer>
      <PageHeader
        title="Projetos"
        description="Planejamento e acompanhamento dos projetos por empresa e operação."
        action={
          hasPermission("projects:create") ? (
            <Button
              type="button"
              onClick={() =>
                navigate(
                  `/app/projects/new?return_to=${encodeURIComponent(`/app/projects?${searchParams}`)}`,
                )
              }
            >
              Novo projeto
            </Button>
          ) : null
        }
      />
      {projects.data?.status_counts ? (
        <div
          className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          aria-label="Indicadores dos projetos filtrados"
        >
          <MetricCard
            label="Total filtrado"
            value={projects.data.total_items}
          />
          {(["draft", "active", "paused", "finished"] as const).map((value) => (
            <MetricCard
              key={value}
              label={statusLabel(value)}
              value={projects.data?.status_counts?.[value] ?? 0}
            />
          ))}
        </div>
      ) : null}
      <FilterPanel>
        <div className="grid w-full min-w-0 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SearchInput
            value={search}
            onChange={(value) => updateParams({ search: value, page: 1 })}
            placeholder="Buscar nome, código ou descrição"
          />
          <select
            className={projectSelectClass}
            aria-label="Filtrar projeto por status"
            value={status ?? ""}
            onChange={(event) =>
              updateParams({ status: event.target.value, page: 1 })
            }
          >
            <option value="">Todos os status</option>
            {projectStatuses.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
          {isPlatformAdmin ? (
            <OrganizationSelect
              value={organizationId ? String(organizationId) : ""}
              onChange={(value) =>
                updateParams({
                  organization_id: value,
                  company_id: undefined,
                  page: 1,
                })
              }
            />
          ) : null}
          {!isPlatformAdmin || organizationId ? (
            <ProjectRegistrationSelect
              key={`company-${organizationId ?? "session"}`}
              resource="companies"
              purpose="filter"
              label="Empresa"
              organizationId={isPlatformAdmin ? organizationId : undefined}
              value={companyId ? String(companyId) : ""}
              onChange={(value) => updateParams({ company_id: value, page: 1 })}
            />
          ) : null}
          <select
            aria-label="Filtrar por tipo"
            className={projectSelectClass}
            value={projectType ?? ""}
            onChange={(event) =>
              updateParams({ project_type: event.target.value, page: 1 })
            }
          >
            <option value="">Todos os tipos</option>
            {Object.entries(projectTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenar projetos por"
            className={projectSelectClass}
            value={sortBy}
            onChange={(event) =>
              updateParams({ sort_by: event.target.value, page: 1 })
            }
          >
            {Object.entries({
              created_at: "Data de criação",
              name: "Nome",
              code: "Código",
              start_date: "Início previsto",
              end_date: "Término previsto",
            }).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Direção da ordenação"
            className={projectSelectClass}
            value={sortOrder}
            onChange={(event) =>
              updateParams({ sort_order: event.target.value, page: 1 })
            }
          >
            <option value="DESC">Decrescente</option>
            <option value="ASC">Crescente</option>
          </select>
        </div>
      </FilterPanel>
      {projects.isLoading ? <LoadingState label="Carregando projetos" /> : null}
      {projects.isError ? (
        <ErrorState
          message={
            projects.error instanceof Error ? projects.error.message : undefined
          }
          onRetry={() => void projects.refetch()}
        />
      ) : null}
      {!projects.isLoading && !projects.isError && pageData ? (
        <>
          <DataTable
            columns={columns}
            items={pageData.items}
            getKey={(item) => item.id}
          />
          <Pagination
            page={pageData.page}
            totalPages={pageData.totalPages}
            onPageChange={(value) => updateParams({ page: value })}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
function positiveInt(value: string | null) {
  const parsed = Number(value);
  return value && Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}
function statusLabel(status: ProjectStatus) {
  return {
    draft: "Rascunho",
    active: "Ativo",
    paused: "Pausado",
    inactive: "Inativo",
    finished: "Finalizado",
    cancelled: "Cancelado",
    archived: "Arquivado",
  }[status];
}
