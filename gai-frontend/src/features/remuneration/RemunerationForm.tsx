import { useMemo, useState } from "react";
import { FormField } from "@/components/base/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/utils/format";
import { BRAZILIAN_STATES } from "@/features/field-agents/brazilianStates";
import {
  computeRemuneration,
  daysInclusive,
  moneyBr,
  normalizeMoney,
  type ProjectRemuneration,
  type RemunerationInput,
  type RemunerationItem,
} from "./remunerationApi";
import { validateDraft, type Draft } from "./remunerationDraft";

export function RemunerationForm({
  data,
  initial,
  preset,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: {
  data: ProjectRemuneration;
  initial?: RemunerationItem;
  preset?: { field_agent_id: number; state: string | null };
  busy: boolean;
  serverError?: string | null;
  onSubmit: (payload: RemunerationInput) => void;
  onCancel: () => void;
}) {
  const linked = data.agents.filter((a) => a.link_status === "active" || a.id === initial?.field_agent_id);
  const [draft, setDraft] = useState<Draft>(() => ({
    field_agent_id: String(initial?.field_agent_id ?? preset?.field_agent_id ?? ""),
    state: initial?.state ?? preset?.state ?? "",
    start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "",
    expected_payment_date: initial?.expected_payment_date ?? "",
    daily_rate: moneyBr(initial?.daily_rate ?? data.parameters.default_daily_rate ?? ""),
    additional_amount: moneyBr(initial?.additional_amount ?? "0.00"),
    total_manual: initial?.total_manual ?? false,
    total_amount: moneyBr(initial?.total_manual ? initial.total_amount : ""),
    discount_amount: moneyBr(initial?.discount_amount ?? "0.00"),
    notes: initial?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof Draft, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }));
  const days = daysInclusive(draft.start_date, draft.end_date);
  const preview = useMemo(() => {
    const rate = normalizeMoney(draft.daily_rate);
    const additional = normalizeMoney(draft.additional_amount);
    const discount = normalizeMoney(draft.discount_amount);
    const manual = draft.total_manual ? normalizeMoney(draft.total_amount) : null;
    if (rate === null || additional === null || discount === null || (draft.total_manual && manual === null)) return null;
    return computeRemuneration({ days, dailyRate: rate, additional, discount, manualTotal: manual });
  }, [days, draft]);
  const field = (key: keyof Draft, label: string, props: Record<string, unknown> = {}) => (
    <FormField label={label} error={errors[key]}>
      <Input
        value={String(draft[key])}
        onChange={(event) => set(key, event.target.value)}
        {...props}
      />
    </FormField>
  );

  return (
    <form
      noValidate
      className="grid gap-4"
      aria-label="Lançamento de remuneração"
      onSubmit={(event) => {
        event.preventDefault();
        const result = validateDraft(draft);
        setErrors(result.errors);
        if (result.payload) onSubmit(result.payload);
      }}
    >
      {data.parameters.settings_missing ? (
        <p role="note" className="rounded-md border p-3 text-sm">
          A organização ainda não tem parâmetros financeiros: informe a diária manualmente.
        </p>
      ) : null}
      <FormField label="Inventariante" error={errors.field_agent_id}>
        <select
          className="h-11 rounded-md border bg-background px-3 text-sm"
          value={draft.field_agent_id}
          disabled={Boolean(initial)}
          onChange={(event) => {
            const agent = linked.find((a) => String(a.id) === event.target.value);
            setDraft((d) => ({ ...d, field_agent_id: event.target.value, state: d.state || agent?.state || "" }));
          }}
        >
          <option value="">Selecione (só vinculados ao projeto)</option>
          {linked.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="UF">
          <select
            className="h-11 rounded-md border bg-background px-3 text-sm"
            value={draft.state}
            onChange={(event) => set("state", event.target.value)}
          >
            <option value="">Não informada</option>
            {BRAZILIAN_STATES.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </FormField>
        {field("expected_payment_date", "Data prevista de pagamento", { type: "date", required: true })}
        {field("start_date", "Data inicial", { type: "date" })}
        {field("end_date", "Data final", { type: "date" })}
        <FormField label="Dias">
          <Input value={String(days)} readOnly aria-readonly="true" />
        </FormField>
        {field("daily_rate", "Diária (R$)", { inputMode: "decimal" })}
        {field("additional_amount", "Valor adicional (R$)", { inputMode: "decimal" })}
        {field("discount_amount", "Descontos (R$)", { inputMode: "decimal" })}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.total_manual}
          onChange={(event) =>
            setDraft((d) => ({
              ...d,
              total_manual: event.target.checked,
              total_amount: event.target.checked && preview ? moneyBr(preview.total) : d.total_amount,
            }))
          }
        />
        Informar o total manualmente
      </label>
      {draft.total_manual ? (
        <>
          {field("total_amount", "Total (R$)", { inputMode: "decimal" })}
          <p role="note" className="text-sm font-medium text-warning">
            Valor informado manualmente: o total não segue dias × diária + adicional.
          </p>
        </>
      ) : null}
      {field("notes", "Observação")}
      <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3" aria-label="Cálculo">
        <div>
          <dt className="text-muted-foreground">Dias × diária</dt>
          <dd className="font-semibold">{preview ? formatMoney(preview.dailyTotal) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total{draft.total_manual ? " (manual)" : ""}</dt>
          <dd className="font-semibold">{preview ? formatMoney(preview.total) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Final</dt>
          <dd className={`font-semibold ${preview?.negative ? "text-destructive" : ""}`}>
            {preview ? formatMoney(preview.final) : "—"}
          </dd>
        </div>
      </dl>
      {serverError ? (
        <p role="alert" className="rounded-lg border p-3 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy}>
          {initial ? "Salvar alterações" : "Lançar"}
        </Button>
      </div>
    </form>
  );
}
