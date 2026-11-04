import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/base/FormField";
import { ErrorState } from "@/components/base/States";
import { useToast } from "@/components/ui/toast-context";
import { usePermissions } from "@/features/auth/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import type { User } from "@/types/api";
import { passwordHint, validatePassword } from "./userFields";

type Action =
  | "block"
  | "unblock"
  | "deactivate"
  | "activate"
  | "resendInvitation";
const actionLabels: Record<Action, string> = {
  block: "Bloquear usuário",
  unblock: "Desbloquear usuário",
  deactivate: "Desativar usuário",
  activate: "Reativar usuário",
  resendInvitation: "Reenviar convite",
};
export function UserActions({ user }: { user: User }) {
  const { hasPermission } = usePermissions();
  const auth = useAuth();
  const { toast } = useToast();
  const client = useQueryClient();
  const [action, setAction] = useState<Action | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["users"] });
    if (auth.user?.id === user.id) await auth.restore();
  };
  const operation = useMutation<
    User | { invitation_delivery: string },
    Error,
    Action
  >({
    mutationFn: async (value: Action) => usersApi[value](user.id),
    onSuccess: async (result) => {
      await refresh();
      setAction(null);
      const delivery =
        "invitation_delivery" in result
          ? result.invitation_delivery
          : undefined;
      toast({
        title:
          delivery === "FAILED"
            ? "Não foi possível entregar o convite"
            : delivery === "DEVELOPMENT"
              ? "Convite preparado em desenvolvimento"
              : "Operação concluída",
        description:
          delivery === "DEVELOPMENT"
            ? "O serviço de e-mail está em modo simulado; nenhum e-mail foi enviado."
            : delivery === "FAILED"
              ? "A conta permanece pendente. Revise o envio e tente novamente."
              : undefined,
        tone: delivery === "FAILED" ? "error" : "success",
      });
    },
  });
  const reset = useMutation({
    mutationFn: () => usersApi.resetPassword(user.id, password),
    onSuccess: async () => {
      setPassword("");
      setPasswordOpen(false);
      await refresh();
      toast({
        title: "Senha temporária definida",
        description:
          "Sessões encerradas. A troca será exigida no próximo acesso.",
        tone: "success",
      });
    },
  });
  const canWrite = hasPermission("users:write");
  const itemClass =
    "flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-muted focus:bg-muted";
  const actions: Action[] =
    user.status === "PENDING_ACTIVATION"
      ? ["resendInvitation", "deactivate"]
      : user.status === "INACTIVE"
        ? ["activate"]
        : user.status === "BLOCKED" || user.status === "LOCKED"
          ? ["unblock", "deactivate"]
          : ["block", "deactivate"];
  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Ações de ${user.full_name || user.login}`}
          >
            <MoreHorizontal size={18} />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            align="end"
            sideOffset={5}
            className="z-30 min-w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-elevated"
          >
            <Dropdown.Item asChild>
              <Link className={itemClass} to={`/app/users/${user.id}`}>
                Visualizar detalhes
              </Link>
            </Dropdown.Item>
            {canWrite && (
              <>
                <Dropdown.Item asChild>
                  <Link className={itemClass} to={`/app/users/${user.id}/edit`}>
                    Editar usuário
                  </Link>
                </Dropdown.Item>
                <Dropdown.Item asChild>
                  <Link
                    className={itemClass}
                    to={`/app/roles?user_id=${user.id}${user.organization_id ? `&organization_id=${user.organization_id}` : ""}`}
                  >
                    Gerenciar perfis
                  </Link>
                </Dropdown.Item>
                {actions.map((value) => (
                  <Dropdown.Item
                    key={value}
                    className={itemClass}
                    onSelect={() => {
                      operation.reset();
                      setAction(value);
                    }}
                  >
                    {actionLabels[value]}
                  </Dropdown.Item>
                ))}
                {user.status !== "PENDING_ACTIVATION" && (
                  <Dropdown.Item
                    className={itemClass}
                    onSelect={() => {
                      reset.reset();
                      setPasswordError("");
                      setPasswordOpen(true);
                    }}
                  >
                    Redefinir senha
                  </Dropdown.Item>
                )}
              </>
            )}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      <ConfirmDialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !operation.isPending) setAction(null);
        }}
        title={action ? actionLabels[action] : ""}
        description={
          operation.isError
            ? operation.error.message
            : `Confirme a operação para ${user.full_name || user.login}. Alterações no estado da conta encerram as sessões. O último administrador será protegido.`
        }
        busy={operation.isPending}
        onConfirm={() => action && operation.mutate(action)}
      />
      <ModalForm
        open={passwordOpen}
        onOpenChange={(open) => {
          if (!reset.isPending) {
            setPasswordOpen(open);
            if (!open) setPassword("");
          }
        }}
        title={`Redefinir senha de ${user.login}`}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const result = validatePassword(password);
            if (result !== true) setPasswordError(result);
            else reset.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">
            Esta ação encerra todas as sessões e exige a troca da senha no
            próximo acesso.
          </p>
          <FormField
            label="Senha temporária"
            hint={passwordHint}
            error={passwordError}
          >
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError("");
              }}
            />
          </FormField>
          {reset.isError && <ErrorState message={reset.error.message} />}
          <Button loading={reset.isPending}>Confirmar redefinição</Button>
        </form>
      </ModalForm>
    </>
  );
}
