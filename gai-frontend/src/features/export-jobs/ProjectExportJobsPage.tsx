import { Archive, Download, FileSpreadsheet, RefreshCw, ShieldAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { projectsApi } from '@/api/endpoints';
import { MetricCard } from '@/components/base/Cards';
import { DataTable, type Column } from '@/components/base/DataTable';
import { FilterPanel } from '@/components/base/FilterPanel';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/utils/format';
import { exportJobStatusLabels, exportJobStatuses, exportJobTypeLabels, exportJobTypes } from './exportJobSchemas';

type PendingExportJob = {
  id: number;
  type: string;
  status: string;
  file_name?: string | null;
  size_bytes?: number | null;
  requested_by_id?: number | null;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  expires_at?: string | null;
};

const missingEndpoints = [
  'POST /projects/{projectId}/export-jobs',
  'GET /projects/{projectId}/export-jobs',
  'GET /projects/{projectId}/export-jobs/{id}',
  'POST /projects/{projectId}/export-jobs/{id}/download-url',
  'POST /projects/{projectId}/export-jobs/{id}/cancel',
  'POST /projects/{projectId}/export-jobs/{id}/retry',
];

function numberFromSummary(value: unknown) {
  return Number(value ?? 0);
}

export function ProjectExportJobsPage() {
  const projectId = Number(useParams().projectId);
  const summary = useQuery({
    queryKey: ['project-summary', projectId, 'exports'],
    queryFn: () => projectsApi.summary(projectId),
    enabled: Number.isFinite(projectId),
    refetchInterval: (query) => {
      const exports = query.state.data?.exports;
      const hasRunningJobs = numberFromSummary(exports?.pending_export_jobs) > 0 || numberFromSummary(exports?.processing_export_jobs) > 0;
      return hasRunningJobs ? 15000 : false;
    },
  });
  const exports = summary.data?.exports;
  const rows: PendingExportJob[] = [];
  const columns: Column<PendingExportJob>[] = [
    { header: 'Tipo', cell: (job) => exportJobTypeLabels[job.type as keyof typeof exportJobTypeLabels] ?? job.type },
    { header: 'Status', cell: (job) => <StatusBadge value={job.status} /> },
    { header: 'Arquivo', cell: (job) => job.file_name ?? '-' },
    { header: 'Tamanho', cell: (job) => job.size_bytes ? `${job.size_bytes} bytes` : '-' },
    { header: 'Solicitado por', cell: (job) => job.requested_by_id ? `#${job.requested_by_id}` : '-' },
    { header: 'Criado em', cell: (job) => formatDateTime(job.created_at) },
    { header: 'Iniciado em', cell: (job) => formatDateTime(job.started_at) },
    { header: 'Finalizado em', cell: (job) => formatDateTime(job.finished_at) },
    { header: 'Expira em', cell: (job) => formatDateTime(job.expires_at) },
    { header: 'Acoes', cell: () => <span className="text-xs text-muted-foreground">Aguardando backend</span> },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Exportacoes"
        description={`Projeto #${projectId}. Exportacoes e backups serao liberados quando o backend publicar os endpoints de export jobs.`}
        action={<Button type="button" disabled><FileSpreadsheet size={17} /> Nova exportacao</Button>}
      />
      <div className="flex flex-wrap gap-2 border-b pb-3 text-sm">
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/summary`}>Resumo</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/inventory-items`}>Itens inventariados</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/finance`}>Financeiro</Link>
        <span className="text-muted-foreground">/ Exportacoes</span>
      </div>
      {summary.isLoading ? <LoadingState label="Carregando resumo de exportacoes" /> : summary.isError ? (
        <ErrorState message={(summary.error as Error).message} onRetry={() => summary.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total" value={exports?.total_export_jobs ?? 0} icon={<Archive size={18} />} />
            <MetricCard label="Processando" value={(exports?.pending_export_jobs ?? 0) + (exports?.processing_export_jobs ?? 0)} icon={<RefreshCw size={18} />} />
            <MetricCard label="Finalizadas" value={exports?.finished_export_jobs ?? 0} icon={<Download size={18} />} />
            <MetricCard label="Com falha" value={exports?.failed_export_jobs ?? 0} icon={<ShieldAlert size={18} />} />
          </div>
          <FilterPanel>
            <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" disabled placeholder="Buscar exportacao" />
            <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" disabled aria-label="Filtrar exportacao por tipo">
              <option>Todos os tipos</option>
              {exportJobTypes.map((type) => <option key={type}>{exportJobTypeLabels[type]}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" disabled aria-label="Filtrar exportacao por status">
              <option>Todos status</option>
              {exportJobStatuses.map((status) => <option key={status}>{exportJobStatusLabels[status]}</option>)}
            </select>
            <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" disabled placeholder="Solicitante ID" />
            <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="date" disabled aria-label="Inicio do periodo" />
            <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="date" disabled aria-label="Fim do periodo" />
          </FilterPanel>
          {rows.length ? (
            <DataTable columns={columns} items={rows} getKey={(job) => job.id} />
          ) : (
            <EmptyState
              title="Export jobs ainda nao disponiveis"
              description="O contrato real do backend ainda nao possui endpoints de exportacao. Dados internos de storage nao serao expostos no frontend."
            />
          )}
          <section className="rounded-lg border bg-card p-5 shadow-panel">
            <h2 className="text-lg font-semibold">Dependencia backend pendente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A spec de Project Dashboard documenta exportacoes zeradas enquanto nao existir entidade/tabela export_jobs. Para ativar esta tela, o backend precisa publicar os endpoints abaixo.
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              {missingEndpoints.map((endpoint) => <li key={endpoint} className="rounded-md bg-muted px-3 py-2 font-mono">{endpoint}</li>)}
            </ul>
          </section>
        </>
      )}
    </PageContainer>
  );
}
