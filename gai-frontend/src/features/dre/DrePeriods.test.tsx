import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrePeriodsPage } from "./DrePeriodsPage";

const dre = vi.hoisted(() => ({ periods: vi.fn(), period: vi.fn(), close: vi.fn(), reopen: vi.fn() }));
const closing = vi.hoisted(() => ({ checklist: vi.fn(), freezePreview: vi.fn(), freeze: vi.fn() }));
vi.mock("./dreApi", async (original) => ({ ...(await original<object>()), dreApi: dre }));
vi.mock("./dreMonthlyApi", async (original) => ({ ...(await original<object>()), dreClosingApi: closing }));
vi.mock("@/features/auth/AuthContext", async (original) => ({ ...(await original<object>()), useAuth: () => ({ user: { id: 1 } }) }));
vi.mock("@/features/auth/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const period = (month: string, over: object = {}) => ({
  id: 1,
  month,
  revision: 1,
  closed: true,
  has_grid: true,
  data: { currency: "BRL", policy_reference: "Politica do teste", reviewed_groups: [], sources_reviewed: false, hash: "h", snapshot: { complete: true } },
  ...over,
});
function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DrePeriodsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Competências da DRE (etapa 10)", () => {
  beforeEach(() => {
    Object.values(dre).forEach((m) => m.mockReset());
    Object.values(closing).forEach((m) => m.mockReset());
  });

  it("fechamento a partir do corte: bloqueio impede; avisos exigem ciência e são enviados", async () => {
    dre.periods.mockResolvedValue([period("2026-09", { closed: false, revision: 0 })]);
    closing.checklist.mockResolvedValueOnce({ month: "2026-09", cutoff: "2026-09", automatic: true, blockers: [{ code: "unmapped_kinds", message: "Movimentos de 09/2026 sem conta associada na DRE: Inventariantes (diárias)." }], warnings: [] });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Fechar 2026-09" }));
    expect(await screen.findByText(/sem conta associada/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar fechamento" })).toBeDisabled();
    // o formulário antigo (grupos revisados / fechamento parcial) não aparece na DRE automática
    expect(screen.queryByText(/autoriza fechamento parcial/)).toBeNull();
  });

  it("aviso de itens previstos: ciência obrigatória e enviada no fechamento", async () => {
    dre.periods.mockResolvedValue([period("2026-09", { closed: false, revision: 0 })]);
    closing.checklist.mockResolvedValue({ month: "2026-09", cutoff: "2026-09", automatic: true, blockers: [], warnings: [{ code: "open_items", message: "1 movimento(s) ainda previstos com data em 09/2026 serão congelados como estão.", count: 1, amount: "20.00" }] });
    dre.close.mockResolvedValue({});
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Fechar 2026-09" }));
    const ack = await screen.findByRole("checkbox", { name: /Ciente: 1 movimento/ });
    expect(ack).toBeRequired();
    await userEvent.click(ack);
    await userEvent.type(screen.getByLabelText("Justificativa"), "Fechamento mensal");
    await userEvent.click(screen.getByRole("checkbox", { name: /Confirmo o efeito/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar fechamento" }));
    await waitFor(() => expect(dre.close).toHaveBeenCalled());
    expect(dre.close.mock.calls[0][1]).toMatchObject({ acknowledged: ["open_items"] });
  });

  it("mês fechado antes da DRE mensal: mostra a diferença por linha e congela só com motivo", async () => {
    dre.periods.mockResolvedValue([period("2026-08", { has_grid: false, revision: 3 })]);
    closing.freezePreview.mockResolvedValue({
      month: "2026-08",
      revision: 3,
      lines: [
        { key: "revenue", label: "Receita bruta", stored: "0.00", recalculated: "10000.00", difference: "10000.00" },
        { key: "deductions", label: "Deduções da receita", stored: "1333.00", recalculated: "1333.00", difference: "0.00" },
      ],
      accounts: [],
    });
    closing.freeze.mockResolvedValue({});
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Congelar coluna 2026-08" }));
    const row = (await screen.findByText("Receita bruta")).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Receita bruta", "R$ 0,00", "R$ 10.000,00", "R$ 10.000,00"]);
    await userEvent.click(screen.getByRole("button", { name: "Congelar coluna" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("motivo");
    expect(closing.freeze).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Motivo do congelamento"), "Conferido com o contador");
    await userEvent.click(screen.getByRole("button", { name: "Congelar coluna" }));
    await waitFor(() => expect(closing.freeze).toHaveBeenCalledWith("2026-08", 3, "Conferido com o contador"));
  });
});
