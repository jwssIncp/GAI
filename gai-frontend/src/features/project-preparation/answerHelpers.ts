import { formatDate } from '@/utils/format';
import {
  ORGANIZATION_OPTION,
  type AnswerPayload,
  type ContactValue,
  type DateRangeValue,
  type ScheduleValue,
  type SequenceValue,
  type PreparationAnswer,
  type PreparationContext,
  type PreparationQuestion,
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
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'SIM' : 'NÃO';
  switch (question.type) {
    case 'unit_allocations':
      return answer.allocations
        .map(
          (row) =>
            `${context.units.find((unit) => unit.id === row.unit_id)?.name ?? `Unidade #${row.unit_id}`}: ${row.quantity} itens (${row.participation_percent}%)`,
        )
        .join('; ');
    case 'multi_select':
      return (value as string[]).map((option) => optionLabel(option, context)).join(' / ');
    case 'contact': {
      const contact = value as ContactValue;
      return contact.phone ? `${contact.name} - ${contact.phone}` : contact.name;
    }
    case 'date_range': {
      const range = value as DateRangeValue;
      return `${formatDate(range.start)} a ${formatDate(range.end)}`;
    }
    case 'schedule': {
      const hours = value as ScheduleValue;
      return `Entrada ${hours.start} · Saída ${hours.end}${hours.weekends ? ' · Inclui finais de semana' : ''}`;
    }
    case 'sequence_list':
      return (value as SequenceValue[])
        .map((seq, index) => `Sequência ${index + 1}: ${seq.start} a ${seq.end}`)
        .join('; ');
    case 'sequence': {
      const seq = value as SequenceValue;
      return `${seq.start} a ${seq.end}`;
    }
    case 'date':
      return formatDate(String(value));
    case 'number':
      return typeof value === 'number'
        ? `${value.toLocaleString('pt-BR')}${isPercent(question) ? '%' : ''}`
        : String(value);
    default:
      return typeof value === 'string' ? optionLabel(value, context) : String(value);
  }
}

/** Rótulo de uma opção: ORGANIZATION_OPTION mostra o nome da organização dona do projeto. */
export function optionLabel(option: string, context: PreparationContext) {
  return option === ORGANIZATION_OPTION
    ? (context.organization?.name ?? 'Organização').toUpperCase()
    : option;
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

