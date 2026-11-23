import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Card de métrica (padrão do sistema anterior): borda fina, barra lateral azul-aço (verde no tom "brand"). */
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
      'group relative min-h-[112px] overflow-hidden rounded-lg border border-border bg-card py-3.5 pl-[18px] pr-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-steel before:content-[""]',
      branded && 'border-primary/40 bg-primary-subtle text-foreground before:bg-primary',
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.71875rem] font-semibold uppercase leading-5 tracking-[0.07em] text-muted-foreground">{label}</p>
          <p className="mt-1.5 break-words font-display text-[clamp(1.25rem,1.7vw,1.625rem)] font-bold leading-tight text-navy [font-variant-numeric:tabular-nums] dark:text-foreground">{value}</p>
        </div>
        {icon ? <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-steel-tint text-steel-dark dark:text-steel">{icon}</div> : null}
      </div>
      {hint ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
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
 * Grupo de cor do card (padrão do sistema anterior): cada linha de cards tem uma cor
 * na borda e na barra lateral; o 1º card da linha pode ter o fundo tingido (`tinted`).
 */
export type KpiGroup = 'month' | 'next' | 'year' | 'indicators';

const kpiGroup: Record<KpiGroup, { accent: string; tint: string }> = {
  month: { accent: 'border-kpi-month before:bg-kpi-month', tint: 'bg-kpi-month-bg' },
  next: { accent: 'border-kpi-next before:bg-kpi-next', tint: 'bg-kpi-next-bg' },
  year: { accent: 'border-kpi-year before:bg-kpi-year', tint: 'bg-kpi-year-bg' },
  indicators: { accent: 'border-kpi-indicators before:bg-kpi-indicators', tint: 'bg-kpi-indicators-bg' },
};

/** Grade de KPIs: colunas automáticas de no mínimo 215px (uma por linha no celular). */
export function KpiGrid({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div role={label ? 'group' : undefined} aria-label={label} className={cn('grid grid-cols-[repeat(auto-fit,minmax(min(215px,100%),1fr))] gap-3', className)}>
      {children}
    </div>
  );
}

/**
 * Indicador compacto (KPI) das telas: rótulo, valor (algarismos tabulares, sem quebra),
 * dica e nota de aviso opcionais.
 * - `tone`: "danger" (borda e valor vermelhos), "warning" (borda âmbar), "highlight" (contorno primário, ex.: valor simulado).
 * - `group` + `tinted`: cor da linha de cards e fundo tingido do 1º card (ver `KpiGroup`).
 * - `negative`: só o valor em vermelho (ex.: saldo negativo).
 * - `onClick` + `active`: vira botão de filtro (aria-pressed).
 * - `children`: linha extra abaixo do valor (ex.: "sem a venda: R$ …").
 */
export function Kpi({ label, value, hint, note, tone = 'default', group, tinted = false, negative = false, active, onClick, children }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Aviso curto (texto âmbar AA). */
  note?: ReactNode;
  tone?: KpiTone;
  group?: KpiGroup;
  tinted?: boolean;
  negative?: boolean;
  active?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const body = (
    <>
      <p title={label} className="mb-1.5 truncate text-[0.71875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</p>
      <p className={cn('numeric font-display text-[clamp(1.25rem,1.7vw,1.625rem)] font-bold leading-tight text-navy dark:text-foreground', (negative || tone === 'danger') && 'text-destructive-text dark:text-destructive-text')}>{value}</p>
      {children}
      {hint ? <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
      {note ? <p className="mt-1 text-xs text-warning-text">{note}</p> : null}
    </>
  );
  const className = cn(
    // Barra vertical de 4px à esquerda na cor do grupo/tom (::before).
    'relative min-h-[112px] overflow-hidden rounded-lg border bg-card py-3 pl-[18px] pr-4 text-left before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[""]',
    group ? kpiGroup[group].accent : 'border-border before:bg-steel',
    group && tinted && kpiGroup[group].tint,
    tone === 'danger' && 'border-destructive/60 before:bg-destructive',
    tone === 'warning' && 'border-warning/70 before:bg-warning',
    tone === 'highlight' && 'ring-2 ring-primary/60',
    active && 'ring-2 ring-primary',
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" className={cn(className, 'hover:bg-primary/[0.05]')} aria-pressed={Boolean(active)} onClick={onClick}>
      {body}
    </button>
  );
}
