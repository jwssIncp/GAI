import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Building2, ClipboardList, Landmark, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { companiesApi, organizationsApi, projectsApi, usersApi } from '@/api/endpoints';
import { MetricCard } from '@/components/base/Cards';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { navigation } from '@/constants/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { usePermissions } from '@/features/auth/usePermissions';
import { cn } from '@/utils/cn';

export function DashboardPage() {
  const { canAccess } = usePermissions();
  const { user } = useAuth();
  const queries = {
    orgs: useQuery({ queryKey: ['organizations', 'dashboard'], queryFn: () => organizationsApi.list({ page: 1, page_size: 1 }), enabled: canAccess(['organizations:read']) }),
    users: useQuery({ queryKey: ['users', 'dashboard'], queryFn: () => usersApi.list({ page: 1, page_size: 1 }), enabled: canAccess(['users:read']) }),
    companies: useQuery({ queryKey: ['companies', 'dashboard'], queryFn: () => companiesApi.list({ page: 1, page_size: 1 }), enabled: canAccess(['companies:read']) }),
    projects: useQuery({ queryKey: ['projects', 'dashboard'], queryFn: () => projectsApi.list({ page: 1, page_size: 1 }), enabled: canAccess(['projects:read']) }),
  };
  const loading = Object.values(queries).some((q) => q.isLoading);
  const error = Object.values(queries).find((q) => q.isError);
  const visibleCards = [
    { key: 'orgs', label: 'Organizações', value: queries.orgs.data ? normalizePage(queries.orgs.data).totalItems : null, icon: <Landmark size={19} />, hint: 'Tenants ativos na plataforma', show: canAccess(['organizations:read']) },
    { key: 'users', label: 'Usuários', value: queries.users.data ? normalizePage(queries.users.data).totalItems : null, icon: <Users size={19} />, hint: 'Contas com acesso ao GAI', show: canAccess(['users:read']) },
    { key: 'companies', label: 'Empresas', value: queries.companies.data ? normalizePage(queries.companies.data).totalItems : null, icon: <Building2 size={19} />, hint: 'Empresas operacionais cadastradas', show: canAccess(['companies:read']) },
    { key: 'projects', label: 'Projetos', value: queries.projects.data ? normalizePage(queries.projects.data).totalItems : null, icon: <ClipboardList size={19} />, hint: 'Inventários patrimoniais em gestão', show: canAccess(['projects:read']) },
  ].filter((card) => card.show);
  const quickAccess = navigation.filter((item) => item.to !== '/app/dashboard' && canAccess(item.permissions)).slice(0, 4);

  return (
    <PageContainer>
      <PageHeader title="Dashboard operacional" description="Uma leitura clara da sua operação, respeitando escopos e permissões de acesso." />
      {loading ? <LoadingState /> : error ? <ErrorState /> : visibleCards.length ? (
        <>
          <section className="relative grid min-h-[300px] overflow-hidden rounded-2xl border border-sidebar-border bg-brand-hero text-white shadow-elevated lg:grid-cols-[1.05fr_0.95fr]">
            <div className="absolute inset-0 opacity-80" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 12% 10%, hsl(var(--primary) / .22), transparent 26rem), radial-gradient(circle at 92% 84%, hsl(var(--brand-teal) / .42), transparent 24rem)' }} />
            <div className="absolute inset-0 opacity-[0.07]" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '38px 38px', maskImage: 'linear-gradient(90deg, black, transparent 74%)' }} />
            <div className="relative z-10 flex flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-primary backdrop-blur">
                  <Sparkles size={13} /> Visão consolidada
                </div>
                <h2 className="mt-5 max-w-xl text-3xl font-bold leading-tight tracking-[-0.045em] sm:text-4xl">Olá, {user?.login ?? 'usuário'}. Sua operação começa aqui.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/58">Navegue pelos módulos e acompanhe o universo de ativos disponível para o seu perfil.</p>
              </div>
              {canAccess(['projects:read']) ? (
                <Link className="mt-8 inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-primary/30 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-105" to="/app/projects">
                  <span>Abrir projetos</span> <ArrowUpRight size={15} />
                </Link>
              ) : null}
            </div>
            <PortfolioPulse cards={visibleCards} />
          </section>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleCards.map((card) => <MetricCard key={card.key} label={card.label} value={card.value ?? '-'} hint={card.hint} icon={card.icon} tone="brand" />)}
          </div>
          {quickAccess.length ? (
            <section className="premium-panel p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow"><Zap size={13} /> Acesso rápido</p>
                  <h2 className="mt-2 text-lg font-bold tracking-tight">Continue seu trabalho</h2>
                </div>
                <p className="text-xs text-muted-foreground">Módulos liberados para o seu perfil</p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {quickAccess.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} className="group flex min-h-20 items-center gap-3 rounded-xl border border-border/70 bg-muted/25 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary-subtle hover:shadow-panel">
                      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', index % 3 === 0 ? 'bg-primary-subtle text-brand-teal' : index % 3 === 1 ? 'bg-accent text-accent-foreground' : 'bg-info-subtle text-info')}><Icon size={17} /></span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.label}</span>
                      <ArrowUpRight className="text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" size={15} />
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : <EmptyState title="Nenhum indicador disponivel" description="Seu perfil ainda nao possui permissoes para visualizar indicadores operacionais." />}
    </PageContainer>
  );
}

function PortfolioPulse({ cards }: { cards: Array<{ key: string; label: string; value: number | null }> }) {
  const maxValue = Math.max(...cards.map((card) => card.value ?? 0), 1);

  return (
    <div className="relative z-10 m-4 flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl sm:m-6 sm:p-6 lg:m-8 lg:ml-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Distribuição do workspace</p>
          <p className="mt-1 text-sm font-semibold text-white/85">Volume por módulo</p>
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-primary/[0.1] text-primary"><TrendingUp size={18} /></span>
      </div>
      <div className="mt-8 grid gap-4">
        {cards.map((card, index) => (
          <div key={card.key}>
            <div className="mb-2 flex items-center justify-between gap-4 text-xs">
              <span className="font-medium text-white/58">{card.label}</span>
              <span className="font-bold text-white">{card.value ?? '-'}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={cn('h-full rounded-full transition-all duration-700', index % 4 === 0 ? 'bg-chart-1' : index % 4 === 1 ? 'bg-chart-2' : index % 4 === 2 ? 'bg-chart-4' : 'bg-chart-5')}
                style={{ width: `${Math.max(((card.value ?? 0) / maxValue) * 100, card.value ? 8 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
