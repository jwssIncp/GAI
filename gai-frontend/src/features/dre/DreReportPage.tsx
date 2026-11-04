import { navigationContext } from "@/features/projects/navigationContext";
import { navigationHref } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/base/DataTable";
import { MetricCard } from "@/components/base/Cards";
import { LoadingState, ErrorState } from "@/components/base/States";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import {
  cls,
  dreApi,
  money,
  scope,
  type Calculated,
  type Line,
} from "./dreApi";
const current = () => new Date().toISOString().slice(0, 7);
const value = (t: Calculated, key: string) =>
  t.lines.find((l) => l.key === key)?.known_amount ?? "0.00";
export function DreReportPage() {
  const [p, setP] = useSearchParams(),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    f = {
      ...scope(p),
      start_month: p.get("start_month") ?? current(),
      end_month: p.get("end_month") ?? current(),
      ...(p.get("compare_start_month")
        ? {
            compare_start_month: p.get("compare_start_month")!,
            compare_end_month: p.get("compare_end_month") ?? "",
          }
        : {}),
    };
  const q = useQuery({
      queryKey: ["dre", "report", user?.id, f],
      queryFn: () => dreApi.report(f),
    }),
    [expanded, setExpanded] = useState<string>(),
    [kind, setKind] = useState("statement"),
    [job, setJob] = useState<number>(),
    [error, setError] = useState("");
  const exportStatus = useQuery({
    queryKey: ["dre", "export", job],
    queryFn: () => dreApi.exportStatus(job!),
    enabled: !!job,
    refetchInterval: (q) =>
      ["pending", "processing"].includes(q.state.data?.status ?? "pending")
        ? 1000
        : false,
  });
  const details = (ids: number[], currency: string) =>
    q.data?.rows.filter(
      (r) => r.currency === currency && ids.includes(r.entry_id),
    ) ?? [];
  return (
    <div className="grid gap-4">
      <form
        key={p.toString()}
        className="premium-panel grid gap-3 p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget),
            next = navigationContext(p);
          for (const [k,v] of Object.entries(scope(p))) next.set(k,v);
          next.delete("project_id");
          for (const [k, v] of fd) if (v) next.set(k, String(v));
          setP(next);
        }}
      >
        <label className="grid gap-1 text-sm">
          Início da competência
          <input
            className={cls}
            type="month"
            name="start_month"
            defaultValue={f.start_month}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Fim da competência
          <input
            className={cls}
            type="month"
            name="end_month"
            defaultValue={f.end_month}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Projeto (ID, opcional)
          <input
            className={cls}
            type="number"
            min={1}
            name="project_id"
            defaultValue={p.get("project_id") ?? ""}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Comparar desde
          <input
            className={cls}
            type="month"
            name="compare_start_month"
            defaultValue={f.compare_start_month ?? ""}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Comparar até
          <input
            className={cls}
            type="month"
            name="compare_end_month"
            defaultValue={f.compare_end_month ?? ""}
          />
        </label>
        <Button type="submit">Consultar DRE</Button>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          {[
            ["year", "Ano atual"],
            ["ytd", "Acumulado no ano"],
            ["quarter", "Trimestre atual"],
          ].map(([key, label]) => (
            <Button
              type="button"
              key={key}
              variant="secondary"
              onClick={() => {
                const year = Number(current().slice(0, 4)),
                  m = Number(current().slice(5)),
                  start =
                    key === "quarter"
                      ? `${year}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}`
                      : `${year}-01`,
                  end =
                    key === "year"
                      ? `${year}-12`
                      : key === "quarter"
                        ? `${year}-${String(Math.floor((m - 1) / 3) * 3 + 3).padStart(2, "0")}`
                        : current();
                setP({ ...Object.fromEntries(navigationContext(p)), ...scope(p), start_month: start, end_month: end });
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </form>
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        q.data && (
          <>
            <section
              className="premium-panel grid gap-2 p-4 text-sm"
              aria-label="Cobertura da DRE"
            >
              <strong>
                {q.data.complete
                  ? "Cobertura gerencial revisada"
                  : "Apuração parcial — resultado não definitivo"}
              </strong>
              {q.data.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              <p>
                Fontes sem competência: {q.data.pending_sources.length} ·
                Alocações não classificadas: {q.data.unclassified.length} ·
                Origens alteradas: {q.data.stale_sources.length}
              </p>
            </section>
            {!q.data.totals.length && (
              <p className="premium-panel p-5">
                Sem reconhecimento no período. Receita e resultado são
                desconhecidos; não foram assumidos como zero.
              </p>
            )}
            {q.data.totals.map((t) => (
              <section key={t.currency} className="grid gap-3">
                <h3 className="font-semibold">
                  {t.currency} ·{" "}
                  {t.complete ? "Revisado" : "Valores apurados parciais"}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    "revenue",
                    "net_revenue",
                    "direct_cost",
                    "operating_expense",
                    "operating_result",
                    "before_tax",
                  ].map((key) => {
                    const l = t.lines.find((l) => l.key === key)!;
                    return (
                      <MetricCard
                        key={key}
                        label={l.label + (l.complete ? "" : " · parcial")}
                        value={money(l.known_amount, t.currency)}
                      />
                    );
                  })}
                  <MetricCard
                    label="Margem bruta validada"
                    value={
                      t.gross_margin == null
                        ? "Não validada"
                        : t.gross_margin + "%"
                    }
                  />
                  <MetricCard
                    label="Margem operacional validada"
                    value={
                      t.operating_margin == null
                        ? "Não validada"
                        : t.operating_margin + "%"
                    }
                  />
                </div>
                <DataTable
                  items={t.lines}
                  getKey={(l) => l.key}
                  columns={[
                    {
                      header: "Linha da DRE",
                      cell: (l) => (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setExpanded(
                              expanded === t.currency + ":" + l.key
                                ? undefined
                                : t.currency + ":" + l.key,
                            )
                          }
                          aria-expanded={expanded === t.currency + ":" + l.key}
                        >
                          {l.label}
                        </Button>
                      ),
                    },
                    {
                      header: "Apurado",
                      cell: (l) => money(l.known_amount, t.currency),
                    },
                    {
                      header: "Valor validado",
                      cell: (l) =>
                        l.amount == null
                          ? "Não validado"
                          : money(l.amount, t.currency),
                    },
                    {
                      header: "Cobertura",
                      cell: (l) => (l.complete ? "Revisada" : "Incompleta"),
                    },
                    {
                      header: "Comparação",
                      cell: (l) => {
                        const other = q.data?.comparison?.totals
                          .find((x) => x.currency === t.currency)
                          ?.lines.find((x) => x.key === l.key);
                        return other
                          ? `${money(other.known_amount, t.currency)}${other.complete ? "" : " · parcial"}`
                          : "—";
                      },
                    },
                  ]}
                />
                {t.lines
                  .filter((l) => expanded === t.currency + ":" + l.key)
                  .map((l: Line) => (
                    <section key={l.key} className="grid gap-2">
                      <h4 className="font-semibold">
                        Lançamentos de {l.label}
                      </h4>
                      <DataTable
                        items={details(l.entry_ids, t.currency).filter(
                          (r) => r.group !== null && l.groups.includes(r.group),
                        )}
                        getKey={(r) =>
                          r.entry_id + ":" + r.month + ":" + r.account_code
                        }
                        columns={[
                          { header: "Competência", cell: (r) => r.month },
                          {
                            header: "Reconhecimento",
                            cell: (r) => (
                              <Link
                                className="text-primary"
                                to={
                                  navigationHref("/app/finance/dre/entries/" + r.entry_id, p)
                                }
                              >
                                {r.description}
                              </Link>
                            ),
                          },
                          {
                            header: "Conta",
                            cell: (r) => r.account_name ?? "Não classificado",
                          },
                          {
                            header: "Valor",
                            cell: (r) => money(r.amount, r.currency),
                          },
                          {
                            header: "Origem / revisão",
                            cell: (r) =>
                              `${r.source_key ?? "Manual"} · v${r.revision}`,
                          },
                        ]}
                      />
                    </section>
                  ))}
                <div
                  className="premium-panel h-80 p-4"
                  role="img"
                  aria-label={"Evolução mensal da DRE " + t.currency}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={q
                        .data!.monthly.filter((m) => m.currency === t.currency)
                        .map((m) => ({
                          month: m.month,
                          Receita: Number(value(m, "revenue")),
                          Custos: Number(value(m, "direct_cost")),
                          Despesas: Number(value(m, "operating_expense")),
                          Resultado: Number(value(m, "before_tax")),
                        }))}
                    >
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip />
                      <Legend />
                      <Bar isAnimationActive={false} dataKey="Receita" fill="hsl(var(--chart-1))" />
                      <Bar isAnimationActive={false} dataKey="Custos" fill="hsl(var(--chart-3))" />
                      <Bar isAnimationActive={false} dataKey="Despesas" fill="hsl(var(--chart-2))" />
                      <Bar isAnimationActive={false} dataKey="Resultado" fill="hsl(var(--chart-5))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ))}
            <h3 className="font-semibold">
              Distribuição de custos e despesas por conta
            </h3>
            <DataTable
              items={q.data.rows.filter((r) =>
                ["direct_cost", "operating_expense"].includes(r.group ?? ""),
              )}
              getKey={(r) => r.entry_id + ":" + r.month + ":" + r.account_code}
              columns={[
                { header: "Conta", cell: (r) => r.account_name },
                { header: "Competência", cell: (r) => r.month },
                {
                  header: "Projeto",
                  cell: (r) => r.project_id ?? "Sem projeto",
                },
                { header: "Apurado", cell: (r) => money(r.amount, r.currency) },
              ]}
            />
            <h3 className="font-semibold">Comparação entre projetos</h3>
            <DataTable
              items={q.data.by_project}
              getKey={(r) => String(r.project_id) + r.currency}
              columns={[
                {
                  header: "Projeto",
                  cell: (r) => r.project_id ?? "Sem projeto",
                },
                { header: "Moeda", cell: (r) => r.currency },
                {
                  header: "Receita apurada",
                  cell: (r) => money(value(r, "revenue"), r.currency),
                },
                {
                  header: "Resultado parcial",
                  cell: (r) => money(value(r, "before_tax"), r.currency),
                },
              ]}
            />
            <h3 className="font-semibold">Não classificados</h3>
            <DataTable
              items={q.data.unclassified}
              getKey={(r) => r.entry_id + ":" + r.month + ":" + r.account_code}
              columns={[
                {
                  header: "Registro",
                  cell: (r) => (
                    <Link
                      className="text-primary"
                      to={navigationHref("/app/finance/dre/entries/" + r.entry_id, p)}
                    >
                      #{r.entry_id}
                    </Link>
                  ),
                },
                { header: "Competência", cell: (r) => r.month },
                {
                  header: "Valor fora das linhas classificadas",
                  cell: (r) => money(r.amount, r.currency),
                },
                { header: "Motivo", cell: (r) => r.reason },
              ]}
            />
            <p className="text-sm">
              As fontes ainda sem decisão econômica podem ser consultadas em
              Classificações e ajustes. Não foram incluídas em receita ou custo
              automaticamente.
            </p>
            {(q.data.pending_sources.length > 0 ||
              q.data.stale_sources.length > 0) && (
              <section className="grid gap-3">
                <h3 className="font-semibold">
                  Fontes pendentes de revisão econômica
                </h3>
                <DataTable
                  items={[
                    ...q.data.pending_sources.map((s) => ({
                      ...s,
                      review: "Saldo sem competência definida",
                    })),
                    ...q.data.stale_sources.map((s) => ({
                      ...s,
                      review: "Origem alterada após reconhecimento",
                    })),
                  ]}
                  getKey={(s) => s.review + ":" + s.key}
                  columns={[
                    { header: "Origem", cell: (s) => s.key },
                    { header: "Descrição", cell: (s) => s.description },
                    {
                      header: "Valor documental",
                      cell: (s) =>
                        s.amount && s.currency
                          ? money(s.amount, s.currency)
                          : (s.amount ?? "Desconhecido") +
                            " · moeda não informada",
                    },
                    {
                      header: "Saldo sem competência",
                      cell: (s) =>
                        s.remaining_amount
                          ? s.currency
                            ? money(s.remaining_amount, s.currency)
                            : s.remaining_amount + " · moeda não informada"
                          : "Revisar",
                    },
                    { header: "Situação", cell: (s) => s.review },
                    {
                      header: "Ação",
                      cell: () => (
                        <Link
                          className="text-primary"
                          to={
                            "/app/finance/dre/entries?" +
                            new URLSearchParams(scope(p))
                          }
                        >
                          Consultar classificações
                        </Link>
                      ),
                    },
                  ]}
                />
              </section>
            )}
          </>
        )
      )}
      {hasPermission("dre:export") && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Exportar DRE"
            className={cls + " max-w-xs"}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {Object.entries({
              statement: "Demonstrativo consolidado",
              projects: "DRE por projeto",
              monthly: "Comparativo mensal",
              revenue: "Receitas",
              costs: "Custos",
              expenses: "Despesas",
              unclassified: "Não classificados",
            }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {hasPermission("export-jobs:create") && (
            <Button
              onClick={async () => {
                setError("");
                try {
                  setJob((await dreApi.export(kind, f)).id);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Gerar XLSX da DRE
            </Button>
          )}
          {exportStatus.data?.status === "finished" &&
            hasPermission("export-jobs:download") && (
              <Button
                onClick={async () => {
                  try {
                    await dreApi.download(job!);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Baixar XLSX da DRE
              </Button>
            )}
          <span className="text-sm">{exportStatus.data?.status}</span>
        </div>
      )}
      {(error || exportStatus.error || exportStatus.data?.error_message) && (
        <p role="alert">
          {error ||
            exportStatus.error?.message ||
            exportStatus.data?.error_message}
        </p>
      )}
    </div>
  );
}
