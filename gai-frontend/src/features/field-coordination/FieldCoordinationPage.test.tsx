import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { ProjectLayout } from "@/features/projects/ProjectLayout";
import type { CurrentUser } from "@/types/api";
import {
  fieldApi,
  type Checklist,
  type Dashboard,
  type Task,
  type Context,
} from "./fieldApi";
import { FieldCoordinationPage } from "./FieldCoordinationPage";
const definition = {
  id: "task",
  group_id: "third",
  title: "Verificar campo",
  order: 0,
  required: true,
  allow_not_applicable: true,
  requires_responsible: true,
  requires_due_date: true,
  requires_notes: true,
  requires_approval: true,
  requires_issue_resolved: false,
};
const row: Checklist = {
  id: 9,
  projectId: 2,
  organizationId: 1,
  title: "Campo sintético",
  snapshot: {
    name: "Modelo teste",
    version: 1,
    groups: [
      { id: "third", title: "Terceira etapa", order: 3, required: false },
    ],
    tasks: [definition],
  },
  revision: 7,
  status: "open",
  completedAt: null,
  completedById: null,
};
const task: Task = {
  id: 11,
  stableId: "task",
  groupId: "third",
  title: "Verificar campo",
  definition,
  required: true,
  applicable: true,
  state: "pending",
  priority: "normal",
  responsibleUserId: null,
  fieldAgentId: null,
  startDate: null,
  dueDate: null,
  completedAt: null,
  notes: null,
  reason: null,
  linkedIssueId: null,
  hasLinkedIssue: false,
  approvedById: null,
  issue: null,
};
const context: Context = {
  project: {
    id: 2,
    name: "Projeto sintético",
    organizationId: 1,
    status: "active",
  },
  items: [{ id: 2, name: "org.admin", kind: "user" }],
  total: 1,
  page: 1,
  page_size: 20,
};
const dashboard: Dashboard = {
  checklist: row,
  groups: [
    {
      ...row.snapshot.groups[0],
      total: 1,
      completed: 0,
      notApplicable: 0,
      pending: 1,
      blocked: 0,
      overdue: 0,
      percent: 0,
    },
  ],
  responsibles: [
    {
      userId: null,
      fieldAgentId: null,
      userName: null,
      agentName: null,
      total: 1,
      completed: 0,
    },
  ],
  summary: {
    groups: 1,
    groupsCompleted: 0,
    groupsPending: 1,
    groupsNotApplicable: 0,
    total: 1,
    completed: 0,
    notApplicable: 0,
    pending: 1,
    blocked: 0,
    overdue: 0,
    conditionallyExcluded: 0,
    percent: 0,
    linkedIssues: 0,
    denominator: "Todas as tarefas aplicáveis; bloqueadas não concluem.",
  },
};
function setup(keys = ["read", "edit", "coordinate"]) {
  const user: CurrentUser = {
    id: 2,
    login: "org.admin",
    email: "orgadmin@gai.local",
    status: "ACTIVE",
    organization_id: 1,
    role_assignments: [],
    permissions: [
      ...keys.map((key) => ({
        key: "field-coordination:" + key,
        scope: "ORGANIZATION" as const,
      })),
      { key: "projects:read", scope: "ORGANIZATION" },
      { key: "inventory-items:read", scope: "ORGANIZATION" },
    ],
  };
  const auth: AuthState = {
    user,
    accessToken: "synthetic",
    expiresAt: "2099-01-01",
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/app/projects/2/field-coordination"]}>
          <Routes>
            <Route path="/app/projects/:projectId" element={<ProjectLayout />}>
              <Route
                path="field-coordination"
                element={<FieldCoordinationPage />}
              />
              <Route
                path="inventory-items"
                element={<h1>Itens do mesmo projeto</h1>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(fieldApi, "context").mockResolvedValue(context);
  vi.spyOn(fieldApi, "list").mockResolvedValue({
    items: [row],
    total: 1,
    page: 1,
    page_size: 20,
  });
  vi.spyOn(fieldApi, "dashboard").mockResolvedValue(structuredClone(dashboard));
  vi.spyOn(fieldApi, "tasks").mockResolvedValue({
    items: [task],
    total: 1,
    page: 1,
    page_size: 20,
    revision: 7,
  });
  vi.spyOn(fieldApi, "templates").mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
  });
  vi.spyOn(fieldApi, "readiness").mockResolvedValue({
    can_complete: true,
    revision: 7,
    blockers: [],
  });
  vi.spyOn(fieldApi, "task").mockResolvedValue({ revision: 8 });
  vi.spyOn(fieldApi, "transition").mockResolvedValue({
    ...row,
    status: "completed",
    revision: 8,
  });
  vi.spyOn(fieldApi, "message").mockResolvedValue({
    text: "Orientação autorizada. Nenhuma mensagem foi enviada.",
    total: 1,
    included: 1,
    sent: false,
  });
});
describe("Field coordination UI", () => {
  it("uses server KPIs, renders all stages and navigates back to another workspace area without losing the bar", async () => {
    setup();
    expect(
      (await screen.findAllByText("Terceira etapa")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Verificar campo")).toBeInTheDocument();
    expect(screen.getByText(/Todas as tarefas aplicáveis/)).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Abas do projeto" });
    await userEvent.click(within(nav).getByRole("link", { name: "Itens" }));
    expect(
      await screen.findByRole("heading", { name: "Itens do mesmo projeto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Abas do projeto" })).toBe(
      nav,
    );
  });
  it("keeps read-only profiles from creation, task editing and coordination actions", async () => {
    setup(["read"]);
    await screen.findByText("Verificar campo");
    expect(
      screen.queryByRole("button", { name: "Nova tarefa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Validar conclusão de campo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Iniciar checklist de campo" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Consultar tarefa" }),
    );
    expect(
      screen.queryByRole("button", { name: "Salvar tarefa" }),
    ).not.toBeInTheDocument();
  });
  it("saves typed state, distinct user ID, due date and notes with the aggregate revision", async () => {
    setup();
    await userEvent.click(
      await screen.findByRole("button", { name: "Abrir tarefa" }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Estado da tarefa"),
      "completed",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Responsável pela tarefa"),
      "2",
    );
    await userEvent.type(
      screen.getByLabelText("Prazo da tarefa"),
      "2026-10-30",
    );
    await userEvent.type(
      screen.getByLabelText("Observações da tarefa"),
      "Conferido",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar tarefa" }),
    );
    await waitFor(() =>
      expect(fieldApi.task).toHaveBeenCalledWith(
        2,
        9,
        11,
        expect.objectContaining({
          revision: 7,
          state: "completed",
          responsible_user_id: 2,
          field_agent_id: null,
          due_date: "2026-10-30",
          notes: "Conferido",
        }),
      ),
    );
  });
  it("shows structured mandatory blockers and disables completion instead of assuming the first two groups are done", async () => {
    vi.mocked(fieldApi.readiness).mockResolvedValue({
      can_complete: false,
      revision: 7,
      blockers: [
        {
          task_id: 11,
          stable_id: "task",
          group_id: "third",
          code: "TASK_PENDING",
          message: "Terceira etapa ainda pendente",
        },
      ],
    });
    setup();
    await userEvent.click(
      await screen.findByRole("button", { name: "Validar conclusão de campo" }),
    );
    expect(
      await screen.findByText(/Terceira etapa ainda pendente/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar conclusão" }),
    ).toBeDisabled();
    expect(fieldApi.transition).not.toHaveBeenCalled();
  });
  it("requires explicit review and confirmation, sends an idempotent completion command", async () => {
    setup();
    await userEvent.click(
      await screen.findByRole("button", { name: "Validar conclusão de campo" }),
    );
    await screen.findByText("Sem impedimentos de tarefas obrigatórias.");
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar conclusão" }),
    );
    await waitFor(() =>
      expect(fieldApi.transition).toHaveBeenCalledWith(
        2,
        9,
        expect.objectContaining({
          revision: 7,
          action: "complete",
          command_key: expect.any(String),
        }),
      ),
    );
  });
  it("does not generate or send a message on opening; shows text before copying", async () => {
    setup();
    await userEvent.click(
      await screen.findByRole("button", { name: "Prévia de mensagem" }),
    );
    expect(fieldApi.message).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Copiar prévia revisada" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
    expect(await screen.findByLabelText("Mensagem para revisão")).toHaveValue(
      "Orientação autorizada. Nenhuma mensagem foi enviada.",
    );
    expect(
      screen.getByRole("button", { name: "Copiar prévia revisada" }),
    ).toBeVisible();
  });
  it("surfaces server errors without inventing persisted task state", async () => {
    vi.mocked(fieldApi.dashboard).mockRejectedValue(
      new Error("FORBIDDEN escopo"),
    );
    setup();
    expect(await screen.findByText("FORBIDDEN escopo")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nova tarefa" }),
    ).not.toBeInTheDocument();
  });
});
