import { requestFilters } from "@/features/projects/navigationContext";
import { navigationHref } from "@/features/projects/navigationContext";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/base/DataTable";
import { Pagination } from "@/components/base/Pagination";
import { LoadingState, ErrorState, EmptyState } from "@/components/base/States";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import { financeApi, money } from "./financeApi";
import { FinanceFilters, ExportFinance, ReceivableStatus } from "./FinanceShared";
import { FinanceHeaderActions } from "./FinanceLayout";
export function ReceivablesPage() {
  const [p, set] = useSearchParams(),
    filters = requestFilters(p),
    { user } = useAuth(),
    { hasPermission } = usePermissions();
  const q = useQuery({
    queryKey: ["finance", "list", user?.id, filters],
    queryFn: () => financeApi.list(filters),
  });
  return (
    <div className="grid gap-4">
      {/* Ações no cabeçalho: exportar (secundária) e depois "Novo recebível" (primária). */}
      <FinanceHeaderActions>
        <ExportFinance
          filters={filters}
          kinds={["receivables", "installments", "receipts"]}
        />
        {hasPermission("receivables:edit") && (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border border-primary/30 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover"
            to={navigationHref("/app/finance/receivables/new", p)}
          >
            Novo recebível
          </Link>
        )}
      </FinanceHeaderActions>
      <FinanceFilters />
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        q.data && (
          <>
            {q.data.items.length ? (
              <DataTable
                caption="Recebíveis"
                items={q.data.items}
                getKey={(r) => r.id}
                columns={[
                  {
                    header: "Recebível",
                    cell: (r) => (
                      <Link
                        className="font-semibold text-primary"
                        to={navigationHref("/app/finance/receivables/" + r.id, p)}
                      >
                        {r.data.description}
                      </Link>
                    ),
                  },
                  {
                    header: "Cliente / Projeto",
                    cell: (r) =>
                      `${r.company_name ?? "Cliente não encontrado"} / ${r.project_name ?? "Sem projeto"}`,
                  },
                  {
                    header: "Original",
                    numeric: true,
                    cell: (r) => money(r.amount, r.currency),
                  },
                  {
                    header: "Recebido líquido",
                    numeric: true,
                    cell: (r) => money(r.received, r.currency),
                  },
                  {
                    header: "Saldo aberto",
                    numeric: true,
                    cell: (r) => money(r.open, r.currency),
                  },
                  {
                    header: "Situação",
                    cell: (r) => <ReceivableStatus status={r.status} overdue={r.overdue} />,
                  },
                ]}
              />
            ) : (
              <EmptyState
                title="Nenhum recebível com estes filtros."
                description="Mude ou limpe os filtros para ver outros recebíveis."
              />
            )}
            <Pagination
              page={q.data.page}
              totalPages={Math.ceil(q.data.total / q.data.page_size)}
              onPageChange={(page) => {
                const next = new URLSearchParams(p);
                next.set("page", String(page));
                set(next);
              }}
            />
          </>
        )
      )}
    </div>
  );
}
