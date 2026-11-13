import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { ProjectContractsPage } from "./ProjectContractsPage";
import {
  equalPercentages,
  paymentPlanFromForm,
  percentSumCents,
  type ContractDetail,
} from "./contractsApi";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
  amend: vi.fn(),
  archive: vi.fn(),
  project: vi.fn(),
  settings: vi.fn(),
}));
vi.mock("./contractsApi", async (original) => ({
  ...(await original<object>()),
  contractsApi: mocks,
}));
vi.mock("@/api/endpoints", () => ({ projectsApi: { get: mocks.project } }));
vi.mock("@/features/finance-settings/financeSettingsApi", () => ({
  financeSettingsApi: { overview: mocks.settings },
}));

const legacy: ContractDetail = {
  id: 3,
  projectId: 7,
  revision: 2,
  data: {
    number: "ANTIGO-3",
    company_id: 1,
    company_name: "Empresa de teste",
    company_state: "SP",
    contracted_on: null,
    starts_on: null,
    ends_on: null,
    original_value: null,
    current_value: null,
    current_ends_on: null,
    current_scope: null,
    currency: "BRL",
    contracting_type: null,
    segment: null,
    commercial_origin: "Indicação do diretor",
    recurring: null,
    services: [],
    estimated_assets: null,
    scope: null,
    commercial_terms: null,
    status: "draft",
  },
  amendments: [],
  versions: [],
};

function mount(path = "/app/projects/7/contracts") {
  const auth = {
    user: {
      id: 2,
      organization_id: 1,
      permissions: ["projects:read", "contracts:read", "contracts:edit", "finance-settings:read"].map((key) => ({
        key,
        scope: "ORGANIZATION",
      })),
    },
    bootstrapping: false,
  } as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/contracts" element={<ProjectContractsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Contrato: campos financeiros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.project.mockResolvedValue({ id: 7, company_id: 1, name: "Projeto", status: "active" });
    mocks.list.mockResolvedValue([legacy]);
    mocks.get.mockResolvedValue(legacy);
    mocks.create.mockResolvedValue(legacy);
    mocks.edit.mockResolvedValue(legacy);
    mocks.settings.mockResolvedValue({
      current: {
        values: {
          commercial_origins: [
            { code: "inbound", label: "Inbound", commission_pct: "6.00" },
            { code: "board", label: "Diretoria", commission_pct: "4.00" },
          ],
        },
      },
    });
  });

  it("um só campo de origem, rótulos de quem paga e percentuais por parcela com soma em tempo real", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "Novo contrato" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByLabelText(/^Origem comercial/)).toHaveLength(1);
    await within(dialog).findByRole("option", { name: "Inbound" });
    const expenses = within(dialog).getByLabelText("Despesas de campo por conta de");
    expect(within(expenses).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Não informado",
      "Cliente (reembolsável)",
      "Empresa (não reembolsável)",
    ]);
    expect(within(dialog).getByLabelText("Plaquetas por conta de")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Número do contrato"), "NOVO-9");
    await user.selectOptions(within(dialog).getByLabelText("Origem comercial"), "inbound");
    await user.selectOptions(expenses, "client");
    await user.selectOptions(within(dialog).getByLabelText("Forma de pagamento"), "percentages");
    const count = within(dialog).getByLabelText("Número de parcelas");
    await user.clear(count);
    await user.type(count, "3");
    expect(within(dialog).getByLabelText("Percentual da parcela 1")).toHaveValue("33,33");
    expect(within(dialog).getByLabelText("Percentual da parcela 3")).toHaveValue("33,34");
    expect(within(dialog).getByText(/Soma: 100,00%/)).toBeInTheDocument();
    const second = within(dialog).getByLabelText("Percentual da parcela 2");
    await user.clear(second);
    await user.type(second, "33.33");
    expect(second).toHaveValue("33,33");
    expect(within(dialog).getByText(/Soma: 100,00%/)).toBeInTheDocument();

    const first = within(dialog).getByLabelText("Percentual da parcela 1");
    await user.clear(first);
    await user.type(first, "30");
    expect(within(dialog).getByText(/Soma: 96,67% — precisa fechar 100% para salvar\./)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salvar contrato" }));
    expect(mocks.create).not.toHaveBeenCalled();

    const third = within(dialog).getByLabelText("Percentual da parcela 3");
    await user.clear(third);
    await user.type(third, "36,67");
    expect(within(dialog).getByText(/Soma: 100,00%/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salvar contrato" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        commercial_origin: null,
        commercial_origin_code: "inbound",
        expenses_paid_by: "client",
        tags_paid_by: null,
        payment_plan: { mode: "percentages", installments: 3, percentages: ["30", "33.33", "36.67"] },
      }),
    );
  });

  it("origem antiga em texto aparece só para leitura e é preservada ao salvar", async () => {
    const user = userEvent.setup();
    mount("/app/projects/7/contracts?contract=3");
    await user.click(await screen.findByRole("button", { name: "Editar contrato" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("note")).toHaveTextContent("Origem registrada anteriormente: Indicação do diretor");
    expect(within(dialog).queryByDisplayValue("Indicação do diretor")).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText("Origem comercial"), "board");
    expect(within(dialog).queryByRole("note")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Justificativa"), "Origem codificada");
    await user.click(within(dialog).getByRole("button", { name: /salvar/i }));
    await waitFor(() => expect(mocks.edit).toHaveBeenCalledTimes(1));
    expect(mocks.edit.mock.calls[0][2]).toEqual(
      expect.objectContaining({ commercial_origin: "Indicação do diretor", commercial_origin_code: "board" }),
    );
  });
});

describe("Contrato: forma de pagamento (funções)", () => {
  it("divide igualmente em centésimos, com o resto na última parcela", () => {
    expect(equalPercentages(1)).toEqual(["100.00"]);
    expect(equalPercentages(3)).toEqual(["33.33", "33.33", "33.34"]);
    expect(equalPercentages(7).reduce((s, v) => s + Math.round(Number(v) * 100), 0)).toBe(10000);
  });
  it("soma em centésimos, sem erro de ponto flutuante; valor inválido não fecha", () => {
    expect(percentSumCents(["33.33", "33.33", "33.34"])).toBe(10000);
    expect(percentSumCents(["0.1", "0.2", "99.7"])).toBe(10000);
    expect(percentSumCents(["50", "abc"])).toBeNaN();
  });
  it("vazio = não informada; iguais sem percentuais", () => {
    expect(paymentPlanFromForm("", "3", [])).toBeNull();
    expect(paymentPlanFromForm("equal", "3", [])).toEqual({ mode: "equal", installments: 3 });
    expect(paymentPlanFromForm("percentages", "2", ["40", "60,0"])).toEqual({
      mode: "percentages",
      installments: 2,
      percentages: ["40", "60.0"],
    });
  });
});
