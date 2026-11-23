import { formatMoney, formatPercent } from "@/utils/format";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DataPanel } from "@/components/base/DataPanel";
import { FilterPanel } from "@/components/base/FilterPanel";
import { SearchInput } from "@/components/base/SearchInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { useDebouncedValue } from "@/features/field-agents/useDebouncedValue";
import { remunerationApi, remunerationKeys, type RemunerationProjectRow } from "./remunerationApi";

const pct = (value: string | null) => formatPercent(value);

function Percent({ value, alert, limit }: { value: string | null; alert: boolean; limit: string | null }) {
  return (
    <span
      className={alert ? "rounded bg-destructive/15 px-2 py-0.5 font-semibold text-destructive" : ""}
      title={alert && limit ? `Acima do alerta de ${limit.replace(".", ",")}% (parâmetros financeiros)` : undefined}
    >
      {pct(value)}
      {alert ? <span className="sr-only"> (acima do alerta)</span> : null}
    </span>
  );
}

/** Financeiro › Remuneração: lista de projetos da organização (doc 06 §2.1). */
export function RemunerationProjectsPage() {
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [year, setYear] = useState("");
  const [hidden, setHidden] = useState(false);
  const term = useDebouncedValue(search);
  const params = { search: term || undefined, only_open: onlyOpen, year: year ? Number(year) : undefined };
  const query = useQuery({
    queryKey: remunerationKeys.projects(params),
    queryFn: () => remunerationApi.projects(params),
  });
  const data = query.data;
  const limit = data?.parameters.technician_expense_alert_pct ?? null;

  const cell = "numeric border-b px-2.5 py-3";
  return (
    <div className="grid gap-4">
      <div>
        <p className="max-w-4xl text-xs leading-5 text-muted-foreground">
          Despesas de inventariantes = soma do valor final dos lançamentos, sem cancelados. % Inventariantes = despesas de
          inventariantes ÷ valor do contrato; % Contrato líquido = despesas de inventariantes ÷ (contrato − despesas não
          reembolsáveis).{" "}
          {limit
            ? `Alerta acima de ${limit.replace(".", ",")}% (parâmetros financeiros).`
            : <>Sem parâmetros financeiros vigentes: o alerta fica desligado. <Link className="font-semibold underline" to="/app/finance/parameters">Publicar parâmetros</Link></>}
        </p>
      </div>
      <FilterPanel>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por projeto, segmento ou UF" />
        <input
          aria-label="Ano do contrato"
          type="number"
          min={2000}
          placeholder="Ano"
          className="h-10 w-28 rounded-md border bg-background px-3 text-sm"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Somente em aberto
        </label>
      </FilterPanel>
      {query.isLoading ? (
        <LoadingState label="Carregando projetos" />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      ) : data ? (
        // Lista no painel com a faixa azul (padrão do sistema anterior).
        <DataPanel
          title="Projetos"
          titleId="remuneration-projects-title"
          contentId="remuneration-projects"
          count={`${data.items.length} projeto${data.items.length === 1 ? "" : "s"}`}
          hidden={hidden}
          onToggle={() => setHidden(!hidden)}
          extra={
            <span className="text-sm text-white/80">
              Inventariantes <strong className="numeric text-white">{formatMoney(data.subtotal_agents_cost)}</strong>
            </span>
          }
        >
          <div className="max-h-[620px] overflow-auto" role="region" aria-label="Remuneração por projeto" tabIndex={0}>
            <table className="data-table w-full min-w-[960px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 !z-[3] whitespace-nowrap">Projeto</th>
                  {[["Vinculados","Inventariantes vinculados (sem Despesas gerais)"],["Contrato","Valor do contrato"],["Não reemb.","Despesas não reembolsáveis"],["Líquido","Valor líquido do contrato"],["Inventariantes","Despesas de inventariantes"],["% Inventariantes","% de despesas de inventariantes sobre o contrato"],["% Líquido","% sobre o contrato líquido"],["Situação","Situação do projeto"],["Escopo","Escopo do contrato"]].map(([label, full]) => (
                    <th key={label} scope="col" title={full} className="whitespace-nowrap border-b px-2.5 py-3 font-semibold">
                      {label}
                      <span className="sr-only"> ({full})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row: RemunerationProjectRow) => (
                  <tr key={row.id} className="hover:bg-primary/[0.05]">
                    <td className="sticky left-0 z-10 max-w-[13rem] border-b bg-card px-3 py-3 font-medium shadow-[12px_0_12px_-12px_hsl(var(--foreground)/0.25)]">
                      <Link
                        className="block truncate text-primary-text hover:underline"
                        title={row.name}
                        to={`/app/projects/${row.id}/finance/remuneration`}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className={cell}>{row.technicians}</td>
                    <td className={cell}>{formatMoney(row.contract_value)}</td>
                    <td className={cell}>
                      {row.non_reimbursable_expenses === null ? (
                        <span className="text-muted-foreground" title="Informe no contrato quem paga as despesas de campo">não classificado</span>
                      ) : (
                        formatMoney(row.non_reimbursable_expenses)
                      )}
                    </td>
                    <td className={cell}>{row.net_contract_value === null ? "—" : formatMoney(row.net_contract_value)}</td>
                    <td className={cell}>{formatMoney(row.agents_cost)}</td>
                    <td className={cell}><Percent value={row.technician_pct} alert={row.technician_pct_alert} limit={limit} /></td>
                    <td className={cell}><Percent value={row.net_pct} alert={row.net_pct_alert} limit={limit} /></td>
                    <td className="whitespace-nowrap border-b px-2.5 py-3">{row.status_label}</td>
                    <td className="border-b px-2.5 py-3">
                      <div className="flex min-w-[7rem] flex-wrap gap-1">
                        {row.scope.length
                          ? row.scope.map((s) => (
                              <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s}</span>
                            ))
                          : "—"}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.items.length ? (
                  <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">Nenhum projeto com estes filtros.</td></tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={5} className="px-3 py-3">Subtotal dos projetos exibidos ({data.items.length})</td>
                  <td className="numeric px-3 py-3">{formatMoney(data.subtotal_agents_cost)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </DataPanel>
      ) : null}
    </div>
  );
}
