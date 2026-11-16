import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { DreMonthlyPage } from "./DreMonthlyPage";
import { parseSignedMoney, type DreCell, type DreMonthlyView } from "./dreMonthlyApi";

const mocks = vi.hoisted(() => ({
  view: vi.fn(),
  detail: vi.fn(),
  setCell: vi.fn(),
  saveRules: vi.fn(),
  saveLayout: vi.fn(),
  setAccountActive: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
}));
const closing = vi.hoisted(() => ({ modelPreview: vi.fn(), modelApply: vi.fn(), review: vi.fn(), voidReviewed: vi.fn(), checklist: vi.fn(), freezePreview: vi.fn(), freeze: vi.fn() }));
vi.mock("./dreMonthlyApi", async (original) => ({ ...(await original<object>()), dreMonthlyApi: mocks, dreClosingApi: closing }));

const all = ["dre:read", "dre:adjust", "dre:configure", "dre:import"];
function mount(permissions = all) {
  const auth = {
    user: { id: 1, organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })) },
    bootstrapping: false,
  } as unknown as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <ToastProvider>
            <DreMonthlyPage />
          </ToastProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
const cells = (over: Record<string, Partial<DreCell>> = {}): DreCell[] =>
  months.map((month) => ({ month, value: "0.00", flow: "0.00", entered: null, classified: "0.00", estimate: null, estimate_basis: null, closed: month === "2026-10", ...over[month] }));
const zeros = Array(12).fill("0.00");
const view = (): DreMonthlyView => ({
  configured: true,
  as_of: "2026-11-14",
  grid: {
    year: "2026",
    months,
    current_month: "2026-11",
    cutoff: "2026-09",
    accounts: [
      { id: 1, code: "1.01", name: "Receita de serviços", group: "revenue", post_operational: false, role: null, flow_kinds: ["billing_revenue"], cells: cells({ "2026-01": { value: "10000.00", entered: "10000.00" }, "2026-11": { value: "4000.00", flow: "4000.00" } }), total: "14000.00" },
      { id: 5, code: "4.01", name: "Administrativas", group: "operating_expense", post_operational: false, role: null, flow_kinds: [], cells: cells({ "2026-11": { value: "6000.00", estimate: "6000.00", estimate_basis: "repete o último valor" } }), total: "6000.00" },
      { id: 9, code: "4.04", name: "Serviços de terceiros", group: "operating_expense", post_operational: true, role: "branch", flow_kinds: [], cells: cells(), total: "0.00" },
      { id: 7, code: "3.04", name: "Alimentação", group: "direct_cost", post_operational: false, role: null, flow_kinds: [], cells: cells(), total: "0.00" },
    ],
    lines: ["revenue", "deductions", "net_revenue", "variable_costs", "fixed_costs", "total_costs", "operating_result", "post_operational", "financial_result", "income_taxes", "final_result"].map((key) => ({
      key,
      label: key,
      values: key === "final_result" ? ["10000.00", ...Array(9).fill("0.00"), "-2000.00", "0.00"] : zeros,
      total: key === "final_result" ? "8000.00" : "0.00",
    })),
    estimates: 1,
    month_state: months.map((m) => ({ month: m, closed: m === "2026-10", projected: m >= "2026-11", automatic: m >= "2026-09" })),
    window: {},
    warnings: ["Sem conta associada: Comissões de parceiros. Associe em \"Configurar\"."],
  },
  compare: null,
  config: {
    rules: { billing_revenue: 1, branch: 9 },
    rule_labels: { billing_revenue: "Receita de faturamento (entradas do fluxo)", branch: "Filial (projeção)", commissions: "Comissões de parceiros" },
    flow_kinds: ["billing_revenue", "commissions"],
    layout: { revision: 2, data: { hidden: [], summary: [1], post_operational: [9] } },
    accounts: [
      { id: 1, label: "1.01 Receita de serviços", name: "Receita de serviços", group: "revenue", revision: 1 },
      { id: 5, label: "4.01 Administrativas", name: "Administrativas", group: "operating_expense", revision: 1 },
      { id: 9, label: "4.04 Serviços de terceiros", name: "Serviços de terceiros", group: "operating_expense", revision: 1 },
      { id: 7, label: "3.04 Alimentação", name: "Alimentação", group: "direct_cost", revision: 3 },
    ],
    excluded_accounts: [{ id: 8, code: "3.05", name: "Materiais", revision: 4 }],
  },
});

describe("DRE mensal", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    Object.values(closing).forEach((m) => m.mockReset());
    closing.review.mockResolvedValue([]);
    mocks.view.mockResolvedValue(view());
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("mostra a grade: lançado, fluxo, estimativa em itálico (não gravada), mês fechado e avisos", async () => {
    mount();
    const table = await screen.findByRole("table");
    expect(within(table).getByText(/🔒 fechado/)).toBeInTheDocument();
    const est = within(table).getByTitle(/Estimativa \(não gravada\): repete o último valor/);
    expect(est).toHaveTextContent(/≈/);
    expect(est.className).toContain("italic");
    expect(within(table).getByText("Resultado final")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Comissões de parceiros");
    expect(mocks.view).toHaveBeenCalledWith({ year: String(new Date().getFullYear()) });
  });

  it("DRE resumida mostra só linhas calculadas e as contas escolhidas; acumulado soma o período", async () => {
    mount();
    await screen.findByRole("table");
    await userEvent.click(screen.getByLabelText("DRE resumida"));
    const table = screen.getByRole("table");
    expect(within(table).queryByText(/Administrativas/)).toBeNull();
    expect(within(table).getByText(/1\.01 Receita de serviços/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Somente acumulado"));
    await userEvent.selectOptions(screen.getByLabelText("Mês final"), "11");
    const row = within(table).getByText("Resultado final").closest("tr")!;
    expect(row).toHaveTextContent(/8\.000,00/); // 10.000 − 2.000 (jan–nov)
  });

  it("ocultar linha grava o layout; excluir pede confirmação; linha excluída pode ser restaurada", async () => {
    mocks.saveLayout.mockResolvedValue({});
    mocks.setAccountActive.mockResolvedValue({});
    mount();
    const table = await screen.findByRole("table");
    const row = within(table).getByText(/4\.01 Administrativas/).closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Ocultar" }));
    await waitFor(() => expect(mocks.saveLayout).toHaveBeenCalledWith(2, { hidden: [5], summary: [1], post_operational: [9] }, "Ocultar linha"));
    const food = within(table).getByText(/3\.04 Alimentação/).closest("tr")!;
    await userEvent.click(within(food).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(mocks.setAccountActive).toHaveBeenCalledWith(7, 3, "Alimentação", false, "Excluir linha da DRE"));
    // conta com papel na projeção não tem "Excluir"
    expect(within(within(table).getByText(/4\.04 Serviços de terceiros/).closest("tr")!).queryByRole("button", { name: "Excluir" })).toBeNull();
    const excluded = screen.getByRole("region", { name: "Linhas excluídas" });
    await userEvent.click(within(excluded).getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(mocks.setAccountActive).toHaveBeenCalledWith(8, 4, "Materiais", true, "Restaurar linha da DRE"));
  });

  it("detalhe da célula: estimativa só como sugestão; salvar grava o valor digitado com motivo", async () => {
    mocks.detail.mockResolvedValue({
      account: { id: 5, code: "4.01", name: "Administrativas" },
      month: "2026-11",
      cell: cells({ "2026-11": { value: "6000.00", estimate: "6000.00", estimate_basis: "repete o último valor" } })[10],
      versions: [],
      movements: [],
      movements_hidden: false,
    });
    mocks.setCell.mockResolvedValue({});
    mount();
    const table = await screen.findByRole("table");
    await userEvent.click(within(table).getByTitle(/Estimativa \(não gravada\)/));
    const input = await screen.findByRole("textbox", { name: "Valor lançado (R$)" });
    expect(input).toHaveValue(""); // a estimativa não vira valor lançado
    expect(input).toHaveAttribute("placeholder", "estimativa 6000,00");
    await userEvent.type(input, "6.200,00");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("motivo");
    await userEvent.type(screen.getByLabelText("Motivo"), "Reajuste de novembro");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.setCell).toHaveBeenCalledWith(5, "2026-11", "6200.00", "Reajuste de novembro"));
    // negativo colado no padrão pt-BR
    await userEvent.click(within(table).getByTitle(/Estimativa \(não gravada\)/));
    const again = await screen.findByRole("textbox", { name: "Valor lançado (R$)" });
    await userEvent.click(again);
    await userEvent.paste("-50.000,00");
    await userEvent.type(screen.getByLabelText("Motivo"), "Estorno de novembro");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.setCell).toHaveBeenLastCalledWith(5, "2026-11", "-50000.00", "Estorno de novembro"));
  });

  it("importação: pré-visualiza, mostra o que vai gravar e confirma com motivo", async () => {
    mocks.preview.mockResolvedValue({
      year: "2026",
      file_name: "dre.xlsx",
      checksum: "a".repeat(64),
      mapping: {},
      rows: [
        { line: 2, label: "1.01", status: "ok", account_id: 1, account_label: "1.01 Receita de serviços", months: [{ month: "2026-01", amount: "10000.00", current: null, action: "apply" }, { month: "2026-10", amount: "1.00", current: null, action: "skip_closed" }] },
        { line: 3, label: "Linha X", status: "unmatched", account_id: null, account_label: null, months: [] },
      ],
      totals: { apply: 1, skipped_closed: 1, skipped_flow: 0, unmatched: 1 },
      accounts: [{ id: 1, label: "1.01 Receita de serviços" }],
    });
    mocks.confirm.mockResolvedValue({ written: 1 });
    mount();
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Importar planilha" }));
    const file = new File(["x"], "dre.xlsx");
    await userEvent.upload(screen.getByLabelText("Planilha"), file);
    await userEvent.click(screen.getByRole("button", { name: "Pré-visualizar" }));
    expect(await screen.findByText(/1 valor\(es\) serão gravados · 1 em mês fechado/)).toBeInTheDocument();
    expect(screen.getByText(/out\/26: .*\(mês fechado\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Conta para Linha X")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirmar importação" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Motivo da importação"), "Histórico 2026");
    await userEvent.click(confirm);
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(String(new Date().getFullYear()), file, {}, "a".repeat(64), "Histórico 2026"));
    expect(await screen.findByText(/Importação concluída: 1 valor/)).toBeInTheDocument();
  });

  it("sem permissões de escrita: só leitura", async () => {
    mount(["dre:read"]);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: "Importar planilha" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Configurar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ocultar" })).toBeNull();
  });

  it("valor com sinal no padrão brasileiro", () => {
    expect(parseSignedMoney("-1.234,56")).toBe("-1234.56");
    expect(parseSignedMoney("")).toBeNull();
    expect(parseSignedMoney("abc")).toBeUndefined();
  });

  it("modelo padrão: pré-visualiza o que será criado e associado e aplica só com motivo", async () => {
    closing.modelPreview.mockResolvedValue({
      version: "gai-dre-padrao-v1",
      accounts: [
        { code: "1", name: "Receitas", group: "revenue", synthetic: true, action: "exists", note: null },
        { code: "1.03", name: "Outras receitas operacionais", group: "revenue", synthetic: false, action: "create", note: null },
        { code: "5", name: "Pós-operacional", group: "operating_expense", synthetic: true, action: "conflict", note: "já existe com outro grupo ou tipo: mantida como está" },
      ],
      rules: [{ kind: "billing_revenue", code: "1.01", action: "kept" }],
      post_operational: [],
      totals: { create: 1, exists: 1, conflict: 1, map: 0 },
    });
    closing.modelApply.mockResolvedValue({ created: 1, mapped: 0, post_operational_marked: 0, conflicts: 1 });
    mount();
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar modelo padrão" }));
    expect(await screen.findByText(/1 conta\(s\) a criar · 1 já existente\(s\) · 0 associação\(ões\) a fazer · 1 conflito/)).toBeInTheDocument();
    expect(screen.getByText(/já existe com outro grupo/)).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: "Aplicar modelo" });
    expect(apply).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Motivo da aplicação do modelo"), "Implantação da DRE");
    await userEvent.click(apply);
    await waitFor(() => expect(closing.modelApply).toHaveBeenCalledWith("Implantação da DRE"));
    expect(await screen.findByText(/Modelo padrão aplicado: 1 conta\(s\) criada\(s\)/)).toBeInTheDocument();
  });

  it("classificações a revisar: lista e anula com motivo", async () => {
    closing.review.mockResolvedValue([{ id: 41, revision: 2, description: "CA1 classificada", source: "receivable", project_id: 7, months: ["2026-11"], amount: "4000.00" }]);
    closing.voidReviewed.mockResolvedValue({ id: 41, revision: 3, status: "void" });
    mount([...all, "dre:classify"]);
    const panel = await screen.findByRole("region", { name: "Classificações a revisar" });
    expect(panel).toHaveTextContent("CA1 classificada");
    await userEvent.click(within(panel).getByRole("button", { name: "Anular" }));
    await userEvent.type(await screen.findByLabelText("Motivo da anulação"), "Duplicada com o fluxo");
    await userEvent.click(screen.getByRole("button", { name: "Anular classificação" }));
    await waitFor(() => expect(closing.voidReviewed).toHaveBeenCalledWith(41, 2, "Duplicada com o fluxo"));
  });
});
