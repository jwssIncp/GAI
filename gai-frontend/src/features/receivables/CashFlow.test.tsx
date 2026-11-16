import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { CashFlowPage } from "./CashFlowPage";
import type { CashFlowBoard, FlowItem } from "./cashFlowBoardApi";

const mocks = vi.hoisted(() => ({
  board: vi.fn(),
  confirm: vi.fn(),
  discard: vi.fn(),
  receive: vi.fn(),
  undoReceipts: vi.fn(),
  redateReceipts: vi.fn(),
  reschedule: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("./cashFlowBoardApi", async (original) => ({
  ...(await original<object>()),
  cashFlowApi: mocks,
  indicatorsApi: { get: vi.fn(async () => ({ configured: false, as_of: "2026-11-14", reference: { month: "2026-11", year: "2026" } })) },
}));

const all = ["cash-flow:read", "receivables:read", "receivables:edit", "receivables:receive", "receivables:reverse", "receivables:reschedule", "expenses:mark-as-paid"];
function Where() {
  const l = useLocation();
  return <p data-testid="location">{l.search}</p>;
}
function mount(permissions = all, url = "/app/finance/cash-flow", userId = 1) {
  const auth = {
    user: { id: userId, organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })) },
    bootstrapping: false,
  } as unknown as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[url]}>
          <CashFlowPage />
          <Where />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

/** Mostra todas as situações de um bloco (a visão inicial é "Em aberto"). */
async function showAll(u: ReturnType<typeof userEvent.setup>, title: string) {
  await u.click(within(screen.getByRole("group", { name: `Filtros de ${title}` })).getByRole("button", { name: "Todos" }));
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
const out = (key: string, p: Partial<FlowItem>) =>
  item(key, { direction: "out", group: "non_reimbursable", installment: null, contract_pct: null, net: p.gross ?? "0.00", ...p });
const board = (): CashFlowBoard => ({
  as_of: "2026-11-14",
  reference: { month: "2026-11", year: "2026" },
  tables_year: "2026",
  kpis: [
    {
      currency: "BRL",
      month: { reference: "2026-11", in_realized: "4000.00", in_open: "0.00", out_realized: "1533.20", out_open: "9021.00", total: "-6554.20" },
      next_month: { reference: "2026-12", in_gross: "0.00", in_net: "0.00", out: "450.00", total: "-450.00" },
      year: { reference: "2026", in: "7000.00", out: "3983.10", total: "3016.90", in_open_net: "2600.10", out_open: "2250.00" },
      overdue: { in: "3000.00", in_count: 1, out: "0.00", out_count: 0 },
      proposed: { amount: "1500.00", count: 1 },
    },
  ],
  alerts: {
    proposed_count: 1,
    proposed_amount: "1500.00",
    missing_parameters_since: null,
    missing_tax_count: 0,
    undated_payments: 2,
    unproposed_contracts: [{ source_key: "contract:8", reason: "Contrato CT-Z sem data de assinatura." }],
  },
  projects: [{ id: 1, name: "Alfa" }, { id: 2, name: "Beta" }],
  items: [
    item("cb1", { date: "2026-05-31", expected_on: "2026-05-31", overdue: true, overdue_days: 167, gross: "3000.00", net: "2600.10", project_id: 2, project_name: "Beta", installment: { number: 1, of: 2 } }),
    item("ca1", { date: "2026-11-10", realized_on: "2026-11-10", status: "realized", installment: { number: 1, of: 3 }, refs: { receivable_id: 9, event_id: 77 } }),
    item("ca3", { date: "2027-02-02", expected_on: "2027-02-02", installment: { number: 3, of: 3 }, refs: { receivable_id: 9, installment_id: 23 } }),
    item("rev", { date: "2026-11-08", realized_on: "2026-11-08", status: "reversed", gross: "500.00", description: "Recebível estornado", refs: { receivable_id: 5, event_id: null, reversed_on: "2026-11-09" } }),
    item("prop", { status: "proposed", origin: "amendment", origin_label: "Aditivo", gross: "1500.00", net: "1300.05", description: "Contrato CT-A / aditivo AD-1 (previsto, não confirmado)", refs: { source_key: "amendment:3" } }),
    item("lote", {
      group: "reimbursement",
      origin: "reimbursement",
      origin_label: "Reembolso",
      date: "2026-12-15",
      expected_on: "2026-12-15",
      gross: "800.00",
      net: "800.00",
      installment: { number: 1, of: 1 },
      contract_pct: null,
      description: "Reembolso — lote L-1",
      reference_on: "2026-11-05",
      details: [
        { date: "2026-10-20", description: "Hotel (cód. 4)", amount: "500.00" },
        { date: "2026-10-21", description: "Táxi (cód. 5)", amount: "300.00" },
      ],
      refs: { receivable_id: 12, installment_id: 40 },
    }),
    item("tag", { group: "other_in", origin: "asset_tag", origin_label: "Placas de patrimônio (revenda)", date: "2026-11-30", expected_on: "2026-11-30", gross: "420.00", net: "420.00", installment: null, contract_pct: null, description: "Placas 100 un.", refs: {} }),
    out("ir", { origin: "income_tax", origin_label: "Imposto de Renda", date: "2026-11-10", gross: "533.20", derived: true, refs: { of: "ca1" }, status: "realized", realized_on: "2026-11-10", description: "IR 13,33% sobre Contrato CT-A" }),
    out("e3", { origin: "expense", origin_label: "Despesas", date: "2026-12-20", expected_on: "2026-12-20", gross: "450.00", description: "Lanche (cód. 3)", reference_on: "2026-11-20", refs: { settle_key: "expense:3", settled_here: 0 } }),
    out("e9", { origin: "expense", origin_label: "Despesas", date: "2026-11-11", expected_on: "2026-11-11", realized_on: "2026-11-11", status: "realized", gross: "1000.00", description: "Gasolina (cód. 9)", refs: { settle_key: "expense:9", settled_here: 1 } }),
    out("p1", { origin: "field_agent_payment", origin_label: "Diárias", date: "2026-10-10", expected_on: "2026-10-10", overdue: true, overdue_days: 35, gross: "1000.00", description: "Diárias", refs: { payment_id: 4 } }),
    out("r1", { group: "to_reimburse", origin: "expense", origin_label: "Despesas", date: "2026-11-25", expected_on: "2026-11-25", gross: "100.00", description: "Pedágio (cód. 6)", reference_on: "2026-11-02", refs: { settle_key: "expense:6", settled_here: 0 } }),
    out("fx1", { origin: "fixed_cost", origin_label: "Custos fixos", project_id: null, project_name: "—", date: "2026-11-30", expected_on: "2026-11-30", gross: "3021.00", derived: true, description: "5.02 Filial", refs: { fixed_cost: "estimate", account_id: 6, month: "2026-11", basis: "custo fixo da filial dos parâmetros" } }),
    out("fx2", { origin: "fixed_cost", origin_label: "Custos fixos", project_id: null, project_name: "—", date: "2026-11-30", expected_on: "2026-11-30", gross: "6000.00", derived: true, description: "4.01 Pessoal fixo", refs: { fixed_cost: "entered", account_id: 5, month: "2026-11", basis: null } }),
  ],
});

describe("Fluxo de caixa (paridade com o INVESTOR)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.board.mockResolvedValue(board());
    for (const fn of [mocks.confirm, mocks.receive, mocks.settle, mocks.discard, mocks.reschedule, mocks.undoReceipts, mocks.redateReceipts])
      fn.mockResolvedValue({ done: 1, failed: 0, results: [{ key: "x", ok: true }] });
  });

  it("cards, avisos num resumo de uma linha com detalhes e vencidas em destaque", async () => {
    const u = userEvent.setup();
    mount();
    const kpis = within(await screen.findByRole("region", { name: "Indicadores do fluxo de caixa (BRL)" }));
    // A tela não envia o mês: a API usa o mês da data de referência (hoje).
    expect(mocks.board).toHaveBeenCalledWith({ project_id: undefined, year: String(new Date().getFullYear()), month: undefined });
    expect(kpis.getByText("Total previsto 11/2026").nextSibling).toHaveTextContent("-R$ 6.554,20");
    expect(kpis.getByText("Previsto não confirmado").nextSibling).toHaveTextContent("R$ 1.500,00");
    const summary = screen.getByText(/proposta\(s\) não confirmada\(s\)/);
    expect(summary).toHaveTextContent("1 proposta(s) não confirmada(s) · 1 contrato(s) sem proposta · 2 diária(s) sem data prevista");
    expect(screen.queryByText("Contrato CT-Z sem data de assinatura.")).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "ver detalhes" }));
    expect(screen.getByText("Contrato CT-Z sem data de assinatura.")).toBeInTheDocument();
    expect(screen.getByText(/recebível previsto e não confirmado/)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "ocultar detalhes" }));
    expect(screen.queryByText("Contrato CT-Z sem data de assinatura.")).not.toBeInTheDocument();

    const billing = within(screen.getByRole("region", { name: "Tabela: Entradas de faturamento" }));
    expect(billing.getByText("167 dia(s)")).toBeInTheDocument();
    expect(billing.getByText("Não confirmado")).toHaveAttribute("title", "Previsto, ainda não confirmado");
    // visão inicial "Em aberto": a recebida fica fora; vencida e proposta ficam
    expect(billing.queryByText("Recebido")).not.toBeInTheDocument();
    const outs = within(screen.getByRole("region", { name: "Tabela: Saídas não reembolsáveis" }));
    expect(outs.getByTitle("35 dia(s) em atraso").closest("tr")).toHaveClass("bg-destructive/[0.07]");
    // IR, diárias e custos fixos não têm seleção (sem baixa no fluxo)
    expect(outs.queryByLabelText(/Selecionar IR/)).not.toBeInTheDocument();
    expect(outs.queryByLabelText(/Selecionar Diárias/)).not.toBeInTheDocument();
    expect(outs.queryByLabelText(/Selecionar 5.02 Filial/)).not.toBeInTheDocument();
  });

  it("saldo das linhas exibidas desconta o IR uma vez (entradas pelo bruto, IR como saída)", async () => {
    const u = userEvent.setup();
    mount();
    await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" });
    // em aberto: 3.000 + 4.000 + 1.500 + 800 + 420 − (450 + 1.000 + 100 + 3.021 + 6.000)
    expect(screen.getByText(/Saldo das linhas exibidas/)).toHaveTextContent("-R$ 851,00");
    for (const t of ["Entradas de faturamento", "Entradas de reembolso e revenda de placas", "Saídas para reembolsar", "Saídas não reembolsáveis"]) await showAll(u, t);
    // todos — entradas: 3.000 + 4.000 + 4.000 + 1.500 + 800 + 420 = 13.720
    // saídas: IR 533,20 + 450 + 1.000 + 1.000 (diárias) + 100 + 3.021 + 6.000 = 12.104,20
    expect(screen.getByText(/Saldo das linhas exibidas/)).toHaveTextContent("R$ 1.615,80");
    // rodapé do faturamento: bruto e líquido (o IR aparece só como saída)
    const billing = within(screen.getByRole("region", { name: "Tabela: Entradas de faturamento" }));
    expect(billing.getByText("Subtotal (4)").closest("tr")).toHaveTextContent(/R\$\s?12\.500,00.*R\$\s?10\.833,75/);
    // IR: uma linha por mês, com as entradas no detalhe (sem seleção)
    const outs = within(screen.getByRole("region", { name: "Tabela: Saídas não reembolsáveis" }));
    const ir = outs.getByText("IR sobre o faturamento de 11/2026").closest("tr")!;
    expect(ir).toHaveTextContent("R$ 533,20");
    expect(within(ir).queryByRole("checkbox")).not.toBeInTheDocument();
    await u.click(outs.getByRole("button", { name: /IR sobre o faturamento de 11\/2026/ }));
    expect(within(outs.getByRole("list", { name: "Itens de IR sobre o faturamento de 11/2026" })).getByText(/IR 13,33% sobre Contrato CT-A/)).toBeInTheDocument();
  });

  it("confirmar propostas e marcar recebido com data, pela barra do próprio bloco", async () => {
    const u = userEvent.setup();
    mount();
    const region = await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" });
    const billing = within(region);
    await u.click(billing.getByLabelText(/Selecionar Contrato CT-A \/ aditivo AD-1/));
    const bar = within(screen.getByRole("toolbar", { name: "Ações dos selecionados em Entradas de faturamento" }));
    await u.click(bar.getByRole("button", { name: "Confirmar propostas (1)" }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(["amendment:3"]));
    await u.click(billing.getByLabelText("Selecionar Contrato CT-A 31/05/2026"));
    await u.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Marcar como recebido (1)" }));
    const dialog = within(screen.getByRole("dialog"));
    await u.clear(dialog.getByLabelText("Data de recebimento"));
    await u.type(dialog.getByLabelText("Data de recebimento"), "2026-11-12");
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.receive).toHaveBeenCalledWith([{ receivable_id: 9, installment_id: 21 }], "2026-11-12"));
  });

  it("alterar data de recebimento: data futura bloqueada, justificativa obrigatória", async () => {
    const u = userEvent.setup();
    mount();
    const billing = within(await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" }));
    await showAll(u, "Entradas de faturamento");
    await u.click(billing.getByLabelText("Selecionar Contrato CT-A 10/11/2026"));
    await u.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Alterar data de recebimento (1)" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/estornado e um novo é registrado/)).toBeInTheDocument();
    await u.clear(dialog.getByLabelText("Nova data de recebimento"));
    await u.type(dialog.getByLabelText("Nova data de recebimento"), "2099-01-01");
    await u.type(dialog.getByLabelText("Justificativa"), "Data informada pelo banco");
    expect(dialog.getByText("Data futura não é aceita.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await u.clear(dialog.getByLabelText("Nova data de recebimento"));
    await u.type(dialog.getByLabelText("Nova data de recebimento"), "2026-11-12");
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.redateReceipts).toHaveBeenCalledWith([{ receivable_id: 9, event_id: 77 }], "2026-11-12", "Data informada pelo banco"));
  });

  it("desfazer recebimento pede justificativa e a envia no estorno", async () => {
    const u = userEvent.setup();
    mount();
    const billing = within(await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" }));
    await showAll(u, "Entradas de faturamento");
    await u.click(billing.getByLabelText("Selecionar Contrato CT-A 10/11/2026"));
    await u.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Desfazer recebimento (1)" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Desfazer 1 recebimento(s)?")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Desfazer recebimento" })).toBeDisabled();
    await u.type(dialog.getByLabelText("Justificativa"), "abc");
    expect(dialog.getByRole("button", { name: "Desfazer recebimento" })).toBeDisabled();
    await u.type(dialog.getByLabelText("Justificativa"), " lançado errado");
    await u.click(dialog.getByRole("button", { name: "Desfazer recebimento" }));
    await waitFor(() => expect(mocks.undoReceipts).toHaveBeenCalledWith([{ receivable_id: 9, event_id: 77 }], "abc lançado errado"));
  });

  it("reprogramar exige justificativa; pagar, alterar a data e desfazer o pagamento de uma saída", async () => {
    const u = userEvent.setup();
    mount();
    const billing = within(await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" }));
    await u.click(billing.getByLabelText("Selecionar Contrato CT-A 31/05/2026"));
    await u.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Alterar data prevista (1)" }));
    let dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await u.type(dialog.getByLabelText("Justificativa"), "Cliente pediu prorrogação");
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.reschedule).toHaveBeenCalledWith([{ receivable_id: 9, installment_id: 21 }], "2026-11-14", "Cliente pediu prorrogação"));
    const outs = within(screen.getByRole("region", { name: "Tabela: Saídas não reembolsáveis" }));
    await u.click(outs.getByLabelText("Selecionar Lanche (cód. 3) 20/12/2026"));
    const bar = () => within(screen.getByRole("toolbar", { name: "Ações dos selecionados em Saídas não reembolsáveis" }));
    await u.click(bar().getByRole("button", { name: "Pagar (1)" }));
    dialog = within(screen.getByRole("dialog"));
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.settle).toHaveBeenCalledWith(["expense:3"], "2026-11-14"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // baixa feita no fluxo: pode mudar a data ou desfazer
    await u.click(within(screen.getByRole("group", { name: "Filtros de Saídas não reembolsáveis" })).getByRole("button", { name: "Pagos" }));
    await u.click(outs.getByLabelText("Selecionar Gasolina (cód. 9) 11/11/2026"));
    await u.click(bar().getByRole("button", { name: "Alterar data de pagamento (1)" }));
    dialog = within(screen.getByRole("dialog"));
    await u.clear(dialog.getByLabelText("Nova data de pagamento"));
    await u.type(dialog.getByLabelText("Nova data de pagamento"), "2026-11-09");
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.settle).toHaveBeenLastCalledWith(["expense:9"], "2026-11-09"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await u.click(outs.getByLabelText("Selecionar Gasolina (cód. 9) 11/11/2026"));
    await u.click(bar().getByRole("button", { name: "Desfazer pagamento (1)" }));
    // desfazer a baixa pede confirmação
    expect(mocks.settle).not.toHaveBeenLastCalledWith(["expense:9"], null);
    dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Desfazer 1 pagamento(s)?")).toBeInTheDocument();
    // ...e justificativa (mínimo de 5 caracteres), como o estorno no recebível
    expect(dialog.getByRole("button", { name: "Desfazer pagamento" })).toBeDisabled();
    await u.type(dialog.getByLabelText("Justificativa"), "Pago por engano");
    await u.click(dialog.getByRole("button", { name: "Desfazer pagamento" }));
    await waitFor(() => expect(mocks.settle).toHaveBeenLastCalledWith(["expense:9"], null, "Pago por engano"));
  });

  it("estornos ficam escondidos por padrão; \"Mostrar estornos\" exibe com status Estornado", async () => {
    const u = userEvent.setup();
    mount();
    const billing = within(await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" }));
    await showAll(u, "Entradas de faturamento");
    expect(billing.queryByText("Estornado")).not.toBeInTheDocument();
    await u.click(screen.getByLabelText("Mostrar estornos"));
    const row = (await billing.findByText("Estornado")).closest("tr")!;
    expect(row).toHaveTextContent("Estornado");
    expect(row).toHaveTextContent("estornado em 09/11/2026");
    expect(row).not.toHaveTextContent("-R$");
  });

  it("permissões: sem as de recebível não há ações de entrada; sem a da despesa não há Pagar", async () => {
    const u = userEvent.setup();
    mount(["cash-flow:read", "receivables:read"]);
    const region = await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" });
    expect(within(region).queryAllByRole("checkbox")).toHaveLength(0);
    const outs = within(screen.getByRole("region", { name: "Tabela: Saídas não reembolsáveis" }));
    expect(outs.queryAllByRole("checkbox")).toHaveLength(0);
    await showAll(u, "Entradas de faturamento");
    expect(within(region).getByText("Recebido")).toBeInTheDocument();
    await u.click(screen.getByLabelText("Somente em aberto"));
    expect(within(region).queryByText("Recebido")).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("filtros do bloco somam ao geral: parcela, mês, situação, busca e limpar; vencida continua visível", async () => {
    const u = userEvent.setup();
    mount();
    const region = await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" });
    const filters = within(screen.getByRole("group", { name: "Filtros de Entradas de faturamento" }));
    expect(filters.getByRole("button", { name: "Em aberto" })).toHaveAttribute("aria-pressed", "true");
    await u.selectOptions(filters.getByLabelText("Parcela"), "last");
    expect(within(region).getAllByRole("row").filter((r) => r.closest("tbody"))).toHaveLength(1); // 3/3
    expect(within(region).getByText("3/3")).toBeInTheDocument();
    await u.click(filters.getByRole("button", { name: "Limpar filtros" }));
    await u.click(filters.getByRole("button", { name: "Todos" }));
    await u.selectOptions(filters.getByLabelText("Mês"), "11");
    // nov: CA#1 recebida; a vencida de 05/2026 continua visível
    expect(within(region).getByText("10/11/2026", { selector: "td" })).toBeInTheDocument();
    expect(within(region).getByText("167 dia(s)")).toBeInTheDocument();
    expect(within(region).queryByText("02/02/2027")).not.toBeInTheDocument();
    // "Recebidos": a recebida fica e a vencida continua visível (nunca escondida)
    await u.click(filters.getByRole("button", { name: "Recebidos" }));
    expect(within(region).getByText("10/11/2026", { selector: "td" })).toBeInTheDocument();
    expect(within(region).getByText("167 dia(s)")).toBeInTheDocument();
    await u.click(filters.getByRole("button", { name: "Limpar filtros" }));
    expect(filters.getByRole("button", { name: "Em aberto" })).toHaveAttribute("aria-pressed", "true");
    await u.type(filters.getByLabelText("Buscar em Entradas de faturamento"), "aditivo");
    expect(within(region).getAllByRole("row").filter((r) => r.closest("tbody"))).toHaveLength(1);
    // o filtro geral (projeto) continua valendo junto
    expect(within(screen.getByRole("region", { name: "Entradas de faturamento" })).getByText(/^1 lançamento$/)).toBeInTheDocument();
  });

  it("reembolso e revenda: data do lote, itens do lote, origem e subtotal separado", async () => {
    const u = userEvent.setup();
    mount();
    const region = await screen.findByRole("region", { name: "Tabela: Entradas de reembolso e revenda de placas" });
    const t = within(region);
    for (const h of ["Lote", "Data prevista", "Data de recebimento", "Projeto", "Descrição", "Origem", "Situação", "Valor"]) expect(t.getByRole("columnheader", { name: h })).toBeInTheDocument();
    const lot = t.getByText("Reembolso — lote L-1").closest("tr")!;
    expect(lot).toHaveTextContent("05/11/2026");
    await u.click(t.getByRole("button", { name: /Reembolso — lote L-1/ }));
    const list = within(t.getByRole("list", { name: "Itens de Reembolso — lote L-1" }));
    expect(list.getByText("Hotel (cód. 4)")).toBeInTheDocument();
    expect(t.getByText("Placas (revenda)")).toHaveAttribute("title", "Placas de patrimônio (revenda)");
    expect(t.getByText("Reembolsos (1)").closest("tr")).toHaveTextContent("R$ 800,00");
    expect(t.getByText("Revenda de placas (1)").closest("tr")).toHaveTextContent("R$ 420,00");
    expect(t.getByText("Subtotal (2)").closest("tr")).toHaveTextContent("R$ 1.220,00");
    const filters = within(screen.getByRole("group", { name: "Filtros de Entradas de reembolso e revenda de placas" }));
    await u.selectOptions(filters.getByLabelText("Origem"), "Placas de patrimônio (revenda)");
    expect(t.queryByText("Reembolso — lote L-1")).not.toBeInTheDocument();
  });

  it("custos fixos: estimado em itálico com o rótulo e link para a DRE; lançado não é pago; somem com projeto filtrado", async () => {
    const view = mount();
    const outs = within(await screen.findByRole("region", { name: "Tabela: Saídas não reembolsáveis" }));
    const est = outs.getByText("5.02 Filial").closest("tr")!;
    expect(est).toHaveClass("italic");
    expect(est).toHaveTextContent("Estimado");
    expect(est).toHaveTextContent("estimativa (custo fixo da filial dos parâmetros)");
    expect(within(est).getByRole("link", { name: "Ajustar na DRE" })).toHaveAttribute("href", "/app/finance/dre?year=2026");
    const entered = outs.getByText("4.01 Pessoal fixo").closest("tr")!;
    expect(entered).toHaveTextContent("Lançado");
    expect(entered).not.toHaveTextContent("Pago");
    view.unmount();
    mocks.board.mockResolvedValue({ ...board(), items: board().items.filter((i) => i.origin !== "fixed_cost" && i.project_id === 1) });
    mount(all, "/app/finance/cash-flow?project_id=1");
    await screen.findByRole("region", { name: "Tabela: Saídas não reembolsáveis" });
    expect(mocks.board).toHaveBeenLastCalledWith({ project_id: 1, year: String(new Date().getFullYear()), month: undefined });
    expect(screen.getByText(/custos fixos fora \(filtro de projeto\)/)).toBeInTheDocument();
  });

  it("filtro geral na URL: tipo esconde os blocos do outro lado; todos os anos mostra o ano no bloco; limpar zera", async () => {
    const u = userEvent.setup();
    mount();
    await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" });
    await u.selectOptions(screen.getByLabelText("Tipo"), "in");
    expect(screen.getByTestId("location")).toHaveTextContent("tipo=in");
    expect(screen.queryByRole("region", { name: "Tabela: Saídas não reembolsáveis" })).not.toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText("Ano"), "all");
    expect(screen.getByTestId("location")).toHaveTextContent("year=all");
    await waitFor(() => expect(mocks.board).toHaveBeenLastCalledWith({ project_id: undefined, year: "all", month: undefined }));
    mocks.board.mockResolvedValue({ ...board(), tables_year: "all" });
    await u.click(within(screen.getByRole("region", { name: "Filtros" })).getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^$/));
  });

  it("Ocultar/Mostrar do bloco é lembrado por usuário (outro usuário vê o padrão)", async () => {
    const u = userEvent.setup();
    const first = mount();
    await screen.findByRole("region", { name: "Tabela: Saídas para reembolsar" });
    await u.click(within(screen.getByRole("region", { name: "Saídas para reembolsar" })).getByRole("button", { name: "Ocultar" }));
    expect(screen.queryByRole("region", { name: "Tabela: Saídas para reembolsar" })).not.toBeInTheDocument();
    expect(screen.getByText(/blocos ocultos ficam fora/)).toBeInTheDocument();
    // recolhido: o cabeçalho continua com o subtotal
    expect(screen.getByLabelText("Subtotal de Saídas para reembolsar")).toHaveTextContent("R$ 100,00");
    await showAll(u, "Saídas não reembolsáveis");
    first.unmount();
    const again = mount();
    await screen.findByRole("region", { name: "Tabela: Entradas de faturamento" });
    expect(screen.queryByRole("region", { name: "Tabela: Saídas para reembolsar" })).not.toBeInTheDocument();
    // o filtro escolhido no bloco também foi lembrado
    expect(within(screen.getByRole("group", { name: "Filtros de Saídas não reembolsáveis" })).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    again.unmount();
    mount(all, "/app/finance/cash-flow", 2);
    expect(await screen.findByRole("region", { name: "Tabela: Saídas para reembolsar" })).toBeInTheDocument();
  });
});
