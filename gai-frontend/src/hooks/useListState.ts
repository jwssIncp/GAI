import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useListState() {
  const [query, setQuery] = useSearchParams();
  const rawPage = Number(query.get('page'));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const search = query.get('search') ?? '';
  function setPage(value: number) {
    const next = new URLSearchParams(query);
    next.set('page', String(Math.max(1, value)));
    setQuery(next);
  }
  function setSearch(value: string) {
    const next = new URLSearchParams(query);
    if (value) next.set('search', value); else next.delete('search');
    next.delete('page');
    setQuery(next, { replace: true });
  }
  const params = useMemo(() => ({ page, page_size: 20, search: search || undefined }), [page, search]);
  return { page, setPage, search, setSearch, params };
}
