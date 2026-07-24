import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  MapPinned,
  RotateCcw,
  Users,
  Warehouse,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MetricCard, ProgressCard } from '@/components/base/Cards';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime } from '@/utils/format';
import type {
  InventoryItemStatus,
  ProjectDashboardGrouping,
  ProjectDashboardParams,
  ProjectDashboardPeriod,
  ProjectDashboardAnalytics,
} from '@/types/api';
import { BrazilProjectMap } from './BrazilProjectMap';
import {
  CumulativeProgressChart,
  InventoryTimelineChart,
  StatusDistributionChart,
  UnitsChart,
} from './dashboardVisuals';
import { useProjectDashboardAnalytics } from './projectDashboardQueries';
import { statusPresentation } from './statusPresentation';

const periods: Array<{ value: ProjectDashboardPeriod; label: string }> = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'month', label: 'Mês atual' },
  { value: 'total', label: 'Período total' },
  { value: 'custom', label: 'Personalizado' },
];

const groupings: Array<{ value: ProjectDashboardGrouping; label: string }> = [
  { value: 'day', label: 'Diário' },
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensal' },
];

export function ProjectDashboardPage() {
  const projectId = Number(useParams().projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const query = useProjectDashboardAnalytics(
    Number.isFinite(projectId) ? projectId : undefined,
    filters,
  );

  const updateFilter = (key: keyof ProjectDashboardParams, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'period' && value !== 'custom') {
      next.delete('date_from');
      next.delete('date_to');
    }
    setSearchParams(next, { replace: true });
  };

  const resetFilters = () => setSearchParams({ period: '30d', grouping: 'day' }, { replace: true });

  return (
    <PageContainer>
      <div className="flex w-fit flex-wrap items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-panel">
        <Link className="text-primary hover:text-primary/80" to="/app/projects">Projetos</Link>
        <span>/</span>
        {query.data ? <Link className="text-primary hover:text-primary/80" to={`/app/projects/${projectId}/summary`}>{query.data.project.name}</Link> : <span>Projeto</span>}
        <span>/</span>
        <span>Dashboard</span>
      </div>
      <PageHeader
        title={query.data ? `Dashboard · ${query.data.project.name}` : 'Dashboard do projeto'}
        description="Progresso do inventário, ritmo recente, distribuição operacional e cobertura geográfica em uma visão única."
        action={<Button variant="secondary" onClick={resetFilters}><RotateCcw size={16} /> Limpar filtros</Button>}
      />

      <DashboardFilters
        filters={filters}
        data={query.data}
        onChange={updateFilter}
      />

      {query.isLoading ? <DashboardSkeleton /> : null}
      {query.isError ? (
        <ErrorState
          message="Não foi possível carregar os indicadores deste projeto. Verifique o acesso ou tente novamente."
          onRetry={() => query.refetch()}
        />
      ) : null}
      {query.data ? (
        <DashboardContent data={query.data} updating={query.isPlaceholderData} onSelectState={(state) => updateFilter('state', state)} />
      ) : null}
    </PageContainer>
  );
}

function DashboardFilters({
  filters,
  data,
  onChange,
}: {
  filters: ProjectDashboardParams;
  data?: ProjectDashboardAnalytics;
  onChange: (key: keyof ProjectDashboardParams, value?: string) => void;
}) {
  const custom = filters.period === 'custom';
  return (
    <section className="premium-panel sticky top-[76px] z-20 grid gap-4 border-sidebar-border bg-brand-navy p-4 text-white backdrop-blur-xl lg:grid-cols-6" aria-label="Filtros do dashboard">
      <FilterField label="Período">
        <select aria-label="Período" value={filters.period ?? '30d'} onChange={(event) => onChange('period', event.target.value)}>
          {periods.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
        </select>
      </FilterField>
      {custom ? (
        <>
          <FilterField label="Data inicial"><input aria-label="Data inicial" type="date" value={filters.date_from ?? ''} onChange={(event) => onChange('date_from', event.target.value)} /></FilterField>
          <FilterField label="Data final"><input aria-label="Data final" type="date" value={filters.date_to ?? ''} onChange={(event) => onChange('date_to', event.target.value)} /></FilterField>
        </>
      ) : null}
      <FilterField label="Agrupamento">
        <select aria-label="Agrupamento" value={filters.grouping ?? 'day'} onChange={(event) => onChange('grouping', event.target.value)}>
          {groupings.map((grouping) => <option key={grouping.value} value={grouping.value}>{grouping.label}</option>)}
        </select>
      </FilterField>
      <FilterField label="Unidade">
        <select aria-label="Unidade" value={filters.unit ?? ''} onChange={(event) => onChange('unit', event.target.value)}>
          <option value="">Todas</option>
          {data?.filters.available_units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </select>
      </FilterField>
      <FilterField label="UF">
        <select aria-label="UF" value={filters.state ?? ''} onChange={(event) => onChange('state', event.target.value)}>
          <option value="">Todas</option>
          {data?.filters.available_states.map((state) => <option key={state} value={state}>{state}</option>)}
        </select>
      </FilterField>
      <FilterField label="Status">
        <select aria-label="Status" value={filters.status ?? ''} onChange={(event) => onChange('status', event.target.value)}>
          <option value="">Todos</option>
          {data?.filters.available_statuses.map((status) => <option key={status} value={status}>{statusPresentation[status]?.label ?? status}</option>)}
        </select>
      </FilterField>
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white/65">
      {label}
      <span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-white/15 [&>input]:bg-white [&>input]:px-3 [&>input]:text-sm [&>input]:font-normal [&>input]:tracking-normal [&>input]:text-brand-ink [&>select]:h-10 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-white/15 [&>select]:bg-white [&>select]:px-3 [&>select]:text-sm [&>select]:font-normal [&>select]:tracking-normal [&>select]:text-brand-ink">
        {children}
      </span>
    </label>
  );
}

function DashboardContent({
  data,
  updating,
  onSelectState,
}: {
  data: ProjectDashboardAnalytics;
  updating: boolean;
  onSelectState: (state?: string) => void;
}) {
  const summary = data.summary;
  return (
    <div className="relative grid gap-6">
      {updating ? <div className="absolute inset-x-0 -top-3 z-30 mx-auto h-1 max-w-sm overflow-hidden rounded-full bg-primary/15"><span className="block h-full w-1/2 animate-pulse rounded-full bg-primary" /></div> : null}
      <section className="premium-panel relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="eyebrow">Pulso do inventário</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{summary.inventoried_items.toLocaleString('pt-BR')} de {summary.total_items.toLocaleString('pt-BR')} itens inventariados</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              O status técnico <code>evaluated</code> é a regra de item inventariado. Dados atualizados em {data.timezone}.
            </p>
          </div>
          <ProgressCard label="Conclusão geral" value={summary.completion_percentage} />
        </div>
      </section>

      {summary.total_items === 0 ? (
        <EmptyState title="Nenhum item no recorte atual" description="Este projeto ainda não possui itens ou os filtros selecionados não retornaram registros." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard tone="brand" label="Total de itens" value={summary.total_items.toLocaleString('pt-BR')} hint="Itens operacionais no recorte" icon={<Layers3 size={18} />} />
        <MetricCard tone="brand" label="Inventariados" value={summary.inventoried_items.toLocaleString('pt-BR')} hint={`${summary.completion_percentage.toLocaleString('pt-BR')}% do total`} icon={<CheckCircle2 size={18} />} />
        <MetricCard tone="brand" label="Não inventariados" value={summary.not_inventoried_items.toLocaleString('pt-BR')} hint="Total operacional menos avaliados" icon={<Clock3 size={18} />} />
        <MetricCard tone="brand" label="Média por dia ativo" value={summary.average_items_per_active_day.toLocaleString('pt-BR')} hint={`${summary.active_days} dias com atividade`} icon={<Gauge size={18} />} />
        <MetricCard label="Inventariados hoje" value={summary.inventoried_today.toLocaleString('pt-BR')} hint={`${summary.inventoried_last_7_days} nos últimos 7 dias`} icon={<Activity size={18} />} />
        <MetricCard label="Unidades" value={summary.total_units.toLocaleString('pt-BR')} hint={`${data.unlocated_items} itens sem UF confiável`} icon={<Warehouse size={18} />} />
        <MetricCard label="Equipe vinculada" value={summary.total_field_agents.toLocaleString('pt-BR')} hint="Inventariantes do projeto" icon={<Users size={18} />} />
        <MetricCard label="Previsão de conclusão" value={summary.estimated_completion_date ? formatDate(summary.estimated_completion_date) : 'Indisponível'} hint={summary.last_activity_at ? `Última atividade ${formatDateTime(summary.last_activity_at)}` : 'Sem atividade suficiente'} icon={<CalendarClock size={18} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Itens inventariados por período" description="Volume por período e média móvel de sete pontos.">
          <InventoryTimelineChart data={data.timeline} />
        </ChartCard>
        <ChartCard title="Evolução acumulada" description="Progresso acumulado comparado ao total do recorte.">
          <CumulativeProgressChart data={data.timeline} />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <ChartCard title="Distribuição por status" description="Correspondência direta com os status do backend.">
          <StatusDistributionChart data={data.status_distribution} />
          <StatusTextTable data={data.status_distribution} />
        </ChartCard>
        <ChartCard title="Itens por unidade" description="As 12 unidades textuais com maior volume; a tabela mantém todos os registros acessíveis.">
          <UnitsChart data={data.units} />
        </ChartCard>
      </div>

      <ChartCard title="Cobertura geográfica" description="UF da unidade cadastrada vinculada ao projeto. Clique em um estado para filtrar todo o dashboard." icon={<MapPinned size={18} />}>
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <BrazilProjectMap data={data.geography} selectedState={data.filters.state ?? undefined} onSelectState={onSelectState} />
          <GeographyTable data={data.geography} unlocatedItems={data.unlocated_items} />
        </div>
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <UnitsTable title="Unidades do projeto" data={data.units} />
        <UnitsTable title="Unidades que precisam de atenção" data={data.attention_units} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <ChartCard title="Qualidade dos dados" description="Lacunas que reduzem a confiabilidade das análises.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <QualityItem label="Sem unidade" value={data.data_quality.items_without_unit} />
            <QualityItem label="Sem localização" value={data.data_quality.items_without_location} />
            <QualityItem label="Sem descrição" value={data.data_quality.items_without_description} />
            <QualityItem label="Sem UF confiável" value={data.data_quality.items_without_state} />
          </dl>
        </ChartCard>
        <ChartCard title="Atividades recentes" description="Últimas alterações auditadas nos itens do projeto.">
          {data.recent_activity.length ? (
            <ol className="grid gap-3">
              {data.recent_activity.map((activity) => (
                <li key={activity.id} className="flex gap-3 rounded-xl border border-border/70 bg-muted/25 p-3">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-semibold">Item #{activity.inventory_item_id} · {activity.operation}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{activity.resulting_status ? `Status: ${statusPresentation[activity.resulting_status]?.label ?? activity.resulting_status} · ` : ''}{formatDateTime(activity.occurred_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">Nenhuma atividade auditada no período.</p>}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <UnavailableBlock title="Setores" availability={data.sectors} />
        <UnavailableBlock title="Consolidação" availability={data.consolidation} />
        <UnavailableBlock title="Produtividade individual" availability={data.productivity} />
      </div>

      <details className="premium-panel p-5">
        <summary className="cursor-pointer text-sm font-bold">Regras e limitações dos dados</summary>
        <ul className="mt-4 grid gap-2 text-sm leading-6 text-muted-foreground">
          {data.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
        </ul>
      </details>
    </div>
  );
}

function ChartCard({ title, description, icon, children }: { title: string; description: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="premium-panel min-w-0 p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><h2 className="font-bold tracking-tight">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>
        {icon ? <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">{icon}</span> : null}
      </div>
      {children}
    </section>
  );
}

function StatusTextTable({ data }: { data: ProjectDashboardAnalytics['status_distribution'] }) {
  return (
    <ul className="mt-3 grid gap-2 text-sm">
      {data.map((item) => <li className="flex justify-between gap-4" key={item.status}><span>{statusPresentation[item.status]?.label ?? item.status}</span><strong>{item.total_items.toLocaleString('pt-BR')} · {item.percentage.toLocaleString('pt-BR')}%</strong></li>)}
    </ul>
  );
}

function UnitsTable({ title, data }: { title: string; data: ProjectDashboardAnalytics['units'] }) {
  return (
    <ChartCard title={title} description="Valores absolutos e percentual de conclusão.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead><tr className="border-b border-sidebar-border bg-brand-navy text-xs uppercase tracking-wider text-white/70"><th className="rounded-l-lg py-3 pl-3">Unidade</th><th>Total</th><th>Inventariados</th><th>Pendentes</th><th className="rounded-r-lg pr-3">Conclusão</th></tr></thead>
          <tbody>{data.map((unit, index) => <tr key={`${unit.unit}-${index}`} className="border-b border-border/60 transition-colors hover:bg-primary/[0.07] last:border-0"><td className="py-3 pl-3 font-medium">{unit.unit || 'Sem unidade'}</td><td>{unit.total_items}</td><td>{unit.inventoried_items}</td><td>{unit.pending_items}</td><td className="pr-3">{unit.completion_percentage.toLocaleString('pt-BR')}%</td></tr>)}</tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function GeographyTable({ data, unlocatedItems }: { data: ProjectDashboardAnalytics['geography']; unlocatedItems: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-sidebar-border bg-brand-navy text-xs uppercase tracking-wider text-white/70"><th className="rounded-l-lg py-3 pl-3">UF</th><th>Itens</th><th>Unidades</th><th className="rounded-r-lg pr-3">Conclusão</th></tr></thead>
        <tbody>{data.map((state) => <tr key={state.state} className="border-b border-border/60 transition-colors hover:bg-primary/[0.07]"><td className="py-3 pl-3 font-bold">{state.state}</td><td>{state.total_items}</td><td>{state.total_units}</td><td className="pr-3">{state.completion_percentage.toLocaleString('pt-BR')}%</td></tr>)}</tbody>
        <tfoot><tr><td className="pt-4 font-semibold" colSpan={4}>{unlocatedItems.toLocaleString('pt-BR')} itens sem UF confiável</td></tr></tfoot>
      </table>
    </div>
  );
}

function QualityItem({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-border/70 bg-muted/25 p-4"><dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-bold">{value.toLocaleString('pt-BR')}</dd></div>;
}

function UnavailableBlock({ title, availability }: { title: string; availability: { available: boolean; reason: string | null } }) {
  return (
    <section className="rounded-xl border border-warning/25 bg-warning-subtle/30 p-5">
      <div className="flex items-center gap-2 font-bold"><AlertTriangle size={17} className="text-warning" />{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{availability.available ? 'Disponível' : availability.reason}</p>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5" role="status" aria-label="Carregando dashboard">
      <LoadingState label="Calculando indicadores do projeto" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton-shimmer h-40 rounded-xl" />)}</div>
    </div>
  );
}

function parseFilters(searchParams: URLSearchParams): ProjectDashboardParams {
  return {
    period: (searchParams.get('period') as ProjectDashboardPeriod | null) ?? '30d',
    grouping: (searchParams.get('grouping') as ProjectDashboardGrouping | null) ?? 'day',
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    unit: searchParams.get('unit') || undefined,
    state: searchParams.get('state') || undefined,
    status: (searchParams.get('status') as InventoryItemStatus | null) ?? undefined,
  };
}
