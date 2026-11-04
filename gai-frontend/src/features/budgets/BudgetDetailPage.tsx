import { navigationHref } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import { BudgetForm } from "./BudgetForm";
import { BudgetMemory, PaymentMemory } from "./BudgetMemory";
import { DocumentExport } from '@/features/documents/DocumentExport';
import { VisualTemplateEditor } from '@/features/documents/VisualTemplateEditor';
import {
  budgetApi,
  budgetDate,
  budgetMoney,
  budgetStatuses,
  type Version,
} from "./budgetApi";
export function BudgetDetailPage() {
  const { budgetId } = useParams();
  return <BudgetWorkspace key={budgetId} id={Number(budgetId)} />;
}
function BudgetWorkspace({ id }: { id: number }) {
  const { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient();
  const [params, setParams] = useSearchParams(),
    tab = params.get("tab") ?? "memory";
  const [modal, setModal] = useState<"edit" | "scenario" | "transition" | null>(
      null,
    ),
    [target, setTarget] = useState("");
  const query = useQuery({
    queryKey: ["budget", user?.id, user?.organization_id, id],
    queryFn: () => budgetApi.detail(id),
  });
  const data = query.data,
    version =
      data?.versions.find((v) => v.id === Number(params.get("version"))) ??
      data?.versions.find((v) => v.id === data.headVersionId);
  const proposal = useQuery({
    queryKey: ["budget-proposal", user?.id, id, data?.approvedVersionId],
    queryFn: () => budgetApi.proposal(id),
    enabled:
      tab === "proposal" &&
      !!data?.approvedVersionId &&
      ["approved", "archived"].includes(data.status),
  });
  const intent = useMutation({
    mutationFn: () => budgetApi.contractPreview(id),
  });
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["budget"] });
    await cache.invalidateQueries({ queryKey: ["budgets"] });
    setModal(null);
  };
  const transition = useMutation({
    mutationFn: (reason: string) =>
      budgetApi.transition(id, {
        revision: data!.revision,
        version_id: version!.id,
        status: target,
        reason,
      }),
    onSuccess: refresh,
  });
  function status(next: string) {
    transition.reset();
    setTarget(next);
    setModal("transition");
  }
  function select(v: Version, nextTab = tab) {
    const p = new URLSearchParams(params);
    p.set("version", String(v.id));
    p.set("tab", nextTab);
    setParams(p);
  }
  if (query.isPending) return <LoadingState />;
  if (query.isError || !data || !version)
    return <ErrorState message={query.error?.message} />;
  const writable = hasPermission("budgets:edit"),
    approve = hasPermission("budgets:approve");
  return (
    <div className="grid gap-5">
      {user?.organization_id && hasPermission('documents:templates') && <VisualTemplateEditor organizationId={user.organization_id} />}
      {hasPermission('budgets:export') && (tab !== 'proposal' || data.approvedVersionId) && <DocumentExport key={`${version.id}-${tab}`} endpoint={`/budgets/${id}/versions/${tab === 'proposal' ? data.approvedVersionId : version.id}/${tab === 'proposal' ? 'proposal-documents' : 'documents'}`} formats={tab === 'proposal' ? ['pdf', 'docx'] : ['pdf']} allowMemory />}
      <div className="premium-panel grid gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Orçamento {data.number}</h2>
          <span className="rounded bg-muted px-3 py-1 text-sm">
            {budgetStatuses[data.status]} · revisão {data.revision}
          </span>
        </div>
        <p className="text-sm">
          {version.snapshot.context.company.name} ·{" "}
          {version.snapshot.context.project?.name ??
            "Anterior à criação do projeto"}{" "}
          · responsável {version.snapshot.context.responsible.login}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
            {data.status==='approved'&&hasPermission('receivables:read')&&hasPermission('receivables:edit')&&<Link className="text-primary underline" to={navigationHref(`/app/finance/receivables/new?origin=budget&source_id=${data.id}`, params)}>Preparar recebível deste orçamento</Link>}
          <Link className="text-primary underline" to={navigationHref("/app/budgets", params)}>
            Voltar aos orçamentos
          </Link>
          {data.projectId && hasPermission("projects:read") ? (
            <Link
              className="text-primary underline"
              to={navigationHref(`/app/projects/${data.projectId}/summary`, params)}
            >
              Consultar projeto
            </Link>
          ) : null}
          {data.projectId &&
          hasPermission("contracts:read") &&
          hasPermission("projects:read") ? (
            <Link
              className="text-primary underline"
              to={navigationHref(`/app/projects/${data.projectId}/contracts`, params)}
            >
              Consultar contratos do projeto
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {writable && ["draft", "rejected"].includes(data.status) ? (
            <Button variant="outline" onClick={() => setModal("edit")}>
              Editar em nova versão
            </Button>
          ) : null}
          {writable && data.status !== "archived" ? (
            <Button variant="outline" onClick={() => setModal("scenario")}>
              Novo cenário
            </Button>
          ) : null}
          {writable && data.status === "draft" ? (
            <Button onClick={() => status("review")}>
              Enviar versão selecionada para revisão
            </Button>
          ) : null}
          {approve && data.status === "review" ? (
            <>
              <Button onClick={() => status("approved")}>
                Aprovar versão em revisão
              </Button>
              <Button variant="outline" onClick={() => status("rejected")}>
                Rejeitar orçamento
              </Button>
            </>
          ) : null}
          {writable && ["review", "rejected"].includes(data.status) ? (
            <Button variant="outline" onClick={() => status("draft")}>
              Retornar a rascunho
            </Button>
          ) : null}
          {writable &&
          ["draft", "rejected", "approved"].includes(data.status) &&
          (data.status !== "approved" || approve) ? (
            <Button variant="outline" onClick={() => status("archived")}>
              Arquivar orçamento
            </Button>
          ) : null}
        </div>
        {data.status === "approved" ? (
          <p className="text-sm text-muted-foreground">
            Versão aprovada protegida. Novos cenários permitem comparação e
            preservam a proposta aprovada.
          </p>
        ) : null}
        <label className="grid max-w-xl gap-1 text-sm">
          Versão em consulta
          <select
            aria-label="Versão em consulta"
            className="rounded border bg-background p-2"
            value={version.id}
            onChange={(e) =>
              select(
                data.versions.find((v) => v.id === Number(e.target.value))!,
              )
            }
          >
            {data.versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} · {v.name}
                {v.id === data.approvedVersionId
                  ? " · aprovada"
                  : v.id === data.headVersionId
                    ? " · atual"
                    : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          v{version.version} · {version.name} ·{" "}
          {new Date(version.recordedAt).toLocaleString("pt-BR")} · usuário #
          {version.actorId} · {version.reason}
        </p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Abas do orçamento">
        {[
          ["memory", "Memória de cálculo"],
          ["scenarios", "Comparar cenários"],
          ["payments", "Pagamento"],
          ["history", "Histórico"],
          ...(data.approvedVersionId ? [["proposal", "Prévia comercial"]] : []),
        ].map(([key, label]) => (
          <Link
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded-lg border px-4 py-2 text-sm ${tab === key ? "bg-primary text-primary-foreground" : "bg-card"}`}
            to={"?" + new URLSearchParams({ ...Object.fromEntries(params), tab: key, version: String(version.id) })}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "memory" ? (
        <BudgetMemory snapshot={version.snapshot} />
      ) : tab === "payments" ? (
        <PaymentMemory
          payment={version.snapshot.calculation.payment}
          currency={version.snapshot.calculation.currency}
        />
      ) : tab === "scenarios" ? (
        <>
          <h2 className="font-semibold">Comparação de versões e cenários</h2>
          <DataTable
            items={data.versions}
            getKey={(v) => v.id}
            columns={[
              {
                header: "Versão / cenário",
                cell: (v) => (
                  <button
                    className="text-primary underline"
                    onClick={() => select(v, "memory")}
                  >
                    v{v.version} · {v.name}
                  </button>
                ),
              },
              {
                header: "Equipe / dias",
                cell: (v) =>
                  `${v.snapshot.calculation.sizing.team} / ${v.snapshot.calculation.sizing.field_days}`,
              },
              {
                header: "Produtividade / margem",
                cell: (v) =>
                  `${v.snapshot.calculation.inputs.productivity} / ${v.snapshot.calculation.rates.margin_pct}%`,
              },
              {
                header: "Custos",
                cell: (v) =>
                  budgetMoney(
                    v.snapshot.calculation.cost_total,
                    v.snapshot.calculation.currency,
                  ),
              },
              {
                header: "Preço final",
                cell: (v) =>
                  budgetMoney(
                    v.snapshot.calculation.final_price,
                    v.snapshot.calculation.currency,
                  ),
              },
              { header: "Justificativa", cell: (v) => v.reason },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Para consolidar um cenário antes da aprovação, consulte sua versão e
            envie-a para revisão. A aprovação usa somente a versão em revisão.
          </p>
        </>
      ) : tab === "history" ? (
        <>
          <h2 className="font-semibold">Histórico de versões</h2>
          <DataTable
            items={data.versions}
            getKey={(v) => v.id}
            columns={[
              {
                header: "Versão",
                cell: (v) => (
                  <button
                    className="text-primary underline"
                    onClick={() => select(v, "memory")}
                  >
                    v{v.version} · {v.name}
                  </button>
                ),
              },
              {
                header: "Tipo",
                cell: (v) => (v.kind === "scenario" ? "Cenário" : "Elaboração"),
              },
              { header: "Autor", cell: (v) => `Usuário #${v.actorId}` },
              {
                header: "Data",
                cell: (v) => new Date(v.recordedAt).toLocaleString("pt-BR"),
              },
              { header: "Justificativa", cell: (v) => v.reason },
            ]}
          />
          <h2 className="font-semibold">Auditoria</h2>
          <DataTable
            items={data.audit}
            getKey={(a) => a.id}
            columns={[
              { header: "Revisão", cell: (a) => a.revision },
              {
                header: "Operação",
                cell: (a) =>
                  ({
                    create: "Cadastro",
                    edit: "Edição",
                    scenario: "Cenário",
                    transition: "Transição",
                  })[a.operation] ?? a.operation,
              },
              {
                header: "Estado",
                cell: (a) =>
                  a.details.to
                    ? `${budgetStatuses[a.details.from ?? "draft"]} → ${budgetStatuses[a.details.to]}`
                    : "Versão registrada",
              },
              {
                header: "Autor / data",
                cell: (a) =>
                  `Usuário #${a.actorId} · ${new Date(a.recordedAt).toLocaleString("pt-BR")}`,
              },
              { header: "Justificativa", cell: (a) => a.reason },
            ]}
          />
        </>
      ) : tab === "proposal" ? (
        proposal.isPending ? (
          <LoadingState />
        ) : proposal.isError ? (
          <ErrorState />
        ) : proposal.data ? (
          <article className="premium-panel grid gap-4 p-6">
            <h2 className="text-xl font-semibold">
              Prévia comercial · {proposal.data.number}
            </h2>
            <p className="text-sm">
              Versão aprovada {proposal.data.version} · validade{" "}
              {budgetDate(proposal.data.valid_until)}
            </p>
            <h3 className="font-semibold">{proposal.data.company.name}</h3>
            <p className="whitespace-pre-wrap text-sm">{proposal.data.scope}</p>
            <p className="text-sm">
              Serviços: {proposal.data.services.join(", ") || "Não informados"}{" "}
              · bens estimados: {proposal.data.assets} · prazo de campo:{" "}
              {proposal.data.field_days} dias.
            </p>
            {proposal.data.units.map((u) => (
              <p key={u.id} className="text-sm">
                {u.name}: {u.address}
              </p>
            ))}
            {proposal.data.addresses.map((a) => (
              <p key={a} className="text-sm">
                {a}
              </p>
            ))}
            <p className="text-2xl font-bold text-primary">
              {budgetMoney(proposal.data.final_price, proposal.data.currency)}
            </p>
            <PaymentMemory
              payment={proposal.data.payment}
              currency={proposal.data.currency}
            />
            <p className="text-xs text-muted-foreground">
              Prévia de conteúdo comercial. Geração profissional de PDF/PPTX
              depende de template homologado e não está disponível nesta etapa.
            </p>
            {approve && data.status === "approved" ? (
              <Button
                variant="outline"
                disabled={intent.isPending}
                onClick={() => intent.mutate()}
              >
                Preparar dados para futuro contrato
              </Button>
            ) : null}
            {intent.isError ? (
              <p role="alert">{intent.error.message}</p>
            ) : intent.data ? (
              <p className="text-sm">
                Dados preparados sem criar contrato, projeto ou recebíveis.
                Pendências para conversão futura:{" "}
                {intent.data.required_before_conversion.join("; ")}.
              </p>
            ) : null}
          </article>
        ) : null
      ) : (
        <ErrorState message="Aba inválida." />
      )}
      <ModalForm
        open={!!modal}
        onOpenChange={(value) => {
          if (!value) setModal(null);
        }}
        title={
          modal === "edit"
            ? "Nova versão do orçamento"
            : modal === "scenario"
              ? "Novo cenário comercial"
              : "Alterar status do orçamento"
        }
      >
        {modal === "edit" || modal === "scenario" ? (
          <BudgetForm
            key={`${modal}:${version.id}`}
            mode={modal}
            initial={version}
            onSave={async (dto, name, reason) => {
              await budgetApi.version(
                id,
                {
                  ...dto,
                  revision: data.revision,
                  name,
                  reason,
                  base_version_id: version.id,
                },
                modal === "scenario",
              );
              await refresh();
            }}
          />
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              transition.mutate(
                String(new FormData(e.currentTarget).get("reason")),
              );
            }}
          >
            <p className="text-sm">
              {budgetStatuses[data.status]} → {budgetStatuses[target]} · versão
              selecionada v{version.version}. Aprovação consolida a versão em
              revisão e não altera seus dados.
            </p>
            <label className="grid gap-1 text-sm">
              Justificativa
              <textarea
                className="rounded border bg-background p-2"
                name="reason"
                required
                minLength={5}
                maxLength={2000}
              />
            </label>
            {transition.isError ? (
              <p role="alert">{transition.error.message}</p>
            ) : null}
            <Button
              type="submit"
              loading={transition.isPending}
              disabled={transition.isPending}
            >
              Confirmar alteração
            </Button>
          </form>
        )}
      </ModalForm>
    </div>
  );
}
