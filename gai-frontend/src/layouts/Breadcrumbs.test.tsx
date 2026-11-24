import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { projectBreadcrumbSteps } from "@/features/projects/projectNavigation";
import { projectKeys } from "@/features/projects/projectQueries";
import type { CurrentUser } from "@/types/api";
import { AppHeader } from "./AppHeader";
import { Breadcrumbs } from "./Breadcrumbs";

const get = vi.fn();
vi.mock("@/api/endpoints", async (original) => ({
  ...(await original<typeof import("@/api/endpoints")>()),
  projectsApi: { get: (id: number) => get(id) },
}));
const receivable = vi.fn();
vi.mock("@/features/receivables/financeApi", async (original) => ({
  ...(await original<typeof import("@/features/receivables/financeApi")>()),
  financeApi: { detail: (id: string) => receivable(id) },
}));

function user(permissions: string[]): CurrentUser {
  return {
    id: 2,
    login: "org.user",
    email: "u@gai.local",
    status: "ACTIVE",
    organization_id: 1,
    role_assignments: [],
    permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" as const })),
  };
}

function renderAt(path: string, current: CurrentUser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(projectKeys.detail(10), { id: 10, name: "Center Norte" });
  const auth: AuthState = { user: current, accessToken: "t", expiresAt: "2099-01-01", bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Breadcrumbs />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return within(screen.getByRole("navigation", { name: "Breadcrumbs" }));
}

describe("Breadcrumbs do workspace do projeto", () => {
  beforeEach(() => {
    get.mockReset();
    // A tela revalida o projeto ao montar; a API simulada devolve o mesmo projeto do cache.
    get.mockResolvedValue({ id: 10, name: "Center Norte" });
  });
  it.each([
    ["/app/projects/10/summary", "", ["Painel", "Resumo"]],
    ["/app/projects/10/summary", "#inventariantes", ["Pendências - Campo", "Equipe de campo"]],
    // Grupos de uma aba só (Kick-off, Avaliação, Laudo) não repetem o nome na trilha.
    ["/app/projects/10/preparation/client-checklist", "", ["Kick-off", "Checklist do cliente"]],
    ["/app/projects/10/inventory-items", "#avaliacao", ["Avaliação"]],
    ["/app/projects/10/inventory/sessions/12", "", ["Conciliação Físico-Contábil", "Sessões e conciliação", "Sessão #12"]],
    ["/app/projects/10/technical-reports/templates/3", "", ["Laudos", "Modelos da organização", "Modelo #3"]],
    ["/app/projects/10/finance/accountabilities", "", ["Financeiro", "Prestações"]],
    ["/app/projects/10/area", "", ["Área"]],
  ])("%s%s → %j", (pathname, hash, labels) => {
    expect(projectBreadcrumbSteps("10", pathname, hash).map((step) => step.label)).toEqual(labels);
  });

  it("mostra o nome do projeto e os nomes de grupo e aba, com links para os níveis anteriores", () => {
    const crumbs = renderAt("/app/projects/10/inventory/sessions/12?project_id=10", user(["projects:read"]));
    expect(crumbs.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Projetos",
      "Center Norte",
      "Conciliação Físico-Contábil",
      "Sessões e conciliação",
      "Sessão #12",
    ]);
    expect(crumbs.getByRole("link", { name: "Center Norte" })).toHaveAttribute("href", "/app/projects/10/summary");
    expect(crumbs.getByRole("link", { name: "Sessões e conciliação" })).toHaveAttribute("href", "/app/projects/10/inventory/sessions");
    expect(crumbs.getByText("Sessão #12")).toHaveAttribute("aria-current", "page");
    expect(crumbs.queryByText("#10")).not.toBeInTheDocument();
  });

  it("sem leitura do projeto, não consulta a API e mostra #id", () => {
    const crumbs = renderAt("/app/projects/10/field-coordination", user(["field-coordination:read"]));
    expect(crumbs.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Projetos",
      "#10",
      "Pendências - Campo",
      "Check list - Campo",
    ]);
    expect(get).not.toHaveBeenCalled();
  });

  it("no mobile mostra só os dois últimos itens e não mostra seta antes do primeiro visível", () => {
    const crumbs = renderAt("/app/projects/10/summary", user(["projects:read"]));
    const items = crumbs.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Projetos", "Center Norte", "Painel", "Resumo"]);
    // Itens anteriores ficam ocultos abaixo de sm; "Painel › Resumo" fica visível.
    expect(items[0].className).toContain("hidden sm:inline-flex");
    expect(items[1].className).toContain("hidden sm:inline-flex");
    expect(items[2].className).not.toContain("hidden sm:inline-flex");
    expect(items[2].querySelector("svg")?.getAttribute("class")).toContain("hidden sm:block");
    expect(items[3].className).not.toContain("hidden");
    expect(items[3].querySelector("svg")?.getAttribute("class")).not.toContain("hidden");
  });

  it("mantém a trilha atual fora do projeto", () => {
    const crumbs = renderAt("/app/finance/dre/accounts", user(["dre:read"]));
    expect(crumbs.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Financeiro",
      "DRE gerencial",
      "Plano de contas",
    ]);
  });
});

describe("Breadcrumbs fora do projeto", () => {
  const texts = (crumbs: ReturnType<typeof renderAt>) => crumbs.getAllByRole("listitem").map((item) => item.textContent);

  it("Parâmetros financeiros fica em Administração (mesma seção do menu), sem link no grupo", () => {
    const crumbs = renderAt("/app/finance/parameters", user(["finance-settings:read"]));
    expect(texts(crumbs)).toEqual(["Administração", "Parâmetros financeiros"]);
    expect(crumbs.queryAllByRole("link")).toHaveLength(0);
  });

  it("detalhe do recebível: Financeiro e Recebíveis são links, mantendo o projeto do contexto", () => {
    receivable.mockRejectedValue(new Error("sem permissão"));
    const crumbs = renderAt("/app/finance/receivables/12?project_id=10", user(["receivables:read"]));
    expect(texts(crumbs)).toEqual(["Financeiro", "Recebíveis", "#12"]);
    expect(crumbs.getByRole("link", { name: "Financeiro" })).toHaveAttribute("href", "/app/finance?project_id=10");
    expect(crumbs.getByRole("link", { name: "Recebíveis" })).toHaveAttribute("href", "/app/finance/receivables?project_id=10");
    expect(crumbs.getByText("#12")).toHaveAttribute("aria-current", "page");
  });

  it("detalhe do recebível mostra a descrição no lugar de #id; sem acesso, mantém o código", async () => {
    receivable.mockResolvedValue({ id: 12, data: { description: "Contrato CT-9 · parcela 1" } });
    const crumbs = renderAt("/app/finance/receivables/12", user(["receivables:read"]));
    expect(await crumbs.findByText("Contrato CT-9 · parcela 1")).toHaveAttribute("aria-current", "page");
    expect(crumbs.queryByText("#12")).not.toBeInTheDocument();
    expect(receivable).toHaveBeenCalledWith("12");
  });

  it("detalhe da classificação da DRE: mesmo rótulo da aba e links nos níveis", () => {
    const crumbs = renderAt("/app/finance/dre/entries/5", user(["dre:read"]));
    expect(texts(crumbs)).toEqual(["Financeiro", "DRE gerencial", "Classificações e ajustes", "#5"]);
    expect(crumbs.getByRole("link", { name: "DRE gerencial" })).toHaveAttribute("href", "/app/finance/dre");
    expect(crumbs.getByRole("link", { name: "Classificações e ajustes" })).toHaveAttribute("href", "/app/finance/dre/entries");
  });

  it("acesso negado dentro do layout", () => {
    expect(texts(renderAt("/app/access-denied", user([])))).toEqual(["Acesso negado"]);
  });
});

describe("Cabeçalho: organização pelo nome", () => {
  beforeAll(() =>
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }))),
  );
  afterAll(() => vi.unstubAllGlobals());

  function renderHeader(current: CurrentUser) {
    const auth: AuthState = { user: current, accessToken: "t", expiresAt: "2099-01-01", bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={["/app/dashboard"]}>
            <AppHeader />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
  }

  it("mostra o nome da organização, nunca \"Organização #id\"", () => {
    renderHeader({ ...user([]), organization_name: "Center Norte Patrimônio" });
    expect(screen.getAllByText("Center Norte Patrimônio").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Organização #/)).not.toBeInTheDocument();
  });

  it("API antiga sem o nome: mostra o número da organização", () => {
    renderHeader(user([]));
    expect(screen.getAllByText("Organização #1").length).toBeGreaterThan(0);
  });

  it("usuário da plataforma (sem organização)", () => {
    renderHeader({ ...user([]), organization_id: null, organization_name: null });
    expect(screen.getAllByText("Plataforma").length).toBeGreaterThan(0);
  });
});
