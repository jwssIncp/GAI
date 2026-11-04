import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { BudgetLayout } from "./BudgetLayout";
import { BudgetDetailPage } from "./BudgetDetailPage";
import { BudgetPricingPage } from "./BudgetPricingPage";
import { budgetFixture, snapshot } from "./budgetTestFixture";
const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  proposal: vi.fn(),
  pricing: vi.fn(),
  transition: vi.fn(),
}));
vi.mock("./budgetApi", async (original) => ({
  ...(await original<object>()),
  budgetApi: {
    detail: mocks.detail,
    proposal: mocks.proposal,
    pricing: mocks.pricing,
    transition: mocks.transition,
  },
}));
vi.mock("./BudgetForm", () => ({ BudgetForm: () => null }));
function mount(
  grants = [
    "budgets:read",
    "budgets:edit",
    "budgets:configure-prices",
    "budgets:approve",
  ],
  path = "/app/budgets/1",
) {
  const auth = {
    user: {
      id: 2,
      organization_id: 1,
      permissions: grants.map((key) => ({ key, scope: "ORGANIZATION" })),
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
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/budgets" element={<BudgetLayout />}>
              <Route path=":budgetId" element={<BudgetDetailPage />} />
              <Route path="pricing" element={<BudgetPricingPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
describe("Budget navigation uses real nested pages and version selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.detail.mockResolvedValue(budgetFixture);
    mocks.pricing.mockResolvedValue([]);
    mocks.transition.mockResolvedValue({});
  });
  it("preserves project and list filters through pricing and return links", async () => {
    mount(["budgets:read"], "/app/budgets/1?project_id=25&status=approved&page=2&tab=payments&version=11");
    await screen.findByText("31/01/2027");
    expect(screen.getByRole("link", { name: "Parâmetros de preços" })).toHaveAttribute("href", "/app/budgets/pricing?project_id=25&status=approved&page=2");
    expect(screen.getByRole("link", { name: "Voltar aos orçamentos" })).toHaveAttribute("href", "/app/budgets?project_id=25&status=approved&page=2");
    expect(screen.getByRole("link", { name: "Histórico" }).getAttribute("href")).toContain("project_id=25");
  });
  it("navigates continuously through memory, payments, history, scenario comparison and organization pricing", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("Preço final");
    await user.click(screen.getByRole("link", { name: "Pagamento" }));
    expect(await screen.findByText("31/01/2027")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Histórico" }));
    expect(
      await screen.findByRole("heading", { name: "Histórico de versões" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Comparar cenários" }));
    await user.click(
      await screen.findByRole("button", { name: "v1 · Versão inicial" }),
    );
    expect(await screen.findByText("Preço final")).toBeInTheDocument();
    await user.click(
      screen.getByRole("link", { name: "Parâmetros de preços" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Parâmetros de precificação",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegação de orçamentos" }),
    ).toBeInTheDocument();
  });
  it("restores a direct version/payment URL and hides mutations for read-only roles", async () => {
    mount(["budgets:read"], "/app/budgets/1?tab=payments&version=11");
    expect(await screen.findByText("31/01/2027")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pagamento" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("button", { name: "Novo cenário" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar em nova versão" }),
    ).not.toBeInTheDocument();
  });
  it("submits a revision and the chosen immutable version for review", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      await screen.findByRole("button", {
        name: "Enviar versão selecionada para revisão",
      }),
    );
    await user.type(
      screen.getByLabelText("Justificativa"),
      "Revisão sintética autorizada",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar alteração" }),
    );
    await waitFor(() =>
      expect(mocks.transition).toHaveBeenCalledWith(1, {
        revision: 1,
        status: "review",
        version_id: 11,
        reason: "Revisão sintética autorizada",
      }),
    );
  });
  it("shows a published-parameter form with blank commercial inputs", async () => {
    const user = userEvent.setup();
    mount(["budgets:read", "budgets:configure-prices"], "/app/budgets/pricing");
    await user.click(
      await screen.findByRole("button", { name: "Publicar parâmetros" }),
    );
    expect(screen.getByLabelText("Diária técnica")).toHaveValue("");
    expect(screen.getByLabelText("Impostos (%)")).toHaveValue("");
    expect(
      screen.getByLabelText("Produtividade diária por profissional"),
    ).toHaveValue(null);
  });
  it("uses only the approved server proposal when previewing an approved budget", async () => {
    mocks.detail.mockResolvedValue({
      ...budgetFixture,
      status: "approved",
      approvedVersionId: 11,
    });
    mocks.proposal.mockResolvedValue({
      budget_id: 1,
      number: budgetFixture.number,
      version: 1,
      hash: "a",
      company: snapshot.context.company,
      project: null,
      scope: snapshot.input.scope,
      services: ["Inventário"],
      assets: 100,
      units: [],
      addresses: [],
      field_days: 1,
      team: 1,
      valid_until: "2029-12-31",
      currency: "BRL",
      final_price: "100.00",
      payment: snapshot.calculation.payment,
    });
    mount(["budgets:read"], "/app/budgets/1?tab=proposal");
    expect(
      await screen.findByRole("heading", {
        name: "Prévia comercial · SINTETICO-ORC-1",
      }),
    ).toBeInTheDocument();
    expect(mocks.proposal).toHaveBeenCalledWith(1);
    expect(
      screen.queryByRole("button", { name: "Editar em nova versão" }),
    ).not.toBeInTheDocument();
  });
});
