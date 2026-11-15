import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import type { CurrentUser } from "@/types/api";
import { FinanceSettingsPage } from "./FinanceSettingsPage";
import {
  nextValidFrom,
  type FinanceSettingsOverview,
  type FinanceSettingsValues,
} from "./financeSettingsApi";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api/http", () => ({ api: { get: mocks.get, post: mocks.post } }));

const defaults: FinanceSettingsValues = {
  income_tax_pct: "13.33",
  tag_tax_pct: "16.00",
  default_daily_rate: "185.00",
  budget_productivity_items_per_day: 80,
  budgeted_non_reimbursable_expense_pct: "20.00",
  technician_expense_alert_pct: "30.00",
  commercial_origins: [
    { code: "recurring", label: "Recorrente", commission_pct: "4.00" },
    { code: "inbound", label: "Inbound", commission_pct: "6.00" },
  ],
  partner_commission_pct: "10.00",
  fixed_cost_operation: "10915.00",
  fixed_cost_branch: "3021.00",
  fixed_cost_item_modes: { additional_income_tax: "average_3_months", equipment: "average_3_months", back_office: "average_3_months" },
  fixed_cost_item_amounts: { additional_income_tax: "0.00", equipment: "0.00", back_office: "0.00" },
  economic_break_even_margin_pct: "10.00",
  first_installment_days_after_contract: 30,
  dre_regime_cutoff_month: "2026-09",
  expense_reasons: ["Transporte", "Refeição"],
  tag_models: ["Alumínio"],
  default_tag_supplier: "Planner",
  field_agent_document_max_bytes: 2097152,
  expense_attachment_max_bytes: 8388608,
  expense_attachment_max_files: 2,
  require_approval: true,
};
const empty: FinanceSettingsOverview = {
  organization_id: 1,
  today: "2026-11-13",
  earliest_fact_date: null,
  coverage_start: null,
  current: null,
  scheduled: null,
  versions: [],
  platform_max_upload_bytes: 104857600,
};
const version = {
  id: 5,
  organization_id: 1,
  version: 1,
  valid_from: "2026-11-01",
  values: defaults,
  reason: "Versão inicial",
  actor_id: null,
  actor_name: null,
  recorded_at: "2026-11-01T12:00:00.000Z",
};

function user(permissions: string[]): CurrentUser {
  return {
    id: 1,
    login: "u",
    email: "u@gai.local",
    status: "ACTIVE",
    organization_id: 1,
    role_assignments: [],
    permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" as const })),
  };
}
function renderPage(current: CurrentUser, path = "/app/finance/parameters") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: current, bootstrapping: false } as AuthState}>
        <MemoryRouter initialEntries={[path]}>
          <FinanceSettingsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Parâmetros financeiros", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lançamentos antes da primeira versão: aviso e versão retroativa sugerida com a data do mais antigo", async () => {
    const covered = { ...empty, earliest_fact_date: "2026-03-10", coverage_start: "2026-11-01", current: version, versions: [version] };
    mocks.get.mockResolvedValue({ data: covered });
    mocks.post.mockResolvedValue({ data: version });
    renderPage(user(["finance-settings:read", "finance-settings:update"]));
    expect(await screen.findByText(/sem parâmetro vigente/)).toHaveTextContent("Há lançamentos financeiros desde 10/03/2026");
    await userEvent.click(screen.getByRole("button", { name: "Publicar versão retroativa desde 10/03/2026" }));
    const form = await screen.findByRole("form", { name: "Nova versão dos parâmetros financeiros" });
    expect(within(form).getByLabelText("Vale a partir de")).toHaveValue("2026-03-10");
    expect(within(form).getByRole("alert")).toHaveTextContent(
      "Esta versão será aplicada a todos os lançamentos desde 10/03/2026 até 01/11/2026 (início da versão mais antiga).",
    );
  });

  it("link dos avisos (?valid_from=) abre o formulário já com a data retroativa", async () => {
    mocks.get.mockResolvedValue({ data: { ...empty, earliest_fact_date: "2026-10-01", coverage_start: "2026-11-01", current: version, versions: [version] } });
    renderPage(user(["finance-settings:read", "finance-settings:update"]), "/app/finance/parameters?valid_from=2026-10-05");
    const form = await screen.findByRole("form", { name: "Nova versão dos parâmetros financeiros" });
    expect(within(form).getByLabelText("Vale a partir de")).toHaveValue("2026-10-05");
    expect(within(form).getByRole("alert")).toHaveTextContent("desde 05/10/2026");
  });

  it("sem versão, quem pode alterar cria a primeira a partir dos valores padrão", async () => {
    mocks.get.mockImplementation((url: string) =>
      Promise.resolve({ data: url.endsWith("/defaults") ? defaults : empty }),
    );
    mocks.post.mockResolvedValue({ data: version });
    renderPage(user(["finance-settings:read", "finance-settings:update"]));
    expect(await screen.findByText("A organização ainda não tem parâmetros financeiros.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Criar com valores padrão" }));
    const form = await screen.findByRole("form", { name: "Nova versão dos parâmetros financeiros" });
    expect(within(form).getByLabelText("Vale a partir de")).toHaveValue("2026-11-13");
    const rate = within(form).getByLabelText("Diária padrão do inventariante (R$)");
    await userEvent.clear(rate);
    await userEvent.type(rate, "190,50");
    await userEvent.click(within(form).getByRole("button", { name: "Salvar versão" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    const [url, payload] = mocks.post.mock.calls[0];
    expect(url).toBe("/finance-settings");
    expect(payload).toMatchObject({
      valid_from: "2026-11-13",
      reason: "Versão inicial com os valores padrão",
      // corte da DRE automática acompanha o início da 1ª versão (por organização)
      values: { ...defaults, default_daily_rate: "190.50", dre_regime_cutoff_month: "2026-11" },
    });
  });

  it("sem permissão de alterar, só informa que falta configurar", async () => {
    mocks.get.mockResolvedValue({ data: empty });
    renderPage(user(["finance-settings:read"]));
    expect(await screen.findByText(/Peça a um administrador/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criar com valores padrão/i })).not.toBeInTheDocument();
  });

  it("mostra a versão vigente e o histórico; versão do seed aparece como Sistema", async () => {
    mocks.get.mockResolvedValue({ data: { ...empty, current: version, versions: [version] } });
    renderPage(user(["finance-settings:read"]));
    const current = await screen.findByRole("region", { name: "Versão vigente" });
    expect(within(current).getByText("Versão 1 · vale a partir de 01/11/2026")).toBeInTheDocument();
    expect(within(current).getByText("13,33%")).toBeInTheDocument();
    expect(within(current).getByText("Recorrente 4,00% · Inbound 6,00%")).toBeInTheDocument();
    const history = screen.getByRole("region", { name: "Histórico de versões" });
    expect(within(history).getByText("Sistema (valores padrão)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova versão" })).not.toBeInTheDocument();
  });

  it("modo fixo mostra o valor ao lado e o formulário exige o valor", async () => {
    const fixed = {
      ...version,
      values: {
        ...defaults,
        fixed_cost_item_modes: { ...defaults.fixed_cost_item_modes, equipment: "fixed" as const },
        fixed_cost_item_amounts: { ...defaults.fixed_cost_item_amounts, equipment: "1200.00" },
      },
    };
    mocks.get.mockResolvedValue({ data: { ...empty, current: fixed, versions: [fixed] } });
    renderPage(user(["finance-settings:read", "finance-settings:update"]));
    const current = await screen.findByRole("region", { name: "Versão vigente" });
    expect(within(current).getByText("Valor fixo · R$ 1.200,00")).toBeInTheDocument();
    expect(within(current).getAllByText("Média dos últimos 3 meses")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Nova versão" }));
    const form = await screen.findByRole("form", { name: "Nova versão dos parâmetros financeiros" });
    const amount = within(form).getByLabelText("Equipamentos: valor fixo (R$/mês)");
    expect(amount).toHaveValue("1200.00");
    expect(amount).toBeRequired();
    await userEvent.selectOptions(within(form).getByLabelText("Back-office"), "fixed");
    expect(within(form).getByLabelText("Back-office: valor fixo (R$/mês)")).toBeRequired();
  });

  it("nova versão começa hoje, ou no dia seguinte à última vigência", () => {
    expect(nextValidFrom(empty)).toBe("2026-11-13");
    expect(nextValidFrom({ ...empty, versions: [version] })).toBe("2026-11-13");
    expect(nextValidFrom({ ...empty, versions: [{ ...version, valid_from: "2026-11-13" }] })).toBe("2026-11-14");
    expect(nextValidFrom({ ...empty, versions: [{ ...version, valid_from: "2026-12-31" }] })).toBe("2027-01-01");
  });
});
