import { Download, ImagePlus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { normalizePage } from '@/api/pagination';
import { FileUpload } from '@/components/base/Inputs';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, ModalForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { formatDateTime } from '@/utils/format';
import { useInventoryItemImageDownloadUrl, useInventoryItemImages, useRemoveInventoryItemImage, useUploadInventoryItemImage } from './inventoryItemImagesQueries';
import type { InventoryItemImage } from '@/types/api';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function InventoryItemImagesGallery({ projectId, itemId }: { projectId: number; itemId: number }) {
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; image: InventoryItemImage } | null>(null);
  const [removing, setRemoving] = useState<InventoryItemImage | null>(null);
  const images = useInventoryItemImages(projectId, itemId);
  const upload = useUploadInventoryItemImage(projectId, itemId, setUploadProgress);
  const download = useInventoryItemImageDownloadUrl(projectId, itemId);
  const remove = useRemoveInventoryItemImage(projectId, itemId);
  const imagePage = images.data ? normalizePage(images.data) : null;
  const acceptedTypes = useMemo(() => ALLOWED_IMAGE_TYPES.join(','), []);

  async function handleFile(file: File) {
    setFeedback(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setFeedback('Formato nao permitido. Envie JPEG, PNG ou WEBP.');
      return;
    }
    if (file.size < 1) {
      setFeedback('Arquivo vazio nao pode ser enviado.');
      return;
    }
    setUploadProgress(0);
    try {
      await upload.mutateAsync(file);
      setFeedback('Imagem enviada com sucesso.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel enviar a imagem.');
    } finally {
      setUploadProgress(null);
    }
  }

  async function openPreview(image: InventoryItemImage) {
    setFeedback(null);
    try {
      const response = await download.mutateAsync(image.id);
      setPreview({ url: response.download_url, image: response.image });
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
    <section className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Imagens do item</h3>
          <p className="text-sm text-muted-foreground">{imagePage?.totalItems ? `${imagePage.totalItems} imagem(ns) cadastrada(s)` : 'Metadados e arquivos protegidos por URL temporaria.'}</p>
        </div>
        <PermissionGate permissions={['inventory-item-images:create']}>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <ImagePlus size={16} /> Adicionar imagem
            <FileUpload aria-label="Adicionar imagem" accept={acceptedTypes} className="sr-only" onFile={handleFile} disabled={upload.isPending} />
          </label>
        </PermissionGate>
      </div>

      {feedback ? <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{feedback}</p> : null}
      {uploadProgress !== null ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Enviando arquivo: {uploadProgress}%</p>
        </div>
      ) : null}

      {images.isLoading ? (
        <LoadingState label="Carregando imagens" />
      ) : images.isError ? (
        <ErrorState message={(images.error as Error).message} onRetry={() => images.refetch()} />
      ) : imagePage?.items.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {imagePage.items.map((image) => (
            <article key={image.id} className="grid gap-3 rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{image.original_name}</p>
                  <p className="text-xs text-muted-foreground">{image.mime_type} - {formatBytes(image.size_bytes)}</p>
                </div>
                <StatusBadge value={image.status} />
              </div>
              <p className="text-xs text-muted-foreground">Criada em {formatDateTime(image.created_at)}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => openPreview(image)} disabled={download.isPending || image.status !== 'uploaded'}>
                  <Download size={16} /> Visualizar
                </Button>
                <PermissionGate permissions={['inventory-item-images:remove']}>
                  <Button type="button" variant="ghost" aria-label={`Remover ${image.original_name}`} onClick={() => setRemoving(image)} disabled={remove.isPending || image.status === 'removed'}>
                    <Trash2 size={16} />
                  </Button>
                </PermissionGate>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma imagem cadastrada" description="Adicione imagens do item para apoiar a conferencia do inventario." />
      )}

      <ModalForm open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)} title={preview?.image.original_name ?? 'Visualizacao da imagem'}>
        {preview ? <img className="max-h-[68vh] w-full rounded-md object-contain" src={preview.url} alt={preview.image.original_name} /> : null}
      </ModalForm>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remover imagem"
        description={`A imagem ${removing?.original_name ?? ''} sera removida logicamente do item.`}
        onConfirm={confirmRemove}
      />
    </section>
  );
}
