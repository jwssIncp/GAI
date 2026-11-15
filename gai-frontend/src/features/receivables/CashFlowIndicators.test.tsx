import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { CashFlowIndicators } from "./CashFlowIndicators";
import { parseBrMoney, type CashFlowIndicatorValues, type CashFlowKpis } from "./cashFlowBoardApi";

const get = vi.hoisted(() => vi.fn());
vi.mock("./cashFlowBoardApi", async (original) => ({ ...(await original<object>()), indicatorsApi: { get } }));

function mount(permissions = ["cash-flow:read", "cash-flow:simulate"]) {
  const auth = {
    user: { id: 1, organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })) },
    bootstrapping: false,
  } as unknown as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <CashFlowIndicators query={{ year: "2026" }} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const kpis = (month: string, next: string, year: string): CashFlowKpis => ({
  currency: "BRL",
  month: { reference: "2026-12", in_realized: "0.00", in_open: "0.00", out_realized: "0.00", out_open: "0.00", total: month },
  next_month: { reference: "2027-01", in_gross: "0.00", in_net: "0.00", out: "0.00", total: next },
  year: { reference: "2026", in: "0.00", out: "0.00", total: "3016.90", in_open_net: "0.00", out_open: "0.00", dre_total: year },
  overdue: { in: "0.00", in_count: 0, out: "0.00", out_count: 0 },
  proposed: { amount: "0.00", count: 0 },
});
const values = (p: Partial<CashFlowIndicatorValues>): CashFlowIndicatorValues => ({
  window: { from: "2025-11", to: "2026-10", revenue: "80000.00", months_with_revenue: 8, missing_accounts: [] },
  contribution_margin: { mc: "60.50", mce: "65.50", income_tax_pct: "13.33", field_agents_pct: "12.50", non_reimbursable_pct: "5.00", commission_pct: "0.00", partner_effective_pct: "8.67" },
  fixed_cost: {
    items: [
      { key: "operation", label: "Custo fixo da operação", mode: "fixed", amount: "10915.00", available: true },
      { key: "branch", label: "Custo fixo da filial", mode: "fixed", amount: "3021.00", available: true },
      { key: "additional_income_tax", label: "Adicional de IR", mode: "average_3_months", amount: null, available: false },
    ],
    total: "13936.00",
    year: "167232.00",
    unavailable: ["additional_income_tax"],
  },
  dre: { year: "2026", revenue: "84000.00", operating_result: "-27647.20", final_result: "-164215.10", estimates: 6, cash_flow_total: "3016.90" },
  operating_result: "-164215.10",
  partner_commission: { pct: "10.00", quarters: ["0.00", "0.00", "0.00", "0.00"], operating_by_quarter: ["-41808.00", "-39207.90", "-41808.00", "-41391.20"], year: "0.00", account_missing: false },
  projected_result: "-164215.10",
  year_revenue: "7000.00",
  accounting_break_even: "250698.59",
  economic_break_even: "297128.26",
  economic_margin_pct: "10.00",
  net_margin: "-2627.43",
  average_collection_days: "8.0",
  collection_since: "2026-01-01",
  notes: ["Resultado projetado = resultado final da DRE mensal de 2026 (jan–dez)."],
  ...p,
});
const original = { configured: true, as_of: "2026-11-14", reference: { month: "2026-12", year: "2026" }, kpis: kpis("-2250.00", "11453.75", "3016.90"), indicators: values({}), simulation: null };

describe("Fluxo de caixa: indicadores", () => {
  beforeEach(() => get.mockReset());

  it("mostra os indicadores, o custo fixo com item indisponível (média DRE) e as notas da DRE", async () => {
    get.mockResolvedValue(original);
    mount(["cash-flow:read"]);
    const region = await screen.findByRole("region", { name: "Indicadores gerenciais" });
    expect(within(region).getByText("Ponto de equilíbrio contábil").parentElement).toHaveTextContent(/250\.698,59/);
    expect(within(region).getAllByText("Margem de contribuição")[0].parentElement).toHaveTextContent("60,50%");
    expect(within(region).getByText("Margem líquida").parentElement).toHaveTextContent("-2.627,43%");
    expect(within(region).getByText("Prazo médio de recebimento").parentElement).toHaveTextContent("8,0 dias");
    expect(within(region).getByText("sem conta na DRE")).toBeInTheDocument();
    expect(within(region).getByText(/resultado final da DRE mensal/)).toBeInTheDocument();
    // sem a permissão de simular, não há formulário
    expect(screen.queryByRole("form", { name: "Simular venda" })).toBeNull();
  });

  it("simula uma venda: envia 50/30/20 nos meses escolhidos e mostra o valor simulado com o atual riscado", async () => {
    get.mockImplementation(async (_q, sim) =>
      sim
        ? {
            ...original,
            simulation: {
              input: sim,
              basis: { field_agents_pct: "12.50", non_reimbursable_pct: "5.00", mc: "60.50", year_sale: "5000.00", sale_result: "3025.15", client_share: "0.00" },
              movements: [],
              kpis: kpis("1083.50", "13453.85", "6350.40"),
              indicators: values({ projected_result: "-160881.60", accounting_break_even: "245609.51" }),
              delta: { month_total: "3333.50", next_month_total: "2000.10", year_total: "3333.50", projected_result: "3333.50" },
            },
          }
        : original,
    );
    mount();
    const form = await screen.findByRole("form", { name: "Simular venda" });
    await userEvent.click(within(form).getByRole("button", { name: "Simular" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Informe o valor da venda");
    await userEvent.type(within(form).getByLabelText("Valor da venda"), "10.000,00");
    await userEvent.click(within(form).getByLabelText("Despesas por conta da empresa"));
    await userEvent.click(within(form).getByRole("button", { name: "Simular" }));
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith(
        { year: "2026" },
        { value: "10000.00", signal_month: "2026-12", second_month: "2027-01", third_month: "2027-02", company_expenses: true },
      ),
    );
    const card = (await screen.findByText("Resultado projetado do ano")).parentElement!;
    await waitFor(() => expect(card).toHaveTextContent(/-?R\$\s?-?160\.881,60/));
    expect(card.querySelector("s")).toHaveTextContent(/164\.215,10/);
    expect(card).toHaveTextContent(/variação R\$\s?3\.333,50/);
    expect(screen.getByRole("status")).toHaveTextContent("não gravada");
    expect(screen.getByRole("status")).toHaveTextContent("inventariantes (12,50%)");
    expect(screen.getByRole("status")).toHaveTextContent(/× MC 60,50% = R\$\s?3\.025,15/);
    await userEvent.click(screen.getByRole("button", { name: "Limpar simulação" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith({ year: "2026" }, null));
  });

  it("sem receita na DRE nos 12 meses: avisa que a margem fica indefinida e leva à DRE mensal", async () => {
    get.mockResolvedValue({ ...original, indicators: values({ window: { from: "2025-11", to: "2026-10", revenue: "0.00", months_with_revenue: 0, missing_accounts: [] }, contribution_margin: null }) });
    mount(["cash-flow:read"]);
    expect(await screen.findByText(/Sem receita na DRE nos 12 meses anteriores/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir a DRE mensal" })).toHaveAttribute("href", "/app/finance/dre");
  });

  it("simulação recusada pela API: mostra o motivo e permite limpar", async () => {
    get.mockImplementation(async (_q, sim) => {
      if (sim) throw new Error("Sem parâmetros financeiros vigentes em 01/12/2026 para calcular o IR da venda simulada.");
      return original;
    });
    mount();
    const form = await screen.findByRole("form", { name: "Simular venda" });
    await userEvent.type(within(form).getByLabelText("Valor da venda"), "1000");
    await userEvent.click(within(form).getByRole("button", { name: "Simular" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem parâmetros financeiros vigentes");
    await userEvent.click(screen.getByRole("button", { name: "Limpar simulação" }));
    expect(await screen.findByRole("form", { name: "Simular venda" })).toBeInTheDocument();
  });

  it("sem parâmetros vigentes: avisa e leva aos parâmetros", async () => {
    get.mockResolvedValue({ configured: false, as_of: "2026-11-14", reference: { month: "2026-11", year: "2026" } });
    mount();
    expect(await screen.findByRole("link", { name: "Ver parâmetros" })).toHaveAttribute("href", "/app/finance/parameters");
  });

  it("valor em reais no formato brasileiro", () => {
    expect(parseBrMoney("10.000,50")).toBe("10000.50");
    expect(parseBrMoney("0")).toBeNull();
    expect(parseBrMoney("abc")).toBeNull();
  });
});
