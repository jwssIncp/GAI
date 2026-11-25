import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { navigation } from "@/constants/navigation";
import { AppHeader } from "./AppHeader";
import { preparationApi } from "@/features/project-preparation/preparationQueries";
import type { CurrentUser, SystemRoleKey } from "@/types/api";

function user(options: { roles?: SystemRoleKey[]; permissions?: string[]; organization?: number | null }): CurrentUser {
  return {
    id: 1,
    login: "u",
    email: "u@gai.local",
    status: "ACTIVE",
    organization_id: options.organization === undefined ? 1 : options.organization,
    role_assignments: (options.roles ?? []).map((role_key, index) => ({
      assignment_id: index + 1,
      role_id: index + 1,
      role_key,
      role_name: role_key,
      role_type: "SYSTEM" as const,
      organization_id: options.organization === undefined ? 1 : options.organization,
      assigned_at: "2026-01-01",
    })),
    ...(options.permissions ? { permissions: options.permissions.map((key) => ({ key, scope: "ORGANIZATION" as const })) } : {}),
  };
}

/**
 * Menu superior: áreas na linha 1 (o logo leva à Visão geral) e telas da área na linha 2.
 * Para listar todos os itens, abre cada área e lê as telas da linha 2.
 */
function renderMenu(current: CurrentUser) {
  // Alerta ⚠ da sub-aba Kick-off: sem requisição real.
  vi.spyOn(preparationApi, "openSummary").mockResolvedValue({ open: 0 });
  render(
    <AuthContext.Provider value={{ user: current } as AuthState}>
      <MemoryRouter initialEntries={["/app/projects"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AppHeader />
        </QueryClientProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  const areas = within(screen.getByRole("navigation", { name: "Navegação principal" })).queryAllByRole("button");
  const titles = areas.map((button) => button.textContent);
  const items = [screen.getByRole("link", { name: "Visão geral" }).getAttribute("aria-label")];
  for (const area of areas) {
    fireEvent.click(area);
    const screens = screen.getByRole("navigation", { name: `Telas de ${area.textContent}` });
    items.push(...within(screens).getAllByRole("link").map((link) => link.textContent));
  }
  return { items, titles };
}

describe("Menu superior por área", () => {
  beforeAll(() =>
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))),
  );
  afterAll(() => vi.unstubAllGlobals());

  // Itens visíveis antes da Etapa 2 (ordem antiga), por perfil. O conjunto deve ser o mesmo,
  // mais os itens novos acrescentados depois (paridade financeira, etapa 1: Parâmetros financeiros).
  // "Projetos" virou as sub-abas da área no padrão do sistema anterior (mesma rota /app/projects
  // para o Painel Geral); cada sub-aba aparece conforme as permissões do perfil.
  const allProjectTabs = ["Painel Geral", "Kick-off", "Pendências - Campo", "Inventário", "Conciliação Físico-Contábil", "Avaliação", "Laudo"];
  const added = ["Parâmetros financeiros", "Remuneração por projeto", "Pagamento de inventariantes", "Despesas", "Placas de patrimônio", "Comissões"];
  it.each([
    ["ORG_ADMIN", user({ roles: ["ORG_ADMIN"] }), ["Visão geral", ...allProjectTabs, "Orçamentos", "Inventariantes", "Contas a receber", "Fluxo de caixa", "DRE gerencial", "Usuários", "Perfis e acessos", "Empresas", ...added]],
    ["PLATFORM_ADMIN", user({ roles: ["PLATFORM_ADMIN"], organization: null }), ["Visão geral", ...allProjectTabs, "Orçamentos", "Contas a receber", "Fluxo de caixa", "DRE gerencial", "Organizações", "Usuários", "Perfis e acessos", "Empresas", ...added]],
    ["operador de campo", user({ permissions: ["projects:read", "field-agents:read", "inventory-items:read"] }), ["Visão geral", "Painel Geral", "Inventário", "Inventariantes"]],
    ["financeiro", user({ permissions: ["projects:read", "receivables:read", "cash-flow:read", "dre:read", "budgets:read", "companies:read"] }), ["Visão geral", "Painel Geral", "Orçamentos", "Contas a receber", "Fluxo de caixa", "DRE gerencial", "Empresas"]],
  ])("%s vê exatamente os mesmos itens de antes, agrupados por módulo", (_label, current, before) => {
    const { items } = renderMenu(current);
    const renamed = before.map((label) => (label === "Contas a receber" ? "Recebíveis" : label));
    expect([...items].sort()).toEqual([...renamed].sort());
  });

  it("agrupa o ORG_ADMIN nas áreas Projetos, Comercial, Financeiro e Administração, nessa ordem", () => {
    const { items, titles } = renderMenu(user({ roles: ["ORG_ADMIN"] }));
    expect(titles).toEqual(["Projetos", "Comercial", "Financeiro", "Administração"]);
    expect(items).toEqual([
      "Visão geral",
      ...allProjectTabs,
      "Orçamentos",
      "Empresas",
      "Fluxo de caixa",
      "Recebíveis",
      "DRE gerencial",
      // Inventariantes fica no Financeiro, como no sistema anterior (mesma URL e permissão).
      "Inventariantes",
      "Remuneração por projeto",
      "Pagamento de inventariantes",
      "Despesas",
      "Placas de patrimônio",
      "Comissões",
      "Usuários",
      "Perfis e acessos",
      // Parâmetros financeiros fica em Administração (mesma URL e permissão).
      "Parâmetros financeiros",
    ]);
  });

  it("não mostra área sem itens visíveis", () => {
    const { titles } = renderMenu(user({ permissions: ["projects:read", "field-agents:read"] }));
    expect(titles).toEqual(["Projetos", "Financeiro"]);
  });

  it("mantém rotas e permissões (nova ordem do menu); só o rótulo de Recebíveis mudou", () => {
    expect(navigation.map((item) => [item.to, item.permissions ?? []])).toEqual([
      ["/app/dashboard", []],
      ["/app/projects", ["projects:read"]],
      ["/app/budgets", ["budgets:read"]],
      ["/app/companies", ["companies:read"]],
      ["/app/finance/cash-flow", ["cash-flow:read"]],
      ["/app/finance/receivables", ["receivables:read"]],
      ["/app/finance/dre", ["dre:read"]],
      ["/app/field-agents", ["field-agents:read"]],
      ["/app/finance/remuneration", ["payments:read"]],
      ["/app/finance/field-agent-payments", ["payments:read"]],
      ["/app/finance/expenses", ["expenses:read"]],
      ["/app/finance/asset-tags", ["asset-tag-orders:read"]],
      ["/app/finance/commissions", ["commissions:read"]],
      ["/app/users", ["users:read"]],
      ["/app/roles", ["org_roles:read"]],
      ["/app/organizations", ["organizations:read"]],
      ["/app/finance/parameters", ["finance-settings:read"]],
    ]);
    expect(navigation.find((item) => item.to === "/app/finance/receivables")?.label).toBe("Recebíveis");
  });
});
