import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/api/http";
import { Kpi, KpiGrid } from "@/components/base/Cards";
import { DataPanel } from "@/components/base/DataPanel";
import { ErrorState, LoadingState } from "@/components/base/States";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import type { CommercialData } from "@/features/contracts/CommercialOverview";
import { contractMoney } from "@/features/contracts/contractsApi";
import { projectStatuses } from "@/features/dashboard/projectStatuses";
import { formatInteger } from "@/utils/format";

interface Overview {
  total_projects: number;
  open_projects: number;
  statuses: { status: string; total: number }[];
  geography?: { state: string; total: number }[];
}

const colors = [
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-5))",
];

/**
 * Visão gerencial (dashboard da organização e indicadores comerciais) só existe para o
 * administrador da organização; os demais perfis veem os KPIs de contagem da lista.
 */
function useOrganizationDashboardAccess() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const overview = Boolean(
    user?.role_assignments.some((r) => r.role_key === "ORG_ADMIN") &&
      !user.role_assignments.some((r) => r.role_key === "PLATFORM_ADMIN"),
  );
  return {
    overview,
    commercial: overview && hasPermission("commercial-indicators:read"),
  };
}

function useCommercial(filters: Record<string, string>, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["commercial-overview", user?.id, user?.organization_id, filters],
    queryFn: ({ signal }) =>
      api
        .get<CommercialData>("/organization-overview/commercial", {
          params: filters,
          signal,
        })
        .then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });
}

/** Os 6 KPIs do Painel Geral, na ordem do sistema anterior. */
export function ProjectsKpis({
  filters,
  total,
  open,
}: {
  filters: Record<string, string>;
  total?: number;
  open?: number;
}) {
  const access = useOrganizationDashboardAccess();
  const commercial = useCommercial(filters, access.commercial);
  const brl =
    commercial.data?.totals.find((t) => t.currency === "BRL") ??
    commercial.data?.totals[0];
  const money = (value: string | null | undefined) =>
    !access.commercial
      ? "—"
      : commercial.isPending
        ? "…"
        : brl
          ? contractMoney(value ?? null, brl.currency)
          : "Não informado";
  const noAccess = access.commercial
    ? undefined
    : "Indicador comercial restrito ao administrador da organização.";
  return (
    <KpiGrid label="Indicadores dos projetos filtrados">
      <Kpi
        group="next"
        tinted
        label="Valor total em contratos"
        value={money(brl?.current.value)}
        hint={
          noAccess ??
          (brl
            ? `${brl.current.known} contrato(s) com valor; ${brl.current.missing} sem valor.`
            : undefined)
        }
      />
      <Kpi
        group="next"
        label="Quantidade de projetos"
        value={total == null ? "…" : formatInteger(total)}
      />
      <Kpi
        group="next"
        label="Projetos em aberto"
        value={open == null ? "…" : formatInteger(open)}
        hint="Critério atual: status Ativo."
      />
      <Kpi
        group="next"
        label="Ticket médio"
        value={money(brl?.average)}
        hint={noAccess ?? "Valor vigente ÷ contratos com valor."}
      />
      <Kpi
        group="next"
        label="Valor em contratos abertos"
        value={money(brl?.active.value)}
        hint={
          noAccess ??
          (brl ? `${brl.active_count} contrato(s) ativo(s) na vigência.` : undefined)
        }
      />
      <Kpi
        group="next"
        label="Quantidade de itens em contratos"
        value={
          !access.commercial
            ? "—"
            : commercial.data
              ? commercial.data.estimated_assets == null
                ? "Não informado"
                : formatInteger(commercial.data.estimated_assets)
              : "…"
        }
        hint={
          noAccess ??
          (commercial.data
            ? `${commercial.data.missing_estimated_assets} contrato(s) sem estimativa.`
            : undefined)
        }
      />
    </KpiGrid>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Donut({
  label,
  rows,
  selected,
  onSelect,
}: {
  label: string;
  rows: { key: string; name: string; total: number }[];
  selected?: string;
  onSelect?: (key?: string) => void;
}) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  if (!total)
    return <p className="text-sm text-muted-foreground">Sem dados no recorte.</p>;
  return (
    <div className="grid gap-3">
      <div className="h-48" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="total"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              isAnimationActive={false}
              onClick={
                onSelect
                  ? (entry: { key: string }) =>
                      onSelect(selected === entry.key ? undefined : entry.key)
                  : undefined
              }
            >
              {rows.map((row, i) => (
                <Cell key={row.key} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [
                `${formatInteger(value)} (${Math.round((value / total) * 100)}%)`,
                "Total",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-2 text-xs">
        {rows.map((row, i) => {
          const text = `${row.name}: ${formatInteger(row.total)} (${Math.round((row.total / total) * 100)}%)`;
          const dot = (
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
          );
          return (
            <li key={row.key}>
              {onSelect ? (
                <button
                  type="button"
                  aria-pressed={selected === row.key}
                  className="inline-flex items-center gap-1.5 rounded border px-2 py-1 aria-pressed:border-navy aria-pressed:font-bold"
                  onClick={() =>
                    onSelect(selected === row.key ? undefined : row.key)
                  }
                >
                  {dot}
                  {text}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1">
                  {dot}
                  {text}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Ranking({
  rows,
  unit,
}: {
  rows: { key: string; label: string; total: number }[];
  unit: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">Sem dados no recorte.</p>;
  return (
    <ol className="grid gap-2 text-sm">
      {rows.map((row) => (
        <li key={row.key} className="grid gap-1">
          <span className="flex justify-between gap-2">
            <span className="truncate font-medium">{row.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatInteger(row.total)} {unit}
            </span>
          </span>
          <span className="h-2 rounded bg-muted">
            <span
              className="block h-2 rounded bg-[hsl(var(--chart-2))]"
              style={{ width: `${(row.total / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Painel "Dashboard" recolhível do Painel Geral: por ano, status, recorrência, top
 * segmentos e UF (top 6). O funil das etapas depende do backend (fase 2).
 */
export function ProjectsDashboard({
  filters,
  status,
  onStatus,
}: {
  filters: Record<string, string>;
  status?: string;
  onStatus: (status?: string) => void;
}) {
  const { user } = useAuth();
  const access = useOrganizationDashboardAccess();
  const [hidden, setHidden] = useState(false);
  const overview = useQuery({
    queryKey: ["organization-overview", user?.id, user?.organization_id, filters],
    queryFn: ({ signal }) =>
      api
        .get<Overview>("/organization-overview", { params: filters, signal })
        .then((r) => r.data),
    enabled: access.overview && !hidden,
    staleTime: 30_000,
  });
  const commercial = useCommercial(filters, access.commercial && !hidden);
  if (!access.overview) return null;
  const annual = (commercial.data?.annual ?? []).map((a) => {
    const t = a.totals.find((x) => x.currency === "BRL") ?? a.totals[0];
    return {
      year: a.year,
      count: a.count,
      value: t?.current.value == null ? 0 : Number(t.current.value),
      average: t?.average == null ? 0 : Number(t.average),
    };
  });
  const brl =
    commercial.data?.totals.find((t) => t.currency === "BRL") ??
    commercial.data?.totals[0];
  const money = (v: number) => contractMoney(String(v), brl?.currency ?? "BRL");
  return (
    <DataPanel
      title="Dashboard"
      titleId="projects-dashboard-title"
      contentId="projects-dashboard"
      hidden={hidden}
      onToggle={() => setHidden(!hidden)}
    >
      {overview.isPending ? (
        <LoadingState label="Carregando dashboard" />
      ) : overview.isError ? (
        <ErrorState onRetry={() => void overview.refetch()} />
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">
          {access.commercial ? (
            <ChartCard title="Valor, quantidade e ticket médio por ano">
              {annual.length ? (
                <div className="h-56" role="img" aria-label="Valor em contratos por ano">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={annual}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" />
                      <YAxis hide />
                      <Tooltip
                        formatter={(value: number, name: string) =>
                          name === "Contratos"
                            ? [formatInteger(value), name]
                            : [money(value), name]
                        }
                      />
                      <Bar
                        isAnimationActive={false}
                        name="Valor"
                        dataKey="value"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem contratos datados no recorte.
                </p>
              )}
              <table className="mt-3 w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold">Ano</th>
                    <th className="text-right font-semibold">Valor</th>
                    <th className="text-right font-semibold">Qtde</th>
                    <th className="text-right font-semibold">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {annual.map((a) => (
                    <tr key={a.year} className="border-t">
                      <td>{a.year}</td>
                      <td className="text-right tabular-nums">{money(a.value)}</td>
                      <td className="text-right tabular-nums">{formatInteger(a.count)}</td>
                      <td className="text-right tabular-nums">{money(a.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ChartCard>
          ) : null}
          <ChartCard title="Status">
            <Donut
              label="Projetos por status"
              rows={(overview.data?.statuses ?? []).map((s) => ({
                key: s.status,
                name: projectStatuses[s.status] ?? s.status,
                total: s.total,
              }))}
              selected={status}
              onSelect={onStatus}
            />
          </ChartCard>
          {access.commercial && brl ? (
            <ChartCard title="Recorrência (por quantidade)">
              <Donut
                label="Contratos por recorrência"
                rows={[
                  { key: "recurring", name: "Recorrente", total: brl.recurring_count ?? 0 },
                  { key: "single", name: "Não recorrente", total: brl.non_recurring_count },
                  { key: "unknown", name: "Não informado", total: brl.unknown_recurring_count },
                ].filter((r) => r.total)}
              />
            </ChartCard>
          ) : null}
          {access.commercial ? (
            <ChartCard title="Top segmentos">
              <Ranking
                unit="contrato(s)"
                rows={[...(commercial.data?.segments ?? [])]
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 6)
                  .map((s) => ({ key: s.key, label: s.label, total: s.count }))}
              />
            </ChartCard>
          ) : null}
          <ChartCard title="UF (top 6)">
            <Ranking
              unit="projeto(s)"
              rows={[...(overview.data?.geography ?? [])]
                .sort((a, b) => b.total - a.total || a.state.localeCompare(b.state))
                .slice(0, 6)
                .map((g) => ({ key: g.state, label: g.state, total: g.total }))}
            />
          </ChartCard>
          <p className="text-xs text-muted-foreground lg:col-span-2 xl:col-span-3">
            O funil das etapas (Planejamento campo → Campo → Conciliação/Avaliação →
            Cliente/Saneamento → Laudo minuta → Laudo final) e o mapa completo
            continuam na Visão geral; o funil depende da etapa atual do projeto, que
            ainda não existe no cadastro.
          </p>
        </div>
      )}
    </DataPanel>
  );
}
