import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { FieldAgentPaymentsPage } from "./FieldAgentPaymentsPage";
import type { Consolidated, ConsolidatedRow } from "./fieldAgentPaymentsApi";

const mocks = vi.hoisted(() => ({ list: vi.fn(), pay: vi.fn(), revert: vi.fn(), changeDate: vi.fn(), exportFile: vi.fn() }));
vi.mock("./fieldAgentPaymentsApi", async (original) => ({
  ...(await original<object>()),
  fieldAgentPaymentsApi: mocks,
}));

const all = ["payments:read", "payments:mark-as-paid", "payments:revert-payment", "payments:reschedule", "payments:export"];
function mount(permissions = all) {
  const auth = {
    user: { id: 1, organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })) },
    bootstrapping: false,
  } as unknown as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <FieldAgentPaymentsPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const row = (id: number, patch: Partial<ConsolidatedRow> = {}): ConsolidatedRow => ({
  id,
  project_id: 10,
  project_name: "Alfa",
  field_agent_id: 100,
  field_agent_name: "Ana",
  state: "SP",
  start_date: "2026-11-01",
  end_date: "2026-11-05",
  expected_payment_date: "2026-11-20",
  payment_date: null,
  days: 5,
  daily_rate: "185.00",
  additional_amount: "0.00",
  total_amount: "925.00",
  total_manual: false,
  discount_amount: "0.00",
  final_amount: "925.00",
  status: "approved",
  overdue: false,
  ...patch,
});
const facet = (total: number, options: Array<[string, string, number]> = []) => ({
  total,
  options: options.map(([value, label, count]) => ({ value, label, count })),
});
const data = (): Consolidated => ({
  today: "2026-11-13",
  require_approval: true,
  kpis: {
    reference_month: "2026-11",
    total: "2925.00",
    paid: "1200.00",
    open: "1725.00",
    field_agents: 2,
    expected_in_month: "1425.00",
    paid_in_month: "1000.00",
    open_in_month: "1425.00",
    open_next_month: "300.00",
    overdue: "500.00",
    overdue_count: 1,
  },
  facets: {
    project_id: facet(6, [["10", "Alfa", 4], ["11", "Beta", 2]]),
    field_agent_id: facet(6, [["100", "Ana", 4], ["101", "Bruno", 2]]),
    status: facet(6, [["open", "Em aberto (pendente e aprovado)", 3], ["paid", "Pago", 2]]),
    expected_month: facet(5, [["2026-11", "2026-11", 3]]),
    paid_month: facet(2, [["2026-11", "2026-11", 1]]),
    expected_date: facet(5),
    payment_date: facet(2),
  },
  summary: {
    rows: [{ field_agent_id: 101, name: "Bruno", entries: 2, days: 10, final: "500.00", paid: "200.00", open: "300.00" }],
    show_all: false,
    subtotal: { final: "500.00", paid: "200.00", open: "300.00" },
  },
  items: [
    row(2, { overdue: true, expected_payment_date: "2026-11-10", final_amount: "500.00" }),
    row(1, { status: "pending" }),
    row(3, { status: "paid", payment_date: "2026-11-02", final_amount: "1000.00" }),
  ],
});

describe("Pagamento de inventariantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(data());
    mocks.pay.mockResolvedValue({ done: 1, failed: 0, results: [{ id: 2, ok: true }] });
    mocks.revert.mockResolvedValue({ done: 1, failed: 0, results: [{ id: 3, ok: true }] });
  });

  it("mostra os 8 KPIs e o de atraso", async () => {
    mount();
    const kpis = within(await screen.findByRole("region", { name: "Indicadores do pagamento de inventariantes" }));
    for (const [label, value] of [
      ["Total", "R$ 2.925,00"], ["Pago", "R$ 1.200,00"], ["Em aberto", "R$ 1.725,00"], ["Inventariantes", "2"],
      ["Em atraso", "R$ 500,00"], ["Previsto em 11/2026", "R$ 1.425,00"], ["Pago em 11/2026", "R$ 1.000,00"],
      ["Em aberto em 11/2026", "R$ 1.425,00"], ["Em aberto no próximo mês", "R$ 300,00"],
    ])
      expect(kpis.getByText(label).nextSibling).toHaveTextContent(value);
    expect(kpis.getByText("1 lançamento(s) com previsão vencida")).toBeInTheDocument();
  });

  it("filtros em cascata com 'todos (N)' e contagem por opção; resumo filtra pelo inventariante", async () => {
    const u = userEvent.setup();
    mount();
    const project = await screen.findByLabelText("Filtrar por projeto");
    await within(project).findByRole("option", { name: "Alfa (4)" });
    expect(within(project).getAllByRole("option").map((o) => o.textContent)).toEqual(["Projeto: todos (6)", "Alfa (4)", "Beta (2)"]);
    expect(within(screen.getByLabelText("Filtrar por mês (previsão)")).getByRole("option", { name: "11/2026 (3)" })).toBeInTheDocument();
    await u.selectOptions(project, "11");
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ project_id: 11, status: "open" })));
    await u.click(within(screen.getByRole("region", { name: "Resumo por inventariante" })).getByRole("button", { name: "Bruno" }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ field_agent_id: 101 })));
    await u.click(screen.getByRole("button", { name: "Limpar" }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({}));
  });

  it("pagar com a data de hoje: só os aprovados selecionados (exigência de aprovação)", async () => {
    const u = userEvent.setup();
    mount();
    await u.click(await screen.findByLabelText("Selecionar todos os exibidos"));
    expect(screen.getByRole("button", { name: /Pagar selecionados \(1\)/ })).toBeEnabled(); // só o aprovado
    expect(screen.getByRole("button", { name: /Voltar para em aberto \(1\)/ })).toBeEnabled(); // só o pago
    await u.click(screen.getByRole("button", { name: /Pagar selecionados/ }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText(/Hoje \(13\/11\/2026\)/)).toBeChecked();
    await u.click(dialog.getByRole("button", { name: "Registrar pagamento" }));
    await waitFor(() => expect(mocks.pay).toHaveBeenCalledWith({ ids: [2], date_mode: "today" }));
  });

  it("uma data para todos e uma data por lançamento", async () => {
    const u = userEvent.setup();
    mocks.list.mockResolvedValue({ ...data(), require_approval: false });
    mount();
    await u.click(await screen.findByLabelText("Selecionar todos os exibidos"));
    await u.click(screen.getByRole("button", { name: /Pagar selecionados \(2\)/ }));
    let dialog = within(screen.getByRole("dialog"));
    await u.click(dialog.getByLabelText("Uma data para todos"));
    const all = dialog.getByLabelText("Data para todos");
    await u.clear(all);
    await u.type(all, "2026-11-15");
    await u.click(dialog.getByRole("button", { name: "Registrar pagamento" }));
    await waitFor(() => expect(mocks.pay).toHaveBeenLastCalledWith({ ids: [2, 1], date_mode: "chosen", payment_date: "2026-11-15" }));

    await u.click(await screen.findByLabelText("Selecionar todos os exibidos"));
    await u.click(screen.getByRole("button", { name: /Pagar selecionados \(2\)/ }));
    dialog = within(screen.getByRole("dialog"));
    await u.click(dialog.getByLabelText("Uma data por lançamento"));
    const first = dialog.getAllByLabelText(/Data do pagamento de Ana em Alfa/)[0];
    await u.clear(first);
    await u.type(first, "2026-11-11");
    await u.click(dialog.getByRole("button", { name: "Registrar pagamento" }));
    await waitFor(() =>
      expect(mocks.pay).toHaveBeenLastCalledWith({ ids: [2, 1], date_mode: "individual", dates: { "2": "2026-11-11", "1": "2026-11-13" } }),
    );
  });

  it("confirmações não ficam armadas: depois de um pagamento, cancelar outra confirmação não executa nada (bug grave do INVESTOR)", async () => {
    const u = userEvent.setup();
    mount();
    await u.click(await screen.findByLabelText("Selecionar todos os exibidos"));
    await u.click(screen.getByRole("button", { name: /Pagar selecionados/ }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Registrar pagamento" }));
    await waitFor(() => expect(mocks.pay).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Nova seleção; abre "pagar" e cancela; abre "voltar para em aberto" e cancela.
    await u.click(await screen.findByLabelText("Selecionar todos os exibidos"));
    await u.click(screen.getByRole("button", { name: /Pagar selecionados/ }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    await u.click(screen.getByRole("button", { name: /Voltar para em aberto \(1\)/ }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(mocks.pay).toHaveBeenCalledTimes(1);
    expect(mocks.revert).not.toHaveBeenCalled();

    // Confirmar "voltar" executa só o voltar, com os ids daquele diálogo.
    await u.click(screen.getByRole("button", { name: /Voltar para em aberto \(1\)/ }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Voltar para em aberto" }));
    await waitFor(() => expect(mocks.revert).toHaveBeenCalledWith([3]));
    expect(mocks.pay).toHaveBeenCalledTimes(1);
  });

  it("editar data: pago altera a data de pagamento; em aberto altera a prevista", async () => {
    const u = userEvent.setup();
    mocks.changeDate.mockResolvedValue({ ok: true });
    mount();
    await u.click(await screen.findByLabelText("Editar a data de pagamento de Ana"));
    let dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Data de pagamento")).toHaveValue("2026-11-02");
    await u.click(dialog.getByRole("button", { name: "Salvar data" }));
    await waitFor(() => expect(mocks.changeDate).toHaveBeenCalledWith(3, { kind: "payment", date: "2026-11-02" }));
    await u.click((await screen.findAllByLabelText("Editar a data prevista de Ana"))[0]);
    dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Data prevista de pagamento")).toHaveValue("2026-11-10");
  });

  it("mostrar/ocultar colunas e permissões", async () => {
    const u = userEvent.setup();
    mount(["payments:read"]);
    await screen.findByRole("region", { name: "Lançamentos de todos os projetos" });
    // Padrão: Diária, Adicional e Descontos ocultas; liga e desliga pelo menu Colunas.
    expect(screen.queryByRole("columnheader", { name: "Diária" })).not.toBeInTheDocument();
    await u.click(screen.getByText("Colunas"));
    await u.click(screen.getByLabelText("Diária"));
    expect(screen.getByRole("columnheader", { name: "Diária" })).toBeInTheDocument();
    await u.click(screen.getByLabelText("UF"));
    expect(screen.queryByRole("columnheader", { name: "UF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pagar selecionados|Voltar para em aberto|Exportar Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Editar a data/)).not.toBeInTheDocument();
  });
});
