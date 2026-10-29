import { requestFilters } from "@/features/projects/navigationContext";
import { navigationHref } from "@/features/projects/navigationContext";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/base/DataTable";
import { Pagination } from "@/components/base/Pagination";
import { LoadingState, ErrorState } from "@/components/base/States";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import { financeApi, money, statusLabels } from "./financeApi";
import { FinanceFilters, ExportFinance } from "./FinanceShared";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Contas a receber</h2>
        {hasPermission("receivables:edit") && (
          <span className="inline-flex rounded-lg bg-primary px-4 py-2 text-primary-foreground">
            <Link
              to={
                navigationHref("/app/finance/receivables/new", p)
              }
            >
              Novo recebível
            </Link>
          </span>
        )}
      </div>
      <FinanceFilters />
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        q.data && (
          <>
            <DataTable
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
                    `#${r.companyId} / ${r.projectId ?? "Sem projeto"}`,
                },
                {
                  header: "Original",
                  cell: (r) => money(r.amount, r.currency),
                },
                {
                  header: "Recebido líquido",
                  cell: (r) => money(r.received, r.currency),
                },
                {
                  header: "Saldo aberto",
                  cell: (r) => money(r.open, r.currency),
                },
                {
                  header: "Status",
                  cell: (r) => (
                    <>
                      {statusLabels[r.status]}
                      {r.overdue ? " · Vencido" : ""}
                    </>
                  ),
                },
              ]}
            />
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
      <ExportFinance
        filters={filters}
        kinds={["receivables", "installments", "receipts"]}
      />
    </div>
  );
}
