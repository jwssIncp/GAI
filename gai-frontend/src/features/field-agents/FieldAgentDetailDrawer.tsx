import { DrawerForm } from '@/components/ui/dialog';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { useFieldAgent } from './fieldAgentsQueries';
import { formatDateTime } from '@/utils/format';

export function FieldAgentDetailDrawer({ id, open, onOpenChange }: { id?: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useFieldAgent(open ? id : undefined);
  const item = query.data;
  return (
    <DrawerForm open={open} onOpenChange={onOpenChange} title="Detalhes do inventariante">
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} /> : item ? (
        <div className="grid gap-5 text-sm">
          <section className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{item.name}</h2>
                <p className="text-muted-foreground">Inventariante #{item.id}</p>
              </div>
              <StatusBadge value={item.status} />
            </div>
          </section>
          <Info label="Email" value={item.email} />
          <Info label="Telefone" value={item.phone} />
          <Info label="Documento" value={item.document} />
          <Info label="Organization" value={String(item.organization_id)} />
          <Info label="Usuario vinculado" value={item.user_id ? String(item.user_id) : 'Sem vinculo'} />
          <Info label="Criado em" value={formatDateTime(item.created_at)} />
          <Info label="Atualizado em" value={formatDateTime(item.updated_at)} />
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            Projetos vinculados podem ser consultados por projeto em GET /projects/{'{projectId}'}/field-agents. Nao ha endpoint field-agent-scoped para listar todos os projetos deste inventariante.
          </div>
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
