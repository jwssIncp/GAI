import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { CommissionsPage } from "./CommissionsPage";
import { commissionAmount, normalizePercent, type CommissionList, type CommissionRow } from "./commissionsApi";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), partners: vi.fn(), createPartner: vi.fn(), removePartner: vi.fn() }));
vi.mock("./commissionsApi", async (original) => ({ ...(await original<object>()), commissionsApi: mocks }));

const all = ["commissions:read", "commissions:edit", "commission-partners:edit"];
function mount(permissions = all) {
  const auth = {
    user: { id: 1, organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })) },
    bootstrapping: false,
  } as unknown as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <CommissionsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const row = (id: number, patch: Partial<CommissionRow> = {}): CommissionRow => ({
  id,
  project_id: 10,
  project_name: "Alfa",
  contract_id: 1,
  partner_id: 5,
  partner_name: "Ana (Ação)",
  contract_value: "100000.00",
  percent: "4.00",
  calculated_amount: "4000.00",
  amount_manual: null,
  amount: "4000.00",
  expected_payment_on: "2026-12-10",
  paid_on: null,
  status: "pending",
  notes: null,
  updated_at: "2026-11-01T00:00:00.000Z",
  ...patch,
});
const partners = [{ id: 5, name: "Ana", company: "Ação", label: "Ana (Ação)", commissions: 3 }];
const data = (): CommissionList => ({
  today: "2026-11-13",
  kpis: { total: "15121.00", paid: "2000.00", pending: "5121.00", overdue: "8000.00", overdue_count: 1 },
  totals: { count: 3, contract_value: "285350.00", amount: "15121.00" },
  projects: [
    { id: 10, name: "Alfa", open: true, contract_value: "100000.00" },
    { id: 11, name: "Beta", open: true, contract_value: "85350.00" },
  ],
  partners,
  items: [
    row(1, { status: "overdue", percent: "8.00", amount: "8000.00", calculated_amount: "8000.00", expected_payment_on: "2026-01-15" }),
    row(2, { status: "paid", percent: "2.00", amount: "3500.00", calculated_amount: "2000.00", amount_manual: "3500.00", paid_on: "2026-02-03" }),
    row(3),
  ],
});

describe("Comissões", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(data());
    mocks.partners.mockResolvedValue(partners);
    mocks.update.mockResolvedValue({ id: 2, changed: [] });
    mocks.create.mockResolvedValue({ id: 9 });
  });

  it("exclusão recusada mostra o motivo no diálogo (antes falhava sem mensagem)", async () => {
    mocks.remove.mockRejectedValue(new Error("Não é possível excluir a comissão: a competência 01/2026 está fechada na DRE. Reabra a competência 01/2026 na DRE (exige permissão e justificativa) e lance novamente."));
    mount();
    await userEvent.click((await screen.findAllByRole("button", { name: "Excluir comissão de Ana (Ação) em Alfa" }))[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Não é possível excluir a comissão: a competência 01/2026 está fechada na DRE. Reabra a competência 01/2026 na DRE (exige permissão e justificativa) e lance novamente.");
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it("KPIs em R$ com atrasadas em destaque, status automático e valor manual marcado", async () => {
    mount();
    const kpis = within(await screen.findByRole("region", { name: "Indicadores das comissões" }));
    expect(kpis.getByText("Atrasadas").nextSibling).toHaveTextContent("R$ 8.000,00");
    expect(kpis.getByText("Atrasadas").nextSibling).toHaveClass("text-destructive");
    const table = within(screen.getByRole("region", { name: "Lançamentos de comissões" }));
    expect(table.getByText("Atrasado")).toBeInTheDocument();
    expect(table.getByText("Pago")).toBeInTheDocument();
    expect(table.getByTitle("Informado à mão (calculado: R$ 2.000,00)")).toHaveTextContent("manual");
  });

  it("apagar o valor manual volta ao cálculo (com confirmação De/Para)", async () => {
    const u = userEvent.setup();
    mount();
    const table = within(await screen.findByRole("region", { name: "Lançamentos de comissões" }));
    await u.click(table.getAllByRole("button", { name: "Editar Valor da comissão" })[1]);
    await u.clear(table.getByLabelText("Valor da comissão"));
    await u.keyboard("{Enter}");
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/De/).textContent).toMatch(/De R\$\s3\.500,00 para \(vazio\)\?/);
    await u.click(dialog.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(2, { amount_manual: null }));
  });

  it("nova comissão: valor do contrato vem do projeto (e muda ao trocar) e mostra o calculado", async () => {
    const u = userEvent.setup();
    mount();
    await u.click(await screen.findByRole("button", { name: /Nova comissão/ }));
    const dialog = within(screen.getByRole("dialog"));
    await u.selectOptions(dialog.getByLabelText("Contrato"), "10");
    expect(dialog.getByLabelText("Valor do contrato (R$)")).toHaveValue("100.000,00");
    await u.selectOptions(dialog.getByLabelText("Contrato"), "11");
    expect(dialog.getByLabelText("Valor do contrato (R$)")).toHaveValue("85.350,00");
    await u.selectOptions(dialog.getByLabelText("Parceiro"), "5");
    await u.type(dialog.getByLabelText("% comissão"), "6");
    expect(dialog.getByText(/Calculado: R\$ 5\.121,00/)).toBeInTheDocument();
    await u.click(dialog.getByRole("button", { name: "Lançar comissão" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({ project_id: 11, partner_id: 5, contract_value: "85350.00", percent: "6.00", amount_manual: null, expected_payment_on: null, paid_on: null }),
    );
  });

  it("parceiro rápido pelo seletor: duplicado avisa e seleciona o existente", async () => {
    const u = userEvent.setup();
    mocks.createPartner.mockRejectedValue(new Error("Parceiro já cadastrado: Ana (Ação)."));
    mount();
    await u.click(await screen.findByRole("button", { name: /Nova comissão/ }));
    const dialog = within(screen.getByRole("dialog"));
    await u.selectOptions(dialog.getByLabelText("Parceiro"), "__add__");
    await u.type(dialog.getByLabelText("Nome do parceiro"), "ana");
    await u.type(dialog.getByLabelText("Empresa do parceiro"), "AÇÃO");
    await u.click(dialog.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(dialog.getByLabelText("Parceiro")).toHaveValue("5"));
  });

  it("excluir parceiro pede confirmação e avisa que as comissões mantêm o nome", async () => {
    const u = userEvent.setup();
    mount();
    await u.click(await screen.findByRole("button", { name: /Parceiros \(1\)/ }));
    await u.click(await screen.findByRole("button", { name: "Excluir parceiro Ana (Ação)" }));
    expect(screen.getByText(/As 3 comissão\(ões\) já lançadas mantêm o nome/)).toBeInTheDocument();
    expect(mocks.removePartner).not.toHaveBeenCalled();
  });

  it("só leitura: sem lançar nem editar", async () => {
    mount(["commissions:read"]);
    await screen.findByRole("region", { name: "Lançamentos de comissões" });
    expect(screen.queryByRole("button", { name: /Nova comissão/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Editar / })).not.toBeInTheDocument();
  });

  it("fórmulas do front iguais às da API", () => {
    expect(commissionAmount("12345.67", "8.00")).toBe("987.65");
    expect(commissionAmount("0.30", "2.50")).toBe("0.01");
    expect(normalizePercent("4,5")).toBe("4.50");
    expect(normalizePercent("101")).toBeNull();
  });
});
