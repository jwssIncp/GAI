import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  CreditCard,
  Download,
  FileArchive,
  FileUp,
  Lock,
  LockOpen,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Kpi, KpiGrid } from "@/components/base/Cards";
import { DataPanel } from "@/components/base/DataPanel";
import { FilterPanel } from "@/components/base/FilterPanel";
import type { FinanceStatus } from "@/components/base/financeStatus";
import { SectionTitle } from "@/components/base/SectionTitle";
import { SearchInput } from "@/components/base/SearchInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, DrawerForm } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-context";
import { usePermissions } from "@/features/auth/usePermissions";
import { useDebouncedValue } from "@/features/field-agents/useDebouncedValue";
import { ExpenseAttachmentsPanel } from "@/features/finance/ExpenseAttachmentsPanel";
import { formatDate, formatMoney } from "@/utils/format";
import type { Expense } from "@/types/api";
import { ExpenseFormDialog } from "./ExpenseFormDialog";
import { AccountDialog, AdvancesDialog, BatchesPanel, ImportDialog, ReasonDialog, ZipDialog } from "./ExpenseDialogs";
import {
  EXPENSE_STATUS_LABEL,
  EXPENSE_TYPE_LABEL,
  civilBr,
  expensesApi,
  expensesKeys,
  pctBr,
  saveBlob,
  type BatchResult,
  type ExpenseBoardFilters,
  type ExpenseBoardItem,
  type ExpenseStatus,
  type ExpenseType,
} from "./expensesApi";

const PAGE_SIZES = [25, 50, 100, 200] as const;
const select = "h-10 max-w-[14rem] rounded-md border bg-background px-3 text-sm";

type Dialog =
  | { kind: "form"; item: ExpenseBoardItem | null }
  | { kind: "attachments"; item: ExpenseBoardItem }
  | { kind: "advances"; agentId: number }
  | { kind: "account"; ids: number[] }
  | { kind: "type"; ids: number[]; type: ExpenseType }
  | { kind: "delete"; ids: number[] }
  | { kind: "action"; item: ExpenseBoardItem; action: "approve" | "mark-as-paid" | "cancel" }
  | { kind: "reject"; item: ExpenseBoardItem }
  | { kind: "reopen"; item: ExpenseBoardItem }
  | { kind: "close" }
  | { kind: "reopen-finance" }
  | { kind: "import" }
  | { kind: "zip" }
  | null;

/** Situação da despesa → tom do mapa financeiro (o texto continua o da tela: "Paga", "Aprovada"…). */
const EXPENSE_FINANCE_STATUS: Record<ExpenseStatus, FinanceStatus> = {
  pending: "pending",
  approved: "approved",
  paid: "paid",
  rejected: "cancelled",
  cancelled: "cancelled",
};

function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Button type="button" variant="ghost" className="size-8" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

/** Projeto › Despesas: acompanhamento do projeto (doc 06 §3.2, etapa 4). Inclui o cabeçalho com as ações. */
export function ProjectExpensesPage({ projectId, description }: { projectId: number; description?: string }) {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const cache = useQueryClient();
  const [filters, setFilters] = useState<ExpenseBoardFilters>({});
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search);
  const query_ = { ...filters, search: term || undefined };
  const query = useQuery({ queryKey: expensesKeys.board(projectId, query_), queryFn: () => expensesApi.board(projectId, query_) });
  const [selected, setSelected] = useState<number[]>([]);
  // Painéis recolhíveis (botão Ocultar da faixa azul).
  const [summaryHidden, setSummaryHidden] = useState(false);
  const [listHidden, setListHidden] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pageSize, setPageSize] = useState<number | "all">(25);
  const [allAgents, setAllAgents] = useState(false);
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean } | null>(null);
  const data = query.data;
  const closed = Boolean(data?.closure);

  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: expensesKeys.all });
    await cache.invalidateQueries({ queryKey: ["remuneration"] });
  };
  const finish = async (message: string, error = false) => {
    setDialog(null);
    setSelected([]);
    // sucesso: aviso temporário (toast); falha ou resultado parcial: fica na tela
    if (error) setFeedback({ message, error });
    else {
      setFeedback(null);
      toast({ title: message, tone: "success" });
    }
    await refresh();
  };
  // Resultado parcial decidido pela contagem de falhas, não pelo texto montado.
  const batchMessage = (r: BatchResult, verb: string): { message: string; partial: boolean } => {
    const failures = r.results.filter((x) => !x.ok).map((x) => {
      const item = data?.items.find((i) => i.id === x.id);
      return `${item?.sequence ?? `#${x.id}`}: ${x.message}`;
    });
    return {
      message: `${r.done} despesa(s) ${verb}.${failures.length ? ` Não concluídas: ${failures.join("; ")}.` : ""}`,
      partial: failures.length > 0,
    };
  };
  const mutate = useMutation({
    mutationFn: async (run: () => Promise<string | { message: string; partial: boolean }>) => run(),
    onSuccess: (result) => void (typeof result === "string" ? finish(result) : finish(result.message, result.partial)),
    onError: (e) => setFeedback({ message: (e as Error).message, error: true }),
  });

  const setFilter = <K extends keyof ExpenseBoardFilters>(key: K, value: ExpenseBoardFilters[K] | "") => {
    setSelected([]);
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value === "" ? undefined : value }));
  };

  const items = useMemo(() => data?.items ?? [], [data]);
  const visible = pageSize === "all" ? items : items.slice((page - 1) * pageSize, page * pageSize);
  const pages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(items.length / pageSize));
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const chosen = selected.map((id) => byId.get(id)).filter((i): i is ExpenseBoardItem => Boolean(i));

  async function exportList(format: "xlsx" | "csv") {
    try {
      saveBlob(await expensesApi.exportFile(projectId, query_, format), `despesas-${data?.project.name ?? projectId}.${format}`);
    } catch (e) {
      setFeedback({ message: (e as Error).message, error: true });
    }
  }

  // Padrão do sistema anterior: título com linha fina; a explicação fica no "?".
  const header = (action?: React.ReactNode) => <SectionTitle as="h1" title="Despesas" help={description} actions={action} />;
  if (query.isLoading) return <>{header()}<LoadingState label="Carregando despesas" /></>;
  if (query.isError) return <>{header()}<ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /></>;
  if (!data) return header();
  const k = data.kpis;
  const canEdit = !closed;

  return (
    <>
    {header(
      <>
        {!closed && hasPermission("project-finance:close") ? (
          <Button type="button" variant="ghost" onClick={() => setDialog({ kind: "close" })}><Lock size={16} /> Concluir financeiro</Button>
        ) : null}
        {hasPermission("expenses:import") && hasPermission("expenses:create") && canEdit ? <Button type="button" variant="secondary" onClick={() => setDialog({ kind: "import" })}><FileUp size={16} /> Importar</Button> : null}
        <Button type="button" variant="secondary" onClick={() => void exportList("xlsx")}><Download size={16} /> Excel</Button>
        <Button type="button" variant="secondary" onClick={() => void exportList("csv")}><Download size={16} /> CSV</Button>
        {hasPermission("expenses:export-zip") && hasPermission("expenses:download-attachment") ? (
          <Button type="button" variant="secondary" onClick={() => setDialog({ kind: "zip" })}><FileArchive size={16} /> ZIP</Button>
        ) : null}
        {hasPermission("expenses:create") && canEdit ? <Button type="button" onClick={() => setDialog({ kind: "form", item: null })}><Plus size={16} /> Nova despesa</Button> : null}
      </>,
    )}
    <div className="grid gap-4">
      {data.closure ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <span>
            <Lock size={15} className="mr-1 inline" />
            Financeiro concluído em {formatDate(data.closure.closed_at)}
            {data.closure.closed_by ? ` por ${data.closure.closed_by}` : ""}: {data.closure.reason}. Despesas, adiantamentos e lotes ficam bloqueados.
          </span>
          {hasPermission("project-finance:reopen") ? (
            <Button type="button" variant="secondary" onClick={() => setDialog({ kind: "reopen-finance" })}><LockOpen size={15} /> Reabrir financeiro</Button>
          ) : null}
        </div>
      ) : null}

      {!data.parameters.configured ? (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
          Sem parâmetros financeiros vigentes: a lista de motivos e os limites de anexo não se aplicam.{" "}
          <Link className="font-semibold underline" to="/app/finance/parameters">Publicar parâmetros</Link>
        </p>
      ) : null}
      <section aria-label="Indicadores das despesas">
        <KpiGrid>
        <Kpi group="year" tinted label="Total de despesas" value={formatMoney(k.total)} hint={`${k.count} lançamento(s), sem rejeitadas e canceladas`} />
        <Kpi group="year" label="Reembolsável" value={formatMoney(k.reimbursable)} hint={`${pctBr(k.reimbursable_pct)} do total`} />
        <Kpi group="year" label="Não reembolsável" value={formatMoney(k.non_reimbursable)} hint={`${pctBr(k.non_reimbursable_pct)} do total`} />
        <Kpi label="A reembolsar" value={formatMoney(k.to_reimburse)} hint="Reembolsáveis fora de lote faturado" tone={Number(k.to_reimburse) > 0 ? "warning" : "default"} />
        </KpiGrid>
      </section>
      {k.unclassified_count ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
          {k.unclassified_count} despesa(s) antiga(s) sem tipo ({formatMoney(k.unclassified)}): não entram em reembolsáveis nem em não reembolsáveis.{" "}
          <button type="button" className="font-semibold underline" onClick={() => setFilter("expense_type", "unclassified")}>Ver e classificar</button>
        </p>
      ) : null}


      <FilterPanel>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar motivo, inventariante, data ou código" />
        <select aria-label="Filtrar por tipo de despesa" title="Tipo de despesa" className={select} value={filters.expense_type ?? ""} onChange={(e) => setFilter("expense_type", e.target.value as ExpenseBoardFilters["expense_type"])}>
          <option value="">Tipo: todos</option>
          <option value="reimbursable">Reembolsável</option>
          <option value="non_reimbursable">Não reembolsável</option>
          <option value="unclassified">Sem tipo (antigas)</option>
        </select>
        <select aria-label="Filtrar por prestação de contas" title="Prestação de contas: incluída em lote já faturado ao cliente" className={select} value={filters.billing ?? ""} onChange={(e) => setFilter("billing", e.target.value as ExpenseBoardFilters["billing"])}>
          <option value="">Prestação: todas</option>
          <option value="billed">Prestada (lote faturado)</option>
          <option value="pending">Não prestada</option>
        </select>
        <select aria-label="Filtrar por situação" className={select} value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value as ExpenseStatus)}>
          <option value="">Situação: todas</option>
          {(Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]).map((s) => <option key={s} value={s}>{EXPENSE_STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="Filtrar por inventariante" className={select} value={filters.field_agent_id ?? ""} onChange={(e) => setFilter("field_agent_id", e.target.value)}>
          <option value="">Inventariante: todos</option>
          <option value="none">Despesas gerais (vazio)</option>
          {data.summary.filter((s) => s.field_agent_id !== null).map((s) => <option key={s.field_agent_id} value={s.field_agent_id!}>{s.name}</option>)}
        </select>
        <input type="date" aria-label="Data inicial" title="Data inicial" className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.start_date ?? ""} onChange={(e) => setFilter("start_date", e.target.value)} />
        <input type="date" aria-label="Data final" title="Data final" className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.end_date ?? ""} onChange={(e) => setFilter("end_date", e.target.value)} />
        <Button type="button" variant="ghost" onClick={() => { setFilters({}); setSearch(""); setSelected([]); }}>Limpar</Button>
      </FilterPanel>

      {feedback ? (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive-text">{feedback.message}</p>
      ) : null}

      <DataPanel
        title="Resumo por inventariante"
        titleId="expenses-summary-title"
        contentId="expenses-summary"
        hidden={summaryHidden}
        onToggle={() => setSummaryHidden(!summaryHidden)}
      >
        <div className="border-b border-border px-5 py-2.5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allAgents} onChange={(e) => setAllAgents(e.target.checked)} />
            Mostrar todos os vinculados
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full min-w-[620px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr><th className="text-left">Inventariante</th><th className="text-left">Lançamentos</th><th className="text-left">Adiantamentos</th><th className="text-left">Despesas</th><th className="text-left" title="Adiantamentos − despesas">Saldo</th></tr>
            </thead>
            <tbody>
              {data.summary.filter((s) => allAgents || s.entries > 0 || Number(s.advances) > 0).map((s) => (
                <tr key={s.field_agent_id ?? "geral"} className="border-t">
                  <td className="py-2">
                    <button type="button" className="text-primary-text hover:underline" onClick={() => setFilter("field_agent_id", s.field_agent_id === null ? "none" : String(s.field_agent_id))}>{s.name}</button>
                  </td>
                  <td className="py-2 tabular-nums">{s.entries}</td>
                  <td className="numeric py-2">
                    {formatMoney(s.advances)}
                    {s.field_agent_id !== null && hasPermission("expense-advances:read") ? (
                      <Button type="button" variant="secondary" size="sm" className="ml-2 h-7 shrink-0 px-2 text-xs" onClick={() => setDialog({ kind: "advances", agentId: s.field_agent_id! })} aria-label={`Gerenciar adiantamentos de ${s.name}`} title="Gerenciar adiantamentos">
                        Gerenciar
                      </Button>
                    ) : null}
                  </td>
                  <td className="numeric py-2">{formatMoney(s.expenses)}</td>
                  <td className={`numeric py-2 font-semibold ${s.balance === null ? "text-muted-foreground" : s.balance.startsWith("-") ? "text-destructive" : "text-success"}`} title={s.balance === null ? "Despesas gerais não recebem adiantamento" : undefined}>{s.balance === null ? "—" : formatMoney(s.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataPanel>

      {hasPermission("reimbursement-batches:read") ? (
        <BatchesPanel projectId={projectId} onChanged={() => void refresh()} onFilter={(id) => setFilter("batch_id", id)} />
      ) : null}
      {filters.batch_id ? (
        <p className="text-sm">Filtrando o lote selecionado. <button type="button" className="underline" onClick={() => setFilter("batch_id", "")}>Ver todas</button></p>
      ) : null}

      <DataPanel
        title="Lançamentos"
        titleId="expenses-items-title"
        contentId="expenses-items"
        count={`${items.length} despesa${items.length === 1 ? "" : "s"}`}
        hidden={listHidden}
        onToggle={() => setListHidden(!listHidden)}
      >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3 empty:hidden">
        {hasPermission("reimbursement-batches:create") && canEdit ? (
          <Button type="button" disabled={!chosen.length} onClick={() => setDialog({ kind: "account", ids: selected })}>Incluir em lote de reembolso ({chosen.length})</Button>
        ) : null}
        {hasPermission("expenses:update") && canEdit ? (
          <>
            <Button type="button" variant="secondary" disabled={!chosen.length} onClick={() => setDialog({ kind: "type", ids: selected, type: "reimbursable" })}>Marcar reembolsável</Button>
            <Button type="button" variant="secondary" disabled={!chosen.length} onClick={() => setDialog({ kind: "type", ids: selected, type: "non_reimbursable" })}>Marcar não reembolsável</Button>
          </>
        ) : null}
        {hasPermission("expenses:delete") && canEdit ? (
          <Button type="button" variant="danger" disabled={!chosen.length} onClick={() => setDialog({ kind: "delete", ids: selected })}>Excluir ({chosen.length})</Button>
        ) : null}
      </div>

      <div>
        <div className="max-h-[620px] overflow-auto" role="region" aria-label="Lançamentos de despesas" tabIndex={0}>
          <table className="data-table w-full min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="border-b px-2 py-3">
                  <input type="checkbox" aria-label="Selecionar todas as exibidas" checked={visible.length > 0 && visible.every((i) => selected.includes(i.id))}
                    onChange={(e) => setSelected(e.target.checked ? [...new Set([...selected, ...visible.map((i) => i.id)])] : selected.filter((id) => !visible.some((i) => i.id === id)))} />
                </th>
                {[["Cód", "Código sequencial da despesa no projeto"], ["Tipo de despesa", "Reembolsável ou não (vale o da despesa)"], ["Prestação", "Lote de reembolso ao cliente"], ["Data", ""], ["Inventariante", ""], ["Motivo", ""], ["Forma", "Forma de pagamento"], ["Anexo", ""], ["Valor", ""], ["Situação", ""], ["", ""]].map(([h, t], i) => (
                  <th key={`${h}-${i}`} scope="col" title={t || undefined} className="whitespace-nowrap border-b px-2 py-3 font-semibold">{h || <span className="sr-only">Ações</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.id} className={i.status === "rejected" || i.status === "cancelled" ? "text-muted-foreground" : "hover:bg-primary/[0.05]"}>
                  <td className="border-b px-2 py-2">
                    <input type="checkbox" aria-label={`Selecionar despesa ${i.sequence ?? i.id}`} checked={selected.includes(i.id)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))} />
                  </td>
                  <td className="border-b px-2 py-2 tabular-nums">{i.sequence ?? "—"}</td>
                  <td className="whitespace-nowrap border-b px-2 py-2">
                    {hasPermission("expenses:update") && canEdit && !(i.batch && ["billed", "received"].includes(i.batch.status)) ? (
                      <button type="button" className={`rounded px-2 py-0.5 text-xs font-semibold ${i.expense_type === "reimbursable" ? "bg-primary/15" : i.expense_type ? "bg-muted" : "bg-warning/20"}`}
                        title="Alternar o tipo (pede confirmação)" aria-label={`Alternar tipo da despesa ${i.sequence ?? i.id}: ${i.expense_type_label}`}
                        onClick={() => setDialog({ kind: "type", ids: [i.id], type: i.expense_type === "reimbursable" ? "non_reimbursable" : "reimbursable" })}>
                        {i.expense_type_label}
                      </button>
                    ) : <span className="text-xs">{i.expense_type_label}</span>}
                  </td>
                  <td className="whitespace-nowrap border-b px-2 py-2 text-xs">
                    {i.batch ? (
                      <span title={["billed", "received"].includes(i.batch.status) ? "Lote faturado ao cliente" : "Lote aberto (ainda conta em A reembolsar)"}>
                        Lote {i.batch.number} · {civilBr(i.batch.batch_date)}{["billed", "received"].includes(i.batch.status) ? " ✓" : ""}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="whitespace-nowrap border-b px-2 py-2">{civilBr(i.expense_date)}</td>
                  <td className="max-w-[10rem] truncate border-b px-2 py-2" title={i.field_agent_name}>{i.field_agent_name}</td>
                  <td className="max-w-[14rem] border-b px-2 py-2">
                    <span className="font-medium">{i.reason_code ?? i.legacy_reason ?? "—"}</span>
                    {i.description && i.description !== i.reason_code ? <span className="block truncate text-xs text-muted-foreground" title={i.description}>{i.description}</span> : null}
                    {i.rejection_reason ? <span className="block text-xs text-destructive" title="Motivo da rejeição">Rejeitada: {i.rejection_reason}</span> : null}
                  </td>
                  <td className="whitespace-nowrap border-b px-2 py-2 text-xs">
                    {i.payment_method_label}
                    {i.installments.length ? ` (${i.installments.length}x)` : ""}
                    {i.invoiced_payment_date ? ` ${civilBr(i.invoiced_payment_date)}` : ""}
                  </td>
                  <td className="border-b px-2 py-2">
                    <Button type="button" variant="ghost" className="h-8 px-2" aria-label={`Comprovantes da despesa ${i.sequence ?? i.id}`} title="Comprovantes" onClick={() => setDialog({ kind: "attachments", item: i })}>
                      <Paperclip size={15} /> {i.attachments}
                    </Button>
                  </td>
                  <td className="numeric border-b px-2 py-2 font-semibold">
                    {formatMoney(i.amount)}
                    {i.balance !== null ? <span className={`block text-xs font-normal ${i.balance.startsWith("-") ? "text-destructive" : "text-muted-foreground"}`} title="Depositado − valor">saldo {formatMoney(i.balance)}</span> : null}
                  </td>
                  <td className="whitespace-nowrap border-b px-2 py-2"><StatusBadge finance={EXPENSE_FINANCE_STATUS[i.status]} label={EXPENSE_STATUS_LABEL[i.status]} /></td>
                  <td className="whitespace-nowrap border-b px-2 py-2">
                    {canEdit && i.status === "pending" && hasPermission("expenses:update") ? <IconButton label={`Editar despesa ${i.sequence ?? i.id}`} onClick={() => setDialog({ kind: "form", item: i })}><Pencil size={15} /></IconButton> : null}
                    {i.status === "pending" && hasPermission("expenses:approve") ? <IconButton label={`Aprovar despesa ${i.sequence ?? i.id}`} onClick={() => setDialog({ kind: "action", item: i, action: "approve" })}><CheckCircle2 size={15} /></IconButton> : null}
                    {i.status === "pending" && hasPermission("expenses:reject") ? <IconButton label={`Rejeitar despesa ${i.sequence ?? i.id}`} onClick={() => setDialog({ kind: "reject", item: i })}><XCircle size={15} /></IconButton> : null}
                    {i.status === "approved" && hasPermission("expenses:mark-as-paid") ? <IconButton label={`Registrar pagamento da despesa ${i.sequence ?? i.id}`} onClick={() => setDialog({ kind: "action", item: i, action: "mark-as-paid" })}><CreditCard size={15} /></IconButton> : null}
                    {canEdit && i.status === "approved" && hasPermission("expenses:reopen") ? <IconButton label={`Reabrir despesa ${i.sequence ?? i.id} para edição`} onClick={() => setDialog({ kind: "reopen", item: i })}><RotateCcw size={15} /></IconButton> : null}
                  </td>
                </tr>
              ))}
              {!visible.length ? <tr><td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">Nenhuma despesa com estes filtros.</td></tr> : null}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={9} className="px-3 py-3">
                  Total filtrado ({data.totals.count}, sem rejeitadas e canceladas) · Sem reembolso do cliente: {formatMoney(data.totals.non_reimbursable_amount)}
                </td>
                <td className="numeric px-2 py-3">{formatMoney(data.totals.amount)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
        <label className="flex items-center gap-2">
          Por página
          <select aria-label="Despesas por página" className="h-9 rounded-md border bg-background px-2" value={pageSize} onChange={(e) => { setPageSize(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(1); }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value="all">Todos</option>
          </select>
        </label>
        {pageSize !== "all" && pages > 1 ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span>Página {page} de {pages}</span>
            <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        ) : null}
      </div>
      </DataPanel>

      {dialog?.kind === "form" ? (
        <ExpenseFormDialog projectId={projectId} board={data} initial={dialog.item} onClose={() => setDialog(null)} onSaved={(warning) => void finish(warning ?? (dialog.item ? "Despesa atualizada." : "Despesa lançada."), Boolean(warning))} />
      ) : null}
      <DrawerForm open={dialog?.kind === "attachments"} onOpenChange={(o) => { if (!o) { setDialog(null); void refresh(); } }} title="Comprovantes da despesa">
        {dialog?.kind === "attachments" ? (
          <ExpenseAttachmentsPanel
            projectId={projectId}
            expense={{ id: dialog.item.id } as Expense}
            maxBytes={data.parameters.attachment_max_bytes ?? undefined}
            maxFiles={data.parameters.attachment_max_files ?? undefined}
          />
        ) : null}
      </DrawerForm>
      {dialog?.kind === "advances" ? (
        <AdvancesDialog projectId={projectId} board={data} agentId={dialog.agentId} onClose={() => setDialog(null)} onChanged={() => void refresh()} />
      ) : null}
      {dialog?.kind === "account" ? (
        <AccountDialog projectId={projectId} board={data} ids={dialog.ids} onClose={() => setDialog(null)} onDone={(m, e) => void finish(m, e)} />
      ) : null}
      {dialog?.kind === "import" ? <ImportDialog projectId={projectId} onClose={() => setDialog(null)} onDone={(m, e) => void finish(m, e)} /> : null}
      {dialog?.kind === "zip" ? <ZipDialog projectId={projectId} projectName={data.project.name} onClose={() => setDialog(null)} /> : null}
      <ConfirmDialog
        open={dialog?.kind === "type"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Alterar tipo de despesa"
        description={dialog?.kind === "type" ? `Marcar ${dialog.ids.length} despesa(s) como ${EXPENSE_TYPE_LABEL[dialog.type].toLowerCase()}? Isso muda "A reembolsar"; despesas em lote faturado não mudam.` : ""}
        variant="primary"
        confirmLabel="Alterar tipo"
        busy={mutate.isPending}
        onConfirm={() => dialog?.kind === "type" && mutate.mutate(async () => batchMessage(await expensesApi.changeType(projectId, dialog.ids, dialog.type), "com o tipo alterado"))}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Excluir despesas"
        description={dialog?.kind === "delete" ? `Excluir ${dialog.ids.length} despesa(s)? Pagas, em lote faturado ou em competência fechada da DRE não são excluídas.` : ""}
        confirmLabel="Excluir"
        busy={mutate.isPending}
        onConfirm={() => dialog?.kind === "delete" && mutate.mutate(async () => batchMessage(await expensesApi.remove(projectId, dialog.ids), "excluída(s)"))}
      />
      <ConfirmDialog
        open={dialog?.kind === "action"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.kind === "action" ? { approve: "Aprovar despesa", "mark-as-paid": "Registrar pagamento", cancel: "Cancelar despesa" }[dialog.action] : ""}
        description={dialog?.kind === "action" ? `Despesa ${dialog.item.sequence ?? dialog.item.id} · ${dialog.item.field_agent_name} · ${formatMoney(dialog.item.amount)}. Confirmar?` : ""}
        variant={dialog?.kind === "action" && dialog.action === "cancel" ? "danger" : "primary"}
        confirmLabel={dialog?.kind === "action" ? { approve: "Aprovar", "mark-as-paid": "Pagar", cancel: "Cancelar despesa" }[dialog.action] : "Confirmar"}
        busy={mutate.isPending}
        onConfirm={() => dialog?.kind === "action" && mutate.mutate(async () => { await expensesApi.action(projectId, dialog.item.id, dialog.action); return "Despesa atualizada."; })}
      />
      {dialog?.kind === "reject" ? (
        <ReasonDialog title="Rejeitar despesa" label="Motivo da rejeição" description="O motivo da rejeição fica registrado à parte; o motivo original da despesa é mantido." confirm="Rejeitar" danger busy={mutate.isPending} error={mutate.isError ? (mutate.error as Error).message : null}
          onClose={() => setDialog(null)} onConfirm={(reason) => mutate.mutate(async () => { await expensesApi.reject(projectId, dialog.item.id, reason); return "Despesa rejeitada."; })} />
      ) : null}
      {dialog?.kind === "reopen" ? (
        <ReasonDialog title="Reabrir para edição" description="A despesa volta a pendente de aprovação. Bloqueado em lote faturado e em competência fechada da DRE." confirm="Reabrir" busy={mutate.isPending} error={mutate.isError ? (mutate.error as Error).message : null}
          onClose={() => setDialog(null)} onConfirm={(reason) => mutate.mutate(async () => { await expensesApi.reopen(projectId, dialog.item.id, reason); return "Despesa reaberta para edição."; })} />
      ) : null}
      {dialog?.kind === "close" ? (
        <ReasonDialog title="Concluir financeiro do projeto" description="Bloqueia novas despesas, edições, adiantamentos e lotes até ser reaberto. Não muda o status do projeto nem depende de lote." confirm="Concluir" busy={mutate.isPending} error={mutate.isError ? (mutate.error as Error).message : null}
          onClose={() => setDialog(null)} onConfirm={(reason) => mutate.mutate(async () => { await expensesApi.closeFinance(projectId, reason); return "Financeiro do projeto concluído."; })} />
      ) : null}
      {dialog?.kind === "reopen-finance" ? (
        <ReasonDialog title="Reabrir financeiro do projeto" description="Libera de novo despesas, adiantamentos e lotes." confirm="Reabrir" busy={mutate.isPending} error={mutate.isError ? (mutate.error as Error).message : null}
          onClose={() => setDialog(null)} onConfirm={(reason) => mutate.mutate(async () => { await expensesApi.reopenFinance(projectId, reason); return "Financeiro do projeto reaberto."; })} />
      ) : null}
    </div>
    </>
  );
}
