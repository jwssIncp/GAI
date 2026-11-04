import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { OrganizationPresenceMap, OverviewTables, PortfolioStatus } from './OverviewDetails';
import { CommercialFilters, CommercialOverview } from '@/features/contracts/CommercialOverview';
import { commercialFilterKeys } from '@/features/contracts/contractsApi';
import { usePermissions } from '@/features/auth/usePermissions';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/api/http';
import { useAuth } from '@/features/auth/AuthContext';
import { MetricCard } from '@/components/base/Cards';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';

interface Overview {
  total_projects: number; open_projects: number; open_percentage: number;
  statuses: { status: string; total: number }[];
  timeline: { period: string; total: number }[];
  projects: { id: number; name: string; status: string; created_at: string }[];
  geography?: { state: string; total: number }[];
  unlocated_projects?: number;
}
const statuses: Record<string, string> = { draft: 'Rascunho', active: 'Ativo', paused: 'Pausado', inactive: 'Inativo', finished: 'Finalizado', cancelled: 'Cancelado', archived: 'Arquivado' };
const count = (value: number) => value.toLocaleString('pt-BR');
const fields = ['year', 'month', 'date_from', 'date_to', 'status', 'search', 'state', 'company_id', ...commercialFilterKeys];

export function OrganizationOverviewPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(fields.flatMap(key => params.get(key) ? [[key, params.get(key)!]] : []));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  function crossFilter(key: string, value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  }
  const invalidDates = Boolean((filters.date_from && filters.date_to && filters.date_from > filters.date_to) || (filters.contract_from && filters.contract_to && filters.contract_from > filters.contract_to) || (filters.assets_min && filters.assets_max && Number(filters.assets_min) > Number(filters.assets_max)));
  const query = useQuery({
    queryKey: ['organization-overview', user?.id, user?.organization_id, filters],
    queryFn: ({ signal }) => api.get<Overview>('/organization-overview', { params: filters, signal }).then(r => r.data),
    enabled: !invalidDates,
    staleTime: 30_000,
  });
  async function download(format: 'csv' | 'xlsx') {
    setExporting(true); setExportError('');
    try {
      const response = await api.get<Blob>(`/organization-overview/export.${format}`, { params: filters, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `visao-geral.${format}`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExportError('Não foi possível exportar. Tente novamente ou refine os filtros para até 10.000 projetos.'); }
    finally { setExporting(false); }
  }
  const data = invalidDates ? undefined : query.data;
  return <PageContainer>
    <PageHeader title="Visão Geral" description="Projetos da sua organização e indicadores gerenciais." />
    <form key={params.toString()} className="premium-panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      setParams(Object.fromEntries(fields.flatMap(key => values.get(key) ? [[key, String(values.get(key))]] : [])));
    }}>
      <label className="grid gap-1 text-sm">Ano de criação<input className="rounded-lg border bg-background p-2" name="year" type="number" min="1900" max="9999" defaultValue={filters.year} /></label>
      <label className="grid gap-1 text-sm">Mês de criação<select className="rounded-lg border bg-background p-2" name="month" defaultValue={filters.month ?? ''}><option value="">Todos</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, i, 1))}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Status<select className="rounded-lg border bg-background p-2" name="status" defaultValue={filters.status ?? ''}><option value="">Todos</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Criado a partir de<input className="rounded-lg border bg-background p-2" name="date_from" type="date" defaultValue={filters.date_from} /></label>
      <label className="grid gap-1 text-sm">Criado até<input className="rounded-lg border bg-background p-2" name="date_to" type="date" defaultValue={filters.date_to} /></label>
      <label className="grid gap-1 text-sm">Buscar projeto<input className="rounded-lg border bg-background p-2" name="search" maxLength={120} defaultValue={filters.search} placeholder="Nome do projeto" /></label>
      <label className="grid gap-1 text-sm">UF das unidades<select className="rounded-lg border bg-background p-2" name="state" defaultValue={filters.state ?? ''}><option value="">Todas</option>{'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(state => <option key={state}>{state}</option>)}</select></label>
      <input type="hidden" name="company_id" value={filters.company_id ?? ''} />
      {hasPermission('commercial-indicators:read') ? <CommercialFilters filters={filters} /> : null}
      {filters.company_id ? <button type="button" className="rounded border p-2 text-sm" onClick={() => crossFilter('company_id')}>Remover filtro empresa #{filters.company_id}</button> : null}
      <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">Aplicar filtros</button>
        <button className="rounded-lg border px-4 py-2 text-sm" type="button" onClick={() => setParams({})}>Limpar filtros</button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">Datas referem-se à criação dos projetos, não à assinatura de contratos. Os filtros ficam salvos no endereço da página.</p>
    </form>
    {invalidDates ? <p role="alert">A data inicial deve ser anterior ou igual à final.</p> : query.isPending ? <LoadingState /> : query.isError ? <ErrorState /> : data ? <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Quantidade de projetos" value={count(data.total_projects)} hint="Projetos não excluídos que atendem aos filtros." tone="brand" />
        <MetricCard label="Projetos em aberto" value={count(data.open_projects)} hint={`${data.open_percentage.toLocaleString('pt-BR')}% dos projetos filtrados · critério: status Ativo.`} tone="brand" />
      </div>
      {query.isFetching ? <p role="status" className="text-sm">Atualizando indicadores…</p> : null}
      {data.total_projects ? <>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {[{ title: 'Projetos por status', rows: data.statuses.map(row => ({ label: statuses[row.status] ?? row.status, total: row.total })) }, { title: 'Evolução de criação de projetos', rows: data.timeline.map(row => ({ label: row.period.split('-').reverse().join('/'), total: row.total })) }].map(chart => <section key={chart.title} className="premium-panel min-w-0 p-5"><h2 className="mb-4 font-semibold">{chart.title}</h2><div className="h-72" role="img" aria-label={chart.title}><ResponsiveContainer width="100%" height="100%"><BarChart data={chart.rows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis allowDecimals={false} tickFormatter={count} /><Tooltip formatter={(value: number) => [count(value), 'Projetos']} /><Bar isAnimationActive={false} name="Projetos" dataKey="total" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>)}
        </div>
      </> : <EmptyState title="Nenhum projeto encontrado" description="Altere os filtros ou limpe a seleção." />}
      <PortfolioStatus rows={data.statuses} selected={filters.status} onSelect={status => crossFilter('status', status)} />
      <OrganizationPresenceMap rows={data.geography ?? []} unlocated={data.unlocated_projects ?? 0} selected={filters.state} onSelect={state => crossFilter('state', state)} />
      <OverviewTables key={JSON.stringify(filters)} filters={filters} scope={`${user?.id}:${user?.organization_id}`} onCompany={id => crossFilter('company_id', String(id))} />
      {hasPermission('commercial-indicators:read') ? <CommercialOverview key={JSON.stringify(filters)} filters={filters} /> : null}
      <div className="flex flex-wrap gap-3">{(['xlsx', 'csv'] as const).map(format => <button key={format} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" disabled={exporting || query.isFetching} onClick={() => void download(format)}>{exporting ? 'Exportando…' : `Exportar ${format === 'xlsx' ? 'Excel' : 'CSV'}`}</button>)}</div>
      {exportError ? <p role="alert">{exportError}</p> : null}
    </> : null}
    <aside className="premium-panel p-5 text-sm text-muted-foreground">Datas operacionais referem-se à criação dos projetos; datas contratuais à contratação informada. As etapas operacionais são representadas pelo status real dos projetos acima. Não há equivalência validada com as seis etapas do legado. Valores contratados não representam recebimentos.</aside>
  </PageContainer>;
}
