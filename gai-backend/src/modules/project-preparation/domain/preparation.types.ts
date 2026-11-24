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
}
export interface PreparationSnapshot {
  name: string;
  version: number;
  questions: PreparationQuestion[];
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
    key: 'project-preparation:approve',
    action: 'approve',
    description: 'Aprovar e reabrir preparação dos projetos',
  },
] as const;
