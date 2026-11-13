import { ApiError } from '@/api/http';
import type { InventoryDomainConflictCode } from '@/types/api';

const conflictMessages: Record<InventoryDomainConflictCode, string> = {
  INVENTORY_SESSION_STATUS_INVALID: 'A sessão mudou de estado e esta ação não está mais disponível.',
  INVENTORY_SESSION_HAS_ACTIVE_ROUNDS: 'Finalize todas as rodadas ativas antes de finalizar a sessão.',
  INVENTORY_SESSION_NOT_ACTIVE: 'A sessão não está ativa para receber esta operação.',
  INVENTORY_ROUND_NOT_ACTIVE: 'A rodada selecionada não está mais ativa.',
  INVENTORY_ROUND_CONCURRENT_MODIFICATION: 'Outra operação criou uma rodada ao mesmo tempo. Os dados foram atualizados; tente novamente.',
  REINVENTORY_REQUIRES_PRIOR_OBSERVATION: 'O reinventario exige uma observação anterior para este item.',
  REINVENTORY_ITEM_MISMATCH: 'Esta rodada de reinventario pertence a outro item.',
  FIELD_AGENT_NOT_ASSIGNED: 'O inventariante precisa ter um vínculo ativo com o projeto.',
  OBSERVATION_ALREADY_RECORDED: 'Este item já possui uma observação nesta rodada.',
  IDEMPOTENCY_KEY_REUSED: 'A chave desta tentativa já pertence a outra operação. Revise os dados antes de reenviar.',
  INVENTORY_OBSERVATION_CONFLICT: 'A observação entrou em conflito com outra operação. Atualize os dados e tente novamente.',
  OBSERVATION_EVIDENCE_NOT_UPLOADED: 'A evidência ainda não teve o upload confirmado.',
  RECONCILIATION_REQUIRES_OBSERVATIONS: 'Registre ao menos uma observação antes de executar a conciliação.',
  RECONCILIATION_ALREADY_CONSOLIDATED: 'Esta conciliação já foi consolidada.',
  PROJECT_STATUS_BLOCKS_OPERATION: 'O estado atual do projeto bloqueia esta operação.',
};

export function getInventoryOperationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409 && typeof error.code === 'string' && error.code in conflictMessages) {
    return conflictMessages[error.code as InventoryDomainConflictCode];
  }
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}
