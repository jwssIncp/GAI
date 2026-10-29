import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { ProjectLayout } from "@/features/projects/ProjectLayout";
import { ProjectContractsPage } from "./ProjectContractsPage";
import { type ContractDetail } from "./contractsApi";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
  amend: vi.fn(),
  archive: vi.fn(),
  project: vi.fn(),
}));
vi.mock("./contractsApi", async (original) => ({
  ...(await original<object>()),
  contractsApi: mocks,
}));
vi.mock("@/api/endpoints", () => ({ projectsApi: { get: mocks.project } }));
const row: ContractDetail = {
  id: 3,
  projectId: 7,
  revision: 2,
  data: {
    number: "SINTETICO-3",
    company_id: 1,
    company_name: "Empresa de teste",
    company_state: "SP",
    contracted_on: "2024-01-10",
    starts_on: "2024-01-10",
    ends_on: "2029-12-31",
    original_value: "100.10",
    current_value: "100.30",
    current_ends_on: "2029-12-31",
    current_scope: "Escopo teste",
    currency: "BRL",
    contracting_type: "Serviço",
    segment: "Indústria",
    commercial_origin: null,
    recurring: true,
    services: ["Inventário"],
    estimated_assets: 100,
    scope: "Escopo teste",
    commercial_terms: null,
    status: "active",
  },
  amendments: [],
  versions: [],
};
function mount(
  grants = [
    "projects:read",
    "contracts:read",
    "contracts:edit",
    "contracts:amend",
    "contracts:archive",
  ],
  path = "/app/projects/7/contracts?contract=3",
) {
  const auth = {
    user: {
      id: 2,
      organization_id: 1,
      permissions: grants.map((key) => ({ key, scope: "ORGANIZATION" })),
    },
    bootstrapping: false,
  } as AuthState;
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId" element={<ProjectLayout />}>
              <Route path="contracts" element={<ProjectContractsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
describe("Project contract workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.project.mockResolvedValue({
      id: 7,
      company_id: 1,
      name: "Projeto de teste",
      status: "active",
    });
    mocks.list.mockResolvedValue([row]);
    mocks.get.mockResolvedValue(row);
    mocks.amend.mockResolvedValue({});
    mocks.create.mockResolvedValue(row);
  });
  it("restores the selected contract from URL with originals/current and keeps shared project navigation", async () => {
    mount();
    expect(
      await screen.findByText("Contrato SINTETICO-3 · versão 2"),
    ).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(7, 3);
    expect(screen.getByText("R$ 100,10")).toBeInTheDocument();
    expect(screen.getByText("R$ 100,30")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("navigation", { name: "Abas do projeto" }),
      ).getByRole("link", { name: "Contratos" }),
    ).toHaveAttribute("aria-current", "page");
  });
  it("sends explicit amendment revision, decimal delta, date and justification", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      await screen.findByRole("button", { name: "Registrar aditivo" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Identificador do aditivo"),
      "AD-2",
    );
    await user.type(
      within(dialog).getByLabelText("Data do aditivo"),
      "2026-10-27",
    );
    await user.type(within(dialog).getByLabelText(/Variação de valor/), "0.20");
    await user.type(
      within(dialog).getByLabelText("Justificativa"),
      "Ajuste sintético",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar aditivo" }),
    );
    await waitFor(() =>
      expect(mocks.amend).toHaveBeenCalledWith(
        7,
        3,
        expect.objectContaining({
          revision: 2,
          identifier: "AD-2",
          value_delta: "0.20",
          dated_on: "2026-10-27",
          reason: "Ajuste sintético",
        }),
      ),
    );
  });
  it("hides mutation controls for read-only grants while retaining original/history data", async () => {
    mount(["projects:read", "contracts:read"]);
    await screen.findByText("Contrato SINTETICO-3 · versão 2");
    expect(
      screen.queryByRole("button", { name: "Novo contrato" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar contrato" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar aditivo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Histórico de versões")).toBeInTheDocument();
  });
  it("sends absent commercial attributes as null for a new draft and preserves cents as strings", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      await screen.findByRole("button", { name: "Novo contrato" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Número do contrato"),
      "NOVO-1",
    );
    await user.type(within(dialog).getByLabelText("Valor original"), "0.10");
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar contrato" }),
    );
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          number: "NOVO-1",
          company_id: 1,
          original_value: "0.10",
          contracted_on: null,
          recurring: null,
          estimated_assets: null,
          status: "draft",
          services: [],
        }),
      ),
    );
  });
});
