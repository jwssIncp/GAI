import { navigationContext } from "@/features/projects/navigationContext";
import { navigationHref } from "@/features/projects/navigationContext";
import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EntityCombobox } from "@/components/base/EntityCombobox";
import { companySource, projectSource } from "@/components/base/entitySources";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { DataTable } from "@/components/base/DataTable";
import { Pagination } from "@/components/base/Pagination";
import { ErrorState, LoadingState } from "@/components/base/States";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import { BudgetForm } from "./BudgetForm";
import {
  budgetApi,
  budgetDate,
  budgetMoney,
  budgetStatuses,
} from "./budgetApi";
const idOf = (v?: string) => (Number(v) > 0 ? Number(v) : null);
/**
 * Filtros de empresa e projeto por nome. Os IDs seguem para a URL pelos campos
 * ocultos company_id e project_id; ao abrir por link, o rótulo vem do ID. O
 * projeto é filtrado pela empresa escolhida.
 */
function CompanyProjectFilters({
  companyId,
  projectId,
  organizationId,
}: {
  companyId: number | null;
  projectId: number | null;
  organizationId: number | null;
}) {
  const [company, setCompany] = useState(companyId),
    [project, setProject] = useState(projectId),
    ids = useId();
  return (
    <>
      <div className="grid gap-1 text-sm">
        <label htmlFor={ids + "-company"}>Empresa</label>
        <EntityCombobox
          id={ids + "-company"}
          aria-label="Empresa"
          source={companySource}
          context={{ organization_id: organizationId }}
          name="company_id"
          value={company}
          onChange={(id) => {
            setCompany(id);
            setProject(null);
          }}
          placeholder="Todas as empresas"
        />
      </div>
      <div className="grid gap-1 text-sm">
        <label htmlFor={ids + "-project"}>Projeto</label>
        <EntityCombobox
          id={ids + "-project"}
          aria-label="Projeto"
          source={projectSource}
          context={{ company_id: company }}
          name="project_id"
          value={project}
          onChange={setProject}
          placeholder={company ? "Projetos da empresa" : "Todos os projetos"}
        />
      </div>
    </>
  );
}
/** Nome da empresa quando o orçamento ainda não tem versão calculada. */
function CompanyName({ id }: { id: number }) {
  const q = useQuery({
    queryKey: [companySource.key, "one", id, "{}"],
    queryFn: () => companySource.one!(id, {}),
    staleTime: 60_000,
  });
  return q.isPending ? "Carregando…" : (q.data?.label ?? "Empresa sem acesso");
}
export function BudgetsPage() {
  const [params, setParams] = useSearchParams(),
    [open, setOpen] = useState(false),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient(),
    navigate = useNavigate();
  const filters = Object.fromEntries(
    [
      "search",
      "status",
      "company_id",
      "project_id",
      "page",
      "organization_id",
    ].flatMap((k) => (params.get(k) ? [[k, params.get(k)!]] : [])),
  );
  const query = useQuery({
    queryKey: ["budgets", user?.id, user?.organization_id, filters],
    queryFn: () => budgetApi.list(filters),
  });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Carteira de orçamentos</h2>
        {hasPermission("budgets:edit") ? (
          <Button onClick={() => setOpen(true)}>Novo orçamento</Button>
        ) : null}
      </div>
      <form
        key={params.toString()}
        className="premium-panel grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const context = navigationContext(params);
          context.delete("project_id");
          setParams(
            { ...Object.fromEntries(context), ...Object.fromEntries(
              [...f.entries()]
                .filter(([, v]) => String(v))
                .map(([k, v]) => [k, String(v)]),
            ) },
          );
        }}
      >
        <label className="grid gap-1 text-sm">
          Buscar número
          <input
            className="rounded border bg-background p-2"
            name="search"
            maxLength={120}
            defaultValue={filters.search}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Status do orçamento
          <select
            aria-label="Status do orçamento"
            className="rounded border bg-background p-2"
            name="status"
            defaultValue={filters.status}
          >
            <option value="">Todos</option>
            {Object.entries(budgetStatuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <CompanyProjectFilters
          companyId={idOf(filters.company_id)}
          projectId={idOf(filters.project_id)}
          organizationId={idOf(filters.organization_id)}
        />
        <div className="flex gap-3">
          <Button type="submit">Aplicar filtros</Button>
          <Button type="button" variant="outline" onClick={() => setParams(navigationContext(params))}>
            Limpar filtros
          </Button>
        </div>
      </form>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={query.error.message} />
      ) : (
        <>
          <DataTable
            items={query.data?.items ?? []}
            getKey={(b) => b.id}
            columns={[
              {
                header: "Orçamento",
                cell: (b) => (
                  <Link
                    className="font-semibold text-primary underline"
                    to={navigationHref(`/app/budgets/${b.id}`, params)}
                  >
                    {b.number}
                  </Link>
                ),
              },
              {
                header: "Empresa",
                cell: (b) =>
                  b.current?.snapshot.context.company.name ?? (
                    <CompanyName id={b.companyId} />
                  ),
              },
              {
                header: "Projeto",
                cell: (b) =>
                  b.current?.snapshot.context.project?.name ??
                  "Anterior ao projeto",
              },
              { header: "Status", cell: (b) => budgetStatuses[b.status] },
              {
                header: "Validade",
                cell: (b) =>
                  b.current
                    ? budgetDate(b.current.snapshot.input.valid_until)
                    : "Não informada",
              },
              {
                header: "Preço",
                cell: (b) =>
                  b.current
                    ? budgetMoney(
                        b.current.snapshot.calculation.final_price,
                        b.current.snapshot.calculation.currency,
                      )
                    : "Não calculado",
              },
            ]}
          />
          <Pagination
            page={query.data?.page ?? 1}
            totalPages={Math.ceil((query.data?.total ?? 0) / 20)}
            onPageChange={(page) => {
              const p = new URLSearchParams(params);
              p.set("page", String(page));
              setParams(p);
            }}
          />
        </>
      )}
      <ModalForm open={open} onOpenChange={setOpen} title="Novo orçamento">
        <BudgetForm
          onSave={async (dto) => {
            const b = await budgetApi.create(dto);
            await cache.invalidateQueries({ queryKey: ["budgets"] });
            setOpen(false);
            navigate(navigationHref(`/app/budgets/${b.id}`, params));
          }}
        />
      </ModalForm>
    </div>
  );
}
