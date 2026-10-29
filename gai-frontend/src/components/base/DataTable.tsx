import { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { EmptyState } from './States';

export type Column<T> = {
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({ columns, items, getKey, caption = 'Registros' }: { columns: Column<T>[]; items: T[]; getKey: (item: T) => string | number; caption?: string }) {
  if (!items.length) return <EmptyState />;
  return (
    <div className="premium-panel">
      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground md:hidden">Deslize a tabela para ver todas as colunas e ações.</p>
      <div className="overflow-x-auto focus-visible:ring-inset" role="region" aria-label={caption} tabIndex={0}>
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>{columns.map((column) => <th scope="col" key={column.header} className={cn('border-b border-border px-5 py-4 font-semibold first:pl-6 last:pr-6', column.className)}>{column.header}</th>)}</tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {items.map((item) => (
              <tr key={getKey(item)} className="group transition-colors duration-150 hover:bg-primary/[0.07] focus-within:bg-primary/[0.07]">
                {columns.map((column) => <td key={column.header} className={cn('border-b border-border/55 px-5 py-4 align-middle text-foreground/90 first:pl-6 last:pr-6', column.className)}>{column.cell(item)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
