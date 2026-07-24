import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, Sparkles } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '@/api/endpoints';
import { EmptyState } from '@/components/base/States';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { IconInput } from '@/components/ui/icon-input';

export function ForgotPasswordPage() {
  const [done, setDone] = useState('');
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().email('Email invalido') })) });
  return (
    <AuthPanel title="Recuperar senha" description="Enviaremos as instruções para o seu email corporativo.">
      <form className="grid gap-5" onSubmit={form.handleSubmit(async ({ email }) => setDone((await authApi.requestPasswordReset(email)).message))}>
        <FormField label="Email" error={form.formState.errors.email?.message}>
          <IconInput icon={<Mail size={17} />} type="email" autoComplete="email" placeholder="nome@empresa.com" {...form.register('email')} />
        </FormField>
        <Button size="lg" loading={form.formState.isSubmitting}>Enviar instrucoes</Button>
      </form>
      {done ? <p className="mt-5 flex items-start gap-2 rounded-xl border border-success/20 bg-success-subtle p-3.5 text-sm text-success"><CheckCircle2 className="mt-0.5 shrink-0" size={16} />{done}</p> : null}
      <BackToLogin />
    </AuthPanel>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [done, setDone] = useState('');
  const form = useForm<{ token: string; new_password: string }>({
    defaultValues: { token: params.get('token') ?? '' },
    resolver: zodResolver(z.object({ token: z.string().min(1, 'Token obrigatorio'), new_password: z.string().min(8, 'Senha minima de 8 caracteres') })),
  });
  return (
    <AuthPanel title="Redefinir senha" description="Crie uma nova senha segura para continuar.">
      <form className="grid gap-5" onSubmit={form.handleSubmit(async ({ token, new_password }) => setDone((await authApi.confirmPasswordReset(token, new_password)).message))}>
        <FormField label="Token" error={form.formState.errors.token?.message}><IconInput icon={<KeyRound size={17} />} {...form.register('token')} /></FormField>
        <FormField label="Nova senha" error={form.formState.errors.new_password?.message}><IconInput icon={<KeyRound size={17} />} type="password" autoComplete="new-password" {...form.register('new_password')} /></FormField>
        <Button size="lg" loading={form.formState.isSubmitting}>Redefinir senha</Button>
      </form>
      {done ? <p className="mt-5 flex items-start gap-2 rounded-xl border border-success/20 bg-success-subtle p-3.5 text-sm text-success"><CheckCircle2 className="mt-0.5 shrink-0" size={16} />{done}</p> : null}
      <BackToLogin />
    </AuthPanel>
  );
}

export function SessionExpiredPage() {
  return <Message title="Sessao expirada" text="Entre novamente para continuar com seguranca." />;
}
export function AccessDeniedPage() {
  return <Message title="Acesso negado" text="Voce nao tem permissao para acessar este recurso." />;
}
export function AccountLockedPage() {
  return <Message title="Conta bloqueada" text="Muitas tentativas de login foram registradas. Aguarde ou acione um administrador." />;
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <section className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <EmptyState title={title} description={text} />
        <Link className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-premium-gradient px-5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-110" to="/login">Ir para login</Link>
      </div>
    </section>
  );
}

function AuthPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="glass-surface mx-auto w-full max-w-[460px] rounded-2xl border border-border/80 bg-card/85 p-6 shadow-elevated sm:p-9">
      <div className="eyebrow"><Sparkles size={13} /> Segurança da conta</div>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em]">{title}</h1>
      <p className="mb-8 mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function BackToLogin() {
  return <Link className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-primary transition hover:gap-2.5" to="/login"><ArrowLeft size={14} /> Voltar ao login</Link>;
}
