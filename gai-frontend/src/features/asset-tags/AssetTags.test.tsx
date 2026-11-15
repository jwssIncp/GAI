import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { AssetTagsPage } from "./AssetTagsPage";
import type { AssetTagList, AssetTagRow } from "./assetTagsApi";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("./assetTagsApi", async (original) => ({ ...(await original<object>()), assetTagsApi: mocks }));

function mount(permissions = ["asset-tag-orders:read", "asset-tag-orders:edit"], path = "/app/finance/asset-tags") {
  const auth = {
    user: { id: 1, organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })) },
    bootstrapping: false,
  } as unknown as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <AssetTagsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const row = (id: number, patch: Partial<AssetTagRow> = {}): AssetTagRow => ({
  id,
  project_id: 10,
  project_name: "Alfa",
  proposal_number: `P-${id}`,
  ordered_on: "2026-10-01",
  quantity: 1000,
  sequence_start: 1001,
  sequence_end: 2000,
  quantity_from_sequence: true,
  model: "Alumínio",
  supplier_name: "Planner",
  unit_cost: "0.8500",
  supplier_payment_status: "pending",
  supplier_expected_payment_on: "2026-10-20",
  supplier_paid_on: null,
  unit_price: "2.5000",
  client_expected_receipt_on: "2026-11-30",
  client_received: false,
  client_received_on: null,
  expense_type: "reimbursable",
  expense_type_source: "contract",
  contract_expense_type: "reimbursable",
  tax_pct: "16.00",
  cost_total: "850.00",
  value_total: "2500.00",
  net_value: "2100.00",
  net_profit: "1250.00",
  notes: null,
  updated_at: "2026-10-01T00:00:00.000Z",
  ...patch,
});

const data = (): AssetTagList => ({
  today: "2026-11-13",
  parameters: { configured: true, tag_tax_pct: "16.00", tag_models: ["Alumínio", "Aço", "Policarbonato"], default_tag_supplier: "Planner" },
  projects: [{ id: 10, name: "Alfa", open: true }, { id: 11, name: "Beta", open: true }],
  kpis: { purchased: 1200, supplier_pending: 1000, to_receive: 1200, cost_total: "1450.00", value_total: "3100.00", net_profit: "1154.00", missing_tax_count: 0, missing_tax_since: null },
  totals: { count: 2, quantity: 1200, cost_total: "1450.00", value_total: "3100.00", net_value: "2604.00", net_profit: "1154.00", missing_tax_count: 0 },
  items: [
    row(1),
    row(2, { quantity: 200, sequence_start: null, sequence_end: null, quantity_from_sequence: false, unit_cost: "3.0000", unit_price: "3.0000", cost_total: "600.00", value_total: "600.00", net_value: "504.00", net_profit: "-96.00", expense_type: "non_reimbursable", expense_type_source: "manual" }),
  ],
});

describe("Placas de patrimônio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(data());
    mocks.update.mockResolvedValue({ id: 2, changed: ["Quantidade"] });
    mocks.create.mockResolvedValue({ id: 3 });
  });

  it("KPIs, líquido com o % dos parâmetros, lucro negativo em vermelho e qtd da sequência só leitura", async () => {
    mount();
    const kpis = within(await screen.findByRole("region", { name: "Indicadores das placas" }));
    expect(kpis.getByText("Placas compradas").nextSibling).toHaveTextContent("1.200");
    expect(kpis.getByText("Lucro líquido").nextSibling).toHaveTextContent("R$ 1.154,00");
    const table = within(screen.getByRole("region", { name: "Pedidos de placas" }));
    expect(table.getByRole("columnheader", { name: "Líquido (−16,00%)" })).toBeInTheDocument();
    expect(table.getByText("-R$ 96,00")).toHaveClass("text-destructive");
    expect(table.getByTitle("Calculada pela sequência (fim − início + 1)")).toHaveTextContent("1.000");
    expect(table.getByText(/Não reembolsável ✎/)).toBeInTheDocument();
  });

  it("pedido sem % de impostos não apaga o lucro: soma os calculáveis e mostra a nota com link retroativo", async () => {
    const d = data();
    d.kpis = { ...d.kpis, net_profit: "1250.00", missing_tax_count: 1, missing_tax_since: "2026-10-05" };
    d.items[1] = { ...d.items[1], tax_pct: null, net_value: null, net_profit: null };
    mocks.list.mockResolvedValue(d);
    mount();
    const kpis = within(await screen.findByRole("region", { name: "Indicadores das placas" }));
    expect(kpis.getByText("Lucro líquido").nextSibling).toHaveTextContent("R$ 1.250,00");
    expect(kpis.getByText("1 pedido(s) sem % de impostos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Publicar versão dos parâmetros desde 05/10/2026" })).toHaveAttribute("href", "/app/finance/parameters?valid_from=2026-10-05");
  });

  it("edição em linha confirma De/Para antes de gravar", async () => {
    const u = userEvent.setup();
    mount();
    const table = within(await screen.findByRole("region", { name: "Pedidos de placas" }));
    await u.click(table.getAllByRole("button", { name: "Editar Quantidade" })[0]);
    const input = table.getByLabelText("Quantidade");
    await u.clear(input);
    await u.type(input, "250{Enter}");
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/De/).textContent).toMatch(/De 200 para 250\?/);
    expect(mocks.update).not.toHaveBeenCalled();
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(2, { quantity: 250 }));
  });

  it("custo unitário aceita vírgula e até 4 casas; cancelar a confirmação não grava", async () => {
    const u = userEvent.setup();
    mount();
    const table = within(await screen.findByRole("region", { name: "Pedidos de placas" }));
    await u.click(table.getAllByRole("button", { name: "Editar Custo unitário" })[0]);
    const input = table.getByLabelText("Custo unitário");
    await u.clear(input);
    await u.type(input, "0,345{Enter}");
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/De/).textContent).toMatch(/De R\$ 0,85 para R\$ 0,345\?/);
    await u.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("novo pedido: quantidade calculada pela sequência e fornecedor padrão", async () => {
    const u = userEvent.setup();
    mount(undefined, "/app/finance/asset-tags?project_id=10");
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith({ project_id: 10 }));
    await u.click(await screen.findByRole("button", { name: /Novo pedido/ }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Fornecedor")).toHaveValue("Planner");
    await u.type(dialog.getByLabelText("Sequência inicial"), "1");
    await u.type(dialog.getByLabelText("Sequência final"), "500");
    expect(dialog.getByLabelText("Quantidade")).toHaveValue("500");
    expect(dialog.getByLabelText("Quantidade")).toBeDisabled();
    await u.type(dialog.getByLabelText("Custo unitário (R$)"), "0,90");
    await u.type(dialog.getByLabelText("Valor unitário ao cliente (R$)"), "2,10");
    await u.click(dialog.getByRole("button", { name: "Lançar pedido" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ project_id: 10, sequence_start: 1, sequence_end: 500, unit_cost: "0.90", unit_price: "2.10", supplier_name: "Planner" })),
    );
  });

  it("só leitura: sem lançar, editar ou excluir", async () => {
    mount(["asset-tag-orders:read"]);
    await screen.findByRole("region", { name: "Pedidos de placas" });
    expect(screen.queryByRole("button", { name: /Novo pedido/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Editar / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir pedido/ })).not.toBeInTheDocument();
  });
});
