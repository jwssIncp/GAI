import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff, LockKeyhole, LogIn, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { IconInput } from '@/components/ui/icon-input';
import { ApiError } from '@/api/http';
import { useAuth } from './AuthContext';

const schema = z.object({ identifier: z.string().min(1, 'Informe login ou email'), password: z.string().min(8, 'Senha minima de 8 caracteres') });

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError('');
    try {
      await login(values);
      window.location.assign((location.state as any)?.from?.pathname ?? '/app/dashboard');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'ACCOUNT_LOCKED' || apiError.status === 423) navigate('/account-locked');
      else setError(apiError.message || 'Credenciais invalidas');
    }
  }

  return (
    <section className="glass-surface mx-auto w-full max-w-[460px] rounded-2xl border border-border/80 bg-card/85 p-6 shadow-elevated sm:p-9">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <div className="grid size-10 place-items-center rounded-xl bg-premium-gradient text-sm font-black text-white shadow-glow">G</div>
        <div><p className="font-extrabold leading-none tracking-tight">GAI</p><p className="mt-1 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">Asset intelligence</p></div>
      </div>
      <div className="eyebrow"><Sparkles size={13} /> Acesso seguro</div>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em]">Entrar no GAI</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Acesse seu workspace de gestão patrimonial.</p>
      <form className="mt-8 grid gap-5" onSubmit={handleSubmit(onSubmit)}>
        {error ? <div role="alert" className="flex gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.07] p-3.5 text-sm font-medium text-destructive"><AlertCircle className="mt-0.5 shrink-0" size={16} /> {error}</div> : null}
        <FormField label="Login ou email" error={formState.errors.identifier?.message}>
          <IconInput icon={<Mail size={17} />} autoFocus autoComplete="username" placeholder="nome@empresa.com" {...register('identifier')} />
        </FormField>
        <FormField label="Senha" error={formState.errors.password?.message}>
          <IconInput
            icon={<LockKeyhole size={17} />}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Sua senha de acesso"
            endAdornment={(
              <button type="button" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar conteúdo do campo' : 'Exibir conteúdo do campo'} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
            {...register('password')}
          />
        </FormField>
        <div className="flex justify-end">
          <Link className="text-xs font-semibold text-primary transition hover:text-primary/80" to="/forgot-password">Esqueci minha senha</Link>
        </div>
        <Button size="lg" loading={formState.isSubmitting}><LogIn size={17} /> Entrar</Button>
      </form>
      <div className="mt-7 flex items-center justify-center gap-2 border-t border-border/70 pt-5 text-[0.6875rem] font-medium text-muted-foreground">
        <ShieldCheck size={14} className="text-success" /> Sessão protegida e acesso auditável
      </div>
    </section>
  );
}
