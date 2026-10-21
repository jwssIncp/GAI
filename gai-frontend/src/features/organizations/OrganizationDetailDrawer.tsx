import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { DrawerForm } from '@/components/ui/dialog';
import { maskDocument } from '@/features/field-agents/brazilianContact';
import { formatDateTime } from '@/utils/format';
import { useOrganization } from './organizationsQueries';

export function OrganizationDetailDrawer({ id, open, onOpenChange }: { id?: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useOrganization(open ? id : undefined);
  const item = query.data;

  return (
    <DrawerForm open={open} onOpenChange={onOpenChange} title="Detalhes da organização">
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : item ? (
        <div className="grid gap-5 text-sm">
          <section className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{item.legal_name}</h2>
                <p className="text-muted-foreground">{item.trade_name || `Organização #${item.id}`}</p>
              </div>
              <StatusBadge value={item.status} />
            </div>
          </section>
          <Info label="CNPJ" value={maskDocument(item.cnpj)} />
          <Info label="Email" value={item.contact_email} />
          <Info label="Telefone" value={item.contact_phone} />
          <Info label="Criada em" value={formatDateTime(item.created_at)} />
          <Info label="Atualizada em" value={formatDateTime(item.updated_at)} />
        </div>
      ) : null}
    </DrawerForm>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '-'}</span>
    </div>
  );
}
