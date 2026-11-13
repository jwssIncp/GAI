import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilterPanel } from "@/components/base/FilterPanel";
import { SearchInput } from "@/components/base/SearchInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { useDebouncedValue } from "@/features/field-agents/useDebouncedValue";
import { formatMoney } from "@/utils/format";
import { remunerationApi, remunerationKeys, type RemunerationProjectRow } from "./remunerationApi";

const pct = (value: string | null) => (value === null ? "—" : `${value.replace(".", ",")}%`);

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
  const term = useDebouncedValue(search);
  const params = { search: term || undefined, only_open: onlyOpen, year: year ? Number(year) : undefined };
  const query = useQuery({
    queryKey: remunerationKeys.projects(params),
    queryFn: () => remunerationApi.projects(params),
  });
  const data = query.data;
  const limit = data?.parameters.technician_expense_alert_pct ?? null;

  const cell = "whitespace-nowrap border-b px-3 py-3 tabular-nums";
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">Remuneração dos técnicos por projeto</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Despesas de inventariantes = soma do valor final dos lançamentos, sem cancelados. % Desp. técnicos = despesas de
          inventariantes ÷ valor do contrato; % Contrato líquido = despesas de inventariantes ÷ (contrato − despesas não
          reembolsáveis).{" "}
          {limit
            ? `Alerta acima de ${limit.replace(".", ",")}% (parâmetros financeiros).`
            : "Sem parâmetros financeiros vigentes: o alerta fica desligado."}
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
        <div className="premium-panel">
          <div className="overflow-x-auto" role="region" aria-label="Remuneração por projeto" tabIndex={0}>
            <table className="w-full min-w-[1150px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  {["Projeto", "Qtde téc.", "Valor do contrato", "Desp. não reembolsáveis", "Valor líquido", "Desp. inventariantes", "% Desp. técnicos", "% Contrato líquido", "Status", "Escopo"].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap border-b px-3 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row: RemunerationProjectRow) => (
                  <tr key={row.id} className="hover:bg-primary/[0.05]">
                    <td className="border-b px-3 py-3 font-medium">
                      <Link className="text-primary-text hover:underline" to={`/app/projects/${row.id}/finance/remuneration`}>
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
                    <td className="whitespace-nowrap border-b px-3 py-3">{row.status_label}</td>
                    <td className="border-b px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.scope.length
                          ? row.scope.map((s) => (
                              <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s}</span>
                            ))
                          : "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={5} className="px-3 py-3">Subtotal dos projetos exibidos ({data.items.length})</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatMoney(data.subtotal_agents_cost)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
