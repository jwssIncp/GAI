import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { FormField } from "@/components/base/FormField";
import { MoneyInput } from "@/components/base/MoneyInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import { usePermissions } from "@/features/auth/usePermissions";
import { formatMoney } from "@/utils/format";
import {
  EXPENSE_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  civilBr,
  expensesApi,
  expensesKeys,
  saveBlob,
  type ExpenseAdvance,
  type ExpenseBoard,
  type ImportPreview,
  type ReimbursementBatch,
} from "./expensesApi";

const select = "h-10 w-full rounded-md border bg-background px-3 text-sm";

/** Justificativa obrigatória (reabrir despesa, concluir/reabrir financeiro, rejeitar). */
export function ReasonDialog({
  title,
  description,
  label = "Justificativa",
  confirm,
  danger,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  label?: string;
  confirm: string;
  danger?: boolean;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const short = reason.trim().length < 5;
  return (
    <ModalForm open onOpenChange={(open) => !open && onClose()} title={title}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!short) onConfirm(reason.trim());
        }}
      >
        <p className="text-sm text-muted-foreground">{description}</p>
        <FormField label={label}>
          <textarea aria-label={label} className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="text-xs text-muted-foreground">Mínimo de 5 caracteres; fica registrada na auditoria.</span>
        </FormField>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy} disabled={short}>{confirm}</Button>
        </div>
      </form>
    </ModalForm>
  );
}

/** Adiantamentos de um inventariante no projeto: lista, adicionar, editar e excluir (com confirmação). */
export function AdvancesDialog({
  projectId,
  board,
  agentId,
  onClose,
  onChanged,
}: {
  projectId: number;
  board: ExpenseBoard;
  agentId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: expensesKeys.advances(projectId), queryFn: () => expensesApi.advances(projectId) });
  const name = board.agents.find((a) => a.id === agentId)?.name ?? board.summary.find((s) => s.field_agent_id === agentId)?.name ?? "";
  const [editing, setEditing] = useState<ExpenseAdvance | "new" | null>(null);
  const [removing, setRemoving] = useState<ExpenseAdvance | null>(null);
  const [date, setDate] = useState(board.today);
  const [amount, setAmount] = useState(""); // formato da API ("1234.56")
  const [notes, setNotes] = useState("");
  const [depositor, setDepositor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: expensesKeys.advances(projectId) });
    onChanged();
  };
  const save = useMutation({
    mutationFn: () =>
      expensesApi.saveAdvance(projectId, editing && editing !== "new" ? editing.id : null, {
        field_agent_id: agentId,
        advanced_on: date,
        amount,
        notes: notes.trim() || null,
        deposited_by_name: depositor.trim() || null,
      }),
    onSuccess: async () => {
      setEditing(null);
      toast({ title: "Adiantamento salvo.", tone: "success" });
      await refresh();
    },
    onError: (e) => setError((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => expensesApi.removeAdvance(projectId, id),
    onSuccess: async () => {
      setRemoving(null);
      toast({ title: "Adiantamento excluído.", tone: "success" });
      await refresh();
    },
  });
  const open = (advance: ExpenseAdvance | "new") => {
    setError(null);
    setEditing(advance);
    setDate(advance === "new" ? board.today : advance.advanced_on);
    setAmount(advance === "new" ? "" : advance.amount);
    setNotes(advance === "new" ? "" : (advance.notes ?? ""));
    setDepositor(advance === "new" ? "" : (advance.deposited_by_name ?? ""));
  };
  const rows = (query.data ?? []).filter((a) => a.field_agent_id === agentId);
  const value = amount || null;

  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title={`Adiantamentos de ${name}`}>
      <div className="grid gap-4">
        {query.isLoading ? <LoadingState label="Carregando adiantamentos" /> : query.isError ? <ErrorState message={(query.error as Error).message} /> : (
          <table className="w-full text-sm" aria-label="Adiantamentos">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left">Data</th><th className="text-left">Valor</th><th className="text-left">Responsável</th><th className="text-left">Observação</th><th /></tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-2">{civilBr(a.advanced_on)}</td>
                  <td className="numeric py-2">{formatMoney(a.amount)}</td>
                  <td className="py-2">{a.deposited_by_name ?? "—"}</td>
                  <td className="py-2">{a.notes ?? "—"}</td>
                  <td className="py-2 text-right">
                    {hasPermission("expense-advances:update") ? (
                      <Button type="button" variant="ghost" className="size-8" aria-label={`Editar adiantamento de ${civilBr(a.advanced_on)}`} title="Editar" onClick={() => open(a)}><Pencil size={15} /></Button>
                    ) : null}
                    {hasPermission("expense-advances:delete") ? (
                      <Button type="button" variant="ghost" className="size-8" aria-label={`Excluir adiantamento de ${civilBr(a.advanced_on)}`} title="Excluir" onClick={() => setRemoving(a)}><Trash2 size={15} /></Button>
                    ) : null}
                  </td>
                </tr>
              )) : <tr><td colSpan={5} className="py-3 text-muted-foreground">Nenhum adiantamento.</td></tr>}
            </tbody>
          </table>
        )}
        {editing ? (
          <form
            className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!value || Number(value) <= 0) return setError("Informe um valor maior que zero.");
              save.mutate();
            }}
          >
            <FormField label="Data do depósito"><Input type="date" aria-label="Data do depósito" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
            <FormField label="Valor depositado (R$)"><MoneyInput aria-label="Valor do adiantamento (R$)" value={amount} onValueChange={setAmount} /></FormField>
            <FormField label="Responsável pelo depósito"><Input aria-label="Responsável pelo depósito" value={depositor} onChange={(e) => setDepositor(e.target.value)} /></FormField>
            <FormField label="Observação"><Input aria-label="Observação do adiantamento" value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
            {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" loading={save.isPending}>Salvar adiantamento</Button>
            </div>
          </form>
        ) : hasPermission("expense-advances:create") ? (
          <div className="flex justify-end"><Button type="button" onClick={() => open("new")}>Adicionar adiantamento</Button></div>
        ) : null}
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Excluir adiantamento"
        description={`Excluir o adiantamento de ${removing ? formatMoney(removing.amount) : ""} em ${civilBr(removing?.advanced_on)}? O saldo do inventariante será recalculado.`}
        confirmLabel="Excluir"
        busy={remove.isPending}
        error={remove.isError ? (remove.error as Error).message : null}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </ModalForm>
  );
}

/** "Incluir em lote de reembolso": as despesas reembolsáveis selecionadas entram num lote de reembolso ao cliente. */
export function AccountDialog({
  projectId,
  board,
  ids,
  onClose,
  onDone,
}: {
  projectId: number;
  board: ExpenseBoard;
  ids: number[];
  onClose: () => void;
  onDone: (message: string, error: boolean) => void;
}) {
  const batches = useQuery({ queryKey: expensesKeys.batches(projectId), queryFn: () => expensesApi.batches(projectId) });
  const open = (batches.data ?? []).filter((b) => b.status === "open");
  const [target, setTarget] = useState("new");
  const [date, setDate] = useState(board.today);
  const chosen = board.items.filter((i) => ids.includes(i.id));
  const eligible = chosen.filter((i) => i.expense_type === "reimbursable");
  const run = useMutation({
    mutationFn: () =>
      expensesApi.addToBatch(projectId, target === "new" ? { ids: eligible.map((i) => i.id), batch_date: date } : { ids: eligible.map((i) => i.id), batch_id: Number(target) }),
    onSuccess: (r) => {
      const failures = r.results.filter((x) => !x.ok).map((x) => x.message).join("; ");
      onDone(`${r.done} despesa(s) incluída(s) no lote ${r.batch_number}.${failures ? ` Não incluídas: ${failures}` : ""}`, r.failed > 0);
    },
  });
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Incluir em lote de reembolso">
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {eligible.length} de {chosen.length} selecionada(s) são reembolsáveis ({formatMoney(eligible.reduce((s, i) => s + Number(i.amount), 0))}).
          Só elas entram no lote. O lote sai de "A reembolsar" quando for faturado ao cliente.
        </p>
        <FormField label="Lote">
          <select aria-label="Lote de reembolso" className={select} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="new">Novo lote</option>
            {open.map((b) => <option key={b.id} value={b.id}>{`Lote ${b.number} (aberto, ${civilBr(b.batch_date)})`}</option>)}
          </select>
        </FormField>
        {target === "new" ? (
          <FormField label="Data do lote"><Input type="date" aria-label="Data do lote" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
        ) : null}
        {run.isError ? <p role="alert" className="text-sm text-destructive">{(run.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" loading={run.isPending} disabled={!eligible.length} onClick={() => run.mutate()}>Incluir no lote</Button>
        </div>
      </div>
    </ModalForm>
  );
}

/** Lotes de reembolso do projeto: faturar, reabrir e cancelar, cada um com confirmação. */
export function BatchesPanel({ projectId, onChanged, onFilter }: { projectId: number; onChanged: () => void; onFilter: (batchId: number) => void }) {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: expensesKeys.batches(projectId), queryFn: () => expensesApi.batches(projectId) });
  const [pending, setPending] = useState<{ batch: ReimbursementBatch; action: "bill" | "reopen" | "cancel" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (p: NonNullable<typeof pending>) => expensesApi.batchAction(projectId, p.batch.id, p.action),
    onSuccess: async (_r, p) => {
      setPending(null);
      setError(null);
      toast({ title: `Lote ${p.batch.number} ${{ bill: "faturado", reopen: "reaberto", cancel: "cancelado" }[p.action]}.`, tone: "success" });
      await cache.invalidateQueries({ queryKey: expensesKeys.batches(projectId) });
      onChanged();
    },
    onError: (e) => {
      setPending(null);
      setError((e as Error).message);
    },
  });
  const [showCancelled, setShowCancelled] = useState(false);
  const all = query.data ?? [];
  const cancelled = all.filter((b) => b.status === "cancelled").length;
  const batches = showCancelled ? all : all.filter((b) => b.status !== "cancelled");
  if (!all.length) return null;
  const verb = { bill: "Faturar", reopen: "Reabrir", cancel: "Cancelar" } as const;
  const text = {
    bill: "As despesas do lote saem de \"A reembolsar\" (cobradas do cliente).",
    reopen: "O lote volta a aberto e as despesas voltam a contar em \"A reembolsar\".",
    cancel: "O lote é cancelado e as despesas ficam sem lote.",
  } as const;
  return (
    <section className="premium-panel grid gap-2 p-4" aria-label="Lotes de reembolso">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Lotes de reembolso ao cliente</h3>
        {cancelled ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            {`Mostrar cancelados (${cancelled})`}
          </label>
        ) : null}
      </div>
      {!batches.length ? <p className="text-sm text-muted-foreground">Nenhum lote aberto ou faturado.</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className={batches.length ? "overflow-x-auto" : "hidden"}>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="text-left">Lote</th><th className="text-left">Data</th><th className="text-left">Situação</th><th className="text-left">Despesas</th><th className="text-left">Valor</th><th /></tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="py-2"><button type="button" className="text-primary-text hover:underline" onClick={() => onFilter(b.id)} title="Filtrar as despesas deste lote">Lote {b.number}</button></td>
                <td className="py-2">{civilBr(b.batch_date)}</td>
                <td className="py-2">{b.status_label}</td>
                <td className="py-2 tabular-nums">{b.count}</td>
                <td className="numeric py-2">{formatMoney(b.amount)}</td>
                <td className="py-2 text-right">
                  {b.status === "open" && hasPermission("reimbursement-batches:close") ? <Button type="button" variant="secondary" onClick={() => setPending({ batch: b, action: "bill" })}>Faturar</Button> : null}
                  {b.status === "billed" && hasPermission("reimbursement-batches:reopen") ? <Button type="button" variant="ghost" onClick={() => setPending({ batch: b, action: "reopen" })}>Reabrir</Button> : null}
                  {b.status === "open" && hasPermission("reimbursement-batches:reopen") ? <Button type="button" variant="ghost" onClick={() => setPending({ batch: b, action: "cancel" })}>Cancelar</Button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `${verb[pending.action]} o lote ${pending.batch.number}` : ""}
        description={pending ? `${text[pending.action]} Confirmar?` : ""}
        variant={pending?.action === "cancel" ? "danger" : "primary"}
        confirmLabel={pending ? (pending.action === "cancel" ? "Cancelar lote" : verb[pending.action]) : "Confirmar"}
        busy={run.isPending}
        onConfirm={() => pending && run.mutate(pending)}
      />
    </section>
  );
}

const FIELD_LABEL: Record<string, string> = {
  expense_date: "Data",
  field_agent: "Inventariante",
  reason_code: "Motivo",
  description: "Observação",
  expense_type: "Tipo de despesa",
  amount: "Valor",
  deposited_amount: "Valor depositado",
  payment_method: "Forma de pagamento",
  installment_count: "Parcelas",
  invoiced_payment_date: "Data de pagamento (faturado)",
};

/** Importar Excel/CSV: ler, conferir a pré-visualização e gravar só as linhas válidas. */
export function ImportDialog({ projectId, onClose, onDone }: { projectId: number; onClose: () => void; onDone: (message: string, error: boolean) => void }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const read = useMutation({ mutationFn: (file: File) => expensesApi.importPreview(projectId, file), onSuccess: setPreview });
  const commit = useMutation({
    mutationFn: () => expensesApi.importCommit(projectId, preview!.rows.filter((r) => !r.errors.length).map(({ line, values }) => ({ line, values }))),
    onSuccess: (r) => {
      const failures = r.results.filter((x) => !x.ok).map((x) => `linha ${x.line}: ${x.message}`).join("; ");
      onDone(`${r.done} despesa(s) importada(s).${failures ? ` Não importadas: ${failures}` : ""}`, r.failed > 0);
    },
  });
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Importar despesas (Excel ou CSV)">
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Cabeçalhos reconhecidos (com ou sem acento): Data, Inventariante (ou Técnico), Motivo, Observação, Tipo de despesa (Reembolsável / Não
          reembolsável), Valor ou Total, Depositado ou Adiantamento, Forma de pagamento (À vista / A prazo / Faturado), Parcelas
          e Data de pagamento. Valores no padrão brasileiro (1.234,56). Tipo vazio usa o padrão do contrato.
        </p>
        <input
          type="file"
          aria-label="Arquivo para importar"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) read.mutate(file);
          }}
        />
        {read.isPending ? <LoadingState label="Lendo o arquivo" /> : null}
        {read.isError ? <p role="alert" className="text-sm text-destructive">{(read.error as Error).message}</p> : null}
        {preview ? (
          <div className="grid gap-2">
            <p className="text-sm">
              <strong>{preview.valid}</strong> linha(s) válida(s), <strong>{preview.invalid}</strong> com erro. Colunas lidas:{" "}
              {Object.entries(preview.columns).map(([k, v]) => `${FIELD_LABEL[k] ?? k} ← "${v}"`).join(", ")}.
              {preview.ignored_columns.length ? ` Ignoradas: ${preview.ignored_columns.join(", ")}.` : ""}
            </p>
            <div className="max-h-72 overflow-auto rounded border">
              <table className="w-full text-xs" aria-label="Pré-visualização da importação">
                <thead className="sticky top-0 bg-muted">
                  <tr><th className="p-1 text-left">Linha</th><th className="p-1 text-left">Data</th><th className="p-1 text-left">Inventariante</th><th className="p-1 text-left">Motivo</th><th className="p-1 text-left">Tipo</th><th className="p-1 text-left">Forma</th><th className="p-1 text-left">Valor</th><th className="p-1 text-left">Situação</th></tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line} className={r.errors.length ? "bg-destructive/[0.06]" : ""}>
                      <td className="p-1">{r.line}</td>
                      <td className="p-1">{civilBr(r.values.expense_date)}</td>
                      <td className="p-1">{r.values.field_agent_name ?? "Despesas gerais"}</td>
                      <td className="p-1">{r.values.reason_code ?? "—"}</td>
                      <td className="p-1">{r.values.expense_type ? EXPENSE_TYPE_LABEL[r.values.expense_type] : "padrão"}</td>
                      <td className="p-1">{r.values.payment_method ? `${PAYMENT_METHOD_LABEL[r.values.payment_method]}${r.values.installment_count ? ` ${r.values.installment_count}x` : ""}` : "—"}</td>
                      <td className="numeric p-1">{r.values.amount ? formatMoney(r.values.amount) : "—"}</td>
                      <td className="p-1">{r.errors.length ? <span className="text-destructive">{r.errors.join(" ")}</span> : "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {commit.isError ? <p role="alert" className="text-sm text-destructive">{(commit.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!preview?.valid} loading={commit.isPending} onClick={() => commit.mutate()}>
            {`Importar ${preview?.valid ?? 0} linha(s) válida(s)`}
          </Button>
        </div>
      </div>
    </ModalForm>
  );
}

/** ZIP com comprovantes: completo ou só reembolsáveis (para o cliente), escolhendo o lote. */
export function ZipDialog({ projectId, projectName, onClose }: { projectId: number; projectName: string; onClose: () => void }) {
  const batches = useQuery({ queryKey: expensesKeys.batches(projectId), queryFn: () => expensesApi.batches(projectId).catch(() => [] as ReimbursementBatch[]) });
  const [kind, setKind] = useState<"full" | "client">("full");
  const [batch, setBatch] = useState("all");
  const run = useMutation({
    mutationFn: () => expensesApi.zip(projectId, kind, batch),
    onSuccess: (blob) => {
      saveBlob(blob, `despesas-${kind === "client" ? "cliente-reembolsavel" : "completo"}-${projectName}.zip`);
      onClose();
    },
  });
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Exportar ZIP com comprovantes">
      <div className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">Conteúdo</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="zip-kind" checked={kind === "full"} onChange={() => setKind("full")} />Projeto completo</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="zip-kind" checked={kind === "client"} onChange={() => setKind("client")} />Cliente: só reembolsáveis</label>
        </fieldset>
        <FormField label="Lote">
          <select aria-label="Lote do ZIP" className={select} value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="all">Todas as despesas</option>
            <option value="batched">Todas já em lote</option>
            <option value="unbatched">Sem lote</option>
            {(batches.data ?? []).filter((b) => b.status !== "cancelled").map((b) => <option key={b.id} value={b.id}>{`Lote ${b.number} (${civilBr(b.batch_date)}, ${b.status_label.toLowerCase()})`}</option>)}
          </select>
        </FormField>
        <p className="text-xs text-muted-foreground">
          Pastas "Comprovantes por inventariante/&lt;inventariante&gt;" e "Despesas Gerais", com o código da despesa no nome de cada arquivo,
          e a planilha "Lançamentos". Só entram comprovantes com envio confirmado.
        </p>
        {run.isError ? <p role="alert" className="text-sm text-destructive">{(run.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" loading={run.isPending} onClick={() => run.mutate()}>Gerar ZIP</Button>
        </div>
      </div>
    </ModalForm>
  );
}
