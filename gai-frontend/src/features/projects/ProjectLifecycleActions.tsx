import { Archive, Ban, CheckCircle2, CirclePause, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/api/http';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-context';
import { usePermissions } from '@/features/auth/usePermissions';
import type { Project, ProjectLifecycleAction } from '@/types/api';
import { availableProjectActions } from './projectLifecycle';
import { useProjectLifecycleAction } from './projectQueries';

const actionConfig: Record<ProjectLifecycleAction, { label: string; icon: ReactNode; confirm?: string; success: string }> = {
  activate: { label: 'Ativar', icon: <Play size={16} />, success: 'Projeto ativado com sucesso.' },
  pause: { label: 'Pausar', icon: <CirclePause size={16} />, success: 'Projeto pausado com sucesso.' },
  resume: { label: 'Retomar', icon: <Play size={16} />, success: 'Projeto retomado com sucesso.' },
  finish: { label: 'Finalizar', icon: <CheckCircle2 size={16} />, confirm: 'Finalizar o projeto encerra as operacoes. Confirme apenas depois de revisar importacoes e pendencias abertas.', success: 'Projeto finalizado com sucesso.' },
  cancel: { label: 'Cancelar', icon: <Ban size={16} />, confirm: 'Cancelar o projeto bloqueia novas operacoes e preserva o historico existente.', success: 'Projeto cancelado com sucesso.' },
  archive: { label: 'Arquivar', icon: <Archive size={16} />, confirm: 'Arquivar torna o projeto somente leitura e preserva seu historico.', success: 'Projeto arquivado com sucesso.' },
};

export function ProjectLifecycleActions({ project, compact = false }: { project: Project; compact?: boolean }) {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const mutation = useProjectLifecycleAction(project.id);
  const [confirming, setConfirming] = useState<ProjectLifecycleAction | null>(null);
  const actions = availableProjectActions(project.status, project.available_actions).filter((item) => hasPermission(item.permission));

  async function run(action: ProjectLifecycleAction) {
    try {
      await mutation.mutateAsync(action);
      setConfirming(null);
      toast({ title: 'Projeto atualizado', description: actionConfig[action].success, tone: 'success' });
    } catch (error) {
      const feedback = lifecycleErrorFeedback(error);
      toast({ title: feedback.title, description: feedback.description, tone: 'error', duration: 7000 });
    }
  }

  if (!actions.length) return null;
  const config = confirming ? actionConfig[confirming] : null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ action }) => {
          const item = actionConfig[action];
          return (
            <Button
              key={action}
              type="button"
              variant={action === 'cancel' ? 'danger' : 'secondary'}
              size={compact ? 'sm' : 'default'}
              disabled={mutation.isPending}
              onClick={() => item.confirm ? setConfirming(action) : void run(action)}
            >
              {item.icon} {item.label}
            </Button>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && !mutation.isPending && setConfirming(null)}
        title={config?.label ?? 'Confirmar acao'}
        description={config?.confirm ?? ''}
        busy={mutation.isPending}
        onConfirm={() => confirming && void run(confirming)}
      />
    </>
  );
}

function lifecycleErrorFeedback(error: unknown) {
  if (!(error instanceof ApiError)) return { title: 'Nao foi possivel atualizar', description: error instanceof Error ? error.message : 'Tente novamente.' };
  if (error.status === 403) return { title: 'Sem permissao', description: 'Seu acesso nao permite executar esta acao.' };
  if (error.status === 404) return { title: 'Projeto nao encontrado', description: 'O projeto nao esta mais disponivel.' };
  if (error.status === 409) {
    const details = isRecord(error.rawDetails) ? error.rawDetails : undefined;
    const operations = Array.isArray(details?.operations) ? details.operations : [];
    const operationText = operations
      .filter(isRecord)
      .map((operation) => `${String(operation.type ?? 'operacao')}: ${String(operation.count ?? 0)}`)
      .join(', ');
    return {
      title: error.code === 'PROJECT_HAS_OPEN_OPERATIONS' ? 'Projeto possui operacoes abertas' : 'Acao indisponivel',
      description: operationText ? `${error.message} ${operationText}.` : error.message,
    };
  }
  return { title: 'Nao foi possivel atualizar', description: error.message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
