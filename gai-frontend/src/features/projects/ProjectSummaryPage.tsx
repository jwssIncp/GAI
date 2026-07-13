import {
  AlertTriangle,
  CircleDollarSign,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Image,
  ListChecks,
  Plus,
  UserPlus,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { companiesApi, organizationsApi } from '@/api/endpoints';
import { MetricCard, ProgressCard } from '@/components/base/Cards';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { StatusBadge } from '@/components/base/StatusBadge';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { usePermissions } from '@/features/auth/usePermissions';
import { ProjectFieldAgentsPanel } from '@/features/field-agents/ProjectFieldAgentsPanel';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';
import type { Project, ProjectStatus, ProjectSummary } from '@/types/api';
import { ProjectLifecycleActions } from './ProjectLifecycleActions';
import { ProjectUnitsPanel } from './ProjectUnitsPanel';
import { canMutateProjectOperations } from './projectLifecycle';
import { useProject, useProjectDashboard } from './projectQueries';

const projectStatusLabels: Record<ProjectStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  paused: 'Pausado',
  inactive: 'Inativo',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
  archived: 'Arquivado',
};

const lockedStatuses: ProjectStatus[] = ['finished', 'cancelled', 'archived', 'inactive'];

type Tab = {
  label: string;
  to?: string;
  permissions?: string[];
  hint?: string;
  disabled?: boolean;
};

type Alert = {
  title: string;
  description: string;
  tone?: 'warning' | 'danger' | 'info';
};

export function ProjectSummaryPage() {
  const projectId = Number(useParams().projectId);
  const enabled = Number.isFinite(projectId);
  const project = useProject(enabled ? projectId : undefined);
  const dashboard = useProjectDashboard(enabled ? projectId : undefined);
  const projectData = project.data;
  const data = dashboard.data;
  const title = projectData?.name ?? data?.project.name ?? 'Workspace do projeto';

  return (
    <PageContainer>
      <div className="flex w-fit flex-wrap items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-panel backdrop-blur">
        <Link className="text-primary transition hover:text-primary/80" to="/app/projects">Projetos</Link>
        <span className="text-border">/</span>
        <span className="font-semibold text-foreground">{title}</span>
        <span className="text-border">/</span>
        <span>Visao geral</span>
      </div>
      <PageHeader
        title={title}
        description="Workspace operacional do projeto, com indicadores consolidados pelo backend e atalhos para os modulos de campo."
        action={projectData ? <ProjectActions project={projectData} /> : null}
      />
      {project.isLoading || dashboard.isLoading ? <LoadingState label="Carregando workspace do projeto" /> : null}
      {project.isError ? <ProjectError error={project.error} onRetry={() => project.refetch()} /> : null}
      {!project.isError && dashboard.isError ? <ProjectError error={dashboard.error} onRetry={() => dashboard.refetch()} /> : null}
      {!project.isLoading && !dashboard.isLoading && !project.isError && !dashboard.isError && !projectData && !data ? (
        <EmptyState title="Projeto nao encontrado" description="O projeto solicitado nao existe ou nao esta disponivel para este usuario." />
      ) : null}
      {projectData && data ? <ProjectWorkspace project={projectData} summary={data} /> : null}
    </PageContainer>
  );
}

function ProjectWorkspace({ project, summary }: { project: Project; summary: ProjectSummary }) {
  const alerts = buildAlerts(project, summary);
  return (
    <div className="grid gap-6">
      <ProjectHero project={project} summary={summary} />
      <WorkspaceTabs projectId={project.id} />
      <MetricGrid summary={summary} />
      <ProjectProgress project={project} summary={summary} />
      <OperationalAlerts alerts={alerts} />
      <QuickActions project={project} />
      <ModuleSummary projectId={project.id} summary={summary} />
      <RecentActivity activity={summary.recent_activity} />
      <PermissionGate permissions={['project-units:read']}>
        <ProjectUnitsPanel project={project} />
      </PermissionGate>
      <PermissionGate permissions={['project-field-agents:read']}>
        <ProjectFieldAgentsPanel project={project} />
      </PermissionGate>
      <ProjectSettings project={project} />
    </div>
  );
}

function ProjectHero({ project, summary }: { project: Project; summary: ProjectSummary }) {
  return (
    <section className="premium-panel relative grid gap-6 overflow-hidden p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="pointer-events-none absolute -left-20 -top-28 size-64 rounded-full bg-primary/[0.08] blur-3xl" aria-hidden="true" />
      <div className="relative z-10 grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge value={project.status} />
          <span className="text-xs font-semibold text-muted-foreground">Status: {projectStatusLabels[project.status] ?? project.status}</span>
        </div>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          {project.description || 'Projeto sem descricao cadastrada.'}
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <ProjectContextInfo project={project} />
          <Info label="Inicio" value={formatDate(project.start_date)} />
          <Info label="Termino" value={formatDate(project.end_date)} />
          <Info label="Criado em" value={formatDateTime(project.created_at)} />
          <Info label="Atualizado em" value={formatDateTime(project.updated_at)} />
          <Info label="Avaliados" value={`${summary.inventory.evaluated_items}/${summary.inventory.total_items}`} />
          <Info label="Inventariantes ativos" value={summary.field_agents.active_field_agents} />
        </dl>
      </div>
      <div className="relative z-10 grid content-start gap-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-subtle via-card/80 to-accent/55 p-5 shadow-inner-highlight dark:from-primary/10 dark:via-card/75 dark:to-accent/30">
        <div>
          <p className="eyebrow">Pulso do projeto</p>
          <p className="mt-1.5 text-sm font-bold">Saude operacional</p>
        </div>
        <ProgressCard label="Inventario avaliado" value={Number(summary.inventory.progress_percentage ?? 0)} />
        <p className="text-sm leading-6 text-muted-foreground">
          {summary.inventory.pending_items} itens pendentes, {summary.pending_issues.open_pending_issues} pendencias abertas e {summary.images.total_images} imagens registradas.
        </p>
      </div>
    </section>
  );
}

function ProjectActions({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canMutateProjectOperations(project.status) ? (
        <PermissionGate permissions={['projects:update']}>
          <LinkButton to={`/app/projects?edit=${project.id}`} label="Editar projeto" />
        </PermissionGate>
      ) : null}
      <ProjectLifecycleActions project={project} />
    </div>
  );
}

function MetricGrid({ summary }: { summary: ProjectSummary }) {
  const financial = summary.financial;
  const imports = summary.imports;
  const exports = summary.exports;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total de itens" value={summary.inventory.total_items} hint={`${summary.inventory.evaluated_items} avaliados`} icon={<ListChecks size={18} />} />
      <MetricCard label="Itens pendentes" value={summary.inventory.pending_items} hint={`${summary.inventory.divergent_items} divergentes`} />
      <MetricCard label="Imagens" value={summary.images.total_images} hint={`${summary.images.pending_upload_images} pendentes de upload`} icon={<Image size={18} />} />
      <MetricCard label="Base contabil" value={summary.accounting.total_accounting_items} hint={`${summary.accounting.matched_accounting_items} conciliados`} icon={<FileSpreadsheet size={18} />} />
      <MetricCard label="Pendencias abertas" value={summary.pending_issues.open_pending_issues} hint={`${summary.pending_issues.critical_pending_issues} criticas`} icon={<AlertTriangle size={18} />} />
      <MetricCard label="Financeiro total" value={financial ? formatMoney(financial.financial_total_amount) : 'Pendente'} hint={financial ? `${financial.pending_payments} pagamentos pendentes` : 'Metrica pendente no backend ou nao solicitada.'} icon={<CircleDollarSign size={18} />} />
      <MetricCard label="Importacoes em processamento" value={imports?.processing_import_sessions ?? 'Pendente'} hint={imports ? `${imports.failed_import_sessions} com falha` : 'Metrica pendente no backend ou nao solicitada.'} icon={<FileUp size={18} />} />
      <MetricCard label="Exportacoes concluidas" value={exports?.finished_export_jobs ?? 0} hint={exports ? `${exports.failed_export_jobs} com falha` : 'Nenhum job registrado.'} icon={<FileDown size={18} />} />
    </div>
  );
}

function ProjectProgress({ project, summary }: { project: Project; summary: ProjectSummary }) {
  const locked = lockedStatuses.includes(project.status);
  return (
    <section className="premium-panel grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p className="eyebrow">Performance</p>
        <h2 className="mt-2 text-lg font-bold tracking-tight">Progresso do projeto</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Percentual calculado no backend a partir dos itens avaliados sobre o total operacional.
        </p>
      </div>
      <div className="grid gap-3">
        <ProgressCard label="Itens avaliados" value={Number(summary.inventory.progress_percentage ?? 0)} />
        <p className="rounded-xl border border-border/60 bg-muted/35 p-3 text-sm leading-6 text-muted-foreground">
          Status operacional: <span className="font-medium text-foreground">{projectStatusLabels[project.status] ?? project.status}</span>.
          {locked ? ' Acoes operacionais devem ser revisadas antes de continuar.' : ' Projeto apto para operacao conforme permissoes do usuario.'}
        </p>
      </div>
    </section>
  );
}

function OperationalAlerts({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return (
      <section className="premium-panel p-5 sm:p-6">
        <p className="eyebrow">Monitoramento</p>
        <h2 className="mt-2 text-lg font-bold tracking-tight">Alertas operacionais</h2>
        <p className="mt-2 text-sm text-muted-foreground">Nenhum alerta operacional disponivel com as metricas atuais.</p>
      </section>
    );
  }
  return (
    <section className="grid gap-4">
      <div>
        <p className="eyebrow">Monitoramento</p>
        <h2 className="mt-2 text-lg font-bold tracking-tight">Alertas operacionais</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {alerts.map((alert) => (
          <div key={alert.title} className={cn('relative overflow-hidden rounded-xl border bg-card/80 p-4 shadow-panel', alert.tone === 'danger' ? 'border-destructive/30 bg-destructive/[0.035]' : alert.tone === 'warning' ? 'border-warning/30 bg-warning-subtle/40' : 'border-info/25 bg-info-subtle/35')}>
            <span className={cn('absolute inset-y-0 left-0 w-1', alert.tone === 'danger' ? 'bg-destructive' : alert.tone === 'warning' ? 'bg-warning' : 'bg-info')} aria-hidden="true" />
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className={cn(alert.tone === 'danger' ? 'text-destructive' : alert.tone === 'warning' ? 'text-warning' : 'text-info')} size={16} /> {alert.title}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkspaceTabs({ projectId }: { projectId: number }) {
  const tabs: Tab[] = [
    { label: 'Visao geral', to: `/app/projects/${projectId}/summary`, permissions: ['projects:read'] },
    { label: 'Itens', to: `/app/projects/${projectId}/inventory-items`, permissions: ['inventory-items:read'] },
    { label: 'Imagens', to: `/app/projects/${projectId}/inventory-items`, permissions: ['inventory-items:read'], hint: 'Imagens ficam no detalhe do item.' },
    { label: 'Base contabil', to: `/app/projects/${projectId}/accounting-items`, permissions: ['inventory-accounting-items:read'] },
    { label: 'Pendencias', to: `/app/projects/${projectId}/pending-issues`, permissions: ['inventory-pending-issues:read'] },
    { label: 'Inventariantes', to: '#inventariantes', permissions: ['project-field-agents:read'] },
    { label: 'Financeiro', to: `/app/projects/${projectId}/finance`, permissions: ['payments:read', 'expenses:read'] },
    { label: 'Importacoes', to: `/app/projects/${projectId}/import-sessions`, permissions: ['import-sessions:read'] },
    { label: 'Exportacoes', to: `/app/projects/${projectId}/export-jobs`, permissions: ['export-jobs:read'] },
    { label: 'Unidades', to: '#unidades', permissions: ['project-units:read'] },
    { label: 'Configuracoes', to: '#configuracoes', permissions: ['projects:read'] },
  ];
  return (
    <nav className="sticky top-[92px] z-20 flex gap-1.5 overflow-x-auto rounded-xl border border-border/70 bg-background/80 p-1.5 shadow-panel backdrop-blur-xl" aria-label="Abas do projeto">
      {tabs.map((tab) => <WorkspaceTab key={tab.label} tab={tab} />)}
    </nav>
  );
}

function WorkspaceTab({ tab }: { tab: Tab }) {
  const content = tab.disabled || !tab.to ? (
    <span className="inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-muted-foreground opacity-55" title={tab.hint}>{tab.label}</span>
  ) : tab.to.startsWith('#') ? (
    <Link className="inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground" to={tab.to} title={tab.hint}>
      {tab.label}
    </Link>
  ) : (
    <NavLink className={({ isActive }) => cn('inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold transition', isActive ? 'bg-card text-primary shadow-panel' : 'text-muted-foreground hover:bg-muted hover:text-foreground')} to={tab.to} title={tab.hint}>
      {tab.label}
    </NavLink>
  );
  return <PermissionGate permissions={tab.permissions}>{content}</PermissionGate>;
}

function QuickActions({ project }: { project: Project }) {
  const navigate = useNavigate();
  const locked = lockedStatuses.includes(project.status);
  const actions = [
    { label: 'Novo item', to: `/app/projects/${project.id}/inventory-items?new=1`, permissions: ['inventory-items:create'], icon: <Plus size={18} /> },
    { label: 'Importar base contabil', to: `/app/projects/${project.id}/accounting-items?import=1`, permissions: ['inventory-accounting-items:import'], icon: <FileSpreadsheet size={18} /> },
    { label: 'Gerar pendencias', to: `/app/projects/${project.id}/pending-issues?generate=1`, permissions: ['inventory-pending-issues:generate'], icon: <AlertTriangle size={18} /> },
    { label: 'Nova despesa', to: `/app/projects/${project.id}/finance?tab=expenses&new=1`, permissions: ['expenses:create'], icon: <CircleDollarSign size={18} /> },
    { label: 'Novo pagamento', to: `/app/projects/${project.id}/finance?tab=payments&new=1`, permissions: ['payments:create'], icon: <CircleDollarSign size={18} /> },
    { label: 'Nova exportacao', to: `/app/projects/${project.id}/export-jobs?new=1`, permissions: ['export-jobs:create'], icon: <FileDown size={18} /> },
    { label: 'Nova importacao', to: `/app/projects/${project.id}/import-sessions?new=1`, permissions: ['import-sessions:create'], icon: <FileUp size={18} /> },
    { label: 'Vincular inventariante', to: '#inventariantes', permissions: ['project-field-agents:assign'], icon: <UserPlus size={18} /> },
  ];
  return (
    <section className="grid gap-4">
      <div>
        <p className="eyebrow">Produtividade</p>
        <h2 className="mt-2 text-lg font-bold tracking-tight">Acoes rapidas</h2>
        <p className="mt-1 text-sm text-muted-foreground">{locked ? 'Projeto bloqueado operacionalmente; atalhos ficam sinalizados.' : 'Atalhos respeitam permissoes e levam aos fluxos existentes.'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <PermissionGate key={action.label} permissions={action.permissions}>
            <button type="button" className="group flex min-h-24 items-center gap-3 rounded-xl border border-border/70 bg-card/80 p-4 text-left shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary-subtle hover:shadow-elevated disabled:cursor-not-allowed disabled:opacity-50" disabled={locked && action.label !== 'Nova exportacao'} onClick={() => navigate(action.to)}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground transition group-hover:scale-105">{action.icon}</span>
              <span>
                <span className="block text-sm font-semibold">{action.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">Abrir modulo</span>
              </span>
            </button>
          </PermissionGate>
        ))}
      </div>
    </section>
  );
}

function ModuleSummary({ projectId, summary }: { projectId: number; summary: ProjectSummary }) {
  const modules = [
    { title: 'Itens inventariados', description: `${summary.inventory.pending_items} pendentes, ${summary.inventory.divergent_items} divergentes e ${summary.inventory.not_found_items} nao encontrados.`, to: `/app/projects/${projectId}/inventory-items`, permissions: ['inventory-items:read'] },
    { title: 'Base contabil', description: `${summary.accounting.total_accounting_items} itens, ${summary.accounting.matched_accounting_items} conciliados e ${summary.accounting.divergent_accounting_items} divergentes.`, to: `/app/projects/${projectId}/accounting-items`, permissions: ['inventory-accounting-items:read'] },
    { title: 'Pendencias', description: `${summary.pending_issues.open_pending_issues} abertas, ${summary.pending_issues.resolved_pending_issues} resolvidas e ${summary.pending_issues.critical_pending_issues} criticas.`, to: `/app/projects/${projectId}/pending-issues`, permissions: ['inventory-pending-issues:read'] },
    { title: 'Financeiro', description: summary.financial ? `${formatMoney(summary.financial.financial_total_amount)} em pagamentos e despesas.` : 'Resumo financeiro nao retornado pelo dashboard.', to: `/app/projects/${projectId}/finance`, permissions: ['payments:read', 'expenses:read'] },
    { title: 'Importacoes', description: summary.imports ? `${summary.imports.total_import_sessions} sessoes, ${summary.imports.processing_import_sessions} em processamento e ${summary.imports.failed_import_sessions} com falha.` : 'Resumo de importacoes nao retornado pelo dashboard.', to: `/app/projects/${projectId}/import-sessions`, permissions: ['import-sessions:read'] },
    { title: 'Exportacoes', description: summary.exports ? `${summary.exports.total_export_jobs} jobs, ${summary.exports.finished_export_jobs} concluidos e ${summary.exports.failed_export_jobs} com falha.` : 'Nenhuma exportacao registrada.', to: `/app/projects/${projectId}/export-jobs`, permissions: ['export-jobs:read'] },
  ];
  return (
    <section className="grid gap-4">
      <div>
        <p className="eyebrow">Módulos conectados</p>
        <h2 className="mt-2 text-lg font-bold tracking-tight">Resumo por modulo</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {modules.map((module) => (
          <PermissionGate key={module.title} permissions={module.permissions}>
            <Link className="interactive-card premium-panel group p-5" to={module.to}>
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold">{module.title}</h3>
                <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">→</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
            </Link>
          </PermissionGate>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({ activity }: { activity?: ProjectSummary['recent_activity'] }) {
  const rows = [
    { label: 'Ultimo item criado', value: activity?.last_inventory_item_created_at },
    { label: 'Ultimo item atualizado', value: activity?.last_inventory_item_updated_at },
    { label: 'Ultima importacao finalizada', value: activity?.last_import_finished_at },
    { label: 'Ultima exportacao finalizada', value: activity?.last_export_finished_at },
    { label: 'Ultima pendencia criada', value: activity?.last_pending_issue_created_at },
    { label: 'Ultimo pagamento atualizado', value: activity?.last_payment_updated_at },
  ];
  const hasAny = rows.some((row) => row.value);
  return (
    <section className="premium-panel p-5 sm:p-6">
      <p className="eyebrow">Timeline</p>
      <h2 className="mt-2 text-lg font-bold tracking-tight">Atividades recentes</h2>
      {!activity || !hasAny ? (
        <p className="mt-2 text-sm text-muted-foreground">Atividades recentes dependem de endpoint de auditoria/eventos no backend. O dashboard atual retorna apenas alguns marcos agregados.</p>
      ) : (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => <Info key={row.label} label={row.label} value={formatDateTime(row.value)} />)}
        </dl>
      )}
    </section>
  );
}

function ProjectSettings({ project }: { project: Project }) {
  const settings = project.settings && Object.keys(project.settings).length ? project.settings : null;
  return (
    <section id="configuracoes" className="premium-panel scroll-mt-32 p-5 sm:p-6">
      <p className="eyebrow">Configuracoes</p>
      <h2 className="mt-2 text-lg font-bold tracking-tight">Configuracoes operacionais</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Nenhuma configuracao operacional suportada pode ser alterada nesta versao.</p>
      {settings ? (
        <details className="mt-4 rounded-xl border border-border/60 bg-muted/25 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Dados legados somente para consulta</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(settings, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  );
}

function buildAlerts(project: Project, summary: ProjectSummary): Alert[] {
  const alerts: Alert[] = [];
  if (summary.pending_issues.critical_pending_issues > 0) {
    alerts.push({ title: 'Pendencias criticas', description: `${summary.pending_issues.critical_pending_issues} pendencia(s) critica(s) exigem revisao.`, tone: 'danger' });
  }
  if ((summary.imports?.failed_import_sessions ?? 0) > 0) {
    alerts.push({ title: 'Importacoes com falha', description: `${summary.imports?.failed_import_sessions ?? 0} sessao(oes) de importacao falharam.`, tone: 'warning' });
  }
  if ((summary.exports?.failed_export_jobs ?? 0) > 0) {
    alerts.push({ title: 'Exportacoes com falha', description: `${summary.exports?.failed_export_jobs ?? 0} exportacao(oes) falharam.`, tone: 'warning' });
  }
  if ((summary.financial?.pending_payments ?? 0) > 0) {
    alerts.push({ title: 'Pagamentos pendentes', description: `${summary.financial?.pending_payments ?? 0} pagamento(s) pendente(s) no financeiro.`, tone: 'info' });
  }
  if (summary.field_agents.total_field_agents === 0) {
    alerts.push({ title: 'Projeto sem inventariantes', description: 'Vincule inventariantes antes de iniciar a execucao em campo.', tone: 'warning' });
  }
  if (summary.inventory.total_items === 0) {
    alerts.push({ title: 'Projeto sem itens', description: 'Nenhum item inventariado foi registrado para este projeto.', tone: 'warning' });
  }
  if (summary.accounting.total_accounting_items === 0) {
    alerts.push({ title: 'Base contabil nao importada', description: 'A base contabil ainda nao possui itens para conciliacao.', tone: 'info' });
  }
  if (lockedStatuses.includes(project.status)) {
    alerts.push({ title: 'Projeto bloqueado operacionalmente', description: `Status atual: ${projectStatusLabels[project.status] ?? project.status}.`, tone: 'warning' });
  }
  return alerts;
}

function ProjectError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : 'Nao foi possivel carregar o workspace do projeto.';
  if (message.includes('404') || message.toLowerCase().includes('not_found')) {
    return <EmptyState title="Projeto nao encontrado" description="O backend retornou NOT_FOUND para este projeto." />;
  }
  return <ErrorState message={message} onRetry={onRetry} />;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/55 bg-muted/25 p-3">
      <dt className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function ProjectContextInfo({ project }: { project: Project }) {
  const { hasPermission } = usePermissions();
  const canReadCompany = hasPermission('companies:read');
  const canReadOrganization = hasPermission('organizations:read');
  const company = useQuery({
    queryKey: ['companies', 'project-context', project.company_id],
    queryFn: () => companiesApi.get(project.company_id!),
    enabled: canReadCompany && Boolean(project.company_id),
  });
  const organization = useQuery({
    queryKey: ['organizations', 'project-context', project.organization_id],
    queryFn: () => organizationsApi.get(project.organization_id),
    enabled: canReadOrganization,
  });
  return (
    <>
      <Info label="Empresa vinculada" value={project.company_id ? company.data?.name ?? 'Empresa vinculada' : 'Nao vinculada'} />
      <Info label="Organizacao" value={organization.data?.trade_name || organization.data?.legal_name || (canReadOrganization ? 'Carregando organizacao' : 'Sua organizacao')} />
    </>
  );
}

function LinkButton({ to, label }: { to: string; label: string }) {
  return <Link className="inline-flex h-10 items-center justify-center rounded-lg border border-border/70 bg-card/80 px-4 text-sm font-semibold text-foreground shadow-panel transition hover:border-primary/25 hover:bg-primary-subtle hover:text-primary" to={to}>{label}</Link>;
}
import { useQuery } from '@tanstack/react-query';
