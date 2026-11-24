import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { projectsApi } from "@/api/endpoints";
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
function setup(keys = ["read", "edit", "coordinate"], extra: string[] = []) {
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
      ...extra.map((key) => ({ key, scope: "ORGANIZATION" as const })),
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
                path="summary"
                element={<h1>Resumo do mesmo projeto</h1>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
// O layout do projeto busca o painel (e a tela, o cadastro). Sem simulação, a
// busca ia por HTTP real à origem do jsdom (localhost:3000) e o resultado
// dependia do que estivesse rodando ali. Mesmo efeito do CI, sem rede:
const offline = () => Promise.reject(new Error("sem rede no teste"));
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(projectsApi, "dashboard").mockImplementation(offline);
  vi.spyOn(projectsApi, "get").mockImplementation(offline);
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
  it("marca sub atividade em um clique, mostra n/m por seção e o selo Check list 100% como no sistema anterior", async () => {
    vi.mocked(fieldApi.list).mockResolvedValue({
      items: [
        row,
        {
          ...row,
          id: 10,
          title: "Campo concluído",
          status: "completed",
          completedAt: "2026-11-20T12:00:00.000Z",
        },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    });
    setup();
    const [list] = await screen.findAllByRole("region", {
      name: "Check lists de campo",
    });
    expect(list).toHaveTextContent("Campo concluído");
    expect(list).toHaveTextContent("Check list 100%");
    expect(
      await screen.findByText("Sub atividades concluídas"),
    ).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Concluída: Verificar campo" }),
    );
    await waitFor(() =>
      expect(fieldApi.task).toHaveBeenCalledWith(2, 9, 11, {
        revision: 7,
        state: "completed",
      }),
    );
    // A busca avançada (filtros do GAI) fica recolhida até ser aberta.
    expect(screen.queryByLabelText("Filtrar etapa")).not.toBeInTheDocument();
    const [advanced] = screen.getAllByRole("region", {
      name: /Busca avançada de tarefas/,
    });
    await userEvent.click(within(advanced).getByRole("button", { name: "Mostrar" }));
    expect(screen.getByLabelText("Filtrar etapa")).toBeInTheDocument();
  });
  it("cria o modelo de referência com as 4 seções do check list de campo", async () => {
    vi.spyOn(fieldApi, "saveTemplate").mockResolvedValue({
      id: 3,
      name: "x",
      description: null,
      currentVersion: 1,
      archivedAt: null,
      definition: { groups: [], tasks: [] },
    });
    vi.spyOn(fieldApi, "template").mockResolvedValue({
      id: 3,
      name: "x",
      description: null,
      currentVersion: 1,
      archivedAt: null,
      definition: { groups: [], tasks: [] },
    });
    setup();
    await userEvent.click(
      await screen.findByRole("button", { name: "Modelos de campo" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Novo modelo de referência" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Salvar|Publicar/ }),
    );
    await waitFor(() => expect(fieldApi.saveTemplate).toHaveBeenCalled());
    const payload = vi.mocked(fieldApi.saveTemplate).mock.calls[0][1] as {
      definition: { groups: { title: string }[]; tasks: unknown[] };
    };
    expect(payload.definition.groups.map((g) => g.title)).toEqual([
      "COORDENAÇÃO PROJETO",
      "COORDENAÇÃO CAMPO",
      "COORDENAÇÃO CAMPO - EQUIPE",
      "PRIORIDADE DIÁRIA",
    ]);
    expect(payload.definition.tasks).toHaveLength(23);
  });
  it("uses server KPIs, renders all stages and navigates to another screen of the area without losing the bar", async () => {
    setup(undefined, ["project-field-agents:read"]);
    expect(
      (await screen.findAllByText("1 · Terceira etapa")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Verificar campo")).toBeInTheDocument();
    expect(screen.getByText(/Todas as tarefas aplicáveis/)).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Abas do projeto" });
    // A barra do projeto lista só as telas da sub-aba Pendências - Campo.
    const screens = within(nav).getByRole("group", {
      name: "Telas de Pendências - Campo",
    });
    expect(
      within(screens).getByRole("link", { name: "Check list - Campo" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).queryByRole("link", { name: "Itens inventariados" }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: "Trocar projeto" }),
    ).toHaveAttribute("href", "/app/projects/field?escolher=1");
    await userEvent.click(
      within(screens).getByRole("link", { name: "Equipe de campo" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Resumo do mesmo projeto" }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: "Equipe de campo" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Abas do projeto" })).toBe(
      nav,
    );
    await userEvent.click(
      within(nav).getByRole("link", { name: "Check list - Campo" }),
    );
    expect(await screen.findByText("Verificar campo")).toBeInTheDocument();
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
  it("mostra o nome de quem concluiu e de quem fez cada ação, nunca o ID", async () => {
    vi.mocked(fieldApi.dashboard).mockResolvedValue({
      ...structuredClone(dashboard),
      checklist: {
        ...row,
        status: "completed",
        completedAt: "2026-11-10T12:00:00.000Z",
        completedById: 5,
        completedByName: "Carla Coordenadora",
      },
    });
    vi.spyOn(fieldApi, "history").mockResolvedValue({
      items: [
        {
          id: 1,
          operation: "transition",
          performedById: 5,
          performedByName: "Carla Coordenadora",
          createdAt: "2026-11-10T12:00:00.000Z",
          changes: {},
        },
        {
          id: 2,
          operation: "transition",
          performedById: 8,
          performedByName: null,
          createdAt: "2026-11-09T12:00:00.000Z",
          changes: {},
        },
      ],
      next_before_id: null,
    });
    setup();
    expect(
      await screen.findByText(/Concluído · .* · Carla Coordenadora/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Histórico de campo" }),
    );
    const panel = within(await screen.findByRole("dialog"));
    expect(await panel.findByText(/Carla Coordenadora/)).toBeInTheDocument();
    expect(panel.getByText(/Usuário removido/)).toBeInTheDocument();
    expect(screen.queryByText(/#5|#8/)).not.toBeInTheDocument();
  });
});
