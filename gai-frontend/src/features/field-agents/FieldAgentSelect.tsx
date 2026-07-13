import { useDeferredValue, useState } from 'react';
import { normalizePage } from '@/api/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFieldAgents } from './fieldAgentsQueries';

type FieldAgentSelectProps = {
  value: string;
  onChange: (value: string) => void;
  excludedIds?: number[];
};

export function FieldAgentSelect({ value, onChange, excludedIds = [] }: FieldAgentSelectProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const query = useFieldAgents({ page, page_size: 20, status: 'active', search: deferredSearch || undefined });
  const data = query.data ? normalizePage(query.data) : null;
  const excluded = new Set(excludedIds);
  const options = data?.items.filter((item) => !excluded.has(item.id)) ?? [];

  return (
    <div className="grid gap-2">
      <Input
        aria-label="Buscar inventariante"
        placeholder="Buscar por nome, email ou documento"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <select
        aria-label="Inventariante"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={query.isLoading || query.isError}
      >
        <option value="">
          {query.isLoading
            ? 'Carregando inventariantes...'
            : query.isError
              ? 'Erro ao carregar inventariantes'
              : options.length
                ? 'Selecione'
                : 'Nenhum inventariante ativo encontrado'}
        </option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>{item.name}{item.email ? ` - ${item.email}` : ''}</option>
        ))}
      </select>
      {query.isError ? (
        <div className="flex items-center justify-between gap-3">
          <p role="alert" className="text-xs text-destructive">Nao foi possivel carregar os inventariantes.</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button>
        </div>
      ) : null}
      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
          <span>Pagina {page} de {data.totalPages}</span>
          <Button type="button" variant="secondary" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((current) => current + 1)}>Proxima</Button>
        </div>
      ) : null}
    </div>
  );
}
