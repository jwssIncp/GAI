import { useMemo, useState } from "react";
import { useDebouncedValue } from "./useDebouncedValue";
import {
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
import { DataTable, type Column } from "@/components/base/DataTable";
import { FilterPanel } from "@/components/base/FilterPanel";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { Pagination } from "@/components/base/Pagination";
import { SearchInput } from "@/components/base/SearchInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, DrawerForm } from "@/components/ui/dialog";
import { PermissionGate } from "@/features/auth/PermissionGate";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import { FieldAgentDetailDrawer } from "./FieldAgentDetailDrawer";
import { FieldAgentForm } from "./FieldAgentForm";
import {
  useChangeFieldAgentStatus,
  useCreateFieldAgent,
  useDeleteFieldAgent,
  useFieldAgents,
  useUpdateFieldAgent,
} from "./fieldAgentsQueries";
import { formatDate } from "@/utils/format";
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
      deletion,
    }),
    [page, term, status, deletion],
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
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const data = query.data ? normalizePage(query.data) : null;

  const columns: Column<FieldAgent>[] = [
    {
      header: "Nome",
      cell: (item) => (
        <div className="font-medium">
          {item.name}
          <div className="text-xs text-muted-foreground">#{item.id}</div>
        </div>
      ),
    },
    { header: "Email", cell: (item) => item.email ?? "-" },
    { header: "Telefone", cell: (item) => item.phone ?? "-" },
    { header: "Documento", cell: (item) => item.document ?? "-" },
    { header: "Status", cell: (item) => <StatusBadge value={item.status} /> },
    { header: "Criado em", cell: (item) => formatDate(item.created_at) },
    {
      header: "Acoes",
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
          hasPermission("field-agents:create") && user?.organization_id ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={17} /> Novo inventariante
            </Button>
          ) : null
        }
      />
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
      </FilterPanel>
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
