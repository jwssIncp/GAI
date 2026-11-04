import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/api/http";
import { useAuth } from "@/features/auth/AuthContext";
import { MetricCard } from "@/components/base/Cards";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import {
  contractDate,
  contractMoney,
  contractStatuses,
  type ContractSnapshot,
} from "./contractsApi";
interface Amount {
  value: string | null;
  known: number;
  missing: number;
}
interface Total {
  currency: string;
  count: number;
  original: Amount;
  current: Amount;
  average: string | null;
  active: Amount;
  active_count: number;
  recurring: Amount;
  recurring_count: number | null;
  non_recurring_count: number;
  unknown_recurring_count: number;
}
interface Group {
  label: string;
  count: number;
  totals: Total[];
}
export interface CommercialData {
  operational_stages?: {
    stage: string;
    source: string;
    total: number | null;
    completed: number | null;
    percentage: number | null;
  }[];
  count: number;
  hash: string;
  totals: Total[];
  annual: { year: string; count: number; totals: Total[] }[];
  undated_contracts: number;
  estimated_assets: number | null;
  missing_estimated_assets: number;
  segments: Group[];
  companies: Group[];
  states: Group[];
  statuses: { status: string; count: number }[];
  status_evolution: {
    month: string;
    statuses: { status: string; count: number }[];
  }[];
  rows: (ContractSnapshot & {
    id: number;
    project_id: number;
    revision: number;
  })[];
}
export function CommercialFilters({
  filters,
}: {
  filters: Record<string, string>;
}) {
  const input = "rounded-lg border bg-background p-2";
  return (
    <>
      <label className="grid gap-1 text-sm">
        Contratado a partir de
        <input
          className={input}
          name="contract_from"
          type="date"
          defaultValue={filters.contract_from}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Contratado até
        <input
          className={input}
          name="contract_to"
          type="date"
          defaultValue={filters.contract_to}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Status do contrato
        <select
          className={input}
          name="contract_status"
          defaultValue={filters.contract_status ?? ""}
        >
          <option value="">Todos</option>
          {Object.entries(contractStatuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Segmento
        <input
          className={input}
          name="segment"
          maxLength={120}
          defaultValue={filters.segment}
        />
      </label>
      <label className="grid gap-1 text-sm">
        UF contratante
        <select
          className={input}
          name="contract_state"
          defaultValue={filters.contract_state ?? ""}
        >
          <option value="">Todas</option>
          {"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
            .split(" ")
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Recorrência contratual
        <select
          aria-label="Recorrência contratual"
          className={input}
          name="recurring"
          defaultValue={filters.recurring ?? ""}
        >
          <option value="">Todas</option>
          <option value="true">Recorrente</option>
          <option value="false">Não recorrente</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Serviço contratado
        <input
          className={input}
          name="service"
          maxLength={120}
          defaultValue={filters.service}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Mínimo de bens estimados
        <input
          className={input}
          name="assets_min"
          type="number"
          min="0"
          max="2147483647"
          defaultValue={filters.assets_min}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Máximo de bens estimados
        <input
          className={input}
          name="assets_max"
          type="number"
          min="0"
          max="2147483647"
          defaultValue={filters.assets_max}
        />
      </label>
    </>
  );
}
function Amounts({ totals }: { totals: Total[] }) {
  return (
    <>
      {totals.map((t) => (
        <p key={t.currency}>
          {contractMoney(t.current.value, t.currency)}{" "}
          <span className="text-xs text-muted-foreground">
            ({t.current.missing} sem valor)
          </span>
        </p>
      ))}
    </>
  );
}
export function CommercialOverview({
  filters,
}: {
  filters: Record<string, string>;
}) {
  const { user } = useAuth(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [report, setReport] = useState<number>();
  const query = useQuery({
    queryKey: ["commercial-overview", user?.id, user?.organization_id, filters],
    queryFn: ({ signal }) =>
      api
        .get<CommercialData>("/organization-overview/commercial", {
          params: filters,
          signal,
        })
        .then((r) => r.data),
    staleTime: 30000,
  });
  async function download(format: "csv" | "xlsx") {
    setBusy(true);
    setError("");
    try {
      const saved = await api.post<{ id: number }>(
        "/organization-overview/commercial/reports",
        { ...filters, expected_hash: query.data!.hash },
      );
      setReport(saved.data.id);
      const response = await api.get<Blob>(
        `/organization-overview/commercial/reports/${saved.data.id}/export.${format}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `contratos-${saved.data.id}.${format}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setBusy(false);
    }
  }
  const data = query.data;
  return (
    <section className="grid gap-4" aria-label="Indicadores comerciais">
      <h2 className="text-lg font-semibold">
        Contratos e indicadores comerciais
      </h2>
      <p className="text-sm text-muted-foreground">
        Valores vigentes = original + aditivos. Moedas são apresentadas
        separadamente. Totais conhecidos informam a quantidade sem valor;
        ausência não equivale a zero. UF é a da empresa contratante no cadastro
        do contrato.
      </p>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={query.error.message} />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Contratos no recorte"
              value={String(data.count)}
            />
            <MetricCard
              label="Bens estimados em contratos"
              value={
                data.estimated_assets == null
                  ? "Não informado"
                  : data.estimated_assets.toLocaleString("pt-BR")
              }
              hint={`${data.missing_estimated_assets} contratos sem estimativa.`}
            />
            <MetricCard
              label="Contratos sem data de contratação"
              value={String(data.undated_contracts)}
              hint="Não entram nos indicadores anuais."
            />
          </div>
          {!data.totals.length ? (
            <p className="premium-panel p-5 text-sm">
              Sem dados contratuais para este recorte. Os projetos antigos
              continuam disponíveis.
            </p>
          ) : (
            data.totals.map((t) => (
              <div
                key={t.currency}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                <MetricCard
                  label={`Valor original · ${t.currency}`}
                  value={contractMoney(t.original.value, t.currency)}
                  hint={`${t.original.known} conhecidos; ${t.original.missing} ausentes.`}
                />
                <MetricCard
                  label={`Valor vigente · ${t.currency}`}
                  value={contractMoney(t.current.value, t.currency)}
                  hint={`${t.current.known} conhecidos; ${t.current.missing} ausentes.`}
                  tone="brand"
                />
                <MetricCard
                  label={`Ticket vigente · ${t.currency}`}
                  value={contractMoney(t.average, t.currency)}
                  hint="Soma vigente / contratos com valor conhecido; arredondamento em centavos."
                />
                <MetricCard
                  label={`Contratos ativos na vigência · ${t.currency}`}
                  value={contractMoney(t.active.value, t.currency)}
                  hint={`${t.active_count} contratos com status Ativo e data atual dentro da vigência.`}
                />
                <MetricCard
                  label={`Recorrência por valor · ${t.currency}`}
                  value={contractMoney(t.recurring.value, t.currency)}
                  hint="Valor vigente dos contratos marcados como recorrentes."
                />
                <MetricCard
                  label={`Recorrência por quantidade · ${t.currency}`}
                  value={
                    t.recurring_count == null
                      ? "Não informada"
                      : String(t.recurring_count)
                  }
                  hint={`${t.non_recurring_count} não recorrentes; ${t.unknown_recurring_count} sem informação.`}
                />
              </div>
            ))
          )}
          <h3 className="font-semibold">Contratação por ano</h3>
          <div
            className="premium-panel h-72 min-w-0 p-4"
            role="img"
            aria-label="Quantidade de contratos por ano"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.annual}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar isAnimationActive={false}
                  dataKey="count"
                  name="Contratos"
                  fill="hsl(var(--chart-2))"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            items={data.annual.flatMap((a) =>
              a.totals.map((t) => ({ ...t, year: a.year })),
            )}
            getKey={(t) => `${t.year}:${t.currency}`}
            columns={[
              {
                header: "Ano / moeda",
                cell: (t) => `${t.year} · ${t.currency}`,
              },
              { header: "Contratos", cell: (t) => t.count },
              {
                header: "Original",
                cell: (t) => contractMoney(t.original.value, t.currency),
              },
              {
                header: "Vigente",
                cell: (t) => contractMoney(t.current.value, t.currency),
              },
              {
                header: "Ticket anual vigente",
                cell: (t) => contractMoney(t.average, t.currency),
              },
              { header: "Sem valor", cell: (t) => t.current.missing },
            ]}
          />
          {[
            ["Segmento", data.segments],
            ["Empresa", data.companies],
            ["UF contratante", data.states],
          ].map(([title, groups]) => (
            <section key={String(title)} className="grid gap-3">
              <h3 className="font-semibold">
                Distribuição por {String(title).toLowerCase()}
              </h3>
              <DataTable
                items={groups as Group[]}
                getKey={(g) => g.label}
                columns={[
                  { header: String(title), cell: (g) => g.label },
                  { header: "Contratos", cell: (g) => g.count },
                  {
                    header: "Valor vigente",
                    cell: (g) => <Amounts totals={g.totals} />,
                  },
                ]}
              />
            </section>
          ))}
          <h3 className="font-semibold">Carteira por status</h3>
          <DataTable
            items={data.statuses}
            getKey={(s) => s.status}
            columns={[
              { header: "Status", cell: (s) => contractStatuses[s.status] },
              { header: "Contratos", cell: (s) => s.count },
            ]}
          />
          <h3 className="font-semibold">Evolução dos status contratuais</h3>
          <p className="text-xs text-muted-foreground">
            Último status registrado em cada mês, somente para os contratos que
            atendem ao recorte atual. Histórico iniciado no cadastro neste
            sistema.
          </p>
          <DataTable
            items={data.status_evolution}
            getKey={(s) => s.month}
            columns={[
              { header: "Mês", cell: (s) => s.month },
              {
                header: "Contratos por status",
                cell: (s) =>
                  s.statuses
                    .map((v) => `${contractStatuses[v.status]}: ${v.count}`)
                    .join(" · "),
              },
            ]}
          />
          <h3 className="font-semibold">Progresso das etapas operacionais</h3>
          <p className="text-xs text-muted-foreground">
            Situação atual dos registros nos projetos do mesmo recorte. Cada
            fonte possui seu próprio denominador; ausência de registros não é 0%
            de avanço. Não representa as seis etapas do legado.
          </p>
          <DataTable
            items={data.operational_stages ?? []}
            getKey={(s) => s.stage}
            columns={[
              { header: "Etapa / fonte operacional", cell: (s) => s.stage },
              { header: "Registros", cell: (s) => s.total ?? "Sem dados" },
              { header: "Concluídos", cell: (s) => s.completed ?? "Sem dados" },
              {
                header: "Progresso atual",
                cell: (s) =>
                  s.percentage == null
                    ? "Não disponível"
                    : `${s.percentage.toLocaleString("pt-BR")}%`,
              },
            ]}
          />
          <h3 className="font-semibold">Contratos do recorte</h3>
          <DataTable
            items={data.rows}
            getKey={(r) => r.id}
            columns={[
              {
                header: "Contrato / versão",
                cell: (r) => (
                  <Link
                    className="text-primary underline"
                    to={`/app/projects/${r.project_id}/contracts?contract=${r.id}`}
                  >
                    {r.number} · v{r.revision}
                  </Link>
                ),
              },
              { header: "Contratante", cell: (r) => r.company_name },
              {
                header: "Contratação",
                cell: (r) => contractDate(r.contracted_on),
              },
              { header: "Status", cell: (r) => contractStatuses[r.status] },
              {
                header: "Original",
                cell: (r) => contractMoney(r.original_value, r.currency),
              },
              {
                header: "Vigente",
                cell: (r) => contractMoney(r.current_value, r.currency),
              },
            ]}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy || query.isFetching}
              onClick={() => void download("xlsx")}
            >
              Exportar contratos Excel
            </Button>
            <Button
              variant="outline"
              disabled={busy || query.isFetching}
              onClick={() => void download("csv")}
            >
              Exportar contratos CSV
            </Button>
          </div>
          {report ? (
            <p className="text-xs text-muted-foreground">
              Relatório #{report} preservado com versões e filtros utilizados.
            </p>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </>
      ) : null}
    </section>
  );
}
