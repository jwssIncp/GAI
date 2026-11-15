import { formatDateTime, formatMonth } from "@/utils/format";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import { cls, dreApi, groups, money, scope, type Period } from "./dreApi";
import { dreClosingApi } from "./dreMonthlyApi";
export function DrePeriodsPage() {
  const [p] = useSearchParams(),
    f = scope(p, false),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient();
  const q = useQuery({
      queryKey: ["dre", "periods", user?.id, f],
      queryFn: () => dreApi.periods(f),
    }),
    [mode, setMode] = useState(""),
    [selected, setSelected] = useState<Period>(),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [historyMonth, setHistoryMonth] = useState<string>(),
    [month, setMonth] = useState(""),
    [freezing, setFreezing] = useState<Period>(),
    [freezeReason, setFreezeReason] = useState("");
  // Verificação do fechamento na DRE mensal (bloqueios e avisos com ciência).
  const check = useQuery({
    queryKey: ["dre", "checklist", month, f],
    queryFn: () => dreClosingApi.checklist(month),
    enabled: mode === "close" && /^\d{4}-\d{2}$/.test(month),
  });
  const monthlyCheck = check.data && !("legacy" in check.data) ? check.data : null;
  const freezePreview = useQuery({
    queryKey: ["dre", "freeze", freezing?.month, f],
    queryFn: () => dreClosingApi.freezePreview(freezing!.month),
    enabled: !!freezing,
  });
  const history = useQuery({
    queryKey: ["dre", "period-history", historyMonth, f],
    queryFn: () => dreApi.period(historyMonth!, f),
    enabled: !!historyMonth,
  });
  const open = (mode: string, row?: Period) => {
    setMode(mode);
    setSelected(row);
    setMonth(row?.month ?? "");
    setKey(crypto.randomUUID());
    setError("");
  };
  return (
    <div className="grid gap-4">
      <h3 className="font-semibold">Fechamento e reabertura de competências</h3>
      <p className="premium-panel p-4 text-sm">
        O fechamento abrange toda a organização, incluindo projetos. Exige
        política aprovada e revisão explícita por moeda. Fechamento parcial não
        transforma dados ausentes em zero e não valida lucro definitivo. Meses
        atuais/futuros não podem ser fechados.
      </p>
      {hasPermission("dre:periods") && (
        <Button onClick={() => open("close")}>Fechar competência</Button>
      )}
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        q.data && (
          <DataTable
            items={q.data}
            getKey={(r) => r.id}
            columns={[
              { header: "Competência", cell: (r) => formatMonth(r.month) },
              {
                header: "Estado",
                cell: (r) => (r.closed ? "Fechada" : "Reaberta"),
              },
              { header: "Moeda revisada", cell: (r) => r.data.currency },
              {
                header: "Cobertura no fechamento",
                cell: (r) =>
                  r.data.snapshot.complete ? "Revisada" : "Parcial",
              },
              { header: "Política", cell: (r) => r.data.policy_reference },
              { header: "Revisão", cell: (r) => r.revision },
              {
                header: "Ações",
                cell: (r) => (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setHistoryMonth(r.month)}
                    >
                      Histórico {formatMonth(r.month)}
                    </Button>
                    {hasPermission("dre:periods") && (
                      <Button
                        variant="secondary"
                        onClick={() => open(r.closed ? "reopen" : "close", r)}
                      >
                        {r.closed ? "Reabrir" : "Fechar"} {formatMonth(r.month)}
                      </Button>
                    )}
                    {hasPermission("dre:periods") && r.closed && r.has_grid === false && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setFreezing(r);
                          setFreezeReason("");
                          setError("");
                        }}
                      >
                        Congelar coluna {formatMonth(r.month)}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )
      )}
      <ModalForm
        open={!!mode}
        onOpenChange={(v) => {
          if (!busy && !v) setMode("");
        }}
        title={mode === "reopen" ? "Reabrir competência" : "Fechar competência"}
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const fd = new FormData(e.currentTarget),
              v = (k: string) => String(fd.get(k) ?? "").trim(),
              c = v("month"),
              row = q.data?.find((r) => r.month === c),
              base = {
                revision: row?.revision ?? 0,
                command_key: key,
                reason: v("reason"),
              };
            try {
              if (mode === "reopen") await dreApi.reopen(c, base, f);
              else
                await dreApi.close(
                  c,
                  {
                    ...base,
                    currency: v("currency"),
                    policy_reference: v("policy_reference"),
                    sources_reviewed: fd.get("sources_reviewed") === "on",
                    reviewed_groups: fd.getAll("reviewed_groups").map(String),
                    allow_incomplete: fd.get("allow_incomplete") === "on",
                    acknowledged: fd.getAll("acknowledged").map(String),
                  },
                  f,
                );
              await cache.invalidateQueries({ queryKey: ["dre"] });
              setMode("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-1 text-sm">
            Competência
            <input
              className={cls}
              type="month"
              name="month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              readOnly={!!selected}
            />
          </label>
          {mode === "close" && (
            <>
              <label className="grid gap-1 text-sm">
                Moeda revisada
                <select
                  className={cls}
                  name="currency"
                  defaultValue={selected?.data.currency ?? "BRL"}
                >
                  {["BRL", "USD", "EUR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Referência da política aprovada
                <input
                  className={cls}
                  name="policy_reference"
                  minLength={10}
                  required
                  defaultValue={selected?.data.policy_reference ?? ""}
                />
              </label>
              {monthlyCheck ? (
                <section aria-label="Verificação do fechamento" className="grid gap-2 rounded-lg border p-3 text-sm">
                  <p className="font-semibold">
                    Verificação da DRE mensal ({monthlyCheck.automatic ? "mês alimentado pelo fluxo" : "mês antes do corte: lançado/importado"})
                  </p>
                  {monthlyCheck.blockers.map((b) => (
                    <p key={b.code} role="alert" className="text-destructive">⛔ {b.message}</p>
                  ))}
                  {monthlyCheck.warnings.map((w) => (
                    <label key={w.code} className="flex items-start gap-2">
                      <input type="checkbox" name="acknowledged" value={w.code} required />
                      <span>Ciente: {w.message}{w.amount ? ` (${money(w.amount, "BRL")})` : ""}</span>
                    </label>
                  ))}
                  {!monthlyCheck.blockers.length && !monthlyCheck.warnings.length ? <p>Sem bloqueios nem avisos.</p> : null}
                </section>
              ) : null}
              {!monthlyCheck && (<>
              <fieldset className="grid gap-2 rounded-lg border p-3">
                <legend>
                  Grupos revisados, inclusive ausência confirmada de fatos
                </legend>
                {Object.entries(groups).map(([v, l]) => (
                  <label className="flex items-start gap-2 text-sm" key={v}>
                    <input type="checkbox" name="reviewed_groups" value={v} />
                    {l}
                  </label>
                ))}
              </fieldset>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="sources_reviewed" />
                Fontes e fatos não classificados foram revisados documentalmente
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="allow_incomplete" />A política
                autoriza fechamento parcial, com lacunas sinalizadas
              </label>
              </>)}
            </>
          )}
          <label className="grid gap-1 text-sm">
            Justificativa
            <input className={cls} name="reason" minLength={5} required />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required />
            Confirmo o efeito sobre toda a organização e o registro auditável
          </label>
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy || (mode === "close" && !!monthlyCheck?.blockers.length)}>
            Confirmar {mode === "reopen" ? "reabertura" : "fechamento"}
          </Button>
        </form>
      </ModalForm>
      <ModalForm
        open={!!freezing}
        onOpenChange={(v) => {
          if (!busy && !v) setFreezing(undefined);
        }}
        title={`Congelar coluna da DRE mensal · ${freezing?.month ?? ""}`}
      >
        {freezePreview.error ? (
          <ErrorState message={freezePreview.error.message} />
        ) : freezePreview.data ? (
          <form
            className="grid gap-3 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              if (freezeReason.trim().length < 5) return setError("Informe o motivo (mínimo de 5 caracteres).");
              setBusy(true);
              try {
                await dreClosingApi.freeze(freezing!.month, freezePreview.data.revision, freezeReason.trim());
                await cache.invalidateQueries({ queryKey: ["dre"] });
                setFreezing(undefined);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Esta competência foi fechada antes da DRE mensal. A coluna abaixo é recalculada hoje e passará a valer, congelada,
              no lugar do cálculo ao vivo. Confira a diferença em relação ao resumo guardado no fechamento:
            </p>
            <table className="w-full">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1">Linha</th>
                  <th className="py-1 text-right">No fechamento</th>
                  <th className="py-1 text-right">Recalculada</th>
                  <th className="py-1 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {freezePreview.data.lines.map((l) => (
                  <tr key={l.key} className="border-t">
                    <td className="py-1">{l.label}</td>
                    <td className="py-1 text-right tabular-nums">{l.stored === null ? "—" : money(l.stored, "BRL")}</td>
                    <td className="py-1 text-right tabular-nums">{money(l.recalculated, "BRL")}</td>
                    <td className={`py-1 text-right tabular-nums ${l.difference && l.difference !== "0.00" ? "font-semibold text-warning" : ""}`}>
                      {l.difference === null ? "—" : money(l.difference, "BRL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="grid gap-1">
              Motivo
              <input className={cls} aria-label="Motivo do congelamento" value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} />
            </label>
            {error && <p role="alert">{error}</p>}
            <Button disabled={busy}>Congelar coluna</Button>
          </form>
        ) : (
          <LoadingState />
        )}
      </ModalForm>
      <ModalForm
        open={!!historyMonth}
        onOpenChange={(v) => {
          if (!v) setHistoryMonth(undefined);
        }}
        title="Histórico de fechamento e reabertura"
      >
        {history.error ? (
          <ErrorState message={history.error.message} />
        ) : history.data ? (
          <>
            <p className="mb-3 break-all text-xs">
              Hash do último snapshot:{" "}
              {history.data.period?.data.hash ?? "Sem fechamento"}
            </p>
            <DataTable
              items={history.data.history}
              getKey={(r) => r.id}
              columns={[
                { header: "Operação", cell: (r) => r.operation },
                { header: "Motivo", cell: (r) => r.reason },
                { header: "Autor", cell: (r) => r.actorId },
                {
                  header: "Data",
                  cell: (r) => formatDateTime(String(r.recordedAt)),
                },
              ]}
            />
          </>
        ) : (
          <LoadingState />
        )}
      </ModalForm>
    </div>
  );
}
