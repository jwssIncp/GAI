import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsDashboard, ProjectsKpis } from "./ProjectsDashboard";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  roles: ["ORG_ADMIN"] as string[],
  grants: new Set(["projects:read", "commercial-indicators:read"]),
}));
vi.mock("@/api/http", () => ({ api: { get: mocks.get } }));
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 2,
      organization_id: 1,
      role_assignments: mocks.roles.map((role_key) => ({ role_key })),
    },
  }),
}));
vi.mock("@/features/auth/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (k: string) => mocks.grants.has(k) }),
}));

const amount = (value: string | null) => ({ value, known: 2, missing: 1 });
const total = {
  currency: "BRL",
  count: 3,
  original: amount("90000.00"),
  current: amount("100000.00"),
  average: "50000.00",
  active: amount("40000.00"),
  active_count: 1,
  recurring: amount("40000.00"),
  recurring_count: 1,
  non_recurring_count: 2,
  unknown_recurring_count: 0,
};
const commercial = {
  count: 3,
  hash: "h",
  totals: [total],
  annual: [{ year: "2026", count: 3, totals: [total] }],
  undated_contracts: 0,
  estimated_assets: 12500,
  missing_estimated_assets: 1,
  segments: [
    { key: "Indústria", label: "Indústria", count: 2, totals: [total] },
    { key: "Varejo", label: "Varejo", count: 1, totals: [total] },
  ],
  companies: [],
  states: [],
  statuses: [],
  status_evolution: [],
  rows: [],
};
const overview = {
  total_projects: 5,
  open_projects: 3,
  statuses: [
    { status: "active", total: 3 },
    { status: "finished", total: 2 },
  ],
  geography: [
    { state: "MG", total: 4 },
    { state: "SP", total: 1 },
  ],
};

function mount(ui: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.roles = ["ORG_ADMIN"];
  mocks.grants = new Set(["projects:read", "commercial-indicators:read"]);
  mocks.get.mockImplementation(async (url: string) => ({
    data: url.endsWith("/commercial") ? commercial : overview,
  }));
});

describe("Painel Geral", () => {
  it("mostra os 6 KPIs na ordem do sistema anterior com os totais do contrato", async () => {
    mount(<ProjectsKpis filters={{ status: "active" }} total={5} open={3} />);
    const labels = [
      "Valor total em contratos",
      "Quantidade de projetos",
      "Projetos em aberto",
      "Ticket médio",
      "Valor em contratos abertos",
      "Quantidade de itens em contratos",
    ];
    const group = screen.getByRole("group", {
      name: "Indicadores dos projetos filtrados",
    });
    const text = group.textContent ?? "";
    expect(labels.map((l) => text.indexOf(l))).toEqual(
      [...labels.map((l) => text.indexOf(l))].sort((a, b) => a - b),
    );
    expect(await screen.findByText(/100\.000,00/)).toBeVisible();
    expect(screen.getByText(/50\.000,00/)).toBeVisible();
    expect(screen.getByText(/40\.000,00/)).toBeVisible();
    expect(screen.getByText("12.500")).toBeVisible();
    expect(mocks.get).toHaveBeenCalledWith(
      "/organization-overview/commercial",
      expect.objectContaining({ params: { status: "active" } }),
    );
  });
  it("sem acesso comercial, os KPIs de valor ficam em traço e não chamam a API", () => {
    mocks.roles = ["PROJECT_MANAGER"];
    mount(<ProjectsKpis filters={{}} total={5} open={3} />);
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("dashboard recolhível com status clicável, recorrência, segmentos e UF", async () => {
    const onStatus = vi.fn();
    mount(<ProjectsDashboard filters={{}} onStatus={onStatus} />);
    expect(
      await screen.findByRole("button", { name: /Concluído: 2 \(40%\)/ }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Em aberto \(ativo\): 3/ }));
    expect(onStatus).toHaveBeenCalledWith("active");
    expect(await screen.findByText("Indústria")).toBeVisible();
    expect(screen.getByText(/Recorrente: 1/)).toBeVisible();
    expect(screen.getByText("MG")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Ocultar|Recolher/ }));
    expect(screen.queryByText("Indústria")).not.toBeInTheDocument();
  });
  it("não aparece para quem não é administrador da organização", () => {
    mocks.roles = ["PROJECT_MANAGER"];
    const { container } = mount(
      <ProjectsDashboard filters={{}} onStatus={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
