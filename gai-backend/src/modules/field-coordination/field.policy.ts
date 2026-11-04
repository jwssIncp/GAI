import { BadRequestException, ConflictException } from '@nestjs/common';
import { isCivilDate } from '../../common/validation/civil-date';

export const FIELD_PERMISSIONS = [
  'field-coordination:read',
  'field-coordination:edit',
  'field-coordination:coordinate',
] as const;
export const TASK_STATES = [
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'not_applicable',
] as const;
export type TaskState = (typeof TASK_STATES)[number];
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export function fieldToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}
export interface FieldCondition {
  task_id: string;
  states: TaskState[];
}
export interface FieldTaskDefinition {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  order: number;
  required: boolean;
  allow_not_applicable: boolean;
  requires_responsible: boolean;
  requires_due_date: boolean;
  requires_notes: boolean;
  requires_approval: boolean;
  requires_issue_resolved: boolean;
  applicable_if?: FieldCondition[];
}
export interface FieldGroup {
  id: string;
  title: string;
  order: number;
  required: boolean;
  applicable_if?: FieldCondition[];
}
export interface FieldDefinition {
  groups: FieldGroup[];
  tasks: FieldTaskDefinition[];
}
export interface TaskFacts {
  stableId: string;
  state: TaskState;
}
export function invalid(message: string): never {
  throw new BadRequestException({ code: 'FIELD_VALIDATION', message });
}
export function conflict(
  message = 'A revisão mudou; recarregue antes de salvar',
  details?: unknown,
): never {
  throw new ConflictException({ code: 'FIELD_CONFLICT', message, details });
}
export function civilDate(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (!isCivilDate(value)) invalid('Data civil inválida');
  return value;
}
export function validateDefinition(input: FieldDefinition): FieldDefinition {
  if (
    !input ||
    !Array.isArray(input.groups) ||
    !input.groups.length ||
    input.groups.length > 50 ||
    !Array.isArray(input.tasks) ||
    !input.tasks.length ||
    input.tasks.length > 1000
  )
    invalid('Informe de 1 a 50 etapas e de 1 a 1000 tarefas');
  const validId = (value: unknown) =>
    typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
  const ids = new Set<string>();
  for (const row of [...input.groups, ...input.tasks]) {
    if (!row || typeof row !== 'object') invalid('Etapa/tarefa inválida');
    if (!validId(row.id) || ids.has(row.id))
      invalid('IDs de etapas/tarefas devem ser estáveis e únicos');
    ids.add(row.id);
    if (
      typeof row.title !== 'string' ||
      !row.title.trim() ||
      row.title.length > 200 ||
      !Number.isInteger(row.order) ||
      row.order < 0 ||
      row.order > 10000 ||
      typeof row.required !== 'boolean'
    )
      invalid('Etapa/tarefa inválida');
  }
  const groups = new Map(input.groups.map((group) => [group.id, group]));
  const tasks = new Map(input.tasks.map((task) => [task.id, task]));
  for (const group of input.groups)
    if (!input.tasks.some((task) => task.group_id === group.id))
      invalid('Cada etapa precisa conter tarefas');
  for (const task of input.tasks) {
    if (!groups.has(task.group_id)) invalid('Etapa da tarefa inexistente');
    if (
      task.description != null &&
      (typeof task.description !== 'string' || task.description.length > 5000)
    )
      invalid('Descrição muito longa');
    for (const key of [
      'allow_not_applicable',
      'requires_responsible',
      'requires_due_date',
      'requires_notes',
      'requires_approval',
      'requires_issue_resolved',
    ] as const)
      if (typeof task[key] !== 'boolean')
        invalid('Requisitos da tarefa devem ser booleanos');
  }
  for (const row of [...input.groups, ...input.tasks]) {
    if (
      row.applicable_if !== undefined &&
      (!Array.isArray(row.applicable_if) || row.applicable_if.length > 10)
    )
      invalid('Condições inválidas');
    for (const condition of row.applicable_if ?? [])
      if (
        !condition ||
        typeof condition !== 'object' ||
        !tasks.has(condition.task_id) ||
        !Array.isArray(condition.states) ||
        !condition.states.length ||
        condition.states.some((state) => !TASK_STATES.includes(state))
      )
        invalid('Condição referencia tarefa/estado inválido');
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) invalid('Ciclo nas condições de aplicabilidade');
    if (visited.has(id)) return;
    visiting.add(id);
    const task = tasks.get(id)!;
    for (const condition of [
      ...(groups.get(task.group_id)!.applicable_if ?? []),
      ...(task.applicable_if ?? []),
    ])
      visit(condition.task_id);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of input.tasks) visit(task.id);
  return structuredClone(input);
}
export function applicability(
  definition: FieldDefinition,
  facts: TaskFacts[],
): Map<string, boolean> {
  const states = new Map(facts.map((row) => [row.stableId, row.state]));
  const tasks = new Map(definition.tasks.map((task) => [task.id, task]));
  const groups = new Map(definition.groups.map((group) => [group.id, group]));
  const result = new Map<string, boolean>();
  const evaluate = (id: string): boolean => {
    if (result.has(id)) return result.get(id)!;
    const task = tasks.get(id)!;
    const conditions = [
      ...(groups.get(task.group_id)!.applicable_if ?? []),
      ...(task.applicable_if ?? []),
    ];
    const applies = conditions.every(
      (condition) =>
        evaluate(condition.task_id) &&
        condition.states.includes(states.get(condition.task_id) ?? 'pending'),
    );
    result.set(id, applies);
    return applies;
  };
  for (const task of definition.tasks) evaluate(task.id);
  return result;
}
export function validateTransition(
  before: TaskState,
  next: TaskState,
  reason?: string | null,
): { reopens: boolean } {
  if (!TASK_STATES.includes(next)) invalid('Estado inválido');
  const reopens =
    ['completed', 'not_applicable'].includes(before) && next !== before;
  if (
    reopens &&
    (!reason?.trim() || !['pending', 'in_progress'].includes(next))
  )
    invalid('Reabertura exige motivo e destino pendente ou em andamento');
  if (next === 'not_applicable' && !reason?.trim())
    invalid('Não aplicável exige justificativa');
  return { reopens };
}
