import { navigationHref } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { DataTable } from "@/components/base/DataTable";
import { LoadingState, ErrorState } from "@/components/base/States";
import { MetricCard } from "@/components/base/Cards";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import {
  cls,
  financeApi,
  money,
  statusLabels,
  today,
  type Event,
} from "./financeApi";
const operations: Record<string, string> = {
  create: "Criação",
  edit: "Edição",
  receipt: "Recebimento",
  reversal: "Estorno",
  cancel: "Cancelamento",
};
export function ReceivableDetailPage() {
  const { receivableId = "" } = useParams(),
    [p, setP] = useSearchParams(),
    tab = p.get("tab") ?? "installments",
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient();
  const q = useQuery({
    queryKey: ["finance", "detail", user?.id, receivableId],
    queryFn: () => financeApi.detail(receivableId),
  });
  const [modal, setModal] = useState(""),
    [event, setEvent] = useState<Event>(),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const open = (mode: string, e?: Event) => {
    setModal(mode);
    setEvent(e);
    setKey(crypto.randomUUID());
    setError("");
  };
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState message={q.error?.message} />;
  const r = q.data;
  const labels: Record<string, string> = {
    receipt: "Registrar recebimento",
    reversal: "Estornar recebimento",
    cancel: "Cancelar recebível",
    edit: "Editar recebível",
  };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{r.data.description}</h2>
          <p className="text-sm text-muted-foreground">
            Recebível #{r.id} · {statusLabels[r.status]} · Revisão {r.revision}
            {r.overdue ? " · Vencido" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!r.cancelled &&
            hasPermission("receivables:receive") &&
            r.status !== "paid" && (
              <Button onClick={() => open("receipt")}>
                Registrar recebimento
              </Button>
            )}
          {!r.cancelled && hasPermission("receivables:edit") && (
            <>
              <Button variant="secondary" onClick={() => open("edit")}>
                Editar
              </Button>
              <Button variant="secondary" onClick={() => open("cancel")}>
                Cancelar recebível
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Valor original"
          value={money(r.amount, r.currency)}
        />
        <MetricCard
          label="Recebido líquido de estornos"
          value={money(r.received, r.currency)}
        />
        <MetricCard label="Saldo em aberto" value={money(r.open, r.currency)} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="text-primary" to={navigationHref("/app/finance/receivables", p)}>
          Voltar aos recebíveis
        </Link>
        {r.projectId && hasPermission("projects:read") && (
          <Link
            className="text-primary"
            to={navigationHref(`/app/projects/${r.projectId}/summary`, p)}
          >
            Consultar projeto #{r.projectId}
          </Link>
        )}
        {r.contractId && r.projectId && hasPermission("contracts:read") && (
          <Link
            className="text-primary"
            to={navigationHref(`/app/projects/${r.projectId}/contracts?contract=${r.contractId}`, p)}
          >
            Consultar contrato
          </Link>
        )}
        <Link
          className="text-primary"
          to={navigationHref("/app/finance/cash-flow?company_id=" + r.companyId, p)}
        >
          Fluxo do cliente
        </Link>
      </div>
      <nav
        aria-label="Detalhe do recebível"
        className="flex gap-4 border-b pb-3 text-sm"
      >
        {[
          ["installments", "Parcelas"],
          ["history", "Histórico"],
          ["details", "Dados e origem"],
        ].map(([v, l]) => (
          <Button
            key={v}
            variant="ghost"
            className={tab === v ? "text-primary font-bold" : ""}
            onClick={() => setP({ ...Object.fromEntries(p), tab: v })}
          >
            {l}
          </Button>
        ))}
      </nav>
      {tab === "installments" ? (
        <DataTable
          items={r.installments}
          getKey={(i) => i.id}
          columns={[
            { header: "Parcela", cell: (i) => i.position },
            { header: "Vencimento", cell: (i) => i.dueOn },
            { header: "Original", cell: (i) => money(i.amount, r.currency) },
            { header: "Recebido", cell: (i) => money(i.received, r.currency) },
            { header: "Saldo", cell: (i) => money(i.open, r.currency) },
            {
              header: "Situação",
              cell: (i) =>
                `${statusLabels[i.status]}${i.overdue ? " · Vencida" : ""}`,
            },
          ]}
        />
      ) : tab === "history" ? (
        <DataTable
          items={r.events}
          getKey={(e) => e.id}
          columns={[
            {
              header: "Evento",
              cell: (e) => `#${e.id} ${operations[e.operation] ?? e.operation}`,
            },
            { header: "Data efetiva", cell: (e) => e.effectiveOn ?? "—" },
            {
              header: "Valor",
              cell: (e) => (e.amount ? money(e.amount, r.currency) : "—"),
            },
            {
              header: "Referência / Motivo",
              cell: (e) => (
                <>
                  {String(e.details.reference ?? "")}
                  <br />
                  {String(e.details.reason ?? "")}
                </>
              ),
            },
            {
              header: "Auditoria",
              cell: (e) =>
                `Usuário #${e.actorId} · ${new Date(e.recordedAt).toLocaleString("pt-BR")}`,
            },
            {
              header: "Ação",
              cell: (e) =>
                e.operation === "receipt" &&
                !r.cancelled &&
                !r.events.some((v) => v.reversesId === e.id) &&
                hasPermission("receivables:reverse") ? (
                  <Button
                    variant="secondary"
                    onClick={() => open("reversal", e)}
                  >
                    Estornar evento #{e.id}
                  </Button>
                ) : null,
            },
          ]}
        />
      ) : tab === "details" ? (
        <div className="premium-panel grid gap-2 p-5 text-sm">
          <p>
            Cliente #{r.companyId} · Projeto {r.projectId ?? "não vinculado"}
          </p>
          <p>
            Origem: {r.sourceKey ?? "manual"} · Emissão: {r.data.issued_on}
          </p>
          <p>Documento: {r.data.document || "não informado"}</p>
          <p>Observações: {r.data.notes || "não informadas"}</p>
          <p>Justificativa original: {r.data.reason}</p>
          <p>
            Valores, origem e parcelas são imutáveis. Para corrigir a obrigação,
            estorne os recebimentos e cancele com justificativa, preservando o
            histórico.
          </p>
        </div>
      ) : (
        <ErrorState message="Aba inválida." />
      )}
      <ModalForm
        open={!!modal}
        onOpenChange={(v) => {
          if (!busy && !v) setModal("");
        }}
        title={labels[modal] ?? "Operação financeira"}
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const fd = new FormData(e.currentTarget),
              v = (k: string) => String(fd.get(k) ?? "").trim(),
              base = {
                revision: r.revision,
                command_key: key,
                reason: v("reason"),
              };
            try {
              if (modal === "receipt")
                await financeApi.command(receivableId, "receipts", {
                  ...base,
                  installment_id: Number(v("installment_id")),
                  amount: v("amount"),
                  received_on: v("received_on"),
                  method: v("method"),
                  reference: v("reference"),
                  notes: v("notes"),
                });
              else if (modal === "reversal")
                await financeApi.command(
                  receivableId,
                  `receipts/${event!.id}/reverse`,
                  { ...base, reversed_on: v("reversed_on") },
                );
              else if (modal === "cancel")
                await financeApi.command(receivableId, "cancel", base);
              else
                await financeApi.edit(receivableId, {
                  ...base,
                  description: v("description"),
                  document: v("document"),
                  notes: v("notes"),
                });
              await cache.invalidateQueries({ queryKey: ["finance"] });
              setModal("");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {modal === "receipt" && (
            <>
              <label className="grid gap-1 text-sm">
                Parcela
                <select name="installment_id" className={cls} required>
                  {r.installments
                    .filter((i) => i.status !== "paid")
                    .map((i) => (
                      <option value={i.id} key={i.id}>
                        Parcela {i.position} · {i.dueOn} · Saldo{" "}
                        {money(i.open, r.currency)}
                      </option>
                    ))}
                </select>
              </label>
              {[
                ["amount", "Valor recebido", "text", ""],
                ["received_on", "Data do recebimento", "date", today()],
                ["method", "Forma de recebimento", "text", ""],
                ["reference", "Referência única do recebimento", "text", ""],
              ].map(([name, label, type, value]) => (
                <label key={name} className="grid gap-1 text-sm">
                  {label}
                  <input
                    className={cls}
                    name={name}
                    type={type}
                    defaultValue={value}
                    required
                  />
                </label>
              ))}
              <label className="grid gap-1 text-sm">
                Observação
                <textarea className={cls} name="notes" />
              </label>
            </>
          )}
          {modal === "reversal" && (
            <>
              <p className="text-sm">
                Estornar integralmente o evento #{event?.id}, de{" "}
                {event?.amount && money(event.amount, r.currency)}. O histórico
                será preservado.
              </p>
              <label className="grid gap-1 text-sm">
                Data do estorno
                <input
                  className={cls}
                  type="date"
                  name="reversed_on"
                  defaultValue={today()}
                  required
                />
              </label>
            </>
          )}
          {modal === "cancel" && (
            <p className="text-sm">
              O cancelamento preserva parcelas e eventos. Havendo recebimentos
              líquidos, estorne-os explicitamente antes de cancelar.
            </p>
          )}
          {modal === "edit" && (
            <>
              {[
                ["description", "Descrição", r.data.description],
                ["document", "Documento", r.data.document ?? ""],
                ["notes", "Observações", r.data.notes ?? ""],
              ].map(([name, label, value]) => (
                <label key={name} className="grid gap-1 text-sm">
                  {label}
                  <input
                    className={cls}
                    name={name}
                    defaultValue={value}
                    required={name === "description"}
                  />
                </label>
              ))}
            </>
          )}
          <label className="grid gap-1 text-sm">
            Justificativa
            <input className={cls} name="reason" required minLength={5} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" required />
            Confirmo os dados e a operação financeira
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit">
            Confirmar {labels[modal]?.toLowerCase()}
          </Button>
        </form>
      </ModalForm>
    </div>
  );
}
