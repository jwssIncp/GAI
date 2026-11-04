import { navigationHref } from "@/features/projects/navigationContext";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { projectsApi } from "@/api/endpoints";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { usePermissions } from "@/features/auth/usePermissions";
import {
  contractsApi,
  contractDate,
  contractMoney,
  contractStatuses,
  type Contract,
  type ContractData,
  type ContractDetail,
} from "./contractsApi";
const inputClass = "w-full rounded-lg border bg-background p-2 text-sm";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      {children}
    </label>
  );
}
export function ProjectContractsPage() {
  const { projectId } = useParams();
  return <ContractsWorkspace key={projectId} p={Number(projectId)} />;
}
function ContractsWorkspace({ p }: { p: number }) {
  const { hasPermission } = usePermissions(),
    cache = useQueryClient();
  const [params, setParams] = useSearchParams(),
    selected = Number(params.get("contract")) || null;
  const [modal, setModal] = useState<
    "create" | "edit" | "amend" | "archive" | null
  >(null);
  const project = useQuery({
    queryKey: ["projects", p],
    queryFn: () => projectsApi.get(p),
  });
  const rows = useQuery({
    queryKey: ["contracts", p],
    queryFn: () => contractsApi.list(p),
  });
  const detail = useQuery({
    queryKey: ["contracts", p, selected],
    queryFn: () => contractsApi.get(p, selected!),
    enabled: !!selected,
  });
  const save = useMutation({
    mutationFn: async (values: FormData) => {
      const text = (key: string) => String(values.get(key) ?? "").trim();
      const nullable = (key: string) => text(key) || null;
      const row = detail.data;
      if (modal === "archive")
        return contractsApi.archive(p, row!.id, {
          revision: row!.revision,
          reason: text("reason"),
        });
      if (modal === "amend")
        return contractsApi.amend(p, row!.id, {
          revision: row!.revision,
          reason: text("reason"),
          identifier: text("identifier"),
          dated_on: text("dated_on"),
          type: text("type"),
          value_delta: nullable("value_delta"),
          ends_on: nullable("amend_ends_on"),
          scope: nullable("amend_scope"),
        });
      const data: ContractData = {
        number: text("number"),
        company_id: project.data!.company_id!,
        contracted_on: nullable("contracted_on"),
        starts_on: nullable("starts_on"),
        ends_on: nullable("ends_on"),
        original_value: nullable("original_value"),
        currency: text("currency"),
        contracting_type: nullable("contracting_type"),
        segment: nullable("segment"),
        commercial_origin: nullable("commercial_origin"),
        recurring:
          text("recurring") === "" ? null : text("recurring") === "true",
        services: text("services")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
        estimated_assets:
          text("estimated_assets") === ""
            ? null
            : Number(text("estimated_assets")),
        scope: nullable("scope"),
        commercial_terms: nullable("commercial_terms"),
        status: text("status"),
      };
      const result =
        modal === "create"
          ? await contractsApi.create(p, data)
          : await contractsApi.edit(p, row!.id, {
              ...data,
              revision: row!.revision,
              reason: text("reason"),
            });
      setParams({ ...Object.fromEntries(params), contract: String(result.id) });
      return result;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["contracts", p] });
      await cache.invalidateQueries({ queryKey: ["organization-overview"] });
      await cache.invalidateQueries({ queryKey: ["commercial-overview"] });
      setModal(null);
    },
  });
  const row = detail.data,
    writeProject =
      project.data &&
      ["draft", "active", "paused"].includes(project.data.status);
  const open = (value: typeof modal) => {
    save.reset();
    setModal(value);
  };
  return (
    <PageContainer>
      {hasPermission('receivables:read')&&<Link className="text-primary text-sm" to={navigationHref(`/app/finance/receivables?project_id=${p}${selected?'&contract_id='+selected:''}`, params)}>Consultar recebíveis do projeto/contrato</Link>}
      {selected&&hasPermission('receivables:edit')&&hasPermission('receivables:read')&&<Link className="text-primary text-sm" to={navigationHref(`/app/finance/receivables/new?origin=contract&source_id=${selected}&project_id=${p}`, params)}>Preparar recebível deste contrato</Link>}
      <PageHeader
        title="Contratos"
        description={`${project.data?.name ?? "Projeto"} · gestão contratual e histórico de aditivos.`}
      />
      {project.isPending || rows.isPending ? (
        <LoadingState />
      ) : project.isError || rows.isError ? (
        <ErrorState />
      ) : (
        <>
          {hasPermission("contracts:edit") && writeProject ? (
            <Button onClick={() => open("create")}>Novo contrato</Button>
          ) : null}
          <DataTable
            items={rows.data ?? []}
            getKey={(r) => r.id}
            columns={[
              {
                header: "Contrato",
                cell: (r) => (
                  <button
                    className="font-semibold text-primary underline"
                    onClick={() => setParams({ ...Object.fromEntries(params), contract: String(r.id) })}
                  >
                    {r.data.number}
                  </button>
                ),
              },
              { header: "Empresa", cell: (r) => r.data.company_name },
              {
                header: "Contratação",
                cell: (r) => contractDate(r.data.contracted_on),
              },
              {
                header: "Original",
                cell: (r) =>
                  contractMoney(r.data.original_value, r.data.currency),
              },
              {
                header: "Vigente",
                cell: (r) =>
                  contractMoney(r.data.current_value, r.data.currency),
              },
              {
                header: "Status",
                cell: (r) => contractStatuses[r.data.status],
              },
              { header: "Versão", cell: (r) => r.revision },
            ]}
          />
          {selected && detail.isPending ? (
            <LoadingState />
          ) : detail.isError ? (
            <ErrorState />
          ) : row ? (
            <ContractHistory
              row={row}
              actions={
                <div className="flex flex-wrap gap-3">
                  {hasPermission("contracts:edit") &&
                  writeProject &&
                  row.data.status !== "archived" ? (
                    <Button variant="outline" onClick={() => open("edit")}>
                      Editar contrato
                    </Button>
                  ) : null}
                  {hasPermission("contracts:amend") &&
                  writeProject &&
                  ["active", "suspended"].includes(row.data.status) ? (
                    <Button onClick={() => open("amend")}>
                      Registrar aditivo
                    </Button>
                  ) : null}
                  {hasPermission("contracts:archive") &&
                  ["draft", "completed", "cancelled"].includes(
                    row.data.status,
                  ) ? (
                    <Button variant="outline" onClick={() => open("archive")}>
                      Arquivar contrato
                    </Button>
                  ) : null}
                </div>
              }
            />
          ) : null}
        </>
      )}
      <ModalForm
        open={!!modal}
        title={
          modal === "create"
            ? "Novo contrato"
            : modal === "amend"
              ? "Registrar aditivo"
              : modal === "archive"
                ? "Arquivar contrato"
                : "Editar contrato"
        }
        onOpenChange={(value) => {
          if (!value) setModal(null);
        }}
      >
        <form
          key={`${modal}:${row?.revision}`}
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
        >
          {modal === "create" || modal === "edit" ? (
            <ContractFields row={modal === "edit" ? row : undefined} />
          ) : modal === "amend" ? (
            <>
              <p className="text-sm text-muted-foreground">
                O aditivo altera o valor vigente, prazo ou escopo. O contrato
                original e suas versões são preservados.
              </p>
              <Field label="Identificador do aditivo">
                <input
                  className={inputClass}
                  name="identifier"
                  required
                  maxLength={100}
                />
              </Field>
              <Field label="Data do aditivo">
                <input
                  className={inputClass}
                  type="date"
                  name="dated_on"
                  required
                />
              </Field>
              <Field label="Tipo do aditivo">
                <select
                  aria-label="Tipo do aditivo"
                  className={inputClass}
                  name="type"
                >
                  <option value="value">Valor</option>
                  <option value="term">Prazo</option>
                  <option value="scope">Escopo</option>
                  <option value="mixed">Misto</option>
                </select>
              </Field>
              <Field label="Variação de valor (use sinal negativo para redução)">
                <input
                  className={inputClass}
                  name="value_delta"
                  inputMode="decimal"
                  pattern="-?[0-9]{1,13}(\.[0-9]{1,2})?"
                  placeholder="100.25"
                />
              </Field>
              <Field label="Novo fim da vigência">
                <input
                  className={inputClass}
                  name="amend_ends_on"
                  type="date"
                />
              </Field>
              <Field label="Novo escopo">
                <textarea
                  className={inputClass}
                  name="amend_scope"
                  maxLength={10000}
                />
              </Field>
            </>
          ) : (
            <p className="text-sm">
              O arquivamento mantém o histórico e impede novas alterações.
            </p>
          )}
          {modal !== "create" ? (
            <Field label="Justificativa">
              <textarea
                className={inputClass}
                name="reason"
                required
                minLength={5}
                maxLength={2000}
              />
            </Field>
          ) : null}
          {save.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {save.error.message}
            </p>
          ) : null}
          <Button
            type="submit"
            loading={save.isPending}
            disabled={save.isPending}
          >
            {modal === "amend"
              ? "Salvar aditivo"
              : modal === "archive"
                ? "Confirmar arquivamento"
                : "Salvar contrato"}
          </Button>
        </form>
      </ModalForm>
    </PageContainer>
  );
}
function ContractFields({ row }: { row?: Contract }) {
  const d = row?.data;
  const frozen = (key: keyof ContractData) =>
    !!d && !(d.status === "draft" && d[key] == null);
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Empresa contratante: {d?.company_name ?? "empresa vinculada ao projeto"}
        . Dados ausentes podem ser mantidos em rascunho. Valores usam ponto
        decimal.
      </p>
      <Field label="Número do contrato">
        <input
          className={inputClass}
          name="number"
          required
          maxLength={100}
          defaultValue={d?.number}
          readOnly={!!d}
        />
      </Field>
      {(
        [
          ["contracted_on", "Data de contratação"],
          ["starts_on", "Início da vigência"],
          ["ends_on", "Fim da vigência"],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={inputClass}
            name={key}
            type="date"
            defaultValue={d?.[key] ?? ""}
            readOnly={frozen(key)}
          />
        </Field>
      ))}
      <Field label="Valor original">
        <input
          className={inputClass}
          name="original_value"
          inputMode="decimal"
          pattern="[0-9]{1,13}(\.[0-9]{1,2})?"
          defaultValue={d?.original_value ?? ""}
          readOnly={frozen("original_value")}
        />
      </Field>
      <Field label="Moeda">
        <select
          aria-label="Moeda"
          className={inputClass}
          name="currency"
          defaultValue={d?.currency ?? "BRL"}
        >
          {(d ? [d.currency] : ["BRL", "USD", "EUR"]).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      {(
        [
          ["contracting_type", "Tipo de contratação"],
          ["segment", "Segmento"],
          ["commercial_origin", "Origem comercial"],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={inputClass}
            name={key}
            maxLength={120}
            defaultValue={d?.[key] ?? ""}
          />
        </Field>
      ))}
      <Field label="Recorrência">
        <select
          aria-label="Recorrência"
          className={inputClass}
          name="recurring"
          defaultValue={d?.recurring == null ? "" : String(d.recurring)}
        >
          <option value="">Não informada</option>
          <option value="true">Recorrente</option>
          <option value="false">Não recorrente</option>
        </select>
      </Field>
      <Field label="Serviços contratados (separados por ponto e vírgula)">
        <input
          className={inputClass}
          name="services"
          defaultValue={d?.services.join("; ") ?? ""}
          maxLength={6000}
        />
      </Field>
      <Field label="Quantidade estimada de bens">
        <input
          className={inputClass}
          name="estimated_assets"
          type="number"
          min="0"
          max="2147483647"
          defaultValue={d?.estimated_assets ?? ""}
        />
      </Field>
      <Field label="Escopo original">
        <textarea
          className={inputClass}
          name="scope"
          defaultValue={d?.scope ?? ""}
          maxLength={10000}
          readOnly={frozen("scope")}
        />
      </Field>
      <Field label="Condições comerciais">
        <textarea
          className={inputClass}
          name="commercial_terms"
          defaultValue={d?.commercial_terms ?? ""}
          maxLength={10000}
        />
      </Field>
      <Field label="Status contratual">
        <select
          aria-label="Status contratual"
          className={inputClass}
          name="status"
          defaultValue={d?.status ?? "draft"}
        >
          {(d
            ? [
                d.status,
                ...({
                  draft: ["active", "cancelled"],
                  active: ["suspended", "completed", "cancelled"],
                  suspended: ["active", "completed", "cancelled"],
                }[d.status] ?? []),
              ]
            : ["draft", "active"]
          ).map((s) => (
            <option key={s} value={s}>
              {contractStatuses[s]}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
function ContractHistory({
  row,
  actions,
}: {
  row: ContractDetail;
  actions: ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <div className="premium-panel grid gap-3 p-5">
        <h2 className="font-semibold">
          Contrato {row.data.number} · versão {row.revision}
        </h2>
        {actions}
        <p className="text-sm">
          Vigência atual: {contractDate(row.data.starts_on)} a{" "}
          {contractDate(row.data.current_ends_on)}
        </p>
        <p className="whitespace-pre-wrap text-sm">
          Escopo vigente: {row.data.current_scope ?? "Não informado"}
        </p>
        <p className="text-sm">
          Condições: {row.data.commercial_terms ?? "Não informadas"}
        </p>
      </div>
      <h2 className="font-semibold">Aditivos</h2>
      <DataTable
        items={row.amendments}
        getKey={(a) => a.id}
        columns={[
          { header: "Aditivo", cell: (a) => a.identifier },
          { header: "Data", cell: (a) => contractDate(a.datedOn) },
          {
            header: "Tipo",
            cell: (a) =>
              ({
                value: "Valor",
                term: "Prazo",
                scope: "Escopo",
                mixed: "Misto",
              })[a.type] ?? a.type,
          },
          {
            header: "Variação",
            cell: (a) => contractMoney(a.valueDelta, row.data.currency),
          },
          {
            header: "Prazo / escopo",
            cell: (a) =>
              `${contractDate(a.endsOn)} · ${a.scope ?? "Sem alteração de escopo"}`,
          },
          {
            header: "Justificativa / responsável",
            cell: (a) => `${a.reason} · usuário #${a.actorId}`,
          },
        ]}
      />
      <h2 className="font-semibold">Histórico de versões</h2>
      <DataTable
        items={row.versions}
        getKey={(v) => v.id}
        columns={[
          { header: "Versão", cell: (v) => v.revision },
          {
            header: "Operação / responsável",
            cell: (v) =>
              `${{ create: "Cadastro", edit: "Edição", amend: "Aditivo", archive: "Arquivamento" }[v.operation] ?? v.operation} · usuário #${v.actorId}`,
          },
          {
            header: "Registrado em",
            cell: (v) => new Date(v.recordedAt).toLocaleString("pt-BR"),
          },
          {
            header: "Original",
            cell: (v) => contractMoney(v.data.original_value, v.data.currency),
          },
          {
            header: "Vigente",
            cell: (v) => contractMoney(v.data.current_value, v.data.currency),
          },
          { header: "Justificativa", cell: (v) => v.reason },
          {
            header: "Dados da versão",
            cell: (v) => (
              <details>
                <summary>Ver dados</summary>
                <pre className="max-w-sm overflow-auto text-xs">
                  {JSON.stringify(v.data, null, 2)}
                </pre>
              </details>
            ),
          },
        ]}
      />
    </section>
  );
}
