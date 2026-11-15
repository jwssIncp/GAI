import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/utils/format";
import { civilBr, type FlowItem } from "./cashFlowBoardApi";
import { useViewPreference } from "./useViewPreference";

export type BlockKind = "billing" | "reimbursement" | "to_reimburse" | "non_reimbursable";

/** Ações de um bloco: as que abrem diálogo e as diretas. */
export type BlockAction =
  | { kind: "confirm" | "undo" | "unsettle"; items: FlowItem[] }
  | { kind: "discard" | "receive" | "reschedule" | "redate" | "settle" | "repay"; items: FlowItem[] };

const STATUS_IN: Record<FlowItem["status"], string> = { realized: "Recebido", open: "Previsto", proposed: "Previsto (não confirmado)", reversed: "Estornado" };
const STATUS_OUT: Record<FlowItem["status"], string> = { realized: "Pago", open: "A pagar", proposed: "Previsto", reversed: "Estornado" };
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

const isFixedCost = (i: FlowItem) => i.origin === "fixed_cost";
function statusLabel(i: FlowItem) {
  if (isFixedCost(i)) return i.refs.fixed_cost === "estimate" ? "Estimado" : "Lançado";
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
  const [project, setProject] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [view, setView] = useState<"open" | "done" | "all">("all");
  const [currentMonth, setCurrentMonth] = useState(false);
  const [search, setSearch] = useState("");
  const [installment, setInstallment] = useState("");
  const [origin, setOrigin] = useState("");
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
      if (view === "done" && !(i.status === "realized" && !isFixedCost(i))) return false;
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

  const clear = () => {
    setProject("");
    setYear("");
    setMonth("");
    setView("all");
    setCurrentMonth(false);
    setSearch("");
    setInstallment("");
    setOrigin("");
  };
  const done = inflow ? "Recebidos" : "Pagos";
  const count = `${shown.length} lançamento${shown.length === 1 ? "" : "s"}${selected.length ? ` · ${chosen.length} selecionado(s)` : ""}`;
  const regionId = `cash-flow-block-${kind}`;

  // ── colunas ──
  const dateCell = (v: string | null | undefined) => <td className="whitespace-nowrap border-b px-2 py-2 tabular-nums">{civilBr(v ?? null) || "—"}</td>;
  const projectCell = (i: FlowItem) => (
    <td className="min-w-[9rem] max-w-[16rem] border-b px-2 py-2" title={i.project_name}>
      <span className="line-clamp-2 break-words">{i.project_name}</span>
    </td>
  );
  const valueCell = (v: string, muted = false) => (
    <td className={`whitespace-nowrap border-b px-2 py-2 text-right tabular-nums ${muted ? "text-muted-foreground" : ""}`}>{formatMoney(v)}</td>
  );
  const statusCell = (i: FlowItem, withOverdue: boolean) => (
    <td className="min-w-[6rem] border-b px-2 py-2">
      {statusLabel(i)}
      {i.status === "reversed" && i.refs.reversed_on ? <span className="block text-xs text-muted-foreground">estornado em {civilBr(String(i.refs.reversed_on))}</span> : null}
      {withOverdue && i.overdue ? <span className="block text-xs font-semibold text-destructive">{i.overdue_days} dia(s) em atraso</span> : null}
    </td>
  );
  const descriptionCell = (i: FlowItem) => {
    const open = expanded.includes(i.key);
    const fixed = isFixedCost(i);
    return (
      <td className="min-w-[10rem] max-w-[20rem] border-b px-2 py-2" title={i.description}>
        {i.details?.length ? (
          <button
            type="button"
            className="text-left underline-offset-2 hover:underline"
            aria-expanded={open}
            onClick={() => setExpanded((e) => (open ? e.filter((k) => k !== i.key) : [...e, i.key]))}
          >
            <span aria-hidden="true">{open ? "▾ " : "▸ "}</span>
            <span className="break-words">{i.description}</span>
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
      ["Recebido em", (i) => dateCell(i.realized_on)],
      ["Em atraso", (i) => <td className="whitespace-nowrap border-b px-2 py-2">{i.overdue ? <span className="font-semibold text-destructive">{i.overdue_days} dia(s)</span> : ""}</td>],
      ["Projeto", projectCell],
      ["Origem", (i) => <td className="whitespace-nowrap border-b px-2 py-2" title={i.description}>{i.origin_label}</td>],
      ["Parcela", (i) => <td className={`whitespace-nowrap border-b px-2 py-2 ${i.installment && i.installment.number === i.installment.of && i.installment.of > 1 ? "font-semibold" : ""}`}>{i.installment ? `${i.installment.number}/${i.installment.of}` : ""}</td>],
      ["Status", (i) => statusCell(i, false)],
      ["Valor bruto", (i) => valueCell(i.gross), true],
      ["Valor líquido", (i) => valueCell(i.net, true), true],
      ["% do contrato", (i) => <td className="whitespace-nowrap border-b px-2 py-2 text-right tabular-nums">{i.contract_pct ? `${i.contract_pct.replace(".", ",")}%` : ""}</td>, true],
    ],
    reimbursement: [
      ["Data do lote", (i) => dateCell(i.reference_on)],
      ["Data prevista", (i) => dateCell(i.expected_on ?? i.date)],
      ["Recebido em", (i) => dateCell(i.realized_on)],
      ["Projeto", projectCell],
      ["Descrição", descriptionCell],
      ["Origem", (i) => <td className="min-w-[7rem] border-b px-2 py-2">{i.origin_label}</td>],
      ["Status", (i) => statusCell(i, true)],
      ["Valor", (i) => valueCell(i.gross), true],
    ],
    to_reimburse: [
      ["Data", (i) => dateCell(i.reference_on ?? i.date)],
      ["Data prevista", (i) => dateCell(i.expected_on)],
      ["Pago em", (i) => dateCell(i.realized_on)],
      ["Projeto", projectCell],
      ["Descrição", descriptionCell],
      ["Origem", (i) => <td className="min-w-[7rem] border-b px-2 py-2">{i.origin_label}</td>],
      ["Status", (i) => statusCell(i, true)],
      ["Valor", (i) => valueCell(i.gross), true],
    ],
    non_reimbursable: [
      ["Data", (i) => dateCell(i.expected_on ?? i.date)],
      ["Pago em", (i) => dateCell(i.realized_on)],
      ["Projeto", projectCell],
      ["Descrição", descriptionCell],
      ["Origem", (i) => <td className="min-w-[7rem] border-b px-2 py-2">{i.origin_label}</td>],
      ["Status", (i) => statusCell(i, true)],
      ["Valor", (i) => valueCell(i.gross), true],
    ],
  };
  const cols = columns[kind];
  const width = cols.length + 1;
  const resale = shown.filter((i) => i.origin === "asset_tag");
  const reimbursements = shown.filter((i) => i.origin !== "asset_tag");
  const footer: Array<[string, number, number?]> =
    kind === "billing"
      ? [[`Subtotal (${shown.length})`, total(shown), total(shown, (i) => i.net)]]
      : kind === "reimbursement"
        ? [
            [`Reembolsos (${reimbursements.length})`, total(reimbursements)],
            [`Revenda de placas (${resale.length})`, total(resale)],
            [`Subtotal (${shown.length})`, total(shown)],
          ]
        : [[`${kind === "to_reimburse" ? "Total do período" : "Saldo do período"} (${shown.length})`, total(shown)]];

  return (
    <section className="premium-panel" aria-labelledby={`${regionId}-title`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <h2 id={`${regionId}-title`} className="text-base font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{count}</span>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" aria-expanded={!hidden} aria-controls={regionId} onClick={() => setHidden(!hidden)}>
          {hidden ? "Mostrar" : "Ocultar"}
        </Button>
      </header>
      {hidden ? null : (
        <div id={regionId}>
          <div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:flex-wrap md:items-end [&>*]:min-w-0" role="group" aria-label={`Filtros de ${title}`}>
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
                <Button key={v} type="button" size="sm" variant={view === v ? "soft" : "ghost"} aria-pressed={view === v} onClick={() => setView(v)}>{label}</Button>
              ))}
            </div>
            <Button type="button" size="sm" variant={currentMonth ? "soft" : "ghost"} aria-pressed={currentMonth} onClick={() => setCurrentMonth(!currentMonth)}>Mês atual</Button>
            <input aria-label={`Buscar em ${title}`} placeholder="Buscar projeto, descrição…" className="h-10 w-full rounded-md border bg-background px-3 text-sm md:w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="button" size="sm" variant="ghost" onClick={clear}>Limpar filtros</Button>
          </div>
          {chosen.length ? (
            <div className="flex flex-wrap items-center gap-2 border-y bg-muted/50 px-4 py-2" role="toolbar" aria-label={`Ações dos selecionados em ${title}`}>
              <span className="text-sm text-muted-foreground">Selecionados:</span>
              {inflow ? (
                <>
                  {button("confirm", "Confirmar propostas", "primary", sourceCount(forAction("confirm")))}
                  {button("discard", "Descartar propostas", "secondary", sourceCount(forAction("discard")))}
                  {button("receive", "Recebido", "primary")}
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
          <div className="max-w-full overflow-x-auto" role="region" aria-label={`Tabela: ${title}`} tabIndex={0}>
            <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-left text-sm lg:min-w-0">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 border-b px-2 py-2">
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
                    <th key={h} scope="col" className={`border-b px-2 py-2 align-bottom font-semibold ${right ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.length ? (
                  shown.map((i) => {
                    const canPick = eligible(i).length > 0;
                    const open = expanded.includes(i.key);
                    return (
                      <Fragment key={i.key}>
                        <tr
                          className={
                            i.overdue
                              ? "bg-destructive/[0.07]"
                              : i.status === "proposed"
                                ? "bg-warning/[0.08]"
                                : i.status === "reversed"
                                  ? "text-muted-foreground line-through decoration-muted-foreground/50"
                                  : isFixedCost(i) && i.refs.fixed_cost === "estimate"
                                    ? "italic text-muted-foreground"
                                    : ""
                          }
                        >
                          <td className="border-b px-2 py-2">
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
                                    <span className="whitespace-nowrap tabular-nums">{formatMoney(d.amount)}</span>
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
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatMoney(gross)}</td>
                    {kind === "billing" ? <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(net ?? 0)}</td> : null}
                    {kind === "billing" ? <td /> : null}
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
