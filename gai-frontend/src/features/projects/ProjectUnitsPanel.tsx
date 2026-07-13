import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/api/http';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-context';
import { usePermissions } from '@/features/auth/usePermissions';
import type { Project, ProjectUnit } from '@/types/api';
import { CompanyUnitSelect } from './ProjectSelectors';
import { canMutateProjectOperations } from './projectLifecycle';
import { useAssignProjectUnit, useProjectUnits, useRemoveProjectUnit } from './projectQueries';

export function ProjectUnitsPanel({ project }: { project: Project }) {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const units = useProjectUnits(project.id);
  const assign = useAssignProjectUnit(project.id);
  const remove = useRemoveProjectUnit(project.id);
  const [selectedId, setSelectedId] = useState('');
  const [removing, setRemoving] = useState<ProjectUnit | null>(null);
  const assignments = units.data?.items ?? [];
  const assignedIds = assignments.map((item) => item.company_unit_id);
  const mutable = canMutateProjectOperations(project.status);
  const canAssign = mutable && hasPermission('project-units:assign') && hasPermission('company-units:read') && Boolean(project.company_id);
  const canRemove = mutable && hasPermission('project-units:remove');

  async function assignSelected() {
    const id = Number(selectedId);
    if (!Number.isInteger(id) || id < 1) return;
    try {
      await assign.mutateAsync(id);
      setSelectedId('');
      toast({ title: 'Unidade vinculada', description: 'A unidade foi adicionada ao projeto.', tone: 'success' });
    } catch (error) {
      toast(unitErrorToast(error, 'Nao foi possivel vincular a unidade'));
    }
  }

  async function removeSelected() {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.company_unit_id);
      setRemoving(null);
      toast({ title: 'Unidade removida', description: 'O vinculo foi removido sem apagar o historico.', tone: 'success' });
    } catch (error) {
      toast(unitErrorToast(error, 'Nao foi possivel remover a unidade'));
    }
  }

  return (
    <section id="unidades" className="premium-panel scroll-mt-32 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="eyebrow">Escopo fisico</p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-bold tracking-tight"><MapPin size={18} /> Unidades do projeto</h2>
          <p className="mt-1 text-sm text-muted-foreground">Somente unidades ativas da empresa vinculada podem ser adicionadas.</p>
        </div>
        {canAssign ? (
          <div className="grid w-full gap-2 lg:max-w-md">
            <CompanyUnitSelect companyId={project.company_id ?? undefined} value={selectedId} onChange={setSelectedId} excludedIds={assignedIds} />
            <Button type="button" size="sm" disabled={!selectedId || assign.isPending} loading={assign.isPending} onClick={() => void assignSelected()}><Plus size={15} /> Vincular unidade</Button>
          </div>
        ) : null}
      </div>
      {!mutable ? <p className="mt-4 rounded-xl border border-warning/25 bg-warning-subtle/40 p-3 text-sm text-muted-foreground">O status atual mantém as unidades somente para consulta.</p> : null}
      <div className="mt-5">
        {units.isLoading ? <LoadingState label="Carregando unidades" /> : null}
        {units.isError ? <ErrorState message={units.error instanceof Error ? units.error.message : undefined} onRetry={() => void units.refetch()} /> : null}
        {!units.isLoading && !units.isError && !assignments.length ? <EmptyState title="Nenhuma unidade vinculada" description="Adicione uma unidade ativa da empresa para delimitar o escopo fisico do projeto." /> : null}
        {assignments.length ? (
          <div className="grid gap-2">
            {assignments.map((assignment) => {
              const unit = assignment.company_unit ?? assignment.unit;
              const name = unit?.name ?? assignment.company_unit_name ?? 'Unidade vinculada';
              const code = unit?.code ?? assignment.company_unit_code;
              return (
                <div key={assignment.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/25 p-4">
                  <div>
                    <p className="font-semibold">{name}</p>
                    {code ? <p className="mt-1 text-xs text-muted-foreground">Codigo: {code}</p> : null}
                  </div>
                  {canRemove ? <Button type="button" variant="ghost" size="sm" aria-label={`Remover ${name}`} onClick={() => setRemoving(assignment)}><Trash2 size={15} /> Remover</Button> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && !remove.isPending && setRemoving(null)}
        title="Remover unidade"
        description="Confirma a remocao desta unidade do projeto? O historico de auditoria sera preservado."
        busy={remove.isPending}
        onConfirm={() => void removeSelected()}
      />
    </section>
  );
}

function unitErrorToast(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 403) return { title: 'Sem permissao', description: 'Seu acesso nao permite alterar unidades.', tone: 'error' as const };
  if (error instanceof ApiError && error.status === 409) return { title: 'Vinculo indisponivel', description: error.message, tone: 'error' as const };
  return { title: fallback, description: error instanceof Error ? error.message : 'Tente novamente.', tone: 'error' as const };
}
