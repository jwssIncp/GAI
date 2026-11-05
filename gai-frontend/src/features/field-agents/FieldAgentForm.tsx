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
import { fieldAgentsApi } from "@/api/endpoints";

type Props =
  | {
      mode: "create";
      busy: boolean;
      onSubmit: (payload: CreateFieldAgentRequest) => Promise<void>;
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
  const form = useForm<FieldAgentFormValues>({
    resolver: zodResolver(makeFieldAgentSchema(initial?.document)),
    defaultValues: {
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      document: initial?.document ?? "",
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
          if (mode === "invite") {
            if (props.mode === "create" && !createdId.current) {
              const saved = await fieldAgentsApi.create(fields);
              createdId.current = saved.id;
            } else if (props.mode === "edit")
              await fieldAgentsApi.update(
                initial!.id,
                changedFields(fields, form.formState.dirtyFields),
              );
            const result = await fieldAgentsApi.invite(
              props.mode === "edit" ? initial!.id : createdId.current!,
              { login, email: fields.email! },
            );
            await queryClient.invalidateQueries({ queryKey: ["field-agents"] });
            setInvited(true);
            form.setError("root", {
              message:
                result.invitation_delivery === "SENT"
                  ? "Conta criada e convite enviado. Você pode fechar este formulário."
                  : "Conta criada e associada, mas o convite não foi entregue. Configure o e-mail e use Reenviar convite nos detalhes.",
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
          await props.onSubmit(payload as never);
        } catch (error) {
          const apiError = error as ApiError;
          const detail = apiError.details?.find(({ field }) =>
            ["email", "document", "phone", "user_id", "login"].includes(field),
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
          <p className="text-sm text-warning">
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
      </fieldset>
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
              funções administrativas ou financeiras.
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
