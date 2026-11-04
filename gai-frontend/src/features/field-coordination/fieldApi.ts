import { api } from "@/api/http";
import type { ProjectStatus } from "@/types/api";
export type TaskState =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "not_applicable";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Condition = { task_id: string; states: TaskState[] };
export interface Group {
  id: string;
  title: string;
  order: number;
  required: boolean;
  applicable_if?: Condition[];
}
export interface TaskDefinition {
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
  applicable_if?: Condition[];
}
export interface Definition {
  groups: Group[];
  tasks: TaskDefinition[];
}
export interface Template {
  id: number;
  name: string;
  description: string | null;
  currentVersion: number;
  version?: number;
  archivedAt: string | null;
  definition: Definition;
}
export interface Checklist {
  id: number;
  organizationId: number;
  projectId: number;
  title: string;
  snapshot: Definition & { name: string; version: number };
  revision: number;
  status: "open" | "completed" | "archived";
  completedAt: string | null;
  completedById: number | null;
}
export interface Task {
  responsible?: {
    kind: "user" | "field_agent";
    id: number;
    name: string;
  } | null;
  id: number;
  stableId: string;
  groupId: string;
  title: string;
  definition: TaskDefinition;
  required: boolean;
  applicable: boolean;
  state: TaskState;
  priority: Priority;
  responsibleUserId: number | null;
  fieldAgentId: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  reason: string | null;
  linkedIssueId: number | null;
  hasLinkedIssue: boolean;
  approvedById: number | null;
  issue: { id: number; title: string; status: string } | null;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface Responsible {
  id: number;
  name: string;
  kind: "user" | "field_agent";
  linkedUserId?: number | null;
}
export interface Context extends Page<Responsible> {
  project: {
    id: number;
    name: string;
    organizationId: number;
    status: ProjectStatus;
  };
}
export interface GroupProgress extends Group {
  total: number;
  completed: number;
  notApplicable: number;
  pending: number;
  blocked: number;
  overdue: number;
  percent: number;
}
export interface Dashboard {
  checklist: Checklist;
  groups: GroupProgress[];
  responsibles: {
    userId: number | null;
    fieldAgentId: number | null;
    userName: string | null;
    agentName: string | null;
    total: number;
    completed: number;
  }[];
  summary: {
    groups: number;
    groupsCompleted: number;
    groupsPending: number;
    groupsNotApplicable: number;
    total: number;
    completed: number;
    notApplicable: number;
    pending: number;
    blocked: number;
    overdue: number;
    conditionallyExcluded: number;
    percent: number;
    linkedIssues: number;
    denominator: string;
  };
}
export interface Readiness {
  can_complete: boolean;
  revision: number;
  blockers: {
    task_id: number;
    stable_id: string;
    group_id: string;
    code: string;
    message: string;
  }[];
}
export const stateLabels: Record<TaskState, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  blocked: "Bloqueada",
  not_applicable: "Não aplicável",
};
export const priorities: Record<Priority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};
export const fieldKeys = {
  all: (project: number) => ["field-coordination", project] as const,
  templates: (org: number) => ["field-templates", org] as const,
};
const root = (p: number) => `/projects/${p}/field-coordination`;
export const fieldApi = {
  context: (p: number, params: object) =>
    api.get<Context>(root(p) + "/context", { params }).then((r) => r.data),
  list: (p: number, page = 1) =>
    api.get<Page<Checklist>>(root(p), { params: { page } }).then((r) => r.data),
  templates: (org: number, page = 1) =>
    api
      .get<
        Page<Template>
      >(`/organizations/${org}/field-templates`, { params: { page } })
      .then((r) => r.data),
  template: (org: number, id: number, version?: number) =>
    api
      .get<Template>(
        `/organizations/${org}/field-templates/${id}` +
          (version ? `/versions/${version}` : ""),
      )
      .then((r) => r.data),
  saveTemplate: (org: number, payload: object, id?: number) =>
    id
      ? api
          .patch<Template>(
            `/organizations/${org}/field-templates/${id}`,
            payload,
          )
          .then((r) => r.data)
      : api
          .post<Template>(`/organizations/${org}/field-templates`, payload)
          .then((r) => r.data),
  archiveTemplate: (org: number, row: Template) =>
    api.post(`/organizations/${org}/field-templates/${row.id}/archive`, {
      expected_version: row.currentVersion,
      archived: !row.archivedAt,
    }),
  create: (p: number, payload: object) =>
    api.post<Checklist>(root(p), payload).then((r) => r.data),
  dashboard: (p: number, id: number) =>
    api.get<Dashboard>(`${root(p)}/${id}/dashboard`).then((r) => r.data),
  tasks: (p: number, id: number, params: object) =>
    api
      .get<
        Page<Task> & { revision: number }
      >(`${root(p)}/${id}/tasks`, { params })
      .then((r) => r.data),
  task: (p: number, id: number, task: number, payload: object) =>
    api.patch(`${root(p)}/${id}/tasks/${task}`, payload).then((r) => r.data),
  addTask: (p: number, id: number, payload: object) =>
    api.post(`${root(p)}/${id}/tasks`, payload).then((r) => r.data),
  approve: (p: number, id: number, task: number, revision: number) =>
    api.post(`${root(p)}/${id}/tasks/${task}/approve`, {
      revision,
      command_key: crypto.randomUUID(),
    }),
  readiness: (p: number, id: number) =>
    api.get<Readiness>(`${root(p)}/${id}/readiness`).then((r) => r.data),
  transition: (p: number, id: number, payload: object) =>
    api
      .post<Checklist>(`${root(p)}/${id}/transition`, payload)
      .then((r) => r.data),
  history: (p: number, id: number, before_id?: number) =>
    api
      .get<{
        items: {
          id: number;
          operation: string;
          performedById: number;
          createdAt: string;
          changes: object;
        }[];
        next_before_id: number | null;
      }>(`${root(p)}/${id}/history`, { params: { before_id } })
      .then((r) => r.data),
  message: (p: number, id: number, params: object) =>
    api
      .get<{
        text: string;
        total: number;
        included: number;
        sent: boolean;
      }>(`${root(p)}/${id}/message`, { params })
      .then((r) => r.data),
};
export const newTask = (group_id: string, order: number): TaskDefinition => ({
  id: "task_" + crypto.randomUUID().replaceAll("-", ""),
  group_id,
  title: "Nova tarefa",
  order,
  required: true,
  allow_not_applicable: false,
  requires_responsible: false,
  requires_due_date: false,
  requires_notes: false,
  requires_approval: false,
  requires_issue_resolved: false,
});
