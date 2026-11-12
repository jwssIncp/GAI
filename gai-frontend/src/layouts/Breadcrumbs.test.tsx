import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { projectBreadcrumbSteps } from "@/features/projects/projectNavigation";
import { projectKeys } from "@/features/projects/projectQueries";
import type { CurrentUser } from "@/types/api";
import { Breadcrumbs } from "./Topbar";

const get = vi.fn();
vi.mock("@/api/endpoints", async (original) => ({
  ...(await original<typeof import("@/api/endpoints")>()),
  projectsApi: { get: (id: number) => get(id) },
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
  beforeEach(() => get.mockReset());
  it.each([
    ["/app/projects/10/summary", "", ["Visão geral", "Resumo"]],
    ["/app/projects/10/summary", "#inventariantes", ["Campo", "Equipe de campo"]],
    ["/app/projects/10/preparation/client-checklist", "", ["Campo", "Preparação", "Checklist do cliente"]],
    ["/app/projects/10/inventory/sessions/12", "", ["Inventário", "Sessões e conciliação", "Sessão #12"]],
    ["/app/projects/10/technical-reports/templates/3", "", ["Contábil e laudo", "Laudos", "Modelos da organização", "Modelo #3"]],
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
      "Inventário",
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
      "Campo",
      "Coordenação de campo",
    ]);
    expect(get).not.toHaveBeenCalled();
  });

  it("mantém a trilha atual fora do projeto", () => {
    const crumbs = renderAt("/app/finance/dre/accounts", user(["dre:read"]));
    expect(crumbs.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Financeiro",
      "DRE Gerencial",
      "Plano de contas",
    ]);
  });
});
