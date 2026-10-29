import { BadRequestException } from '@nestjs/common';
import { isCivilDate } from '../../../common/validation/civil-date';
import {
  PolicyAnswer,
  PreparationQuestion,
  PreparationValue,
  QUESTION_TYPES,
  Scalar,
} from './preparation.types';

export function invalid(message: string): never {
  throw new BadRequestException({ code: 'PREPARATION_INVALID', message });
}
export function validDate(value: string | null | undefined): void {
  if (value != null && !isCivilDate(value))
    invalid('Data civil inválida; use YYYY-MM-DD');
}
const scalar = (value: unknown): value is Scalar =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

export function validateQuestions(
  questions: PreparationQuestion[],
): PreparationQuestion[] {
  if (!Array.isArray(questions) || !questions.length || questions.length > 120)
    invalid('O modelo deve ter entre 1 e 120 perguntas');
  const byId = new Map(questions.map((question) => [question.id, question]));
  if (byId.size !== questions.length)
    invalid('IDs de perguntas devem ser únicos');
  for (const q of questions) {
    if (
      !/^[a-z][a-z0-9_-]{1,79}$/.test(q.id) ||
      !q.label?.trim() ||
      q.label.length > 500 ||
      !q.category?.trim() ||
      q.category.length > 100 ||
      !QUESTION_TYPES.includes(q.type) ||
      !Number.isSafeInteger(q.order) ||
      q.order < 0 ||
      q.order > 10000 ||
      [q.required, q.visible, q.allow_not_applicable].some(
        (v) => typeof v !== 'boolean',
      )
    )
      invalid('Definição de pergunta inválida');
    if (q.required && !q.visible)
      invalid(
        `A pergunta obrigatória ${q.id} não pode ser ocultada; altere a obrigatoriedade explicitamente`,
      );
    if (
      q.type === 'select' &&
      (!q.options?.length ||
        q.options.length > 50 ||
        q.options.some(
          (v) => typeof v !== 'string' || !v.trim() || v.length > 100,
        ) ||
        new Set(q.options).size !== q.options.length)
    )
      invalid(`Opções inválidas para ${q.id}`);
    if (q.options && q.type !== 'select')
      invalid('Somente perguntas de seleção aceitam opções');
    if (
      q.quantity_question_id &&
      (q.type !== 'sequence' ||
        byId.get(q.quantity_question_id)?.type !== 'number' ||
        q.quantity_question_id === q.id)
    )
      invalid('Sequência deve referenciar uma pergunta numérica distinta');
    if ((q.enabled_when?.length ?? 0) > 10)
      invalid('Máximo de dez condições por pergunta');
    for (const condition of q.enabled_when ?? []) {
      const parent = byId.get(condition.question_id);
      if (
        !parent ||
        parent.id === q.id ||
        !['equals', 'not_equals', 'in', 'answered'].includes(condition.operator)
      )
        invalid('Condição deve referenciar outra pergunta existente');
      if (
        condition.operator === 'in'
          ? !Array.isArray(condition.value) ||
            !condition.value.length ||
            condition.value.length > 50 ||
            !condition.value.every(scalar)
          : condition.operator !== 'answered' && !scalar(condition.value)
      )
        invalid('Valor de condição inválido');
      const values = Array.isArray(condition.value)
        ? condition.value
        : [condition.value];
      if (
        condition.operator !== 'answered' &&
        values.some((v) =>
          parent.type === 'boolean'
            ? typeof v !== 'boolean'
            : parent.type === 'number'
              ? typeof v !== 'number'
              : ['sequence', 'unit_allocations'].includes(parent.type) ||
                typeof v !== 'string' ||
                (parent.type === 'select' && !parent.options?.includes(v)),
        )
      )
        invalid('Condição incompatível com o tipo da pergunta de origem');
    }
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) invalid('Condições não podem formar ciclos');
    if (visited.has(id)) return;
    visiting.add(id);
    const q = byId.get(id)!;
    for (const dependency of [
      ...(q.enabled_when ?? []).map((c) => c.question_id),
      ...(q.quantity_question_id ? [q.quantity_question_id] : []),
    ])
      visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  questions.forEach((q) => visit(q.id));
  return [...questions].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}

export function applicability(
  questions: PreparationQuestion[],
  answers: PolicyAnswer[],
): Map<string, boolean> {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const values = new Map(answers.map((a) => [a.questionId, a]));
  const result = new Map<string, boolean>();
  const enabled = (id: string): boolean => {
    if (result.has(id)) return result.get(id)!;
    const active = (byId.get(id)?.enabled_when ?? []).every((condition) => {
      const answer = values.get(condition.question_id);
      if (!enabled(condition.question_id) || answer?.state !== 'completed')
        return false;
      if (condition.operator === 'answered') return true;
      if (condition.operator === 'in')
        return (condition.value as Scalar[]).includes(answer.value as Scalar);
      return condition.operator === 'equals'
        ? answer.value === condition.value
        : answer.value !== condition.value;
    });
    result.set(id, active);
    return active;
  };
  questions.forEach((q) => enabled(q.id));
  return result;
}

export function validateAnswer(
  q: PreparationQuestion,
  answer: PolicyAnswer,
  answers: PolicyAnswer[],
): void {
  if (!['pending', 'completed', 'not_applicable'].includes(answer.state))
    invalid('Situação da resposta inválida');
  if (answer.state === 'pending') {
    if (answer.value !== null) invalid('Resposta pendente deve ter valor nulo');
    return;
  }
  if (answer.state === 'not_applicable') {
    if (
      !q.allow_not_applicable ||
      !answer.notes?.trim() ||
      answer.value !== null
    )
      invalid(
        `Não aplicável exige permissão do modelo, justificativa e valor nulo: ${q.id}`,
      );
    return;
  }
  const value = answer.value;
  if (q.type === 'text' || q.type === 'long_text') {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > (q.type === 'text' ? 2000 : 10000)
    )
      invalid(`Texto inválido: ${q.id}`);
  } else if (q.type === 'boolean') {
    if (typeof value !== 'boolean') invalid(`Valor booleano inválido: ${q.id}`);
  } else if (q.type === 'number') {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1e12
    )
      invalid(`Número inválido: ${q.id}`);
  } else if (q.type === 'date') {
    if (typeof value !== 'string') invalid('Data inválida');
    validDate(value);
  } else if (q.type === 'select') {
    if (typeof value !== 'string' || !q.options?.includes(value))
      invalid(`Opção não cadastrada: ${q.id}`);
  } else if (q.type === 'sequence') {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !['start', 'end'].includes(key)) ||
      !Number.isSafeInteger(value.start) ||
      !Number.isSafeInteger(value.end) ||
      value.start < 0 ||
      value.end < value.start
    )
      invalid('Sequência deve ter início e fim inteiros válidos');
    if (q.quantity_question_id) {
      const quantity = answers.find(
        (a) => a.questionId === q.quantity_question_id,
      );
      if (
        quantity?.state !== 'completed' ||
        typeof quantity.value !== 'number' ||
        value.end - value.start + 1 !== quantity.value
      )
        invalid('Sequência deve corresponder à quantidade declarada');
    }
  } else if (q.type === 'unit_allocations') {
    if (
      !Array.isArray(value) ||
      !value.length ||
      value.length > 200 ||
      value.some(
        (row) =>
          !row ||
          Object.keys(row).some(
            (key) => !['unit_id', 'quantity'].includes(key),
          ) ||
          !Number.isSafeInteger(row.unit_id) ||
          row.unit_id < 1 ||
          !Number.isSafeInteger(row.quantity) ||
          row.quantity < 0 ||
          row.quantity > 1e9,
      ) ||
      new Set(value.map((row) => row.unit_id)).size !== value.length
    )
      invalid(
        'Alocação deve conter unidades únicas e quantidades inteiras válidas',
      );
  }
}

export function progress(
  questions: PreparationQuestion[],
  answers: PolicyAnswer[],
) {
  const active = applicability(questions, answers);
  const eligible = questions.filter((q) => q.visible && active.get(q.id));
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const completed = eligible.filter(
    (q) => byId.get(q.id)?.state === 'completed',
  ).length;
  const notApplicable = eligible.filter(
    (q) => byId.get(q.id)?.state === 'not_applicable',
  ).length;
  const missingRequired = eligible
    .filter(
      (q) =>
        q.required && (!byId.has(q.id) || byId.get(q.id)?.state === 'pending'),
    )
    .map((q) => q.id);
  return {
    total: eligible.length,
    completed,
    not_applicable: notApplicable,
    pending: eligible.length - completed - notApplicable,
    hidden: questions.filter((q) => !q.visible).length,
    conditionally_disabled: questions.filter(
      (q) => q.visible && !active.get(q.id),
    ).length,
    percent: eligible.length
      ? Math.round(((completed + notApplicable) * 1000) / eligible.length) / 10
      : 0,
    missing_required: missingRequired,
  };
}
export function allocations(value: PreparationValue) {
  if (!Array.isArray(value)) return [];
  const total = value.reduce((sum, row) => sum + row.quantity, 0);
  return value.map((row) => ({
    ...row,
    participation_percent: total
      ? Math.round((row.quantity * 1000) / total) / 10
      : 0,
  }));
}
