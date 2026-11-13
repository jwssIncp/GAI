import { MetricCard } from '@/components/base/Cards';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { DrawerForm } from '@/components/ui/dialog';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';
import { useProjectAccountingItem } from './accountingItemsQueries';

export function AccountingItemDetailDrawer({ projectId, id, open, onOpenChange }: { projectId: number; id?: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useProjectAccountingItem(projectId, open ? id : undefined);
  const item = query.data;

  return (
    <DrawerForm open={open} onOpenChange={onOpenChange} title="Detalhes do item contábil">
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} /> : item ? (
        <div className="grid gap-5 text-sm">
          <section className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{item.plate || 'Item sem placa'}</h2>
                <p className="text-muted-foreground">Item contábil #{item.id} - Projeto #{item.project_id}</p>
              </div>
              <StatusBadge value={item.status} />
            </div>
          </section>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard label="Valor de aquisição" value={formatMoney(item.acquisition_value)} />
            <MetricCard label="Data de aquisição" value={formatDate(item.acquisition_date)} />
            <MetricCard label="Código base" value={item.base_code ?? '-'} />
            <MetricCard label="Código investor" value={item.investor_code ?? '-'} />
          </div>
          <Info label="Descrição" value={item.description} />
          <Info label="Conta contábil" value={item.accounting_account_description} />
          <Info label="Localização" value={item.location} />
          <Info label="Obs. 1" value={item.note_1} />
          <Info label="Obs. 2" value={item.note_2} />
          <Info label="Placa nova inventário" value={item.new_inventory_plate} />
          <Info label="Descrição inventário" value={item.inventory_description} />
          <Info label="Localização inventário" value={item.inventory_location} />
          <Info label="Import batch" value={item.import_batch_id ? `#${item.import_batch_id}` : undefined} />
          <Info label="Criado em" value={formatDateTime(item.created_at)} />
          <Info label="Atualizado em" value={formatDateTime(item.updated_at)} />
          {item.metadata ? (
            <section className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold">Metadata</h3>
              <pre className="mt-3 max-h-60 overflow-auto rounded-md bg-background p-3 text-xs">{JSON.stringify(item.metadata, null, 2)}</pre>
            </section>
          ) : null}
          <section className="rounded-lg border bg-muted/30 p-4 text-muted-foreground">
            Área preparada para vínculo futuro com pendências e conciliação do inventário.
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
