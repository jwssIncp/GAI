import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Eye, FileDown, FileUp, Plus, RefreshCw, Send, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { MetricCard, ProgressCard } from '@/components/base/Cards';
import { DataTable, type Column } from '@/components/base/DataTable';
import { FileUpload } from '@/components/base/Inputs';
import { FilterPanel } from '@/components/base/FilterPanel';
import { FormField } from '@/components/base/FormField';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DrawerForm, ModalForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { usePermissions } from '@/features/auth/usePermissions';
import { formatDateTime } from '@/utils/format';
import {
  importFileTypeLabels,
  importFileTypes,
  importPayloadFormSchema,
  importSessionFormSchema,
  importSessionSourceLabels,
  importSessionSources,
  importSessionStatusLabels,
  importSessionStatuses,
  importSessionTypeLabels,
  importSessionTypes,
  type ImportPayloadFormValues,
  type ImportSessionFormValues,
} from './importSessionSchemas';
import {
  useCreateImportPayload,
  useCreateImportSession,
  useImportErrors,
  useImportFileDownloadUrl,
  useImportFiles,
  useImportPayloads,
  useImportSession,
  useImportSessionAction,
  useImportSessions,
  useReprocessImportPayload,
  useUploadImportFile,
  useImportPhysicalObservations,
} from './importSessionsQueries';
import type { ImportFile, ImportFileType, ImportPayload, ImportPayloadError, ImportSession, ImportSessionStatus } from '@/types/api';
import { createIdempotencyKey } from '@/features/inventory-operations/idempotency';

const ALLOWED_FILE_TYPES = [
  'application/json',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
] as const;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function progress(session: ImportSession) {
  const expected = session.expected_payloads ?? session.received_payloads;
  if (!expected) return 0;
  return Math.round((session.processed_payloads / expected) * 100);
}

function formatBytes(value?: number | null) {
  if (!value) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function ProjectImportSessionsPage() {
  const projectId = Number(useParams().projectId);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ImportSessionStatus | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<ImportSession | null>(null);
  const [finishing, setFinishing] = useState<ImportSession | null>(null);
  const [canceling, setCanceling] = useState<ImportSession | null>(null);
  const [retrying, setRetrying] = useState<ImportSession | null>(null);
  const { hasPermission } = usePermissions();
  const params = useMemo(() => ({ page, page_size: 20, status: status || undefined }), [page, status]);
  const query = useImportSessions(projectId, params);
  const create = useCreateImportSession(projectId);
  const finish = useImportSessionAction(projectId, 'finish');
  const cancel = useImportSessionAction(projectId, 'cancel');
  const retry = useImportSessionAction(projectId, 'retry');
  const data = query.data ? normalizePage(query.data) : null;
  const columns: Column<ImportSession>[] = [
    { header: 'Tipo', cell: (session) => importSessionTypeLabels[session.type] },
    { header: 'Origem', cell: (session) => importSessionSourceLabels[session.source] },
    { header: 'Status', cell: (session) => <StatusBadge value={session.status} /> },
    { header: 'UUID', cell: (session) => <span className="font-mono text-xs">{session.session_uuid}</span> },
    { header: 'Payloads', cell: (session) => `${session.received_payloads}/${session.expected_payloads ?? '-'}` },
    { header: 'Processados', cell: (session) => session.processed_payloads },
    { header: 'Falhas', cell: (session) => session.failed_payloads },
    { header: 'Itens', cell: (session) => session.total_items },
    { header: 'Criados', cell: (session) => session.total_created },
    { header: 'Atualizados', cell: (session) => session.total_updated },
    { header: 'Removidos', cell: (session) => session.total_deleted },
    { header: 'Criada em', cell: (session) => formatDateTime(session.created_at) },
    { header: 'Acoes', cell: (session) => (
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" aria-label="Visualizar importacao" onClick={() => setViewing(session)}><Eye size={16} /></Button>
        <PermissionGate permissions={['import-sessions:finish']}><Button type="button" variant="ghost" aria-label="Finalizar importacao" disabled={session.status !== 'open' && session.status !== 'receiving'} onClick={() => setFinishing(session)}><CheckCircle2 size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['import-sessions:cancel']}><Button type="button" variant="ghost" aria-label="Cancelar importacao" disabled={session.status === 'finished' || session.status === 'cancelled' || session.status === 'expired'} onClick={() => setCanceling(session)}><XCircle size={16} /></Button></PermissionGate>
        <PermissionGate permissions={['import-sessions:retry']}><Button type="button" variant="ghost" aria-label="Retry importacao" disabled={session.status !== 'failed'} onClick={() => setRetrying(session)}><RefreshCw size={16} /></Button></PermissionGate>
      </div>
    ) },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Importacoes"
        description={`Projeto #${projectId}. Sessoes de sincronizacao, payloads, erros e arquivos brutos.`}
        action={hasPermission('import-sessions:create') ? <Button type="button" onClick={() => setCreateOpen(true)}><Plus size={17} /> Nova importacao</Button> : null}
      />
      <div className="flex flex-wrap gap-2 border-b pb-3 text-sm">
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/summary`}>Resumo</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/inventory-items`}>Itens inventariados</Link>
        <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/accounting-items`}>Base contabil</Link>
        <span className="text-muted-foreground">/ Importacoes</span>
      </div>
      <FilterPanel>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" disabled aria-label="Filtrar importacao por tipo">
          <option>Todos os tipos</option>
          {importSessionTypes.map((item) => <option key={item}>{importSessionTypeLabels[item]}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" disabled aria-label="Filtrar importacao por origem">
          <option>Todas origens</option>
          {importSessionSources.map((item) => <option key={item}>{importSessionSourceLabels[item]}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={status} onChange={(event) => { setStatus(event.target.value as ImportSessionStatus | ''); setPage(1); }} aria-label="Filtrar importacao por status">
          <option value="">Todos status</option>
          {importSessionStatuses.map((item) => <option key={item} value={item}>{importSessionStatusLabels[item]}</option>)}
        </select>
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="date" disabled aria-label="Inicio do periodo" />
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="date" disabled aria-label="Fim do periodo" />
      </FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : data ? (
        <>
          <DataTable columns={columns} items={data.items} getKey={(session) => session.id} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
      <DrawerForm open={createOpen} onOpenChange={setCreateOpen} title="Nova importacao">
        <ImportSessionForm busy={create.isPending} onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} />
      </DrawerForm>
      <ImportSessionDetailDrawer projectId={projectId} session={viewing} onOpenChange={(open) => !open && setViewing(null)} />
      <ConfirmDialog open={Boolean(finishing)} onOpenChange={(open) => !open && setFinishing(null)} title="Finalizar importacao" description={`Finalizar recebimento da sessao #${finishing?.id ?? ''}?`} onConfirm={() => finishing && finish.mutate(finishing.id, { onSuccess: () => setFinishing(null) })} />
      <ConfirmDialog open={Boolean(canceling)} onOpenChange={(open) => !open && setCanceling(null)} title="Cancelar importacao" description={`Cancelar sessao #${canceling?.id ?? ''}?`} onConfirm={() => canceling && cancel.mutate(canceling.id, { onSuccess: () => setCanceling(null) })} />
      <ConfirmDialog open={Boolean(retrying)} onOpenChange={(open) => !open && setRetrying(null)} title="Retry da importacao" description={`Reprocessar payloads com erro da sessao #${retrying?.id ?? ''}?`} onConfirm={() => retrying && retry.mutate(retrying.id, { onSuccess: () => setRetrying(null) })} />
    </PageContainer>
  );
}

function ImportSessionForm({ busy, onSubmit }: { busy?: boolean; onSubmit: (payload: { type: ImportSession['type']; source: ImportSession['source']; expected_payloads?: number }) => void }) {
  const form = useForm<ImportSessionFormValues>({ resolver: zodResolver(importSessionFormSchema), defaultValues: { type: '', source: '', expected_payloads: '' } });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => {
      const expectedPayloads = values.expected_payloads === '' || values.expected_payloads == null ? undefined : Number(values.expected_payloads);
      onSubmit({
        type: values.type as ImportSession['type'],
        source: values.source as ImportSession['source'],
        expected_payloads: expectedPayloads,
      });
    })}>
      <FormField label="Tipo" error={form.formState.errors.type?.message}>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('type')}>
          <option value="">Selecione</option>
          {importSessionTypes.map((item) => <option key={item} value={item}>{importSessionTypeLabels[item]}</option>)}
        </select>
      </FormField>
      <FormField label="Origem" error={form.formState.errors.source?.message}>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('source')}>
          <option value="">Selecione</option>
          {importSessionSources.map((item) => <option key={item} value={item}>{importSessionSourceLabels[item]}</option>)}
        </select>
      </FormField>
      <FormField label="Payloads esperados" error={form.formState.errors.expected_payloads?.message}>
        <input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="number" min={1} max={100000} {...form.register('expected_payloads')} />
      </FormField>
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">O processamento da importacao acontece no backend. O frontend apenas registra a sessao e acompanha o andamento.</p>
      <Button loading={busy}>Criar importacao</Button>
    </form>
  );
}

function ImportSessionDetailDrawer({ projectId, session, onOpenChange }: { projectId: number; session: ImportSession | null; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<'physical' | 'payloads' | 'errors' | 'files' | 'technical'>('payloads');
  const detail = useImportSession(projectId, session?.id);
  const current = detail.data ?? session;
  return (
    <DrawerForm open={Boolean(session)} onOpenChange={onOpenChange} title="Detalhes da importacao">
      {current ? (
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard label="Payloads recebidos" value={current.received_payloads} />
            <MetricCard label="Payloads falhos" value={current.failed_payloads} />
            <MetricCard label="Itens" value={current.total_items} />
            <MetricCard label="Falhas totais" value={current.total_failed} />
          </div>
          <ProgressCard label="Progresso dos payloads" value={progress(current)} />
          <dl className="grid gap-3 text-sm">
            <Info label="Status" value={<StatusBadge value={current.status} />} />
            <Info label="UUID" value={<span className="font-mono text-xs">{current.session_uuid}</span>} />
            <Info label="Tipo" value={importSessionTypeLabels[current.type]} />
            <Info label="Origem" value={importSessionSourceLabels[current.source]} />
            <Info label="Criada em" value={formatDateTime(current.created_at)} />
            <Info label="Atualizada em" value={formatDateTime(current.updated_at)} />
            {current.error_message ? <Info label="Erro" value={current.error_message} /> : null}
          </dl>
          <div className="flex flex-wrap gap-2 border-b">
            {([...(current.type === 'physical_observations_import' ? ['physical' as const] : []), 'payloads', 'errors', 'files', 'technical'] as const).map((item) => (
              <button key={item} type="button" className={`px-3 py-2 text-sm font-medium ${tab === item ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setTab(item)}>
                {item === 'physical' ? 'Importar XLSX' : item === 'payloads' ? 'Payloads' : item === 'errors' ? 'Erros' : item === 'files' ? 'Arquivos' : 'Dados tecnicos'}
              </button>
            ))}
          </div>
          {tab === 'payloads' ? <PayloadsPanel projectId={projectId} sessionId={current.id} /> : null}
          {tab === 'physical' ? <PhysicalObservationsPanel projectId={projectId} sessionId={current.id} /> : null}
          {tab === 'errors' ? <ErrorsPanel projectId={projectId} sessionId={current.id} /> : null}
          {tab === 'files' ? <FilesPanel projectId={projectId} sessionId={current.id} /> : null}
          {tab === 'technical' ? <SafeTechnicalPanel session={current} /> : null}
        </div>
      ) : null}
    </DrawerForm>
  );
}

function PhysicalObservationsPanel({ projectId, sessionId }: { projectId: number; sessionId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [payloadNumber, setPayloadNumber] = useState('1');
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey());
  const mutation = useImportPhysicalObservations(projectId, sessionId);
  function submit() {
    if (!file) return;
    mutation.mutate({ file, payload_number: Number(payloadNumber), idempotency_key: idempotencyKey }, { onSuccess: () => { setFile(null); setPayloadNumber(String(Number(payloadNumber) + 1)); setIdempotencyKey(createIdempotencyKey()); } });
  }
  function select(next: File) {
    if (!next.name.toLowerCase().endsWith('.xlsx')) return;
    setFile(next);
  }
  return <section className="grid gap-3 rounded-xl border p-4"><div><h3 className="font-semibold">Importar observacoes fisicas</h3><p className="mt-1 text-sm text-muted-foreground">Somente XLSX. O arquivo e processado pelo backend; erros validos permanecem disponiveis por linha na aba Erros.</p></div><label className="grid gap-1 text-sm font-medium">Numero do payload<input className="h-10 rounded-md border bg-background px-3" type="number" min={1} value={payloadNumber} onChange={(event) => setPayloadNumber(event.target.value)} /></label><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"><FileUp size={16} /> {file?.name ?? 'Selecionar XLSX'}<FileUpload className="sr-only" aria-label="Selecionar XLSX de observacoes fisicas" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onFile={select} /></label>{mutation.isError ? <ErrorState message={(mutation.error as Error).message} /> : null}{mutation.isSuccess ? <p role="status" className="rounded-md bg-success/10 p-3 text-sm">Arquivo processado. Consulte o resumo de payloads e os erros por linha.</p> : null}<Button disabled={!file || !payloadNumber || mutation.isPending} onClick={submit}>{mutation.isPending ? 'Processando...' : 'Enviar e processar XLSX'}</Button></section>;
}

function PayloadsPanel({ projectId, sessionId }: { projectId: number; sessionId: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState<ImportPayload | null>(null);
  const payloads = useImportPayloads(projectId, sessionId);
  const create = useCreateImportPayload(projectId, sessionId);
  const reprocess = useReprocessImportPayload(projectId, sessionId);
  const data = payloads.data ? normalizePage(payloads.data) : null;
  const columns: Column<ImportPayload>[] = [
    { header: 'Numero', cell: (payload) => payload.payload_number },
    { header: 'Status', cell: (payload) => <StatusBadge value={payload.status} /> },
    { header: 'Itens', cell: (payload) => payload.items_count },
    { header: 'Imagens', cell: (payload) => payload.images_count },
    { header: 'Criados', cell: (payload) => payload.created_count },
    { header: 'Atualizados', cell: (payload) => payload.updated_count },
    { header: 'Removidos', cell: (payload) => payload.deleted_count },
    { header: 'Falhas', cell: (payload) => payload.failed_count },
    { header: 'Checksum', cell: (payload) => payload.checksum ?? '-' },
    { header: 'Acoes', cell: (payload) => <PermissionGate permissions={['import-payloads:reprocess']}><Button type="button" variant="ghost" aria-label="Reprocessar payload" disabled={payload.status !== 'failed'} onClick={() => setReprocessing(payload)}><RefreshCw size={16} /></Button></PermissionGate> },
  ];
  return (
    <section className="grid gap-3">
      <PermissionGate permissions={['import-payloads:create']}><div className="flex justify-end"><Button type="button" onClick={() => setCreateOpen(true)}><Send size={16} /> Enviar payload</Button></div></PermissionGate>
      {payloads.isLoading ? <LoadingState label="Carregando payloads" /> : payloads.isError ? <ErrorState message={(payloads.error as Error).message} onRetry={() => payloads.refetch()} /> : data ? <DataTable columns={columns} items={data.items} getKey={(payload) => payload.id} /> : null}
      <ModalForm open={createOpen} onOpenChange={setCreateOpen} title="Enviar payload tecnico">
        <PayloadForm busy={create.isPending} onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} />
      </ModalForm>
      <ConfirmDialog open={Boolean(reprocessing)} onOpenChange={(open) => !open && setReprocessing(null)} title="Reprocessar payload" description={`Reprocessar payload #${reprocessing?.payload_number ?? ''}?`} onConfirm={() => reprocessing && reprocess.mutate(reprocessing.id, { onSuccess: () => setReprocessing(null) })} />
    </section>
  );
}

function PayloadForm({ busy, onSubmit }: { busy?: boolean; onSubmit: (payload: { payload_number: number; idempotency_key: string; checksum?: string; items: Array<Record<string, unknown>>; metadata?: Record<string, unknown> }) => void }) {
  const form = useForm<ImportPayloadFormValues>({ resolver: zodResolver(importPayloadFormSchema), defaultValues: { payload_number: '', idempotency_key: '', checksum: '', payload_json: '{"items":[]}' } });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => {
      const body = JSON.parse(values.payload_json) as { items: Array<Record<string, unknown>>; metadata?: Record<string, unknown> };
      onSubmit({
        payload_number: Number(values.payload_number),
        idempotency_key: values.idempotency_key,
        checksum: values.checksum || undefined,
        items: body.items,
        metadata: body.metadata,
      });
    })}>
      <FormField label="Numero do payload" error={form.formState.errors.payload_number?.message}><input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="number" {...form.register('payload_number')} /></FormField>
      <FormField label="Chave idempotente" error={form.formState.errors.idempotency_key?.message}><input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('idempotency_key')} /></FormField>
      <FormField label="Checksum"><input className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('checksum')} /></FormField>
      <FormField label="Payload JSON" error={form.formState.errors.payload_json?.message}><textarea className="min-h-40 rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring" {...form.register('payload_json')} /></FormField>
      <Button loading={busy}>Enviar payload</Button>
    </form>
  );
}

function ErrorsPanel({ projectId, sessionId }: { projectId: number; sessionId: number }) {
  const errors = useImportErrors(projectId, sessionId);
  const data = errors.data ? normalizePage(errors.data) : null;
  const columns: Column<ImportPayloadError>[] = [
    { header: 'Linha', cell: (error) => error.row_number ?? '-' },
    { header: 'Referencia', cell: (error) => error.item_reference ?? '-' },
    { header: 'Codigo', cell: (error) => error.error_code },
    { header: 'Mensagem', cell: (error) => error.error_message },
    { header: 'Criado em', cell: (error) => formatDateTime(error.created_at) },
  ];
  return errors.isLoading ? <LoadingState label="Carregando erros" /> : errors.isError ? <ErrorState message={(errors.error as Error).message} onRetry={() => errors.refetch()} /> : data ? <DataTable columns={columns} items={data.items} getKey={(error) => error.id} /> : null;
}

function FilesPanel({ projectId, sessionId }: { projectId: number; sessionId: number }) {
  const [fileType, setFileType] = useState<ImportFileType>('raw_payload');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState<number | null>(null);
  const [download, setDownload] = useState<{ url: string; file: ImportFile } | null>(null);
  const files = useImportFiles(projectId, sessionId);
  const upload = useUploadImportFile(projectId, sessionId, fileType, setProgressValue);
  const downloadUrl = useImportFileDownloadUrl(projectId, sessionId);
  const columns: Column<ImportFile>[] = [
    { header: 'Tipo', cell: (file) => importFileTypeLabels[file.type] },
    { header: 'Nome', cell: (file) => file.original_name },
    { header: 'MIME', cell: (file) => file.mime_type },
    { header: 'Tamanho', cell: (file) => formatBytes(file.size_bytes) },
    { header: 'Checksum', cell: (file) => file.checksum ?? '-' },
    { header: 'Status', cell: (file) => <StatusBadge value={file.status} /> },
    { header: 'Acoes', cell: (file) => <PermissionGate permissions={['import-files:download']}><Button type="button" variant="secondary" disabled={file.status !== 'uploaded' && file.status !== 'processed'} onClick={() => downloadUrl.mutate(file.id, { onSuccess: (result) => setDownload({ url: result.download_url, file: result.file }) })}><FileDown size={16} /> Baixar</Button></PermissionGate> },
  ];
  async function handleFile(file: File) {
    setFeedback(null);
    if (!ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])) {
      setFeedback('Tipo de arquivo nao permitido pelo contrato atual.');
      return;
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      setFeedback('Arquivo deve ter entre 1 byte e 50 MB.');
      return;
    }
    setProgressValue(0);
    try {
      await upload.mutateAsync(file);
      setFeedback('Arquivo enviado com sucesso.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel enviar o arquivo.');
    } finally {
      setProgressValue(null);
    }
  }
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={fileType} onChange={(event) => setFileType(event.target.value as ImportFileType)} aria-label="Tipo do arquivo">
          {importFileTypes.map((item) => <option key={item} value={item}>{importFileTypeLabels[item]}</option>)}
        </select>
        <PermissionGate permissions={['import-files:create']}><label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><FileUp size={16} /> Enviar arquivo<FileUpload aria-label="Enviar arquivo de importacao" className="sr-only" accept={ALLOWED_FILE_TYPES.join(',')} onFile={handleFile} /></label></PermissionGate>
      </div>
      {feedback ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{feedback}</p> : null}
      {progressValue !== null ? <ProgressCard label="Upload" value={progressValue} /> : null}
      {files.isLoading ? <LoadingState label="Carregando arquivos" /> : files.isError ? <ErrorState message={(files.error as Error).message} onRetry={() => files.refetch()} /> : <DataTable columns={columns} items={files.data ?? []} getKey={(file) => file.id} />}
      <ModalForm open={Boolean(download)} onOpenChange={(open) => !open && setDownload(null)} title={download?.file.original_name ?? 'Download'}>
        {download ? <a className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" href={download.url} target="_blank" rel="noreferrer">Abrir arquivo</a> : null}
      </ModalForm>
    </section>
  );
}

function SafeTechnicalPanel({ session }: { session: ImportSession }) {
  return (
    <section className="grid gap-3 text-sm">
      <Info label="ID" value={session.id} />
      <Info label="Organization" value={`#${session.organization_id}`} />
      <Info label="Projeto" value={`#${session.project_id}`} />
      <Info label="Metadados" value={session.metadata ? JSON.stringify(session.metadata) : '-'} />
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Campos internos de armazenamento retornados pelo backend foram omitidos da interface.</p>
    </section>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}
