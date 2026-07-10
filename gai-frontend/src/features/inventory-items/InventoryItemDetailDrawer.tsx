import { MetricCard } from '@/components/base/Cards';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { DrawerForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { InventoryItemImagesGallery } from '@/features/inventory-item-images/InventoryItemImagesGallery';
import { formatDateTime, formatMoney } from '@/utils/format';
import { useProjectInventoryItem } from './inventoryItemsQueries';

export function InventoryItemDetailDrawer({ projectId, id, open, onOpenChange }: { projectId: number; id?: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useProjectInventoryItem(projectId, open ? id : undefined);
  const item = query.data;

  return (
    <DrawerForm open={open} onOpenChange={onOpenChange} title="Detalhes do item">
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} /> : item ? (
        <div className="grid gap-5 text-sm">
          <section className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{item.description || 'Item sem descricao'}</h2>
                <p className="text-muted-foreground">Item #{item.id} - Projeto #{item.project_id}</p>
              </div>
              <StatusBadge value={item.status} />
            </div>
          </section>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard label="Placa antiga" value={item.old_plate ?? '-'} />
            <MetricCard label="Placa nova" value={item.new_plate ?? '-'} />
            <MetricCard label="Valor usado" value={formatMoney(item.used_value)} />
            <MetricCard label="Valor novo" value={formatMoney(item.new_value)} />
          </div>
          <Info label="Sequencia" value={item.sequence} />
          <Info label="Localizacao" value={item.location_text} />
          <Info label="Unidade" value={item.unit_text} />
          <Info label="Endereco" value={item.address_text} />
          <Info label="Marca / Modelo" value={[item.brand, item.model].filter(Boolean).join(' / ')} />
          <Info label="Numero de serie" value={item.serial_number} />
          <Info label="Capacidade" value={item.capacity} />
          <Info label="Ano" value={item.year ? String(item.year) : undefined} />
          <Info label="Observacoes" value={item.notes} />
          <Info label="Criado em" value={formatDateTime(item.created_at)} />
          <Info label="Atualizado em" value={formatDateTime(item.updated_at)} />
          <PermissionGate permissions={['inventory-item-images:read']} fallback={<ImagePlaceholder />}>
            <InventoryItemImagesGallery projectId={projectId} itemId={item.id} />
          </PermissionGate>
          <section className="rounded-lg border bg-muted/30 p-4 text-muted-foreground">
            Area preparada para pendencias relacionadas ao item. A implementacao profunda fica para a rodada do modulo de pendencias.
          </section>
        </div>
      ) : null}
    </DrawerForm>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium">{value || '-'}</span>
    </div>
  );
}

function ImagePlaceholder() {
  return <p className="mt-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">Voce nao tem permissao para visualizar as imagens deste item.</p>;
}
