import { Download, ImagePlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { normalizePage } from '@/api/pagination';
import { FileUpload } from '@/components/base/Inputs';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { Pagination } from '@/components/base/Pagination';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { DrawerForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { formatDateTime } from '@/utils/format';
import type { InventoryEvidence, InventoryObservation } from '@/types/api';
import { getInventoryOperationErrorMessage } from './inventoryOperationErrors';
import { useInventoryEvidence, useInventoryEvidenceDownloadUrl, useUploadInventoryEvidence } from './inventoryOperationsQueries';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function ObservationEvidenceDrawer({
  projectId,
  sessionId,
  observation,
  sessionActive,
  open,
  onOpenChange,
}: {
  projectId: number;
  sessionId: number;
  observation: InventoryObservation | null;
  sessionActive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; evidence: InventoryEvidence } | null>(null);
  const roundId = observation?.round_id ?? 0;
  const observationId = observation?.id ?? 0;
  const params = useMemo(() => ({ page, page_size: 10 }), [page]);
  const evidence = useInventoryEvidence(projectId, sessionId, roundId, observationId, params, open && Boolean(observation));
  const upload = useUploadInventoryEvidence(projectId, sessionId, roundId, observationId, setUploadProgress);
  const download = useInventoryEvidenceDownloadUrl(projectId, sessionId, roundId, observationId);
  const data = evidence.data ? normalizePage(evidence.data) : null;

  useEffect(() => {
    if (!open) {
      setPage(1);
      setFeedback(null);
      setPreview(null);
      setUploadProgress(null);
    }
  }, [open]);

  async function handleFile(file: File) {
    setFeedback(null);
    setPreview(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setFeedback('Formato nao permitido. Envie JPEG, PNG ou WEBP.');
      return;
    }
    if (file.size < 1 || file.size > MAX_EVIDENCE_SIZE) {
      setFeedback('O arquivo deve possuir entre 1 byte e 10 MB.');
      return;
    }
    setUploadProgress(0);
    try {
      await upload.mutateAsync(file);
      setFeedback('Evidencia enviada e confirmada com sucesso.');
    } catch (error) {
      setFeedback(getInventoryOperationErrorMessage(error));
    } finally {
      setUploadProgress(null);
    }
  }

  async function openPreview(item: InventoryEvidence) {
    setFeedback(null);
    try {
      const response = await download.mutateAsync(item.id);
      setPreview({ url: response.download_url, evidence: response.evidence });
    } catch (error) {
      setFeedback(getInventoryOperationErrorMessage(error));
    }
  }

  return (
    <DrawerForm open={open} onOpenChange={onOpenChange} title={`Evidencias da observacao #${observation?.id ?? ''}`}>
      <div className="grid gap-4">
        {sessionActive ? (
          <PermissionGate permissions={['inventory-observations:create']}>
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <ImagePlus size={16} /> Anexar evidencia
              <FileUpload aria-label="Anexar evidencia" accept={ALLOWED_IMAGE_TYPES.join(',')} className="sr-only" onFile={handleFile} disabled={upload.isPending} />
            </label>
          </PermissionGate>
        ) : null}

        {feedback ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" role="status" aria-live="polite">{feedback}</p> : null}
        {uploadProgress !== null ? (
          <div role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">Enviando evidencia: {uploadProgress}%</p>
          </div>
        ) : null}

        {evidence.isLoading ? <LoadingState label="Carregando evidencias" /> : evidence.isError ? (
          <ErrorState message={getInventoryOperationErrorMessage(evidence.error)} onRetry={() => evidence.refetch()} />
        ) : data?.items.length ? (
          <div className="grid gap-3">
            {data.items.map((item) => (
              <article key={item.id} className="grid gap-3 rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.original_name}</p>
                    <p className="text-xs text-muted-foreground">{item.mime_type} - {formatBytes(item.size_bytes)}</p>
                  </div>
                  <StatusBadge value={item.status} />
                </div>
                <p className="text-xs text-muted-foreground">Criada em {formatDateTime(item.created_at)} por {item.created_by_id ? `#${item.created_by_id}` : 'responsavel nao informado'}</p>
                <PermissionGate permissions={['inventory-sessions:read']}>
                  <Button type="button" variant="secondary" onClick={() => openPreview(item)} disabled={download.isPending || item.status !== 'uploaded'}>
                    <Download size={16} /> Visualizar
                  </Button>
                </PermissionGate>
              </article>
            ))}
            <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
          </div>
        ) : (
          <EmptyState title="Nenhuma evidencia anexada" description="Esta observacao ainda nao possui evidencias confirmadas." />
        )}

        {preview ? (
          <section className="rounded-lg border bg-muted/30 p-3" aria-label="Visualizacao da evidencia">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{preview.evidence.original_name}</p>
              <Button type="button" variant="ghost" aria-label="Fechar visualizacao" onClick={() => setPreview(null)}><X size={16} /></Button>
            </div>
            <img className="max-h-[52vh] w-full rounded-md object-contain" src={preview.url} alt={preview.evidence.original_name} />
          </section>
        ) : null}
      </div>
    </DrawerForm>
  );
}
