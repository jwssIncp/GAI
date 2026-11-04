import { useEffect, useRef, useState } from "react";
import { useController, useForm, useWatch } from "react-hook-form";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserRound, ShieldCheck, KeyRound } from "lucide-react";
import { rbacApi, usersApi } from "@/api/endpoints";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { FormField } from "@/components/base/FormField";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-context";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import type { CreateUserRequest, UpdateUserRequest, User } from "@/types/api";
import { UserOrganizationSelect } from "./UserOrganizationSelect";
import { UserActions } from "./UserActions";
import {
  passwordHint,
  userSelectClass,
  userStatusLabels,
  validatePassword,
} from "./userFields";

type Options = Awaited<ReturnType<typeof usersApi.options>>;
type Values = {
  full_name: string;
  email: string;
  login: string;
  phone: string;
  job_title: string;
  organization: string;
  role_ids: number[];
  activation_method: "INVITATION" | "TEMPORARY_PASSWORD";
  password: string;
  acknowledge: boolean;
};

export function UserFormPage() {
  const { id } = useParams();
  const validId =
    id === undefined ||
    (/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)));
  const detail = useQuery({
    queryKey: ["users", "detail", Number(id)],
    queryFn: () => usersApi.get(Number(id)),
    enabled: id !== undefined && validId,
  });
  const options = useQuery({
    queryKey: ["users", "form-options"],
    queryFn: usersApi.options,
  });
  if (!validId)
    return (
      <PageContainer>
        <ErrorState message="Usuário inválido." />
      </PageContainer>
    );
  if (options.isLoading || (id && detail.isLoading))
    return (
      <PageContainer>
        <LoadingState label="Carregando cadastro" />
      </PageContainer>
    );
  if (options.isError || detail.isError)
    return (
      <PageContainer>
        <ErrorState
          message={(options.error || detail.error)?.message}
          onRetry={() => {
            void options.refetch();
            if (id) void detail.refetch();
          }}
        />
      </PageContainer>
    );
  if (!options.data || (id && !detail.data)) return null;
  return (
    <UserEditor key={id || "new"} user={detail.data} options={options.data} />
  );
}

function UserEditor({ user, options }: { user?: User; options: Options }) {
  const auth = useAuth();
  const { isPlatformAdmin } = usePermissions();
  const { toast } = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const saved = useRef(false);
  const form = useForm<Values>({
    defaultValues: {
      full_name: user?.full_name || "",
      email: user?.email || "",
      login: user?.login || "",
      phone: user?.phone || "",
      job_title: user?.job_title || "",
      organization: user
        ? user.organization_id
          ? String(user.organization_id)
          : "platform"
        : isPlatformAdmin
          ? ""
          : String(auth.user?.organization_id || ""),
      role_ids: user?.role_assignments.map((role) => role.role_id) || [],
      activation_method: options.invitation_available
        ? "INVITATION"
        : "TEMPORARY_PASSWORD",
      password: "",
      acknowledge: false,
    },
    mode: "onBlur",
  });
  const {
    register,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form;
  const organization = useWatch({ control, name: "organization" });
  const method = useWatch({ control, name: "activation_method" });
  const roles = useController({
    control,
    name: "role_ids",
    rules: {
      validate: (value) =>
        Boolean(user && !form.formState.dirtyFields.role_ids) || value.length > 0 || "Selecione pelo menos um perfil.",
    },
  });
  const profiles = useQuery({
    queryKey: ["access-profiles", "user-form", organization],
    queryFn: () =>
      rbacApi.profiles(
        organization === "platform" ? undefined : Number(organization),
      ),
    enabled: Boolean(organization),
  });
  const administrative = profiles.data?.some(
    (profile) =>
      profile.administrative && roles.field.value.includes(profile.id),
  );
  const blocker = useBlocker(() => !saved.current && isDirty);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<UpdateUserRequest | null>(null);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!saved.current && isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);
  const mutation = useMutation({
    mutationFn: (payload: CreateUserRequest | UpdateUserRequest) =>
      user
        ? usersApi.update(user.id, payload)
        : usersApi.create(payload as CreateUserRequest),
    onSuccess: async (result) => {
      saved.current = true;
      form.reset();
      setPending(null);
      await client.invalidateQueries({ queryKey: ["users"] });
      await client.invalidateQueries({ queryKey: ["access-profiles"] });
      if (user?.id === auth.user?.id) await auth.restore();
      toast({
        title: user ? "Usuário atualizado" : "Usuário cadastrado",
        description:
          result.invitation_delivery === "FAILED"
            ? "A conta está pendente: o convite não foi entregue. Use Reenviar convite após revisar o envio."
            : result.invitation_delivery === "DEVELOPMENT"
              ? "Convite disponível apenas na caixa de e-mail simulada do desenvolvimento."
              : undefined,
        tone: result.invitation_delivery === "FAILED" ? "error" : "success",
      });
      const remainsAdministrator = result.role_assignments.some(role => role.role_type === 'SYSTEM' && ['ORG_ADMIN', 'PLATFORM_ADMIN'].includes(role.role_key || ''));
      navigate(user?.id === auth.user?.id && !remainsAdministrator ? '/app/dashboard' : '/app/users');
    },
    onError: (failure) => {
      setError(failure.message);
      setPending(null);
    },
  });
  const busy = mutation.isPending || isSubmitting;
  const sectionClass = "premium-panel space-y-5 p-5 sm:p-7";
  const fieldGrid = "grid gap-5 sm:grid-cols-2";
  async function submit(values: Values) {
    setError("");
    if (!organization) {
      form.setError("organization", { message: "Selecione a organização." });
      return;
    }
    const sensitive =
      !user ||
      organization !==
        (user.organization_id ? String(user.organization_id) : "platform") ||
      roles.field.value.slice().sort().join() !==
        user.role_assignments
          .map((role) => role.role_id)
          .sort()
          .join();
    if (administrative && sensitive && !values.acknowledge) {
      form.setError("acknowledge", {
        message: "Confirme a concessão de acesso administrativo.",
      });
      return;
    }
    const payload: UpdateUserRequest = {
      full_name: values.full_name.trim(),
      email: values.email.trim().toLowerCase(),
      login: values.login.trim().toLowerCase(),
      phone: values.phone.trim() || null,
      job_title: values.job_title.trim() || null,
      organization_id:
        organization === "platform" ? null : Number(organization),
      role_ids: values.role_ids,
    };
    if (user) {
      // PATCH only touched fields: preserve legacy logins and unknown personal data.
      const dirty = form.formState.dirtyFields;
      for (const field of ['full_name', 'email', 'login', 'phone', 'job_title', 'role_ids'] as const) {
        if (!dirty[field]) delete payload[field];
      }
      if (!dirty.organization) delete payload.organization_id;
      if (sensitive) setPending(payload);
      else mutation.mutate(payload);
    } else
      mutation.mutate({
        ...payload,
        full_name: payload.full_name!,
        email: payload.email!,
        login: payload.login!,
        role_ids: values.role_ids,
        activation_method: values.activation_method,
        ...(values.activation_method === "TEMPORARY_PASSWORD"
          ? { password: values.password }
          : {}),
      });
  }
  return (
    <PageContainer>
      <nav
        aria-label="Breadcrumb"
        className="mb-5 text-sm text-muted-foreground"
      >
        <Link className="hover:underline" to="/app/users">
          Usuários
        </Link>
        <span aria-hidden="true"> / </span>
        {user ? "Editar usuário" : "Novo usuário"}
      </nav>
      <PageHeader
        title={user ? "Editar usuário" : "Cadastrar usuário"}
        description={
          user
            ? "Atualize identificação, organização e perfis de acesso."
            : "Identificação e acessos em um único cadastro."
        }
        action={
          <Button variant="secondary" onClick={() => navigate("/app/users")}>
            <ArrowLeft size={16} /> Voltar à listagem
          </Button>
        }
      />
      <form
        className="mx-auto grid max-w-5xl gap-6"
        noValidate
        onSubmit={form.handleSubmit(submit)}
      >
        <section className={sectionClass} aria-labelledby="user-information">
          <h2
            id="user-information"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <UserRound size={20} className="text-primary" /> Informações do
            usuário
          </h2>
          <div className={fieldGrid}>
            <FormField label="Nome completo" error={errors.full_name?.message} hint={user && !user.full_name ? 'Não informado no cadastro legado. Preencha quando conhecer este dado.' : undefined}>
              <Input
                required={!user || Boolean(user.full_name)}
                autoComplete="name"
                maxLength={160}
                {...register("full_name", {
                  validate: (value) =>
                    Boolean(user && !user.full_name && !value.trim()) || value.trim().length >= 3 || "Informe o nome completo.",
                  maxLength: { value: 160, message: "Use até 160 caracteres." },
                })}
              />
            </FormField>
            <FormField label="E-mail" error={errors.email?.message}>
              <Input
                required
                type="email"
                autoComplete="email"
                maxLength={255}
                {...register("email", {
                  validate: (value) =>
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
                    "Informe um e-mail válido.",
                })}
              />
            </FormField>
            <FormField label="Telefone" optional error={errors.phone?.message}>
              <Input
                type="tel"
                autoComplete="tel"
                maxLength={30}
                {...register("phone", {
                  pattern: {
                    value: /^[+\d() .-]*$/,
                    message: "Use números, espaços e sinais de telefone.",
                  },
                })}
              />
            </FormField>
            <FormField label="Cargo ou função" optional>
              <Input
                maxLength={120}
                autoComplete="organization-title"
                {...register("job_title")}
              />
            </FormField>
          </div>
        </section>
        <section className={sectionClass} aria-labelledby="user-access">
          <h2
            id="user-access"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <ShieldCheck size={20} className="text-primary" /> Organização e
            perfis de acesso
          </h2>
          {isPlatformAdmin ? (
            <UserOrganizationSelect
              value={organization}
              currentName={user?.organization_name || undefined}
              error={errors.organization?.message}
              disabled={busy}
              onChange={(value) => {
                form.setValue("organization", value, { shouldDirty: true });
                roles.field.onChange([]);
                form.setValue("acknowledge", false);
              }}
            />
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Organização:{" "}
              {user?.organization_name || `#${auth.user?.organization_id}`}. O
              vínculo é definido pelo seu escopo administrativo.
            </p>
          )}
          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-semibold">
              Perfis de acesso <span className="text-destructive">*</span>
            </legend>
            {!organization && (
              <p className="text-sm text-muted-foreground">
                Selecione uma organização para consultar os perfis concedíveis.
              </p>
            )}
            {profiles.isLoading && <LoadingState label="Carregando perfis" />}
            {profiles.isError && (
              <ErrorState
                message={profiles.error.message}
                onRetry={() => void profiles.refetch()}
              />
            )}
            {profiles.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Não há perfis concedíveis neste contexto.
              </p>
            )}
            {profiles.data?.map((profile) => (
              <label
                key={profile.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition hover:bg-muted/50"
              >
                <input
                  className="mt-1 size-4 accent-primary"
                  type="checkbox"
                  checked={roles.field.value.includes(profile.id)}
                  disabled={busy}
                  onChange={(event) => {
                    roles.field.onChange(
                      event.target.checked
                        ? [...roles.field.value, profile.id]
                        : roles.field.value.filter((id) => id !== profile.id),
                    );
                    form.setValue("acknowledge", false);
                  }}
                />
                <span>
                  <span className="text-sm font-semibold">{profile.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {profile.description || "Acessos definidos neste perfil."}
                    {profile.permission_count === 0 &&
                      " Este perfil não possui permissões próprias."}
                  </span>
                </span>
              </label>
            ))}
            {roles.fieldState.error && (
              <p role="alert" className="text-sm text-destructive">
                {roles.fieldState.error.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Os acessos de múltiplos perfis se somam. Um perfil restrito não
              reduz privilégios administrativos.
            </p>
            {administrative && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                <label className="flex gap-3 text-sm">
                  <input
                    className="mt-1 size-4"
                    type="checkbox"
                    {...register("acknowledge")}
                  />
                  Estou ciente de que os perfis selecionados concedem acesso
                  administrativo.
                </label>
                {errors.acknowledge && (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {errors.acknowledge.message}
                  </p>
                )}
              </div>
            )}
          </fieldset>
        </section>
        <section className={sectionClass} aria-labelledby="user-credentials">
          <h2
            id="user-credentials"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <KeyRound size={20} className="text-primary" /> Credenciais e
            ativação
          </h2>
          <FormField
            label="Login"
            hint="De 3 a 100 caracteres: letras, números, ponto, hífen ou sublinhado. Sem espaços ou @."
            error={errors.login?.message}
          >
            <Input
              required
              autoComplete="off"
              maxLength={100}
              {...register("login", {
                validate: (value) =>
                  /^[a-z0-9][a-z0-9._-]{2,99}$/.test(
                    value.trim().toLowerCase(),
                  ) || "Informe um login válido com 3 a 100 caracteres.",
              })}
            />
          </FormField>
          {!user ? (
            <>
              <FormField label="Forma de ativação">
                <select
                  className={userSelectClass}
                  {...register("activation_method")}
                >
                  <option
                    value="INVITATION"
                    disabled={!options.invitation_available}
                  >
                    Convite por e-mail{" "}
                    {options.invitation_available
                      ? "(recomendado)"
                      : "— envio não configurado"}
                  </option>
                  <option value="TEMPORARY_PASSWORD">
                    Senha temporária com troca obrigatória
                  </option>
                </select>
              </FormField>
              {!options.invitation_available && (
                <p className="text-sm text-muted-foreground">
                  O e-mail está em modo simulado neste ambiente. Use uma senha
                  temporária; o usuário deverá trocá-la antes de acessar os
                  módulos.
                </p>
              )}
              {method === "TEMPORARY_PASSWORD" && (
                <FormField
                  label="Senha temporária"
                  hint={passwordHint + (options.temporary_password_ttl_hours ? ` A senha temporária expira em ${options.temporary_password_ttl_hours} horas.` : '')}
                  error={errors.password?.message}
                >
                  <Input
                    required
                    type="password"
                    autoComplete="new-password"
                    {...register("password", {
                      validate: (value) =>
                        method !== "TEMPORARY_PASSWORD" ||
                        validatePassword(value),
                    })}
                  />
                </FormField>
              )}
              {method === "INVITATION" && (
                <p className="text-sm text-muted-foreground">
                  A conta ficará pendente até o usuário definir a senha pelo
                  convite. O link expira e só pode ser usado uma vez.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-4">
              <div>
                <p className="text-sm font-medium">
                  {userStatusLabels[user.status]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bloqueio, ativação, convite e redefinição de senha são ações
                  independentes, com confirmação.
                </p>
              </div>
              <UserActions user={user} />
            </div>
          )}
        </section>
        {error && (
          <div role="alert">
            <ErrorState message={error} />
          </div>
        )}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-border pt-5 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => navigate("/app/users")}
          >
            Cancelar
          </Button>
          <Button
            loading={busy}
            disabled={busy || (!user && (profiles.isError || profiles.isLoading))}
          >
            {user ? "Salvar alterações" : "Cadastrar usuário"}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
        title="Descartar alterações?"
        description="Há informações não salvas. Ao sair, essas alterações serão perdidas."
        onConfirm={() => blocker.state === "blocked" && blocker.proceed()}
      />
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setPending(null);
        }}
        title="Confirmar alteração de acessos"
        description="A organização e os perfis definem os acessos da conta. O último administrador será protegido."
        busy={mutation.isPending}
        onConfirm={() => pending && mutation.mutate(pending)}
      />
    </PageContainer>
  );
}

export function UserDetailPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["users", "detail", Number(id)],
    queryFn: () => usersApi.get(Number(id)),
    enabled: Boolean(id && /^[1-9]\d*$/.test(id)),
  });
  return (
    <PageContainer>
      <PageHeader
        title="Detalhes do usuário"
        action={
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold"
            to="/app/users"
          >
            Voltar à listagem
          </Link>
        }
      />
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : query.data ? (
        <section className="premium-panel max-w-4xl p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {query.data.full_name || query.data.login}
            </h2>
            <UserActions user={query.data} />
          </div>
          <dl className="grid gap-6 text-sm sm:grid-cols-2">
            {Object.entries({
              Login: query.data.login,
              "E-mail": query.data.email,
              Telefone: query.data.phone,
              "Cargo ou função": query.data.job_title,
              Organização:
                query.data.organization_name ||
                (query.data.organization_id
                  ? `#${query.data.organization_id}`
                  : "Plataforma"),
              Perfis: query.data.role_assignments
                .map((role) => role.role_name)
                .join(", "),
              Status: userStatusLabels[query.data.status],
              "Último acesso": query.data.last_login_at
                ? new Date(query.data.last_login_at).toLocaleString("pt-BR")
                : null,
            }).map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words font-medium">
                  {value || "Não informado"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <ErrorState message="Usuário inválido ou indisponível." />
      )}
    </PageContainer>
  );
}
