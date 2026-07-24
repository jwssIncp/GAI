import { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { EmptyState } from './States';

export type Column<T> = {
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({ columns, items, getKey }: { columns: Column<T>[]; items: T[]; getKey: (item: T) => string | number }) {
  if (!items.length) return <EmptyState />;
  return (
    <div className="premium-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-brand-navy text-[0.6875rem] uppercase tracking-[0.12em] text-white/75">
            <tr>{columns.map((column) => <th key={column.header} className={cn('border-b border-sidebar-border px-5 py-4 font-bold first:pl-6 last:pr-6', column.className)}>{column.header}</th>)}</tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {items.map((item) => (
              <tr key={getKey(item)} className="group transition-colors duration-150 hover:bg-primary/[0.07]">
                {columns.map((column) => <td key={column.header} className={cn('border-b border-border/55 px-5 py-4 align-middle text-foreground/90 first:pl-6 last:pr-6', column.className)}>{column.cell(item)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
