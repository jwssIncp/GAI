import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  changedFields,
  makeFieldAgentSchema,
  type FieldAgentFormValues,
} from "./fieldAgentSchemas";
import { FormField } from "@/components/base/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CreateFieldAgentRequest,
  FieldAgent,
  UpdateFieldAgentRequest,
} from "@/types/api";
import { ApiError } from "@/api/http";
import { maskDocument, maskPhone, isValidDocument } from "./brazilianContact";
import { FieldAgentUserSelect } from "./FieldAgentUserSelect";
import { usePermissions } from "@/features/auth/usePermissions";
import { fieldAgentsApi, projectFieldAgentsApi } from "@/api/endpoints";
import { BRAZILIAN_STATES } from "./brazilianStates";
import { FieldAgentProjectsPicker } from "./FieldAgentProjectsPicker";
import {
  FieldAgentDocumentsPanel,
  PendingDocumentsPicker,
  type PendingDocument,
} from "./FieldAgentDocumentsPanel";
import { uploadFieldAgentDocument } from "./fieldAgentsQueries";
import { invitationDeliveryMessage } from "@/features/users/invitationDelivery";

type Props =
  | {
      mode: "create";
      busy: boolean;
      /** Cria e devolve o inventariante (os documentos escolhidos são enviados em seguida). */
      onSubmit: (payload: CreateFieldAgentRequest) => Promise<FieldAgent>;
      /** Fim do cadastro; `warning` diz quais documentos não foram enviados. */
      onCreated: (warning: string | null) => void;
      initial?: never;
    }
  | {
      mode: "edit";
      busy: boolean;
      onSubmit: (payload: UpdateFieldAgentRequest) => Promise<void>;
      initial: FieldAgent;
    };
export function FieldAgentForm(props: Props) {
  const initial = props.initial;
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const context = useQuery({
    queryKey: ["field-agents", "context"],
    queryFn: fieldAgentsApi.context,
  });
  const createdId = useRef<number | null>(null);
  const [invited, setInvited] = useState(false);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const canAttachOnCreate =
    props.mode === "create" &&
    hasPermission("field-agent-documents:read") &&
    hasPermission("field-agent-documents:upload");
  /** Cadastro novo: envia os documentos escolhidos; devolve o aviso das falhas (ou null). */
  async function uploadPending(fieldAgentId: number): Promise<string | null> {
    if (!canAttachOnCreate || !pendingDocuments.length) return null;
    const failures: string[] = [];
    for (const item of pendingDocuments) {
      try {
        await uploadFieldAgentDocument(fieldAgentId, item.file, item.category);
      } catch (error) {
        failures.push(`${item.file.name}: ${(error as Error).message}`);
      }
    }
    setPendingDocuments([]);
    await queryClient.invalidateQueries({ queryKey: ["field-agents"] });
    return failures.length
      ? `Inventariante cadastrado, mas ${failures.length} documento(s) não foram anexados (${failures.join("; ")}). Anexe-os pela edição do cadastro.`
      : null;
  }
  const canLinkProjects =
    hasPermission("project-field-agents:assign") && hasPermission("projects:read");
  /** Na edição, vincula os projetos marcados (mesma regra do vínculo pelo projeto). */
  async function linkNewProjects(fieldAgentId: number) {
    const failures: string[] = [];
    for (const projectId of projectIds) {
      try {
        await projectFieldAgentsApi.assign(projectId, { field_agent_id: fieldAgentId });
      } catch (error) {
        failures.push((error as Error).message);
      }
    }
    if (projectIds.length) {
      await queryClient.invalidateQueries({ queryKey: ["field-agents"] });
      await queryClient.invalidateQueries({ queryKey: ["project-field-agents"] });
    }
    setProjectIds([]);
    if (failures.length)
      throw new Error(
        `Cadastro salvo, mas ${failures.length} vínculo(s) não foram criados: ${failures.join("; ")}`,
      );
  }
  const form = useForm<FieldAgentFormValues>({
    resolver: zodResolver(makeFieldAgentSchema(initial?.document)),
    defaultValues: {
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      document: initial?.document ?? "",
      state: initial?.state ?? "",
      city: initial?.city ?? "",
      referral: initial?.referral ?? "",
      user_id: initial?.user_id ? String(initial.user_id) : "",
      access: initial?.user_id ? "existing" : "none",
      login: "",
    },
  });
  const access = form.watch("access");
  const busy = props.busy || form.formState.isSubmitting;
  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors();
        try {
          const {
            access: mode,
            login,
            ...fields
          } = values as unknown as CreateFieldAgentRequest & {
            user_id: number | null;
            access: "none" | "existing" | "invite";
            login: string;
          };
          fields.user_id = mode === "existing" ? fields.user_id : null;
          if (props.mode === "create" && canLinkProjects && projectIds.length)
            fields.project_ids = projectIds;
          let documentsWarning: string | null = null;
          if (mode === "invite") {
            if (props.mode === "create" && !createdId.current) {
              const saved = await fieldAgentsApi.create(fields);
              createdId.current = saved.id;
              documentsWarning = await uploadPending(saved.id);
            } else if (props.mode === "edit") {
              await fieldAgentsApi.update(
                initial!.id,
                changedFields(fields, form.formState.dirtyFields),
              );
              await linkNewProjects(initial!.id);
            }
            const result = await fieldAgentsApi.invite(
              props.mode === "edit" ? initial!.id : createdId.current!,
              { login, email: fields.email! },
            );
            await queryClient.invalidateQueries({ queryKey: ["field-agents"] });
            setInvited(true);
            form.setError("root", {
              message:
                (result.invitation_delivery === "SENT"
                  ? "Conta criada e convite enviado. Você pode fechar este formulário."
                  : `Conta criada e associada. ${invitationDeliveryMessage(result.invitation_delivery)}`) +
                (documentsWarning ? ` ${documentsWarning}` : ""),
            });
            return;
          }
          const payload =
            props.mode === "edit"
              ? changedFields(fields, {
                  ...form.formState.dirtyFields,
                  ...(form.formState.dirtyFields.access
                    ? { user_id: true }
                    : {}),
                })
              : fields;
          if (props.mode === "create") {
            const saved = await props.onSubmit(payload as CreateFieldAgentRequest);
            props.onCreated(await uploadPending(saved.id));
            return;
          }
          await props.onSubmit(payload as never);
          await linkNewProjects(initial!.id);
        } catch (error) {
          const apiError = error as ApiError;
          const detail = apiError.details?.find(({ field }) =>
            ["email", "document", "phone", "state", "city", "referral", "user_id", "login"].includes(field),
          );
          if (detail)
            form.setError(detail.field as "email", { message: detail.message });
          else
            form.setError("root", {
              message:
                apiError.message || "Não foi possível salvar o inventariante",
            });
        }
      })}
    >
      <fieldset
        className="grid gap-4"
        disabled={busy || Boolean(createdId.current)}
      >
        <legend className="mb-3 font-semibold">Dados pessoais e contato</legend>
        <FormField label="Nome" error={form.formState.errors.name?.message}>
          <Input
            required
            maxLength={255}
            autoComplete="name"
            {...form.register("name")}
          />
        </FormField>
        <FormField
          label="CPF/CNPJ"
          optional
          error={form.formState.errors.document?.message}
        >
          <Input
            inputMode="numeric"
            {...form.register("document")}
            onChange={(event) =>
              form.setValue("document", maskDocument(event.target.value), {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
        </FormField>
        {initial?.document && !isValidDocument(initial.document) ? (
          <p className="text-sm text-warning-text">
            Documento legado pendente de revisão. Ele será preservado se você
            não alterar este campo.
          </p>
        ) : null}
        <FormField
          label="Email"
          optional={access !== "invite"}
          error={form.formState.errors.email?.message}
        >
          <Input
            type="email"
            required={access === "invite"}
            maxLength={255}
            autoComplete="email"
            {...form.register("email")}
          />
        </FormField>
        <FormField
          label="Telefone"
          optional
          error={form.formState.errors.phone?.message}
        >
          <Input
            inputMode="tel"
            autoComplete="tel"
            {...form.register("phone")}
            onChange={(event) =>
              form.setValue("phone", maskPhone(event.target.value), {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
        </FormField>
        <FormField
          label="UF"
          optional
          error={form.formState.errors.state?.message}
        >
          <select
            className="h-11 rounded-md border bg-background px-3 text-sm"
            {...form.register("state")}
          >
            <option value="">Não informada</option>
            {BRAZILIAN_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Cidade de residência"
          optional
          error={form.formState.errors.city?.message}
        >
          <Input maxLength={120} autoComplete="address-level2" {...form.register("city")} />
        </FormField>
        <FormField
          label="Indicação"
          optional
          help="Quem indicou o inventariante."
          error={form.formState.errors.referral?.message}
        >
          <Input maxLength={255} autoComplete="off" {...form.register("referral")} />
        </FormField>
      </fieldset>
      {canLinkProjects ? (
        <section className="grid gap-2">
          <h3 className="font-semibold">Projetos</h3>
          <FieldAgentProjectsPicker
            fieldAgentId={initial?.id}
            value={projectIds}
            onChange={setProjectIds}
            disabled={busy || invited || Boolean(createdId.current)}
          />
        </section>
      ) : null}
      {initial && hasPermission("field-agent-documents:read") ? (
        <FieldAgentDocumentsPanel fieldAgentId={initial.id} />
      ) : null}
      {canAttachOnCreate ? (
        <PendingDocumentsPicker
          value={pendingDocuments}
          onChange={setPendingDocuments}
          disabled={busy || invited || Boolean(createdId.current)}
        />
      ) : null}
      <fieldset className="grid gap-4" disabled={busy || invited}>
        <legend className="mb-3 font-semibold">Acesso ao sistema</legend>
        <FormField label="Forma de acesso">
          <select
            disabled={Boolean(createdId.current)}
            className="h-11 rounded-md border bg-background px-3 text-sm"
            {...form.register("access")}
          >
            <option value="none">Sem acesso</option>
            {hasPermission("users:read") ? (
              <option value="existing">Associar usuário existente</option>
            ) : null}
            {hasPermission("users:write") &&
            hasPermission("field-agents:update") &&
            !initial?.user_id ? (
              <option value="invite">Convidar novo usuário</option>
            ) : null}
          </select>
        </FormField>
        {access === "existing" ? (
          <FormField
            label="Usuário vinculado"
            error={form.formState.errors.user_id?.message}
            help="Vincula o inventariante a uma conta já cadastrada em Usuários e pertencente à mesma organização. Esse vínculo não altera os perfis ou a situação administrativa da conta."
          >
            <Controller
              name="user_id"
              control={form.control}
              render={({ field }) => (
                <FieldAgentUserSelect
                  value={field.value}
                  onChange={field.onChange}
                  currentId={initial?.id}
                />
              )}
            />
          </FormField>
        ) : null}
        {access === "invite" ? (
          <>
            <FormField
              label="Login de acesso"
              error={form.formState.errors.login?.message}
            >
              <Input
                required
                maxLength={100}
                autoComplete="off"
                {...form.register("login")}
              />
            </FormField>
            <p className="text-sm text-muted-foreground">
              A pessoa definirá a senha pelo convite. O perfil de campo permite
              coleta apenas nos projetos com vínculo ativo e vigente, sem
              funções administrativas ou financeiras. Sem e-mail, crie o acesso
              com senha temporária nos detalhes do inventariante.
            </p>
          </>
        ) : null}
        <p className="text-sm text-muted-foreground">
          A situação da conta, a situação operacional e os vínculos com projetos
          são independentes.
        </p>
      </fieldset>
      <section className="rounded-lg border bg-muted/30 p-4 text-sm">
        <h3 className="mb-2 font-semibold">Informações operacionais</h3>
        <p>
          Organização:{" "}
          {initial?.organization_name ||
            context.data?.organization_name ||
            "Organização da sessão atual"}
        </p>
        <p>
          Situação:{" "}
          {initial
            ? { active: "Ativo", inactive: "Inativo", blocked: "Bloqueado" }[
                initial.status
              ]
            : "Ativo após o cadastro"}
        </p>
        <p className="mt-2 text-muted-foreground">
          Bloquear ou desativar impede novas atuações e preserva o histórico.
          Use as ações da listagem para alterar a situação.
        </p>
      </section>
      {form.formState.errors.root?.message ? (
        <p role="alert" className="rounded-lg border p-3 text-sm">
          {form.formState.errors.root.message}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || invited}>
        {busy
          ? "Salvando..."
          : props.mode === "create"
            ? "Salvar inventariante"
            : "Atualizar inventariante"}
      </Button>
    </form>
  );
}
