import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Download, RefreshCw, RotateCcw, Wallet } from "lucide-react";
import { Kpi } from "@/components/base/Cards";
import { FilterPanel } from "@/components/base/FilterPanel";
import { ErrorState, LoadingState } from "@/components/base/States";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import { usePermissions } from "@/features/auth/usePermissions";
import { FinanceHeaderActions } from "@/features/receivables/FinanceLayout";
import { formatMoney } from "@/utils/format";
import {
  civilBr,
  fieldAgentPaymentsApi,
  fieldAgentPaymentsKeys,
  monthBr,
  type BatchResult,
  type Consolidated,
  type ConsolidatedFilters,
  type FacetKey,
  type ConsolidatedRow,
} from "./fieldAgentPaymentsApi";

const OPTIONAL_COLUMNS = ["UF", "Período", "Dias", "Diária", "Adicional", "Total", "Descontos"] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];
const STORAGE_KEY = "gai.field-agent-payments.hidden-columns";
const PAGE = 50;

/** Padrão: colunas de composição do valor ocultas, para a tabela caber no desktop sem rolar. */
const DEFAULT_HIDDEN: OptionalColumn[] = ["Diária", "Adicional", "Descontos"];
function loadHidden(): OptionalColumn[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OptionalColumn[]) : DEFAULT_HIDDEN;
  } catch {
    return DEFAULT_HIDDEN;
  }
}
function saveHidden(value: OptionalColumn[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* preferência só deste navegador; sem armazenamento, segue sem lembrar */
  }
}

/** Cada diálogo guarda os ids do momento em que foi aberto e só executa a própria ação. */
type Dialog =
  | { kind: "pay"; rows: ConsolidatedRow[] }
  | { kind: "revert"; rows: ConsolidatedRow[] }
  | { kind: "date"; row: ConsolidatedRow }
  | null;

/** Colunas de valor: à direita e sem quebra ("R$ 1.000,00" numa linha só). */
const MONEY_COLUMNS = new Set<string>(["Diária", "Adicional", "Total", "Descontos", "Final"]);
const moneyCell = "numeric border-b px-2 py-2 text-right";

const STATUS_HINT = "Em aberto = pendentes e aprovados ainda não pagos. Pendente: aguarda aprovação. Aprovado: liberado para pagar.";

const FILTERS: Array<{ key: FacetKey; label: string; all?: string; format?: (v: string) => string }> = [
  { key: "project_id", label: "Projeto" },
  { key: "field_agent_id", label: "Inventariante" },
  { key: "status", label: "Situação", all: "todas" },
  { key: "expected_month", label: "Mês previsto", format: monthBr },
  { key: "paid_month", label: "Mês do pagamento", format: monthBr },
  { key: "expected_date", label: "Data prevista", all: "todas", format: civilBr },
  { key: "payment_date", label: "Data de pagamento", all: "todas", format: civilBr },
];

export function FieldAgentPaymentsPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const cache = useQueryClient();
  const [filters, setFilters] = useState<ConsolidatedFilters>({ status: "open" });
  const [selected, setSelected] = useState<number[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [hidden, setHidden] = useState<OptionalColumn[]>(loadHidden);
  const [expanded, setExpanded] = useState(false);
  /** Falhas e resultados parciais ficam na tela; sucesso completo vai para o toast. */
  const [feedback, setFeedback] = useState<string | null>(null);
  const query = useQuery({
    queryKey: fieldAgentPaymentsKeys.list(filters),
    queryFn: () => fieldAgentPaymentsApi.list(filters),
  });
  const data = query.data;
  const show = (column: OptionalColumn) => !hidden.includes(column);

  const setFilter = (key: keyof ConsolidatedFilters, value: string) => {
    setSelected([]);
    setFilters((f) => ({
      ...f,
      [key]: value === "" ? undefined : key === "project_id" || key === "field_agent_id" ? Number(value) : value,
    }));
  };
  const done = async (result: BatchResult, verb: string) => {
    await cache.invalidateQueries({ queryKey: fieldAgentPaymentsKeys.all });
    await cache.invalidateQueries({ queryKey: ["remuneration"] });
    setSelected([]);
    setDialog(null);
    const failures = result.results.filter((r) => !r.ok).map((r) => `#${r.id}: ${r.message}`);
    const message = `${result.done} lançamento(s) ${verb}.` + (failures.length ? ` Não concluídos: ${failures.join("; ")}.` : "");
    if (result.failed > 0) setFeedback(message);
    else {
      setFeedback(null);
      toast({ title: message, tone: "success" });
    }
  };

  const byId = useMemo(() => new Map((data?.items ?? []).map((r) => [r.id, r])), [data]);
  const chosen = selected.map((id) => byId.get(id)).filter((r): r is ConsolidatedRow => Boolean(r));
  const payable = (r: ConsolidatedRow) => r.status === "approved" || (!data?.require_approval && r.status === "pending");
  const toPay = chosen.filter(payable);
  const toRevert = chosen.filter((r) => r.status === "paid");
  const visible = data ? (expanded ? data.items : data.items.slice(0, PAGE)) : [];

  async function exportList() {
    try {
      const blob = await fieldAgentPaymentsApi.exportFile(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pagamento-inventariantes.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  return (
    <div className="grid gap-4">
      {hasPermission("payments:export") ? (
        <FinanceHeaderActions>
          <Button type="button" variant="secondary" onClick={() => void exportList()}>
            <Download size={16} /> Exportar Excel
          </Button>
        </FinanceHeaderActions>
      ) : null}
      {data ? (
        <section aria-label="Indicadores do pagamento de inventariantes" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <Kpi label="Total" value={formatMoney(data.kpis.total)} hint="Sem cancelados" />
          <Kpi label="Pago" value={formatMoney(data.kpis.paid)} />
          <Kpi label="Em aberto" value={formatMoney(data.kpis.open)} hint="Pendente e aprovado" />
          <Kpi label="Inventariantes" value={String(data.kpis.field_agents)} />
          <Kpi label="Em atraso" value={formatMoney(data.kpis.overdue)} hint={`${data.kpis.overdue_count} lançamento(s) em atraso`} tone={data.kpis.overdue_count > 0 ? "danger" : "default"} />
          <Kpi
            label="Sem previsão"
            value={formatMoney(data.kpis.no_expected)}
            hint={`${data.kpis.no_expected_count} em aberto sem data prevista${filters.no_expected ? " · filtrando" : " · clique para filtrar"}`}
            tone={data.kpis.no_expected_count > 0 ? "danger" : "default"}
            active={Boolean(filters.no_expected)}
            onClick={() => {
              setSelected([]);
              setFilters((f) => ({ ...f, no_expected: f.no_expected ? undefined : true }));
            }}
          />
          <Kpi label={`Previsto em ${monthBr(data.kpis.reference_month)}`} value={formatMoney(data.kpis.expected_in_month)} />
          <Kpi label={`Pago em ${monthBr(data.kpis.reference_month)}`} value={formatMoney(data.kpis.paid_in_month)} />
          <Kpi label={`Em aberto em ${monthBr(data.kpis.reference_month)}`} value={formatMoney(data.kpis.open_in_month)} />
          <Kpi label="Em aberto no próximo mês" value={formatMoney(data.kpis.open_next_month)} />
        </section>
      ) : null}

      <FilterPanel>
        {FILTERS.map(({ key, label, all = "todos", format }) => {
          const facet = data?.facets[key];
          return (
            <select
              key={key}
              aria-label={`Filtrar por ${label.toLowerCase()}`}
              title={key === "status" ? STATUS_HINT : label}
              className="h-10 max-w-[14rem] rounded-md border bg-background px-3 text-sm"
              value={filters[key] === undefined ? "" : String(filters[key])}
              onChange={(e) => setFilter(key, e.target.value)}
            >
              <option value="">{`${label}: ${all} (${facet?.total ?? 0})`}</option>
              {facet?.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {`${format ? format(o.label) : o.label} (${o.count})`}
                </option>
              ))}
            </select>
          );
        })}
        <Button type="button" variant="ghost" onClick={() => { setSelected([]); setFilters({}); }}>
          Limpar
        </Button>
        <Button type="button" variant="secondary" onClick={() => void query.refetch()} aria-label="Recarregar" title="Recarregar">
          <RefreshCw size={16} />
        </Button>
      </FilterPanel>

      {feedback ? (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive-text">
          {feedback}
        </p>
      ) : null}

      {query.isLoading ? (
        <LoadingState label="Carregando pagamentos" />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      ) : data ? (
        <>
          <Summary data={data} onPick={(id) => setFilter("field_agent_id", String(id))} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {hasPermission("payments:mark-as-paid") ? (
                <Button type="button" disabled={!toPay.length} onClick={() => setDialog({ kind: "pay", rows: toPay })}>
                  <Wallet size={16} /> Pagar selecionados ({toPay.length})
                </Button>
              ) : null}
              {hasPermission("payments:revert-payment") ? (
                <Button type="button" variant="secondary" disabled={!toRevert.length} onClick={() => setDialog({ kind: "revert", rows: toRevert })}>
                  <RotateCcw size={16} /> Desfazer pagamento ({toRevert.length})
                </Button>
              ) : null}
            </div>
            <details className="relative text-sm">
              <summary className="cursor-pointer rounded-md border px-3 py-2">Colunas</summary>
              <div className="absolute right-0 z-20 mt-1 grid gap-1 rounded-md border bg-popover p-3 shadow-elevated">
                {OPTIONAL_COLUMNS.map((c) => (
                  <label key={c} className="flex items-center gap-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={show(c)}
                      onChange={(e) => {
                        const next = e.target.checked ? hidden.filter((h) => h !== c) : [...hidden, c];
                        setHidden(next);
                        saveHidden(next);
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </details>
          </div>

          <div className="premium-panel">
            <div className="overflow-x-auto" role="region" aria-label="Lançamentos de todos os projetos" tabIndex={0}>
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="border-b px-2 py-3">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos os exibidos"
                        checked={visible.length > 0 && visible.every((r) => selected.includes(r.id))}
                        onChange={(e) => setSelected(e.target.checked ? visible.map((r) => r.id) : [])}
                      />
                    </th>
                    {["Situação", "Projeto", "Inventariante", ...OPTIONAL_COLUMNS.slice(0, 2).filter(show), "Previsto", "Pago em", ...OPTIONAL_COLUMNS.slice(2).filter(show), "Final", ""].map((h, i) => (
                      <th key={`${h}-${i}`} scope="col" className={`whitespace-nowrap border-b px-2 py-3 font-semibold ${MONEY_COLUMNS.has(h) ? "text-right" : ""}`}>{h || <span className="sr-only">Ações</span>}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className={r.overdue || r.no_expected ? "bg-destructive/[0.06]" : "hover:bg-primary/[0.05]"}>
                      <td className="border-b px-2 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar lançamento de ${r.field_agent_name} em ${r.project_name}`}
                          checked={selected.includes(r.id)}
                          onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((id) => id !== r.id)))}
                        />
                      </td>
                      <td className="whitespace-nowrap border-b px-2 py-2">
                        <StatusBadge finance={r.status} />
                        {r.overdue ? <span className="ml-1 text-xs font-semibold text-destructive-text">Em atraso</span> : null}
                      </td>
                      <td className="max-w-[12rem] truncate border-b px-2 py-2" title={r.project_name}>{r.project_name}</td>
                      <td className="max-w-[12rem] truncate border-b px-2 py-2 font-medium" title={r.field_agent_name}>{r.field_agent_name}</td>
                      {show("UF") ? <td className="border-b px-2 py-2">{r.state ?? "—"}</td> : null}
                      {show("Período") ? (
                        <td className="whitespace-nowrap border-b px-2 py-2">
                          <span className="flex flex-col leading-tight">
                            {civilBr(r.start_date)}
                            <span className="text-xs text-muted-foreground">a {civilBr(r.end_date)}</span>
                          </span>
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap border-b px-2 py-2">
                        {r.no_expected ? (
                          hasPermission("payments:reschedule") ? (
                            <button
                              type="button"
                              className="rounded bg-destructive/10 px-2 py-0.5 font-semibold text-destructive-text hover:bg-destructive/20"
                              title={`Informar a data prevista de ${r.field_agent_name}`}
                              aria-label={`Informar a data prevista de ${r.field_agent_name}`}
                              onClick={() => setDialog({ kind: "date", row: r })}
                            >
                              Informar
                            </button>
                          ) : (
                            <span className="rounded bg-destructive/10 px-2 py-0.5 font-semibold text-destructive-text" title="Sem data prevista">Informar</span>
                          )
                        ) : (
                          civilBr(r.expected_payment_date) || "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b px-2 py-2">{civilBr(r.payment_date)}</td>
                      {show("Dias") ? <td className="border-b px-2 py-2 tabular-nums">{r.days}</td> : null}
                      {show("Diária") ? <td className={moneyCell}>{formatMoney(r.daily_rate)}</td> : null}
                      {show("Adicional") ? <td className={moneyCell}>{formatMoney(r.additional_amount)}</td> : null}
                      {show("Total") ? <td className={moneyCell}>{formatMoney(r.total_amount)}{r.total_manual ? <span className="ml-1 text-xs text-warning-text">manual</span> : null}</td> : null}
                      {show("Descontos") ? <td className={moneyCell}>{formatMoney(r.discount_amount)}</td> : null}
                      <td className={`${moneyCell} font-semibold`}>{formatMoney(r.final_amount)}</td>
                      <td className="border-b px-2 py-2">
                        {hasPermission("payments:reschedule") && r.status !== "cancelled" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="size-8"
                            title={r.status === "paid" ? `Editar a data de pagamento de ${r.field_agent_name}` : `Editar a data prevista de ${r.field_agent_name}`}
                            aria-label={r.status === "paid" ? `Editar a data de pagamento de ${r.field_agent_name}` : `Editar a data prevista de ${r.field_agent_name}`}
                            onClick={() => setDialog({ kind: "date", row: r })}
                          >
                            <CalendarClock size={16} />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!visible.length ? (
                    <tr>
                      <td colSpan={20} className="px-3 py-6 text-center text-muted-foreground">Nenhum lançamento com estes filtros.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          {data.items.length > PAGE ? (
            <Button type="button" variant="ghost" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Mostrar menos" : `Mostrar todos (${data.items.length})`}
            </Button>
          ) : null}
        </>
      ) : null}

      {dialog?.kind === "pay" ? (
        <PayDialog rows={dialog.rows} today={data?.today ?? ""} onClose={() => setDialog(null)} onDone={(r) => done(r, "pago(s)")} />
      ) : null}
      {dialog?.kind === "revert" ? (
        <RevertDialog rows={dialog.rows} onClose={() => setDialog(null)} onDone={(r) => done(r, "com o pagamento desfeito (voltaram para em aberto)")} />
      ) : null}
      {dialog?.kind === "date" ? (
        <DateDialog
          row={dialog.row}
          onClose={() => setDialog(null)}
          onDone={() => done({ done: 1, failed: 0, results: [{ id: dialog.row.id, ok: true }] }, "com a data alterada")}
        />
      ) : null}
    </div>
  );
}

function Summary({ data, onPick }: { data: Consolidated; onPick: (id: number) => void }) {
  return (
    <section className="premium-panel p-4" aria-label="Resumo por inventariante">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Resumo por inventariante</h2>
        <p className="text-xs text-muted-foreground">
          {data.summary.show_all ? "Todos os inventariantes do filtro." : "Só quem tem valor em aberto. Clique para filtrar os lançamentos."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              {["Inventariante", "Lançamentos", "Dias", "Final", "Pago", "Em aberto"].map((h) => (
                <th key={h} scope="col" className={`px-2 py-2 font-semibold ${["Final", "Pago", "Em aberto"].includes(h) ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.summary.rows.map((a) => (
              <tr key={a.field_agent_id} className="border-t">
                <td className="px-2 py-1.5">
                  <button type="button" className="text-left text-primary-text hover:underline" onClick={() => onPick(a.field_agent_id)}>
                    {a.name}
                  </button>
                </td>
                <td className="px-2 py-1.5 tabular-nums">{a.entries}</td>
                <td className="px-2 py-1.5 tabular-nums">{a.days}</td>
                <td className="numeric px-2 py-1.5 text-right">{formatMoney(a.final)}</td>
                <td className="numeric px-2 py-1.5 text-right">{formatMoney(a.paid)}</td>
                <td className="numeric px-2 py-1.5 text-right font-semibold">{formatMoney(a.open)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="px-2 py-2" colSpan={3}>Subtotal</td>
              <td className="numeric px-2 py-2 text-right">{formatMoney(data.summary.subtotal.final)}</td>
              <td className="numeric px-2 py-2 text-right">{formatMoney(data.summary.subtotal.paid)}</td>
              <td className="numeric px-2 py-2 text-right">{formatMoney(data.summary.subtotal.open)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function PayDialog({ rows, today, onClose, onDone }: { rows: ConsolidatedRow[]; today: string; onClose: () => void; onDone: (r: BatchResult) => void }) {
  const [mode, setMode] = useState<"today" | "chosen" | "individual">("today");
  const [date, setDate] = useState(today);
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [String(r.id), today])),
  );
  const total = rows.reduce((s, r) => s + Math.round(Number(r.final_amount) * 100), 0) / 100;
  const pay = useMutation({
    mutationFn: () =>
      fieldAgentPaymentsApi.pay({
        ids: rows.map((r) => r.id),
        date_mode: mode,
        ...(mode === "chosen" ? { payment_date: date } : {}),
        ...(mode === "individual" ? { dates } : {}),
      }),
    onSuccess: onDone,
  });
  return (
    <ModalForm open onOpenChange={(open) => !open && onClose()} title="Registrar pagamento">
      <form
        className="grid gap-4"
        aria-label="Registrar pagamento"
        onSubmit={(e) => {
          e.preventDefault();
          pay.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          {rows.length} lançamento(s), total {formatMoney(total)}.
        </p>
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-semibold">Data do pagamento</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "today"} onChange={() => setMode("today")} /> Hoje ({civilBr(today)})
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "chosen"} onChange={() => setMode("chosen")} /> Uma data para todos
          </label>
          {mode === "chosen" ? <Input type="date" aria-label="Data para todos" value={date} required onChange={(e) => setDate(e.target.value)} /> : null}
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "individual"} onChange={() => setMode("individual")} /> Uma data por lançamento
          </label>
        </fieldset>
        {mode === "individual" ? (
          <ul className="grid max-h-64 gap-2 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
                <span className="truncate">{r.field_agent_name} · {r.project_name} · {formatMoney(r.final_amount)}</span>
                <Input
                  type="date"
                  aria-label={`Data do pagamento de ${r.field_agent_name} em ${r.project_name}`}
                  value={dates[String(r.id)]}
                  required
                  onChange={(e) => setDates((d) => ({ ...d, [String(r.id)]: e.target.value }))}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {pay.isError ? <p role="alert" className="text-sm text-destructive">{(pay.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pay.isPending}>Voltar</Button>
          <Button type="submit" loading={pay.isPending}>Registrar pagamento</Button>
        </div>
      </form>
    </ModalForm>
  );
}

function RevertDialog({ rows, onClose, onDone }: { rows: ConsolidatedRow[]; onClose: () => void; onDone: (r: BatchResult) => void }) {
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < 5;
  const revert = useMutation({
    mutationFn: () => fieldAgentPaymentsApi.revert(rows.map((r) => r.id), reason.trim()),
    onSuccess: onDone,
  });
  return (
    <ModalForm open onOpenChange={(open) => !open && onClose()} title="Desfazer pagamento">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooShort) revert.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          Desfazer o pagamento de {rows.length} lançamento(s)? Eles voltam para em aberto: a data de pagamento é limpa e a data
          prevista é mantida. Lançamentos aprovados voltam a "aprovado"; os pagos sem aprovação voltam a "pendente".
        </p>
        <label className="grid gap-1 text-sm">
          Justificativa
          <textarea
            aria-label="Justificativa"
            className="min-h-16 rounded-md border bg-background px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
          />
          <span className="text-xs text-muted-foreground">Mínimo de 5 caracteres; fica na auditoria de cada lançamento.</span>
        </label>
        {revert.isError ? <p role="alert" className="text-sm text-destructive-text">{(revert.error as Error).message}</p> : null}
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={revert.isPending}>Voltar</Button>
          <Button type="submit" loading={revert.isPending} disabled={tooShort}>Desfazer pagamento</Button>
        </div>
      </form>
    </ModalForm>
  );
}

function DateDialog({ row, onClose, onDone }: { row: ConsolidatedRow; onClose: () => void; onDone: () => void }) {
  const kind = row.status === "paid" ? "payment" : "expected";
  const [date, setDate] = useState((kind === "payment" ? row.payment_date : row.expected_payment_date) ?? "");
  const save = useMutation({ mutationFn: () => fieldAgentPaymentsApi.changeDate(row.id, { kind, date }), onSuccess: onDone });
  const label = kind === "payment" ? "Data de pagamento" : "Data prevista de pagamento";
  return (
    <ModalForm open onOpenChange={(open) => !open && onClose()} title={kind === "payment" ? "Editar data de pagamento" : row.expected_payment_date ? "Editar data prevista" : "Informar data prevista"}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          {row.field_agent_name} · {row.project_name} · {formatMoney(row.final_amount)}
        </p>
        <label className="grid gap-1 text-sm font-semibold">
          {label}
          <Input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        </label>
        {save.isError ? <p role="alert" className="text-sm text-destructive">{(save.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>Voltar</Button>
          <Button type="submit" loading={save.isPending}>Salvar data</Button>
        </div>
      </form>
    </ModalForm>
  );
}
