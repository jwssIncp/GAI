import { EntityCombobox } from "@/components/base/EntityCombobox";
import { amendmentSource, approvedBudgetSource, companySource, contractSource, organizationSource, projectSource } from "@/components/base/entitySources";
import { formatCivilDate, parseCivilDate } from "@/utils/format";
import { navigationHref } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/base/DataTable";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import {
  cls,
  financeApi,
  money,
  today,
  type Preview,
  type ReceivableInput,
} from "./financeApi";
export function ReceivableForm() {
  const navigate = useNavigate(),
    cache = useQueryClient(),
    [params] = useSearchParams(),
    { user } = useAuth(),
    { hasPermission, isPlatformAdmin } = usePermissions();
  const [origin, setOrigin] = useState(params.get("origin") ?? "manual"),
    [sourceId, setSourceId] = useState(params.get("source_id") ?? ""),
    [source, setSource] = useState<Partial<ReceivableInput>>(),
    [mode, setMode] = useState("equal"),
    [preview, setPreview] = useState<Preview>(),
    [submitted, setSubmitted] = useState<ReceivableInput>(),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const urlId = (k: string) => (Number(params.get(k)) > 0 ? Number(params.get(k)) : null);
  // Origem por nome: projeto → contrato → aditivo (ou orçamento aprovado).
  const [originProject, setOriginProject] = useState<number | null>(urlId("project_id"));
  const [originContract, setOriginContract] = useState<number | null>(origin === "contract" ? urlId("source_id") : null);
  // Contexto dos campos de cliente e projeto (o valor vai no FormData pelo campo oculto).
  const [orgId, setOrgId] = useState<number | null>(user?.organization_id ?? null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const pickSource = (id: number | null) => {
    setSourceId(id ? String(id) : "");
    setSource(undefined);
    setPreview(undefined);
  };
  const field = (
    name: string,
    label: string,
    type = "text",
    value?: string | number,
    required = true,
  ) => (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        name={name}
        className={cls}
        type={type}
        required={required}
        min={type === "number" ? (name === "count" ? 0 : 1) : undefined}
        step={type === "number" ? 1 : undefined}
        value={values[name] ?? String(value ?? "")}
        onChange={(e) => {
          const next = e.currentTarget.value;
          setValues((current) => ({ ...current, [name]: next }));
        }}
      />
    </label>
  );
  return (
    <form
      onChange={() => setPreview(undefined)}
      className="premium-panel grid gap-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          const f = new FormData(e.currentTarget),
            v = (k: string) => String(f.get(k) ?? "").trim(),
            list = (k: string) =>
              v(k)
                .split(/[\n,;]+/)
                .map((s) => s.trim())
                .filter(Boolean);
          const dto: ReceivableInput = {
            ...(isPlatformAdmin
              ? { organization_id: Number(v("organization_id")) }
              : {}),
            company_id: Number(v("company_id")),
            ...(v("project_id") ? { project_id: Number(v("project_id")) } : {}),
            origin,
            ...(origin !== "manual" ? { source_id: Number(sourceId) } : {}),
            description: v("description"),
            amount: v("amount"),
            currency: v("currency"),
            issued_on: v("issued_on"),
            document: v("document"),
            notes: v("notes"),
            reason: v("reason"),
            payment:
              origin === "budget" && source?.payment
                ? source.payment
                : {
                    mode,
                    count: Number(v("count")),
                    first_due_on: v("first_due_on"),
                    ...(v("entry_amount")
                      ? {
                          entry_amount: v("entry_amount"),
                          entry_due_on: v("entry_due_on") || v("first_due_on"),
                        }
                      : {}),
                    ...(mode === "amounts" ? { amounts: list("amounts") } : {}),
                    ...(mode === "percentages"
                      ? { percentages: list("percentages") }
                      : {}),
                    ...(v("dates") ? { dates: list("dates").map(parseCivilDate) } : {}),
                  },
          };
          setPreview(await financeApi.preview(dto));
          setSubmitted(dto);
          setKey(crypto.randomUUID());
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">Novo recebível</h2>
      <p className="text-sm text-muted-foreground">
        A prévia não cria obrigação. Confira valores e vencimentos antes de
        confirmar.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Origem
          <select
            className={cls}
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              setSource(undefined);
              setSourceId("");
              setOriginContract(null);
              setValues({});
            }}
          >
            <option value="manual">Manual</option>
            {hasPermission("contracts:read") && (
              <>
                <option value="contract">Contrato — valor original</option>
                <option value="amendment">Aditivo positivo</option>
              </>
            )}
            {hasPermission("budgets:read") && (
              <option value="budget">Orçamento aprovado</option>
            )}
          </select>
        </label>
        {origin !== "manual" && (
          <>
            {origin === "budget" ? (
              <label className="grid gap-1 text-sm">
                Orçamento aprovado
                <EntityCombobox
                  aria-label="Orçamento aprovado"
                  source={approvedBudgetSource}
                  value={sourceId ? Number(sourceId) : null}
                  onChange={pickSource}
                  required
                />
              </label>
            ) : (
              <>
                <label className="grid gap-1 text-sm">
                  Projeto da origem
                  <EntityCombobox
                    aria-label="Projeto da origem"
                    source={projectSource}
                    value={originProject}
                    onChange={(id) => {
                      setOriginProject(id);
                      setOriginContract(null);
                      pickSource(null);
                    }}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Contrato
                  <EntityCombobox
                    aria-label="Contrato"
                    source={contractSource}
                    context={{ project_id: originProject }}
                    requiresContext="Escolha o projeto primeiro"
                    value={originContract}
                    onChange={(id) => {
                      setOriginContract(id);
                      pickSource(origin === "contract" ? id : null);
                    }}
                    required
                  />
                </label>
                {origin === "amendment" ? (
                  <label className="grid gap-1 text-sm">
                    Aditivo
                    <EntityCombobox
                      aria-label="Aditivo"
                      source={amendmentSource}
                      context={{ project_id: originProject, contract_id: originContract }}
                      requiresContext="Escolha o contrato primeiro"
                      value={sourceId ? Number(sourceId) : null}
                      onChange={pickSource}
                      required
                    />
                  </label>
                ) : null}
              </>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !sourceId}
              onClick={async () => {
                setError("");
                try {
                  const s = await financeApi.source(origin, sourceId);
                  setSource(s);
                  setValues({});
                  setPreview(undefined);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Carregar origem
            </Button>
          </>
        )}
      </div>
      <div
        key={JSON.stringify(source)}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {isPlatformAdmin ? (
          <label className="grid gap-1 text-sm">
            Organização
            <EntityCombobox
              aria-label="Organização"
              name="organization_id"
              source={organizationSource}
              defaultValue={source?.organization_id ?? user?.organization_id ?? null}
              onChange={(id) => {
                setOrgId(id);
                setPreview(undefined);
              }}
              required
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">
          Cliente
          <EntityCombobox
            aria-label="Cliente"
            name="company_id"
            source={companySource}
            context={{ organization_id: isPlatformAdmin ? orgId : null }}
            defaultValue={source?.company_id ?? null}
            onChange={(id) => {
              setCompanyId(id);
              setPreview(undefined);
            }}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Projeto (opcional)
          <EntityCombobox
            aria-label="Projeto"
            name="project_id"
            source={projectSource}
            context={{ company_id: companyId ?? source?.company_id ?? null }}
            defaultValue={source?.project_id ?? urlId("project_id")}
            onChange={() => setPreview(undefined)}
          />
        </label>
        {field("description", "Descrição", "text", source?.description)}
        {field("amount", "Valor total (decimal)", "text", source?.amount)}
        <label className="grid gap-1 text-sm">
          Moeda
          <select
            name="currency"
            className={cls}
            defaultValue={source?.currency ?? "BRL"}
          >
            {["BRL", "USD", "EUR"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {field("issued_on", "Emissão", "date", source?.issued_on ?? today())}
        {field("document", "Documento de referência", "text", "", false)}
      </div>
      {origin === "budget" && source?.payment ? (
        <p className="text-sm">
          As parcelas seguem a versão aprovada do orçamento. A prévia abaixo
          mostrará cada vencimento.
        </p>
      ) : (
        <fieldset className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
          <legend className="px-2 font-semibold">Condições de pagamento</legend>
          <label className="grid gap-1 text-sm">
            Distribuição
            <select
              className={cls}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="equal">Mensal, valores iguais</option>
              <option value="amounts">Valores personalizados</option>
              <option value="percentages">Percentuais personalizados</option>
            </select>
          </label>
          {field("count", "Quantidade de parcelas do saldo", "number", 1)}
          {field("first_due_on", "Primeiro vencimento", "date", today())}
          {field("entry_amount", "Entrada (valor opcional)", "text", "", false)}
          {field("entry_due_on", "Vencimento da entrada", "date", "", false)}
          {mode !== "equal" && (
            <label className="grid gap-1 text-sm">
              {mode === "amounts" ? "Valores" : "Percentuais"} das parcelas
              <textarea
                className={cls}
                name={mode}
                required
                placeholder="Um por linha"
              />
            </label>
          )}
          <label className="grid gap-1 text-sm">
            Vencimentos personalizados (opcional)
            <textarea
              className={cls}
              name="dates"
              placeholder="dd/mm/aaaa, uma por linha"
            />
          </label>
        </fieldset>
      )}
      <label className="grid gap-1 text-sm">
        Justificativa
        <input className={cls} name="reason" required minLength={5} />
      </label>
      <label className="grid gap-1 text-sm">
        Observações
        <textarea className={cls} name="notes" />
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button
          disabled={busy || (origin !== "manual" && !source)}
          type="submit"
        >
          Gerar prévia de parcelas
        </Button>
      </div>
      {preview && submitted && (
        <section className="grid gap-4 border-t pt-4">
          <h3 className="font-semibold">
            Confira a obrigação e confirme a criação
          </h3>
          <p>
            {submitted.description} —{" "}
            {money(preview.data.amount, preview.data.currency)}
          </p>
          <DataTable
            items={preview.plan.rows}
            getKey={(i) => i.position}
            columns={[
              { header: "Parcela", cell: (i) => i.position },
              { header: "Vencimento", cell: (i) => formatCivilDate(i.due_on) },
              {
                header: "Valor",
                cell: (i) => money(i.amount, preview.data.currency),
              },
            ]}
          />
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await financeApi.create(
                  submitted,
                  preview.preview_hash,
                  key,
                );
                await cache.invalidateQueries({ queryKey: ["finance"] });
                navigate(navigationHref("/app/finance/receivables/" + r.id, params));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar criação do recebível
          </Button>
        </section>
      )}
    </form>
  );
}
