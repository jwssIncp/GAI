import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { BudgetForm } from "./BudgetForm";
import { snapshot } from "./budgetTestFixture";
const mocks = vi.hoisted(() => ({
  pricing: vi.fn(),
  simulate: vi.fn(),
  save: vi.fn(),
  project: vi.fn(),
  company: vi.fn(),
  users: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/api/http", () => ({ api: { get: mocks.get } }));
vi.mock("./budgetApi", async (original) => ({
  ...(await original<object>()),
  budgetApi: { pricing: mocks.pricing, simulate: mocks.simulate },
}));
vi.mock("@/api/endpoints", () => ({
  companiesApi: { get: mocks.company },
  companyUnitsApi: { get: vi.fn() },
}));
vi.mock("@/features/projects/ProjectSelectors", () => ({
  CompanySelect: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      aria-label="Empresa"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Selecione</option>
      <option value="1">Empresa sintética</option>
    </select>
  ),
  CompanyUnitSelect: () => null,
  OrganizationSelect: () => null,
}));
function mount(config = true, extra: string[] = []) {
  const auth = {
    user: {
      id: 2,
      login: "org.admin",
      organization_id: 1,
      permissions: [
        "budgets:read",
        "budgets:edit",
        "companies:read",
        ...(config ? ["budgets:configure-prices"] : []),
        ...extra,
      ].map((key) => ({ key, scope: "ORGANIZATION" })),
    },
    bootstrapping: false,
  } as AuthState;
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AuthContext.Provider value={auth}>
        <BudgetForm onSave={mocks.save} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
async function fill() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Empresa"), "1");
  await user.type(screen.getByLabelText("Número do orçamento"), "TESTE-1");
  await user.type(screen.getByLabelText("Validade da proposta"), "2029-12-31");
  await user.type(screen.getByLabelText("Quantidade estimada de bens"), "100");
  await user.type(screen.getByLabelText("Escopo"), "Escopo sintético");
  await user.selectOptions(screen.getByLabelText("Parâmetros de preços"), "5");
  await user.type(screen.getByLabelText("Primeiro vencimento"), "2027-01-31");
  return user;
}
describe("Budget form with authoritative server calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pricing.mockResolvedValue([
      {
        id: 5,
        name: "SINTETICO Preços",
        version: 1,
        validFrom: "2026-01-01",
        validTo: "2029-12-31",
      },
    ]);
    mocks.company.mockResolvedValue({ id: 1, name: "Empresa sintética" });
    mocks.save.mockResolvedValue({ id: 1 });
    mocks.simulate.mockResolvedValue(snapshot);
  });
  it("saves a standalone budget with explicit references and without a frontend price", async () => {
    mount();
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 1,
          project_id: null,
          pricing_id: 5,
          responsible_id: 2,
          estimated_assets: 100,
          sizing: {},
          payment: { mode: "equal", count: 1, first_due_on: "2027-01-31" },
        }),
        "",
        "",
      ),
    );
  });
  it("displays the official backend preview and removes it after an input changes", async () => {
    mount();
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Calcular prévia" }));
    expect(await screen.findByText("Preço final")).toBeInTheDocument();
    expect(mocks.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ estimated_assets: 100 }),
    );
    await user.type(screen.getByLabelText("Quantidade estimada de bens"), "1");
    expect(screen.queryByText("Preço final")).not.toBeInTheDocument();
  });
  it("does not expose manual pricing adjustments without configuration permission", async () => {
    mount(false);
    await screen.findByRole("option", { name: /SINTETICO Preços/ });
    expect(
      screen.queryByLabelText("Preço final manual (R$)"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Equipe ajustada")).not.toBeInTheDocument();
  });
  it("surfaces backend validation without inventing a calculation on failure", async () => {
    mocks.simulate.mockRejectedValue(new Error("Saldo não fecha em centavos"));
    mount();
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Calcular prévia" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Saldo não fecha em centavos",
    );
    expect(screen.queryByText("Preço final")).not.toBeInTheDocument();
  });
  it("chooses the responsible by name with server search among active users", async () => {
    const people = [
      { id: 2, full_name: "Ana Admin", login: "org.admin", email: "a@x" },
      { id: 7, full_name: "Bruno Lima", login: "bruno", email: "b@x" },
    ];
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      const one = url.match(/^\/users\/(\d+)$/);
      if (one) return Promise.resolve({ data: people.find((p) => p.id === Number(one[1])) });
      if (url === "/users") {
        const q = String(config?.params?.search ?? "").toLowerCase();
        return Promise.resolve({
          data: {
            data: people.filter((p) => !q || p.full_name.toLowerCase().includes(q)),
            meta: { total_pages: 1 },
          },
        });
      }
      return Promise.reject(new Error("rota inesperada " + url));
    });
    mount(true, ["users:read"]);
    const box = screen.getByRole("combobox", { name: "Responsável" });
    await waitFor(() => expect(box).toHaveValue("Ana Admin (org.admin)"));
    const user = await fill();
    await user.click(box);
    await user.type(box, "bru");
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        "/users",
        expect.objectContaining({
          params: expect.objectContaining({ search: "bru", status: "ACTIVE", organization_id: 1 }),
        }),
      ),
    );
    await user.click(await screen.findByRole("option", { name: /^Bruno Lima \(bruno\)/ }));
    expect(box).toHaveValue("Bruno Lima (bruno)");
    await user.click(screen.getByRole("button", { name: "Salvar orçamento" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({ responsible_id: 7 }),
        "",
        "",
      ),
    );
  });
  it("keeps the current user as responsible without users:read and never shows the organization ID", () => {
    mount();
    expect(screen.queryByRole("combobox", { name: "Responsável" })).not.toBeInTheDocument();
    expect(screen.getByText(/Responsável:/)).toHaveTextContent("org.admin");
    expect(screen.queryByText(/Organização #/)).not.toBeInTheDocument();
  });
});
