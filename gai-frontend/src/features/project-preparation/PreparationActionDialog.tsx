import { useState, type FormEvent } from 'react';
import { ErrorState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { ModalForm } from '@/components/ui/dialog';
import { preparationApi, usePreparationMutation } from './preparationQueries';
import { kindLabels, type Preparation } from './preparationTypes';

export type PreparationAction = 'approve' | 'reopen' | 'archive';

const titles: Record<PreparationAction, string> = {
  approve: 'Concluir',
  reopen: 'Reabrir',
  archive: 'Excluir',
};

/**
 * Concluir, reabrir ou excluir um kick-off/checklist, a partir da lista ou do detalhe.
 * Excluir arquiva (sem exclusão física) e sai da lista. Reabrir e excluir pedem motivo,
 * que o servidor exige e grava no histórico.
 */
export function PreparationActionDialog({
  projectId,
  instance,
  action,
  onClose,
  onDone,
}: {
  projectId: number;
  instance: Preparation;
  action: PreparationAction;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const needsReason = action !== 'approve';
  const mutation = usePreparationMutation(projectId, () =>
    preparationApi.transition(
      projectId,
      instance.id,
      instance.revision,
      action,
      needsReason ? reason.trim() : undefined,
    ),
  );
  const label = kindLabels[instance.kind].toLowerCase();
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(undefined, {
      onSuccess: () =>
        onDone(
          action === 'approve'
            ? `"${instance.title}" concluído.`
            : action === 'reopen'
              ? `"${instance.title}" reaberto.`
              : `"${instance.title}" excluído da lista (arquivado, com histórico preservado).`,
        ),
    });
  }
  return (
    <ModalForm
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${titles[action]} ${label}`}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm">
          {action === 'approve'
            ? `Marcar "${instance.title}" como concluído? As respostas ficam bloqueadas para edição; as perguntas obrigatórias aplicáveis precisam estar resolvidas.`
            : action === 'reopen'
              ? `Reabrir "${instance.title}"? As respostas voltam a poder ser editadas e o histórico é preservado.`
              : `Excluir "${instance.title}"? Ele sai da lista e fica arquivado, sem apagar respostas nem histórico.`}
        </p>
        {needsReason ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Motivo
            <textarea
              required
              minLength={5}
              maxLength={500}
              rows={3}
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={action === 'reopen' ? 'Por que reabrir?' : 'Por que excluir?'}
            />
            <span className="text-xs font-normal text-muted-foreground">
              Registrado no histórico, com autor e data.
            </span>
          </label>
        ) : null}
        {mutation.isError ? <ErrorState message={(mutation.error as Error).message} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant={action === 'archive' ? 'danger' : 'primary'}
            disabled={mutation.isPending || (needsReason && reason.trim().length < 5)}
          >
            {mutation.isPending ? 'Salvando…' : titles[action]}
          </Button>
        </div>
      </form>
    </ModalForm>
  );
}
