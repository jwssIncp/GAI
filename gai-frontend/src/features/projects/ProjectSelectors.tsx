import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { companiesApi, companyUnitsApi, organizationsApi } from '@/api/endpoints';
import { normalizePage } from '@/api/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Company, CompanyUnit, Organization, PaginatedItems } from '@/types/api';

const selectClassName = 'h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

type BaseSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function OrganizationSelect(props: BaseSelectorProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({
    queryKey: ['organizations', 'project-options', page, deferredSearch],
    queryFn: () => organizationsApi.list({ page, page_size: 20, status: 'ACTIVE', search: deferredSearch || undefined }),
  });
  const selectedId = toId(props.value);
  const selected = useQuery({
    queryKey: ['organizations', 'project-option', selectedId],
    queryFn: () => organizationsApi.get(selectedId!),
    enabled: Boolean(selectedId),
  });
  const options = mergeSelected(query.data, selected.data);

  return (
    <PagedSelect
      {...props}
      label="Organizacao"
      search={search}
      onSearch={(value) => { setSearch(value); setPage(1); }}
      page={page}
      totalPages={query.data?.total_pages ?? 0}
      onPage={setPage}
      loading={query.isLoading}
      error={query.isError}
      options={options.map((item) => ({ id: item.id, label: item.trade_name || item.legal_name }))}
    />
  );
}

export function CompanySelect({ organizationId, ...props }: BaseSelectorProps & { organizationId?: number }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const enabled = Boolean(organizationId && Number.isFinite(organizationId));
  const query = useQuery({
    queryKey: ['companies', 'project-options', organizationId, page, deferredSearch],
    queryFn: () => companiesApi.list({ page, page_size: 20, organization_id: organizationId, status: 'active', search: deferredSearch || undefined }),
    enabled,
  });
  const selectedId = toId(props.value);
  const selected = useQuery({
    queryKey: ['companies', 'project-option', selectedId],
    queryFn: () => companiesApi.get(selectedId!),
    enabled: Boolean(selectedId),
  });
  const options = mergeSelected(query.data, selected.data);

  return (
    <PagedSelect
      {...props}
      disabled={props.disabled || !enabled}
      label="Empresa"
      search={search}
      onSearch={(value) => { setSearch(value); setPage(1); }}
      page={page}
      totalPages={query.data?.total_pages ?? 0}
      onPage={setPage}
      loading={query.isLoading}
      error={query.isError}
      options={options.map((item) => ({ id: item.id, label: item.name }))}
      emptyLabel={enabled ? 'Nenhuma empresa ativa encontrada' : 'Selecione a organizacao primeiro'}
    />
  );
}

export function CompanyUnitSelect({ companyId, excludedIds = [], ...props }: BaseSelectorProps & { companyId?: number; excludedIds?: number[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const enabled = Boolean(companyId && Number.isFinite(companyId));
  const query = useQuery({
    queryKey: ['company-units', 'project-options', companyId, page, deferredSearch],
    queryFn: () => companyUnitsApi.list(companyId!, { page, page_size: 20, status: 'active', search: deferredSearch || undefined }),
    enabled,
  });
  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);
  const items = query.data ? normalizePage<CompanyUnit>(query.data).items.filter((item) => !excluded.has(item.id)) : [];

  return (
    <PagedSelect
      {...props}
      disabled={props.disabled || !enabled}
      label="Unidade"
      search={search}
      onSearch={(value) => { setSearch(value); setPage(1); }}
      page={page}
      totalPages={query.data?.total_pages ?? 0}
      onPage={setPage}
      loading={query.isLoading}
      error={query.isError}
      options={items.map((item) => ({ id: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
      emptyLabel={enabled ? 'Nenhuma unidade ativa disponivel' : 'Empresa nao vinculada'}
    />
  );
}

function PagedSelect({
  value,
  onChange,
  disabled,
  required,
  label,
  search,
  onSearch,
  page,
  totalPages,
  onPage,
  loading,
  error,
  options,
  emptyLabel = 'Nenhuma opcao encontrada',
}: BaseSelectorProps & {
  label: string;
  search: string;
  onSearch: (value: string) => void;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  loading: boolean;
  error: boolean;
  options: Array<{ id: number; label: string }>;
  emptyLabel?: string;
}) {
  return (
    <div className="grid gap-2">
      <Input
        aria-label={`Buscar ${label.toLowerCase()}`}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={`Buscar ${label.toLowerCase()}`}
        disabled={disabled}
      />
      <select className={selectClassName} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled || loading || error} required={required}>
        <option value="">{loading ? 'Carregando...' : error ? 'Erro ao carregar opcoes' : options.length ? 'Selecione' : emptyLabel}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      {error ? <p role="alert" className="text-xs text-destructive">Nao foi possivel carregar as opcoes.</p> : null}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Button type="button" variant="secondary" size="sm" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
          <span>Pagina {page} de {totalPages}</span>
          <Button type="button" variant="secondary" size="sm" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}>Proxima</Button>
        </div>
      ) : null}
    </div>
  );
}

function mergeSelected<T extends { id: number }>(page: PaginatedItems<T> | undefined, selected?: T): T[] {
  const items = page ? normalizePage<T>(page).items : [];
  return selected && !items.some((item) => item.id === selected.id) ? [selected, ...items] : items;
}

function toId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export type { Company, Organization };

