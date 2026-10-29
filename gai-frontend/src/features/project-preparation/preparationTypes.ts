import type { ProjectStatus } from '@/types/api';
export type PreparationKind = 'kickoff' | 'client_checklist';
export type QuestionType =
  | 'text'
  | 'long_text'
  | 'boolean'
  | 'number'
  | 'date'
  | 'select'
  | 'sequence'
  | 'unit_allocations';
export type Scalar = string | number | boolean;
export type AnswerValue =
  | Scalar
  | null
  | { start: number; end: number }
  | Array<{ unit_id: number; quantity: number }>;
export interface Condition {
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
  enabled_when?: Condition[];
  quantity_question_id?: string;
}
export interface PreparationTemplate {
  id: number;
  organization_id: number;
  name: string;
  kind: PreparationKind;
  current_version: number;
  archived_at: string | null;
  questions?: PreparationQuestion[];
  versions?: Array<{
    version: number;
    name: string;
    created_at: string;
    created_by_id: number;
  }>;
}
export interface TemplatePayload {
  name: string;
  kind: PreparationKind;
  questions: PreparationQuestion[];
}
export type AnswerState = 'pending' | 'completed' | 'not_applicable';
export interface AnswerPayload {
  question_id: string;
  state: AnswerState;
  value: AnswerValue;
  notes: string | null;
  responsible_user_id: number | null;
  due_date: string | null;
}
export interface PreparationAnswer extends AnswerPayload {
  applicable: boolean;
  answered_by_id: number | null;
  answered_at: string | null;
  allocations: Array<{
    unit_id: number;
    quantity: number;
    participation_percent: number;
  }>;
}
export interface Preparation {
  id: number;
  organization_id: number;
  project_id: number;
  kind: PreparationKind;
  title: string;
  revision: number;
  template_version_id: number;
  snapshot: { name: string; version: number; questions: PreparationQuestion[] };
  status: 'draft' | 'in_progress' | 'approved' | 'archived';
  responsible_user_id: number | null;
  scheduled_date: string | null;
  due_date: string | null;
  notes: string | null;
  approved_by_id: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  progress: {
    total: number;
    completed: number;
    not_applicable: number;
    pending: number;
    hidden: number;
    conditionally_disabled: number;
    percent: number;
    missing_required: string[];
  };
  answers: PreparationAnswer[];
}
export interface PreparationContext {
  project: {
    id: number;
    organization_id: number;
    name: string;
    status: ProjectStatus;
  };
  company: { id: number; name: string } | null;
  units: Array<{ id: number; name: string; address: string }>;
  responsible_users: Array<{ id: number; label: string }>;
}
export interface PreparationMetadata {
  title: string;
  responsible_user_id: number | null;
  scheduled_date: string | null;
  due_date: string | null;
  notes?: string | null;
}
export interface CommunicationPreview {
  channel: 'email' | 'guidance';
  recipient: null;
  subject: string;
  body: string;
  delivery_status: 'preview_only';
}
export interface PreparationHistory {
  items: Array<{
    id: number;
    operation: string;
    performed_by_id: number;
    created_at: string;
    changes: Record<string, unknown>;
  }>;
  next_before_id: number | null;
}
export const kindLabels: Record<PreparationKind, string> = {
  kickoff: 'Kick-off',
  client_checklist: 'Checklist do Cliente',
};
export const statusLabels = {
  draft: 'Rascunho',
  in_progress: 'Em preenchimento',
  approved: 'Aprovado',
  archived: 'Arquivado',
};
export const questionTypeLabels: Record<QuestionType, string> = {
  text: 'Texto',
  long_text: 'Texto longo',
  boolean: 'Sim ou não',
  number: 'Número',
  date: 'Data',
  select: 'Seleção',
  sequence: 'Sequência de etiquetas',
  unit_allocations: 'Itens por unidade',
};
