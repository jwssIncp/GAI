import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Download, Pencil, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { FilterPanel } from "@/components/base/FilterPanel";
import { ErrorState, LoadingState } from "@/components/base/States";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/features/auth/usePermissions";
import { projectKeys } from "@/features/projects/projectQueries";
import { useProjectLabel } from "@/features/projects/useProjectLabel";
import { BRAZILIAN_STATES } from "@/features/field-agents/brazilianStates";
import { formatMoney } from "@/utils/format";
import { RemunerationForm } from "./RemunerationForm";
import {
  remunerationApi,
  remunerationKeys,
  statusLabel,
  type RemunerationFilters,
  type RemunerationInput,
  type RemunerationItem,
  type RemunerationStatusGroup,
} from "./remunerationApi";

const civil = (value: string | null) => (value ? value.split("-").reverse().join("/") : null);

export function ProjectRemunerationPage() {
  const projectId = Number(useParams().projectId);
  const label = useProjectLabel(projectId);
  const { hasPermission } = usePermissions();
  const cache = useQueryClient();
  const [filters, setFilters] = useState<RemunerationFilters>({ status_group: "all" });
  const [form, setForm] = useState<
    { mode: "create"; preset?: { field_agent_id: number; state: string | null } } | { mode: "edit"; item: RemunerationItem } | null
  >(null);
  const [action, setAction] = useState<{ kind: "approve" | "pay" | "cancel" | "reopen" | "delete"; item: RemunerationItem } | null>(null);
  const [payDate, setPayDate] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ error?: boolean; message: string } | null>(null);
  const query = useQuery({
    queryKey: remunerationKeys.project(projectId, filters),
    queryFn: () => remunerationApi.project(projectId, filters),
    enabled: Number.isFinite(projectId),
  });
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: remunerationKeys.all });
    await cache.invalidateQueries({ queryKey: ["finance", "project", projectId] });
    await cache.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
  };
  const save = useMutation({
    mutationFn: (payload: RemunerationInput) =>
      form?.mode === "edit"
        ? remunerationApi.update(projectId, form.item.id, payload)
        : remunerationApi.create(projectId, payload),
    onSuccess: async () => {
      await refresh();
      setFeedback({ message: form?.mode === "edit" ? "Lançamento atualizado." : "Lançamento criado." });
      setForm(null);
    },
  });
  const run = useMutation({
    mutationFn: async () => {
      if (!action) return;
      const id = action.item.id;
      if (action.kind === "approve") return remunerationApi.approve(projectId, id);
      if (action.kind === "pay") return remunerationApi.markAsPaid(projectId, id, payDate || undefined);
      if (action.kind === "cancel") return remunerationApi.cancel(projectId, id);
      if (action.kind === "reopen") return remunerationApi.reopen(projectId, id, reason.trim());
      return remunerationApi.remove(projectId, id);
    },
    onSuccess: async () => {
      await refresh();
      setFeedback({ message: "Operação concluída. Histórico registrado." });
      setAction(null);
    },
    onError: (error) => setFeedback({ error: true, message: (error as Error).message }),
  });

  const data = query.data;
  const requireApproval = data?.parameters.require_approval ?? true;
  const canPay = (item: RemunerationItem) =>
    item.status === "approved" || (!requireApproval && item.status === "pending");
  const states = useMemo(
    () => [...new Set([...(data?.items.map((i) => i.state) ?? []), ...BRAZILIAN_STATES])].filter(Boolean) as string[],
    [data],
  );

  async function exportList() {
    try {
      const blob = await remunerationApi.exportFile(projectId, filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `remuneracao-projeto-${projectId}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback({ error: true, message: (error as Error).message });
    }
  }

  const actionText = {
    approve: ["Aprovar lançamento", "Aprovar o lançamento de"],
    pay: ["Registrar pagamento", "Registrar o pagamento de"],
    cancel: ["Cancelar lançamento", "Cancelar o lançamento de"],
    reopen: ["Reabrir para edição", "Reabrir para edição o lançamento de"],
    delete: ["Excluir lançamento", "Excluir o lançamento de"],
  } as const;

  return (
    <PageContainer>
      <PageHeader
        title="Remuneração"
        description={`Diárias dos inventariantes${label ? ` · ${label}` : ""}. Total = dias × diária + adicional; final = total − descontos.`}
        action={
          <div className="flex flex-wrap gap-2">
            {hasPermission("payments:export") ? (
              <Button type="button" variant="secondary" onClick={() => void exportList()}>
                <Download size={17} /> Exportar Excel
              </Button>
            ) : null}
            {hasPermission("payments:create") ? (
              <Button type="button" onClick={() => { save.reset(); setForm({ mode: "create" }); }}>
                <Plus size={17} /> Novo lançamento
              </Button>
            ) : null}
          </div>
        }
      />
      {data ? (
        <section aria-label="Indicadores da remuneração" className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total final</p>
            <p className="text-2xl font-semibold tabular-nums">{formatMoney(data.kpis.total_final)}</p>
            <p className="text-xs text-muted-foreground">{formatMoney(data.kpis.paid_final)} já pago · cancelados fora</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">A lançar</p>
            <p className="text-2xl font-semibold tabular-nums">{data.to_launch.length}</p>
            <p className="text-xs text-muted-foreground">Vinculados ativos sem nenhum lançamento</p>
          </div>
        </section>
      ) : null}
      <FilterPanel>
        <select
          aria-label="Filtrar por inventariante"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={filters.field_agent_id ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, field_agent_id: e.target.value ? Number(e.target.value) : undefined }))}
        >
          <option value="">Todos os inventariantes vinculados</option>
          {data?.agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por UF"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={filters.state ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value || undefined }))}
        >
          <option value="">Todas as UFs</option>
          {states.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por status"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={filters.status_group ?? "all"}
          onChange={(e) => setFilters((f) => ({ ...f, status_group: e.target.value as RemunerationStatusGroup }))}
        >
          <option value="all">Todos os status</option>
          <option value="open">Em aberto (pendente e aprovado)</option>
          <option value="paid">Pago</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </FilterPanel>
      {feedback ? (
        <p role={feedback.error ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${feedback.error ? "text-destructive" : ""}`}>
          {feedback.message}
        </p>
      ) : null}
      {query.isLoading ? (
        <LoadingState label="Carregando remuneração" />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      ) : data ? (
        <div className="premium-panel">
          <div className="overflow-x-auto" role="region" aria-label="Lançamentos de remuneração" tabIndex={0}>
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  {["Inventariante", "UF", "Período", "Previsto", "Dias", "Diária", "Adicional", "Total", "Descontos", "Final", "Status"].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap border-b px-2.5 py-2.5 font-semibold">{h}</th>
                  ))}
                  <th scope="col" className="whitespace-nowrap border-b px-2.5 py-2.5 font-semibold md:sticky md:right-0 md:bg-muted">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/[0.05]">
                    <td className="max-w-[9rem] border-b px-2.5 py-2.5 font-medium">{item.field_agent_name}</td>
                    <td className="border-b px-2.5 py-2.5">{item.state ?? "—"}</td>
                    <td className="whitespace-nowrap border-b px-2.5 py-2.5">
                      <span className="flex flex-col leading-tight">
                        <span>{civil(item.start_date)}</span>
                        <span className="text-xs text-muted-foreground">a {civil(item.end_date)}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b px-2.5 py-2.5">
                      {item.status === "paid" ? (
                        <span title="Data real de pagamento" className="flex flex-col leading-tight">
                          {civil(item.payment_date)}
                          <span className="text-xs text-muted-foreground">pago</span>
                        </span>
                      ) : item.expected_payment_date ? (
                        civil(item.expected_payment_date)
                      ) : (
                        <span className="rounded bg-destructive/15 px-2 py-0.5 font-semibold text-destructive">Informar</span>
                      )}
                    </td>
                    <td className="border-b px-2.5 py-2.5 tabular-nums">{item.days}</td>
                    <td className="whitespace-nowrap border-b px-2.5 py-2.5 tabular-nums">{formatMoney(item.daily_rate)}</td>
                    <td className="whitespace-nowrap border-b px-2.5 py-2.5 tabular-nums">{formatMoney(item.additional_amount)}</td>
                    <td className="whitespace-nowrap border-b px-2.5 py-2.5 tabular-nums">
                      {formatMoney(item.total_amount)}
                      {item.total_manual ? <span className="mt-0.5 block w-fit rounded bg-warning/15 px-1.5 text-xs font-semibold text-warning" title="Valor informado manualmente">manual</span> : null}
                    </td>
                    <td className="whitespace-nowrap border-b px-2.5 py-2.5 tabular-nums">{formatMoney(item.discount_amount)}</td>
                    <td className="whitespace-nowrap border-b px-2.5 py-2.5 font-semibold tabular-nums">{formatMoney(item.final_amount)}</td>
                    <td className="border-b px-2.5 py-2.5"><StatusBadge value={item.status} /></td>
                    <td className="whitespace-nowrap border-b px-2.5 py-2.5 md:sticky md:right-0 md:bg-card">
                      <div className="flex gap-0.5">
                        {hasPermission("payments:update") && item.status === "pending" ? (
                          <Button type="button" variant="ghost" className="size-8" aria-label={`Editar lançamento de ${item.field_agent_name}`} onClick={() => { save.reset(); setForm({ mode: "edit", item }); }}><Pencil size={16} /></Button>
                        ) : null}
                        {requireApproval && hasPermission("payments:approve") && item.status === "pending" ? (
                          <Button type="button" variant="ghost" className="size-8" aria-label={`Aprovar lançamento de ${item.field_agent_name}`} onClick={() => setAction({ kind: "approve", item })}><CheckCircle2 size={16} /></Button>
                        ) : null}
                        {hasPermission("payments:mark-as-paid") && canPay(item) ? (
                          <Button type="button" variant="ghost" className="size-8" aria-label={`Registrar pagamento de ${item.field_agent_name}`} onClick={() => { setPayDate(""); setAction({ kind: "pay", item }); }}><CreditCard size={16} /></Button>
                        ) : null}
                        {hasPermission("payments:reopen") && item.status === "approved" ? (
                          <Button type="button" variant="ghost" className="size-8" aria-label={`Reabrir para edição o lançamento de ${item.field_agent_name}`} onClick={() => { setReason(""); setAction({ kind: "reopen", item }); }}><RotateCcw size={16} /></Button>
                        ) : null}
                        {hasPermission("payments:cancel") && (item.status === "pending" || item.status === "approved") ? (
                          <Button type="button" variant="ghost" className="size-8" aria-label={`Cancelar lançamento de ${item.field_agent_name}`} onClick={() => setAction({ kind: "cancel", item })}><XCircle size={16} /></Button>
                        ) : null}
                        {hasPermission("payments:delete") && (item.status === "pending" || item.status === "cancelled") ? (
                          <Button type="button" variant="ghost" className="size-8" aria-label={`Excluir lançamento de ${item.field_agent_name}`} onClick={() => setAction({ kind: "delete", item })}><Trash2 size={16} /></Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {data.to_launch.map((agent) => (
                  <tr key={`a-lancar-${agent.field_agent_id}`} className="text-muted-foreground">
                    <td className="border-b px-2.5 py-2.5 font-medium">{agent.name}</td>
                    <td className="border-b px-2.5 py-2.5">{agent.state ?? "—"}</td>
                    <td colSpan={9} className="border-b px-2.5 py-2.5 italic">A lançar: vinculado ao projeto, sem nenhum lançamento.</td>
                    <td className="border-b px-2.5 py-2.5 md:sticky md:right-0 md:bg-card">
                      {hasPermission("payments:create") ? (
                        <Button type="button" variant="soft" onClick={() => { save.reset(); setForm({ mode: "create", preset: { field_agent_id: agent.field_agent_id, state: agent.state } }); }}>
                          Lançar
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={7} className="px-2.5 py-2.5">Total ({data.totals.count} lançamento(s); cancelados fora da soma)</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums">{formatMoney(data.totals.total_amount)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums">{formatMoney(data.totals.discount_amount)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums">{formatMoney(data.totals.final_amount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}

      <ModalForm
        open={Boolean(form)}
        onOpenChange={(open) => !open && setForm(null)}
        title={form?.mode === "edit" ? "Editar lançamento" : "Novo lançamento"}
      >
        {form && data ? (
          <RemunerationForm
            data={data}
            initial={form.mode === "edit" ? form.item : undefined}
            preset={form.mode === "create" ? form.preset : undefined}
            busy={save.isPending}
            serverError={save.isError ? (save.error as Error).message : null}
            onSubmit={(payload) => save.mutate(payload)}
            onCancel={() => setForm(null)}
          />
        ) : null}
      </ModalForm>

      {action?.kind === "pay" || action?.kind === "reopen" ? (
        <ModalForm open onOpenChange={(open) => !open && setAction(null)} title={actionText[action.kind][0]}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              run.mutate();
            }}
          >
            <p className="text-sm text-muted-foreground">
              {actionText[action.kind][1]} {action.item.field_agent_name} ({formatMoney(action.item.final_amount)}).
            </p>
            {action.kind === "pay" ? (
              <label className="grid gap-1 text-sm font-semibold">
                Data do pagamento (vazio = hoje)
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </label>
            ) : (
              <label className="grid gap-1 text-sm font-semibold">
                Justificativa (fica no histórico)
                <Input value={reason} minLength={5} required onChange={(e) => setReason(e.target.value)} />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAction(null)}>Voltar</Button>
              <Button type="submit" loading={run.isPending}>{actionText[action.kind][0]}</Button>
            </div>
          </form>
        </ModalForm>
      ) : (
        <ConfirmDialog
          open={Boolean(action)}
          onOpenChange={(open) => !open && setAction(null)}
          title={action ? actionText[action.kind][0] : ""}
          description={
            action
              ? `${actionText[action.kind][1]} ${action.item.field_agent_name} (${formatMoney(action.item.final_amount)})? ${statusLabel[action.item.status]} hoje.`
              : ""
          }
          busy={run.isPending}
          onConfirm={() => run.mutate()}
        />
      )}
    </PageContainer>
  );
}
