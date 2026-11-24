import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/base/States';
import { useClassifyAccountingItems } from './accountingItemsQueries';
import { fixedSurplusClassifications } from './accountingItemSchemas';

/** Selo amarelo da classificação manual na linha contábil. */
export function SurplusClassificationBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">{value}</span>;
}

/**
 * "Alterar status ▾": aplica uma classificação (fixa ou livre) aos itens contábeis
 * selecionados, ou limpa. Só itens não conciliados e ativos podem ser selecionados.
 */
export function SurplusClassificationMenu({ projectId, ids, onDone }: { projectId: number; ids: number[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const classify = useClassifyAccountingItems(projectId);
  const apply = (classification: string | null) =>
    classify.mutate({ ids, classification }, { onSuccess: () => { setOpen(false); setCustom(''); onDone(); } });
  return (
    <div className="relative">
      <Button type="button" size="sm" variant="secondary" disabled={!ids.length || classify.isPending} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}
        className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        Alterar status ▾
      </Button>
      {open ? (
        <div role="menu" aria-label="Classificar a sobra contábil" className="absolute left-0 top-10 z-30 grid min-w-72 gap-1 rounded-lg border bg-popover p-2 text-sm shadow-lg">
          <p className="border-b px-1 pb-1.5 text-xs font-semibold text-muted-foreground">Aplicar aos {ids.length} selecionado(s)</p>
          {fixedSurplusClassifications.map((value) => (
            <button key={value} type="button" role="menuitem" className="rounded-md px-2 py-1.5 text-left font-semibold hover:bg-muted" onClick={() => apply(value)}>{value}</button>
          ))}
          <form className="flex gap-1 border-t pt-2" onSubmit={(event) => { event.preventDefault(); if (custom.trim()) apply(custom.trim()); }}>
            <input aria-label="Outra classificação" maxLength={120} placeholder="Outro status…" className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2" value={custom} onChange={(event) => setCustom(event.target.value)} />
            <Button type="submit" size="sm" disabled={!custom.trim()}>Aplicar</Button>
          </form>
          <button type="button" role="menuitem" className="rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted" onClick={() => apply(null)}>Limpar classificação</button>
          {classify.isError ? <ErrorState message={(classify.error as Error).message} /> : null}
        </div>
      ) : null}
    </div>
  );
}
