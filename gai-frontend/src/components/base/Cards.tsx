import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'brand';
}) {
  const branded = tone === 'brand';
  return (
    <div className={cn(
      'premium-panel group min-h-36 p-5 sm:p-6',
      branded && 'border-primary/35 bg-primary-subtle text-foreground',
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.71875rem] font-semibold uppercase leading-5 tracking-[0.07em] text-muted-foreground">{label}</p>
          <p className="mt-3 break-words font-display text-[1.625rem] font-bold leading-tight text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
        </div>
        {icon ? <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary-subtle text-primary-text">{icon}</div> : null}
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
      <span className="sr-only">{normalized}% concluído</span>
    </div>
  );
}

export type KpiTone = 'default' | 'danger' | 'warning' | 'highlight';

/**
 * Indicador compacto (KPI) das telas: rótulo, valor (algarismos tabulares, sem quebra),
 * dica e nota de aviso opcionais.
 * - `tone`: "danger" (borda e valor vermelhos), "warning" (borda âmbar), "highlight" (borda primária, ex.: valor simulado).
 * - `negative`: só o valor em vermelho (ex.: saldo negativo).
 * - `onClick` + `active`: vira botão de filtro (aria-pressed).
 * - `children`: linha extra abaixo do valor (ex.: "sem a venda: R$ …").
 */
export function Kpi({ label, value, hint, note, tone = 'default', negative = false, active, onClick, children }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Aviso curto (texto âmbar AA). */
  note?: ReactNode;
  tone?: KpiTone;
  negative?: boolean;
  active?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('numeric text-lg font-semibold', (negative || tone === 'danger') && 'text-destructive-text')}>{value}</p>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {note ? <p className="text-xs text-warning-text">{note}</p> : null}
    </>
  );
  const className = cn(
    'rounded-lg border bg-card p-3 text-left',
    tone === 'danger' && 'border-destructive/50',
    tone === 'warning' && 'border-warning/50',
    tone === 'highlight' && 'border-primary/60',
    active && 'ring-2 ring-primary',
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" className={cn(className, 'hover:bg-primary/[0.05]')} aria-pressed={Boolean(active)} onClick={onClick}>
      {body}
    </button>
  );
}
