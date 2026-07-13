import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { normalizePage } from '@/api/pagination';
import { ApiError } from '@/api/http';
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
import { projectFieldAgentEditSchema, projectFieldAgentFormSchema, type ProjectFieldAgentEditValues, type ProjectFieldAgentFormValues } from './fieldAgentSchemas';
import { useAssignProjectFieldAgent, useProjectFieldAgents, useRemoveProjectFieldAgent, useUpdateProjectFieldAgent } from './fieldAgentsQueries';
import { formatDate } from '@/utils/format';
import type { AssignProjectFieldAgentRequest, ProjectFieldAgent, UpdateProjectFieldAgentRequest } from '@/types/api';

export function ProjectFieldAgentsPanel({ projectId }: { projectId: number }) {
  const [page, setPage] = useState(1);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProjectFieldAgent | null>(null);
  const [editing, setEditing] = useState<ProjectFieldAgent | null>(null);
  const params = useMemo(() => ({ page, page_size: 10 }), [page]);
  const query = useProjectFieldAgents(projectId, params);
  const assign = useAssignProjectFieldAgent(projectId);
  const remove = useRemoveProjectFieldAgent(projectId);
  const update = useUpdateProjectFieldAgent(projectId);
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
                <div className="flex items-center gap-1">
                  <PermissionGate permissions={['project-field-agents:update']}>
                    <Button type="button" variant="ghost" aria-label="Editar vinculo" onClick={() => setEditing(item)}><Pencil size={16} /></Button>
                  </PermissionGate>
                  <PermissionGate permissions={['project-field-agents:remove']}>
                    <Button type="button" variant="ghost" aria-label="Remover vinculo" onClick={() => setRemoveTarget(item)}><Trash2 size={16} /></Button>
                  </PermissionGate>
                </div>
              ) },
            ]}
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
      <DrawerForm open={assignOpen} onOpenChange={setAssignOpen} title="Vincular inventariante">
        <ProjectFieldAgentForm busy={assign.isPending} onSubmit={async (payload) => { await assign.mutateAsync(payload); setAssignOpen(false); }} />
      </DrawerForm>
      <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar vinculo">
        {editing ? <ProjectFieldAgentEditForm item={editing} busy={update.isPending} onSubmit={async (payload) => { await update.mutateAsync({ assignmentId: editing.id, payload }); setEditing(null); }} /> : null}
      </DrawerForm>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remover vinculo"
        description={`Remover o vinculo #${removeTarget?.id ?? ''} deste projeto?`}
        busy={remove.isPending}
        onConfirm={() => removeTarget && remove.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) })}
      />
    </section>
  );
}

function ProjectFieldAgentForm({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: AssignProjectFieldAgentRequest) => Promise<void> }) {
  const form = useForm<ProjectFieldAgentFormValues>({ resolver: zodResolver(projectFieldAgentFormSchema), defaultValues: { field_agent_id: '', role: '', start_date: '', end_date: '', notes: '' } });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
      form.clearErrors();
      try {
        await onSubmit(removeUndefined(values as unknown as AssignProjectFieldAgentRequest) as AssignProjectFieldAgentRequest);
      } catch (error) {
        const apiError = error as ApiError;
        const detail = apiError.details?.find(({ field }) => field === 'field_agent_id');
        if (detail) form.setError('field_agent_id', { message: detail.message });
        else form.setError('root', { message: apiError.message || 'Não foi possível criar o vínculo' });
      }
    })}>
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
      {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      <Button type="submit" loading={busy || form.formState.isSubmitting} disabled={busy || form.formState.isSubmitting}><Link2 size={17} /> Vincular</Button>
    </form>
  );
}

function ProjectFieldAgentEditForm({ item, busy, onSubmit }: { item: ProjectFieldAgent; busy: boolean; onSubmit: (payload: UpdateProjectFieldAgentRequest) => Promise<void> }) {
  const form = useForm<ProjectFieldAgentEditValues>({
    resolver: zodResolver(projectFieldAgentEditSchema),
    defaultValues: { role: item.role ?? '', status: item.status, start_date: item.start_date ?? '', end_date: item.end_date ?? '', notes: item.notes ?? '' },
  });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
      form.clearErrors();
      try {
        await onSubmit(removeUndefined(values as unknown as UpdateProjectFieldAgentRequest) as UpdateProjectFieldAgentRequest);
      } catch (error) {
        const apiError = error as ApiError;
        form.setError('root', { message: apiError.message || 'Não foi possível atualizar o vínculo' });
      }
    })}>
      <FormField label="Papel no projeto" error={form.formState.errors.role?.message}><Input {...form.register('role')} /></FormField>
      <FormField label="Status" error={form.formState.errors.status?.message}>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" {...form.register('status')}>
          <option value="active">Ativo</option><option value="inactive">Inativo</option><option value="finished">Finalizado</option>
        </select>
      </FormField>
      <FormField label="Inicio" error={form.formState.errors.start_date?.message}><Input type="date" {...form.register('start_date')} /></FormField>
      <FormField label="Fim" error={form.formState.errors.end_date?.message}><Input type="date" {...form.register('end_date')} /></FormField>
      <FormField label="Observacoes" error={form.formState.errors.notes?.message}><Input {...form.register('notes')} /></FormField>
      {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      <Button type="submit" disabled={busy || form.formState.isSubmitting}>{busy || form.formState.isSubmitting ? 'Salvando...' : 'Atualizar vínculo'}</Button>
    </form>
  );
}

function removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
}
