import { zodResolver } from '@hookform/resolvers/zod';
import { Download, FileSpreadsheet, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { ApiError } from '@/api/http';
import { DataTable, type Column } from '@/components/base/DataTable';
import { FilterPanel } from '@/components/base/FilterPanel';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { SearchInput } from '@/components/base/SearchInput';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, ModalForm } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-context';
import { usePermissions } from '@/features/auth/usePermissions';
import type { ExportJob, ExportJobStatus, ExportJobType } from '@/types/api';
import { formatDateTime } from '@/utils/format';
import { exportJobFormSchema, exportJobStatusLabels, exportJobStatuses, exportJobTypeLabels, exportJobTypes, type ExportJobFormValues } from './exportJobSchemas';
import { useCancelExportJob, useCreateExportJob, useDownloadExportJob, useExportJobs, useRetryExportJob } from './exportJobsQueries';

export function ProjectExportJobsPage() {
  const projectId = Number(useParams().projectId);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInt(searchParams.get('page')) ?? 1;
  const search = searchParams.get('search') ?? '';
  const type = exportType(searchParams.get('type'));
  const status = exportStatus(searchParams.get('status'));
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';
  const params = { page, page_size: 20, search: search || undefined, type, status, date_from: dateFrom || undefined, date_to: dateTo || undefined };
  const jobs = useExportJobs(projectId, params);
  const create = useCreateExportJob(projectId);
  const cancel = useCancelExportJob(projectId);
  const retry = useRetryExportJob(projectId);
  const download = useDownloadExportJob(projectId);
  const [canceling, setCanceling] = useState<ExportJob | null>(null);
  const [retrying, setRetrying] = useState<ExportJob | null>(null);
  const pageData = jobs.data ? normalizePage<ExportJob>(jobs.data) : null;
  const createOpen = searchParams.get('new') === '1';

  function updateParams(values: Record<string, string | number | undefined>, replace = true) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace });
  }

  async function cancelJob() {
    if (!canceling) return;
    try {
      await cancel.mutateAsync(canceling.id);
      setCanceling(null);
      toast({ title: 'Exportacao cancelada', description: 'O job foi cancelado e seu historico foi preservado.', tone: 'success' });
    } catch (error) {
      toast(exportError(error, 'Nao foi possivel cancelar'));
    }
  }

  async function retryJob() {
    if (!retrying) return;
    try {
      await retry.mutateAsync(retrying.id);
      setRetrying(null);
      toast({ title: 'Nova tentativa criada', description: 'Um novo job de exportacao foi solicitado.', tone: 'success' });
    } catch (error) {
      toast(exportError(error, 'Nao foi possivel tentar novamente'));
    }
  }

  async function downloadJob(job: ExportJob) {
    try {
      const result = await download.mutateAsync(job.id);
      saveBlob(result.blob, result.job.file_name || job.file_name || `exportacao-${job.id}.xlsx`);
      toast({ title: 'Download iniciado', description: 'O arquivo autenticado foi preparado para download.', tone: 'success' });
    } catch (error) {
      toast(exportError(error, 'Nao foi possivel baixar o arquivo'));
    }
  }

  const columns: Column<ExportJob>[] = [
    { header: 'Tipo', cell: (job) => exportJobTypeLabels[job.type] },
    { header: 'Status', cell: (job) => <StatusBadge value={job.status} /> },
    { header: 'Arquivo', cell: (job) => <div className="font-medium">{job.file_name ?? 'Aguardando processamento'}<div className="text-xs text-muted-foreground">{formatBytes(job.size_bytes)}</div></div> },
    { header: 'Tentativa', cell: (job) => job.attempt_count },
    { header: 'Solicitada em', cell: (job) => formatDateTime(job.requested_at) },
    { header: 'Finalizada em', cell: (job) => formatDateTime(job.finished_at) },
    { header: 'Falha', cell: (job) => job.error_message ? <span className="text-xs text-destructive" title={job.error_code ?? undefined}>{job.error_message}</span> : '-' },
    {
      header: 'Acoes',
      cell: (job) => (
        <div className="flex flex-wrap gap-1">
          {job.status === 'finished' && hasPermission('export-jobs:download') ? <Button type="button" variant="ghost" size="sm" disabled={download.isPending} onClick={() => void downloadJob(job)}><Download size={15} /> Baixar</Button> : null}
          {(job.status === 'pending' || job.status === 'processing') && hasPermission('export-jobs:cancel') ? <Button type="button" variant="ghost" size="sm" onClick={() => setCanceling(job)}><XCircle size={15} /> Cancelar</Button> : null}
          {(['failed', 'cancelled', 'expired'] as ExportJobStatus[]).includes(job.status) && hasPermission('export-jobs:retry') ? <Button type="button" variant="ghost" size="sm" onClick={() => setRetrying(job)}><RefreshCw size={15} /> Tentar novamente</Button> : null}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Exportacoes"
        description="Gere e acompanhe arquivos XLSX do projeto sem expor caminhos internos de armazenamento."
        action={hasPermission('export-jobs:create') ? <Button type="button" onClick={() => updateParams({ new: 1 }, false)}><FileSpreadsheet size={17} /> Nova exportacao</Button> : null}
      />
      <div className="flex flex-wrap gap-2 border-b pb-3 text-sm">
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/summary`}>Resumo</Link>
        <span className="text-muted-foreground">/ Exportacoes</span>
      </div>
      <FilterPanel>
        <SearchInput value={search} onChange={(value) => updateParams({ search: value, page: 1 })} placeholder="Buscar exportacao" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={type ?? ''} onChange={(event) => updateParams({ type: event.target.value, page: 1 })} aria-label="Filtrar exportacao por tipo">
          <option value="">Todos os tipos</option>
          {exportJobTypes.map((value) => <option key={value} value={value}>{exportJobTypeLabels[value]}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status ?? ''} onChange={(event) => updateParams({ status: event.target.value, page: 1 })} aria-label="Filtrar exportacao por status">
          <option value="">Todos os status</option>
          {exportJobStatuses.map((value) => <option key={value} value={value}>{exportJobStatusLabels[value]}</option>)}
        </select>
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="date" value={dateFrom} onChange={(event) => updateParams({ date_from: event.target.value, page: 1 })} aria-label="Inicio do periodo" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="date" value={dateTo} onChange={(event) => updateParams({ date_to: event.target.value, page: 1 })} aria-label="Fim do periodo" />
      </FilterPanel>
      {jobs.isLoading ? <LoadingState label="Carregando exportacoes" /> : null}
      {jobs.isError ? <ErrorState message={jobs.error instanceof Error ? jobs.error.message : undefined} onRetry={() => void jobs.refetch()} /> : null}
      {!jobs.isLoading && !jobs.isError && pageData ? (
        <>
          <DataTable columns={columns} items={pageData.items} getKey={(job) => job.id} />
          <Pagination page={pageData.page} totalPages={pageData.totalPages} onPageChange={(value) => updateParams({ page: value })} />
        </>
      ) : null}
      <ModalForm open={createOpen && hasPermission('export-jobs:create')} onOpenChange={(open) => !open && updateParams({ new: undefined })} title="Nova exportacao">
        <CreateExportForm busy={create.isPending} onSubmit={async (value) => {
          await create.mutateAsync(value);
          updateParams({ new: undefined });
          toast({ title: 'Exportacao solicitada', description: 'O processamento foi iniciado e a lista sera atualizada automaticamente.', tone: 'success' });
        }} />
      </ModalForm>
      <ConfirmDialog open={Boolean(canceling)} onOpenChange={(open) => !open && !cancel.isPending && setCanceling(null)} title="Cancelar exportacao" description="Confirma o cancelamento deste job? O historico sera preservado." busy={cancel.isPending} onConfirm={() => void cancelJob()} />
      <ConfirmDialog open={Boolean(retrying)} onOpenChange={(open) => !open && !retry.isPending && setRetrying(null)} title="Tentar exportacao novamente" description="Uma nova tentativa sera criada e vinculada ao job anterior." busy={retry.isPending} onConfirm={() => void retryJob()} />
    </PageContainer>
  );
}

function CreateExportForm({ busy, onSubmit }: { busy: boolean; onSubmit: (type: ExportJobType) => Promise<void> }) {
  const form = useForm<ExportJobFormValues>({ resolver: zodResolver(exportJobFormSchema), defaultValues: { type: undefined } });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(async ({ type }) => {
      try {
        await onSubmit(type);
      } catch (error) {
        form.setError('root', { message: error instanceof Error ? error.message : 'Nao foi possivel solicitar a exportacao.' });
      }
    })}>
      <label className="grid gap-2 text-sm font-semibold">Tipo de exportacao
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('type')}>
          <option value="">Selecione</option>
          {exportJobTypes.map((type) => <option key={type} value={type}>{exportJobTypeLabels[type]}</option>)}
        </select>
      </label>
      {form.formState.errors.type?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.type.message}</p> : null}
      {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      <Button type="submit" loading={busy || form.formState.isSubmitting}>Solicitar exportacao</Button>
    </form>
  );
}

function exportError(error: unknown, title: string) {
  if (error instanceof ApiError && error.status === 403) return { title: 'Sem permissao', description: 'Seu acesso nao permite executar esta acao.', tone: 'error' as const };
  if (error instanceof ApiError && error.status === 409) return { title: 'Acao indisponivel', description: error.message, tone: 'error' as const };
  return { title, description: error instanceof Error ? error.message : 'Tente novamente.', tone: 'error' as const };
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatBytes(value?: number | null) {
  if (!value) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function positiveInt(value: string | null) {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function exportType(value: string | null): ExportJobType | undefined {
  return exportJobTypes.includes(value as ExportJobType) ? value as ExportJobType : undefined;
}

function exportStatus(value: string | null): ExportJobStatus | undefined {
  return exportJobStatuses.includes(value as ExportJobStatus) ? value as ExportJobStatus : undefined;
}
