import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/base/StatusBadge";
import { DataPanel, DataPanelFilters, ViewToggle } from "@/components/base/DataPanel";
import type { FinanceStatus } from "@/components/base/financeStatus";
import { formatMoney } from "@/utils/format";
import { civilBr, type FlowItem } from "./cashFlowBoardApi";
import { useViewPreference, useViewState } from "./useViewPreference";

export type BlockKind = "billing" | "reimbursement" | "to_reimburse" | "non_reimbursable";

/** Ações de um bloco: as que abrem diálogo e as diretas. */
export type BlockAction =
  | { kind: "confirm" | "undo" | "unsettle"; items: FlowItem[] }
  | { kind: "discard" | "receive" | "reschedule" | "redate" | "settle" | "repay"; items: FlowItem[] };

/** Situação no mapa financeiro único (rótulo e cor vêm do StatusBadge). */
const STATUS_IN: Record<FlowItem["status"], FinanceStatus> = { realized: "received", open: "forecast", proposed: "unconfirmed", reversed: "reversed" };
const STATUS_OUT: Record<FlowItem["status"], FinanceStatus> = { realized: "paid", open: "payable", proposed: "unconfirmed", reversed: "reversed" };
/** Permissão de baixa no fluxo por origem da saída (a mesma que o servidor exige). */
const SETTLE_PERMISSION: Record<string, string> = {
  expense: "expenses:mark-as-paid",
  commission: "commissions:edit",
  asset_tag_cost: "asset-tag-orders:edit",
};
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const select = "h-10 max-w-full rounded-md border bg-background px-3 text-sm";
const cents = (v: string) => Math.round(Number(v) * 100);
const total = (rows: FlowItem[], f: (i: FlowItem) => string = (i) => i.gross) => rows.reduce((s, i) => s + cents(f(i)), 0) / 100;

type BlockFilters = {
  project: string;
  year: string;
  month: string;
  view: "open" | "done" | "all";
  currentMonth: boolean;
  search: string;
  installment: string;
  origin: string;
};
const DEFAULT_FILTERS: BlockFilters = { project: "", year: "", month: "", view: "open", currentMonth: false, search: "", installment: "", origin: "" };
const isFilters = (v: unknown): v is BlockFilters => {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  return (
    ["project", "year", "month", "search", "installment", "origin"].every((k) => typeof f[k] === "string") &&
    ["open", "done", "all"].includes(String(f.view)) &&
    typeof f.currentMonth === "boolean"
  );
};
/** Rótulo curto da origem (o nome completo fica na dica). */
const SHORT_ORIGIN: Record<string, string> = {
  asset_tag: "Placas (revenda)",
  asset_tag_cost: "Placas (custo)",
  to_bill: "Sem lote",
  income_tax: "IR",
};
const shortOrigin = (i: FlowItem) => SHORT_ORIGIN[i.origin] ?? i.origin_label;

const isFixedCost = (i: FlowItem) => i.origin === "fixed_cost";

/**
 * IR: uma linha por mês ("IR sobre o faturamento de MM/AAAA") no lugar de uma
 * por entrada, com as entradas que a compõem no detalhe. Os totais não mudam
 * (rodapé e saldo somam as linhas originais).
 */
function groupIncomeTax(rows: FlowItem[]): FlowItem[] {
  const months = new Map<string, FlowItem[]>();
  for (const i of rows) if (i.origin === "income_tax") months.set(i.date.slice(0, 7), [...(months.get(i.date.slice(0, 7)) ?? []), i]);
  const out: FlowItem[] = [];
  const done = new Set<string>();
  for (const i of rows) {
    if (i.origin !== "income_tax") {
      out.push(i);
      continue;
    }
    const m = i.date.slice(0, 7);
    if (done.has(m)) continue;
    done.add(m);
    const parts = months.get(m)!;
    const [y, mm] = m.split("-").map(Number);
    const last = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
    const allRealized = parts.every((p) => p.status === "realized");
    out.push({
      ...i,
      key: `ir-month:${m}`,
      date: last,
      expected_on: last,
      realized_on: allRealized ? (parts.map((p) => p.realized_on ?? p.date).sort().at(-1) ?? null) : null,
      status: allRealized ? "realized" : parts.some((p) => p.status === "reversed") && parts.every((p) => p.status === "reversed") ? "reversed" : "open",
      gross: (parts.reduce((s, p) => s + cents(p.gross), 0) / 100).toFixed(2),
      net: (parts.reduce((s, p) => s + cents(p.net), 0) / 100).toFixed(2),
      project_id: null,
      project_name: "—",
      description: `IR sobre o faturamento de ${m.slice(5)}/${m.slice(0, 4)}`,
      details: parts.map((p) => ({ date: p.date, description: `${p.project_name} · ${p.description}`, amount: p.gross })),
      refs: { months: m },
    });
  }
  return out;
}
function financeStatus(i: FlowItem): FinanceStatus {
  if (isFixedCost(i)) return i.refs.fixed_cost === "estimate" ? "estimated" : "posted";
  return (i.direction === "in" ? STATUS_IN : STATUS_OUT)[i.status];
}

type Props = {
  kind: BlockKind;
  title: string;
  rows: FlowItem[];
  asOf: string;
  /** Ano das tabelas do filtro geral ("all" mostra o filtro de ano do bloco). */
  tablesYear: string;
  can: (permission: string) => boolean;
  busy: boolean;
  /** Muda quando uma ação termina: limpa a seleção do bloco. */
  resetKey: number;
  onAction: (action: BlockAction) => void;
  /** Saldo (centavos, entradas + e saídas −) das linhas exibidas; nulo com o bloco oculto. */
  onBalance?: (kind: BlockKind, cents: number | null) => void;
};

/** Um bloco do fluxo de caixa: filtros próprios (somados ao geral), ações dos selecionados, tabela e rodapé. */
export function CashFlowBlock({ kind, title, rows, asOf, tablesYear, can, busy, resetKey, onAction, onBalance }: Props) {
  const inflow = kind === "billing" || kind === "reimbursement";
  const [hidden, setHidden] = useViewPreference(`cash-flow.block.${kind}.hidden`, false);
  // Filtros do bloco: lembrados junto com o Ocultar/Mostrar; a visão inicial é "Em aberto".
  const [filters, setFilters] = useViewState(`cash-flow.block.${kind}.filters`, DEFAULT_FILTERS, isFilters);
  const { project, year, month, view, currentMonth, search, installment, origin } = filters;
  const set = <K extends keyof BlockFilters>(k: K) => (v: BlockFilters[K]) => setFilters({ ...filters, [k]: v });
  const [setProject, setYear, setMonth, setView, setCurrentMonth, setSearch, setInstallment, setOrigin] = [
    set("project"),
    set("year"),
    set("month"),
    set("view"),
    set("currentMonth"),
    set("search"),
    set("installment"),
    set("origin"),
  ];
  const [selection, setSelection] = useState<{ reset: number; keys: string[] }>({ reset: resetKey, keys: [] });
  const [expanded, setExpanded] = useState<string[]>([]);
  const selected = selection.reset === resetKey ? selection.keys : [];
  const setSelected = (f: (keys: string[]) => string[]) => setSelection({ reset: resetKey, keys: f(selected) });

  const options = useMemo(() => {
    const projects = new Map<string, string>();
    const origins = new Set<string>();
    const years = new Set<string>();
    for (const i of rows) {
      projects.set(i.project_id == null ? "none" : String(i.project_id), i.project_name);
      origins.add(i.origin_label);
      years.add(i.date.slice(0, 4));
    }
    return {
      projects: [...projects].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
      origins: [...origins].sort((a, b) => a.localeCompare(b, "pt-BR")),
      years: [...years].sort(),
    };
  }, [rows]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = asOf.slice(0, 7);
    // Vencidas em aberto continuam visíveis com filtro de ano, mês e mês atual (nunca escondidas).
    const keepOverdue = (i: FlowItem) => i.overdue && i.status !== "realized";
    return rows.filter((i) => {
      if (project && (i.project_id == null ? "none" : String(i.project_id)) !== project) return false;
      if (origin && i.origin_label !== origin) return false;
      if (view === "open" && !(i.status === "open" || i.status === "proposed")) return false;
      // Vencidas em aberto aparecem em qualquer situação (nunca escondidas).
      if (view === "done" && !(i.status === "realized" && !isFixedCost(i)) && !keepOverdue(i)) return false;
      if (year && !i.date.startsWith(year) && !keepOverdue(i)) return false;
      if (month && i.date.slice(5, 7) !== month && !keepOverdue(i)) return false;
      if (currentMonth && !i.date.startsWith(now) && !keepOverdue(i)) return false;
      if (installment === "last" && !(i.installment && i.installment.number === i.installment.of)) return false;
      if (installment && installment !== "last" && String(i.installment?.number ?? "") !== installment) return false;
      if (term) {
        const text = `${i.project_name} ${i.description} ${i.origin_label} ${i.installment ? `${i.installment.number}/${i.installment.of}` : ""}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
  }, [rows, project, origin, view, year, month, currentMonth, installment, search, asOf]);

  // Linhas da tabela: o IR vira uma linha por mês (detalhe com as entradas); totais pelas linhas originais.
  const display = useMemo(() => (kind === "non_reimbursable" ? groupIncomeTax(shown) : shown), [kind, shown]);

  // Saldo das linhas exibidas (estornadas ficam fora, como nos cards).
  const signed = shown.reduce((s, i) => (i.status === "reversed" ? s : s + (i.direction === "in" ? 1 : -1) * cents(i.gross)), 0);
  useEffect(() => {
    onBalance?.(kind, hidden ? null : signed);
  }, [onBalance, kind, hidden, signed]);

  // ── seleção e ações (cada uma respeita a permissão e a regra da origem) ──
  const eligible = (i: FlowItem) => {
    if (i.derived) return [] as BlockAction["kind"][];
    const out: BlockAction["kind"][] = [];
    if (inflow) {
      if (i.status === "proposed" && i.refs.source_key && can("receivables:edit")) out.push("confirm", "discard");
      if (i.status === "open" && i.refs.installment_id) {
        if (can("receivables:receive")) out.push("receive");
        if (can("receivables:reschedule")) out.push("reschedule");
      }
      if (i.status === "realized" && i.refs.event_id) {
        if (can("receivables:reverse")) out.push("undo");
        if (can("receivables:receive") && can("receivables:reverse")) out.push("redate");
      }
    } else if (i.refs.settle_key && can(SETTLE_PERMISSION[i.origin] ?? "—")) {
      if (i.status === "open") out.push("settle");
      // Despesa: só a baixa feita aqui no fluxo pode ser alterada ou desfeita aqui.
      if (i.status === "realized" && (i.origin !== "expense" || i.refs.settled_here === 1)) out.push("repay", "unsettle");
    }
    return out;
  };
  const byKey = new Map(shown.map((i) => [i.key, i]));
  const chosen = selected.map((k) => byKey.get(k)).filter((i): i is FlowItem => Boolean(i));
  const forAction = (a: BlockAction["kind"]) => chosen.filter((i) => eligible(i).includes(a));
  const selectable = shown.filter((i) => eligible(i).length > 0);
  const proposalsInReschedule = chosen.some((i) => i.status === "proposed");
  const sourceCount = (list: FlowItem[]) => new Set(list.map((i) => String(i.refs.source_key))).size;
  const act = (a: BlockAction["kind"]) => onAction({ kind: a, items: forAction(a) } as BlockAction);
  const button = (a: BlockAction["kind"], label: string, variant: "primary" | "secondary" | "ghost" = "secondary", count?: number) => {
    const list = forAction(a);
    if (!selectable.some((i) => eligible(i).includes(a))) return null;
    return (
      <Button key={a} type="button" size="sm" variant={variant} disabled={!list.length || busy} onClick={() => act(a)}>
        {label} ({count ?? list.length})
      </Button>
    );
  };

  const clear = () => setFilters(DEFAULT_FILTERS);
  const done = inflow ? "Recebidos" : "Pagos";
  const count = `${display.length} lançamento${display.length === 1 ? "" : "s"}${selected.length ? ` · ${chosen.length} selecionado(s)` : ""}`;
  const regionId = `cash-flow-block-${kind}`;

  // ── colunas ──
  const dateCell = (v: string | null | undefined) => <td className="whitespace-nowrap border-b px-2 py-1.5 tabular-nums">{civilBr(v ?? null) || "—"}</td>;
  const projectCell = (i: FlowItem) => (
    <td className="min-w-[9rem] max-w-[16rem] border-b px-2 py-1.5 min-[1400px]:max-w-[22rem]" title={i.project_name}>
      <span className="line-clamp-2 break-words">{i.project_name}</span>
    </td>
  );
  const valueCell = (v: string, muted = false) => (
    <td className={`numeric border-b px-2 py-1.5 text-right ${muted ? "text-muted-foreground" : ""}`}>{formatMoney(v)}</td>
  );
  const statusCell = (i: FlowItem, withOverdue: boolean) => (
    <td className="min-w-[5.5rem] border-b px-2 py-1.5">
      {withOverdue && i.overdue && i.status !== "realized" ? (
        <StatusBadge finance="overdue" label={`Em atraso (${i.overdue_days} d)`} title={`${i.overdue_days} dia(s) em atraso`} />
      ) : (
        <StatusBadge finance={financeStatus(i)} />
      )}
      {i.status === "reversed" && i.refs.reversed_on ? <span className="block text-xs text-muted-foreground">estornado em {civilBr(String(i.refs.reversed_on))}</span> : null}
    </td>
  );
  const descriptionCell = (i: FlowItem) => {
    const open = expanded.includes(i.key);
    const fixed = isFixedCost(i);
    return (
      <td className="min-w-[10rem] max-w-[20rem] border-b px-2 py-1.5" title={i.description}>
        {i.details?.length ? (
          <button
            type="button"
            className="flex text-left underline-offset-2 hover:underline"
            aria-expanded={open}
            onClick={() => setExpanded((e) => (open ? e.filter((k) => k !== i.key) : [...e, i.key]))}
          >
            <span aria-hidden="true" className="shrink-0 pr-1">{open ? "▾" : "▸"}</span>
            <span className="line-clamp-2 break-words">{i.description}</span>
            <span className="sr-only"> (ver itens)</span>
          </button>
        ) : (
          <span className={`line-clamp-2 break-words ${fixed && i.refs.fixed_cost === "estimate" ? "italic" : ""}`}>{i.description}</span>
        )}
        {fixed ? (
          <span className="block text-xs text-muted-foreground">
            {i.refs.fixed_cost === "estimate" ? <span className="italic">estimativa{i.refs.basis ? ` (${String(i.refs.basis)})` : ""} · </span> : null}
            <Link className="underline" to={`/app/finance/dre?year=${i.date.slice(0, 4)}`}>Ajustar na DRE</Link>
          </span>
        ) : null}
      </td>
    );
  };
  const columns: Record<BlockKind, Array<[string, (i: FlowItem) => ReactNode, boolean?]>> = {
    billing: [
      ["Data prevista", (i) => dateCell(i.expected_on ?? i.date)],
      ["Data de recebimento", (i) => dateCell(i.realized_on)],
      ["Em atraso", (i) => <td className="whitespace-nowrap border-b px-2 py-1.5">{i.overdue ? <span className="font-semibold text-destructive-text">{i.overdue_days} dia(s)</span> : ""}</td>],
      ["Projeto", projectCell],
      ["Origem", (i) => <td className="whitespace-nowrap border-b px-2 py-1.5" title={`${i.origin_label} · ${i.description}`}>{shortOrigin(i)}</td>],
      ["Parcela", (i) => <td className={`whitespace-nowrap border-b px-2 py-1.5 ${i.installment && i.installment.number === i.installment.of && i.installment.of > 1 ? "font-semibold" : ""}`}>{i.installment ? `${i.installment.number}/${i.installment.of}` : ""}</td>],
      ["Situação", (i) => statusCell(i, false)],
      ["Valor bruto", (i) => valueCell(i.gross), true],
      ["Valor líquido", (i) => valueCell(i.net, true), true],
      ["% do contrato", (i) => <td className="numeric border-b px-2 py-1.5 text-right">{i.contract_pct ? `${i.contract_pct.replace(".", ",")}%` : ""}</td>, true],
    ],
    reimbursement: [
      ["Lote", (i) => dateCell(i.reference_on)],
      ["Data prevista", (i) => dateCell(i.expected_on ?? i.date)],
      ["Data de recebimento", (i) => dateCell(i.realized_on)],
      ["Projeto", projectCell],
      ["Descrição", descriptionCell],
      ["Origem", (i) => <td className="whitespace-nowrap border-b px-2 py-1.5" title={i.origin_label}>{shortOrigin(i)}</td>],
      ["Situação", (i) => statusCell(i, true)],
      ["Valor", (i) => valueCell(i.gross), true],
    ],
    to_reimburse: [
      ["Data", (i) => dateCell(i.reference_on ?? i.date)],
      ["Data prevista", (i) => dateCell(i.expected_on)],
      ["Data de pagamento", (i) => dateCell(i.realized_on)],
      ["Projeto", projectCell],
      ["Descrição", descriptionCell],
      ["Origem", (i) => <td className="whitespace-nowrap border-b px-2 py-1.5" title={i.origin_label}>{shortOrigin(i)}</td>],
      ["Situação", (i) => statusCell(i, true)],
      ["Valor", (i) => valueCell(i.gross), true],
    ],
    non_reimbursable: [
      ["Data", (i) => dateCell(i.expected_on ?? i.date)],
      ["Data de pagamento", (i) => dateCell(i.realized_on)],
      ["Projeto", projectCell],
      ["Descrição", descriptionCell],
      ["Origem", (i) => <td className="whitespace-nowrap border-b px-2 py-1.5" title={i.origin_label}>{shortOrigin(i)}</td>],
      ["Situação", (i) => statusCell(i, true)],
      ["Valor", (i) => valueCell(i.gross), true],
    ],
  };
  const cols = columns[kind];
  const width = cols.length + 1;
  const resale = shown.filter((i) => i.origin === "asset_tag");
  const reimbursements = shown.filter((i) => i.origin !== "asset_tag");
  /** Subtotal do bloco (o mesmo do rodapé), visível também com o bloco recolhido. */
  const subtotal = total(shown);
  const footer: Array<[string, number, number?]> =
    kind === "billing"
      ? [[`Subtotal (${shown.length})`, total(shown), total(shown, (i) => i.net)]]
      : kind === "reimbursement"
        ? [
            [`Reembolsos (${reimbursements.length})`, total(reimbursements)],
            [`Revenda de placas (${resale.length})`, total(resale)],
            [`Subtotal (${shown.length})`, total(shown)],
          ]
        : [[`${kind === "to_reimburse" ? "Total do período" : "Saldo do período"} (${display.length})`, total(shown)]];

  return (
    <DataPanel
      title={title}
      titleId={`${regionId}-title`}
      count={count}
      contentId={regionId}
      hidden={hidden}
      onToggle={() => setHidden(!hidden)}
      extra={
        <span className="text-sm text-white/80" aria-label={`Subtotal de ${title}`}>
          Subtotal <strong className="numeric text-white">{formatMoney(subtotal)}</strong>
        </span>
      }
    >
          <DataPanelFilters label={`Filtros de ${title}`}>
            <select aria-label="Projeto" className={select} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Projeto: todos</option>
              {options.projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            {tablesYear === "all" ? (
              <select aria-label="Ano" className={select} value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">Ano: todos</option>
                {options.years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            ) : null}
            <select aria-label="Mês" className={select} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Mês: todos</option>
              {MONTHS.map((m, n) => <option key={m} value={String(n + 1).padStart(2, "0")}>{m}</option>)}
            </select>
            {kind === "billing" ? (
              <select aria-label="Parcela" className={select} value={installment} onChange={(e) => setInstallment(e.target.value)}>
                <option value="">Parcela: todas</option>
                <option value="last">Última parcela</option>
                {[...new Set(rows.map((i) => i.installment?.number).filter((n): n is number => Boolean(n)))].sort((a, b) => a - b).map((n) => (
                  <option key={n} value={String(n)}>{n}ª parcela</option>
                ))}
              </select>
            ) : null}
            {kind === "reimbursement" || kind === "non_reimbursable" ? (
              <select aria-label="Origem" className={select} value={origin} onChange={(e) => setOrigin(e.target.value)}>
                <option value="">Origem: todas</option>
                {options.origins.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : null}
            <div className="flex flex-wrap gap-1" role="group" aria-label="Situação">
              {([["open", "Em aberto"], ["done", done], ["all", "Todos"]] as const).map(([v, label]) => (
                <ViewToggle key={v} on={view === v} onClick={() => setView(v)}>{label}</ViewToggle>
              ))}
            </div>
            <ViewToggle on={currentMonth} onClick={() => setCurrentMonth(!currentMonth)}>Mês atual</ViewToggle>
            <input aria-label={`Buscar em ${title}`} placeholder="Buscar projeto, descrição…" className="h-10 w-full rounded-md border bg-background px-3 text-sm md:w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="button" size="sm" variant="outline" onClick={clear}>Limpar filtros</Button>
          </DataPanelFilters>
          {chosen.length ? (
            <div className="flex flex-wrap items-center gap-2 border-y bg-muted/50 px-4 py-2" role="toolbar" aria-label={`Ações dos selecionados em ${title}`}>
              <span className="text-sm text-muted-foreground">Selecionados:</span>
              {inflow ? (
                <>
                  {button("confirm", "Confirmar propostas", "primary", sourceCount(forAction("confirm")))}
                  {button("discard", "Descartar propostas", "secondary", sourceCount(forAction("discard")))}
                  {button("receive", "Marcar como recebido", "primary")}
                  {button("reschedule", "Alterar data prevista")}
                  {button("redate", "Alterar data de recebimento")}
                  {button("undo", "Desfazer recebimento", "ghost")}
                  {proposalsInReschedule && can("receivables:reschedule") ? (
                    <span className="text-xs text-muted-foreground">Propostas: confirme antes de alterar a data prevista.</span>
                  ) : null}
                </>
              ) : (
                <>
                  {button("settle", "Pagar", "primary")}
                  {button("repay", "Alterar data de pagamento")}
                  {button("unsettle", "Desfazer pagamento", "ghost")}
                </>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(() => [])}>Limpar seleção</Button>
            </div>
          ) : null}
          <div className="max-h-[620px] max-w-full overflow-auto" role="region" aria-label={`Tabela: ${title}`} tabIndex={0}>
            <table className="data-table w-full min-w-[46rem] border-separate border-spacing-0 text-left text-sm lg:min-w-0">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 border-b px-2 py-1.5">
                    {selectable.length ? (
                      <input
                        type="checkbox"
                        aria-label={`Selecionar todos os visíveis em ${title}`}
                        checked={selectable.every((i) => selected.includes(i.key))}
                        onChange={(e) => setSelected(() => (e.target.checked ? selectable.map((i) => i.key) : []))}
                      />
                    ) : <span className="sr-only">Selecionar</span>}
                  </th>
                  {cols.map(([h, , right]) => (
                    <th key={h} scope="col" className={`whitespace-nowrap border-b px-2 py-1.5 align-bottom font-semibold ${right ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.length ? (
                  display.map((i) => {
                    const canPick = eligible(i).length > 0;
                    const open = expanded.includes(i.key);
                    return (
                      <Fragment key={i.key}>
                        <tr
                          className={
                            i.overdue
                              ? "row-overdue"
                              : i.status === "proposed"
                                ? "bg-warning/[0.08]"
                                : i.status === "reversed"
                                  ? "text-muted-foreground line-through decoration-muted-foreground/50"
                                  : isFixedCost(i) && i.refs.fixed_cost === "estimate"
                                    ? "italic text-muted-foreground"
                                    : ""
                          }
                        >
                          <td className="border-b px-2 py-1.5">
                            {canPick ? (
                              <input
                                type="checkbox"
                                aria-label={`Selecionar ${i.description} ${civilBr(i.date)}`}
                                checked={selected.includes(i.key)}
                                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i.key] : s.filter((k) => k !== i.key)))}
                              />
                            ) : null}
                          </td>
                          {cols.map(([h, render]) => <Fragment key={h}>{render(i)}</Fragment>)}
                        </tr>
                        {open && i.details?.length ? (
                          <tr>
                            <td />
                            <td colSpan={width - 1} className="border-b px-2 pb-3">
                              <ul className="grid gap-1 rounded-md border bg-muted/40 p-2 text-xs" aria-label={`Itens de ${i.description}`}>
                                {i.details.map((d, n) => (
                                  <li key={n} className="flex flex-wrap gap-x-3">
                                    <span className="tabular-nums text-muted-foreground">{civilBr(d.date)}</span>
                                    <span className="flex-1 break-words">{d.description}</span>
                                    <span className="numeric">{formatMoney(d.amount)}</span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={width} className="px-3 py-4 text-muted-foreground">Nenhum lançamento com estes filtros.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                {footer.map(([label, gross, net]) => (
                  <tr key={label} className="font-semibold">
                    <td colSpan={kind === "billing" ? width - 3 : width - 1} className="px-2 py-2">{label}</td>
                    <td className="numeric px-2 py-2 text-right">{formatMoney(gross)}</td>
                    {kind === "billing" ? <td className="numeric px-2 py-2 text-right text-muted-foreground">{formatMoney(net ?? 0)}</td> : null}
                    {kind === "billing" ? <td /> : null}
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
    </DataPanel>
  );
}
