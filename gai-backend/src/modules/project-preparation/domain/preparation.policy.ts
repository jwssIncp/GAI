import { BadRequestException } from '@nestjs/common';
import { isCivilDate } from '../../../common/validation/civil-date';
import {
  PolicyAnswer,
  PreparationQuestion,
  ORGANIZATION_OPTION,
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
      (q.type === 'select' || q.type === 'multi_select') &&
      (!q.options?.length ||
        q.options.length > 50 ||
        q.options.some(
          (v) => typeof v !== 'string' || !v.trim() || v.length > 100,
        ) ||
        new Set(q.options).size !== q.options.length)
    )
      invalid(`Opções inválidas para ${q.id}`);
    if (q.options && q.type !== 'select' && q.type !== 'multi_select')
      invalid('Somente perguntas de seleção aceitam opções');
    if (
      q.quantity_question_id &&
      (!['sequence', 'sequence_list'].includes(q.type) ||
        byId.get(q.quantity_question_id)?.type !== 'number' ||
        q.quantity_question_id === q.id)
    )
      invalid('Sequência deve referenciar uma pergunta numérica distinta');
    if (q.display !== undefined && !['row', 'inline'].includes(q.display))
      invalid(`Exibição inválida: ${q.id}`);
    if (
      q.display === 'inline' &&
      (q.enabled_when?.length !== 1 ||
        byId.get(q.enabled_when[0].question_id)?.category !== q.category)
    )
      invalid(
        `Complemento na linha exige uma única condição sobre pergunta da mesma seção: ${q.id}`,
      );
    if ((q.enabled_when?.length ?? 0) > 10)
      invalid('Máximo de dez condições por pergunta');
    for (const condition of q.enabled_when ?? []) {
      const parent = byId.get(condition.question_id);
      if (
        !parent ||
        parent.id === q.id ||
        !['equals', 'not_equals', 'in', 'answered', 'contains'].includes(
          condition.operator,
        ) ||
        // Escolha múltipla só aceita "contains" ou "answered"; "contains" só vale para ela.
        ((parent.type === 'multi_select') !==
          ['contains', 'answered'].includes(condition.operator) &&
          condition.operator !== 'answered')
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
              : [
                  'sequence',
                  'unit_allocations',
                  'contact',
                  'date_range',
                  'schedule',
                  'sequence_list',
                  'none',
                ].includes(parent.type) ||
                typeof v !== 'string' ||
                (['select', 'multi_select'].includes(parent.type) &&
                  !parent.options?.includes(v)),
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
      if (condition.operator === 'contains')
        return (
          Array.isArray(answer.value) &&
          (answer.value as unknown[]).includes(condition.value)
        );
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
  if (q.type === 'none')
    invalid(
      `Item sem resposta: use apenas "Realizado" e observações (${q.id})`,
    );
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
    const seq = value as { start: number; end: number } | null;
    if (
      !seq ||
      typeof seq !== 'object' ||
      Array.isArray(seq) ||
      Object.keys(seq).some((key) => !['start', 'end'].includes(key)) ||
      !Number.isSafeInteger(seq.start) ||
      !Number.isSafeInteger(seq.end) ||
      seq.start < 0 ||
      seq.end < seq.start
    )
      invalid('Sequência deve ter início e fim inteiros válidos');
    if (q.quantity_question_id) {
      const quantity = answers.find(
        (a) => a.questionId === q.quantity_question_id,
      );
      if (
        quantity?.state !== 'completed' ||
        typeof quantity.value !== 'number' ||
        seq.end - seq.start + 1 !== quantity.value
      )
        invalid('Sequência deve corresponder à quantidade declarada');
    }
  } else if (q.type === 'multi_select') {
    if (
      !Array.isArray(value) ||
      !value.length ||
      value.some((v) => typeof v !== 'string' || !q.options?.includes(v)) ||
      new Set(value as string[]).size !== value.length
    )
      invalid(`Escolha múltipla inválida: ${q.id}`);
  } else if (q.type === 'contact') {
    const contact = value as { name?: unknown; phone?: unknown } | null;
    if (
      !contact ||
      typeof contact !== 'object' ||
      Array.isArray(contact) ||
      Object.keys(contact).some((key) => !['name', 'phone'].includes(key)) ||
      typeof contact.name !== 'string' ||
      !contact.name.trim() ||
      contact.name.length > 120 ||
      (contact.phone != null &&
        (typeof contact.phone !== 'string' || !validPhone(contact.phone)))
    )
      invalid(
        `Contato inválido: informe o nome e um telefone com DDD (${q.id})`,
      );
  } else if (q.type === 'date_range') {
    const range = value as { start?: unknown; end?: unknown } | null;
    if (
      !range ||
      typeof range !== 'object' ||
      Array.isArray(range) ||
      Object.keys(range).some((key) => !['start', 'end'].includes(key)) ||
      typeof range.start !== 'string' ||
      typeof range.end !== 'string'
    )
      invalid(`Período inválido: ${q.id}`);
    validDate(range.start);
    validDate(range.end);
    if (range.end < range.start)
      invalid(
        `O fim do período deve ser igual ou posterior ao início: ${q.id}`,
      );
  } else if (q.type === 'schedule') {
    const hours = value as {
      start?: unknown;
      end?: unknown;
      weekends?: unknown;
    } | null;
    const time = (v: unknown) =>
      typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    if (
      !hours ||
      typeof hours !== 'object' ||
      Array.isArray(hours) ||
      Object.keys(hours).some(
        (key) => !['start', 'end', 'weekends'].includes(key),
      ) ||
      !time(hours.start) ||
      !time(hours.end) ||
      hours.start === hours.end ||
      typeof hours.weekends !== 'boolean'
    )
      invalid(`Horário inválido: entrada e saída em HH:MM (${q.id})`);
  } else if (q.type === 'sequence_list') {
    if (
      !Array.isArray(value) ||
      !value.length ||
      value.length > 50 ||
      value.some((row) => {
        const seq = row as { start?: unknown; end?: unknown } | null;
        return (
          !seq ||
          typeof seq !== 'object' ||
          Object.keys(seq).some((key) => !['start', 'end'].includes(key)) ||
          !Number.isSafeInteger(seq.start) ||
          !Number.isSafeInteger(seq.end) ||
          (seq.start as number) < 0 ||
          (seq.end as number) < (seq.start as number)
        );
      })
    )
      invalid(`Sequências inválidas: ${q.id}`);
    if (q.quantity_question_id) {
      const quantity = answers.find(
        (a) => a.questionId === q.quantity_question_id,
      );
      if (
        quantity?.state !== 'completed' ||
        typeof quantity.value !== 'number' ||
        value.length !== quantity.value
      )
        invalid(
          'Informe uma sequência para cada modelo declarado na quantidade',
        );
    }
  } else if (q.type === 'unit_allocations') {
    const rows = value as Array<{ unit_id: number; quantity: number }> | null;
    if (
      !Array.isArray(rows) ||
      !rows.length ||
      rows.length > 200 ||
      rows.some(
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
      new Set(rows.map((row) => row.unit_id)).size !== rows.length
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
  const realized = eligible.filter((q) => byId.get(q.id)?.realized).length;
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
    /** Itens marcados como realizados ("X de Y verificado(s)" do sistema anterior). */
    realized,
    realized_percent: eligible.length
      ? Math.round((realized * 1000) / eligible.length) / 10
      : 0,
  };
}
/** Telefone brasileiro com DDD (10 ou 11 dígitos), aceitando +55. */
export function validPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return /^[1-9]\d{9,10}$/.test(digits) && phone.length <= 30;
}
export function allocations(value: PreparationValue) {
  if (
    !Array.isArray(value) ||
    !value.every(
      (row) => row !== null && typeof row === 'object' && 'unit_id' in row,
    )
  )
    return [];
  const rows = value as Array<{ unit_id: number; quantity: number }>;
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  return rows.map((row) => ({
    ...row,
    participation_percent: total
      ? Math.round((row.quantity * 1000) / total) / 10
      : 0,
  }));
}

const civilBr = (value: string) => value.split('-').reverse().join('/');

/**
 * Texto de uma resposta para comunicações e exportações, para todos os tipos. A opção
 * ORGANIZATION_OPTION vira o nome da organização dona do projeto.
 */
export function formatAnswerValue(
  q: PreparationQuestion,
  value: PreparationValue,
  options: {
    organizationName: string;
    unitName: (id: number) => string;
  },
): string {
  const option = (v: string) =>
    v === ORGANIZATION_OPTION ? options.organizationName.toUpperCase() : v;
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (q.type === 'unit_allocations')
    return allocations(value)
      .map(
        (row) =>
          `${options.unitName(row.unit_id)}: ${row.quantity} itens (${row.participation_percent}%)`,
      )
      .join('; ');
  if (q.type === 'multi_select')
    return (value as string[]).map(option).join(' / ');
  if (q.type === 'contact') {
    const contact = value as { name: string; phone: string | null };
    return contact.phone ? `${contact.name} - ${contact.phone}` : contact.name;
  }
  if (q.type === 'date_range') {
    const range = value as { start: string; end: string };
    return `${civilBr(range.start)} a ${civilBr(range.end)}`;
  }
  if (q.type === 'schedule') {
    const hours = value as { start: string; end: string; weekends: boolean };
    return `Entrada ${hours.start} · Saída ${hours.end}${hours.weekends ? ' · Inclui finais de semana' : ''}`;
  }
  if (q.type === 'sequence_list')
    return (value as Array<{ start: number; end: number }>)
      .map((seq, index) => `Sequência ${index + 1}: ${seq.start} a ${seq.end}`)
      .join('; ');
  if (q.type === 'sequence') {
    const seq = value as { start: number; end: number };
    return `${seq.start} a ${seq.end}`;
  }
  if (q.type === 'date' && typeof value === 'string') return civilBr(value);
  if (typeof value === 'string') return option(value);
  return typeof value === 'number' ? String(value) : JSON.stringify(value);
}
