import { useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { FilterPanel } from "@/components/base/FilterPanel";
import { FormField } from "@/components/base/FormField";
import { ErrorState, LoadingState } from "@/components/base/States";
import { MoneyInput } from "@/components/base/MoneyInput";
import { useToast } from "@/components/ui/toast-context";
import { FinanceHeaderActions } from "@/features/receivables/FinanceLayout";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/features/auth/usePermissions";
import { formatDateTime, formatMoney } from "@/utils/format";
import {
  dreClosingApi,
  dreMonthlyApi,
  dreMonthlyKeys,
  monthLabel,
  type DreCell,
  type DreGridAccount,
  type DreImportPlan,
  type DreLayout,
  type DreMonthlyView,
} from "./dreMonthlyApi";

const select = "h-10 rounded-md border bg-background px-3 text-sm";
type Configured = Extract<DreMonthlyView, { configured: true }>;
type Row =
  | { kind: "account"; account: DreGridAccount }
  | { kind: "line"; key: string; label: string; strong?: boolean }
  | { kind: "group"; label: string };

/** Ordem das linhas (como a DRE do INVESTOR, sobre o plano de contas configurável). */
function rows(accounts: DreGridAccount[]): Row[] {
  const of = (g: string) => accounts.filter((a) => a.group === g && !a.post_operational).map((account) => ({ kind: "account" as const, account }));
  return [
    { kind: "group", label: "Receitas" },
    ...of("revenue"),
    { kind: "line", key: "revenue", label: "Receita bruta", strong: true },
    ...of("deductions"),
    { kind: "line", key: "net_revenue", label: "Receita líquida", strong: true },
    { kind: "group", label: "Custos variáveis" },
    ...of("direct_cost"),
    { kind: "line", key: "variable_costs", label: "Total variáveis" },
    { kind: "group", label: "Custos fixos" },
    ...of("operating_expense"),
    { kind: "line", key: "fixed_costs", label: "Total fixos" },
    { kind: "line", key: "total_costs", label: "Custo total", strong: true },
    { kind: "line", key: "operating_result", label: "Resultado operacional", strong: true },
    { kind: "group", label: "Pós-operacional" },
    ...accounts.filter((a) => a.post_operational).map((account) => ({ kind: "account" as const, account })),
    ...of("financial_income"),
    ...of("financial_expense"),
    { kind: "line", key: "financial_result", label: "Resultado financeiro" },
    ...of("income_tax"),
    { kind: "line", key: "final_result", label: "Resultado final", strong: true },
  ];
}

const money = (v: string) => formatMoney(v);

/** Financeiro › DRE mensal (doc 06 §7.5, etapa 9). */
export function DreMonthlyPage() {
  const { hasPermission } = usePermissions();
  const cache = useQueryClient();
  const { toast } = useToast();
  const thisYear = String(new Date().getFullYear());
  // ?year=AAAA abre o ano pedido (ex.: "Ajustar na DRE" a partir do fluxo de caixa).
  const [params] = useSearchParams();
  const [year, setYear] = useState(() => (/^\d{4}$/.test(params.get("year") ?? "") ? params.get("year")! : thisYear));
  const [compareYear, setCompareYear] = useState("");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(12);
  const [onlyTotal, setOnlyTotal] = useState(false);
  const [summary, setSummary] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [cell, setCell] = useState<{ account: DreGridAccount; month: string } | null>(null);
  const [dialog, setDialog] = useState<"import" | "config" | "model" | null>(null);
  // Sucesso vai por toast; erro fica na tela (inline).
  const [failure, setFailure] = useState<string | null>(null);
  const done = (message: string) => {
    setFailure(null);
    toast({ title: message, tone: "success" });
  };
  const q = { year, ...(compareYear ? { compare_year: compareYear } : {}) };
  const view = useQuery({ queryKey: dreMonthlyKeys.view(q), queryFn: () => dreMonthlyApi.view(q), placeholderData: keepPreviousData });
  const refresh = () => cache.invalidateQueries({ queryKey: dreMonthlyKeys.all });
  const layoutMutation = useMutation({
    mutationFn: ({ layout, reason }: { layout: DreLayout; reason: string }) =>
      dreMonthlyApi.saveLayout((view.data as Configured).config.layout.revision, layout, reason),
    onSuccess: () => void refresh(),
    onError: (e) => setFailure((e as Error).message),
  });
  const accountMutation = useMutation({
    mutationFn: (a: { id: number; revision: number; name: string; active: boolean }) =>
      dreMonthlyApi.setAccountActive(a.id, a.revision, a.name, a.active, a.active ? "Restaurar linha da DRE" : "Excluir linha da DRE"),
    onSuccess: (_r, a) => {
      done(a.active ? `Linha "${a.name}" restaurada.` : `Linha "${a.name}" excluída. Ela pode ser restaurada em "Linhas excluídas".`);
      void refresh();
    },
    onError: (e) => setFailure((e as Error).message),
  });
  const years = useMemo(() => Array.from({ length: 7 }, (_, i) => String(Number(thisYear) + 1 - i)), [thisYear]);

  if (view.isLoading) return <LoadingState />;
  if (view.isError || !view.data) return <ErrorState message={(view.error as Error)?.message} onRetry={() => void view.refetch()} />;
  if (!view.data.configured)
    return (
      <p className="rounded-lg border p-4 text-sm">
        A DRE mensal precisa dos parâmetros financeiros vigentes (mês de corte, % de IR, comissão do sócio).{" "}
        <Link className="font-semibold underline" to="/app/finance/parameters">Configurar parâmetros</Link>
      </p>
    );
  const data = view.data;
  const g = data.grid;
  const layout = data.config.layout.data;
  const hidden = new Set(layout.hidden);
  const inSummary = new Set(layout.summary);
  const months = g.months.slice(from - 1, to);
  const idx = months.map((m) => g.months.indexOf(m));
  const sum = (values: string[]) => (idx.reduce((s, i) => s + Math.round(Number(values[i]) * 100), 0) / 100).toFixed(2);
  const line = (key: string) => g.lines.find((l) => l.key === key)!;
  const cmpLine = (key: string) => data.compare?.lines.find((l) => l.key === key);
  const cmpAccount = (id: number) => data.compare?.accounts.find((a) => a.id === id);
  const accountInfo = (id: number) => data.config.accounts.find((a) => a.id === id);
  const visible = rows(g.accounts).filter((r) => {
    if (r.kind !== "account") return !summary || r.kind === "line";
    if (hidden.has(r.account.id) && !showHidden) return false;
    return !summary || inSummary.has(r.account.id);
  });
  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const canConfigure = hasPermission("dre:configure");

  const cellView = (a: DreGridAccount, c: DreCell) => (
    <button
      type="button"
      className={`numeric w-full text-right ${c.estimate ? "italic text-muted-foreground" : ""} ${c.value.startsWith("-") ? "text-destructive-text" : ""}`}
      title={c.estimate ? `Estimativa (não gravada): ${c.estimate_basis}` : c.closed ? "Competência fechada" : Number(c.flow) ? "Inclui valores do fluxo de caixa" : "Ver detalhes"}
      onClick={() => setCell({ account: a, month: c.month })}
    >
      {c.estimate ? "≈ " : ""}
      {c.value === "0.00" ? "—" : money(c.value)}
    </button>
  );

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">DRE mensal {g.year}</h2>
          <p className="text-sm text-muted-foreground">
            Até {monthLabel(addMonth(g.cutoff, -1))}: valores lançados ou importados. Desde {monthLabel(g.cutoff)}: fluxo de caixa pelas regras + ajustes lançados.
            Meses fechados ficam congelados; <span className="italic">≈ valores em itálico</span> são estimativas dos meses abertos (não gravadas).
          </p>
        </div>
        <FinanceHeaderActions>
          {hasPermission("dre:import") ? <Button type="button" variant="secondary" onClick={() => setDialog("import")}>Importar planilha</Button> : null}
          {canConfigure ? <Button type="button" variant="secondary" onClick={() => setDialog("model")}>Aplicar modelo padrão</Button> : null}
          {canConfigure ? <Button type="button" variant="secondary" onClick={() => setDialog("config")}>Configurar</Button> : null}
        </FinanceHeaderActions>
      </div>

      {g.warnings.length ? (
        <ul role="status" className="grid gap-1 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          {g.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
        </ul>
      ) : null}
      {failure ? <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive-text">{failure}</p> : null}

      <FilterPanel>
        <select aria-label="Ano" className={select} value={year} onChange={(e) => setYear(e.target.value)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Comparar com" className={select} value={compareYear} onChange={(e) => setCompareYear(e.target.value)}>
          <option value="">Sem comparativo</option>
          {years.filter((y) => y !== year).map((y) => <option key={y} value={y}>Comparar com {y}</option>)}
        </select>
        <select aria-label="Mês inicial" className={select} value={from} onChange={(e) => { const v = Number(e.target.value); setFrom(v); if (to < v) setTo(v); }}>
          {g.months.map((m, i) => <option key={m} value={i + 1}>De {monthLabel(m)}</option>)}
        </select>
        <select aria-label="Mês final" className={select} value={to} onChange={(e) => setTo(Number(e.target.value))}>
          {g.months.map((m, i) => (i + 1 >= from ? <option key={m} value={i + 1}>Até {monthLabel(m)}</option> : null))}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyTotal} onChange={(e) => setOnlyTotal(e.target.checked)} />Somente acumulado</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} />DRE resumida</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />Mostrar linhas ocultas</label>
      </FilterPanel>

      <div className="relative min-w-0 max-w-full scroll-pl-40 overflow-x-auto rounded-lg border sm:scroll-pl-[17rem]">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="sticky left-0 z-10 w-36 max-w-36 bg-muted px-3 py-2 text-left sm:w-64 sm:max-w-64">Conta</th>
              {!onlyTotal && !data.compare
                ? months.map((m) => {
                    const st = g.month_state.find((s) => s.month === m)!;
                    return (
                      <th key={m} className="px-3 py-2 text-right font-medium" title={m < g.cutoff ? "Antes do corte, a DRE usa o lançado/importado." : undefined}>
                        {monthLabel(m)}
                        <span className="block text-xs font-normal text-muted-foreground">{st.closed ? "🔒 fechado" : st.projected ? "previsto" : st.automatic ? "fluxo" : "lançado"}</span>
                        {m < g.cutoff ? <span className="sr-only">Antes do corte, a DRE usa o lançado/importado.</span> : null}
                      </th>
                    );
                  })
                : null}
              <th className="px-3 py-2 text-right">Acumulado {monthLabel(months[0])}–{monthLabel(months[months.length - 1])}</th>
              {data.compare ? <th className="px-3 py-2 text-right">{data.compare.year} (mesmo período)</th> : null}
              {data.compare ? <th className="px-3 py-2 text-right">Variação</th> : null}
              {canConfigure && !summary ? <th className="px-3 py-2"><span className="sr-only">Ações</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              if (r.kind === "group")
                return (
                  <tr key={`g${i}`} className="bg-muted/30">
                    <td className="sticky left-0 z-[1] w-36 max-w-36 bg-muted px-3 py-1 sm:w-64 sm:max-w-64 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={1}>{r.label}</td>
                    <td colSpan={(onlyTotal || data.compare ? 0 : months.length) + 1 + (data.compare ? 2 : 0) + (canConfigure && !summary ? 1 : 0)} />
                  </tr>
                );
              if (r.kind === "line") {
                const l = line(r.key);
                const total = sum(l.values);
                const cmp = cmpLine(r.key);
                const cmpTotal = cmp ? sum(cmp.values) : null;
                return (
                  <tr key={r.key} className={`border-t ${r.strong ? "bg-primary/5 font-semibold" : "font-medium"}`}>
                    <td className="sticky left-0 z-[1] w-36 max-w-36 bg-card px-3 py-2 sm:w-64 sm:max-w-64">{r.label}</td>
                    {!onlyTotal && !data.compare ? idx.map((j) => <td key={j} className={`numeric px-3 py-2 text-right ${l.values[j].startsWith("-") ? "text-destructive-text" : ""}`}>{money(l.values[j])}</td>) : null}
                    <td className={`numeric px-3 py-2 text-right ${total.startsWith("-") ? "text-destructive-text" : ""}`}>{money(total)}</td>
                    {data.compare ? <td className="numeric px-3 py-2 text-right">{cmpTotal ? money(cmpTotal) : "—"}</td> : null}
                    {data.compare ? <td className="numeric px-3 py-2 text-right">{cmpTotal ? money((Number(total) - Number(cmpTotal)).toFixed(2)) : "—"}</td> : null}
                    {canConfigure && !summary ? <td /> : null}
                  </tr>
                );
              }
              const a = r.account;
              const total = sum(a.cells.map((c) => c.value));
              const cmp = cmpAccount(a.id);
              const cmpTotal = cmp ? sum(cmp.values) : null;
              const info = accountInfo(a.id);
              return (
                <tr key={a.id} className={`border-t ${hidden.has(a.id) ? "opacity-60" : ""}`}>
                  <td className="sticky left-0 z-[1] w-36 max-w-36 truncate bg-card px-3 py-2 sm:w-64 sm:max-w-64" title={`${a.code} ${a.name}`}>
                    {a.code} {a.name}
                    {a.flow_kinds.length ? <span className="ml-2 rounded bg-primary/10 px-1.5 text-xs text-primary" title={a.flow_kinds.map((k) => data.config.rule_labels[k]).join("; ")}>fluxo</span> : null}
                    {a.role ? <span className="ml-2 rounded bg-muted px-1.5 text-xs" title={data.config.rule_labels[a.role]}>projeção</span> : null}
                    {hidden.has(a.id) ? <span className="ml-2 text-xs text-muted-foreground">(oculta)</span> : null}
                  </td>
                  {!onlyTotal && !data.compare ? idx.map((j) => <td key={j} className="px-3 py-2">{cellView(a, a.cells[j])}</td>) : null}
                  <td className={`numeric px-3 py-2 text-right ${total.startsWith("-") ? "text-destructive-text" : ""}`}>{money(total)}</td>
                  {data.compare ? <td className="numeric px-3 py-2 text-right">{cmpTotal ? money(cmpTotal) : "—"}</td> : null}
                  {data.compare ? <td className="numeric px-3 py-2 text-right">{cmpTotal ? money((Number(total) - Number(cmpTotal)).toFixed(2)) : "—"}</td> : null}
                  {canConfigure && !summary ? (
                    <td className="whitespace-nowrap px-2 py-1 text-right">
                      <Button type="button" variant="ghost" onClick={() => layoutMutation.mutate({ layout: { ...layout, hidden: toggle(layout.hidden, a.id) }, reason: hidden.has(a.id) ? "Mostrar linha" : "Ocultar linha" })}>
                        {hidden.has(a.id) ? "Mostrar" : "Ocultar"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => layoutMutation.mutate({ layout: { ...layout, summary: toggle(layout.summary, a.id) }, reason: "Linhas da DRE resumida" })}>
                        {inSummary.has(a.id) ? "Tirar da resumida" : "Na resumida"}
                      </Button>
                      {info && !a.role && !a.flow_kinds.length ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Excluir a linha "${a.name}"? Os valores ficam guardados e a linha pode ser restaurada.`))
                              accountMutation.mutate({ id: a.id, revision: info.revision, name: info.name, active: false });
                          }}
                        >
                          Excluir
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.config.excluded_accounts.length ? (
        <section aria-label="Linhas excluídas" className="rounded-lg border p-3 text-sm">
          <p className="font-semibold">Linhas excluídas</p>
          <ul className="mt-2 grid gap-1">
            {data.config.excluded_accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>{a.code} {a.name}</span>
                {canConfigure ? <Button type="button" variant="ghost" onClick={() => accountMutation.mutate({ id: a.id, revision: a.revision, name: a.name, active: true })}>Restaurar</Button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cell ? <CellDialog account={cell.account} month={cell.month} canEdit={hasPermission("dre:adjust")} onClose={() => setCell(null)} onSaved={() => { setCell(null); done("Valor da DRE salvo."); void refresh(); }} /> : null}
      {dialog === "import" ? <ImportDialog defaultYear={year} onClose={() => setDialog(null)} onDone={(n) => { setDialog(null); done(`Importação concluída: ${n} valor(es) gravado(s).`); void refresh(); }} /> : null}
      {dialog === "model" ? <ModelDialog onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); done(m); void refresh(); }} /> : null}
      {hasPermission("dre:classify") && hasPermission("dre:adjust") ? <ReviewPanel onDone={(m) => { done(m); void refresh(); }} /> : null}
      {dialog === "config" ? <ConfigDialog data={data} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); done("Configuração da DRE salva."); void refresh(); }} /> : null}
    </div>
  );
}

function addMonth(ym: string, n: number) {
  const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function CellDialog({ account, month, canEdit, onClose, onSaved }: { account: DreGridAccount; month: string; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const detail = useQuery({ queryKey: ["dre-monthly", "detail", account.id, month], queryFn: () => dreMonthlyApi.detail(account.id, month) });
  // Valor no formato da API ("6200.00", aceita negativo); o campo mostra "6.200,00".
  const [amount, setAmount] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: (value: string | null) => dreMonthlyApi.setCell(account.id, month, value, reason.trim()),
    onSuccess: onSaved,
    onError: (e) => setError((e as Error).message),
  });
  const d = detail.data;
  const c = d?.cell;
  const current = amount ?? c?.entered ?? "";
  const submit = (clear: boolean) => {
    if (reason.trim().length < 5) return setError("Informe o motivo (mínimo de 5 caracteres).");
    const typed = Boolean(input.current?.value.trim());
    if (!clear && typed && !current) return setError("Valor inválido (ex.: 1.234,56 ou -500,00).");
    const parsed = clear || !current ? null : current;
    if (!clear && parsed === null) return setError("Informe o valor ou use “Apagar lançamento”.");
    setError("");
    save.mutate(parsed);
  };
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title={`${account.code} ${account.name} · ${monthLabel(month)}`}>
      {detail.isLoading || !c ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt>Valor na DRE</dt><dd className="text-right font-semibold tabular-nums">{formatMoney(c.value)}</dd>
            {c.closed ? (<><dt>Situação</dt><dd className="text-right">🔒 competência fechada (valor congelado)</dd></>) : null}
            <dt>Do fluxo de caixa</dt><dd className="text-right tabular-nums">{formatMoney(c.flow)}</dd>
            <dt>Lançado / importado</dt><dd className="text-right tabular-nums">{c.entered === null ? "—" : formatMoney(c.entered)}</dd>
            <dt>Classificações</dt><dd className="text-right tabular-nums">{formatMoney(c.classified)}</dd>
            {c.estimate ? (<><dt>Estimativa (não gravada)</dt><dd className="text-right tabular-nums italic">{formatMoney(c.estimate)} · {c.estimate_basis}</dd></>) : null}
          </dl>
          {d.movements.length ? (
            <div>
              <p className="font-semibold">Movimentos do fluxo</p>
              <ul className="mt-1 grid gap-1">
                {d.movements.map((m, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{m.date.split("-").reverse().join("/")} · {m.project_name} · {m.description}</span>
                    <span className={`numeric ${m.sign < 0 ? "text-destructive-text" : ""}`}>{formatMoney(m.sign < 0 ? -Number(m.gross) : m.gross)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : d.movements_hidden ? <p className="text-muted-foreground">Os movimentos do fluxo exigem a permissão de leitura do fluxo de caixa.</p> : null}
          {d.versions.length ? (
            <div>
              <p className="font-semibold">Histórico do lançamento</p>
              <ul className="mt-1 grid gap-1">
                {d.versions.map((v) => (
                  <li key={v.revision}>
                    #{v.revision} · {v.amount === null ? "apagado" : formatMoney(v.amount)} · {v.origin === "import" ? "importação" : "lançamento"} · {formatDateTime(v.recorded_at)} · {v.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {canEdit && !c.closed ? (
            <form className="grid gap-3 border-t pt-3" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
              <FormField label={account.flow_kinds.length ? "Ajuste lançado (R$, soma ao fluxo a partir do corte)" : "Valor lançado (R$)"}>
                <MoneyInput ref={input} negative aria-label="Valor lançado (R$)" placeholder={c.estimate ? `estimativa ${c.estimate.replace(".", ",")}` : "0,00"} value={current} onValueChange={setAmount} />
              </FormField>
              <FormField label="Motivo">
                <Input aria-label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
              {error ? <p role="alert" className="text-destructive-text">{error}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                {c.entered !== null ? <Button type="button" variant="ghost" onClick={() => submit(true)}>Apagar lançamento</Button> : null}
                <Button type="submit" disabled={save.isPending}>Salvar</Button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </ModalForm>
  );
}

const ACTION: Record<string, string> = { apply: "grava", unchanged: "igual", skip_closed: "mês fechado", skip_flow: "vem do fluxo", ignored: "—" };
const STATUS: Record<string, string> = { ok: "reconhecida", unmatched: "conta não encontrada", ambiguous: "nome repetido no plano", duplicate: "conta repetida", invalid_number: "valor inválido" };

function ImportDialog({ defaultYear, onClose, onDone }: { defaultYear: string; onClose: () => void; onDone: (written: number) => void }) {
  const [year, setYear] = useState(defaultYear);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<DreImportPlan | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const preview = useMutation({
    mutationFn: (m: Record<string, number>) => dreMonthlyApi.preview(year, file!, m),
    onSuccess: (p) => { setPlan(p); setError(""); },
    onError: (e) => setError((e as Error).message),
  });
  const confirm = useMutation({
    mutationFn: () => dreMonthlyApi.confirm(year, file!, plan!.mapping, plan!.checksum, reason.trim()),
    onSuccess: (r) => onDone(r.written),
    onError: (e) => setError((e as Error).message),
  });
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Importar planilha da DRE">
      <div className="grid gap-3 text-sm">
        <p className="text-muted-foreground">Coluna A = conta (código ou nome do plano); colunas B a M = janeiro a dezembro. Os valores do ano substituem os lançados de cada conta da planilha. Meses fechados e contas alimentadas pelo fluxo a partir do corte não são alterados.</p>
        <div className="flex flex-wrap items-end gap-2">
          <FormField label="Ano">
            <Input aria-label="Ano da importação" className="w-24" value={year} onChange={(e) => { setYear(e.target.value); setPlan(null); }} />
          </FormField>
          <FormField label="Planilha (.xlsx ou .csv)">
            <Input aria-label="Planilha" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPlan(null); }} />
          </FormField>
          <Button type="button" variant="secondary" disabled={!file || !/^\d{4}$/.test(year) || preview.isPending} onClick={() => preview.mutate(mapping)}>Pré-visualizar</Button>
        </div>
        {plan ? (
          <>
            <p role="status">{plan.totals.apply} valor(es) serão gravados · {plan.totals.skipped_closed} em mês fechado · {plan.totals.skipped_flow} vêm do fluxo · {plan.totals.unmatched} linha(s) sem conta.</p>
            <div className="max-h-72 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/50"><th className="p-1 text-left">Linha</th><th className="p-1 text-left">Conta</th><th className="p-1 text-left">Meses</th></tr></thead>
                <tbody>
                  {plan.rows.map((r) => (
                    <tr key={r.line} className="border-t align-top">
                      <td className="p-1">{r.line}. {r.label}</td>
                      <td className="p-1">
                        {r.status === "ok" ? r.account_label : (
                          <select aria-label={`Conta para ${r.label}`} className="h-8 rounded border bg-background px-1" value={mapping[r.label] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [r.label]: Number(e.target.value) }))}>
                            <option value="">{STATUS[r.status] ?? r.status} — escolher conta</option>
                            {plan.accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="p-1">
                        {r.months.filter((m) => m.action !== "unchanged" && m.action !== "ignored").map((m) => `${monthLabel(m.month)}: ${m.amount === null ? "?" : formatMoney(m.amount)} (${ACTION[m.action]})`).join(" · ") || "sem mudanças"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Object.keys(mapping).length && JSON.stringify(mapping) !== JSON.stringify(plan.mapping) ? (
              <Button type="button" variant="secondary" onClick={() => preview.mutate(mapping)}>Pré-visualizar com as contas escolhidas</Button>
            ) : null}
            <FormField label="Motivo da importação">
              <Input aria-label="Motivo da importação" value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
          </>
        ) : null}
        {error ? <p role="alert" className="text-destructive-text">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!plan || plan.totals.apply === 0 || reason.trim().length < 5 || confirm.isPending || JSON.stringify(mapping) !== JSON.stringify(plan.mapping) && Object.keys(mapping).length > 0} onClick={() => confirm.mutate()}>
            Confirmar importação
          </Button>
        </div>
      </div>
    </ModalForm>
  );
}

function ConfigDialog({ data, onClose, onSaved }: { data: Configured; onClose: () => void; onSaved: () => void }) {
  const cfg = data.config;
  const [rules, setRules] = useState<Record<string, number | null>>(() => Object.fromEntries(Object.keys(cfg.rule_labels).map((k) => [k, cfg.rules[k] ?? null])));
  const [post, setPost] = useState<number[]>(cfg.layout.data.post_operational);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      await dreMonthlyApi.saveRules(rules, reason.trim());
      await dreMonthlyApi.saveLayout(cfg.layout.revision, { ...cfg.layout.data, post_operational: post }, reason.trim());
    },
    onSuccess: onSaved,
    onError: (e) => setError((e as Error).message),
  });
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Configurar a DRE mensal">
      <form className="grid gap-4 text-sm" onSubmit={(e) => { e.preventDefault(); if (reason.trim().length < 5) setError("Informe o motivo."); else save.mutate(); }}>
        <fieldset className="grid gap-2">
          <legend className="font-semibold">Conta de cada valor automático (a partir do corte) e de cada papel na projeção</legend>
          {Object.entries(cfg.rule_labels).map(([k, label]) => (
            <label key={k} className="grid gap-1 sm:grid-cols-[1fr_16rem] sm:items-center">
              <span>{label}</span>
              <select aria-label={label} className="h-9 rounded border bg-background px-2" value={rules[k] ?? ""} onChange={(e) => setRules((r) => ({ ...r, [k]: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Sem conta</option>
                {cfg.accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
          ))}
        </fieldset>
        <fieldset className="grid gap-1">
          <legend className="font-semibold">Contas pós-operacionais (abaixo do resultado operacional)</legend>
          {cfg.accounts.map((a) => (
            <label key={a.id} className="flex items-center gap-2">
              <input type="checkbox" checked={post.includes(a.id)} onChange={() => setPost((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))} />
              {a.label}
            </label>
          ))}
        </fieldset>
        <FormField label="Motivo">
          <Input aria-label="Motivo da configuração" value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        {error ? <p role="alert" className="text-destructive-text">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending}>Salvar</Button>
        </div>
      </form>
    </ModalForm>
  );
}

const MODEL_ACTION: Record<string, string> = { create: "criar", exists: "já existe", conflict: "não usada", map: "associar", kept: "mantida", skip: "sem conta", mark: "marcar pós-operacional" };

/** Modelo padrão de DRE: pré-visualização e aplicação explícita (completa, nunca sobrescreve). */
function ModelDialog({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const plan = useQuery({ queryKey: ["dre-monthly", "model"], queryFn: () => dreClosingApi.modelPreview() });
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const apply = useMutation({
    mutationFn: () => dreClosingApi.modelApply(reason.trim()),
    onSuccess: (r) => onDone(`Modelo padrão aplicado: ${r.created} conta(s) criada(s), ${r.mapped} associação(ões), ${r.post_operational_marked} conta(s) pós-operacional(is)${r.conflicts ? `; ${r.conflicts} conta(s) do modelo não usadas por conflito` : ""}.`),
    onError: (e) => setError((e as Error).message),
  });
  const p = plan.data;
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Aplicar modelo padrão de DRE">
      {plan.isLoading || !p ? (
        <LoadingState />
      ) : (
        <div className="grid gap-3 text-sm">
          <p className="text-muted-foreground">
            O modelo ({p.version}) só completa o que falta: contas com o mesmo código, associações já feitas e contas pós-operacionais
            já marcadas ficam como estão. Tudo pode ser ajustado depois.
          </p>
          <p role="status" className="font-semibold">
            {p.totals.create} conta(s) a criar · {p.totals.exists} já existente(s) · {p.totals.map} associação(ões) a fazer
            {p.totals.conflict ? ` · ${p.totals.conflict} conflito(s)` : ""}
          </p>
          <div className="max-h-64 overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead><tr className="bg-muted/50"><th className="p-1 text-left">Conta</th><th className="p-1 text-left">Ação</th></tr></thead>
              <tbody>
                {p.accounts.map((a) => (
                  <tr key={a.code} className={`border-t ${a.synthetic ? "font-semibold" : ""}`}>
                    <td className="p-1">{a.code} {a.name}</td>
                    <td className={`p-1 ${a.action === "conflict" ? "text-warning-text" : ""}`}>{MODEL_ACTION[a.action]}{a.note ? ` — ${a.note}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary className="cursor-pointer">Associações ({p.rules.filter((r) => r.action === "map").length} a fazer)</summary>
            <ul className="mt-1 grid gap-0.5 text-xs">
              {p.rules.map((r) => <li key={r.kind}>{r.kind} → {r.code}: {MODEL_ACTION[r.action]}</li>)}
            </ul>
          </details>
          <FormField label="Motivo">
            <Input aria-label="Motivo da aplicação do modelo" value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          {error ? <p role="alert" className="text-destructive-text">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="button" disabled={reason.trim().length < 5 || apply.isPending || (p.totals.create === 0 && p.totals.map === 0)} onClick={() => apply.mutate()}>
              Aplicar modelo
            </Button>
          </div>
        </div>
      )}
    </ModalForm>
  );
}

/** Classificações de recebível/despesa/diária a partir do corte: substituídas pela DRE automática. */
function ReviewPanel({ onDone }: { onDone: (message: string) => void }) {
  const cache = useQueryClient();
  const list = useQuery({ queryKey: ["dre-monthly", "review"], queryFn: () => dreClosingApi.review() });
  const [target, setTarget] = useState<{ id: number; revision: number; description: string } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const voidIt = useMutation({
    mutationFn: () => dreClosingApi.voidReviewed(target!.id, target!.revision, reason.trim()),
    onSuccess: () => {
      onDone(`Classificação "${target!.description}" anulada.`);
      setTarget(null);
      void cache.invalidateQueries({ queryKey: ["dre-monthly", "review"] });
    },
    onError: (e) => setError((e as Error).message),
  });
  if (!list.data?.length) return null;
  return (
    <section aria-label="Classificações a revisar" className="rounded-lg border border-warning/50 p-3 text-sm">
      <p className="font-semibold">Classificações a revisar ({list.data.length})</p>
      <p className="text-muted-foreground">Estas origens já entram na DRE pelo fluxo a partir do corte; a classificação manual é ignorada. Anule para limpar.</p>
      <ul className="mt-2 grid gap-1">
        {list.data.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>#{e.id} · {e.description} · {e.months.map(monthLabel).join(", ")} · {formatMoney(e.amount)}</span>
            <Button type="button" variant="ghost" onClick={() => { setTarget(e); setReason(""); setError(""); }}>Anular</Button>
          </li>
        ))}
      </ul>
      {target ? (
        <ModalForm open onOpenChange={(o) => !o && setTarget(null)} title={`Anular classificação #${target.id}`}>
          <form className="grid gap-3 text-sm" onSubmit={(e) => { e.preventDefault(); if (reason.trim().length < 5) setError("Informe o motivo."); else voidIt.mutate(); }}>
            <p>{target.description}</p>
            <FormField label="Motivo">
              <Input aria-label="Motivo da anulação" value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
            {error ? <p role="alert" className="text-destructive-text">{error}</p> : null}
            <Button type="submit" disabled={voidIt.isPending}>Anular classificação</Button>
          </form>
        </ModalForm>
      ) : null}
    </section>
  );
}
