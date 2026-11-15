import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/base/States";
import { FormField } from "@/components/base/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/features/auth/usePermissions";
import { formatDateTime } from "@/utils/format";
import {
  FIXED_COST_MODE_LABEL,
  financeSettingsApi,
  financeSettingsKeys,
  nextValidFrom,
  uncoveredSince,
  type FinanceSettingsOverview,
  type FinanceSettingsValues,
  type FinanceSettingsVersion,
  type FixedCostItemMode,
} from "./financeSettingsApi";

const MB = 1024 * 1024;
/** Data civil (AAAA-MM-DD) sem conversão de fuso. */
const formatDate = (value: string) => value.split("-").reverse().join("/");
const pct = (value: string) => `${value.replace(".", ",")}%`;
const brl = (value: string) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mb = (bytes: number) =>
  `${(bytes / MB).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB`;
const slug = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

type FixedCostItem = keyof FinanceSettingsValues["fixed_cost_item_modes"];
/** Modo do item de custo fixo; no modo fixo, mostra o valor ao lado. */
function fixedCostLabel(v: FinanceSettingsValues, item: FixedCostItem) {
  const mode = v.fixed_cost_item_modes[item];
  const amount = v.fixed_cost_item_amounts?.[item];
  return mode === "fixed" && amount ? `${FIXED_COST_MODE_LABEL.fixed} · ${brl(amount)}` : FIXED_COST_MODE_LABEL[mode];
}

/** Linhas de leitura dos parâmetros, agrupadas como no formulário. */
function summaryRows(v: FinanceSettingsValues): Array<[string, Array<[string, string]>]> {
  return [
    [
      "Impostos e comissões",
      [
        ["IR sobre faturamento", pct(v.income_tax_pct)],
        ["Impostos sobre placas", pct(v.tag_tax_pct)],
        ["Comissão do sócio", pct(v.partner_commission_pct)],
        [
          "Comissão por origem",
          v.commercial_origins.map((o) => `${o.label} ${pct(o.commission_pct)}`).join(" · "),
        ],
      ],
    ],
    [
      "Remuneração e orçado",
      [
        ["Diária padrão do inventariante", brl(v.default_daily_rate)],
        ["Produtividade para orçar inventariantes", `${v.budget_productivity_items_per_day} itens/dia`],
        ["Despesas não reembolsáveis orçadas", pct(v.budgeted_non_reimbursable_expense_pct)],
        ["Alerta de despesas de técnicos", pct(v.technician_expense_alert_pct)],
        ["Exigir aprovação de diárias e despesas", v.require_approval ? "Sim" : "Não"],
      ],
    ],
    [
      "Custos fixos e indicadores",
      [
        ["Custo fixo da operação", brl(v.fixed_cost_operation)],
        ["Custo fixo da filial", brl(v.fixed_cost_branch)],
        ["Adicional de IR", fixedCostLabel(v, "additional_income_tax")],
        ["Equipamentos", fixedCostLabel(v, "equipment")],
        ["Back-office", fixedCostLabel(v, "back_office")],
        ["Margem do ponto de equilíbrio econômico", pct(v.economic_break_even_margin_pct)],
      ],
    ],
    [
      "Recebíveis e DRE",
      [
        ["Prazo da 1ª parcela", `${v.first_installment_days_after_contract} dias após o contrato`],
        ["Mês de corte do regime da DRE", v.dre_regime_cutoff_month.split("-").reverse().join("/")],
      ],
    ],
    [
      "Listas e anexos",
      [
        ["Motivos de despesa", v.expense_reasons.join(", ")],
        ["Modelos de placa", v.tag_models.join(", ")],
        ["Fornecedor padrão de placas", v.default_tag_supplier],
        ["Documentos do inventariante", `até ${mb(v.field_agent_document_max_bytes)} por arquivo`],
        [
          "Anexos de despesa",
          `até ${mb(v.expense_attachment_max_bytes)} por arquivo, ${v.expense_attachment_max_files} arquivo(s)`,
        ],
      ],
    ],
  ];
}

function VersionSummary({ version, title }: { version: FinanceSettingsVersion; title: string }) {
  return (
    <section className="premium-panel grid gap-4 p-5" aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Versão {version.version} · vale a partir de {formatDate(version.valid_from)}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {summaryRows(version.values).map(([group, rows]) => (
          <div key={group}>
            <h3 className="mb-2 text-sm font-semibold">{group}</h3>
            <dl className="grid gap-1 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-x-4 border-b border-border/50 py-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function VersionForm({
  overview,
  initial,
  startDate,
  onCancel,
}: {
  overview: FinanceSettingsOverview;
  initial: FinanceSettingsValues;
  /** Data sugerida (ex.: do lançamento mais antigo sem parâmetro). */
  startDate?: string;
  onCancel: () => void;
}) {
  const cache = useQueryClient();
  const [values, setValues] = useState<FinanceSettingsValues>(() => {
    const v = structuredClone(initial);
    const start = startDate ?? nextValidFrom(overview);
    return overview.versions.length || !start ? v : { ...v, dre_regime_cutoff_month: start.slice(0, 7) };
  });
  const [validFrom, setValidFromState] = useState(() => startDate ?? nextValidFrom(overview));
  // Corte da DRE automática: na 1ª versão acompanha o mês de início (por
  // organização), enquanto o usuário não escolher outro.
  const [cutoffTouched, setCutoffTouched] = useState(overview.versions.length > 0);
  const setValidFrom = (date: string) => {
    setValidFromState(date);
    if (!cutoffTouched && /^\d{4}-\d{2}/.test(date)) setValues((current) => ({ ...current, dre_regime_cutoff_month: date.slice(0, 7) }));
  };
  const gap = uncoveredSince(overview);
  const until = overview.coverage_start && validFrom < overview.coverage_start ? overview.coverage_start : null;
  const [reason, setReason] = useState(
    overview.versions.length ? "" : "Versão inicial com os valores padrão",
  );
  const save = useMutation({
    mutationFn: (payload: FinanceSettingsValues) =>
      financeSettingsApi.publish({ valid_from: validFrom, reason, values: payload }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: financeSettingsKeys.all });
      onCancel();
    },
  });
  const set = <K extends keyof FinanceSettingsValues>(key: K, value: FinanceSettingsValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const text = (key: keyof FinanceSettingsValues, label: string, help?: string) => (
    <FormField label={label} help={help}>
      <Input
        inputMode="decimal"
        value={String(values[key])}
        onChange={(event) => set(key, event.target.value.replace(",", ".") as never)}
      />
    </FormField>
  );
  const integer = (key: keyof FinanceSettingsValues, label: string) => (
    <FormField label={label}>
      <Input
        type="number"
        min={0}
        value={String(values[key])}
        onChange={(event) => set(key, Number(event.target.value) as never)}
      />
    </FormField>
  );
  const megabytes = (key: "field_agent_document_max_bytes" | "expense_attachment_max_bytes", label: string) => (
    <FormField label={label} help={`Teto da plataforma: ${mb(overview.platform_max_upload_bytes)}.`}>
      <Input
        type="number"
        min={0.01}
        step="any"
        value={String(Math.round((values[key] / MB) * 100) / 100)}
        onChange={(event) => set(key, Math.round(Number(event.target.value) * MB))}
      />
    </FormField>
  );
  const list = (key: "expense_reasons" | "tag_models", label: string) => (
    <FormField label={label} help="Um item por linha.">
      <textarea
        className="min-h-28 rounded-md border bg-background p-3 text-sm"
        value={values[key].join("\n")}
        onChange={(event) => set(key, event.target.value.split("\n"))}
      />
    </FormField>
  );
  const mode = (key: FixedCostItem, label: string) => (
    <div className="grid gap-2">
    <FormField label={label}>
      <select
        className="h-11 rounded-md border bg-background px-3 text-sm"
        value={values.fixed_cost_item_modes[key]}
        onChange={(event) =>
          set("fixed_cost_item_modes", {
            ...values.fixed_cost_item_modes,
            [key]: event.target.value as FixedCostItemMode,
          })
        }
      >
        {Object.entries(FIXED_COST_MODE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </FormField>
    {values.fixed_cost_item_modes[key] === "fixed" ? (
      <FormField label={`${label}: valor fixo (R$/mês)`}>
        <Input
          inputMode="decimal"
          required
          value={values.fixed_cost_item_amounts[key]}
          onChange={(event) =>
            set("fixed_cost_item_amounts", {
              ...values.fixed_cost_item_amounts,
              [key]: event.target.value.replace(",", "."),
            })
          }
        />
      </FormField>
    ) : null}
    </div>
  );
  return (
    <form
      className="premium-panel grid gap-6 p-5"
      aria-label="Nova versão dos parâmetros financeiros"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          ...values,
          expense_reasons: values.expense_reasons.map((item) => item.trim()).filter(Boolean),
          tag_models: values.tag_models.map((item) => item.trim()).filter(Boolean),
        });
      }}
    >
      <div>
        <h2 className="text-lg font-semibold">
          {overview.versions.length ? "Nova versão" : "Primeira versão"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada alteração cria uma versão nova, que vale a partir da data informada. Versões
          anteriores não mudam e os cálculos usam a versão vigente na data de cada lançamento.
        </p>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Vigência</legend>
        <FormField label="Vale a partir de">
          <Input
            type="date"
            aria-label="Vale a partir de"
            value={validFrom}
            onChange={(event) => setValidFrom(event.target.value)}
            required
          />
          {gap && validFrom !== gap ? (
            <button type="button" className="text-left text-xs font-semibold text-primary-text underline" onClick={() => setValidFrom(gap)}>
              Usar a data do lançamento mais antigo ({formatDate(gap)})
            </button>
          ) : null}
        </FormField>
        {validFrom && validFrom < overview.today ? (
          <p role="alert" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm sm:col-span-2">
            Esta versão será aplicada a todos os lançamentos desde {formatDate(validFrom)}
            {until ? ` até ${formatDate(until)} (início da versão mais antiga)` : ""}. Os valores calculados desses
            lançamentos passam a usar estes parâmetros. Competências já fechadas na DRE não podem ser alcançadas.
          </p>
        ) : null}
        <FormField label="Justificativa">
          <Input value={reason} minLength={5} onChange={(event) => setReason(event.target.value)} required />
        </FormField>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold">Impostos e comissões (%)</legend>
        {text("income_tax_pct", "IR sobre faturamento")}
        {text("tag_tax_pct", "Impostos sobre placas")}
        {text("partner_commission_pct", "Comissão do sócio", "Sobre o resultado operacional.")}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">Origens comerciais e comissão (%)</legend>
        {values.commercial_origins.map((origin, index) => (
          <div key={index} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
            <FormField label={index === 0 ? "Origem" : ""}>
              <Input
                aria-label={`Origem ${index + 1}`}
                value={origin.label}
                onChange={(event) => {
                  const next = [...values.commercial_origins];
                  const isNew = !initial.commercial_origins.some((o) => o.code === origin.code);
                  next[index] = {
                    ...origin,
                    label: event.target.value,
                    code: isNew ? slug(event.target.value) : origin.code,
                  };
                  set("commercial_origins", next);
                }}
              />
            </FormField>
            <FormField label={index === 0 ? "Comissão" : ""}>
              <Input
                aria-label={`Comissão de ${origin.label || `origem ${index + 1}`}`}
                inputMode="decimal"
                value={origin.commission_pct}
                onChange={(event) => {
                  const next = [...values.commercial_origins];
                  next[index] = { ...origin, commission_pct: event.target.value.replace(",", ".") };
                  set("commercial_origins", next);
                }}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remover origem ${origin.label}`}
              disabled={values.commercial_origins.length === 1}
              onClick={() =>
                set("commercial_origins", values.commercial_origins.filter((_, i) => i !== index))
              }
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              set("commercial_origins", [
                ...values.commercial_origins,
                { code: "", label: "", commission_pct: "0" },
              ])
            }
          >
            <Plus size={16} /> Adicionar origem
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O código de cada origem é fixo depois de criado: contratos antigos continuam apontando para ele.
        </p>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold">Remuneração e orçado</legend>
        {text("default_daily_rate", "Diária padrão do inventariante (R$)", "Diária paga ao técnico; pode diferir da diária usada no preço do orçamento.")}
        {integer("budget_productivity_items_per_day", "Produtividade para orçar (itens/dia)")}
        {text("budgeted_non_reimbursable_expense_pct", "Despesas não reembolsáveis orçadas (%)")}
        {text("technician_expense_alert_pct", "Alerta de despesas de técnicos (%)")}
        <FormField label="Exigir aprovação de diárias e despesas">
          <select
            className="h-11 rounded-md border bg-background px-3 text-sm"
            value={values.require_approval ? "yes" : "no"}
            onChange={(event) => set("require_approval", event.target.value === "yes")}
          >
            <option value="yes">Sim (pendente → aprovado → pago)</option>
            <option value="no">Não</option>
          </select>
        </FormField>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold">Custos fixos e indicadores</legend>
        {text("fixed_cost_operation", "Custo fixo da operação (R$)")}
        {text("fixed_cost_branch", "Custo fixo da filial (R$)")}
        {text("economic_break_even_margin_pct", "Margem do PE econômico (%)")}
        {mode("additional_income_tax", "Adicional de IR")}
        {mode("equipment", "Equipamentos")}
        {mode("back_office", "Back-office")}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold">Recebíveis e DRE</legend>
        {integer("first_installment_days_after_contract", "Prazo da 1ª parcela (dias após o contrato)")}
        <FormField label="Mês de corte do regime da DRE" hint="A partir deste mês a DRE é alimentada pelo fluxo de caixa. Não pode ser antes do início dos parâmetros da organização.">
          <Input
            type="month"
            value={values.dre_regime_cutoff_month}
            onChange={(event) => {
              setCutoffTouched(true);
              set("dre_regime_cutoff_month", event.target.value);
            }}
          />
        </FormField>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold">Listas</legend>
        {list("expense_reasons", "Motivos de despesa")}
        {list("tag_models", "Modelos de placa")}
        <FormField label="Fornecedor padrão de placas">
          <Input
            value={values.default_tag_supplier}
            onChange={(event) => set("default_tag_supplier", event.target.value)}
          />
        </FormField>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold">Anexos</legend>
        {megabytes("field_agent_document_max_bytes", "Documento do inventariante (MB por arquivo)")}
        {megabytes("expense_attachment_max_bytes", "Anexo de despesa (MB por arquivo)")}
        {integer("expense_attachment_max_files", "Anexos por despesa")}
      </fieldset>
      {save.isError ? (
        <p role="alert" className="rounded-lg border p-3 text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending}>
          Salvar versão
        </Button>
      </div>
    </form>
  );
}

export function FinanceSettingsPage() {
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("finance-settings:update");
  const [draft, setDraft] = useState<FinanceSettingsValues | null>(null);
  const [params, setParams] = useSearchParams();
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(params.get("valid_from") ?? "") ? params.get("valid_from")! : undefined;
  const [startDate, setStartDate] = useState<string | undefined>(requested);
  const query = useQuery({ queryKey: financeSettingsKeys.all, queryFn: financeSettingsApi.overview });
  const defaults = useMutation({ mutationFn: financeSettingsApi.defaults, onSuccess: setDraft });
  const loaded = query.data;
  // Link dos avisos "sem parâmetro vigente": abre o formulário já com a data retroativa.
  useEffect(() => {
    if (!requested || !canUpdate || !loaded || draft) return;
    const base = loaded.scheduled ?? loaded.current;
    if (base) setDraft(base.values);
    else if (!defaults.isPending) defaults.mutate();
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, canUpdate, loaded]);
  const openRetroactive = (date: string) => {
    setStartDate(date);
    const base = loaded?.scheduled ?? loaded?.current;
    if (base) setDraft(base.values);
    else defaults.mutate();
  };

  if (query.isPending) return <LoadingState label="Carregando parâmetros financeiros" />;
  if (query.isError)
    return <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  const overview = query.data;
  const base = overview.scheduled ?? overview.current;
  const uncovered = uncoveredSince(overview);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-end gap-3">
        {canUpdate && !draft && base ? (
          <Button type="button" onClick={() => setDraft(base.values)}>
            Nova versão
          </Button>
        ) : null}
      </div>

      {draft ? (
        <VersionForm overview={overview} initial={draft} startDate={startDate} onCancel={() => { setDraft(null); setStartDate(undefined); }} />
      ) : null}

      {uncovered && overview.versions.length && !draft ? (
        <section className="grid gap-2 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm" role="status">
          <p>
            Há lançamentos financeiros desde <strong>{formatDate(uncovered)}</strong> sem parâmetro vigente: a versão mais
            antiga só vale a partir de {formatDate(overview.coverage_start!)}. Os cálculos que dependem de parâmetros
            (impostos de placas, IR, diária padrão…) ficam em branco nesses lançamentos; o sistema não usa valor de reserva.
          </p>
          {canUpdate ? (
            <div>
              <Button type="button" onClick={() => openRetroactive(uncovered)}>
                Publicar versão retroativa desde {formatDate(uncovered)}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!overview.versions.length && !draft ? (
        <section className="premium-panel grid gap-3 p-5" role="status">
          <h2 className="font-semibold">A organização ainda não tem parâmetros financeiros.</h2>
          {canUpdate ? (
            <>
              <p className="text-sm text-muted-foreground">
                Crie a primeira versão a partir dos valores padrão e ajuste o que for preciso antes de salvar.
              </p>
              <div>
                <Button type="button" loading={defaults.isPending} onClick={() => { setStartDate(uncovered ?? undefined); defaults.mutate(); }}>
                  Criar com valores padrão
                </Button>
                {uncovered ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sugestão de vigência: {formatDate(uncovered)}, data do lançamento financeiro mais antigo da organização.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Peça a um administrador com a permissão de alterar parâmetros financeiros.
            </p>
          )}
        </section>
      ) : null}

      {overview.scheduled ? (
        <VersionSummary version={overview.scheduled} title="Versão agendada" />
      ) : null}
      {overview.current ? (
        <VersionSummary version={overview.current} title="Versão vigente" />
      ) : null}

      {overview.versions.length ? (
        <section className="premium-panel p-5" aria-label="Histórico de versões">
          <h2 className="mb-3 text-lg font-semibold">Histórico de versões</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Versão</th>
                  <th className="py-2 pr-4 font-medium">Vale a partir de</th>
                  <th className="py-2 pr-4 font-medium">Justificativa</th>
                  <th className="py-2 pr-4 font-medium">Registrada por</th>
                  <th className="py-2 font-medium">Em</th>
                </tr>
              </thead>
              <tbody>
                {overview.versions.map((version) => (
                  <tr key={version.id} className="border-t border-border/60">
                    <td className="py-2 pr-4">{version.version}</td>
                    <td className="py-2 pr-4">{formatDate(version.valid_from)}</td>
                    <td className="py-2 pr-4">{version.reason}</td>
                    <td className="py-2 pr-4">{version.actor_name ?? "Sistema (valores padrão)"}</td>
                    <td className="py-2">{formatDateTime(version.recorded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
