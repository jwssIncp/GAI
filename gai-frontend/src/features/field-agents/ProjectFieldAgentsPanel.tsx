import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { useToast } from '@/components/ui/toast-context';
import { usePermissions } from '@/features/auth/usePermissions';
import { canMutateProjectOperations } from '@/features/projects/projectLifecycle';
import { formatDate } from '@/utils/format';
import type { AssignProjectFieldAgentRequest, Project, ProjectFieldAgent, UpdateProjectFieldAgentRequest } from '@/types/api';
import { FieldAgentSelect } from './FieldAgentSelect';
import { projectFieldAgentEditSchema, projectFieldAgentFormSchema, type ProjectFieldAgentEditValues, type ProjectFieldAgentFormValues } from './fieldAgentSchemas';
import { useAssignProjectFieldAgent, useFieldAgent, useProjectFieldAgents, useRemoveProjectFieldAgent, useUpdateProjectFieldAgent } from './fieldAgentsQueries';

export function ProjectFieldAgentsPanel({ project }: { project: Pick<Project, 'id' | 'status'> }) {
  const projectId = project.id;
  const [page, setPage] = useState(1);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProjectFieldAgent | null>(null);
  const [editing, setEditing] = useState<ProjectFieldAgent | null>(null);
  const params = useMemo(() => ({ page, page_size: 10 }), [page]);
  const query = useProjectFieldAgents(projectId, params);
  const assign = useAssignProjectFieldAgent(projectId);
  const remove = useRemoveProjectFieldAgent(projectId);
  const update = useUpdateProjectFieldAgent(projectId);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const data = query.data ? normalizePage(query.data) : null;
  const mutable = canMutateProjectOperations(project.status);
  const canReadAgents = hasPermission('field-agents:read');
  const canAssign = mutable && canReadAgents && hasPermission('project-field-agents:assign');
  const canUpdate = mutable && hasPermission('project-field-agents:update');
  const canRemove = mutable && hasPermission('project-field-agents:remove');
  const activeFieldAgentIds = data?.items.filter((item) => item.status === 'active').map((item) => item.field_agent_id) ?? [];

  async function removeAssignment() {
    if (!removeTarget) return;
    try {
      await remove.mutateAsync(removeTarget.id);
      setRemoveTarget(null);
      toast({ title: 'Vinculo removido', description: 'O historico do inventariante foi preservado.', tone: 'success' });
    } catch (error) {
      toast({ title: 'Nao foi possivel remover', description: projectFieldAgentError(error), tone: 'error' });
    }
  }

  return (
    <section id="inventariantes" className="grid gap-4">
      <div className="flex flex-col gap-3 border-t pt-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inventariantes do projeto</h2>
          <p className="text-sm text-muted-foreground">Equipe de campo vinculada ao escopo deste projeto.</p>
        </div>
        {canAssign ? <Button type="button" onClick={() => setAssignOpen(true)}><Plus size={17} /> Vincular inventariante</Button> : null}
      </div>
      {!mutable ? <p className="rounded-xl border border-warning/25 bg-warning-subtle/40 p-3 text-sm text-muted-foreground">O status atual mantem os vinculos de inventariantes somente para consulta.</p> : null}
      {mutable && hasPermission('project-field-agents:assign') && !canReadAgents ? <p role="alert" className="rounded-xl border border-warning/25 bg-warning-subtle/40 p-3 text-sm text-muted-foreground">Voce possui permissao para vincular, mas precisa de `field-agents:read` para selecionar um inventariante.</p> : null}
      <FilterPanel>
        <span className="text-sm text-muted-foreground">Listagem paginada de vinculos ativos, inativos ou finalizados.</span>
      </FilterPanel>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} /> : data ? (
        <>
          <DataTable
            items={data.items}
            getKey={(item) => item.id}
            columns={[
              { header: 'Inventariante', cell: (item) => <ProjectFieldAgentIdentity fieldAgentId={item.field_agent_id} canRead={canReadAgents} /> },
              { header: 'Papel', cell: (item) => item.role ?? '-' },
              { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
              { header: 'Periodo', cell: (item) => `${formatDate(item.start_date)} - ${formatDate(item.end_date)}` },
              { header: 'Acoes', cell: (item) => (
                <div className="flex items-center gap-1">
                  {canUpdate ? <Button type="button" variant="ghost" aria-label="Editar vinculo" onClick={() => setEditing(item)}><Pencil size={16} /></Button> : null}
                  {canRemove ? <Button type="button" variant="ghost" aria-label="Remover vinculo" onClick={() => setRemoveTarget(item)}><Trash2 size={16} /></Button> : null}
                </div>
              ) },
            ]}
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
      {canAssign ? (
        <DrawerForm open={assignOpen} onOpenChange={setAssignOpen} title="Vincular inventariante">
          <ProjectFieldAgentForm
            busy={assign.isPending}
            excludedIds={activeFieldAgentIds}
            onSubmit={async (payload) => {
              await assign.mutateAsync(payload);
              setAssignOpen(false);
            }}
          />
        </DrawerForm>
      ) : null}
      {canUpdate ? (
        <DrawerForm open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title="Editar vinculo">
          {editing ? <ProjectFieldAgentEditForm item={editing} busy={update.isPending} onSubmit={async (payload) => { await update.mutateAsync({ assignmentId: editing.id, payload }); setEditing(null); }} /> : null}
        </DrawerForm>
      ) : null}
      {canRemove ? (
        <ConfirmDialog
          open={Boolean(removeTarget)}
          onOpenChange={(open) => !open && !remove.isPending && setRemoveTarget(null)}
          title="Remover vinculo"
          description="Remover este inventariante do projeto? O historico sera preservado."
          busy={remove.isPending}
          onConfirm={() => void removeAssignment()}
        />
      ) : null}
    </section>
  );
}

function ProjectFieldAgentIdentity({ fieldAgentId, canRead }: { fieldAgentId: number; canRead: boolean }) {
  const query = useFieldAgent(canRead ? fieldAgentId : undefined);
  if (!canRead) return <span className="font-medium">Inventariante vinculado</span>;
  if (query.isLoading) return <span className="text-sm text-muted-foreground">Carregando inventariante...</span>;
  if (query.isError || !query.data) return <span className="font-medium">Inventariante indisponivel</span>;
  return <div className="font-medium">{query.data.name}{query.data.email ? <div className="text-xs text-muted-foreground">{query.data.email}</div> : null}</div>;
}

function ProjectFieldAgentForm({ busy, excludedIds, onSubmit }: { busy: boolean; excludedIds: number[]; onSubmit: (payload: AssignProjectFieldAgentRequest) => Promise<void> }) {
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
        else form.setError('root', { message: projectFieldAgentError(error, 'Nao foi possivel criar o vinculo') });
      }
    })}>
      <FormField label="Inventariante" error={form.formState.errors.field_agent_id?.message}>
        <Controller
          control={form.control}
          name="field_agent_id"
          render={({ field }) => <FieldAgentSelect value={field.value} onChange={field.onChange} excludedIds={excludedIds} />}
        />
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
        form.setError('root', { message: projectFieldAgentError(error, 'Nao foi possivel atualizar o vinculo') });
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

function projectFieldAgentError(error: unknown, fallback = 'Tente novamente.') {
  if (error instanceof ApiError && error.code === 'PROJECT_STATUS_BLOCKS_OPERATION') {
    return 'O status atual mantem os vinculos somente para consulta.';
  }
  return error instanceof Error ? error.message : fallback;
}

function removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
}
