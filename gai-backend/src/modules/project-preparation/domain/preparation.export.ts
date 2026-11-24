import { addressSummary, formatAnswerValue } from './preparation.policy';
import type {
  PolicyAnswer,
  PreparationQuestion,
  PreparationStatus,
} from './preparation.types';

/**
 * Linhas da planilha do kick-off: só as perguntas visíveis (I23), na mesma numeração da tela
 * (complementos "inline" entram na linha do item-pai, sem número próprio — I8), com a
 * resposta completa e as observações (I22). Respostas fora de aplicabilidade não saem (I6).
 */
export interface ExportUnit {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
}
export interface ExportInput {
  title: string;
  status: PreparationStatus;
  scheduledDate: string | null;
  templateName: string;
  templateVersion: number;
  questions: PreparationQuestion[];
  answers: PolicyAnswer[];
  applicable: Map<string, boolean>;
  realized: { done: number; total: number; percent: number };
  organizationName: string;
  units: ExportUnit[];
}

const STATUS: Record<PreparationStatus, string> = {
  draft: 'Em andamento',
  in_progress: 'Em andamento',
  approved: 'Concluída',
  archived: 'Excluída',
};
const civilBr = (value: string) => value.split('-').reverse().join('/');

export const EXPORT_HEADER = [
  'Nº',
  'Realizado',
  'Item',
  'Situação',
  'Resposta',
  'Observações',
];

export function exportRows(input: ExportInput): string[][] {
  const visible = input.questions
    .filter((q) => q.visible)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const rows = visible.filter((q) => q.display !== 'inline');
  const answerOf = (id: string) =>
    input.answers.find((a) => a.questionId === id);
  const text = (q: PreparationQuestion) => {
    const a = answerOf(q.id);
    if (!input.applicable.get(q.id) || !a) return '';
    if (a.state === 'not_applicable') return 'N/A';
    if (a.state !== 'completed') return '';
    const value = formatAnswerValue(q, a.value, {
      organizationName: input.organizationName,
      unitName: (id) =>
        input.units.find((unit) => unit.id === id)?.name ??
        'Unidade desvinculada',
    });
    if (q.type !== 'unit_allocations') return value;
    const summary = addressSummary(a.value, input.units);
    const states = summary.states.map((s) => s.state);
    return [
      value,
      `Endereços: ${summary.addresses} · Cidades: ${summary.cities} · Estados (${states.length}): ${states.join(', ') || '—'}`,
    ].join('\n');
  };
  const out: string[][] = [
    ['KICK-OFF'],
    ['Cliente', input.title],
    [
      'Data da reunião',
      input.scheduledDate ? civilBr(input.scheduledDate) : '',
    ],
    ['Situação', STATUS[input.status]],
    ['Modelo', `${input.templateName} · versão ${input.templateVersion}`],
    [
      'Check list',
      `${input.realized.done} de ${input.realized.total} (${input.realized.percent}%)`,
    ],
    [],
  ];
  let category: string | null = null;
  rows.forEach((q, index) => {
    if (q.category !== category) {
      if (category !== null) out.push([]);
      category = q.category;
      out.push([q.category], EXPORT_HEADER);
    }
    const a = answerOf(q.id);
    const applicable = Boolean(input.applicable.get(q.id));
    const children = visible.filter(
      (child) =>
        child.display === 'inline' &&
        child.enabled_when?.[0]?.question_id === q.id,
    );
    const answer = [
      text(q),
      ...children.flatMap((child) => {
        const value = text(child);
        return value ? [`${child.label} ${value}`] : [];
      }),
    ]
      .filter(Boolean)
      .join(' | ');
    const notes = [q, ...children]
      .map((item) => answerOf(item.id)?.notes?.trim())
      .filter(Boolean)
      .join(' | ');
    out.push([
      String(index + 1).padStart(2, '0'),
      a?.realized ? 'OK' : '',
      q.label,
      !applicable ? 'BLOQUEADO' : a?.realized ? 'REALIZADO' : 'PENDENTE',
      answer,
      notes,
    ]);
  });
  return out;
}

/** Nome de arquivo seguro (ASCII), a partir do título do kick-off. */
export function exportFileName(title: string) {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 80);
  return `kick-off-${slug || 'sem-nome'}.xlsx`;
}
