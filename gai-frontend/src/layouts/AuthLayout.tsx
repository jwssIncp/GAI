import { Boxes, Fingerprint, Moon, ScanLine, ShieldCheck, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { GaiLogo } from '@/components/base/GaiLogo';

export function AuthLayout() {
  const { theme, toggleTheme, preference, setTheme } = useTheme();

  return (
    <div className="grid min-h-dvh overflow-hidden bg-background lg:grid-cols-[minmax(520px,1.05fr)_minmax(480px,0.95fr)]">
      <aside className="relative hidden overflow-hidden border-r border-white/10 bg-brand-ink p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 opacity-80" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 18% 8%, hsl(var(--primary) / .3), transparent 28rem), radial-gradient(circle at 92% 82%, hsl(var(--brand-navy) / .85), transparent 28rem)' }} />
        <div className="absolute inset-0 opacity-[0.08]" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '42px 42px', maskImage: 'linear-gradient(to bottom, black, transparent 88%)' }} />
        <div className="relative z-10">
          <GaiLogo appearance="dark" className="w-60" />
          <div className="mt-16 max-w-2xl xl:mt-24">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-primary backdrop-blur">
              <ScanLine size={13} /> Operação patrimonial conectada
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.055em] xl:text-6xl">
              Decisões melhores começam com <span className="bg-gradient-to-r from-primary via-white to-primary bg-clip-text text-transparent">ativos sob controle.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75">Inventário, auditoria e operação financeira em um ambiente preciso e rastreável.</p>
          </div>
        </div>
        <div className="relative z-10 grid gap-3 sm:grid-cols-3">
          <Capability icon={<Boxes size={17} />} label="Inventário" description="Visão unificada" />
          <Capability icon={<Fingerprint size={17} />} label="Rastreabilidade" description="Histórico confiável" />
          <Capability icon={<ShieldCheck size={17} />} label="Governança" description="Acesso por perfil" />
        </div>
      </aside>
      <main className="relative grid min-h-dvh place-items-center overflow-y-auto px-5 pb-8 pt-24 sm:px-8 lg:p-10 xl:p-14">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 90% 6%, hsl(var(--primary) / .1), transparent 24rem), radial-gradient(circle at 8% 96%, hsl(var(--chart-2) / .07), transparent 22rem)' }} />
        <div className="absolute right-5 top-5 z-20 flex items-center gap-2 sm:right-8 sm:top-8">
        <button type="button" className="min-h-11 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted" aria-pressed={preference === 'system'} onClick={() => setTheme('system')}>Tema do sistema</button>
        <button type="button" className="grid size-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/30 hover:text-foreground" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        </div>
        <div className="relative z-10 w-full"><Outlet /></div>
      </main>
    </div>
  );
}

function Capability({ icon, label, description }: { icon: ReactNode; label: string; description: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.07)] backdrop-blur-xl">
      <span className="grid size-8 place-items-center rounded-lg bg-primary/[0.09] text-primary">{icon}</span>
      <p className="mt-3 text-xs font-bold">{label}</p>
      <p className="mt-1 text-[0.6875rem] text-white/75">{description}</p>
    </div>
  );
}
