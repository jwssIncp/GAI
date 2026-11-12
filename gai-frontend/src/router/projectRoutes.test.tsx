import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  Link,
  RouterProvider,
  useParams,
} from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { transferableAbortController } from "node:util";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import type { CurrentUser } from "@/types/api";
import { projectRoute } from "./projectRoutes";

function Probe({ title }: { title: string }) {
  const { projectId, kind } = useParams();
  return (
    <div>
      <h1>
        {title} · {projectId}
      </h1>
      {kind ? (
        <>
          <Link to={`/app/projects/${projectId}/preparation/kickoff`}>
            Kick-off
          </Link>
          <Link to={`/app/projects/${projectId}/preparation/client-checklist`}>
            Checklist do Cliente
          </Link>
        </>
      ) : null}
    </div>
  );
}
vi.mock("@/features/projects/ProjectSummaryPage", () => ({
  ProjectSummaryPage: () => <Probe title="Resumo" />,
}));
vi.mock("@/features/inventory-items/ProjectInventoryItemsPage", () => ({
  ProjectInventoryItemsPage: () => <Probe title="Itens" />,
}));
vi.mock("@/features/finance/ProjectFinancePage", () => ({
  ProjectFinancePage: () => <Probe title="Financeiro" />,
}));
vi.mock("@/features/pending-issues/ProjectPendingIssuesPage", () => ({
  ProjectPendingIssuesPage: () => <Probe title="Pendências" />,
}));
vi.mock("@/features/project-dashboard/ProjectDashboardPage", () => ({
  ProjectDashboardPage: () => <Probe title="Dashboard" />,
}));
vi.mock("@/features/accounting-items/ProjectAccountingItemsPage", () => ({
  ProjectAccountingItemsPage: () => <Probe title="Contábil" />,
}));
vi.mock("@/features/project-preparation/ProjectPreparationPage", () => ({
  ProjectPreparationPage: () => <Probe title="Preparação" />,
}));

const grants = [
  "projects:read",
  "inventory-items:read",
  "payments:read",
  "expenses:read",
  "inventory-pending-issues:read",
  "inventory-accounting-items:read",
  "project-units:read",
  "project-field-agents:read",
  "project-preparation:read",
];
const admin: CurrentUser = {
  id: 2,
  login: "org.admin",
  email: "admin@gai.local",
  status: "ACTIVE",
  organization_id: 1,
  role_assignments: [
    {
      assignment_id: 1,
      role_id: 2,
      role_key: "ORG_ADMIN",
      role_name: "Admin",
      role_type: "SYSTEM",
      organization_id: null,
      assigned_at: "2026-01-01",
    },
  ],
  permissions: grants.map((key) => ({ key, scope: "ORGANIZATION" })),
};
function setup(path = "/app/projects/31/summary", user = admin) {
  const router = createMemoryRouter(
    [
      { path: "/app", children: [projectRoute] },
      { path: "/access-denied", element: <h1>Acesso negado</h1> },
    ],
    { initialEntries: [path] },
  );
  const auth: AuthState = {
    user,
    accessToken: "synthetic",
    expiresAt: "2099-01-01",
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return router;
}

describe("Production project route tree: persistent navigation", () => {
  // React Router's data router uses Node Request; it needs a Node signal,
  // rather than the different AbortSignal constructor supplied by JSDOM.
  beforeAll(() =>
    vi.stubGlobal("AbortController", function () {
      return transferableAbortController();
    }),
  );
  afterAll(() => vi.unstubAllGlobals());
  async function go(nav: HTMLElement, group: string, tab: string) {
    await userEvent.click(within(nav).getByRole("link", { name: group }));
    await userEvent.click(await within(nav).findByRole("link", { name: tab }));
  }

  it("navigates continuously across groups, tabs, anchors, preparation and browser history without remounting navigation", async () => {
    const router = setup();
    const nav = await screen.findByRole("navigation", {
      name: "Abas do projeto",
    });
    const wrapper = nav.closest("[data-project-id]");
    for (const [group, label, suffix, heading] of [
      ["Inventário", "Itens e avaliação", "inventory-items", "Itens"],
      ["Financeiro", "Pagamentos e despesas", "finance", "Financeiro"],
      ["Inventário", "Pendências", "pending-issues", "Pendências"],
      ["Visão geral", "Dashboard", "dashboard", "Dashboard"],
      ["Contábil e laudo", "Base contábil", "accounting-items", "Contábil"],
      ["Visão geral", "Unidades", "summary#unidades", "Resumo"],
      ["Visão geral", "Configurações", "summary#configuracoes", "Resumo"],
      ["Campo", "Equipe de campo", "summary#inventariantes", "Resumo"],
      ["Visão geral", "Resumo", "summary", "Resumo"],
      ["Campo", "Preparação", "preparation/kickoff", "Preparação"],
      ["Inventário", "Itens e avaliação", "inventory-items", "Itens"],
    ]) {
      await go(nav, group, label);
      expect(
        await screen.findByRole("heading", { name: heading + " · 31" }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname + router.state.location.hash).toBe(
        "/app/projects/31/" + suffix,
      );
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(within(nav).getByRole("link", { name: group })).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(screen.getByRole("navigation", { name: "Abas do projeto" })).toBe(
        nav,
      );
      expect(nav.closest("[data-project-id]")).toBe(wrapper);
    }
    await act(() => router.navigate(-1));
    expect(
      await screen.findByRole("heading", { name: "Preparação · 31" }),
    ).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Campo" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await act(() => router.navigate(1));
    expect(
      await screen.findByRole("heading", { name: "Itens · 31" }),
    ).toBeInTheDocument();
    await act(() => router.navigate("/app/projects/32/summary"));
    expect(
      await screen.findByRole("heading", { name: "Resumo · 32" }),
    ).toBeInTheDocument();
    expect(nav.closest("[data-project-id]")).toHaveAttribute(
      "data-project-id",
      "32",
    );
    expect(within(nav).getByRole("link", { name: "Campo" })).toHaveAttribute(
      "href",
      "/app/projects/32/preparation/kickoff",
    );
  });

  it("supports direct checklist links, keeps preparation selected and opens the former image URL on items without an image tab", async () => {
    const router = setup("/app/projects/31/preparation/client-checklist");
    const nav = screen.getByRole("navigation", { name: "Abas do projeto" });
    expect(within(nav).getByRole("link", { name: "Campo" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      within(nav).getByRole("link", { name: "Preparação" }),
    ).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: "Kick-off" }));
    expect(
      screen.getByRole("heading", { name: "Preparação · 31" }),
    ).toBeInTheDocument();
    await act(() => router.navigate("/app/projects/31/inventory-items?view=images"));
    expect(
      await screen.findByRole("heading", { name: "Itens · 31" }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: "Itens e avaliação" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).queryByRole("link", { name: "Imagens" }),
    ).not.toBeInTheDocument();
  });

  it("hides unauthorized tabs and guards direct navigation even for an administrative label with incomplete effective grants", async () => {
    const user = {
      ...admin,
      permissions: [
        { key: "inventory-items:read", scope: "ORGANIZATION" as const },
      ],
    };
    const router = setup("/app/projects/31/inventory-items", user);
    const nav = screen.getByRole("navigation", { name: "Abas do projeto" });
    expect(
      within(nav).queryByRole("link", { name: "Preparação" }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Financeiro" }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Unidades" }),
    ).not.toBeInTheDocument();
    expect(
      within(
        within(nav).getByRole("group", { name: "Grupos do projeto" }),
      )
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Inventário"]);
    await act(() => router.navigate("/app/projects/31/preparation/kickoff"));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Acesso negado" }),
      ).toBeInTheDocument(),
    );
  });
});
