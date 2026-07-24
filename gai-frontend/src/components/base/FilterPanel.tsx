import { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export function FilterPanel({ children }: { children: ReactNode }) {
  return (
    <section className="premium-panel border-sidebar-border bg-brand-navy p-4 text-white sm:p-5" aria-label="Filtros">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white/65">
        <SlidersHorizontal size={14} className="text-primary" /> Filtros
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center [&>*]:min-w-0 [&_input]:border-white/15 [&_input]:bg-white [&_input]:text-brand-ink [&_select]:border-white/15 [&_select]:bg-white [&_select]:text-brand-ink">{children}</div>
    </section>
  );
}
