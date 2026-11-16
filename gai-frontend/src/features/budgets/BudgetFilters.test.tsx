import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { BudgetsPage } from "./BudgetsPage";

const mocks = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn() }));
vi.mock("@/api/http", () => ({ api: { get: mocks.get } }));
vi.mock("./budgetApi", async (original) => ({
  ...(await original<object>()),
  budgetApi: { list: mocks.list },
}));
vi.mock("./BudgetForm", () => ({ BudgetForm: () => null }));

const companies = [
  { id: 3, name: "Alfa Indústria" },
  { id: 4, name: "Beta Serviços" },
];
const projects = [
  { id: 9, name: "Inventário Alfa", code: "ALF-1", company_id: 3 },
  { id: 10, name: "Inventário Beta", code: "BET-1", company_id: 4 },
];

function route(url: string, config?: { params?: Record<string, unknown> }) {
  const one = url.match(/^\/(companies|projects)\/(\d+)$/);
  if (one) {
    const rows: { id: number }[] = one[1] === "companies" ? companies : projects;
    const row = rows.find((r) => r.id === Number(one[2]));
    return row ? Promise.resolve({ data: row }) : Promise.reject(new Error("404"));
  }
  if (url === "/companies") return Promise.resolve({ data: { items: companies, total_pages: 1 } });
  if (url === "/projects") {
    const company = config?.params?.company_id;
    return Promise.resolve({
      data: { items: projects.filter((p) => !company || p.company_id === company), total_pages: 1 },
    });
  }
  return Promise.reject(new Error("rota inesperada " + url));
}

function Where() {
  return <output data-testid="url">{useLocation().search}</output>;
}

function mount(path: string) {
  const auth = {
    user: {
      id: 2,
      organization_id: 1,
      permissions: ["budgets:read", "companies:read", "projects:read"].map((key) => ({ key, scope: "ORGANIZATION" })),
    },
    bootstrapping: false,
  } as AuthState;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/app/budgets"
              element={
                <>
                  <BudgetsPage />
                  <Where />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Filtros de orçamentos por nome (empresa e projeto)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(route);
    mocks.list.mockResolvedValue({
      items: [{ id: 1, number: "ORC-1", companyId: 4, status: "draft", current: null }],
      total: 1,
      page: 1,
    });
  });

  it("abre por link mostrando os nomes dos IDs da URL e lista com os mesmos parâmetros", async () => {
    mount("/app/budgets?company_id=3&project_id=9");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveValue("Alfa Indústria"));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Projeto" })).toHaveValue("Inventário Alfa (ALF-1)"));
    expect(mocks.list).toHaveBeenCalledWith({ company_id: "3", project_id: "9" });
    expect(screen.queryByText(/\(ID\)/)).not.toBeInTheDocument();
    // Orçamento sem versão: a empresa aparece pelo nome, não "Empresa #4".
    expect(await screen.findByText("Beta Serviços")).toBeInTheDocument();
    expect(screen.queryByText("Empresa #4")).not.toBeInTheDocument();
  });

  it("filtra o projeto pela empresa escolhida e grava os IDs na URL", async () => {
    mount("/app/budgets");
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Empresa" }));
    await user.click(await screen.findByRole("option", { name: /Beta Serviços/ }));
    await user.click(screen.getByRole("combobox", { name: "Projeto" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/projects", expect.objectContaining({ params: expect.objectContaining({ company_id: 4 }) })),
    );
    expect(await screen.findByRole("option", { name: /Inventário Beta \(BET-1\)/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Inventário Alfa/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Inventário Beta/ }));
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => {
      const search = new URLSearchParams(screen.getByTestId("url").textContent ?? "");
      expect(search.get("company_id")).toBe("4");
      expect(search.get("project_id")).toBe("10");
    });
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ company_id: "4", project_id: "10" }));
  });

  it("trocar a empresa limpa o projeto escolhido", async () => {
    mount("/app/budgets?company_id=3&project_id=9");
    const user = userEvent.setup();
    const project = screen.getByRole("combobox", { name: "Projeto" });
    await waitFor(() => expect(project).toHaveValue("Inventário Alfa (ALF-1)"));
    await user.click(screen.getByRole("combobox", { name: "Empresa" }));
    await user.click(await screen.findByRole("option", { name: /Beta Serviços/ }));
    expect(project).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => {
      const search = new URLSearchParams(screen.getByTestId("url").textContent ?? "");
      expect(search.get("company_id")).toBe("4");
      expect(search.has("project_id")).toBe(false);
    });
  });
});
