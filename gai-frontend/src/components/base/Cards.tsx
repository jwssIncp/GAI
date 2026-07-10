import { ReactNode } from 'react';

export function MetricCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="premium-panel interactive-card group min-h-40 p-5 sm:p-6">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute -right-10 -top-12 size-32 rounded-full bg-primary/5 blur-3xl transition duration-500 group-hover:bg-primary/10" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-bold leading-none tracking-[-0.04em] text-foreground">{value}</p>
        </div>
        {icon ? <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/10 bg-primary-subtle text-primary shadow-inner-highlight transition duration-300 group-hover:scale-105 group-hover:shadow-glow">{icon}</div> : null}
      </div>
      {hint ? <p className="mt-5 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ProgressCard({ label, value }: { label: string; value: number }) {
  const normalized = Math.min(Math.max(value, 0), 100);
  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-panel">
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-bold text-primary">{normalized}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted shadow-inner" aria-hidden="true">
        <div className="h-full rounded-full bg-premium-gradient shadow-[0_0_16px_hsl(var(--primary)/0.45)] transition-all duration-700 ease-out" style={{ width: `${normalized}%` }} />
      </div>
      <span className="sr-only">{normalized}% concluido</span>
    </div>
  );
}
