import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilterPanel } from "@/components/base/FilterPanel";
import { SearchInput } from "@/components/base/SearchInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { useDebouncedValue } from "@/features/field-agents/useDebouncedValue";
import { formatMoney } from "@/utils/format";
import { expensesApi, expensesKeys, pctBr, type ExpenseProjectRow } from "./expensesApi";

const COLUMNS: Array<[string, string]> = [
  ["Contrato", "Valor do contrato"],
  ["A reembolsar", "Despesas reembolsáveis ainda não incluídas em lote faturado ao cliente"],
  ["Reembolsáveis", "Despesas reembolsáveis (tipo da própria despesa)"],
  ["Não reemb.", "Despesas não reembolsáveis"],
  ["% Contrato", "(reembolsáveis + não reembolsáveis) ÷ valor do contrato"],
  ["Concluído", "Financeiro do projeto concluído"],
  ["Situação", "Situação do projeto"],
  ["Escopo", "Escopo do contrato"],
];

/** Financeiro › Despesas: lista de projetos da organização (doc 06 §3.1). */
export function ExpenseProjectsPage() {
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [year, setYear] = useState("");
  const term = useDebouncedValue(search);
  const params = { search: term || undefined, only_open: onlyOpen, year: year ? Number(year) : undefined };
  const query = useQuery({ queryKey: expensesKeys.projects(params), queryFn: () => expensesApi.projects(params) });
  const data = query.data;
  const cell = "numeric border-b px-2.5 py-3";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          A reembolsar = despesas com tipo reembolsável que ainda não entraram num lote de reembolso faturado ao cliente
          (a mesma regra em todas as telas). Vale o tipo marcado em cada despesa; o contrato só define o padrão.
        </p>
        {data ? (
          <p
            className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-sm font-semibold"
            title="Total a reembolsar de todos os projetos da organização"
          >
            A reembolsar (todos os projetos): <span className="tabular-nums">{formatMoney(data.total_to_reimburse)}</span>
          </p>
        ) : null}
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
        <div className="premium-panel">
          <div className="overflow-x-auto" role="region" aria-label="Despesas por projeto" tabIndex={0}>
            <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 whitespace-nowrap border-b bg-muted px-3 py-3 font-semibold">Projeto</th>
                  {COLUMNS.map(([label, full]) => (
                    <th key={label} scope="col" title={full} className="whitespace-nowrap border-b px-2.5 py-3 font-semibold">
                      {label}
                      <span className="sr-only"> ({full})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row: ExpenseProjectRow) => (
                  <tr key={row.id} className="hover:bg-primary/[0.05]">
                    <td className="sticky left-0 z-10 max-w-[13rem] border-b bg-card px-3 py-3 font-medium shadow-[12px_0_12px_-12px_hsl(var(--foreground)/0.25)]">
                      <Link className="block truncate text-primary-text hover:underline" title={row.name} to={`/app/projects/${row.id}/finance`}>
                        {row.name}
                      </Link>
                    </td>
                    <td className={cell}>{formatMoney(row.contract_value)}</td>
                    <td className={`${cell} font-semibold`}>{formatMoney(row.to_reimburse)}</td>
                    <td className={cell}>{formatMoney(row.reimbursable)}</td>
                    <td className={cell}>
                      {formatMoney(row.non_reimbursable)}
                      {row.unclassified_count ? (
                        <span className="ml-1 text-xs text-warning-text" title="Despesas antigas sem tipo: não entram em reembolsáveis nem em não reembolsáveis">
                          +{row.unclassified_count} sem tipo
                        </span>
                      ) : null}
                    </td>
                    <td className={cell}>
                      <span
                        className={row.contract_pct_alert ? "rounded bg-destructive/15 px-2 py-0.5 font-semibold text-destructive" : ""}
                        title={row.contract_pct_alert ? "Despesas acima de 100% do contrato" : undefined}
                      >
                        {pctBr(row.contract_pct)}
                        {row.contract_pct_alert ? <span className="sr-only"> (acima de 100%)</span> : null}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b px-2.5 py-3">{row.finance_closed ? "Sim" : "Não"}</td>
                    <td className="whitespace-nowrap border-b px-2.5 py-3">{row.status_label}</td>
                    <td className="border-b px-2.5 py-3">
                      <div className="flex min-w-[7rem] flex-wrap gap-1">
                        {row.scope.length ? row.scope.map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s}</span>) : "—"}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.items.length ? (
                  <tr><td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-muted-foreground">Nenhum projeto com estes filtros.</td></tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2} className="px-3 py-3">Subtotal dos projetos exibidos ({data.items.length})</td>
                  <td className="numeric px-2.5 py-3">{formatMoney(data.subtotal_to_reimburse)}</td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
