import { useMemo, useState } from "react";
import { useDebouncedValue } from "./useDebouncedValue";
import {
  Download,
  Eye,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Unlock,
  UserX,
} from "lucide-react";
import { normalizePage } from "@/api/pagination";
import { Kpi } from "@/components/base/Cards";
import { DataTable, type Column } from "@/components/base/DataTable";
import { FilterPanel } from "@/components/base/FilterPanel";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { Pagination } from "@/components/base/Pagination";
import { SearchInput } from "@/components/base/SearchInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { StatusBadge } from "@/components/base/StatusBadge";
import { FieldAgentAccessBadge } from "./FieldAgentAccessBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, DrawerForm } from "@/components/ui/dialog";
import { PermissionGate } from "@/features/auth/PermissionGate";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import { FieldAgentDetailDrawer } from "./FieldAgentDetailDrawer";
import { FieldAgentForm } from "./FieldAgentForm";
import {
  useBatchDeleteFieldAgents,
  useChangeFieldAgentStatus,
  useCreateFieldAgent,
  useDeleteFieldAgent,
  useFieldAgentSummary,
  useFieldAgents,
  useUpdateFieldAgent,
} from "./fieldAgentsQueries";
import { fieldAgentsApi } from "@/api/endpoints";
import { BRAZILIAN_STATES } from "./brazilianStates";
import type { FieldAgentFinancialUsage } from "@/types/api";
import { batchDescription } from "./fieldAgentBatch";
import type { FieldAgent, FieldAgentStatus } from "@/types/api";

export function FieldAgentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FieldAgentStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FieldAgent | null>(null);
  const [viewingId, setViewingId] = useState<number | undefined>();
  const [confirm, setConfirm] = useState<{
    action:
      | "deactivate"
      | "reactivate"
      | "block"
      | "unblock"
      | "delete"
      | "restore";
    item: FieldAgent;
  } | null>(null);
  const [deletion, setDeletion] = useState<"current" | "deleted">("current");
  const [state, setState] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [batchConfirm, setBatchConfirm] = useState<{
    usage: FieldAgentFinancialUsage[];
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<{
    error?: boolean;
    message: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const term = useDebouncedValue(search);
  const params = useMemo(
    () => ({
      page,
      page_size: 20,
      search: term || undefined,
      status: status || undefined,
      state: state || undefined,
      deletion,
    }),
    [page, term, status, state, deletion],
  );
  const query = useFieldAgents(params);
  const create = useCreateFieldAgent();
  const update = useUpdateFieldAgent();
  const deactivate = useChangeFieldAgentStatus("deactivate");
  const reactivate = useChangeFieldAgentStatus("reactivate");
  const block = useChangeFieldAgentStatus("block");
  const unblock = useChangeFieldAgentStatus("unblock");
  const restore = useChangeFieldAgentStatus("restore");
  const deleteAgent = useDeleteFieldAgent();
  const batchDelete = useBatchDeleteFieldAgents();
  const summary = useFieldAgentSummary();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const data = query.data ? normalizePage(query.data) : null;
  const canBatchDelete =
    deletion === "current" && hasPermission("field-agents:delete");
  const pageIds = data?.items.map((item) => item.id) ?? [];
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const resetSelection = () => setSelected([]);

  async function openBatchDelete() {
    setFeedback(null);
    try {
      const usage = await fieldAgentsApi.financialUsage(selected);
      setBatchConfirm({ usage });
    } catch (error) {
      setFeedback({ error: true, message: (error as Error).message });
    }
  }

  async function exportList() {
    setExporting(true);
    setFeedback(null);
    try {
      const blob = await fieldAgentsApi.exportFile({
        search: term || undefined,
        status: status || undefined,
        state: state || undefined,
        deletion,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "inventariantes.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback({ error: true, message: (error as Error).message });
    } finally {
      setExporting(false);
    }
  }

  const selectionColumn: Column<FieldAgent> = {
    header: "Seleção",
    headerContent: (
      <input
        type="checkbox"
        aria-label="Selecionar todos desta página"
        checked={allOnPageSelected}
        onChange={(event) =>
          setSelected(
            event.target.checked
              ? [...new Set([...selected, ...pageIds])]
              : selected.filter((id) => !pageIds.includes(id)),
          )
        }
      />
    ),
    cell: (item) => (
      <input
        type="checkbox"
        aria-label={`Selecionar ${item.name}`}
        checked={selected.includes(item.id)}
        onChange={(event) =>
          setSelected(
            event.target.checked
              ? [...selected, item.id]
              : selected.filter((id) => id !== item.id),
          )
        }
      />
    ),
  };
  const columns: Column<FieldAgent>[] = [
    ...(canBatchDelete ? [selectionColumn] : []),
    {
      header: "Nome",
      cell: (item) => (
        <div className="font-medium">
          {item.name}
          <div className="text-xs text-muted-foreground">#{item.id}</div>
        </div>
      ),
    },
    // Situação e acesso logo após o nome: com as ações fixas à direita, as
    // últimas colunas ficavam escondidas em telas de 1280–1440 px.
    { header: "Situação", className: "whitespace-nowrap", cell: (item) => <StatusBadge value={item.status} /> },
    {
      header: "Acesso ao app",
      className: "whitespace-nowrap",
      cell: (item) => <FieldAgentAccessBadge access={item.access} />,
    },
    { header: "E-mail", cell: (item) => item.email ?? "-" },
    { header: "Telefone", cell: (item) => item.phone ?? "-" },
    { header: "UF", cell: (item) => item.state ?? "-" },
    {
      header: "Documento",
      className: "whitespace-nowrap",
      cell: (item) => item.document ?? "-",
    },
    {
      header: "Ações",
      sticky: "right",
      className: "whitespace-nowrap",
      cell: (item) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label="Visualizar inventariante"
            onClick={() => setViewingId(item.id)}
          >
            <Eye size={16} />
          </Button>
          {item.deleted_at ? (
            <PermissionGate permissions={["field-agents:reactivate"]}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirm({ action: "restore", item })}
              >
                Restaurar
              </Button>
            </PermissionGate>
          ) : (
            <>
              <PermissionGate permissions={["field-agents:update"]}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Editar inventariante"
                  onClick={() => setEditing(item)}
                >
                  <Pencil size={16} />
                </Button>
              </PermissionGate>
              {item.status === "active" ? (
                <>
                  <PermissionGate permissions={["field-agents:deactivate"]}>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Desativar inventariante"
                      onClick={() => setConfirm({ action: "deactivate", item })}
                    >
                      <UserX size={16} />
                    </Button>
                  </PermissionGate>
                  <PermissionGate permissions={["field-agents:block"]}>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Bloquear inventariante"
                      onClick={() => setConfirm({ action: "block", item })}
                    >
                      <Lock size={16} />
                    </Button>
                  </PermissionGate>
                </>
              ) : item.status === "blocked" ? (
                <PermissionGate permissions={["field-agents:unblock"]}>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Desbloquear inventariante"
                    onClick={() => setConfirm({ action: "unblock", item })}
                  >
                    <Unlock size={16} />
                  </Button>
                </PermissionGate>
              ) : (
                <PermissionGate permissions={["field-agents:reactivate"]}>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Reativar inventariante"
                    onClick={() => setConfirm({ action: "reactivate", item })}
                  >
                    <RotateCcw size={16} />
                  </Button>
                </PermissionGate>
              )}
              <PermissionGate permissions={["field-agents:delete"]}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Excluir inventariante"
                  onClick={() => setConfirm({ action: "delete", item })}
                >
                  <Trash2 size={16} />
                </Button>
              </PermissionGate>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Inventariantes"
        description="Cadastro e acompanhamento dos inventariantes da organização ativa."
        action={
          <div className="flex flex-wrap gap-2">
            {hasPermission("field-agents:export") ? (
              <Button
                type="button"
                variant="secondary"
                disabled={exporting}
                onClick={() => void exportList()}
              >
                <Download size={17} /> {exporting ? "Exportando..." : "Exportar Excel"}
              </Button>
            ) : null}
            {hasPermission("field-agents:create") && user?.organization_id ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus size={17} /> Novo inventariante
              </Button>
            ) : null}
          </div>
        }
      />
      <section
        aria-label="Indicadores de inventariantes"
        className="grid gap-3 sm:grid-cols-3"
      >
        <Kpi
          label="Inventariantes"
          value={count(summary.data?.total)}
          hint="Cadastros atuais da organização"
        />
        <Kpi
          label="UFs"
          value={count(summary.data?.states_count)}
          hint={
            summary.data?.without_state
              ? `${summary.data.without_state} sem UF informada`
              : "UFs distintas nos cadastros"
          }
        />
        <Kpi
          label="Exibidos"
          value={count(data?.totalItems)}
          hint="Resultado dos filtros atuais"
        />
      </section>
      <FilterPanel>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Buscar por nome, e-mail, telefone ou CPF/CNPJ"
        />
        <select
          aria-label="Cadastros atuais ou excluídos"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={deletion}
          onChange={(event) => {
            setDeletion(event.target.value as "current" | "deleted");
            setPage(1);
            resetSelection();
          }}
        >
          <option value="current">Cadastros atuais</option>
          <option value="deleted">Excluídos — restauração</option>
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as FieldAgentStatus | "");
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="blocked">Bloqueado</option>
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={state}
          onChange={(event) => {
            setState(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por UF"
        >
          <option value="">Todas as UFs</option>
          {BRAZILIAN_STATES.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
        {search || status || state ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setStatus("");
              setState("");
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
      </FilterPanel>
      {canBatchDelete && selected.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <span role="status">
            {selected.length} selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={resetSelection}>
              Limpar seleção
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void openBatchDelete()}
            >
              <Trash2 size={16} /> Excluir selecionados
            </Button>
          </div>
        </div>
      ) : null}
      {feedback ? (
        <p
          role={feedback.error ? "alert" : "status"}
          className={
            feedback.error
              ? "rounded-lg border p-3 text-sm text-destructive"
              : "rounded-lg border p-3 text-sm"
          }
        >
          {feedback.message}
        </p>
      ) : null}
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          message={(query.error as Error).message}
          onRetry={() => void query.refetch()}
        />
      ) : data ? (
        <>
          <DataTable
            columns={columns}
            items={data.items}
            getKey={(item) => item.id}
          />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        </>
      ) : null}

      <DrawerForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Novo inventariante"
      >
        <FieldAgentForm
          mode="create"
          busy={create.isPending}
          onSubmit={async (payload) => {
            await create.mutateAsync(payload);
            setCreateOpen(false);
            setFeedback({ message: "Inventariante cadastrado com sucesso." });
          }}
        />
      </DrawerForm>
      <DrawerForm
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Editar inventariante"
      >
        {editing ? (
          <FieldAgentForm
            mode="edit"
            initial={editing}
            busy={update.isPending}
            onSubmit={async (payload) => {
              await update.mutateAsync({ id: editing.id, payload });
              setEditing(null);
              setFeedback({ message: "Cadastro atualizado com sucesso." });
            }}
          />
        ) : null}
      </DrawerForm>
      <ConfirmDialog
        open={Boolean(batchConfirm)}
        onOpenChange={(open) => !open && setBatchConfirm(null)}
        title="Excluir inventariantes selecionados"
        description={batchDescription(selected.length, batchConfirm?.usage ?? [])}
        busy={batchDelete.isPending}
        onConfirm={() =>
          batchDelete.mutate(selected, {
            onSuccess: (result) => {
              setBatchConfirm(null);
              resetSelection();
              const failures = result.results
                .filter((item) => !item.deleted)
                .map((item) => `#${item.id}: ${item.message ?? "não excluído"}`);
              setFeedback({
                error: result.failed > 0,
                message:
                  `${result.deleted} inventariante(s) excluído(s). Lançamentos e histórico preservados.` +
                  (failures.length ? ` Não excluídos: ${failures.join("; ")}.` : ""),
              });
            },
            onError: (error) => {
              setBatchConfirm(null);
              setFeedback({ error: true, message: error.message });
            },
          })
        }
      />
      <FieldAgentDetailDrawer
        id={viewingId}
        open={Boolean(viewingId)}
        onOpenChange={(open) => !open && setViewingId(undefined)}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            setActionError(null);
          }
        }}
        title={`${actionLabel(confirm?.action)} inventariante`}
        description={
          actionError ||
          `Confirmar ${actionLabel(confirm?.action).toLowerCase()} de ${confirm?.item.name ?? "inventariante"}? O histórico será preservado. Bloqueio, desativação e exclusão impedem novas atuações, sem desativar a conta. Restauração retorna o cadastro como inativo.`
        }
        busy={
          deactivate.isPending ||
          reactivate.isPending ||
          block.isPending ||
          unblock.isPending ||
          deleteAgent.isPending ||
          restore.isPending
        }
        onConfirm={() => {
          if (!confirm) return;
          const mutations = {
            deactivate,
            reactivate,
            block,
            unblock,
            restore,
            delete: deleteAgent,
          };
          const mutation = mutations[confirm.action];
          setActionError(null);
          mutation.mutate(confirm.item.id, {
            onSuccess: () => {
              setConfirm(null);
              setFeedback({
                message: "Operação concluída. Histórico preservado.",
              });
            },
            onError: (error) => {
              setActionError(error.message);
              setFeedback({ error: true, message: error.message });
            },
          });
        }}
      />
    </PageContainer>
  );
}

/** Contagem para o KPI: "–" enquanto carrega. */
function count(value?: number) {
  return value == null ? "–" : value.toLocaleString("pt-BR");
}

function actionLabel(
  action?:
    | "deactivate"
    | "reactivate"
    | "block"
    | "unblock"
    | "delete"
    | "restore",
) {
  return (
    {
      deactivate: "Desativar",
      reactivate: "Reativar",
      block: "Bloquear",
      unblock: "Desbloquear",
      delete: "Excluir",
      restore: "Restaurar",
    } as const
  )[action ?? "deactivate"];
}
