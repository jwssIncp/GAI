import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { authApi } from "@/api/endpoints";
import { useAuth } from "./AuthContext";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { FormField } from "@/components/base/FormField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { passwordHint, validatePassword } from "@/features/users/userFields";

function CredentialForm({
  activation,
  token,
}: {
  activation?: boolean;
  token?: string;
}) {
  const [done, setDone] = useState("");
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const form = useForm<{
    current: string;
    password: string;
    confirmation: string;
  }>();
  if (done)
    return (
      <div className="grid gap-5">
        <p
          role="status"
          className="rounded-xl bg-success-subtle p-4 text-sm text-success"
        >
          {done}
        </p>
        <Link
          className="text-sm font-semibold text-primary hover:underline"
          to="/login"
        >
          Entrar com a nova senha
        </Link>
      </div>
    );
  if (activation && !token)
    return (
      <p role="alert" className="text-sm text-destructive">
        O convite está incompleto. Solicite um novo convite ao administrador.
      </p>
    );
  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(async (values) => {
        setError("");
        try {
          const result = activation
            ? await authApi.activate(token!, values.password)
            : await authApi.changePassword(values.current, values.password);
          if (!activation) {
            // Leave the protected route before clearing its identity, so its guard
            // cannot replace the success navigation with an obsolete return path.
            navigate("/login", {
              replace: true,
              state: { passwordChanged: true },
              flushSync: true,
            });
            await logout({ sessionRevoked: true });
            return;
          }
          form.reset();
          setDone(result.message);
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Não foi possível concluir. Tente novamente.",
          );
        }
      })}
    >
      {!activation && (
        <FormField
          label="Senha atual ou temporária"
          error={form.formState.errors.current?.message}
        >
          <Input
            required
            autoComplete="current-password"
            type="password"
            {...form.register("current", {
              required: "Informe a senha atual.",
            })}
          />
        </FormField>
      )}
      <FormField
        label="Nova senha"
        hint={passwordHint}
        error={form.formState.errors.password?.message}
      >
        <Input
          required
          type="password"
          autoComplete="new-password"
          {...form.register("password", { validate: validatePassword })}
        />
      </FormField>
      <FormField
        label="Confirmar nova senha"
        error={form.formState.errors.confirmation?.message}
      >
        <Input
          required
          type="password"
          autoComplete="new-password"
          {...form.register("confirmation", {
            validate: (value) =>
              value === form.getValues("password") ||
              "As senhas devem ser iguais.",
          })}
        />
      </FormField>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
          {activation &&
            " Se o convite expirou, solicite o reenvio ao administrador."}
        </p>
      )}
      <Button loading={form.formState.isSubmitting}>
        {activation ? "Ativar minha conta" : "Alterar senha e encerrar sessões"}
      </Button>
    </form>
  );
}
export function ActivateAccountPage() {
  const location = useLocation();
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  useEffect(() => {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
  }, []);
  return (
    <section className="glass-surface mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-9">
      <p className="eyebrow">Bem-vindo ao GAI</p>
      <h1 className="mb-3 mt-2 text-2xl font-bold">Ative sua conta</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Defina sua senha pessoal para concluir o convite. O link é temporário e
        de uso único.
      </p>
      <CredentialForm activation token={token} />
    </section>
  );
}
export function ChangePasswordPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Alterar senha"
        description="Após a troca, todas as sessões serão encerradas e uma nova autenticação será necessária."
      />
      <section className="premium-panel max-w-2xl p-5 sm:p-7">
        <CredentialForm />
      </section>
    </PageContainer>
  );
}
