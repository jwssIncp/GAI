import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { companiesApi, projectsApi, usersApi } from "@/api/endpoints";
import { normalizePage } from "@/api/pagination";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import {
  CompanySelect,
  CompanyUnitSelect,
  OrganizationSelect,
} from "@/features/projects/ProjectSelectors";
import { BudgetMemory } from "./BudgetMemory";
import {
  budgetApi,
  type BudgetInput,
  type Snapshot,
  type Version,
} from "./budgetApi";
const cls = "w-full rounded-lg border bg-background p-2 text-sm";
export function BudgetForm({
  initial,
  mode = "create",
  onSave,
}: {
  initial?: Version;
  mode?: "create" | "edit" | "scenario";
  onSave: (data: BudgetInput, name: string, reason: string) => Promise<unknown>;
}) {
  const { user } = useAuth(),
    { hasPermission, isPlatformAdmin } = usePermissions();
  const d = initial?.snapshot.input;
  const [org, setOrg] = useState(
    String(d?.organization_id ?? user?.organization_id ?? ""),
  );
  const [company, setCompany] = useState(String(d?.company_id ?? "")),
    [projectSearch, setProjectSearch] = useState(""),
    [projectPage, setProjectPage] = useState(1);
  const [project, setProject] = useState(String(d?.project_id ?? "")),
    [units, setUnits] = useState(d?.unit_ids ?? []),
    [unitPick, setUnitPick] = useState("");
  const [paymentMode, setPaymentMode] = useState(d?.payment.mode ?? "equal"),
    [entryMode, setEntryMode] = useState(
      d?.payment.entry_amount != null ? "amount" : "percent",
    );
  const [preview, setPreview] = useState<Snapshot>(),
    [error, setError] = useState("");
  const prices = useQuery({
    queryKey: ["budget-pricing", user?.id, user?.organization_id],
    queryFn: budgetApi.pricing,
  });
  const projects = useQuery({
    queryKey: ["budget-project-options", org, projectSearch, projectPage],
    queryFn: () =>
      projectsApi.list({
        organization_id: Number(org),
        search: projectSearch || undefined,
        page: projectPage,
        page_size: 20,
      }),
    enabled: !!org && hasPermission("projects:read"),
  });
  const people = useQuery({
    queryKey: ["budget-responsibles", org],
    queryFn: () =>
      usersApi.list({ organization_id: Number(org), page: 1, page_size: 100 }),
    enabled: !!org && hasPermission("users:read"),
  });
  const chosenCompany = useQuery({
    queryKey: ["budget-company", company],
    queryFn: () => companiesApi.get(Number(company)),
    enabled: !!company && hasPermission("companies:read"),
  });
  function payload(form: HTMLFormElement) {
    const f = new FormData(form),
      text = (k: string) => String(f.get(k) ?? "").trim();
    const sizing: BudgetInput["sizing"] = {};
    for (const k of ["available_days", "team", "productivity"] as const)
      if (text(k)) sizing[k] = Number(text(k));
    for (const k of [
      "margin_pct",
      "operational_extra",
      "final_price",
      "adjustment_reason",
    ] as const)
      if (text(k)) sizing[k] = text(k);
    const p: BudgetInput["payment"] = {
      mode: paymentMode,
      count: Number(text("count")),
      first_due_on: text("first_due_on"),
      ...(text("entry_due_on") ? { entry_due_on: text("entry_due_on") } : {}),
    };
    if (entryMode === "amount") {
      if (text("entry_amount")) p.entry_amount = text("entry_amount");
    } else if (text("entry_percent")) p.entry_percent = text("entry_percent");
    const split = (k: string) =>
      text(k)
        .split(/[;\n]+/)
        .map((v) => v.trim())
        .filter(Boolean);
    if (paymentMode === "percentages") p.percentages = split("percentages");
    if (paymentMode === "amounts") p.amounts = split("amounts");
    if (text("dates")) p.dates = split("dates");
    const dto: BudgetInput = {
      organization_id: Number(org),
      company_id: Number(company),
      project_id: project ? Number(project) : null,
      number: text("number"),
      prepared_on: text("prepared_on"),
      valid_until: text("valid_until"),
      segment: text("segment") || null,
      services: split("services"),
      estimated_assets: Number(text("estimated_assets")),
      unit_ids: units,
      addresses: split("addresses"),
      scope: text("scope"),
      notes: text("notes") || null,
      operational_constraints: text("operational_constraints") || null,
      responsible_id: Number(text("responsible_id")),
      pricing_id: Number(text("pricing_id")),
      sizing,
      payment: p,
    };
    return { dto, name: text("version_name"), reason: text("reason") };
  }
  const save = useMutation({
    mutationFn: async ({
      form,
      simulate,
    }: {
      form: HTMLFormElement;
      simulate: boolean;
    }) => {
      const input = payload(form);
      if (simulate) {
        const value = await budgetApi.simulate(input.dto);
        setPreview(value);
        return;
      }
      await onSave(input.dto, input.name, input.reason);
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    save.mutate({ form: e.currentTarget, simulate: false });
  }
  const projectItems = projects.data
    ? normalizePage(projects.data).items.filter(
        (p) => p.company_id === Number(company),
      )
    : [];
  const userItems = people.data
    ? normalizePage(people.data).items.filter((p) => p.status === "ACTIVE")
    : [];
  return (
    <form
      className="grid gap-4"
      onSubmit={submit}
      onChange={() => setPreview(undefined)}
    >
      <p className="text-sm text-muted-foreground">
        Organização e vínculos são validados no servidor. Campos monetários usam
        ponto decimal. O cálculo oficial é sempre feito pelo backend.
      </p>
      {isPlatformAdmin && !initial ? (
        <OrganizationSelect
          value={org}
          onChange={(v) => {
            setOrg(v);
            setCompany("");
            setUnits([]);
            setProject("");
          }}
          required
        />
      ) : (
        <p className="text-sm">Organização #{org || "não definida"}</p>
      )}
      {!initial && hasPermission("companies:read") ? (
        <CompanySelect
          organizationId={Number(org)}
          value={company}
          onChange={(v) => {
            setCompany(v);
            setProject("");
            setUnits([]);
          }}
          required
        />
      ) : (
        <p className="text-sm">
          Empresa:{" "}
          {initial?.snapshot.context.company.name ??
            chosenCompany.data?.name ??
            "Selecione uma empresa com permissão companies:read"}
        </p>
      )}
      <label className="grid gap-1 text-sm">
        Número do orçamento
        <input
          className={cls}
          name="number"
          required
          maxLength={100}
          defaultValue={d?.number}
          readOnly={!!initial}
        />
      </label>
      {!initial && hasPermission("projects:read") ? (
        <fieldset className="grid gap-2 rounded border p-3">
          <legend className="px-1 text-sm">Projeto opcional</legend>
          <input
            aria-label="Buscar projeto vinculado"
            className={cls}
            value={projectSearch}
            onChange={(e) => {
              setProjectSearch(e.target.value);
              setProjectPage(1);
            }}
            placeholder="Buscar nome de projeto"
          />
          <select
            aria-label="Projeto vinculado"
            className={cls}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">Orçamento anterior ao projeto</option>
            {projectItems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={projectPage <= 1}
              onClick={() => setProjectPage((v) => v - 1)}
            >
              Projetos anteriores
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                !projects.data ||
                projectPage >= normalizePage(projects.data).totalPages
              }
              onClick={() => setProjectPage((v) => v + 1)}
            >
              Mais projetos
            </Button>
          </div>
        </fieldset>
      ) : (
        <p className="text-sm">
          Projeto: {initial?.snapshot.context.project?.name ?? "Sem vínculo"}
        </p>
      )}
      <label className="grid gap-1 text-sm">
        Data de elaboração
        <input
          className={cls}
          name="prepared_on"
          type="date"
          required
          defaultValue={d?.prepared_on ?? new Date().toISOString().slice(0, 10)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Validade da proposta
        <input
          className={cls}
          name="valid_until"
          type="date"
          required
          defaultValue={d?.valid_until}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Segmento
        <input
          className={cls}
          name="segment"
          maxLength={120}
          defaultValue={d?.segment ?? ""}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Serviços (separados por ponto e vírgula)
        <input
          className={cls}
          name="services"
          defaultValue={d?.services.join("; ")}
          maxLength={6000}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Quantidade estimada de bens
        <input
          className={cls}
          name="estimated_assets"
          type="number"
          min="0"
          max="1000000000"
          required
          defaultValue={d?.estimated_assets}
        />
      </label>
      {company && hasPermission("company-units:read") ? (
        <fieldset className="grid gap-2 rounded border p-3">
          <legend className="px-1 text-sm">Unidades da empresa</legend>
          <CompanyUnitSelect
            companyId={Number(company)}
            value={unitPick}
            excludedIds={units}
            onChange={(value) => {
              setUnitPick("");
              if (value) setUnits((v) => [...v, Number(value)]);
            }}
          />
          {units.map((id) => (
            <div key={id} className="flex items-center justify-between text-sm">
              <span>
                {initial?.snapshot.context.units.find((u) => u.id === id)
                  ?.name ?? `Unidade #${id}`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreview(undefined);
                  setUnits((v) => v.filter((x) => x !== id));
                }}
              >
                Remover unidade #{id}
              </Button>
            </div>
          ))}
        </fieldset>
      ) : null}
      <label className="grid gap-1 text-sm">
        Endereços adicionais (um por linha)
        <textarea
          className={cls}
          name="addresses"
          maxLength={50000}
          defaultValue={d?.addresses.join("\n")}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Escopo
        <textarea
          className={cls}
          name="scope"
          required
          minLength={3}
          maxLength={10000}
          defaultValue={d?.scope}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Restrições operacionais
        <textarea
          className={cls}
          name="operational_constraints"
          maxLength={4000}
          defaultValue={d?.operational_constraints ?? ""}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Restrições são registradas para avaliação humana; os dias disponíveis e
        os ajustes abaixo devem refletir os efeitos aprovados.
      </p>
      <label className="grid gap-1 text-sm">
        Observações
        <textarea
          className={cls}
          name="notes"
          maxLength={10000}
          defaultValue={d?.notes ?? ""}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Responsável
        <select
          aria-label="Responsável"
          className={cls}
          name="responsible_id"
          defaultValue={d?.responsible_id ?? user?.id}
          required
        >
          <option value={d?.responsible_id ?? user?.id}>
            {initial?.snapshot.context.responsible.login ??
              user?.login ??
              "Usuário autenticado"}
          </option>
          {userItems
            .filter((u) => u.id !== (d?.responsible_id ?? user?.id))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.login}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Parâmetros de preços
        <select
          aria-label="Parâmetros de preços"
          className={cls}
          name="pricing_id"
          defaultValue={d?.pricing_id ?? ""}
          required
        >
          <option value="">Selecione uma versão publicada</option>
          {prices.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · v{p.version} · {p.validFrom} a {p.validTo}
            </option>
          ))}
        </select>
      </label>
      {prices.isError ? (
        <p role="alert">Não foi possível consultar os parâmetros.</p>
      ) : !prices.isPending && !prices.data?.length ? (
        <p className="text-sm">
          Publique parâmetros aprovados antes de elaborar o orçamento.
        </p>
      ) : null}
      {hasPermission("budgets:configure-prices") ? (
        <fieldset className="grid gap-3 rounded border p-3">
          <legend className="px-1 text-sm">
            Ajustes manuais autorizados (opcionais)
          </legend>
          {(
            [
              ["available_days", "Dias disponíveis ajustados", 3650],
              ["team", "Equipe ajustada", 500],
              ["productivity", "Produtividade ajustada", 1000000],
            ] as const
          ).map(([key, label, max]) => (
            <label key={key} className="grid gap-1 text-sm">
              {label}
              <input
                className={cls}
                name={key}
                type="number"
                min="1"
                max={max}
                defaultValue={d?.sizing[key]}
              />
            </label>
          ))}
          {(
            [
              ["margin_pct", "Margem ajustada (%)"],
              ["operational_extra", "Acréscimo operacional"],
              ["final_price", "Preço final manual"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm">
              {label}
              <input
                className={cls}
                name={key}
                inputMode="decimal"
                pattern="[0-9]{1,13}(\.[0-9]{1,2})?"
                defaultValue={d?.sizing[key]}
              />
            </label>
          ))}
          <label className="grid gap-1 text-sm">
            Justificativa dos ajustes
            <textarea
              className={cls}
              name="adjustment_reason"
              minLength={5}
              maxLength={2000}
              defaultValue={d?.sizing.adjustment_reason}
            />
          </label>
        </fieldset>
      ) : null}
      <fieldset className="grid gap-3 rounded border p-3">
        <legend className="px-1 text-sm">Condições de pagamento</legend>
        <label className="grid gap-1 text-sm">
          Modo de parcelamento
          <select
            aria-label="Modo de parcelamento"
            className={cls}
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
          >
            <option value="equal">
              Parcelas iguais com ajuste de centavos na última
            </option>
            <option value="percentages">Percentuais personalizados</option>
            <option value="amounts">Valores personalizados</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Tipo de entrada
          <select
            aria-label="Tipo de entrada"
            className={cls}
            value={entryMode}
            onChange={(e) => setEntryMode(e.target.value)}
          >
            <option value="percent">Percentual</option>
            <option value="amount">Valor</option>
          </select>
        </label>
        {entryMode === "percent" ? (
          <label className="grid gap-1 text-sm">
            Entrada (%)
            <input
              className={cls}
              name="entry_percent"
              inputMode="decimal"
              defaultValue={d?.payment.entry_percent ?? ""}
            />
          </label>
        ) : (
          <label className="grid gap-1 text-sm">
            Valor da entrada
            <input
              className={cls}
              name="entry_amount"
              inputMode="decimal"
              defaultValue={d?.payment.entry_amount ?? ""}
            />
          </label>
        )}
        <label className="grid gap-1 text-sm">
          Data da entrada
          <input
            className={cls}
            name="entry_due_on"
            type="date"
            defaultValue={d?.payment.entry_due_on}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Quantidade de parcelas (sem entrada)
          <input
            className={cls}
            name="count"
            type="number"
            required
            min="0"
            max="60"
            defaultValue={d?.payment.count ?? 1}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Primeiro vencimento
          <input
            className={cls}
            name="first_due_on"
            type="date"
            required
            defaultValue={d?.payment.first_due_on}
          />
        </label>
        {paymentMode === "percentages" ? (
          <label className="grid gap-1 text-sm">
            Percentuais das parcelas (separados por ponto e vírgula)
            <input
              className={cls}
              name="percentages"
              defaultValue={d?.payment.percentages?.join("; ")}
              required
            />
          </label>
        ) : paymentMode === "amounts" ? (
          <label className="grid gap-1 text-sm">
            Valores das parcelas (separados por ponto e vírgula)
            <input
              className={cls}
              name="amounts"
              defaultValue={d?.payment.amounts?.join("; ")}
              required
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">
          Datas personalizadas (opcional, uma por parcela; AAAA-MM-DD)
          <textarea
            className={cls}
            name="dates"
            defaultValue={d?.payment.dates?.join("\n")}
          />
        </label>
      </fieldset>
      {mode !== "create" ? (
        <>
          <label className="grid gap-1 text-sm">
            Nome da versão ou cenário
            <input
              className={cls}
              name="version_name"
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Justificativa da versão
            <textarea
              className={cls}
              name="reason"
              minLength={5}
              maxLength={2000}
              required
            />
          </label>
        </>
      ) : null}
      {error || save.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {error || save.error?.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending}
          onClick={(e) => {
            const form = e.currentTarget.form!;
            if (form.reportValidity()) save.mutate({ form, simulate: true });
          }}
        >
          Calcular prévia
        </Button>
        <Button
          type="submit"
          loading={save.isPending}
          disabled={save.isPending || !company || !org}
        >
          {mode === "scenario" ? "Salvar cenário" : "Salvar orçamento"}
        </Button>
      </div>
      {preview ? <BudgetMemory snapshot={preview} /> : null}
    </form>
  );
}
