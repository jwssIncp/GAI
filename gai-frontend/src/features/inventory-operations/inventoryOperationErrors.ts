import { ApiError } from '@/api/http';
import type { InventoryDomainConflictCode } from '@/types/api';

const conflictMessages: Record<InventoryDomainConflictCode, string> = {
  INVENTORY_SESSION_STATUS_INVALID: 'A sessao mudou de estado e esta acao nao esta mais disponivel.',
  INVENTORY_SESSION_HAS_ACTIVE_ROUNDS: 'Finalize todas as rodadas ativas antes de finalizar a sessao.',
  INVENTORY_SESSION_NOT_ACTIVE: 'A sessao nao esta ativa para receber esta operacao.',
  INVENTORY_ROUND_NOT_ACTIVE: 'A rodada selecionada nao esta mais ativa.',
  INVENTORY_ROUND_CONCURRENT_MODIFICATION: 'Outra operacao criou uma rodada ao mesmo tempo. Os dados foram atualizados; tente novamente.',
  REINVENTORY_REQUIRES_PRIOR_OBSERVATION: 'O reinventario exige uma observacao anterior para este item.',
  REINVENTORY_ITEM_MISMATCH: 'Esta rodada de reinventario pertence a outro item.',
  FIELD_AGENT_NOT_ASSIGNED: 'O inventariante precisa ter um vinculo ativo com o projeto.',
  OBSERVATION_ALREADY_RECORDED: 'Este item ja possui uma observacao nesta rodada.',
  IDEMPOTENCY_KEY_REUSED: 'A chave desta tentativa ja pertence a outra operacao. Revise os dados antes de reenviar.',
  INVENTORY_OBSERVATION_CONFLICT: 'A observacao entrou em conflito com outra operacao. Atualize os dados e tente novamente.',
  OBSERVATION_EVIDENCE_NOT_UPLOADED: 'A evidencia ainda nao teve o upload confirmado.',
  RECONCILIATION_REQUIRES_OBSERVATIONS: 'Registre ao menos uma observacao antes de executar a conciliacao.',
  RECONCILIATION_ALREADY_CONSOLIDATED: 'Esta conciliacao ja foi consolidada.',
  PROJECT_STATUS_BLOCKS_OPERATION: 'O estado atual do projeto bloqueia esta operacao.',
};

export function getInventoryOperationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409 && typeof error.code === 'string' && error.code in conflictMessages) {
    return conflictMessages[error.code as InventoryDomainConflictCode];
  }
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.';
}
