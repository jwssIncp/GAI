import { formatDate } from '@/utils/format';
import type {
  AnswerPayload,
  PreparationAnswer,
  PreparationContext,
  PreparationQuestion,
} from './preparationTypes';

/** Texto da resposta para a tabela, a impressão e a planilha. */
export function answerText(
  question: PreparationQuestion,
  answer: PreparationAnswer,
  context: PreparationContext,
): string {
  if (!answer.applicable) return 'Bloqueado pelas respostas atuais';
  if (answer.state === 'not_applicable') return 'N/A';
  if (answer.state !== 'completed') return '';
  const value = answer.value;
  if (typeof value === 'boolean') return value ? 'SIM' : 'NÃO';
  if (Array.isArray(value))
    return answer.allocations
      .map(
        (row) =>
          `${context.units.find((unit) => unit.id === row.unit_id)?.name ?? `Unidade #${row.unit_id}`}: ${row.quantity} itens (${row.participation_percent}%)`,
      )
      .join('; ');
  if (value && typeof value === 'object') return `${value.start} a ${value.end}`;
  if (question.type === 'date') return formatDate(String(value));
  if (question.type === 'number' && typeof value === 'number')
    return `${value.toLocaleString('pt-BR')}${isPercent(question) ? '%' : ''}`;
  return value == null ? '' : String(value);
}

/**
 * Situação da linha no padrão do sistema anterior. O "Realizado" é independente da resposta:
 * responder não conclui o item; quem conclui é o botão PENDENTE ⇄ REALIZADO.
 */
export function situationOf(answer: PreparationAnswer) {
  if (!answer.applicable) return 'BLOQUEADO';
  return answer.realized ? 'REALIZADO' : 'PENDENTE';
}

export const isPercent = (q: PreparationQuestion) => /%/.test(q.label);

/** Complementos exibidos na linha da pergunta de que dependem (display "inline"). */
export function inlineChildren(questions: PreparationQuestion[], parent: PreparationQuestion) {
  return questions
    .filter((q) => q.visible && q.display === 'inline' && q.enabled_when?.[0]?.question_id === parent.id)
    .sort((a, b) => a.order - b.order);
}

/** Resposta completa a enviar: o servidor substitui estado, valor e observações. */
export function payloadOf(answer: PreparationAnswer, change: Partial<AnswerPayload>): AnswerPayload {
  return {
    question_id: answer.question_id,
    state: answer.state,
    value: answer.value,
    notes: answer.notes,
    responsible_user_id: answer.responsible_user_id,
    due_date: answer.due_date,
    ...change,
  };
}

