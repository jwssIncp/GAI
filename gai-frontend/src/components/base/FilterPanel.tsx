import { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export function FilterPanel({ children }: { children: ReactNode }) {
  return (
    <section className="premium-panel p-4 sm:p-5" aria-label="Filtros">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <SlidersHorizontal size={14} className="text-primary" /> Filtros
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center [&>*]:min-w-0">{children}</div>
    </section>
  );
}
