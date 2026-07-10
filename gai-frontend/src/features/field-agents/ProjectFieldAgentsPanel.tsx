import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { normalizePage } from '@/api/pagination';
import { DataTable } from '@/components/base/DataTable';
import { FilterPanel } from '@/components/base/FilterPanel';
import { FormField } from '@/components/base/FormField';
import { Pagination } from '@/components/base/Pagination';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DrawerForm } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { projectFieldAgentFormSchema, type ProjectFieldAgentFormValues } from './fieldAgentSchemas';
import { useAssignProjectFieldAgent, useProjectFieldAgents, useRemoveProjectFieldAgent } from './fieldAgentsQueries';
import { formatDate } from '@/utils/format';
import type { AssignProjectFieldAgentRequest, ProjectFieldAgent } from '@/types/api';

export function ProjectFieldAgentsPanel({ projectId }: { projectId: number }) {
  const [page, setPage] = useState(1);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProjectFieldAgent | null>(null);
  const params = useMemo(() => ({ page, page_size: 10 }), [page]);
  const query = useProjectFieldAgents(projectId, params);
  const assign = useAssignProjectFieldAgent(projectId);
  const remove = useRemoveProjectFieldAgent(projectId);
  const data = query.data ? normalizePage(query.data) : null;

  return (
    <section id="inventariantes" className="grid gap-4">
      <div className="flex flex-col gap-3 border-t pt-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inventariantes do projeto</h2>
          <p className="text-sm text-muted-foreground">Vinculos operacionais via /projects/{'{projectId}'}/field-agents.</p>
        </div>
        <PermissionGate permissions={['project-field-agents:assign']}>
          <Button type="button" onClick={() => setAssignOpen(true)}><Plus size={17} /> Vincular inventariante</Button>
        </PermissionGate>
      </div>
      <FilterPanel>
        <span className="text-sm text-muted-foreground">Listagem paginada de vinculos ativos, inativos ou finalizados.</span>
      </FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} /> : data ? (
        <>
          <DataTable
            items={data.items}
            getKey={(item) => item.id}
            columns={[
              { header: 'Vinculo', cell: (item) => <div className="font-medium">#{item.id}<div className="text-xs text-muted-foreground">Inventariante #{item.field_agent_id}</div></div> },
              { header: 'Papel', cell: (item) => item.role ?? '-' },
              { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
              { header: 'Periodo', cell: (item) => `${formatDate(item.start_date)} - ${formatDate(item.end_date)}` },
              { header: 'Acoes', cell: (item) => (
                <PermissionGate permissions={['project-field-agents:remove']}>
                  <Button type="button" variant="ghost" aria-label="Remover vinculo" onClick={() => setRemoveTarget(item)}><Trash2 size={16} /></Button>
                </PermissionGate>
              ) },
            ]}
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
      <DrawerForm open={assignOpen} onOpenChange={setAssignOpen} title="Vincular inventariante">
        <ProjectFieldAgentForm busy={assign.isPending} onSubmit={(payload) => assign.mutate(payload, { onSuccess: () => setAssignOpen(false) })} />
      </DrawerForm>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remover vinculo"
        description={`Remover o vinculo #${removeTarget?.id ?? ''} deste projeto?`}
        onConfirm={() => removeTarget && remove.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) })}
      />
    </section>
  );
}

function ProjectFieldAgentForm({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: AssignProjectFieldAgentRequest) => void }) {
  const form = useForm<ProjectFieldAgentFormValues>({ resolver: zodResolver(projectFieldAgentFormSchema), defaultValues: { field_agent_id: '', role: '', start_date: '', end_date: '', notes: '' } });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(removeUndefined(values as unknown as AssignProjectFieldAgentRequest) as AssignProjectFieldAgentRequest))}>
      <FormField label="Inventariante ID" error={form.formState.errors.field_agent_id?.message}>
        <Input type="number" min={1} {...form.register('field_agent_id')} />
      </FormField>
      <FormField label="Papel no projeto" error={form.formState.errors.role?.message}>
        <Input placeholder="Ex.: Lider de campo" {...form.register('role')} />
      </FormField>
      <FormField label="Inicio" error={form.formState.errors.start_date?.message}>
        <Input type="date" {...form.register('start_date')} />
      </FormField>
      <FormField label="Fim" error={form.formState.errors.end_date?.message}>
        <Input type="date" {...form.register('end_date')} />
      </FormField>
      <FormField label="Observacoes" error={form.formState.errors.notes?.message}>
        <Input {...form.register('notes')} />
      </FormField>
      <Button loading={busy}><Link2 size={17} /> Vincular</Button>
    </form>
  );
}

function removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
}
