import { Link } from 'react-router-dom';
import { MetricCard } from '@/components/base/Cards';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { DrawerForm } from '@/components/ui/dialog';
import { formatDateTime } from '@/utils/format';
import { pendingIssueSeverityLabels, pendingIssueStatusLabels, pendingIssueTypeLabels } from './pendingIssueSchemas';
import { useProjectPendingIssue } from './pendingIssuesQueries';

export function PendingIssueDetailDrawer({ projectId, id, open, onOpenChange }: { projectId: number; id?: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useProjectPendingIssue(projectId, open ? id : undefined);
  const issue = query.data;

  return (
    <DrawerForm open={open} onOpenChange={onOpenChange} title="Detalhes da pendencia">
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} /> : issue ? (
        <div className="grid gap-5 text-sm">
          <section className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{issue.title}</h2>
                <p className="text-muted-foreground">{pendingIssueTypeLabels[issue.type]} - Pendencia #{issue.id}</p>
              </div>
              <div className="flex gap-2"><StatusBadge value={issue.severity} /><StatusBadge value={issue.status} /></div>
            </div>
          </section>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard label="Status" value={pendingIssueStatusLabels[issue.status]} />
            <MetricCard label="Severidade" value={pendingIssueSeverityLabels[issue.severity]} />
            <MetricCard label="Criada em" value={formatDateTime(issue.created_at)} />
            <MetricCard label="Resolvida em" value={formatDateTime(issue.resolved_at)} />
          </div>
          <Info label="Descricao" value={issue.description} />
          <Info label="Valor antigo" value={issue.old_value ? JSON.stringify(issue.old_value) : undefined} />
          <Info label="Valor novo" value={issue.new_value ? JSON.stringify(issue.new_value) : undefined} />
          <Info label="Resolucao" value={issue.resolution_notes} />
          <Info label="Resolvido por" value={issue.resolved_by_id ? `Usuario #${issue.resolved_by_id}` : undefined} />
          <Info label="Ignorado por" value={issue.ignored_by_id ? `Usuario #${issue.ignored_by_id}` : undefined} />
          <Info label="Ignorado em" value={formatDateTime(issue.ignored_at)} />
          <Info label="Atualizado em" value={formatDateTime(issue.updated_at)} />
          <section className="rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold">Vinculos</h3>
            <div className="mt-3 grid gap-2">
              {issue.inventory_item_id ? <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/inventory-items`}>Item inventariado #{issue.inventory_item_id}</Link> : <span className="text-muted-foreground">Sem item inventariado vinculado</span>}
              {issue.accounting_item_id ? <Link className="text-primary hover:underline" to={`/app/projects/${projectId}/accounting-items`}>Item contabil #{issue.accounting_item_id}</Link> : <span className="text-muted-foreground">Sem item contabil vinculado</span>}
            </div>
          </section>
          {issue.metadata ? (
            <section className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold">Metadata</h3>
              <pre className="mt-3 max-h-60 overflow-auto rounded-md bg-background p-3 text-xs">{JSON.stringify(issue.metadata, null, 2)}</pre>
            </section>
          ) : null}
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
