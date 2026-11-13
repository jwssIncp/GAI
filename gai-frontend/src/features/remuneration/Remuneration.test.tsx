import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { ProjectRemunerationPage } from "./ProjectRemunerationPage";
import { RemunerationProjectsPage } from "./RemunerationProjectsPage";
import { computeRemuneration, daysInclusive, normalizeMoney, type ProjectRemuneration } from "./remunerationApi";
import { validateDraft } from "./remunerationDraft";

const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  projects: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  approve: vi.fn(),
  markAsPaid: vi.fn(),
  cancel: vi.fn(),
  reopen: vi.fn(),
  remove: vi.fn(),
  exportFile: vi.fn(),
}));
vi.mock("./remunerationApi", async (original) => ({
  ...(await original<object>()),
  remunerationApi: mocks,
}));
vi.mock("@/features/projects/useProjectLabel", () => ({ useProjectLabel: () => "Projeto Alfa" }));

function user(permissions: string[]) {
  return {
    user: {
      id: 1,
      organization_id: 1,
      role_assignments: [],
      permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })),
    },
    bootstrapping: false,
  } as unknown as AuthState;
}
const all = ["payments:read", "payments:create", "payments:update", "payments:approve", "payments:mark-as-paid", "payments:cancel", "payments:reopen", "payments:delete", "payments:export"];

function mount(ui: React.ReactElement, auth: AuthState, path = "/app/projects/3/finance/remuneration") {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/finance/remuneration" element={ui} />
            <Route path="/app/finance/remuneration" element={ui} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const item = (patch: Partial<ProjectRemuneration["items"][number]>) => ({
  id: 1,
  field_agent_id: 10,
  field_agent_name: "Ana Souza",
  state: "SP",
  start_date: "2026-11-03",
  end_date: "2026-11-07",
  expected_payment_date: "2026-11-20",
  payment_date: null,
  days: 5,
  daily_rate: "185.00",
  additional_amount: "50.00",
  daily_total: "925.00",
  total_amount: "975.00",
  total_manual: false,
  discount_amount: "30.00",
  final_amount: "945.00",
  status: "pending" as const,
  notes: null,
  reopened_at: null,
  updated_at: "2026-11-13T10:00:00Z",
  ...patch,
});
const remuneration = (requireApproval = true): ProjectRemuneration => ({
  project: { id: 3, name: "Projeto Alfa", status: "active" },
  parameters: { settings_missing: false, default_daily_rate: "185.00", require_approval: requireApproval, technician_expense_alert_pct: "30.00" },
  agents: [
    { id: 10, name: "Ana Souza", state: "SP", link_status: "active", has_payments: true },
    { id: 11, name: "Bruno Lima", state: "RJ", link_status: "active", has_payments: true },
    { id: 12, name: "Carla Mendes", state: "MG", link_status: "active", has_payments: false },
  ],
  to_launch: [{ field_agent_id: 12, name: "Carla Mendes", state: "MG" }],
  items: [
    item({}),
    item({ id: 2, field_agent_id: 11, field_agent_name: "Bruno Lima", status: "approved", expected_payment_date: null, total_manual: true, total_amount: "1000.00", final_amount: "1000.00", discount_amount: "0.00" }),
    item({ id: 3, status: "paid", payment_date: "2026-11-21" }),
  ],
  totals: { count: 3, total_amount: "2950.00", discount_amount: "60.00", final_amount: "2890.00" },
  kpis: { total_final: "2890.00", paid_final: "945.00" },
});

describe("Remuneração: fórmulas no cliente (iguais às da API)", () => {
  it("dias, total com adicional, total manual e final", () => {
    expect(daysInclusive("2026-11-03", "2026-11-07")).toBe(5);
    expect(daysInclusive("2026-11-07", "2026-11-03")).toBe(0);
    expect(computeRemuneration({ days: 5, dailyRate: "185.00", additional: "50.00", discount: "30.00" })).toEqual({
      dailyTotal: "925.00",
      total: "975.00",
      final: "945.00",
      negative: false,
    });
    expect(computeRemuneration({ days: 5, dailyRate: "185.00", additional: "50.00", discount: "0.00", manualTotal: "1000.00" }).total).toBe("1000.00");
    expect(computeRemuneration({ days: 3, dailyRate: "33.33", additional: "0.01", discount: "0" }).total).toBe("100.00");
  });
  it("aceita vírgula e milhar no formato brasileiro", () => {
    expect(normalizeMoney("1.234,5")).toBe("1234.50");
    expect(normalizeMoney("185")).toBe("185.00");
    expect(normalizeMoney("")).toBe("0.00");
    expect(normalizeMoney("abc")).toBeNull();
  });
  it("validação completa antes de enviar: sem data prevista não há payload", () => {
    const draft = {
      field_agent_id: "10", state: "SP", start_date: "2026-11-03", end_date: "2026-11-07", expected_payment_date: "",
      daily_rate: "185,00", additional_amount: "50,00", total_manual: false, total_amount: "", discount_amount: "0", notes: "",
    };
    expect(validateDraft(draft)).toEqual({ errors: { expected_payment_date: "Informe a data prevista de pagamento." } });
    expect(validateDraft({ ...draft, expected_payment_date: "2026-11-20", discount_amount: "975,01" }).errors).toEqual({
      discount_amount: "Os descontos não podem ser maiores que o total.",
    });
    expect(validateDraft({ ...draft, expected_payment_date: "2026-11-20" }).payload).toEqual(
      expect.objectContaining({ daily_rate: "185.00", additional_amount: "50.00", total_manual: false, total_amount: null }),
    );
  });
});

describe("Remuneração do projeto (Tela B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.project.mockResolvedValue(remuneration());
    mocks.create.mockResolvedValue({});
    mocks.reopen.mockResolvedValue({});
  });

  it("KPIs, linhas, previsto vazio com 'Informar', total manual marcado, pago com data real e a lançar", async () => {
    mount(<ProjectRemunerationPage />, user(all));
    const kpis = within(await screen.findByRole("region", { name: "Indicadores da remuneração" }));
    expect(kpis.getByText("R$ 2.890,00")).toBeInTheDocument();
    expect(kpis.getByText(/R\$ 945,00 já pago/)).toBeInTheDocument();
    const table = within(screen.getByRole("region", { name: "Lançamentos de remuneração" }));
    expect(table.getByText("Informar")).toBeInTheDocument();
    expect(table.getByTitle("Valor informado manualmente")).toHaveTextContent("manual");
    expect(table.getByTitle("Data real de pagamento")).toHaveTextContent("21/11/2026pago");
    expect(table.getByText(/A lançar: vinculado ao projeto, sem nenhum lançamento/)).toBeInTheDocument();
  });

  it("ações seguem status e o parâmetro de aprovação", async () => {
    mount(<ProjectRemunerationPage />, user(all));
    await screen.findByRole("region", { name: "Lançamentos de remuneração" });
    expect(screen.getByLabelText("Aprovar lançamento de Ana Souza")).toBeInTheDocument();
    // Pendente não é pago quando a organização exige aprovação.
    expect(screen.queryAllByLabelText("Registrar pagamento de Ana Souza")).toHaveLength(0);
    expect(screen.getByLabelText("Registrar pagamento de Bruno Lima")).toBeInTheDocument();
    expect(screen.getByLabelText("Reabrir para edição o lançamento de Bruno Lima")).toBeInTheDocument();
    expect(screen.queryByLabelText("Editar lançamento de Bruno Lima")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Excluir lançamento de Bruno Lima")).not.toBeInTheDocument();
  });

  it("sem exigência de aprovação, pendente pode ser pago e não há botão de aprovar", async () => {
    mocks.project.mockResolvedValue(remuneration(false));
    mount(<ProjectRemunerationPage />, user(all));
    await screen.findByRole("region", { name: "Lançamentos de remuneração" });
    expect(screen.queryByLabelText("Aprovar lançamento de Ana Souza")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Registrar pagamento de Ana Souza")).toHaveLength(1);
  });

  it("reabrir pede justificativa e envia", async () => {
    const u = userEvent.setup();
    mount(<ProjectRemunerationPage />, user(all));
    await u.click(await screen.findByLabelText("Reabrir para edição o lançamento de Bruno Lima"));
    const dialog = screen.getByRole("dialog");
    await u.type(within(dialog).getByLabelText(/Justificativa/), "Corrigir diária");
    await u.click(within(dialog).getByRole("button", { name: "Reabrir para edição" }));
    await waitFor(() => expect(mocks.reopen).toHaveBeenCalledWith(3, 2, "Corrigir diária"));
  });

  it("'Lançar' abre o formulário já com o inventariante e a diária padrão; mudar a data recalcula com o adicional", async () => {
    const u = userEvent.setup();
    mount(<ProjectRemunerationPage />, user(all));
    await u.click(await screen.findByRole("button", { name: "Lançar" }));
    const form = within(screen.getByRole("form", { name: "Lançamento de remuneração" }));
    expect(form.getByLabelText("Inventariante")).toHaveValue("12");
    expect(form.getByLabelText("UF")).toHaveValue("MG");
    expect(form.getByLabelText("Diária (R$)")).toHaveValue("185,00");
    await u.type(form.getByLabelText("Data inicial"), "2026-11-03");
    await u.type(form.getByLabelText("Data final"), "2026-11-07");
    const additional = form.getByLabelText("Valor adicional (R$)");
    await u.clear(additional);
    await u.type(additional, "120");
    const calc = within(form.getByLabelText("Cálculo"));
    expect(calc.getAllByText("R$ 1.045,00")).toHaveLength(2); // 5 × 185 + 120 (total e final)
    expect(calc.getByText("R$ 925,00")).toBeInTheDocument(); // dias × diária
    const end = form.getByLabelText("Data final");
    await u.clear(end);
    await u.type(end, "2026-11-09");
    expect(calc.getAllByText("R$ 1.415,00")).toHaveLength(2); // 7 × 185 + 120 (total e final)
    // Sem data prevista não envia nada.
    await u.click(form.getByRole("button", { name: "Lançar" }));
    expect(form.getByText("Informe a data prevista de pagamento.")).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    await u.type(form.getByLabelText("Data prevista de pagamento"), "2026-11-20");
    await u.click(form.getByLabelText("Informar o total manualmente"));
    expect(form.getByText(/Valor informado manualmente/)).toBeInTheDocument();
    await u.click(form.getByRole("button", { name: "Lançar" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][1]).toEqual(
      expect.objectContaining({ field_agent_id: 12, state: "MG", total_manual: true, total_amount: "1415.00", expected_payment_date: "2026-11-20" }),
    );
  });

  it("filtro de status 'em aberto' e exportação com os filtros", async () => {
    const u = userEvent.setup();
    mocks.exportFile.mockResolvedValue(new Blob(["x"]));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    mount(<ProjectRemunerationPage />, user(all));
    await u.selectOptions(await screen.findByLabelText("Filtrar por status"), "open");
    await waitFor(() => expect(mocks.project).toHaveBeenLastCalledWith(3, expect.objectContaining({ status_group: "open" })));
    await u.click(screen.getByRole("button", { name: /exportar excel/i }));
    await waitFor(() => expect(mocks.exportFile).toHaveBeenCalledWith(3, expect.objectContaining({ status_group: "open" })));
    click.mockRestore();
  });

  it("só leitura: sem botões de lançar, exportar ou ações", async () => {
    mount(<ProjectRemunerationPage />, user(["payments:read"]));
    await screen.findByRole("region", { name: "Lançamentos de remuneração" });
    expect(screen.queryByRole("button", { name: /novo lançamento|exportar excel|lançar/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Editar lançamento|Aprovar lançamento|Excluir lançamento/)).not.toBeInTheDocument();
  });
});

describe("Remuneração por projeto (Tela A)", () => {
  it("mostra colunas, alerta acima do parâmetro, não classificado e subtotal", async () => {
    mocks.projects.mockResolvedValue({
      parameters: { settings_missing: false, default_daily_rate: "185.00", require_approval: true, technician_expense_alert_pct: "30.00" },
      items: [
        { id: 1, name: "Alfa", status: "active", status_label: "Em andamento", technicians: 2, contract_value: "10000.00", non_reimbursable_expenses: "2000.00", net_contract_value: "8000.00", agents_cost: "3200.00", technician_pct: "32.00", technician_pct_alert: true, net_pct: "40.00", net_pct_alert: true, scope: ["CPC 27"], segment: null, state: null, contracted_on: null, finished_at: null },
        { id: 2, name: "Gama", status: "draft", status_label: "Em preparação", technicians: 0, contract_value: "5000.00", non_reimbursable_expenses: null, net_contract_value: null, agents_cost: "0.00", technician_pct: "0.00", technician_pct_alert: false, net_pct: null, net_pct_alert: false, scope: [], segment: null, state: null, contracted_on: null, finished_at: null },
      ],
      subtotal_agents_cost: "3200.00",
    });
    mount(<RemunerationProjectsPage />, user(["payments:read"]), "/app/finance/remuneration");
    const table = within(await screen.findByRole("region", { name: "Remuneração por projeto" }));
    expect(table.getByRole("link", { name: "Alfa" })).toHaveAttribute("href", "/app/projects/1/finance/remuneration");
    expect(table.getByText("32,00%")).toHaveAttribute("title", "Acima do alerta de 30,00% (parâmetros financeiros)");
    expect(table.getByText("não classificado")).toBeInTheDocument();
    expect(table.getByText("Subtotal dos projetos exibidos (2)")).toBeInTheDocument();
    expect(screen.getByText(/Alerta acima de 30,00%/)).toBeInTheDocument();
    expect(mocks.projects).toHaveBeenCalledWith(expect.objectContaining({ only_open: true }));
  });
});
