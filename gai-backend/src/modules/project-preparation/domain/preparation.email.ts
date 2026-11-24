import { isCivilDate } from '../../../common/validation/civil-date';
import {
  addressSummary,
  allocations,
  formatAnswerValue,
  invalid,
} from './preparation.policy';
import { ORGANIZATION_OPTION } from './preparation.types';
import type {
  EmailBlock,
  EmailCondition,
  EmailLine,
  EmailTemplate,
  PolicyAnswer,
  PreparationQuestion,
  Scalar,
} from './preparation.types';

/**
 * E-mail ao cliente gerado no servidor a partir do modelo da organização (versionado no
 * snapshot do kick-off). O resultado é texto simples: a formatação (cores, negrito) é
 * aplicada na tela, e a versão editada também é texto simples — nada de HTML gravado.
 */

const PLACEHOLDER =
  /\{(?:(q|notes|addresses):([a-z][a-z0-9_-]{1,79})(?:\.(name|phone|start|end))?|(organization|client|deadline|greeting))\}/g;
const ANY_BRACES = /\{[^{}]*\}/g;
const OPERATORS = [
  'equals',
  'not_equals',
  'in',
  'answered',
  'contains',
  'not_answered',
] as const;
const LIMITS = { blocks: 40, lines: 20, pendings: 30, text: 1000, short: 200 };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const scalar = (v: unknown): v is Scalar =>
  typeof v === 'string' ||
  typeof v === 'boolean' ||
  (typeof v === 'number' && Number.isFinite(v));

function text(value: unknown, field: string, max: number, required = true) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || (required && !value.trim()))
    invalid(`E-mail do modelo: "${field}" deve ser um texto`);
  if (value.length > max)
    invalid(`E-mail do modelo: "${field}" excede ${max} caracteres`);
  return value;
}

/** Valida e normaliza (descarta chaves desconhecidas) o e-mail do modelo. */
export function validateEmailTemplate(
  raw: unknown,
  questions: PreparationQuestion[],
): EmailTemplate | null {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw)) invalid('E-mail do modelo inválido');
  const byId = new Map(questions.map((q) => [q.id, q]));
  const question = (id: unknown, where: string) => {
    const q = typeof id === 'string' ? byId.get(id) : undefined;
    if (!q)
      invalid(
        `E-mail do modelo: pergunta inexistente em ${where} (${String(id)})`,
      );
    return q;
  };
  const checkText = (value: string, where: string) => {
    for (const token of value.match(ANY_BRACES) ?? []) {
      PLACEHOLDER.lastIndex = 0;
      const match = PLACEHOLDER.exec(token);
      if (!match || match[0] !== token)
        invalid(`E-mail do modelo: marcador desconhecido ${token} em ${where}`);
      const [, kind, id, field] = match;
      if (!kind) continue;
      const q = question(id, where);
      if (kind === 'addresses' && q.type !== 'unit_allocations')
        invalid(
          `E-mail do modelo: {addresses:${id}} exige pergunta de endereços`,
        );
      if (
        field &&
        !(
          (q.type === 'contact' && ['name', 'phone'].includes(field)) ||
          (['date_range', 'schedule'].includes(q.type) &&
            ['start', 'end'].includes(field))
        )
      )
        invalid(`E-mail do modelo: campo .${field} inválido para ${id}`);
    }
  };
  const condition = (c: unknown, where: string): EmailCondition => {
    if (!isRecord(c) || !OPERATORS.includes(c.operator as never))
      invalid(`E-mail do modelo: condição inválida em ${where}`);
    const q = question(c.question_id, where);
    const operator = c.operator as EmailCondition['operator'];
    const needsValue = !['answered', 'not_answered'].includes(operator);
    const value = c.value;
    if (
      needsValue &&
      !(
        scalar(value) ||
        (['in', 'contains'].includes(operator) &&
          Array.isArray(value) &&
          value.length > 0 &&
          value.length <= 20 &&
          value.every(scalar))
      )
    )
      invalid(`E-mail do modelo: condição sem valor em ${where}`);
    if (operator === 'contains' && q.type !== 'multi_select')
      invalid(
        `E-mail do modelo: "contains" só vale para escolha múltipla (${q.id})`,
      );
    return {
      question_id: q.id,
      operator,
      ...(needsValue ? { value: value as Scalar | Scalar[] } : {}),
    };
  };
  const line = (l: unknown, where: string): EmailLine => {
    if (!isRecord(l)) invalid(`E-mail do modelo: linha inválida em ${where}`);
    const value = text(l.text, `${where}.text`, LIMITS.text)!;
    checkText(value, where);
    if (l.when !== undefined && (!Array.isArray(l.when) || l.when.length > 10))
      invalid(`E-mail do modelo: condições inválidas em ${where}`);
    const when = (l.when as unknown[] | undefined)?.map((c) =>
      condition(c, where),
    );
    if (l.unless_realized !== undefined) question(l.unless_realized, where);
    return {
      text: value,
      ...(when?.length ? { when } : {}),
      ...(l.unless_realized !== undefined
        ? { unless_realized: l.unless_realized as string }
        : {}),
    };
  };
  const blocks = (list: unknown, where: string): EmailBlock[] => {
    if (!Array.isArray(list) || list.length > LIMITS.blocks)
      invalid(`E-mail do modelo: "${where}" deve ser uma lista de blocos`);
    return list.map((b, i) => {
      const at = `${where}[${i + 1}]`;
      if (
        !isRecord(b) ||
        !Array.isArray(b.lines) ||
        b.lines.length > LIMITS.lines
      )
        invalid(`E-mail do modelo: bloco inválido em ${at}`);
      const title = text(b.title, `${at}.title`, LIMITS.short, false);
      const empty = text(b.empty, `${at}.empty`, LIMITS.short, false);
      if (empty) checkText(empty, at);
      if (b.inline && !title)
        invalid(`E-mail do modelo: bloco em linha sem título em ${at}`);
      return {
        ...(title ? { title } : {}),
        lines: b.lines.map((l) => line(l, at)),
        ...(b.first === true ? { first: true } : {}),
        ...(b.inline === true ? { inline: true } : {}),
        ...(b.strong === true ? { strong: true } : {}),
        ...(empty !== undefined ? { empty } : {}),
      };
    });
  };
  if (!Array.isArray(raw.pendings) || raw.pendings.length > LIMITS.pendings)
    invalid('E-mail do modelo: pendências inválidas');
  return {
    subject: text(raw.subject, 'subject', LIMITS.short)!,
    header: blocks(raw.header, 'header'),
    topics: blocks(raw.topics, 'topics'),
    footer: blocks(raw.footer, 'footer'),
    pending_title: text(raw.pending_title, 'pending_title', LIMITS.short)!,
    pendings: raw.pendings.map((l, i) => line(l, `pendings[${i + 1}]`)),
  };
}

export interface EmailUnit {
  id: number;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
}
export interface EmailContext {
  questions: PreparationQuestion[];
  answers: PolicyAnswer[];
  /** Aplicabilidade calculada pelo servidor (respostas fora dela são ignoradas). */
  applicable: Map<string, boolean>;
  organizationName: string;
  clientName: string;
  /** Data da reunião (scheduled_date) ou, na falta, a de criação: base do prazo. */
  meetingDate: string;
  now: Date;
  units: EmailUnit[];
}

const civilBr = (value: string) => value.split('-').reverse().join('/');
const number = (value: number) => value.toLocaleString('pt-BR');

/** Primeira sexta-feira depois da data (dd/mm). */
export function firstFridayAfter(civil: string) {
  const [y, m, d] = civil.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() !== 5);
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "bom dia" / "boa tarde" / "boa noite" no horário de Brasília. */
export function greetingAt(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );
  return hour < 12 ? 'bom dia' : hour < 18 ? 'boa tarde' : 'boa noite';
}

export function renderEmail(email: EmailTemplate, ctx: EmailContext) {
  const byId = new Map(ctx.questions.map((q) => [q.id, q]));
  const answerOf = (id: string) => {
    const q = byId.get(id);
    const a = ctx.answers.find((answer) => answer.questionId === id);
    return q?.visible && ctx.applicable.get(id) && a?.state === 'completed'
      ? a
      : undefined;
  };
  const organization = ctx.organizationName.toUpperCase();
  const option = (v: string) => (v === ORGANIZATION_OPTION ? organization : v);
  const holds = (c: EmailCondition) => {
    const a = answerOf(c.question_id);
    if (c.operator === 'not_answered') return !a;
    if (!a) return false;
    const value = a.value;
    const list = Array.isArray(c.value) ? c.value : [c.value];
    switch (c.operator) {
      case 'answered':
        return true;
      case 'contains':
        return (
          Array.isArray(value) &&
          list.some((v) => (value as unknown[]).includes(v))
        );
      case 'in':
        return list.includes(value as Scalar);
      case 'equals':
        return value === c.value;
      default:
        return value !== c.value;
    }
  };
  const formatted = (id: string, field?: string) => {
    const q = byId.get(id)!;
    const a = answerOf(id);
    if (!a) return '';
    if (field) {
      const part = (a.value as Record<string, unknown> | null)?.[field];
      if (typeof part !== 'string' || !part.trim()) return '';
      return isCivilDate(part) ? civilBr(part) : option(part);
    }
    if (q.type === 'number' && typeof a.value === 'number')
      return number(a.value);
    return formatAnswerValue(q, a.value, {
      organizationName: organization,
      unitName: (unitId) =>
        ctx.units.find((unit) => unit.id === unitId)?.name ?? '',
    }).trim();
  };
  const addresses = (id: string) => {
    const a = answerOf(id);
    if (!a) return '';
    const rows = allocations(a.value);
    if (!rows.length) return '';
    // Até 5 endereços: lista; acima disso, resumo por UF (como no sistema anterior).
    if (rows.length > 5) {
      const summary = addressSummary(a.value, ctx.units);
      const plural = (n: number) => `${n} ${n > 1 ? 'ENDEREÇOS' : 'ENDEREÇO'}`;
      return [
        ...summary.states.map((s) => `${s.state} - ${plural(s.count)}`),
        ...(summary.without_state ? [plural(summary.without_state)] : []),
      ].join('\n');
    }
    return rows
      .map((row) => {
        const unit = ctx.units.find((u) => u.id === row.unit_id);
        const place = unit?.address || unit?.name || 'Unidade desvinculada';
        return `•\t${place}${row.quantity > 0 ? ` - ${String(row.participation_percent).replace('.', ',')}%` : ''}`;
      })
      .join('\n');
  };
  const fixed: Record<string, () => string> = {
    organization: () => organization,
    client: () => ctx.clientName.toUpperCase(),
    deadline: () => firstFridayAfter(ctx.meetingDate),
    greeting: () => greetingAt(ctx.now),
  };
  /** Texto da linha, ou null quando algum marcador fica vazio. */
  const fill = (value: string) => {
    let missing = false;
    const out = value.replace(
      PLACEHOLDER,
      (_m, kind?: string, id?: string, field?: string, name?: string) => {
        const v = name
          ? fixed[name]()
          : kind === 'notes'
            ? (answerOf(id!)?.notes?.trim() ?? '')
            : kind === 'addresses'
              ? addresses(id!)
              : formatted(id!, field);
        if (!v) missing = true;
        return v;
      },
    );
    return missing ? null : out;
  };
  const resolve = (lines: EmailLine[]) =>
    lines.flatMap((l) => {
      if (l.when && !l.when.every(holds)) return [];
      if (
        l.unless_realized &&
        ctx.answers.find((a) => a.questionId === l.unless_realized)?.realized
      )
        return [];
      const value = fill(l.text);
      return value === null ? [] : [value];
    });
  const block = (b: EmailBlock) => {
    let lines = resolve(b.lines);
    if (b.first) lines = lines.slice(0, 1);
    if (!lines.length) {
      if (b.empty === undefined) return null;
      lines = [fill(b.empty) ?? ''];
    }
    const split = lines.flatMap((l) => l.split('\n'));
    if (!b.title) return split;
    return b.inline
      ? [`${b.title}: ${split[0]}`, ...split.slice(1)]
      : [`${b.title}:`, ...split];
  };
  const paragraphs: string[][] = [];
  const strong: string[] = [];
  const push = (b: EmailBlock, lines: string[]) => {
    paragraphs.push(lines);
    if (b.strong) strong.push(...lines);
  };
  email.header.forEach((b) => {
    const lines = block(b);
    if (lines) push(b, lines);
  });
  let n = 0;
  email.topics.forEach((b) => {
    const lines = block(b);
    if (!lines) return;
    n += 1;
    lines[0] = `${String(n).padStart(2, '0')}- ${lines[0]}`;
    paragraphs.push(lines);
  });
  email.footer.forEach((b) => {
    const lines = block(b);
    if (lines) paragraphs.push(lines);
  });
  const pendings = resolve(email.pendings);
  if (pendings.length)
    paragraphs.push(
      [email.pending_title],
      pendings.map((p, i) => `${String(i + 1).padStart(2, '0')}- ${p}`),
    );
  return {
    subject: fill(email.subject) ?? email.subject,
    text: paragraphs.map((p) => p.join('\n')).join('\n\n'),
    pendings: pendings.length,
    /** Linhas em destaque, para a formatação na tela (o título das pendências também). */
    strong_lines: [
      ...strong,
      ...(pendings.length ? [email.pending_title] : []),
    ],
  };
}
