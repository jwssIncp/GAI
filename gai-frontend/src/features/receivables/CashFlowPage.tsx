import { requestFilters } from "@/features/projects/navigationContext";
import { navigationHref } from "@/features/projects/navigationContext";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/base/DataTable";
import { MetricCard } from "@/components/base/Cards";
import { LoadingState, ErrorState } from "@/components/base/States";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import { FinanceFilters, ExportFinance } from "./FinanceShared";
import { financeApi, money } from "./financeApi";
export function CashFlowPage() {
  const [p] = useSearchParams(),
    filters = requestFilters(p),
    { user } = useAuth(),
    { hasPermission } = usePermissions();
  const q = useQuery({
    queryKey: ["finance", "cash", user?.id, filters],
    queryFn: () => financeApi.cash(filters),
  });
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">Fluxo de caixa</h2>
      <p className="text-sm text-muted-foreground">
        Movimentos conhecidos e obrigações abertas. Resultado do período não é
        saldo bancário.
      </p>
      <FinanceFilters cash />
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        q.data && (
          <>
            <section
              className="premium-panel grid gap-2 p-4 text-sm"
              aria-label="Limitações da projeção"
            >
              {q.data.limitations.map((l) => (
                <p key={l}>{l}</p>
              ))}
              <p>
                Obrigações aprovadas sem data: {q.data.undated_expenses}{" "}
                despesas e {q.data.undated_payments} pagamentos.
              </p>
            </section>
            {q.data.totals.map((t) => (
              <section key={t.currency} className="grid gap-3">
                <h3 className="font-semibold">
                  {t.currency === "UNSPECIFIED"
                    ? "Saídas — moeda não informada"
                    : t.currency}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["A receber / saldo em aberto", t.expected_in],
                    ["Recebido líquido no período", t.actual_in],
                    ["Vencido no período", t.overdue],
                    ["Saídas previstas", t.expected_out],
                    ["Saídas realizadas", t.actual_out],
                    ["Resultado realizado", t.actual_net],
                    ["Resultado projetado", t.projected_net],
                  ].map(([label, value]) => (
                    <MetricCard
                      key={label}
                      label={label}
                      value={money(value, t.currency)}
                    />
                  ))}
                </div>
              </section>
            ))}
            <h3 className="font-semibold">
              Evolução mensal — previsto e realizado
            </h3>
            <DataTable
              items={q.data.monthly}
              getKey={(m) => m.month + m.currency}
              columns={[
                {
                  header: "Mês / Moeda",
                  cell: (m) => `${m.month} · ${m.currency}`,
                },
                {
                  header: "Entradas previstas",
                  cell: (m) => money(m.expected_in, m.currency),
                },
                {
                  header: "Entradas realizadas",
                  cell: (m) => money(m.actual_in, m.currency),
                },
                {
                  header: "Saídas previstas",
                  cell: (m) => money(m.expected_out, m.currency),
                },
                {
                  header: "Saídas realizadas",
                  cell: (m) => money(m.actual_out, m.currency),
                },
                {
                  header: "Resultado projetado",
                  cell: (m) => money(m.projected_net, m.currency),
                },
              ]}
            />
            <h3 className="font-semibold">Por cliente</h3>
            <DataTable
              items={q.data.by_client}
              getKey={(c) => c.company_id + c.currency}
              columns={[
                { header: "Cliente", cell: (c) => "#" + c.company_id },
                {
                  header: "Aberto",
                  cell: (c) => money(c.expected_in, c.currency),
                },
                {
                  header: "Recebido líquido",
                  cell: (c) => money(c.actual_in, c.currency),
                },
                {
                  header: "Vencido",
                  cell: (c) => money(c.overdue, c.currency),
                },
              ]}
            />
            <h3 className="font-semibold">Por projeto</h3>
            <DataTable
              items={q.data.by_project}
              getKey={(c) => String(c.project_id) + c.currency}
              columns={[
                {
                  header: "Projeto",
                  cell: (c) =>
                    c.project_id ? "#" + c.project_id : "Sem projeto",
                },
                {
                  header: "Aberto",
                  cell: (c) => money(c.expected_in, c.currency),
                },
                {
                  header: "Recebido líquido",
                  cell: (c) => money(c.actual_in, c.currency),
                },
                {
                  header: "Saídas realizadas",
                  cell: (c) => money(c.actual_out, c.currency),
                },
              ]}
            />
            <h3 className="font-semibold">Movimentos e rastreabilidade</h3>
            <DataTable
              items={q.data.movements.slice(0, 200)}
              getKey={(m) => m.source + m.source_id}
              columns={[
                { header: "Data", cell: (m) => m.on },
                {
                  header: "Descrição",
                  cell: (m) =>
                    m.receivable_id && hasPermission("receivables:read") ? (
                      <Link
                        className="text-primary"
                        to={navigationHref("/app/finance/receivables/" + m.receivable_id, p)}
                      >
                        {m.description}
                      </Link>
                    ) : (
                      m.description
                    ),
                },
                { header: "Fonte", cell: (m) => `${m.source} #${m.source_id}` },
                {
                  header: "Visão",
                  cell: (m) =>
                    `${m.view === "actual" ? "Realizado" : "Previsto"} · ${m.direction === "in" ? "Entrada" : "Saída"}`,
                },
                { header: "Valor", cell: (m) => money(m.amount, m.currency) },
              ]}
            />
            {q.data.movements.length > 200 && (
              <p className="text-sm">
                Exibindo os primeiros 200 movimentos. Refine os filtros ou
                exporte todas as linhas do recorte.
              </p>
            )}
            <details className="premium-panel p-4 text-sm">
              <summary>Critérios dos indicadores</summary>
              {Object.entries(q.data.definitions).map(([k, v]) => (
                <p key={k} className="mt-2">
                  {v}
                </p>
              ))}
            </details>
          </>
        )
      )}
      <ExportFinance
        filters={filters}
        kinds={["statement", "expected", "actual"]}
      />
    </div>
  );
}
