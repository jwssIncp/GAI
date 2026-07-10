import { Download, FileUp, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FileUpload } from '@/components/base/Inputs';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, ModalForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { formatDateTime } from '@/utils/format';
import { useExpenseAttachmentDownloadUrl, useExpenseAttachments, useRemoveExpenseAttachment, useUploadExpenseAttachment } from './financeQueries';
import type { Expense, ExpenseAttachment } from '@/types/api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function ExpenseAttachmentsPanel({ projectId, expense }: { projectId: number; expense: Expense }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadLink, setDownloadLink] = useState<{ url: string; attachment: ExpenseAttachment } | null>(null);
  const [removing, setRemoving] = useState<ExpenseAttachment | null>(null);
  const attachments = useExpenseAttachments(projectId, expense.id);
  const upload = useUploadExpenseAttachment(projectId, expense.id, setProgress);
  const download = useExpenseAttachmentDownloadUrl(projectId, expense.id);
  const remove = useRemoveExpenseAttachment(projectId, expense.id);
  const acceptedTypes = useMemo(() => ALLOWED_TYPES.join(','), []);

  async function handleFile(file: File) {
    setFeedback(null);
    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
      setFeedback('Formato nao permitido. Envie PDF, JPEG, PNG ou WEBP.');
      return;
    }
    if (file.size < 1 || file.size > MAX_SIZE_BYTES) {
      setFeedback('O arquivo deve ter entre 1 byte e 20 MB.');
      return;
    }
    setProgress(0);
    try {
      await upload.mutateAsync(file);
      setFeedback('Comprovante enviado com sucesso.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel enviar o comprovante.');
    } finally {
      setProgress(null);
    }
  }

  async function openDownload(attachment: ExpenseAttachment) {
    setFeedback(null);
    try {
      const response = await download.mutateAsync(attachment.id);
      setDownloadLink({ url: response.download_url, attachment: response.attachment });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel gerar o acesso temporario.');
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    await remove.mutateAsync(removing.id);
    setRemoving(null);
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Comprovantes</h3>
          <p className="text-sm text-muted-foreground">Despesa #{expense.id}. Arquivos protegidos por URL temporaria.</p>
        </div>
        <PermissionGate permissions={['expenses:upload-attachment']}>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <FileUp size={16} /> Enviar comprovante
            <FileUpload aria-label="Enviar comprovante" accept={acceptedTypes} className="sr-only" onFile={handleFile} disabled={upload.isPending} />
          </label>
        </PermissionGate>
      </div>
      {feedback ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{feedback}</p> : null}
      {progress !== null ? (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Enviando comprovante: {progress}%</p>
        </div>
      ) : null}
      {attachments.isLoading ? (
        <LoadingState label="Carregando comprovantes" />
      ) : attachments.isError ? (
        <ErrorState message={(attachments.error as Error).message} onRetry={() => attachments.refetch()} />
      ) : attachments.data?.length ? (
        <div className="grid gap-3">
          {attachments.data.map((attachment) => (
            <article key={attachment.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{attachment.original_name}</p>
                  <p className="text-xs text-muted-foreground">{attachment.mime_type} - {formatBytes(attachment.size_bytes)}</p>
                  <p className="text-xs text-muted-foreground">Criado em {formatDateTime(attachment.created_at)}</p>
                </div>
                <StatusBadge value={attachment.status} />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <PermissionGate permissions={['expenses:download-attachment']}>
                  <Button type="button" variant="secondary" disabled={download.isPending || attachment.status !== 'uploaded'} onClick={() => openDownload(attachment)}>
                    <Download size={16} /> Acessar
                  </Button>
                </PermissionGate>
                <PermissionGate permissions={['expenses:upload-attachment']}>
                  <Button type="button" variant="ghost" aria-label={`Remover ${attachment.original_name}`} disabled={remove.isPending || attachment.status === 'removed'} onClick={() => setRemoving(attachment)}>
                    <Trash2 size={16} />
                  </Button>
                </PermissionGate>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum comprovante anexado" description="Envie recibos ou comprovantes para apoiar a aprovacao da despesa." />
      )}
      <ModalForm open={Boolean(downloadLink)} onOpenChange={(open) => !open && setDownloadLink(null)} title={downloadLink?.attachment.original_name ?? 'Comprovante'}>
        {downloadLink ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Acesso temporario gerado pelo backend.</p>
            <a className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" href={downloadLink.url} target="_blank" rel="noreferrer">
              Abrir comprovante
            </a>
          </div>
        ) : null}
      </ModalForm>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remover comprovante"
        description={`Remover o comprovante ${removing?.original_name ?? ''}?`}
        onConfirm={confirmRemove}
      />
    </section>
  );
}
