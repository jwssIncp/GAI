import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { navigation } from "@/constants/navigation";
import { Sidebar } from "./Sidebar";
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

function renderMenu(current: CurrentUser) {
  render(
    <AuthContext.Provider value={{ user: current } as AuthState}>
      <MemoryRouter initialEntries={["/app/projects"]}>
        <Sidebar mobileOpen={false} onMobileOpenChange={vi.fn()} />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  const menu = within(screen.getByRole("complementary", { name: "Menu lateral" }));
  const items = menu.getAllByRole("link").map((link) => link.textContent);
  const titles = menu.queryAllByText(/^(Projetos|Comercial|Financeiro|Administração)$/, { selector: "p" }).map((node) => node.textContent);
  return { items, titles };
}

describe("Menu lateral por módulo", () => {
  beforeAll(() =>
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))),
  );
  afterAll(() => vi.unstubAllGlobals());

  // Itens visíveis antes da Etapa 2 (ordem antiga), por perfil. O conjunto deve ser o mesmo.
  it.each([
    ["ORG_ADMIN", user({ roles: ["ORG_ADMIN"] }), ["Visão geral", "Projetos", "Orçamentos", "Inventariantes", "Contas a receber", "Fluxo de caixa", "DRE Gerencial", "Usuários", "Perfis e acessos", "Empresas"]],
    ["PLATFORM_ADMIN", user({ roles: ["PLATFORM_ADMIN"], organization: null }), ["Visão geral", "Projetos", "Orçamentos", "Contas a receber", "Fluxo de caixa", "DRE Gerencial", "Organizações", "Usuários", "Perfis e acessos", "Empresas"]],
    ["operador de campo", user({ permissions: ["projects:read", "field-agents:read", "inventory-items:read"] }), ["Visão geral", "Projetos", "Inventariantes"]],
    ["financeiro", user({ permissions: ["projects:read", "receivables:read", "cash-flow:read", "dre:read", "budgets:read", "companies:read"] }), ["Visão geral", "Projetos", "Orçamentos", "Contas a receber", "Fluxo de caixa", "DRE Gerencial", "Empresas"]],
  ])("%s vê exatamente os mesmos itens de antes, agrupados por módulo", (_label, current, before) => {
    const { items } = renderMenu(current);
    const renamed = before.map((label) => (label === "Contas a receber" ? "Recebíveis" : label));
    expect([...items].sort()).toEqual([...renamed].sort());
  });

  it("agrupa o ORG_ADMIN em Projetos, Comercial, Financeiro e Administração, nessa ordem", () => {
    const { items, titles } = renderMenu(user({ roles: ["ORG_ADMIN"] }));
    expect(titles).toEqual(["Projetos", "Comercial", "Financeiro", "Administração"]);
    expect(items).toEqual([
      "Visão geral",
      "Projetos",
      "Inventariantes",
      "Orçamentos",
      "Empresas",
      "Recebíveis",
      "Fluxo de caixa",
      "DRE Gerencial",
      "Usuários",
      "Perfis e acessos",
    ]);
  });

  it("não mostra seção sem itens visíveis", () => {
    const { titles } = renderMenu(user({ permissions: ["projects:read", "field-agents:read"] }));
    expect(titles).toEqual(["Projetos"]);
  });

  it("mantém rotas e permissões; só o rótulo de Recebíveis mudou", () => {
    expect(navigation.map((item) => [item.to, item.permissions ?? []])).toEqual([
      ["/app/dashboard", []],
      ["/app/projects", ["projects:read"]],
      ["/app/budgets", ["budgets:read"]],
      ["/app/field-agents", ["field-agents:read"]],
      ["/app/finance/receivables", ["receivables:read"]],
      ["/app/finance/cash-flow", ["cash-flow:read"]],
      ["/app/finance/dre", ["dre:read"]],
      ["/app/organizations", ["organizations:read"]],
      ["/app/users", ["users:read"]],
      ["/app/roles", ["org_roles:read"]],
      ["/app/companies", ["companies:read"]],
    ]);
    expect(navigation.find((item) => item.to === "/app/finance/receivables")?.label).toBe("Recebíveis");
  });
});
