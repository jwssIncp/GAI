import { ReactNode } from 'react';

/**
 * Barra de filtros no padrão do sistema anterior: card branco com borda fina, raio 10px,
 * campos lado a lado (empilhados no celular). O rótulo "Filtros" fica discreto à esquerda.
 */
export function FilterPanel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card px-[18px] py-4" aria-label="Filtros">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center [&>*]:min-w-0">
        <span className="text-[0.71875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Filtros</span>
        {children}
      </div>
    </section>
  );
}
