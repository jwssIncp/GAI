import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { normalizePage } from "@/api/pagination";
import { DataPanel, DataPanelFilters } from "@/components/base/DataPanel";
import { DataTable } from "@/components/base/DataTable";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { Pagination } from "@/components/base/Pagination";
import { SearchInput } from "@/components/base/SearchInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { StatusBadge } from "@/components/base/StatusBadge";
import { useAuth } from "@/features/auth/AuthContext";
import type { Project } from "@/types/api";
import { projectAreaHref, projectAreaTab, rememberedProject } from "./projectArea";
import { useProjects } from "./projectQueries";

/**
 * Sub-aba da área Projetos (Kick-off, Pendências - Campo, Inventário, ...): como no sistema
 * anterior, começa escolhendo o projeto. Com um projeto já escolhido em outra sub-aba, abre
 * direto nele; "Trocar projeto" volta a esta lista (?escolher=1).
 */
export function ProjectAreaPicker({ tabId }: { tabId: string }) {
  const tab = projectAreaTab(tabId);
  const [params] = useSearchParams();
  const { user } = useAuth();
  const remembered = rememberedProject();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const projects = useProjects({
    page,
    page_size: 20,
    search: search || undefined,
    organization_id: user?.organization_id ?? undefined,
    sort_by: "name",
    sort_order: "ASC",
  });
  if (remembered && !params.has("escolher"))
    return <Navigate replace to={projectAreaHref(tab, remembered)} />;
  const data = projects.data ? normalizePage<Project>(projects.data) : null;
  return (
    <PageContainer>
      <PageHeader
        title={tab.label}
        description="Escolha o projeto. Ele continua selecionado ao trocar de aba; use “Trocar projeto” para escolher outro."
      />
      <DataPanel
        title="Projetos"
        titleId="project-area-picker-title"
        count={data ? `${data.totalItems} projeto(s)` : undefined}
      >
        <DataPanelFilters label="Filtros dos projetos">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Buscar nome, código ou descrição"
          />
        </DataPanelFilters>
        {projects.isLoading ? (
          <LoadingState label="Carregando projetos" />
        ) : projects.isError ? (
          <ErrorState
            message={(projects.error as Error).message}
            onRetry={() => void projects.refetch()}
          />
        ) : data ? (
          <>
            <DataTable
              bare
              caption={`Projetos para ${tab.label}`}
              items={data.items}
              getKey={(item) => item.id}
              columns={[
                {
                  header: "Projeto",
                  cell: (item) => (
                    <Link
                      className="font-semibold text-primary hover:underline"
                      to={projectAreaHref(tab, item.id)}
                    >
                      {item.name}
                      <span className="block font-mono text-xs font-normal text-muted-foreground">
                        {item.code || `#${item.id}`}
                      </span>
                    </Link>
                  ),
                },
                { header: "Empresa", cell: (item) => item.company_name || "—" },
                { header: "Status", cell: (item) => <StatusBadge value={item.status} /> },
                {
                  header: "Ações",
                  cell: (item) => (
                    <Link
                      className="text-sm font-semibold text-primary hover:underline"
                      to={projectAreaHref(tab, item.id)}
                      aria-label={`Abrir ${tab.label} de ${item.name}`}
                    >
                      Abrir
                    </Link>
                  ),
                },
              ]}
            />
            <div className="px-5 py-3">
              <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
            </div>
          </>
        ) : null}
      </DataPanel>
    </PageContainer>
  );
}
