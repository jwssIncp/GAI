import { EntityCombobox } from "@/components/base/EntityCombobox";
import { companySource, contractSource, projectSource } from "@/components/base/entitySources";
import { StatusBadge } from "@/components/base/StatusBadge";
import { EXPORT_STATUS } from "@/utils/format";
import { navigationContext } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/features/auth/usePermissions";
import { cls, financeApi, statusLabels, type Filters } from "./financeApi";
const idOf = (v: string | null) => (v && Number(v) > 0 ? Number(v) : null);

/**
 * Situação do recebível ou da parcela no badge do mapa financeiro único:
 * em aberto → Previsto; parcial → Parcial (tom neutro); quitado → Recebido;
 * cancelado → Cancelado; com data prevista vencida → Em atraso.
 */
export function ReceivableStatus({ status, overdue }: { status: string; overdue?: boolean }) {
  if (status === "cancelled") return <StatusBadge finance="cancelled" />;
  if (status === "paid") return <StatusBadge finance="received" />;
  if (overdue || status === "overdue") return <StatusBadge finance="overdue" label={status === "partial" ? "Em atraso (parcial)" : undefined} />;
  if (status === "partial") return <StatusBadge finance="forecast" label="Parcial" title="Recebido em parte; saldo em aberto" />;
  return <StatusBadge finance="forecast" label={statusLabels[status]} />;
}

/** Rótulo de filtro no padrão do sistema anterior (pequeno, em maiúsculas). */
const fieldLabel = "text-[0.71875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

/**
 * Filtros de recebíveis: cada mudança vale na hora (vai para a URL, com o ID).
 * `embedded`: dentro de um DataPanel (logo abaixo da faixa azul), sem card próprio.
 */
export function FinanceFilters({ cash = false, embedded = false }: { cash?: boolean; embedded?: boolean }) {
  const [p, set] = useSearchParams();
  const update = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(p);
    for (const [k, value] of Object.entries(changes)) {
      next.delete(k);
      if (value !== null && String(value)) next.set(k, String(value));
    }
    next.delete("page");
    set(next, { replace: true });
  };
  const companyId = idOf(p.get("company_id"));
  const projectId = idOf(p.get("project_id"));
  const select = (name: string, label: string, options: [string, string][], fallback = "") => (
    <label className="grid gap-1.5 text-sm">
      <span className={fieldLabel}>{label}</span>
      <select className={cls} name={name} value={p.get(name) ?? fallback} onChange={(e) => update({ [name]: e.target.value === fallback && fallback !== "" ? null : e.target.value })}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div role="search" aria-label="Filtros" className={embedded ? "grid items-end gap-3 border-b border-border px-5 py-4 sm:grid-cols-3 lg:grid-cols-5" : "grid items-end gap-3 rounded-lg border border-border bg-card px-[18px] py-4 sm:grid-cols-3 lg:grid-cols-5"}>
      <label className="grid gap-1.5 text-sm">
        <span className={fieldLabel}>Cliente</span>
        <EntityCombobox aria-label="Cliente" source={companySource} value={companyId} onChange={(id) => update({ company_id: id })} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className={fieldLabel}>Projeto</span>
        <EntityCombobox
          aria-label="Projeto"
          source={projectSource}
          context={{ company_id: companyId }}
          value={projectId}
          onChange={(id) => update({ project_id: id, contract_id: null })}
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className={fieldLabel}>Contrato</span>
        <EntityCombobox
          aria-label="Contrato"
          source={contractSource}
          context={{ project_id: projectId }}
          requiresContext="Escolha o projeto primeiro"
          value={projectId ? idOf(p.get("contract_id")) : null}
          onChange={(id) => update({ contract_id: id })}
        />
      </label>
      {[
        ["date_from", "De"],
        ["date_to", "Até"],
      ].map(([name, label]) => (
        <label key={name} className="grid gap-1.5 text-sm">
          <span className={fieldLabel}>{label}</span>
          <input name={name} aria-label={label} type="date" value={p.get(name) ?? ""} onChange={(e) => update({ [name]: e.target.value })} className={cls} />
        </label>
      ))}
      {select("status", "Situação", [["", "Todas"], ...Object.entries(statusLabels)])}
      {cash && (
        <>
          {select("view", "Visão", [["all", "Previsto e realizado"], ["expected", "Previsto"], ["actual", "Realizado"]], "all")}
          {select("direction", "Movimento", [["all", "Entradas e saídas"], ["in", "Entradas"], ["out", "Saídas"]], "all")}
        </>
      )}
      <Button type="button" variant="outline" onClick={() => set(navigationContext(p), { replace: true })}>
        Limpar filtros
      </Button>
    </div>
  );
}
export function ExportFinance({
  filters,
  kinds,
}: {
  filters: Filters;
  kinds: string[];
}) {
  const { hasPermission } = usePermissions(),
    [kind, setKind] = useState(kinds[0]),
    [id, setId] = useState<number>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["finance-export", id],
    queryFn: () => financeApi.exportStatus(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      ["pending", "processing"].includes(query.state.data?.status ?? "pending")
        ? 1000
        : false,
  });
  if (!hasPermission("finance:export")) return null;
  const labels: Record<string, string> = {
    receivables: "Recebíveis",
    installments: "Parcelas",
    receipts: "Recebimentos",
    expected: "Fluxo previsto",
    actual: "Fluxo realizado",
    statement: "Extrato filtrado",
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        <span className={fieldLabel}>Exportar</span>
        <select
          aria-label="Tipo de exportação"
          className="min-h-11 rounded-lg border bg-background p-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {labels[k]}
            </option>
          ))}
        </select>
      </label>
      {hasPermission("export-jobs:create") && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setId((await financeApi.export(kind, filters)).id);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Gerar XLSX
        </Button>
      )}
      {q.data?.status === "finished" &&
        hasPermission("export-jobs:download") && (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await financeApi.download(id!);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Baixar XLSX
          </Button>
        )}
      {id && (
        <span className="text-sm">
          Exportação #{id}: {q.data ? (EXPORT_STATUS[q.data.status] ?? q.data.status) : "Na fila"}
        </span>
      )}
      {(error || q.error || q.data?.error_message) && (
        <p role="alert" className="text-sm text-destructive-text">{error || q.error?.message || q.data?.error_message}</p>
      )}
    </div>
  );
}
