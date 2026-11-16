import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fieldAgentsApi } from "@/api/endpoints";
import { FormField } from "@/components/base/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, ModalForm } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-context";
import { usePermissions } from "@/features/auth/usePermissions";
import { emailLabel, userStatusLabels } from "@/features/users/userFields";
import { invitationDeliveryMessage } from "@/features/users/invitationDelivery";
import type { FieldAgent, FieldAgentTemporaryPasswordResult } from "@/types/api";
import { formatDateTime } from "@/utils/format";
import { FieldAgentAccessBadge } from "./FieldAgentAccessBadge";
import { fieldAgentAccessHint } from "./fieldAgentAccess";

const LOGIN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,99}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Mutações que devolvem a senha: saem do cache ao fechar o diálogo. */
const PASSWORD_MUTATION = ["field-agents", "temporary-password"] as const;
const ONE_TIME_PASSWORD_WARNING =
  "Esta senha não será exibida de novo. Entregue ao inventariante; ele deverá trocá-la no 1º acesso ao app.";

/** Conta de acesso do inventariante: situação, convite e senha temporária. */
export function FieldAgentAccessPanel({ agent }: { agent: FieldAgent }) {
  const { hasPermission, roles } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = agent.linked_user ?? null;
  const access = agent.access;
  const canManage =
    hasPermission("users:write") && hasPermission("field-agents:update");
  // Senha temporária: só o administrador da organização (regra da API).
  const canIssue = canManage && roles.includes("ORG_ADMIN") && !agent.deleted_at;
  const [createOpen, setCreateOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState<"reset" | "revoke" | null>(null);
  const [notice, setNotice] = useState("");
  // A senha vive só neste estado local, até o diálogo ser fechado.
  const [issued, setIssued] = useState<FieldAgentTemporaryPasswordResult | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["field-agents"] });
  const create = useMutation({
    mutationKey: PASSWORD_MUTATION,
    gcTime: 0,
    mutationFn: () =>
      fieldAgentsApi.createTemporaryAccess(agent.id, {
        login: login.trim().toLowerCase(),
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
      }),
    onSuccess: async (result) => {
      setCreateOpen(false);
      setLogin("");
      setEmail("");
      setIssued(result);
      await refresh();
    },
    onError: (error) => setFormError(error.message),
  });
  const reset = useMutation({
    mutationKey: PASSWORD_MUTATION,
    gcTime: 0,
    mutationFn: () => fieldAgentsApi.resetTemporaryAccess(agent.id),
    onSuccess: async (result) => {
      setConfirm(null);
      setIssued(result);
      await refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: () => fieldAgentsApi.revokeAccess(agent.id),
    onSuccess: async () => {
      setConfirm(null);
      toast({
        title: "Acesso revogado",
        description:
          "A senha foi invalidada e as sessões do app e da web foram encerradas.",
      });
      await refresh();
    },
  });
  const resend = useMutation({
    mutationFn: () => fieldAgentsApi.resendInvitation(agent.id),
    onSuccess: async (result) => {
      setNotice(invitationDeliveryMessage(result.invitation_delivery));
      await refresh();
    },
    onError: (error) => setNotice(error.message),
  });

  const closePassword = () => {
    setIssued(null);
    setCopied(false);
    // Tira a resposta (com a senha) do cache de mutações.
    create.reset();
    reset.reset();
    const mutations = queryClient.getMutationCache();
    for (const mutation of mutations.findAll({ mutationKey: PASSWORD_MUTATION }))
      mutations.remove(mutation);
  };
  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.temporary_password);
      setCopied(true);
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Selecione a senha e copie manualmente.",
        tone: "error",
      });
    }
  };
  const submitCreate = () => {
    setFormError("");
    if (!LOGIN.test(login.trim()))
      return setFormError(
        "Login: 3 a 100 letras, números, ponto, hífen ou sublinhado, sem @ ou espaços.",
      );
    if (email.trim() && !EMAIL.test(email.trim()))
      return setFormError("Informe um e-mail válido ou deixe em branco.");
    create.mutate();
  };

  const hint = fieldAgentAccessHint(access);
  return (
    <section className="grid gap-3 rounded-lg border p-4" aria-label="Conta de acesso">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Conta de acesso</h3>
        <FieldAgentAccessBadge access={access} />
      </div>
      {user ? (
        <>
          <p>{user.full_name || user.login}</p>
          <p className="break-all text-muted-foreground">
            Login: {user.login} · {emailLabel(user.email)}
          </p>
          <p>{userStatusLabels[user.status]}</p>
          {hint ? <p className="text-muted-foreground">{hint}</p> : null}
        </>
      ) : (
        <p>Sem conta de acesso associada.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!user && canIssue ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFormError("");
              setCreateOpen(true);
            }}
          >
            Criar acesso com senha temporária
          </Button>
        ) : null}
        {user?.status === "PENDING_ACTIVATION" && canManage ? (
          <Button
            type="button"
            variant="secondary"
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
          >
            Reenviar convite
          </Button>
        ) : null}
        {user && canIssue ? (
          <Button type="button" variant="secondary" onClick={() => setConfirm("reset")}>
            Redefinir senha temporária
          </Button>
        ) : null}
        {user && canIssue && access?.status !== "REVOKED" ? (
          <Button type="button" variant="ghost" onClick={() => setConfirm("revoke")}>
            Revogar acesso
          </Button>
        ) : null}
      </div>
      {!user && canManage ? (
        <p className="text-muted-foreground">
          Para convidar por e-mail, use Editar e escolha Convidar novo usuário.
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}

      <ModalForm
        open={createOpen}
        onOpenChange={(open) => {
          if (!create.isPending) setCreateOpen(open);
        }}
        title="Criar acesso com senha temporária"
      >
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitCreate();
          }}
        >
          <p className="text-sm text-muted-foreground">
            O sistema gera uma senha forte, mostrada uma única vez. O perfil de
            campo permite coleta apenas nos projetos com vínculo ativo e vigente.
          </p>
          <FormField label="Login de acesso">
            <Input
              required
              maxLength={100}
              autoComplete="off"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
            />
          </FormField>
          <FormField label="E-mail" optional hint="Sem e-mail, a recuperação de senha por e-mail não fica disponível.">
            <Input
              type="email"
              maxLength={255}
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          {formError ? (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              disabled={create.isPending}
              onClick={() => setCreateOpen(false)}
            >
              Voltar
            </Button>
            <Button type="submit" loading={create.isPending} disabled={create.isPending}>
              Criar acesso
            </Button>
          </div>
        </form>
      </ModalForm>

      <ConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            reset.reset();
          }
        }}
        title="Redefinir senha temporária"
        description="Uma nova senha será gerada e mostrada uma única vez. A senha atual deixa de valer, as sessões do app e da web são encerradas e um convite pendente é cancelado."
        variant="primary"
        confirmLabel="Gerar nova senha"
        busy={reset.isPending}
        error={reset.error?.message}
        onConfirm={() => reset.mutate()}
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            revoke.reset();
          }
        }}
        title="Revogar acesso"
        description="A senha deixa de valer e todas as sessões do app e da web são encerradas. O inventariante fica sem acesso até uma nova redefinição de senha."
        variant="danger"
        confirmLabel="Revogar acesso"
        busy={revoke.isPending}
        error={revoke.error?.message}
        onConfirm={() => revoke.mutate()}
      />

      <ModalForm
        open={Boolean(issued)}
        onOpenChange={(open) => {
          if (!open) closePassword();
        }}
        title="Senha temporária"
      >
        {issued ? (
          <div className="grid gap-4">
            <p className="text-sm">
              Login: <strong>{issued.linked_user.login}</strong>
            </p>
            <code
              aria-label="Senha gerada"
              className="select-all break-all rounded-lg border bg-muted px-4 py-3 text-center font-mono text-lg tracking-wider"
            >
              {issued.temporary_password}
            </code>
            <p role="alert" className="rounded-lg border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-text">
              {ONE_TIME_PASSWORD_WARNING}
            </p>
            {issued.temporary_password_expires_at ? (
              <p className="text-sm text-muted-foreground">
                Válida até {formatDateTime(issued.temporary_password_expires_at)}.
              </p>
            ) : null}
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => void copy()}>
                {copied ? "Copiada" : "Copiar senha"}
              </Button>
              <Button type="button" onClick={closePassword}>
                Concluir
              </Button>
            </div>
          </div>
        ) : null}
      </ModalForm>
    </section>
  );
}
