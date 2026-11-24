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
  | 'unit_allocations'
  | 'multi_select'
  | 'contact'
  | 'date_range'
  | 'schedule'
  | 'sequence_list'
  | 'none';
/** Opção que mostra o nome da organização dona do projeto (valor estável). */
export const ORGANIZATION_OPTION = '@organizacao';
export type ContactValue = { name: string; phone: string | null };
export type DateRangeValue = { start: string; end: string };
export type ScheduleValue = { start: string; end: string; weekends: boolean };
export type SequenceValue = { start: number; end: number };
export type Scalar = string | number | boolean;
export type AnswerValue =
  | Scalar
  | null
  | SequenceValue
  | Array<{ unit_id: number; quantity: number }>
  | string[]
  | ContactValue
  | DateRangeValue
  | ScheduleValue
  | SequenceValue[];
export interface Condition {
  question_id: string;
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
  enabled_when?: Condition[];
  quantity_question_id?: string;
  /** "inline": complemento exibido na linha da pergunta da qual depende. */
  display?: 'row' | 'inline';
  /** Origem do pré-preenchimento (contrato ou unidades), aplicado sem sobrescrever. */
  prefill?: 'contract.scope' | 'contract.estimated_assets' | 'contract.expenses_paid_by' | 'project.units';
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
  /** "Realizado" (item tratado), independente da resposta. Omitido: mantém. */
  realized?: boolean;
}
export interface PreparationAnswer extends AnswerPayload {
  realized_by_name?: string | null;
  realized_at?: string | null;
  applicable: boolean;
  answered_by_id: number | null;
  /** Nomes para exibição (nulo = usuário removido). */
  responsible_user_name?: string | null;
  answered_by_name?: string | null;
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
  /** Nomes para exibição (nulo = usuário removido). */
  responsible_user_name?: string | null;
  approved_by_name?: string | null;
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
    /** Itens realizados ("X de Y verificado(s)"). */
    realized?: number;
    realized_percent?: number;
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
  /** Organização dona do projeto: nome exibido na opção ORGANIZATION_OPTION. */
  organization?: { id: number; name: string } | null;
  company: { id: number; name: string } | null;
  /** Unidades vinculadas ao projeto (endereços do kick-off), com cidade e UF. */
  units: Array<{ id: number; name: string; address: string; city?: string | null; state?: string | null }>;
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
    performed_by_name?: string | null;
    created_at: string;
    changes: Record<string, unknown>;
  }>;
  next_before_id: number | null;
}
export const kindLabels: Record<PreparationKind, string> = {
  kickoff: 'Kick-off',
  client_checklist: 'Checklist do cliente',
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
  multi_select: 'Escolha múltipla (chips)',
  contact: 'Contato (nome e telefone)',
  date_range: 'Período (início e fim)',
  schedule: 'Horário (entrada, saída, fins de semana)',
  sequence_list: 'Sequências por modelo',
  none: 'Sem resposta (só Realizado)',
};
