import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { companiesApi } from '@/api/endpoints';
import { normalizePage } from '@/api/pagination';
import { DataTable } from '@/components/base/DataTable';
import { FilterPanel } from '@/components/base/FilterPanel';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { SearchInput } from '@/components/base/SearchInput';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-context';
import { usePermissions } from '@/features/auth/usePermissions';
import { useListState } from '@/hooks/useListState';
import type { Company } from '@/types/api';
import { companyStatusLabels, maskCnpj } from './companyFields';

export function CompaniesPage() {
  const state = useListState();
  const [search, setSearch] = useSearchParams();
  const status = search.get('status') ?? '';
  const params = { ...state.params, status: status || undefined };
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const query = useQuery({ queryKey: ['companies', params], queryFn: () => companiesApi.list(params) });
  const page = query.data ? normalizePage(query.data) : null;
  return <PageContainer>
    <PageHeader title="Empresas" description="Gerencie os dados empresariais e as empresas vinculadas à organização." action={hasPermission('companies:create') ? <Button onClick={() => navigate(`/app/companies/new${location.search}`)}><Plus size={17} /> Nova empresa</Button> : null} />
    <FilterPanel><SearchInput value={state.search} onChange={state.setSearch} placeholder="Buscar por nome, razão social ou CNPJ" /><select aria-label="Filtrar por situação" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm" value={status} onChange={(event) => { const next = new URLSearchParams(search); if (event.target.value) next.set('status', event.target.value); else next.delete('status'); next.delete('page'); setSearch(next); }}><option value="">Todas as situações</option>{Object.entries(companyStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FilterPanel>
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : page ? <>
      <p className="text-sm text-muted-foreground">{page.totalItems} empresa(s) encontrada(s)</p>
      <DataTable items={page.items} getKey={(company) => company.id} caption="Empresas" columns={[
        { header: 'Empresa', cell: (company) => <Link className="font-semibold text-primary hover:underline" to={`/app/companies/${company.id}${location.search}`}>{company.name}</Link> },
        { header: 'Razão social', cell: (company) => company.corporate_name || 'Não informado' },
        { header: 'CNPJ', cell: (company) => company.document ? maskCnpj(company.document) : 'Não informado' },
        { header: 'Cidade/UF', cell: (company) => [company.city, company.state].filter(Boolean).join(' / ') || 'Não informado' },
        { header: 'Situação', cell: (company) => <StatusBadge value={company.status} /> },
        { header: 'Ações', cell: (company) => <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => navigate(`/app/companies/${company.id}${location.search}`)}>Visualizar</Button>{hasPermission('companies:update') && !company.deleted_at ? <Button size="sm" variant="secondary" onClick={() => navigate(`/app/companies/${company.id}/edit${location.search}`)}>Editar</Button> : null}<CompanyStatusAction company={company} /></div> },
      ]} />
      <Pagination page={page.page} totalPages={page.totalPages} onPageChange={state.setPage} />
    </> : null}
  </PageContainer>;
}

export function CompanyStatusAction({ company }: { company: Company }) {
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const { toast } = useToast();
  const restore = company.status === 'inactive';
  const mutation = useMutation({
    mutationFn: () => restore ? companiesApi.reactivate(company.id) : companiesApi.deactivate(company.id),
    onSuccess: async () => { setOpen(false); await client.invalidateQueries({ queryKey: ['companies'] }); toast({ title: restore ? 'Empresa reativada' : 'Empresa desativada', tone: 'success' }); },
    onError: (error) => toast({ title: 'Não foi possível alterar a situação', description: error.message, tone: 'error' }),
  });
  if (!hasPermission(restore ? 'companies:reactivate' : 'companies:deactivate')) return null;
  return <><Button size="sm" variant={restore ? 'secondary' : 'danger'} disabled={mutation.isPending} onClick={() => setOpen(true)}>{restore ? 'Reativar' : 'Desativar'}</Button><ConfirmDialog open={open} onOpenChange={(value) => { if (!mutation.isPending) setOpen(value); }} title={restore ? 'Reativar empresa?' : 'Desativar empresa?'} description={restore ? `A empresa ${company.name} voltará a ficar ativa.` : `A empresa ${company.name} será desativada por exclusão lógica. Seus dados e vínculos serão preservados.`} busy={mutation.isPending} onConfirm={() => { if (!mutation.isPending) mutation.mutate(); }} /></>;
}
