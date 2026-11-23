import { render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation, type RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import type { CurrentUser } from "@/types/api";
import { FirstAllowedRedirect, LegacyRedirect } from "./LegacyRedirects";
import { ProtectedRoute } from "./ProtectedRoute";
import { legacyRedirects, router } from "./router";

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

function Where() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderAt(path: string, element: ReactElement, current: CurrentUser) {
  const auth: AuthState = { user: current, accessToken: "t", expiresAt: "2099-01-01", bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/start" element={element} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return screen.getByTestId("location").textContent;
}

describe("/app/finance abre a 1ª tela financeira permitida", () => {
  const redirect = <FirstAllowedRedirect section="finance" prefix="/app/finance" />;

  it("segue a ordem do menu e mantém o projeto do contexto", () => {
    expect(renderAt("/app/start?project_id=7", redirect, user(["receivables:read", "cash-flow:read"]))).toBe("/app/finance/cash-flow?project_id=7");
  });

  it("pula as telas sem permissão", () => {
    expect(renderAt("/app/start", redirect, user(["expenses:read"]))).toBe("/app/finance/expenses");
  });

  it("Parâmetros financeiros (Administração) não conta como tela do Financeiro", () => {
    expect(renderAt("/app/start", redirect, user(["finance-settings:read"]))).toBe("/app/access-denied");
  });

  it("rota /app/finance (índice) usa o redirecionamento", () => {
    const finance = router.routes
      .flatMap((r) => r.children ?? [])
      .flatMap((r) => r.children ?? [])
      .find((r) => r.path === "finance");
    const index = finance?.children?.find((r) => r.index);
    expect(isValidElement(index?.element) && index.element.type).toBe(FirstAllowedRedirect);
  });
});

describe("Endereços reservados antigos levam às telas atuais", () => {
  it.each([
    ["/app/start", { to: "/app/finance/field-agent-payments" }, "/app/finance/field-agent-payments"],
    ["/app/start?project_id=7", { to: "/app/finance/expenses" }, "/app/finance/expenses?project_id=7"],
    ["/app/start", { to: "/app/projects", projectTab: "inventory-items" }, "/app/projects"],
    ["/app/start?project_id=7", { to: "/app/projects", projectTab: "pending-issues" }, "/app/projects/7/pending-issues"],
  ])("%s %j → %s", (path, props, expected) => {
    expect(renderAt(path, <LegacyRedirect {...props} />, user([]))).toBe(expected);
  });

  it("todas as rotas reservadas em inglês redirecionam (nenhuma tela provisória)", () => {
    const app = router.routes.flatMap((r) => r.children ?? []).find((r) => r.path === "/app")!;
    const byPath = new Map((app.children ?? []).filter((r): r is RouteObject & { path: string } => Boolean(r.path)).map((r) => [r.path, r]));
    const expected: Record<string, string> = {
      payments: "/app/finance/field-agent-payments",
      expenses: "/app/finance/expenses",
      "catalog-assets": "/app/projects",
      "inventory-items": "/app/projects",
      "inventory-item-images": "/app/projects",
      "accounting-items": "/app/projects",
      "pending-issues": "/app/projects",
      "import-sessions": "/app/projects",
      "export-jobs": "/app/projects",
      settings: "/app/profile",
    };
    expect(Object.fromEntries(legacyRedirects.map((r) => [r.path, r.to]))).toEqual(expected);
    for (const path of Object.keys(expected)) {
      const element = byPath.get(path)?.element;
      expect(isValidElement(element) && element.type, path).toBe(LegacyRedirect);
    }
  });
});

describe("Acesso negado dentro do layout", () => {
  it("rota sem permissão leva a /app/access-denied (com menu e topo)", () => {
    const auth: AuthState = { user: user(["projects:read"]), accessToken: "t", expiresAt: "2099-01-01", bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/app/finance/receivables"]}>
          <Routes>
            <Route element={<ProtectedRoute permissions={["receivables:read"]} />}>
              <Route path="/app/finance/receivables" element={<p>Recebíveis</p>} />
            </Route>
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/app/access-denied");
  });

  it("a rota /app/access-denied fica dentro do AppLayout", () => {
    const app = router.routes.flatMap((r) => r.children ?? []).find((r) => r.path === "/app")!;
    expect(app.children?.some((r) => r.path === "access-denied")).toBe(true);
  });
});
