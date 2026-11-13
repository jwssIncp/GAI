import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { FieldAgentsPage } from "./FieldAgentsPage";
import { batchDescription } from "./fieldAgentBatch";
import type { CurrentUser, FieldAgent, PaginatedItems } from "@/types/api";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  create: vi.fn(),
  context: vi.fn(),
  agentProjects: vi.fn(),
  financialUsage: vi.fn(),
  batchDelete: vi.fn(),
  exportFile: vi.fn(),
  projectsList: vi.fn(),
}));

vi.mock("@/api/endpoints", () => ({
  fieldAgentsApi: {
    list: mocks.list,
    summary: mocks.summary,
    create: mocks.create,
    context: mocks.context,
    projects: mocks.agentProjects,
    financialUsage: mocks.financialUsage,
    batchDelete: mocks.batchDelete,
    exportFile: mocks.exportFile,
  },
  projectFieldAgentsApi: { assign: vi.fn() },
  projectsApi: { list: mocks.projectsList },
}));

function orgUser(permissions: string[]): CurrentUser {
  return {
    id: 1,
    login: "teste",
    email: "teste@gai.local",
    status: "ACTIVE",
    organization_id: 1,
    role_assignments: [],
    permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" as const })),
  };
}

const agents: FieldAgent[] = [
  { id: 1, organization_id: 1, name: "Ana", state: "SP", status: "active", created_at: "2026-01-01", updated_at: "2026-01-01" },
  { id: 2, organization_id: 1, name: "Bruno", state: "RJ", status: "active", created_at: "2026-01-01", updated_at: "2026-01-01" },
];
const page = (items: FieldAgent[]): PaginatedItems<FieldAgent> => ({
  items,
  page: 1,
  page_size: 20,
  total_items: items.length,
  total_pages: 1,
});

function renderPage(user: CurrentUser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, bootstrapping: false } as AuthState}>
        <MemoryRouter>
          <FieldAgentsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Inventariantes: paridade financeira (etapa 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page(agents));
    mocks.summary.mockResolvedValue({ total: 12, states_count: 4, without_state: 3, states: [] });
    mocks.context.mockResolvedValue({ organization_id: 1, organization_name: "Org" });
    mocks.agentProjects.mockResolvedValue(page([]) as never);
    mocks.projectsList.mockResolvedValue({
      items: [
        { id: 10, organization_id: 1, name: "Projeto Aberto", status: "active", created_at: "", updated_at: "" },
        { id: 11, organization_id: 1, name: "Projeto Concluído", status: "finished", created_at: "", updated_at: "" },
      ],
      page: 1,
      page_size: 100,
      total_items: 2,
      total_pages: 1,
    });
  });

  it("mostra os KPIs: total, UFs e exibidos", async () => {
    renderPage(orgUser(["field-agents:read"]));
    const kpis = within(await screen.findByRole("region", { name: "Indicadores de inventariantes" }));
    await waitFor(() => expect(kpis.getByText("12")).toBeInTheDocument());
    expect(kpis.getByText("4")).toBeInTheDocument();
    expect(kpis.getByText("3 sem UF informada")).toBeInTheDocument();
    expect(kpis.getByText("2")).toBeInTheDocument();
  });

  it("mostra a coluna UF e filtra por UF", async () => {
    renderPage(orgUser(["field-agents:read"]));
    expect(await screen.findByRole("columnheader", { name: "UF" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "SP" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Criado em" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Ações" })).toHaveClass("md:sticky", "md:right-0");
    expect(screen.getByRole("columnheader", { name: "Documento" })).toHaveClass("whitespace-nowrap");
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por UF"), "RJ");
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ state: "RJ", page: 1 })),
    );
  });

  it("exporta a lista com os mesmos filtros, só com a permissão de exportar", async () => {
    mocks.exportFile.mockResolvedValue(new Blob(["x"]));
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { unmount } = renderPage(orgUser(["field-agents:read"]));
    await screen.findByText("Ana");
    expect(screen.queryByRole("button", { name: /exportar excel/i })).not.toBeInTheDocument();
    unmount();
    renderPage(orgUser(["field-agents:read", "field-agents:export"]));
    await userEvent.selectOptions(await screen.findByLabelText("Filtrar por UF"), "SP");
    await userEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
    await waitFor(() =>
      expect(mocks.exportFile).toHaveBeenCalledWith(expect.objectContaining({ state: "SP", deletion: "current" })),
    );
    expect(mocks.exportFile.mock.calls[0][0]).not.toHaveProperty("page");
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it("exclui em lote com aviso dos lançamentos e só com a permissão de excluir", async () => {
    const { unmount } = renderPage(orgUser(["field-agents:read"]));
    await screen.findByText("Ana");
    expect(screen.queryByLabelText("Selecionar Ana")).not.toBeInTheDocument();
    unmount();

    mocks.financialUsage.mockResolvedValue([
      { id: 1, name: "Ana", payments: 2, expenses: 1 },
      { id: 2, name: "Bruno", payments: 0, expenses: 0 },
    ]);
    mocks.batchDelete.mockResolvedValue({
      deleted: 1,
      failed: 1,
      results: [
        { id: 1, deleted: true },
        { id: 2, deleted: false, message: "Field agent is already deleted" },
      ],
    });
    renderPage(orgUser(["field-agents:read", "field-agents:delete"]));
    await userEvent.click(await screen.findByLabelText("Selecionar todos desta página"));
    expect(screen.getByRole("status")).toHaveTextContent("2 selecionado(s)");
    await userEvent.click(screen.getByRole("button", { name: /excluir selecionados/i }));
    expect(mocks.financialUsage).toHaveBeenCalledWith([1, 2]);
    expect(await screen.findByText(/Ana: 2 diária\(s\) e 1 despesa\(s\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));
    await waitFor(() => expect(mocks.batchDelete).toHaveBeenCalledWith([1, 2]));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "1 inventariante(s) excluído(s). Lançamentos e histórico preservados. Não excluídos: #2: Field agent is already deleted.",
    );
  });

  it("cadastra já com UF e projetos marcados, numa única chamada (bug do INVESTOR não replicado)", async () => {
    mocks.create.mockResolvedValue(agents[0]);
    renderPage(
      orgUser(["field-agents:read", "field-agents:create", "project-field-agents:assign", "projects:read"]),
    );
    await userEvent.click(await screen.findByRole("button", { name: /novo inventariante/i }));
    await userEvent.type(screen.getByLabelText("Nome"), "Carla Souza");
    await userEvent.selectOptions(screen.getByLabelText("UF"), "MG");
    await userEvent.click(await screen.findByLabelText("Projeto Aberto"));
    expect(screen.queryByLabelText("Projeto Concluído")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /salvar inventariante/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "Carla Souza", state: "MG", project_ids: [10] }),
    );
  });

  it("sem permissão de vincular, o cadastro não oferece projetos", async () => {
    renderPage(orgUser(["field-agents:read", "field-agents:create"]));
    await userEvent.click(await screen.findByRole("button", { name: /novo inventariante/i }));
    expect(screen.queryByText("Projetos vinculados")).not.toBeInTheDocument();
    expect(mocks.projectsList).not.toHaveBeenCalled();
  });
});

describe("Aviso da exclusão em lote", () => {
  it("diz quando nenhum cadastro tem lançamentos", () => {
    expect(batchDescription(2, [{ id: 1, name: "Ana", payments: 0, expenses: 0 }])).toContain(
      "Nenhum deles tem diárias ou despesas lançadas.",
    );
  });
  it("lista os cadastros com lançamentos, que continuam nos projetos", () => {
    expect(
      batchDescription(3, [
        { id: 1, name: "Ana", payments: 1, expenses: 0 },
        { id: 2, name: "Bia", payments: 0, expenses: 4 },
      ]),
    ).toContain("Atenção: 2 deles têm lançamentos, que continuam nos projetos (Ana: 1 diária(s) e 0 despesa(s); Bia: 0 diária(s) e 4 despesa(s)).");
  });
});
