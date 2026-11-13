import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { transferableAbortController } from "node:util";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/http";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import type { CurrentUser, Project } from "@/types/api";
import { ProjectsPage } from "./ProjectsPage";
import { ProjectCreatePage } from "./ProjectCreatePage";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  options: vi.fn(),
  organizationsList: vi.fn(),
  organizationGet: vi.fn(),
}));
vi.mock("@/api/endpoints", () => ({
  projectsApi: {
    list: mocks.list,
    create: mocks.create,
    get: mocks.get,
    update: mocks.update,
    options: mocks.options,
  },
  organizationsApi: {
    list: mocks.organizationsList,
    get: mocks.organizationGet,
  },
}));
const project: Project = {
  id: 10,
  organization_id: 1,
  company_id: 3,
  company_name: "Empresa Alpha",
  code: "PRJ-ALPHA",
  name: "Projeto Alpha",
  status: "draft",
  start_date: null,
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};
const permissions = ["projects:read", "projects:create", "projects:update"].map(
  (key) => ({ key, scope: "ORGANIZATION" as const }),
);
const user: CurrentUser = {
  id: 1,
  login: "operador",
  email: "operador@gai.local",
  status: "ACTIVE",
  organization_id: 1,
  permissions,
  role_assignments: [
    {
      assignment_id: 1,
      role_id: 4,
      role_name: "Projetos",
      role_type: "ORGANIZATION",
      organization_id: 1,
      assigned_at: "2026-01-01",
    },
  ],
};
function renderPage(initial = "/app/projects/new", sessionUser = user) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const auth: AuthState = {
    user: sessionUser,
    accessToken: "token",
    expiresAt: "2099-01-01T00:00:00.000Z",
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  const router = createMemoryRouter(
    [
      { path: "/app/projects", element: <ProjectsPage /> },
      { path: "/app/projects/new", element: <ProjectCreatePage /> },
      { path: "/app/dashboard", element: <h1>Dashboard</h1> },
      {
        path: "/app/projects/:id/summary",
        element: <h1>Resumo do projeto</h1>,
      },
    ],
    { initialEntries: [initial] },
  );
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return router;
}
async function fillGeneral() {
  await screen.findByRole("option", { name: "Empresa Alpha" });
  await userEvent.selectOptions(
    screen.getByLabelText("Empresa contratante"),
    "3",
  );
  await userEvent.type(
    screen.getByLabelText("Nome do projeto"),
    "  Projeto Novo  ",
  );
}
async function review() {
  for (let i = 0; i < 3; i++)
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
}
describe("Project registration and management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("AbortController", function () {
      return transferableAbortController();
    });
    mocks.list.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 20,
      total_items: 0,
      total_pages: 0,
      status_counts: {},
    });
    mocks.options.mockImplementation(async (_purpose, params) => ({
      organization_id: params.organization_id || 1,
      items:
        params.resource === "users"
          ? [{ id: 8, name: "Responsável Alpha" }]
          : params.organization_id === 2
            ? [{ id: 4, name: "Empresa Beta" }]
            : [{ id: 3, name: "Empresa Alpha" }],
      page: 1,
      page_size: 20,
      total_items: 1,
      total_pages: 1,
    }));
    mocks.organizationsList.mockResolvedValue({
      items: [
        { id: 1, legal_name: "Organização Alpha" },
        { id: 2, legal_name: "Organização Beta" },
      ],
      page: 1,
      page_size: 20,
      total_items: 2,
      total_pages: 1,
    });
    mocks.organizationGet.mockResolvedValue({
      id: 1,
      legal_name: "Organização Alpha",
    });
    mocks.create.mockResolvedValue(project);
    mocks.get.mockResolvedValue(project);
    mocks.update.mockResolvedValue(project);
  });
  it("creates without client organization and without companies:read, using scoped options", async () => {
    renderPage();
    await fillGeneral();
    expect(
      screen.queryByRole("combobox", { name: "Organização" }),
    ).not.toBeInTheDocument();
    await review();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar projeto" }),
    );
    await screen.findByRole("heading", { name: "Projeto criado" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      name: "Projeto Novo",
      company_id: 3,
    });
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("organization_id");
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("status");
    expect(mocks.options).toHaveBeenCalledWith(
      "create",
      expect.objectContaining({
        organization_id: undefined,
        resource: "companies",
      }),
    );
  });
  it("validates each step and preserves general fields while navigating back", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(await screen.findByText("Selecione a empresa")).toBeInTheDocument();
    await fillGeneral();
    await userEvent.type(
      screen.getByLabelText("Descrição"),
      "Descrição detalhada",
    );
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Nome do projeto")).toHaveValue(
      "  Projeto Novo  ",
    );
    expect(screen.getByLabelText("Descrição")).toHaveValue(
      "Descrição detalhada",
    );
    expect(screen.getByLabelText("Empresa contratante")).toHaveValue("3");
  });
  it("includes planning, type and code in review and payload", async () => {
    renderPage();
    await fillGeneral();
    await userEvent.type(
      screen.getByLabelText("Código do projeto"),
      "inv-2026",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Tipo de projeto"),
      "inventory_valuation",
    );
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await screen.findAllByRole("option", { name: "Responsável Alpha" });
    await userEvent.selectOptions(
      screen.getByLabelText("Responsável pelo projeto"),
      "8",
    );
    await userEvent.type(
      screen.getByLabelText("Observações de planejamento"),
      "Plano de campo",
    );
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(screen.getByText("Empresa Alpha")).toBeInTheDocument();
    expect(screen.getByText("Plano de campo")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar projeto" }),
    );
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "INV-2026",
          project_type: "inventory_valuation",
          responsible_user_id: 8,
          planning_notes: "Plano de campo",
        }),
      ),
    );
  });
  it("blocks inconsistent planned dates", async () => {
    renderPage();
    await fillGeneral();
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.type(
      screen.getByLabelText("Data prevista de início"),
      "2026-11-30",
    );
    await userEvent.type(
      screen.getByLabelText("Data prevista de término"),
      "2026-11-03",
    );
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(
      await screen.findByText("A data final deve ser maior ou igual a inicial"),
    ).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("allows editing new fields, clearing optional fields and keeps tenant/company/status immutable", async () => {
    mocks.get.mockResolvedValue({
      ...project,
      description: "Texto anterior",
      start_date: "2026-01-01",
      end_date: "2026-02-01",
    });
    renderPage("/app/projects?edit=10");
    await screen.findByLabelText("Nome do projeto");
    await userEvent.clear(screen.getByLabelText("Descrição"));
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.clear(screen.getByLabelText("Data prevista de início"));
    await userEvent.clear(screen.getByLabelText("Data prevista de término"));
    await userEvent.type(
      screen.getByLabelText("Observações de planejamento"),
      "Plano revisado",
    );
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    const payload = mocks.update.mock.calls[0][1];
    expect(payload).toMatchObject({
      description: null,
      start_date: null,
      end_date: null,
      planning_notes: "Plano revisado",
    });
    for (const field of ["organization_id", "company_id", "status"])
      expect(payload).not.toHaveProperty(field);
  });
  it("returns field errors to their step without losing entered data", async () => {
    mocks.create.mockRejectedValue(
      new ApiError(409, {
        code: "PROJECT_CODE_ALREADY_EXISTS",
        message: "Código em uso",
        details: [{ field: "code", message: "Informe um código único" }],
      }),
    );
    renderPage();
    await fillGeneral();
    await review();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar projeto" }),
    );
    expect(
      await screen.findByText("Informe um código único"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do projeto")).toHaveValue(
      "  Projeto Novo  ",
    );
  });
  it("handles generic API failures and allows a retry", async () => {
    mocks.create.mockRejectedValueOnce(
      new Error("Servidor temporariamente indisponível"),
    );
    renderPage();
    await fillGeneral();
    await review();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar projeto" }),
    );
    expect(
      await screen.findByText("Servidor temporariamente indisponível"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar projeto" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Projeto criado" }),
    ).toBeInTheDocument();
  });
  it("requires confirmation before discarding and can keep editing", async () => {
    renderPage();
    await fillGeneral();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      await screen.findByRole("heading", { name: "Descartar alterações?" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Cancelar" }).at(-1)!,
    );
    expect(screen.getByLabelText("Nome do projeto")).toHaveValue(
      "  Projeto Novo  ",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByRole("heading", { name: "Projetos" }),
    ).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("prevents double submission while the request is pending", async () => {
    let resolve!: (value: Project) => void;
    mocks.create.mockReturnValue(
      new Promise<Project>((done) => {
        resolve = done;
      }),
    );
    renderPage();
    await fillGeneral();
    await review();
    await userEvent.dblClick(
      screen.getByRole("button", { name: "Criar projeto" }),
    );
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Criar projeto" }),
    ).toBeDisabled();
    resolve(project);
    await screen.findByRole("heading", { name: "Projeto criado" });
  });
  it("clears organization-bound company and responsible selections for PLATFORM_ADMIN", async () => {
    const platform: CurrentUser = {
      ...user,
      organization_id: null,
      role_assignments: [
        {
          assignment_id: 1,
          role_id: 1,
          role_key: "PLATFORM_ADMIN",
          role_name: "Plataforma",
          role_type: "SYSTEM",
          organization_id: null,
          assigned_at: "2026-01-01",
        },
      ],
    };
    renderPage("/app/projects/new", platform);
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(
      await screen.findByText("Selecione a organização"),
    ).toBeInTheDocument();
    await screen.findByRole("option", { name: "Organização Alpha" });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Organização" }),
      "1",
    );
    await fillGeneral();
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.selectOptions(
      await screen.findByLabelText("Responsável pelo projeto"),
      "8",
    );
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Organização" }),
      "2",
    );
    expect(screen.getByLabelText("Empresa contratante")).toHaveValue("");
    await screen.findByRole("option", { name: "Empresa Beta" });
    await userEvent.selectOptions(
      screen.getByLabelText("Empresa contratante"),
      "4",
    );
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    expect(screen.getByLabelText("Responsável pelo projeto")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Criar projeto" }),
    );
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 2,
          company_id: 4,
          responsible_user_id: null,
        }),
      ),
    );
  });
  it("shows real company names, filtered indicators and forwards filter/sort parameters", async () => {
    mocks.list.mockResolvedValue({
      items: [project],
      page: 1,
      page_size: 20,
      total_items: 1,
      total_pages: 1,
      status_counts: { draft: 1 },
    });
    renderPage(
      "/app/projects?search=Alpha&company_id=3&project_type=inventory&sort_by=code&sort_order=ASC",
    );
    expect(await screen.findByText("PRJ-ALPHA")).toBeInTheDocument();
    expect(screen.queryByText("Empresa #3")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Indicadores dos projetos filtrados"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "Alpha",
          organization_id: 1,
          company_id: 3,
          project_type: "inventory",
          sort_by: "code",
          sort_order: "ASC",
        }),
      ),
    );
  });
  it("resets company pagination when the platform administrator changes organization", async () => {
    mocks.options.mockImplementation(async (_purpose, params) => ({
      organization_id: params.organization_id,
      items: [
        {
          id: params.organization_id === 2 ? 4 : 3,
          name: params.organization_id === 2 ? "Empresa Beta" : "Empresa Alpha",
        },
      ],
      page: params.page ?? 1,
      page_size: 20,
      total_items: 40,
      total_pages: 2,
    }));
    const platform: CurrentUser = {
      ...user,
      organization_id: null,
      role_assignments: [
        {
          assignment_id: 1,
          role_id: 1,
          role_key: "PLATFORM_ADMIN",
          role_name: "Plataforma",
          role_type: "SYSTEM",
          organization_id: null,
          assigned_at: "2026-01-01",
        },
      ],
    };
    renderPage("/app/projects/new", platform);
    await screen.findByRole("option", { name: "Organização Alpha" });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Organização" }),
      "1",
    );
    await screen.findByRole("option", { name: "Empresa Alpha" });
    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(mocks.options).toHaveBeenCalledWith(
        "create",
        expect.objectContaining({
          organization_id: 1,
          resource: "companies",
          page: 2,
        }),
      ),
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Organização" }),
      "2",
    );
    await waitFor(() =>
      expect(mocks.options).toHaveBeenCalledWith(
        "create",
        expect.objectContaining({
          organization_id: 2,
          resource: "companies",
          page: 1,
        }),
      ),
    );
  });
  it("keeps terminal projects read-only even when requested directly", async () => {
    mocks.get.mockResolvedValue({ ...project, status: "finished" });
    renderPage("/app/projects?edit=10");
    expect(
      await screen.findByText(/somente para consulta/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome do projeto")).not.toBeInTheDocument();
  });
  it("keeps scoped options errors visible and recoverable", async () => {
    mocks.options.mockRejectedValueOnce(new Error("Sem conexão"));
    renderPage();
    expect(
      await screen.findByText(/Não foi possível carregar as opções/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    expect(
      await screen.findByRole("option", { name: "Empresa Alpha" }),
    ).toBeInTheDocument();
  });
});
