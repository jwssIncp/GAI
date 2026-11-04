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
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Scalar = string | number | boolean;
export type PreparationValue =
  | Scalar
  | null
  | { start: number; end: number }
  | Array<{ unit_id: number; quantity: number }>;
export interface QuestionCondition {
  question_id: string;
  operator: 'equals' | 'not_equals' | 'in' | 'answered';
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
