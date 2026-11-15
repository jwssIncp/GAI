import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { CashFlowPage } from "./CashFlowPage";
import type { CashFlowBoard, FlowItem } from "./cashFlowBoardApi";

const mocks = vi.hoisted(() => ({ board: vi.fn(), confirm: vi.fn(), discard: vi.fn(), receive: vi.fn(), undoReceipts: vi.fn(), reschedule: vi.fn(), settle: vi.fn() }));
vi.mock("./cashFlowBoardApi", async (original) => ({ ...(await original<object>()), cashFlowApi: mocks, indicatorsApi: { get: vi.fn(async () => ({ configured: false, as_of: "2026-11-14", reference: { month: "2026-11", year: "2026" } })) } }));

const all = ["cash-flow:read", "receivables:read", "receivables:edit", "receivables:receive", "receivables:reverse", "receivables:reschedule"];
function mount(permissions = all) {
  const auth = {
    user: { id: 1, organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })) },
    bootstrapping: false,
  } as unknown as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <CashFlowPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const item = (key: string, p: Partial<FlowItem>): FlowItem => ({
  key,
  direction: "in",
  group: "billing",
  origin: "contract",
  origin_label: "Contrato",
  project_id: 1,
  project_name: "Alfa",
  currency: "BRL",
  date: "2027-01-02",
  expected_on: "2027-01-02",
  realized_on: null,
  status: "open",
  overdue: false,
  overdue_days: 0,
  gross: "4000.00",
  net: "3466.80",
  derived: false,
  installment: { number: 2, of: 3 },
  contract_pct: "33.33",
  description: "Contrato CT-A",
  refs: { receivable_id: 9, installment_id: 21 },
  ...p,
});
const board = (): CashFlowBoard => ({
  as_of: "2026-11-14",
  reference: { month: "2026-12", year: "2026" },
  kpis: [
    {
      currency: "BRL",
      month: { reference: "2026-12", in_realized: "0.00", in_open: "0.00", out_realized: "0.00", out_open: "2250.00", total: "-2250.00" },
      next_month: { reference: "2027-01", in_gross: "13220.00", in_net: "11553.75", out: "100.00", total: "11453.75" },
      year: { reference: "2026", in: "7000.00", out: "3983.10", total: "3016.90", in_open_net: "2600.10", out_open: "2250.00" },
      overdue: { in: "3000.00", in_count: 1, out: "0.00", out_count: 0 },
      proposed: { amount: "3000.00", count: 2 },
    },
  ],
  alerts: { proposed_count: 1, proposed_amount: "3000.00", missing_parameters_since: null, missing_tax_count: 0, undated_payments: 0, unproposed_contracts: [] },
  projects: [{ id: 1, name: "Alfa" }],
  items: [
    item("cb1", { date: "2026-05-31", expected_on: "2026-05-31", overdue: true, overdue_days: 167, gross: "3000.00", net: "2600.10", project_name: "Beta", installment: { number: 1, of: 2 } }),
    item("ca1", { date: "2026-11-10", realized_on: "2026-11-10", status: "realized", installment: { number: 1, of: 3 }, refs: { receivable_id: 9, event_id: 77 } }),
    item("rev", { date: "2026-11-08", realized_on: "2026-11-08", status: "reversed", gross: "500.00", description: "Recebível estornado", refs: { receivable_id: 5, event_id: null, reversed_on: "2026-11-09" } }),
    item("prop", { status: "proposed", origin: "amendment", origin_label: "Aditivo", gross: "1500.00", net: "1300.05", description: "Contrato CT-A / aditivo AD-1 (previsto, não confirmado)", refs: { source_key: "amendment:3" } }),
    item("ir", { direction: "out", group: "non_reimbursable", origin: "income_tax", origin_label: "Imposto de Renda", gross: "533.20", derived: true, refs: { of: "ca1" }, installment: null, description: "IR 13,33% sobre Contrato CT-A" }),
    item("e3", { direction: "out", group: "non_reimbursable", origin: "expense", origin_label: "Despesa", date: "2026-12-20", expected_on: "2026-12-20", gross: "450.00", installment: null, description: "Lanche (cód. 3)", refs: { settle_key: "expense:3", settled_here: 0 } }),
    item("p1", { direction: "out", group: "non_reimbursable", origin: "field_agent_payment", origin_label: "Diárias", date: "2026-10-10", expected_on: "2026-10-10", overdue: true, overdue_days: 35, gross: "1000.00", installment: null, description: "Diárias", refs: { payment_id: 4 } }),
  ],
});

describe("Fluxo de caixa (etapa 7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.board.mockResolvedValue(board());
    for (const fn of [mocks.confirm, mocks.receive, mocks.settle, mocks.discard, mocks.reschedule, mocks.undoReceipts])
      fn.mockResolvedValue({ done: 1, failed: 0, results: [{ key: "x", ok: true }] });
  });

  it("KPIs do cenário, alerta de previsto não confirmado e vencidas em destaque (inclusive saídas)", async () => {
    mount();
    const kpis = within(await screen.findByRole("region", { name: "Indicadores do fluxo de caixa (BRL)" }));
    // A tela não envia o mês: a API usa o mês da data de referência (hoje).
    expect(mocks.board).toHaveBeenCalledWith({ project_id: undefined, year: String(new Date().getFullYear()), month: undefined });
    expect(kpis.getByText("Total previsto 12/2026").nextSibling).toHaveTextContent("-R$ 2.250,00");
    expect(kpis.getByText("Total previsto 01/2027").nextSibling).toHaveTextContent("R$ 11.453,75");
    expect(kpis.getByText("Total do ano 2026").nextSibling).toHaveTextContent("R$ 3.016,90");
    expect(kpis.getByText("Previsto não confirmado").nextSibling).toHaveTextContent("R$ 3.000,00");
    expect(screen.getByRole("alert")).toHaveTextContent("1 origem(ns) com recebível previsto e não confirmado");
    const billing = within(screen.getByRole("region", { name: "Entradas de faturamento" }));
    expect(billing.getByText("167 dia(s)")).toBeInTheDocument();
    expect(billing.getByText("Previsto (não confirmado)")).toBeInTheDocument();
    const out = within(screen.getByRole("region", { name: "Saídas não reembolsáveis" }));
    expect(out.getByText("35 dia(s)").closest("tr")).toHaveClass("bg-destructive/[0.07]");
    // IR derivado não tem seleção (sem baixa própria)
    expect(out.queryByLabelText(/Selecionar IR/)).not.toBeInTheDocument();
  });

  it("confirmar propostas e marcar recebido com data", async () => {
    const u = userEvent.setup();
    mount();
    const billing = within(await screen.findByRole("region", { name: "Entradas de faturamento" }));
    await u.click(billing.getByLabelText(/Selecionar Contrato CT-A \/ aditivo AD-1/));
    await u.click(screen.getByRole("button", { name: "Confirmar propostas (1)" }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(["amendment:3"]));
    await u.click(billing.getByLabelText("Selecionar Contrato CT-A 31/05/2026"));
    await u.click(screen.getByRole("button", { name: "Marcar recebido (1)" }));
    const dialog = within(screen.getByRole("dialog"));
    await u.clear(dialog.getByLabelText("Recebido em"));
    await u.type(dialog.getByLabelText("Recebido em"), "2026-11-12");
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.receive).toHaveBeenCalledWith([{ receivable_id: 9, installment_id: 21 }], "2026-11-12"));
  });

  it("reprogramar exige justificativa; pagar saída grava a data", async () => {
    const u = userEvent.setup();
    mount();
    const billing = within(await screen.findByRole("region", { name: "Entradas de faturamento" }));
    await u.click(billing.getByLabelText("Selecionar Contrato CT-A 31/05/2026"));
    await u.click(screen.getByRole("button", { name: "Alterar data prevista" }));
    let dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await u.type(dialog.getByLabelText("Justificativa"), "Cliente pediu prorrogação");
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.reschedule).toHaveBeenCalledWith([{ receivable_id: 9, installment_id: 21 }], "2026-11-14", "Cliente pediu prorrogação"));
    const out = within(screen.getByRole("region", { name: "Saídas não reembolsáveis" }));
    await u.click(out.getByLabelText("Selecionar Lanche (cód. 3) 20/12/2026"));
    await u.click(screen.getByRole("button", { name: "Pagar (1)" }));
    dialog = within(screen.getByRole("dialog"));
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.settle).toHaveBeenCalledWith(["expense:3"], "2026-11-14"));
  });

  it("estornos ficam escondidos por padrão; \"Mostrar estornos\" exibe com status Estornado", async () => {
    const u = userEvent.setup();
    mount();
    const billing = within(await screen.findByRole("region", { name: "Entradas de faturamento" }));
    expect(billing.queryByText("Recebível estornado")).not.toBeInTheDocument();
    await u.click(screen.getByLabelText("Mostrar estornos"));
    const row = billing.getByText("Recebível estornado").closest("tr")!;
    expect(row).toHaveTextContent("Estornado");
    expect(row).toHaveTextContent("estornado em 09/11/2026");
    expect(row).not.toHaveTextContent("-R$");
  });

  it("somente em aberto esconde os realizados; perfil sem permissões não vê ações de recebível", async () => {
    const u = userEvent.setup();
    mount(["cash-flow:read", "receivables:read"]);
    const billing = within(await screen.findByRole("region", { name: "Entradas de faturamento" }));
    expect(billing.getByText("Recebido")).toBeInTheDocument();
    await u.click(screen.getByLabelText("Somente em aberto"));
    expect(billing.queryByText("Recebido")).not.toBeInTheDocument();
    for (const name of [/Confirmar propostas/, /Marcar recebido/, /Alterar data prevista/, /Desfazer recebimento/])
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });
});
