import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { FilterPanel } from "@/components/base/FilterPanel";
import { FormField } from "@/components/base/FormField";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/features/auth/usePermissions";
import { retroactiveSettingsUrl } from "@/features/finance-settings/financeSettingsApi";
import { formatMoney } from "@/utils/format";
import { CashFlowIndicators } from "./CashFlowIndicators";
import {
  cashFlowApi,
  cashFlowKeys,
  civilBr,
  monthBr,
  type BatchResult,
  type CashFlowKpis,
  type FlowItem,
} from "./cashFlowBoardApi";

const select = "h-10 max-w-[14rem] rounded-md border bg-background px-3 text-sm";
const STATUS_IN: Record<FlowItem["status"], string> = { realized: "Recebido", open: "Previsto", proposed: "Previsto (não confirmado)", reversed: "Estornado" };
const STATUS_OUT: Record<FlowItem["status"], string> = { realized: "Pago", open: "A pagar", proposed: "Previsto", reversed: "Estornado" };

type Action =
  | { kind: "receive"; items: FlowItem[] }
  | { kind: "reschedule"; items: FlowItem[] }
  | { kind: "discard"; items: FlowItem[] }
  | { kind: "settle"; items: FlowItem[] }
  | null;

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "warning" }) {
  const negative = value.startsWith("-");
  return (
    <div className={`rounded-lg border bg-card p-3 ${tone === "danger" ? "border-destructive/50" : tone === "warning" ? "border-warning/50" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${negative || tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function KpiRows({ k }: { k: CashFlowKpis }) {
  const m = (v: string) => formatMoney(v);
  return (
    <section aria-label={`Indicadores do fluxo de caixa (${k.currency})`} className="grid gap-2">
      {k.currency !== "BRL" ? <p className="text-sm font-semibold">Valores em {k.currency} (não somados ao BRL)</p> : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label={`Total previsto ${monthBr(k.month.reference)}`} value={m(k.month.total)} hint="(entradas − saídas) do mês" />
        <Kpi label="Entradas do mês" value={m(String((Number(k.month.in_realized) + Number(k.month.in_open)).toFixed(2)))} hint={`${m(k.month.in_realized)} recebidas · ${m(k.month.in_open)} a receber`} />
        <Kpi label="Saídas do mês" value={m(String((Number(k.month.out_realized) + Number(k.month.out_open)).toFixed(2)))} hint={`${m(k.month.out_realized)} pagas · ${m(k.month.out_open)} a pagar`} />
        <Kpi label="Em atraso" value={m(k.overdue.in)} hint={`${k.overdue.in_count} entrada(s) · saídas ${m(k.overdue.out)} (${k.overdue.out_count})`} tone={k.overdue.in_count || k.overdue.out_count ? "danger" : undefined} />
        <Kpi label={`Total previsto ${monthBr(k.next_month.reference)}`} value={m(k.next_month.total)} hint="entradas líquidas de IR − saídas" />
        <Kpi label="Entradas do próximo mês (líquidas)" value={m(k.next_month.in_net)} hint={`bruto ${m(k.next_month.in_gross)}`} />
        <Kpi label="Saídas do próximo mês" value={m(k.next_month.out)} hint="sem o IR (já descontado das entradas)" />
        <Kpi label="Previsto não confirmado" value={m(k.proposed.amount)} hint={`${k.proposed.count} parcela(s) proposta(s)`} tone={k.proposed.count ? "warning" : undefined} />
        <Kpi label={`Total do ano ${k.year.reference}`} value={m(k.year.total)} hint={`entradas ${m(k.year.in)} − saídas ${m(k.year.out)} (com IR)`} />
        <Kpi label={`A receber em ${k.year.reference} (líquido)`} value={m(k.year.in_open_net)} />
        <Kpi label={`A pagar em ${k.year.reference}`} value={m(k.year.out_open)} hint="sem o IR" />
      </div>
    </section>
  );
}

/** Financeiro › Fluxo de caixa (doc 06 §7, etapa 7). */
export function CashFlowPage() {
  const { hasPermission } = usePermissions();
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const thisYear = new Date().getFullYear();
  const [query, setQuery] = useState(() => ({
    project_id: Number(params.get("project_id")) || undefined,
    year: params.get("year") ?? String(thisYear),
    month: params.get("month") ?? undefined,
  }));
  const [monthFilter, setMonthFilter] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [showReversed, setShowReversed] = useState(false);
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<Action>(null);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean } | null>(null);
  const board = useQuery({ queryKey: cashFlowKeys.board(query), queryFn: () => cashFlowApi.board(query) });

  const run = useMutation({
    mutationFn: async (job: () => Promise<BatchResult>) => job(),
    onSuccess: async (r) => {
      setAction(null);
      setSelected([]);
      const failures = r.results.filter((x) => !x.ok).map((x) => x.message).join("; ");
      setFeedback({ message: `${r.done} item(ns) concluído(s).${failures ? ` Não concluídos: ${failures}` : ""}`, error: r.failed > 0 });
      await cache.invalidateQueries({ queryKey: cashFlowKeys.all });
    },
    onError: (e) => setFeedback({ message: (e as Error).message, error: true }),
  });

  const data = board.data;
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (i) =>
        (showReversed || i.status !== "reversed") &&
        (!direction || i.direction === direction) &&
        (!onlyOpen || i.status !== "realized") &&
        (!monthFilter || i.date.startsWith(monthFilter) || (i.overdue && i.status !== "realized")) &&
        (!term || `${i.project_name} ${i.description} ${i.origin_label}`.toLowerCase().includes(term)),
    );
  }, [data, direction, onlyOpen, monthFilter, search, showReversed]);
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const chosen = selected.map((k) => byKey.get(k)).filter((i): i is FlowItem => Boolean(i));

  if (board.isLoading) return <LoadingState label="Carregando fluxo de caixa" />;
  if (board.isError) return <ErrorState message={(board.error as Error).message} onRetry={() => void board.refetch()} />;
  if (!data) return null;
  const brl = data.kpis.find((k) => k.currency === "BRL") ?? data.kpis[0];
  const others = data.kpis.filter((k) => k !== brl);
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(String);
  const months = Array.from({ length: 12 }, (_, i) => `${query.year}-${String(i + 1).padStart(2, "0")}`);
  const tables: Array<[string, FlowItem["group"][]]> = [
    ["Entradas de faturamento", ["billing"]],
    ["Entradas de reembolsos e placas", ["reimbursement", "other_in"]],
    ["Saídas para reembolsar", ["to_reimburse"]],
    ["Saídas não reembolsáveis", ["non_reimbursable"]],
  ];
  const balance = items.reduce((s, i) => s + (i.direction === "in" ? 1 : -1) * Math.round(Number(i.gross) * 100), 0) / 100;
  const ids = (list: FlowItem[]) => list.map((i) => ({ receivable_id: Number(i.refs.receivable_id), installment_id: Number(i.refs.installment_id) }));
  const can = {
    confirm: chosen.filter((i) => i.status === "proposed" && i.refs.source_key),
    receive: chosen.filter((i) => i.direction === "in" && i.status === "open" && i.refs.installment_id),
    undo: chosen.filter((i) => i.direction === "in" && i.status === "realized" && i.refs.event_id),
    settle: chosen.filter((i) => i.direction === "out" && i.status === "open" && i.refs.settle_key),
    // Despesa: só a baixa feita aqui no fluxo pode ser desfeita aqui (a da despesa paga fica na despesa).
    unsettle: chosen.filter((i) => i.direction === "out" && i.status === "realized" && Boolean(i.refs.settle_key) && (i.origin !== "expense" || i.refs.settled_here === 1)),
  };
  const sourceKeys = (list: FlowItem[]) => [...new Set(list.map((i) => String(i.refs.source_key)))];

  return (
    <div className="grid gap-4">
      {data.alerts.proposed_count ? (
        <p role="alert" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          ⚠ {data.alerts.proposed_count} origem(ns) com recebível previsto e não confirmado ({formatMoney(data.alerts.proposed_amount)}). Elas já contam no
          fluxo como "previsto (não confirmado)"; confirme para virar recebível ou descarte com justificativa.
        </p>
      ) : null}
      {data.alerts.missing_parameters_since ? (
        <p role="status" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          {data.alerts.missing_tax_count} entrada(s) sem parâmetro vigente (IR não calculado, sem valor de reserva).{" "}
          <Link className="font-semibold underline" to={retroactiveSettingsUrl(data.alerts.missing_parameters_since)}>
            Publicar versão dos parâmetros desde {civilBr(data.alerts.missing_parameters_since)}
          </Link>
        </p>
      ) : null}
      {data.alerts.unproposed_contracts.length ? (
        <p role="status" className="rounded-md border p-3 text-sm">
          Sem proposta de recebível: {[...new Set(data.alerts.unproposed_contracts.map((c) => c.reason))].join(" ")}{" "}
          <Link className="font-semibold underline" to="/app/finance/parameters">Ver parâmetros</Link>
        </p>
      ) : null}
      {data.alerts.undated_payments ? (
        <p className="text-sm text-muted-foreground">{data.alerts.undated_payments} diária(s) em aberto sem data prevista ficam fora do fluxo (informe em Pagamento de inventariantes).</p>
      ) : null}

      <FilterPanel>
        <select aria-label="Ano" className={select} value={query.year} onChange={(e) => { setSelected([]); setMonthFilter(""); setQuery((q) => ({ ...q, year: e.target.value })); }}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Projeto" className={select} value={query.project_id ?? ""} onChange={(e) => { setSelected([]); setQuery((q) => ({ ...q, project_id: e.target.value ? Number(e.target.value) : undefined })); }}>
          <option value="">Projeto: todos</option>
          {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Mês das tabelas" className={select} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="">Mês: todos</option>
          {months.map((m) => <option key={m} value={m}>{monthBr(m)}</option>)}
        </select>
        <Button type="button" variant="ghost" onClick={() => { const now = data.as_of.slice(0, 7); setMonthFilter(now); }}>Mês atual</Button>
        <select aria-label="Tipo" className={select} value={direction} onChange={(e) => setDirection(e.target.value as "" | "in" | "out")}>
          <option value="">Entradas e saídas</option>
          <option value="in">Entradas</option>
          <option value="out">Saídas</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Somente em aberto
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showReversed} onChange={(e) => setShowReversed(e.target.checked)} />
          Mostrar estornos
        </label>
        <input aria-label="Buscar" placeholder="Buscar projeto ou descrição" className="h-10 w-56 rounded-md border bg-background px-3 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      </FilterPanel>

      {brl ? <KpiRows k={brl} /> : null}
      {others.map((k) => <KpiRows key={k.currency} k={k} />)}
      <CashFlowIndicators query={query} />

      {feedback ? <p role={feedback.error ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${feedback.error ? "text-destructive" : ""}`}>{feedback.message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {hasPermission("receivables:edit") ? (
          <>
            <Button type="button" disabled={!can.confirm.length} onClick={() => run.mutate(() => cashFlowApi.confirm(sourceKeys(can.confirm)))}>Confirmar propostas ({sourceKeys(can.confirm).length})</Button>
            <Button type="button" variant="secondary" disabled={!can.confirm.length} onClick={() => setAction({ kind: "discard", items: can.confirm })}>Descartar propostas</Button>
          </>
        ) : null}
        {hasPermission("receivables:receive") ? <Button type="button" variant="secondary" disabled={!can.receive.length} onClick={() => setAction({ kind: "receive", items: can.receive })}>Marcar recebido ({can.receive.length})</Button> : null}
        {hasPermission("receivables:reschedule") ? <Button type="button" variant="secondary" disabled={!can.receive.length} onClick={() => setAction({ kind: "reschedule", items: can.receive })}>Alterar data prevista</Button> : null}
        {hasPermission("receivables:reverse") ? <Button type="button" variant="ghost" disabled={!can.undo.length} onClick={() => run.mutate(() => cashFlowApi.undoReceipts(can.undo.map((i) => ({ receivable_id: Number(i.refs.receivable_id), event_id: Number(i.refs.event_id) }))))}>Desfazer recebimento ({can.undo.length})</Button> : null}
        <Button type="button" variant="secondary" disabled={!can.settle.length} onClick={() => setAction({ kind: "settle", items: can.settle })}>Pagar ({can.settle.length})</Button>
        <Button type="button" variant="ghost" disabled={!can.unsettle.length} onClick={() => run.mutate(() => cashFlowApi.settle(can.unsettle.map((i) => String(i.refs.settle_key)), null))}>Desfazer pagamento ({can.unsettle.length})</Button>
      </div>

      {tables.map(([title, groups]) => {
        const rows = items.filter((i) => groups.includes(i.group));
        if (!rows.length) return null;
        const inflow = rows[0].direction === "in";
        const total = rows.reduce((s, i) => s + Math.round(Number(i.gross) * 100), 0) / 100;
        const net = rows.reduce((s, i) => s + Math.round(Number(i.net) * 100), 0) / 100;
        return (
          <div key={title} className="premium-panel">
            <div className="overflow-x-auto" role="region" aria-label={title} tabIndex={0}>
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
                <caption className="px-3 py-2 text-left font-semibold">{title}</caption>
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="border-b px-2 py-2"><span className="sr-only">Selecionar</span></th>
                    {["Data prevista", inflow ? "Recebido em" : "Pago em", "Em atraso", "Projeto", "Origem", "Descrição", "Parcela", "Status", "Valor bruto", ...(inflow ? ["Líquido", "% do contrato"] : [])].map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap border-b px-2 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => {
                    const actionable = !i.derived && (i.refs.installment_id || i.refs.event_id || i.refs.source_key || i.refs.settle_key);
                    return (
                      <tr key={i.key} className={i.overdue ? "bg-destructive/[0.07]" : i.status === "proposed" ? "bg-warning/[0.08]" : i.status === "reversed" ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}>
                        <td className="border-b px-2 py-2">
                          {actionable ? (
                            <input type="checkbox" aria-label={`Selecionar ${i.description} ${civilBr(i.date)}`} checked={selected.includes(i.key)}
                              onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i.key] : s.filter((k) => k !== i.key)))} />
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap border-b px-2 py-2">{civilBr(i.expected_on ?? i.date)}</td>
                        <td className="whitespace-nowrap border-b px-2 py-2">{civilBr(i.realized_on)}{i.status === "reversed" && i.refs.reversed_on ? <span className="block text-xs text-muted-foreground">estornado em {civilBr(String(i.refs.reversed_on))}</span> : null}</td>
                        <td className="whitespace-nowrap border-b px-2 py-2">{i.overdue ? <span className="font-semibold text-destructive">{i.overdue_days} dia(s)</span> : ""}</td>
                        <td className="max-w-[12rem] truncate border-b px-2 py-2" title={i.project_name}>{i.project_name}</td>
                        <td className="whitespace-nowrap border-b px-2 py-2">{i.origin_label}</td>
                        <td className="max-w-[16rem] truncate border-b px-2 py-2" title={i.description}>{i.description}</td>
                        <td className={`whitespace-nowrap border-b px-2 py-2 ${i.installment && i.installment.number === i.installment.of && i.installment.of > 1 ? "font-semibold" : ""}`}>{i.installment ? `${i.installment.number}/${i.installment.of}` : ""}</td>
                        <td className="whitespace-nowrap border-b px-2 py-2">{(inflow ? STATUS_IN : STATUS_OUT)[i.status]}</td>
                        <td className="whitespace-nowrap border-b px-2 py-2 tabular-nums">{formatMoney(i.gross)}</td>
                        {inflow ? <td className="whitespace-nowrap border-b px-2 py-2 tabular-nums">{formatMoney(i.net)}</td> : null}
                        {inflow ? <td className="whitespace-nowrap border-b px-2 py-2 tabular-nums">{i.contract_pct ? `${i.contract_pct.replace(".", ",")}%` : ""}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={9} className="px-2 py-2">Subtotal ({rows.length})</td>
                    <td className="px-2 py-2 tabular-nums">{formatMoney(total)}</td>
                    {inflow ? <td className="px-2 py-2 tabular-nums">{formatMoney(net)}</td> : null}
                    {inflow ? <td /> : null}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
      <p className="text-sm font-semibold">Saldo das linhas exibidas (entradas − saídas): <span className={balance < 0 ? "text-destructive" : ""}>{formatMoney(balance)}</span></p>
      <p className="text-xs text-muted-foreground">
        Saídas vencidas e não pagas e entradas vencidas aparecem sempre, mesmo fora do ano escolhido. IR = valor da entrada de faturamento × % dos
        parâmetros vigente na data da entrada (reembolsos e placas sem IR). Diárias têm baixa em Pagamento de inventariantes.
      </p>

      {action?.kind === "receive" || action?.kind === "settle" ? (
        <DateDialog
          title={action.kind === "receive" ? `Marcar ${action.items.length} parcela(s) como recebida(s)` : `Pagar ${action.items.length} saída(s)`}
          label={action.kind === "receive" ? "Recebido em" : "Pago em"}
          today={data.as_of}
          busy={run.isPending}
          onClose={() => setAction(null)}
          onConfirm={(date) =>
            run.mutate(() => (action.kind === "receive" ? cashFlowApi.receive(ids(action.items), date) : cashFlowApi.settle(action.items.map((i) => String(i.refs.settle_key)), date)))
          }
        />
      ) : null}
      {action?.kind === "reschedule" ? (
        <DateDialog
          title={`Nova data prevista (${action.items.length} parcela(s))`}
          label="Nova data prevista"
          today={data.as_of}
          withReason
          busy={run.isPending}
          onClose={() => setAction(null)}
          onConfirm={(date, reason) => run.mutate(() => cashFlowApi.reschedule(ids(action.items), date, reason!))}
        />
      ) : null}
      {action?.kind === "discard" ? (
        <DateDialog
          title={`Descartar ${sourceKeys(action.items).length} proposta(s)`}
          label=""
          today={data.as_of}
          withReason
          noDate
          busy={run.isPending}
          onClose={() => setAction(null)}
          onConfirm={(_d, reason) => run.mutate(() => cashFlowApi.discard(sourceKeys(action.items), reason!))}
        />
      ) : null}
    </div>
  );
}

function DateDialog({
  title,
  label,
  today,
  withReason,
  noDate,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  label: string;
  today: string;
  withReason?: boolean;
  noDate?: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (date: string, reason?: string) => void;
}) {
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const invalid = (!noDate && !date) || (withReason && reason.trim().length < 5);
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title={title}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (!invalid) onConfirm(date, reason.trim()); }}>
        {!noDate ? (
          <FormField label={label}>
            <Input type="date" aria-label={label} value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
        ) : null}
        {withReason ? (
          <FormField label="Justificativa">
            <textarea aria-label="Justificativa" className="min-h-16 rounded-md border bg-background px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
            <span className="text-xs text-muted-foreground">Mínimo de 5 caracteres; fica na auditoria.</span>
          </FormField>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" loading={busy} disabled={invalid}>Confirmar</Button>
        </div>
      </form>
    </ModalForm>
  );
}

