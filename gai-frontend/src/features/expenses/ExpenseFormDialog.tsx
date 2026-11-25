import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FormField } from "@/components/base/FormField";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/base/MoneyInput";
import { formatMoney } from "@/utils/format";
import { usePermissions } from "@/features/auth/usePermissions";
import { ExpenseAttachmentsPanel } from "@/features/finance/ExpenseAttachmentsPanel";
import { uploadExpenseAttachment } from "@/features/finance/financeQueries";
import type { Expense } from "@/types/api";
import { PendingReceipts, type PendingReceipt } from "./PendingReceipts";
import {
  EXPENSE_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  equalInstallments,
  expensesApi,
  type ExpenseBoard,
  type ExpenseBoardItem,
  type ExpensePaymentMethod,
  type ExpensePayload,
  type ExpenseType,
} from "./expensesApi";

type Line = { due_date: string; amount: string };

const select = "h-10 w-full rounded-md border bg-background px-3 text-sm";

/**
 * Nova despesa / editar (doc 06 §3.3): data, inventariante (só vinculados), motivo da lista,
 * tipo (padrão do contrato), observação, valor, depositado e forma de pagamento.
 * A prazo: parcelas iguais (D-E) ou grade editada, sempre somando o valor.
 */
export function ExpenseFormDialog({
  projectId,
  board,
  initial,
  onClose,
  onSaved,
}: {
  projectId: number;
  board: ExpenseBoard;
  initial: ExpenseBoardItem | null;
  onClose: () => void;
  /** `warning`: a despesa foi salva, mas algum comprovante não foi enviado. */
  onSaved: (warning?: string) => void;
}) {
  const { hasPermission } = usePermissions();
  const canAttach = hasPermission("expenses:upload-attachment");
  const [receipts, setReceipts] = useState<PendingReceipt[]>([]);
  const reasons = board.parameters.reasons;
  const [date, setDate] = useState(initial?.expense_date ?? board.today);
  const [agent, setAgent] = useState(initial?.field_agent_id ? String(initial.field_agent_id) : "");
  const [reason, setReason] = useState(initial?.reason_code ?? "");
  const [type, setType] = useState<ExpenseType | "">(initial ? (initial.expense_type ?? "") : (board.default_expense_type ?? ""));
  const [notes, setNotes] = useState(initial ? (initial.reason_code && initial.description === initial.reason_code ? "" : initial.description) : "");
  // valores no formato da API ("1234.56"); o MoneyInput mostra "1.234,56"
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [deposited, setDeposited] = useState(initial?.deposited_amount ?? "");
  const [method, setMethod] = useState<ExpensePaymentMethod>(initial?.payment_method ?? "cash");
  const [invoiced, setInvoiced] = useState(initial?.invoiced_payment_date ?? "");
  const [count, setCount] = useState(String(initial?.installments.length || 2));
  const [equal, setEqual] = useState(!initial?.installments.length);
  const [grid, setGrid] = useState<Line[]>(
    initial?.installments.map((l) => ({ due_date: l.due_date, amount: l.amount })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const value = amount || null;
  const plan = useMemo(
    () => (method === "installments" && value && equal ? equalInstallments(value, Number(count), date) : []),
    [method, value, equal, count, date],
  );
  const lines: Line[] = equal ? plan.map((l) => ({ due_date: l.due_date, amount: l.amount })) : grid;
  const gridSum = lines.reduce((s, l) => s + Math.round(Number(l.amount || "0") * 100), 0);
  const agents = board.agents.filter((a) => a.linked || a.id === initial?.field_agent_id);

  const save = useMutation({
    mutationFn: async (payload: ExpensePayload) => {
      if (initial) {
        await expensesApi.update(projectId, initial.id, payload);
        return undefined;
      }
      const created = await expensesApi.create(projectId, payload);
      // despesa nova: envia os comprovantes escolhidos; falha num arquivo não desfaz a despesa
      const failures: string[] = [];
      for (const item of canAttach ? receipts : []) {
        try {
          await uploadExpenseAttachment(projectId, created.id, item.file);
        } catch (error) {
          failures.push(`${item.file.name}: ${(error as Error).message}`);
        }
      }
      return failures.length
        ? `Despesa lançada, mas ${failures.length} comprovante(s) não foram enviados (${failures.join("; ")}). Envie-os pela edição da despesa.`
        : undefined;
    },
    onSuccess: (warning) => onSaved(warning),
  });

  function submit() {
    const e: Record<string, string> = {};
    if (!date) e.date = "Informe a data.";
    if (!reason) e.reason = "Escolha o motivo.";
    if (!value || Number(value) <= 0) e.amount = "Informe um valor maior que zero.";
    const dep = deposited || null;
    if (method === "invoiced" && !invoiced) e.invoiced = "Informe a data de pagamento da fatura.";
    if (method === "installments") {
      if (!lines.length) e.installments = "Informe as parcelas.";
      else if (value && gridSum !== Math.round(Number(value) * 100))
        e.installments = `A soma das parcelas (${formatMoney(gridSum / 100)}) difere do valor (${formatMoney(value)}).`;
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate({
      field_agent_id: agent ? Number(agent) : null,
      description: notes.trim() || reason,
      reason_code: reason || null,
      expense_type: type || null,
      expense_date: date,
      amount: value!,
      deposited_amount: dep,
      payment_method: method,
      invoiced_payment_date: method === "invoiced" ? invoiced : null,
      ...(method === "installments"
        ? {
            installment_count: lines.length,
            installments: lines.map((l) => ({ due_date: l.due_date, amount: l.amount || "0.00" })),
          }
        : {}),
    });
  }

  return (
    <ModalForm open onOpenChange={(open) => !open && onClose()} title={initial ? `Editar despesa ${initial.sequence ?? ""}` : "Nova despesa"}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Data da despesa" error={errors.date}>
            <Input type="date" aria-label="Data da despesa" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="Inventariante">
            <select aria-label="Inventariante" className={select} value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="">Despesas gerais (sem inventariante)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Motivo" error={errors.reason}>
            {reasons ? (
              <select aria-label="Motivo" className={select} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Selecione</option>
                {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <Input aria-label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </FormField>
          <FormField label="Tipo de despesa">
            <select aria-label="Tipo de despesa" className={select} value={type} onChange={(e) => setType(e.target.value as ExpenseType | "")}>
              <option value="">Não classificada</option>
              {(Object.keys(EXPENSE_TYPE_LABEL) as ExpenseType[]).map((t) => (
                <option key={t} value={t}>{EXPENSE_TYPE_LABEL[t]}</option>
              ))}
            </select>
            {!initial ? (
              <span className="text-xs text-muted-foreground">
                Padrão do contrato: {board.contract_type_label}.
              </span>
            ) : null}
          </FormField>
          <FormField label="Valor da despesa (R$)" error={errors.amount}>
            <MoneyInput aria-label="Valor da despesa (R$)" value={amount} onValueChange={setAmount} />
          </FormField>
          <FormField label="Valor depositado (R$)" error={errors.deposited}>
            <MoneyInput aria-label="Valor depositado (R$)" value={deposited} onValueChange={setDeposited} />
          </FormField>
        </div>
        <FormField label="Observação">
          <textarea aria-label="Observação" className="min-h-16 rounded-md border bg-background px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <fieldset className="grid gap-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-semibold">Forma de pagamento</legend>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(PAYMENT_METHOD_LABEL) as ExpensePaymentMethod[]).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="radio" name="payment_method" checked={method === m} onChange={() => setMethod(m)} />
                {PAYMENT_METHOD_LABEL[m]}
              </label>
            ))}
          </div>
          {method === "invoiced" ? (
            <FormField label="Data de pagamento da fatura" error={errors.invoiced}>
              <Input type="date" aria-label="Data de pagamento da fatura" value={invoiced} onChange={(e) => setInvoiced(e.target.value)} />
            </FormField>
          ) : null}
          {method === "installments" ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-end gap-3">
                <FormField label="Parcelas">
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    aria-label="Número de parcelas"
                    className="w-24"
                    value={count}
                    onChange={(e) => {
                      setCount(e.target.value);
                      setEqual(true);
                    }}
                  />
                </FormField>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={equal}
                    onChange={(e) => {
                      if (!e.target.checked) setGrid(lines);
                      setEqual(e.target.checked);
                    }}
                  />
                  Parcelas iguais (resto na última)
                </label>
              </div>
              {lines.length ? (
                <table className="w-full text-sm" aria-label="Parcelas">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className="text-left">Nº</th><th className="text-left">Vencimento</th><th className="text-left">Valor (R$)</th></tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2">{i + 1}</td>
                        <td className="py-1 pr-2">
                          <Input type="date" aria-label={`Vencimento da parcela ${i + 1}`} value={l.due_date} disabled={equal}
                            onChange={(e) => setGrid((g) => g.map((x, k) => (k === i ? { ...x, due_date: e.target.value } : x)))} />
                        </td>
                        <td className="py-1">
                          <MoneyInput aria-label={`Valor da parcela ${i + 1} (R$)`} value={l.amount} disabled={equal}
                            onValueChange={(v) => setGrid((g) => g.map((x, k) => (k === i ? { ...x, amount: v } : x)))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <p className={`text-xs ${errors.installments ? "text-destructive" : "text-muted-foreground"}`} role={errors.installments ? "alert" : undefined}>
                {errors.installments ?? `Soma das parcelas: ${formatMoney(gridSum / 100)}. Vencimentos: data da compra + 1, 2… meses.`}
              </p>
            </div>
          ) : null}
        </fieldset>
        {initial ? (
          <ExpenseAttachmentsPanel
            projectId={projectId}
            expense={{ id: initial.id } as Expense}
            maxBytes={board.parameters.attachment_max_bytes ?? undefined}
            maxFiles={board.parameters.attachment_max_files ?? undefined}
          />
        ) : canAttach ? (
          <PendingReceipts
            value={receipts}
            onChange={setReceipts}
            maxBytes={board.parameters.attachment_max_bytes}
            maxFiles={board.parameters.attachment_max_files}
            disabled={save.isPending}
          />
        ) : null}
        {save.isError ? <p role="alert" className="text-sm text-destructive">{(save.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" loading={save.isPending}>{initial ? "Salvar" : "Lançar despesa"}</Button>
        </div>
      </form>
    </ModalForm>
  );
}
