import { useMemo, useState } from 'react';

export function useListState() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ page, page_size: 20, search: search || undefined }), [page, search]);
  return { page, setPage, search, setSearch, params };
}
