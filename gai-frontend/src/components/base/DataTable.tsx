import { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { EmptyState } from './States';

export type Column<T> = {
  header: string;
  /** Conteúdo do cabeçalho quando não é só texto (ex.: caixa de seleção). `header` continua sendo a chave. */
  headerContent?: ReactNode;
  /** Fixa a coluna na borda direita a partir do tablet (ex.: Ações sempre visível ao rolar a tabela). */
  sticky?: 'right';
  /**
   * Coluna de número/valor monetário: alinha à direita, algarismos de mesma largura e
   * sem quebra de linha (classe `.numeric`), para "R$ 100,01" nunca virar "R$⏎100,01".
   */
  numeric?: boolean;
  /** Alinhamento do cabeçalho e das células (padrão: à esquerda; `numeric` alinha à direita). */
  align?: 'left' | 'center' | 'right';
  cell: (item: T) => ReactNode;
  className?: string;
};

const stickyHead = 'md:sticky md:right-0 md:z-10 md:bg-muted';
const stickyCell = 'md:sticky md:right-0 md:z-10 md:bg-card md:shadow-[-12px_0_12px_-12px_hsl(var(--foreground)/0.25)]';
const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function columnClass<T>(column: Column<T>) {
  const align = column.align ?? (column.numeric ? 'right' : undefined);
  return cn(align && alignClass[align], column.numeric && 'numeric');
}

/**
 * Chaves das linhas sem repetição: se `getKey` devolver o mesmo valor para duas linhas
 * (ex.: dois grupos com o mesmo nome), as repetidas recebem um sufixo. Evita o aviso
 * "Encountered two children with the same key" e linhas trocadas ao reordenar.
 */
function uniqueKeys<T>(items: T[], getKey: (item: T) => string | number): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const key = String(getKey(item));
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count ? `${key}#${count}` : key;
  });
}

/**
 * Tabela padrão das telas, no visual do sistema anterior (classe `.data-table`: cabeçalho
 * em maiúsculas sobre #F5F8FA, linhas com borda fina). `bare`: sem o card externo, para
 * uso dentro de um `DataPanel` (faixa azul).
 */
export function DataTable<T>({ columns, items, getKey, caption = 'Registros', bare = false }: { columns: Column<T>[]; items: T[]; getKey: (item: T) => string | number; caption?: string; bare?: boolean }) {
  if (!items.length) return <EmptyState />;
  const keys = uniqueKeys(items, getKey);
  return (
    <div className={bare ? undefined : 'premium-panel'}>
      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground md:hidden">Deslize a tabela para ver todas as colunas e ações.</p>
      <div className="overflow-x-auto focus-visible:ring-inset" role="region" aria-label={caption} tabIndex={0}>
        <table className="data-table w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>{columns.map((column, index) => <th scope="col" key={`${column.header}-${index}`} className={cn('border-b border-border px-5 py-4 font-semibold first:pl-6 last:pr-6', columnClass(column), column.className, column.sticky === 'right' && stickyHead)}>{column.headerContent ?? column.header}</th>)}</tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {items.map((item, row) => (
              <tr key={keys[row]} className="group transition-colors duration-150 hover:bg-primary/[0.07] focus-within:bg-primary/[0.07]">
                {columns.map((column, index) => <td key={`${column.header}-${index}`} className={cn('border-b border-border/55 px-5 py-4 align-middle text-foreground/90 first:pl-6 last:pr-6', columnClass(column), column.className, column.sticky === 'right' && stickyCell)}>{column.cell(item)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
