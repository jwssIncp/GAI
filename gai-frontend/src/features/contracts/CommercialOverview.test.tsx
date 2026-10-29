import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { CommercialOverview, type CommercialData } from "./CommercialOverview";
const get = vi.hoisted(() => vi.fn());
vi.mock("@/api/http", () => ({ api: { get } }));
const empty: CommercialData = {
  count: 0,
  hash: "a".repeat(64),
  totals: [],
  annual: [],
  undated_contracts: 0,
  estimated_assets: null,
  missing_estimated_assets: 0,
  segments: [],
  companies: [],
  states: [],
  statuses: [],
  status_evolution: [],
  rows: [],
};
function mount(filters: Record<string, string> = {}) {
  const auth = {
    user: { id: 2, organization_id: 1 },
    bootstrapping: false,
  } as AuthState;
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <CommercialOverview filters={filters} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
describe("Commercial data in the existing overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: empty });
  });
  it("shows missing contract amounts and estimates as unavailable instead of inventing financial zero", async () => {
    mount();
    expect(
      await screen.findByText(/Sem dados contratuais para este recorte/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não informado", { exact: true }),
    ).toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });
  it("passes the complete cross-filter cut to the server and distinguishes original/current currency totals", async () => {
    const filters = {
      contract_from: "2024-01-01",
      contract_to: "2024-12-31",
      segment: "Indústria",
      recurring: "true",
      service: "Inventário",
      company_id: "1",
      contract_state: "SP",
      assets_min: "90",
      assets_max: "110",
    };
    get.mockResolvedValue({
      data: {
        ...empty,
        count: 1,
        totals: [
          {
            currency: "BRL",
            count: 1,
            original: { value: "100.10", known: 1, missing: 0 },
            current: { value: "100.30", known: 1, missing: 0 },
            average: "100.30",
            active: { value: "100.30", known: 1, missing: 0 },
            active_count: 1,
            recurring: { value: "100.30", known: 1, missing: 0 },
            recurring_count: 1,
            non_recurring_count: 0,
            unknown_recurring_count: 0,
          },
        ],
      },
    });
    mount(filters);
    await screen.findByText("Valor original · BRL");
    expect(get).toHaveBeenCalledWith(
      "/organization-overview/commercial",
      expect.objectContaining({ params: filters }),
    );
    expect(screen.getByText("R$ 100,10")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 100,30").length).toBeGreaterThan(1);
    expect(screen.getByText("Valor vigente · BRL")).toBeInTheDocument();
  });
  it("shows a request failure without presenting monetary cards as zero", async () => {
    get.mockRejectedValue(new Error("Sem autorização comercial"));
    mount();
    expect(
      await screen.findByText("Sem autorização comercial"),
    ).toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });
});
