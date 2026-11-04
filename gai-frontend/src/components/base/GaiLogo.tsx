import { cn } from '@/utils/cn';

/** Product identity only; never replaces organization or customer branding. */
export function GaiLogo({ variant = 'horizontal', appearance = 'auto', className }: {
  variant?: 'horizontal' | 'compact' | 'symbol';
  appearance?: 'auto' | 'light' | 'dark';
  className?: string;
}) {
  if (variant === 'symbol') return <img src="/brand/gai-symbol.svg" alt="GAI" width={48} height={48} className={cn('size-10 shrink-0', className)} />;
  const dimensions = variant === 'compact' ? { width: 128, height: 40 } : { width: 208, height: 48 };
  const src = (tone: string) => `/brand/gai-${variant}-${tone}.svg`;
  return <span className={cn('inline-flex shrink-0', className)}>
    {appearance === 'auto' ? <>
      <img src={src('light')} alt="GAI — Gestão de Ativos" {...dimensions} className="block h-auto max-w-full dark:hidden" />
      <img src={src('dark')} alt="GAI — Gestão de Ativos" {...dimensions} className="hidden h-auto max-w-full dark:block" />
    </> : <img src={src(appearance)} alt="GAI — Gestão de Ativos" {...dimensions} className="h-auto max-w-full" />}
  </span>;
}
