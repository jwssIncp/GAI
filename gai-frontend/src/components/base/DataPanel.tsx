import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Painel de tabela no padrão do sistema anterior: card com borda fina e, no topo, a
 * "faixa azul" (#1F4C6E) com título, contador, extras e o botão Ocultar/Mostrar.
 * O conteúdo (filtros + tabela) vem como `children` e some quando `hidden`.
 */
export function DataPanel({ title, titleId, count, extra, hidden, onToggle, contentId, children, className, overflowVisible = false }: {
  title: string;
  titleId: string;
  count?: ReactNode;
  /** Conteúdo à direita na faixa (ex.: subtotal, busca). */
  extra?: ReactNode;
  hidden?: boolean;
  onToggle?: () => void;
  contentId?: string;
  children?: ReactNode;
  className?: string;
  /** Sem recorte nas bordas: para menus suspensos dentro do painel (ex.: "Colunas"). */
  overflowVisible?: boolean;
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-card', !overflowVisible && 'overflow-hidden', className)} aria-labelledby={titleId}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-[9px] bg-steel-dark px-5 py-3.5 text-white">
        <h2 id={titleId} className="font-display text-base font-semibold text-white">{title}</h2>
        {count !== undefined ? <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-xs text-white">{count}</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {extra}
          {onToggle ? (
            <button
              type="button"
              aria-expanded={!hidden}
              aria-controls={contentId}
              onClick={onToggle}
              className="inline-flex min-h-8 items-center rounded-lg border border-white/60 bg-transparent px-3.5 text-[0.8125rem] font-bold text-white transition-colors hover:bg-white/15"
            >
              {hidden ? 'Mostrar' : 'Ocultar'}
            </button>
          ) : null}
        </div>
      </header>
      {hidden ? null : <div id={contentId}>{children}</div>}
    </section>
  );
}

/** Linha de filtros logo abaixo da faixa azul, com o rótulo "FILTROS" à esquerda. */
export function DataPanelFilters({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-5 py-3 md:flex-row md:flex-wrap md:items-center [&>*]:min-w-0" role="group" aria-label={label}>
      <span aria-hidden="true" className="text-[0.71875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Filtros</span>
      {children}
    </div>
  );
}

/** Botão de visão da linha de filtros ("Em aberto", "Recebidos", "Todos", "Mês atual"): o ativo fica escuro. */
export function ViewToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-8 items-center whitespace-nowrap rounded-[6px] border px-3.5 text-[0.78125rem] font-semibold transition-colors',
        on ? 'border-navy bg-navy text-white dark:border-steel-dark dark:bg-steel-dark' : 'border-border-strong bg-card text-foreground hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}
