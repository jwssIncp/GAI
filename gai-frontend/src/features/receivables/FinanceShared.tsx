import { navigationContext } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/features/auth/usePermissions";
import { cls, financeApi, statusLabels, type Filters } from "./financeApi";
export function FinanceFilters({ cash = false }: { cash?: boolean }) {
  const [p, set] = useSearchParams();
  return (
    <form
      key={p.toString()}
      className="premium-panel grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget),
          next = navigationContext(p);
        for (const [k, value] of v) {
          next.delete(k);
          if (String(value)) next.set(k, String(value));
        }
        set(next);
      }}
    >
      {[
        ["company_id", "Cliente (ID)"],
        ["project_id", "Projeto (ID)"],
        ["contract_id", "Contrato (ID)"],
        ["date_from", "De"],
        ["date_to", "Até"],
      ].map(([name, label]) => (
        <label key={name} className="grid gap-1 text-sm">
          {label}
          <input
            name={name}
            aria-label={label}
            type={name.startsWith("date") ? "date" : "number"}
            min={name.startsWith("date") ? undefined : 1}
            defaultValue={p.get(name) ?? ""}
            className={cls}
          />
        </label>
      ))}
      <label className="grid gap-1 text-sm">
        Status
        <select
          className={cls}
          name="status"
          defaultValue={p.get("status") ?? ""}
        >
          <option value="">Todos</option>
          {Object.entries(statusLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {cash && (
        <>
          <label className="grid gap-1 text-sm">
            Visão
            <select
              className={cls}
              name="view"
              defaultValue={p.get("view") ?? "all"}
            >
              <option value="all">Previsto e realizado</option>
              <option value="expected">Previsto</option>
              <option value="actual">Realizado</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Movimento
            <select
              className={cls}
              name="direction"
              defaultValue={p.get("direction") ?? "all"}
            >
              <option value="all">Entradas e saídas</option>
              <option value="in">Entradas</option>
              <option value="out">Saídas</option>
            </select>
          </label>
        </>
      )}
      <Button type="submit">Aplicar filtros</Button>
      <Button type="button" variant="secondary" onClick={() => set(navigationContext(p))}>
        Limpar
      </Button>
    </form>
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
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm">
        Exportação
        <select
          aria-label="Tipo de exportação"
          className={cls}
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
          Exportação #{id}: {q.data?.status ?? "aguardando"}
        </span>
      )}
      {(error || q.error || q.data?.error_message) && (
        <p role="alert">{error || q.error?.message || q.data?.error_message}</p>
      )}
    </div>
  );
}
