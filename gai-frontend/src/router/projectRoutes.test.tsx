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
            Checklist do cliente
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
vi.mock("@/features/remuneration/ProjectRemunerationPage", () => ({
  ProjectRemunerationPage: () => <Probe title="Remuneração" />,
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
// O layout do projeto busca o painel (alertas das abas). Sem este mock a
// busca ia por HTTP real à origem do jsdom (localhost:3000): a resposta — 401
// da API local ou conexão recusada no CI — chegava em momento arbitrário e
// re-renderizava o layout no meio dos cliques, deixando o teste lento e
// dependente do ambiente.
vi.mock("@/features/projects/projectQueries", async (original) => ({
  ...(await original<object>()),
  useProjectDashboard: () => ({ data: undefined }),
  // Nome do projeto na barra (GET /projects/:id): sem dados, mostra "Projeto #id".
  useProject: () => ({ data: undefined }),
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
/**
 * Cliques sem a espera de setTimeout entre os subeventos (delay: null): os
 * mesmos eventos de ponteiro são disparados, mas o custo não cresce com a
 * fila do event loop quando a máquina (ou o CI) está carregada.
 */
const ui = userEvent.setup({ delay: null });
function setup(path = "/app/projects/31/summary", user = admin) {
  const router = createMemoryRouter(
    [
      {
        path: "/app",
        children: [
          projectRoute,
          // Acesso negado abre dentro do layout do aplicativo.
          { path: "access-denied", element: <h1>Acesso negado</h1> },
        ],
      },
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
  const bar = () => screen.getByRole("navigation", { name: "Abas do projeto" });
  const linkNames = (element: HTMLElement) =>
    within(element)
      .getAllByRole("link")
      .map((link) => link.textContent?.trim());
  const withGrants = (...keys: string[]) => ({
    ...admin,
    permissions: keys.map((key) => ({ key, scope: "ORGANIZATION" as const })),
  });

  it("o endereço antigo /area (Project Area, sem tela) abre o resumo do projeto mantendo o contexto", async () => {
    const router = setup("/app/projects/31/area?return_to=%2Fapp%2Fdashboard");
    expect(await screen.findByRole("heading", { name: "Resumo · 31" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/app/projects/31/summary");
    expect(router.state.location.search).toBe("?return_to=%2Fapp%2Fdashboard");
    expect(within(bar()).getByRole("link", { name: "Resumo" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates continuously across tabs, anchors, areas, preparation and browser history without remounting navigation", async () => {
    const router = setup();
    const nav = await screen.findByRole("navigation", {
      name: "Abas do projeto",
    });
    const wrapper = nav.closest("[data-project-id]");
    const keepsBar = () => {
      expect(bar()).toBe(nav);
      expect(nav.closest("[data-project-id]")).toBe(wrapper);
    };
    // Painel Geral: telas do projeto (Painel) e Financeiro na mesma barra.
    expect(
      linkNames(within(nav).getByRole("group", { name: "Telas de Painel Geral" })),
    ).toEqual(["Resumo", "Dashboard", "Unidades", "Configurações", "Remuneração", "Despesas"]);
    for (const [label, suffix, heading] of [
      ["Remuneração", "finance/remuneration", "Remuneração"],
      ["Despesas", "finance", "Financeiro"],
      ["Dashboard", "dashboard", "Dashboard"],
      ["Unidades", "summary#unidades", "Resumo"],
      ["Configurações", "summary#configuracoes", "Resumo"],
      ["Resumo", "summary", "Resumo"],
    ] as const) {
      await ui.click(within(nav).getByRole("link", { name: label }));
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
      keepsBar();
    }
    // Conciliação Físico-Contábil: a barra passa a listar só as telas dessa sub-aba.
    await act(() => router.navigate("/app/projects/31/pending-issues"));
    expect(await screen.findByRole("heading", { name: "Pendências · 31" })).toBeInTheDocument();
    const reconciliation = within(nav).getByRole("group", {
      name: "Telas de Conciliação Físico-Contábil",
    });
    expect(linkNames(reconciliation)).toEqual(["Base contábil", "Pendências patrimoniais"]);
    expect(within(nav).queryByRole("link", { name: "Resumo" })).not.toBeInTheDocument();
    await ui.click(within(reconciliation).getByRole("link", { name: "Base contábil" }));
    expect(await screen.findByRole("heading", { name: "Contábil · 31" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Base contábil" })).toHaveAttribute("aria-current", "page");
    keepsBar();
    // Sub-abas com uma tela só (Kick-off, Pendências - Campo sem checklist, Inventário sem
    // importações): só o projeto e "Trocar projeto", que volta à lista da sub-aba.
    for (const [suffix, heading, area] of [
      ["preparation/kickoff", "Preparação", "kickoff"],
      ["summary#inventariantes", "Resumo", "field"],
      ["inventory-items", "Itens", "inventory"],
    ] as const) {
      await act(() => router.navigate("/app/projects/31/" + suffix));
      expect(await screen.findByRole("heading", { name: heading + " · 31" })).toBeInTheDocument();
      expect(within(nav).queryByRole("group")).not.toBeInTheDocument();
      expect(within(nav).getByRole("link", { name: "Trocar projeto" })).toHaveAttribute(
        "href",
        `/app/projects/${area}?escolher=1`,
      );
      keepsBar();
    }
    await act(() => router.navigate(-1));
    expect(await screen.findByRole("heading", { name: "Resumo · 31" })).toBeInTheDocument();
    expect(router.state.location.hash).toBe("#inventariantes");
    await act(() => router.navigate(-1));
    expect(
      await screen.findByRole("heading", { name: "Preparação · 31" }),
    ).toBeInTheDocument();
    await act(() => router.navigate(1));
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
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/app/projects/32/dashboard",
    );
    expect(within(nav).getByRole("link", { name: "Trocar projeto" })).toHaveAttribute("href", "/app/projects");
  });

  it("supports direct checklist links, keeps preparation selected and opens the former image URL on items without an image tab", async () => {
    const router = setup(
      "/app/projects/31/preparation/client-checklist",
      withGrants(...grants, "import-sessions:read"),
    );
    const nav = bar();
    // Kick-off tem uma tela só: a barra mostra o projeto e "Trocar projeto" da sub-aba Kick-off.
    expect(within(nav).queryByRole("group")).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Trocar projeto" })).toHaveAttribute(
      "href",
      "/app/projects/kickoff?escolher=1",
    );
    expect(screen.getByRole("heading", { name: "Preparação · 31" })).toBeInTheDocument();
    // Link "Kick-off" da própria tela.
    await ui.click(screen.getByRole("link", { name: "Kick-off" }));
    expect(router.state.location.pathname).toBe("/app/projects/31/preparation/kickoff");
    expect(
      screen.getByRole("heading", { name: "Preparação · 31" }),
    ).toBeInTheDocument();
    await act(() => router.navigate("/app/projects/31/inventory-items?view=images"));
    expect(
      await screen.findByRole("heading", { name: "Itens · 31" }),
    ).toBeInTheDocument();
    const inventory = within(nav).getByRole("group", { name: "Telas de Inventário" });
    expect(linkNames(inventory)).toEqual(["Itens inventariados", "Importações"]);
    expect(
      within(inventory).getByRole("link", { name: "Itens inventariados" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).queryByRole("link", { name: "Imagens" }),
    ).not.toBeInTheDocument();
  });

  it("lists external finance screens directly in Painel Geral when internal finance tabs are hidden", async () => {
    // Sem payments:read/expenses:read: Remuneração e Despesas ficam ocultas e o Financeiro
    // mostra só as telas globais (fora do projeto), filtradas pelo projeto.
    const router = setup(
      "/app/projects/31/summary",
      withGrants("projects:read", "receivables:read", "cash-flow:read", "dre:read"),
    );
    const nav = await screen.findByRole("navigation", { name: "Abas do projeto" });
    const screens = within(nav).getByRole("group", { name: "Telas de Painel Geral" });
    expect(linkNames(screens)).toEqual([
      "Resumo",
      "Dashboard",
      "Configurações",
      "Recebíveis",
      "Fluxo de caixa",
      "DRE gerencial",
    ]);
    expect(within(screens).getByText("Financeiro")).toBeInTheDocument();
    expect(within(screens).queryByText("Comercial")).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Remuneração" })).not.toBeInTheDocument();
    expect(within(screens).getByRole("link", { name: "Recebíveis" })).toHaveAttribute(
      "href",
      "/app/finance/receivables?project_id=31",
    );
    expect(within(screens).getByRole("link", { name: "DRE gerencial" })).toHaveAttribute(
      "href",
      "/app/finance/dre?project_id=31",
    );
    // Abas externas nunca ficam como página atual.
    expect(within(screens).getByRole("link", { name: "Resumo" })).toHaveAttribute("aria-current", "page");
    expect(within(screens).getByRole("link", { name: "Recebíveis" })).not.toHaveAttribute("aria-current");
    expect(router.state.location.pathname).toBe("/app/projects/31/summary");
  });

  it("hides unauthorized tabs and guards direct navigation even for an administrative label with incomplete effective grants", async () => {
    const user = withGrants("inventory-items:read", "payments:read", "expenses:read");
    const router = setup("/app/projects/31/inventory-items", user);
    const nav = bar();
    // Inventário sem importações: nenhuma lista de telas, só "Trocar projeto".
    expect(within(nav).queryByRole("group")).not.toBeInTheDocument();
    expect(linkNames(nav)).toEqual(["Trocar projeto"]);
    await act(() => router.navigate("/app/projects/31/finance/remuneration"));
    expect(await screen.findByRole("heading", { name: "Remuneração · 31" })).toBeInTheDocument();
    // Painel Geral sem projects:read: Resumo, Dashboard, Unidades e Configurações ficam ocultas.
    expect(
      linkNames(within(nav).getByRole("group", { name: "Telas de Painel Geral" })),
    ).toEqual(["Remuneração", "Despesas"]);
    expect(within(nav).queryByRole("link", { name: "Kick-off" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Unidades" })).not.toBeInTheDocument();
    await act(() => router.navigate("/app/projects/31/preparation/kickoff"));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Acesso negado" }),
      ).toBeInTheDocument(),
    );
  });
});
