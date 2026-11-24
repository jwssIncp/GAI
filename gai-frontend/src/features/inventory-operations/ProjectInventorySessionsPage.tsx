import { Plus } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { DataTable, type Column } from '@/components/base/DataTable';
import { Kpi, KpiGrid } from '@/components/base/Cards';
import { FilterPanel } from '@/components/base/FilterPanel';
import { SectionTitle } from '@/components/base/SectionTitle';
import { useProjectDashboard } from '@/features/projects/projectQueries';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { DrawerForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { formatDateTime } from '@/utils/format';
import type { InventorySession, InventorySessionStatus } from '@/types/api';
import { useCreateInventorySession, useInventorySessions } from './inventoryOperationsQueries';

export function ProjectInventorySessionsPage() {
  const projectId = Number(useParams().projectId);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InventorySessionStatus | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const params = useMemo(() => ({ page, page_size: 20, status: status || undefined }), [page, status]);
  const query = useInventorySessions(projectId, params);
  const data = query.data ? normalizePage(query.data) : null;
  const columns: Column<InventorySession>[] = [
    { header: 'Sessão', cell: (item) => <div className="font-semibold">{item.name}<div className="text-xs text-muted-foreground">#{item.id}</div></div> },
    { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
    { header: 'Início', cell: (item) => formatDateTime(item.started_at) },
    { header: 'Fim', cell: (item) => formatDateTime(item.finished_at) },
    { header: 'Atualização', cell: (item) => formatDateTime(item.updated_at) },
    { header: 'Ações', cell: (item) => <Link className="font-semibold text-primary hover:underline" to={`/app/projects/${projectId}/inventory/sessions/${item.id}`}>Abrir</Link> },
  ];
  return (
    <PageContainer>
      <PageHeader title="Sessões e conciliação" description="Campanhas, rodadas e histórico imutável de observações. Abra a sessão para executar a conciliação físico-contábil e revisar as sugestões." />
      <ReconciliationIndicators projectId={projectId} />
      <FilterPanel>
        <select aria-label="Filtrar sessão por status" className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as InventorySessionStatus | ''); setPage(1); }}>
          <option value="">Todos os status</option><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="finished">Finalizada</option><option value="cancelled">Cancelada</option>
        </select>
      </FilterPanel>
      <PermissionGate permissions={['inventory-sessions:create']}><div className="flex justify-end"><Button onClick={() => setCreateOpen(true)}><Plus size={17} /> Nova sessão</Button></div></PermissionGate>
      {query.isLoading ? <LoadingState label="Carregando sessões de inventário" /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : data ? <><DataTable columns={columns} items={data.items} getKey={(item) => item.id} /><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /></> : null}
      <CreateSessionDrawer projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
    </PageContainer>
  );
}

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%`.replace('.', ',') : '-');

/**
 * Indicadores da conciliação no padrão do sistema anterior (quantidade de itens), com os
 * números da última execução que o resumo do projeto já devolve. Valores em R$ (valor
 * residual) dependem de backend e ficam para a fase 2.
 */
function ReconciliationIndicators({ projectId }: { projectId: number }) {
  const accounting = useProjectDashboard(projectId).data?.accounting;
  if (!accounting) return null;
  const run = accounting.latest_reconciliation_run ?? null;
  if (run === null) return <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Nenhuma conciliação executada ainda. Os indicadores aparecem depois da primeira execução.</p>;
  const reconciled = accounting.reconciled_items ?? 0;
  const physicalSurplus = accounting.physical_surplus_items ?? 0;
  const accountingSurplus = accounting.accounting_surplus_items ?? 0;
  const duplicates = accounting.duplicate_items ?? 0;
  return (
    <section className="grid gap-3" aria-label="Indicadores da conciliação">
      <SectionTitle title={`Indicadores da conciliação · execução #${run}`} />
      <KpiGrid label="Indicadores da conciliação em quantidade">
        <Kpi group="indicators" tinted label="Conciliados" value={reconciled} hint="Itens físicos com par na base contábil." />
        <Kpi group="indicators" label="% conciliado contábil" value={percent(reconciled, reconciled + accountingSurplus)} hint="Conciliados ÷ (conciliados + sobra contábil)." />
        <Kpi group="indicators" label="% conciliado físico" value={percent(reconciled, reconciled + physicalSurplus)} hint="Conciliados ÷ (conciliados + sobra física)." />
        <Kpi group="indicators" label="Sobra contábil" value={accountingSurplus} hint="Só na contabilidade." tone={accountingSurplus ? 'warning' : 'default'} />
        <Kpi group="indicators" label="Sobra física" value={physicalSurplus} hint="Encontrados em campo sem registro contábil." tone={physicalSurplus ? 'warning' : 'default'} />
        <Kpi group="indicators" label="Duplicidades" value={duplicates} hint="Bloqueiam a consolidação até a revisão." tone={duplicates ? 'danger' : 'default'} />
      </KpiGrid>
    </section>
  );
}

function CreateSessionDrawer({ projectId, open, onOpenChange }: { projectId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('');
  const mutation = useCreateInventorySession(projectId);
  function submit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    mutation.mutate({ name: value }, { onSuccess: () => { setName(''); onOpenChange(false); } });
  }
  return <DrawerForm open={open} onOpenChange={onOpenChange} title="Nova sessão de inventário"><form className="grid gap-4" onSubmit={submit}><label className="grid gap-1.5 text-sm font-medium">Nome<input required maxLength={255} className="h-10 rounded-md border bg-background px-3" value={name} onChange={(e) => setName(e.target.value)} /></label>{mutation.isError ? <ErrorState message={(mutation.error as Error).message} /> : null}<Button type="submit" disabled={mutation.isPending || !name.trim()}>{mutation.isPending ? 'Criando...' : 'Criar sessão'}</Button></form></DrawerForm>;
}
