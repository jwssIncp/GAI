export const PREPARATION_KINDS = ['kickoff', 'client_checklist'] as const;
export type PreparationKind = (typeof PREPARATION_KINDS)[number];
export const QUESTION_TYPES = [
  'text',
  'long_text',
  'boolean',
  'number',
  'date',
  'select',
  'sequence',
  'unit_allocations',
  /** Escolha múltipla em chips (ex.: Escopo, Perfil dos bens). Valor: lista de opções. */
  'multi_select',
  /** Contato: { name, phone }. Dado pessoal (LGPD): só para quem acessa o projeto. */
  'contact',
  /** Intervalo de datas civis: { start, end }. */
  'date_range',
  /** Horário especial: { start: 'HH:MM', end: 'HH:MM', weekends }. */
  'schedule',
  /** Lista de sequências { start, end }, na quantidade da pergunta numérica indicada. */
  'sequence_list',
  /** Item sem resposta: só o "Realizado" e as observações. */
  'none',
] as const;
/**
 * Origem do pré-preenchimento de uma pergunta (aplicado uma vez, sem sobrescrever):
 * - contract.scope: serviços do contrato → opções do escopo (escolha múltipla);
 * - contract.estimated_assets: soma dos bens estimados nos contratos (número);
 * - contract.expenses_paid_by: despesas por conta do cliente ou da organização (seleção);
 * - project.units: unidades vinculadas ao projeto (endereços).
 */
export const PREFILL_SOURCES = [
  'contract.scope',
  'contract.estimated_assets',
  'contract.expenses_paid_by',
  'project.units',
] as const;
export type PrefillSource = (typeof PREFILL_SOURCES)[number];
/** Opção que mostra o nome da organização (ex.: fornecedor das etiquetas). Valor estável. */
export const ORGANIZATION_OPTION = '@organizacao';
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Scalar = string | number | boolean;
export type PreparationValue =
  | Scalar
  | null
  | { start: number; end: number }
  | Array<{ unit_id: number; quantity: number }>
  | string[]
  | { name: string; phone: string | null }
  | { start: string; end: string }
  | { start: string; end: string; weekends: boolean }
  | Array<{ start: number; end: number }>;
export interface QuestionCondition {
  question_id: string;
  /** "contains": a escolha múltipla da pergunta de origem inclui o valor. */
  operator: 'equals' | 'not_equals' | 'in' | 'answered' | 'contains';
  value?: Scalar | Scalar[];
}
export interface PreparationQuestion {
  id: string;
  category: string;
  label: string;
  type: QuestionType;
  order: number;
  required: boolean;
  visible: boolean;
  allow_not_applicable: boolean;
  options?: string[];
  enabled_when?: QuestionCondition[];
  quantity_question_id?: string;
  /** "inline": complemento exibido na linha da pergunta da qual depende. Padrão: linha própria. */
  display?: 'row' | 'inline';
  /** De onde vem o pré-preenchimento (ver PREFILL_SOURCES). */
  prefill?: PrefillSource;
}
/**
 * Condição de uma linha do e-mail: as da pergunta, mais "not_answered". "contains" aceita uma
 * lista (qualquer um dos valores). Respostas pendentes ou fora de aplicabilidade não contam.
 */
export interface EmailCondition {
  question_id: string;
  operator: QuestionCondition['operator'] | 'not_answered';
  value?: Scalar | Scalar[];
}
/**
 * Linha do e-mail com marcadores: {q:id} (resposta formatada; {q:id.campo} para contato,
 * período e horário), {notes:id}, {addresses}, {organization}, {client}, {deadline} e
 * {greeting}. A linha é omitida quando uma condição falha ou um marcador fica vazio.
 */
export interface EmailLine {
  text: string;
  when?: EmailCondition[];
  /** Pendência: omitida quando o item indicado já está "Realizado". */
  unless_realized?: string;
}
export interface EmailBlock {
  title?: string;
  lines: EmailLine[];
  /** Só a primeira linha válida (alternativas). */
  first?: boolean;
  /** "Título: primeira linha" na mesma linha. */
  inline?: boolean;
  /** Texto quando nenhuma linha vale; sem ele, o bloco é omitido. */
  empty?: string;
  /** Destaque (negrito sublinhado), como o título do resumo. */
  strong?: boolean;
}
/** E-mail ao cliente, no modelo versionado da organização (nada de texto fixo no código). */
export interface EmailTemplate {
  subject: string;
  header: EmailBlock[];
  /** Tópicos numerados "01- ", "02- "... */
  topics: EmailBlock[];
  footer: EmailBlock[];
  pending_title: string;
  /** Pendências numeradas; {deadline} = primeira sexta depois da data da reunião. */
  pendings: EmailLine[];
}
export interface PreparationSnapshot {
  name: string;
  version: number;
  questions: PreparationQuestion[];
  email?: EmailTemplate | null;
}
export const ANSWER_STATES = [
  'pending',
  'completed',
  'not_applicable',
] as const;
export type AnswerState = (typeof ANSWER_STATES)[number];
export interface PolicyAnswer {
  questionId: string;
  state: AnswerState;
  value: PreparationValue;
  notes: string | null;
  /** Item tratado ("Realizado"), independente da resposta. */
  realized?: boolean;
}
export type PreparationStatus =
  | 'draft'
  | 'in_progress'
  | 'approved'
  | 'archived';
export const PREPARATION_PERMISSIONS = [
  {
    key: 'project-preparation:read',
    action: 'read',
    description:
      'Consultar preparação, modelos, histórico e prévias de comunicação',
  },
  {
    key: 'project-preparation:edit',
    action: 'edit',
    description: 'Gerenciar modelos e preencher preparação dos projetos',
  },
  {
    key: 'project-preparation:export',
    action: 'export',
    description: 'Exportar o kick-off em planilha (inclui contatos dos focais)',
  },
  {
    key: 'project-preparation:approve',
    action: 'approve',
    description: 'Aprovar e reabrir preparação dos projetos',
  },
] as const;
