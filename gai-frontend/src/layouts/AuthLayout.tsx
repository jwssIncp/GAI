import { Boxes, Fingerprint, Moon, ScanLine, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

export function AuthLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="grid min-h-dvh overflow-hidden bg-background lg:grid-cols-[minmax(520px,1.05fr)_minmax(480px,0.95fr)]">
      <aside className="relative hidden overflow-hidden border-r border-white/10 bg-[#090b19] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 opacity-70" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 18% 8%, hsl(244 86% 65% / .32), transparent 28rem), radial-gradient(circle at 92% 82%, hsl(184 88% 45% / .22), transparent 24rem)' }} />
        <div className="absolute inset-0 opacity-[0.08]" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '42px 42px', maskImage: 'linear-gradient(to bottom, black, transparent 88%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative grid size-11 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-sm font-black shadow-[0_0_40px_rgba(99,91,255,.35)]">
              G <Sparkles className="absolute -right-1 -top-1 opacity-50" size={17} />
            </div>
            <div>
              <div className="text-lg font-extrabold leading-none tracking-[-0.04em]">GAI</div>
              <div className="mt-1 text-[0.625rem] font-bold uppercase tracking-[0.2em] text-white/45">Asset intelligence</div>
            </div>
          </div>
          <div className="mt-16 max-w-2xl xl:mt-24">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-cyan-200 backdrop-blur">
              <ScanLine size={13} /> Operação patrimonial conectada
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.055em] xl:text-6xl">
              Decisões melhores começam com <span className="bg-gradient-to-r from-indigo-300 via-white to-cyan-200 bg-clip-text text-transparent">ativos sob controle.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/58">Inventário, auditoria e operação financeira em um workspace preciso, rastreável e preparado para escala.</p>
          </div>
        </div>
        <div className="relative z-10 grid gap-3 sm:grid-cols-3">
          <Capability icon={<Boxes size={17} />} label="Inventário" description="Visão unificada" />
          <Capability icon={<Fingerprint size={17} />} label="Rastreabilidade" description="Histórico confiável" />
          <Capability icon={<ShieldCheck size={17} />} label="Governança" description="Acesso por perfil" />
        </div>
      </aside>
      <main className="relative grid min-h-dvh place-items-center overflow-y-auto p-5 sm:p-8 lg:p-10 xl:p-14">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 90% 6%, hsl(var(--primary) / .1), transparent 24rem), radial-gradient(circle at 8% 96%, hsl(var(--chart-2) / .07), transparent 22rem)' }} />
        <button type="button" className="absolute right-5 top-5 z-20 grid size-10 place-items-center rounded-xl border border-border/70 bg-card/70 text-muted-foreground shadow-panel backdrop-blur transition hover:border-primary/30 hover:text-foreground sm:right-8 sm:top-8" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="relative z-10 w-full"><Outlet /></div>
      </main>
    </div>
  );
}

function Capability({ icon, label, description }: { icon: ReactNode; label: string; description: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.07)] backdrop-blur-xl">
      <span className="grid size-8 place-items-center rounded-lg bg-white/[0.08] text-cyan-200">{icon}</span>
      <p className="mt-3 text-xs font-bold">{label}</p>
      <p className="mt-1 text-[0.6875rem] text-white/45">{description}</p>
    </div>
  );
}
