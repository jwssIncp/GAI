import { useQuery } from '@tanstack/react-query';
import type { EntitySource } from '@/components/base/EntityCombobox';

/**
 * Nome (e placa/código) de uma entidade a partir do ID, para células de tabela.
 * Usa a mesma chave de cache do EntityCombobox (`[key, "one", id, contexto]`),
 * então o que um já leu o outro reaproveita. Sem permissão ou sem resultado,
 * mostra o texto alternativo.
 */
export function EntityName<C extends Record<string, unknown>>({ source, id, context, enabled = true, fallback }: { source: EntitySource<C>; id: number | null | undefined; context: C; enabled?: boolean; fallback: string }) {
  const query = useQuery({
    queryKey: [source.key, 'one', id ?? null, JSON.stringify(context)],
    queryFn: () => source.one!(id!, context),
    enabled: Boolean(enabled && id && source.one),
    staleTime: 60_000,
  });
  if (!id) return <>-</>;
  if (query.data) return <span title={query.data.description ?? undefined}>{query.data.label}</span>;
  return <span className={query.isLoading ? 'text-muted-foreground' : undefined}>{query.isLoading ? 'Carregando…' : fallback}</span>;
}
