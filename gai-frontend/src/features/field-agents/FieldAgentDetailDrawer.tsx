import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fieldAgentsApi } from "@/api/endpoints";
import { DrawerForm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Pagination } from "@/components/base/Pagination";
import { StatusBadge } from "@/components/base/StatusBadge";
import { useFieldAgent } from "./fieldAgentsQueries";
import { formatDate, formatDateTime } from "@/utils/format";
import { userStatusLabels } from "@/features/users/userFields";
import { usePermissions } from "@/features/auth/usePermissions";

const operationNames: Record<string, string> = {
  CREATE: "Cadastro criado",
  UPDATE: "Dados atualizados",
  DEACTIVATE: "Desativação",
  REACTIVATE: "Reativação",
  BLOCK: "Bloqueio",
  UNBLOCK: "Desbloqueio",
  DELETE: "Exclusão",
  RESTORE: "Restauração",
  INVITE_USER: "Conta convidada",
  ASSIGN_TO_PROJECT: "Vinculação ao projeto",
  UPDATE_PROJECT_ASSIGNMENT: "Vínculo atualizado",
  REMOVE_FROM_PROJECT: "Vínculo finalizado",
};
const fieldNames: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  document: "CPF/CNPJ",
  user_id: "Conta associada",
  status: "Situação",
  deleted_at: "Exclusão",
  organization_id: "Organização",
  project_id: "Projeto",
  field_agent_id: "Inventariante",
  role: "Função no projeto",
  start_date: "Início",
  end_date: "Fim",
  notes: "Observações",
};
const historyValue = (value: unknown) =>
  value === null || value === undefined ? "Não informado" : String(value);
export function FieldAgentDetailDrawer({
  id,
  open,
  onOpenChange,
}: {
  id?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useFieldAgent(open ? id : undefined),
    item = query.data;
  const [projectPage, setProjectPage] = useState(1),
    [historyPage, setHistoryPage] = useState(1);
  const [notice, setNotice] = useState("");
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const projects = useQuery({
    queryKey: ["field-agents", id, "projects", projectPage],
    queryFn: () =>
      fieldAgentsApi.projects(id!, { page: projectPage, page_size: 10 }),
    enabled: open && Boolean(id) && hasPermission("project-field-agents:read"),
  });
  const history = useQuery({
    queryKey: ["field-agents", id, "history", historyPage],
    queryFn: () =>
      fieldAgentsApi.history(id!, { page: historyPage, page_size: 10 }),
    enabled: open && Boolean(id) && hasPermission("field-agents:read"),
  });
  const resend = useMutation({
    mutationFn: () => fieldAgentsApi.resendInvitation(id!),
    onSuccess: async (result) => {
      setNotice(
        result.invitation_delivery === "SENT"
          ? "Convite enviado."
          : "O convite não foi entregue. Verifique a configuração e a disponibilidade do serviço de e-mail.",
      );
      await queryClient.invalidateQueries({ queryKey: ["field-agents"] });
    },
    onError: (error) => setNotice(error.message),
  });
  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title="Detalhes do inventariante"
    >
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : item ? (
        <div className="grid gap-5 text-sm">
          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-semibold">{item.name}</h2>
            <StatusBadge value={item.status} />
            {item.deleted_at ? (
              <p className="mt-2 text-destructive">
                Cadastro excluído. Novas atuações não são permitidas.
              </p>
            ) : item.status !== "active" ? (
              <p className="mt-2 text-warning">
                Novas atuações estão impedidas pela situação operacional.
              </p>
            ) : null}
          </section>
          <Info
            label="Organização"
            value={item.organization_name || "Organização da sessão"}
          />
          <Info label="Email" value={item.email} />
          <Info label="Telefone" value={item.phone} />
          <Info label="CPF/CNPJ" value={item.document} />
          <section className="grid gap-3 rounded-lg border p-4">
            <h3 className="font-semibold">Conta de acesso</h3>
            {item.linked_user ? (
              <>
                <p>{item.linked_user.full_name || item.linked_user.login}</p>
                <p className="break-all text-muted-foreground">
                  {item.linked_user.email}
                </p>
                <p>{userStatusLabels[item.linked_user.status]}</p>
                {item.linked_user.status === "PENDING_ACTIVATION" &&
                hasPermission("users:write") &&
                hasPermission("field-agents:update") ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={resend.isPending}
                    onClick={() => resend.mutate()}
                  >
                    Reenviar convite
                  </Button>
                ) : null}
              </>
            ) : (
              <p>Sem conta de acesso associada.</p>
            )}
            <p className="text-muted-foreground">
              O bloqueio operacional não desativa a conta administrativa.
              Vínculos inativos ou finalizados não são reativados
              automaticamente.
            </p>
            {notice ? <p role="status">{notice}</p> : null}
          </section>
          <section className="grid gap-3">
            <h3 className="font-semibold">Projetos vinculados</h3>
            {!hasPermission("project-field-agents:read") ? (
              <p>Você não possui permissão para consultar os vínculos.</p>
            ) : projects.isLoading ? (
              <LoadingState />
            ) : projects.isError ? (
              <ErrorState
                message={projects.error.message}
                onRetry={() => void projects.refetch()}
              />
            ) : (
              <>
                {!projects.data?.items.length ? (
                  <p className="text-muted-foreground">
                    Nenhum projeto vinculado.
                  </p>
                ) : (
                  projects.data.items.map((link) => (
                    <div key={link.id} className="rounded-lg border p-3">
                      <p className="font-medium">{link.project_name}</p>
                      <p>{link.role || "Função não informada"}</p>
                      <StatusBadge value={link.status} />
                      <p className="mt-2 text-muted-foreground">
                        {formatDate(link.start_date)} —{" "}
                        {formatDate(link.end_date)}
                      </p>
                    </div>
                  ))
                )}
                {projects.data ? (
                  <Pagination
                    page={projectPage}
                    totalPages={projects.data.total_pages}
                    onPageChange={setProjectPage}
                  />
                ) : null}
              </>
            )}
          </section>
          <section className="grid gap-3">
            <h3 className="font-semibold">Histórico de alterações</h3>
            {history.isLoading ? (
              <LoadingState />
            ) : history.isError ? (
              <ErrorState
                message={history.error.message}
                onRetry={() => void history.refetch()}
              />
            ) : (
              <>
                {!history.data?.items.length ? (
                  <p className="text-muted-foreground">
                    Não há eventos disponíveis. Registros antigos podem não
                    possuir trilha completa.
                  </p>
                ) : (
                  history.data.items.map((event) => (
                    <details key={event.id} className="rounded-lg border p-3">
                      <summary className="cursor-pointer font-medium">
                        {operationNames[event.operation] ||
                          "Alteração cadastral"}{" "}
                        · {formatDateTime(event.created_at)}
                      </summary>
                      <p className="mt-2 text-muted-foreground">
                        Por {event.performed_by_name}
                      </p>
                      <dl className="mt-3 grid gap-3">
                        {Object.entries(event.changes).map(
                          ([field, change]) => (
                            <div
                              key={field}
                              className="break-words border-t pt-2"
                            >
                              <dt className="font-medium">
                                {fieldNames[field] || "Informação cadastral"}
                              </dt>
                              <dd>Anterior: {historyValue(change.before)}</dd>
                              <dd>Atual: {historyValue(change.after)}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </details>
                  ))
                )}
                {history.data ? (
                  <Pagination
                    page={historyPage}
                    totalPages={history.data.total_pages}
                    onPageChange={setHistoryPage}
                  />
                ) : null}
              </>
            )}
          </section>
          <Info label="Criado em" value={formatDateTime(item.created_at)} />
          <Info label="Atualizado em" value={formatDateTime(item.updated_at)} />
        </div>
      ) : null}
    </DrawerForm>
  );
}
function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 border-b pb-2 sm:grid-cols-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium">
        {value || "Não informado"}
      </span>
    </div>
  );
}
