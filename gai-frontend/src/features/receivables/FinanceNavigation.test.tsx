import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinanceLayout } from "./FinanceLayout";
import { ReceivablesPage } from "./ReceivablesPage";
import { ReceivableDetailPage } from "./ReceivableDetailPage";
import { ReceivableForm } from "./ReceivableForm";
import { CashFlowPage } from "./CashFlowPage";
import { financeApi, type Receivable } from "./financeApi";
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 2, organization_id: 1 } }),
}));
const grants = new Set([
  "receivables:read",
  "receivables:edit",
  "receivables:receive",
  "receivables:reverse",
  "cash-flow:read",
]);
vi.mock("@/features/auth/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (k: string) => grants.has(k),
    isPlatformAdmin: false,
  }),
}));
vi.mock("./financeApi", async (original) => ({
  ...(await original<typeof import("./financeApi")>()),
  financeApi: {
    list: vi.fn(),
    detail: vi.fn(),
    cash: vi.fn(),
    preview: vi.fn(),
    create: vi.fn(),
    command: vi.fn(),
    edit: vi.fn(),
  },
}));
const row: Receivable = {
  id: 7,
  organizationId: 1,
  companyId: 1,
  projectId: 25,
  contractId: null,
  sourceKey: null,
  amount: "10.01",
  currency: "BRL",
  revision: 1,
  cancelled: false,
  data: {
    company_id: 1,
    project_id: 25,
    origin: "manual",
    description: "SINTETICO navegação",
    amount: "10.01",
    currency: "BRL",
    issued_on: "2026-01-01",
    reason: "Teste sintético",
    payment: { mode: "equal", count: 1, first_due_on: "2026-01-31" },
  },
  received: "0.00",
  open: "10.01",
  status: "open",
  overdue: true,
  installments: [
    {
      id: 9,
      position: 1,
      kind: "installment",
      dueOn: "2026-01-31",
      amount: "10.01",
      received: "0.00",
      open: "10.01",
      status: "open",
      overdue: true,
    },
  ],
  events: [],
};
function Location() {
  const l = useLocation();
  return <output data-testid="location">{l.pathname + l.search}</output>;
}
function mount(path: string) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Location />
        <Routes>
          <Route path="/app/finance" element={<FinanceLayout />}>
            <Route path="receivables" element={<ReceivablesPage />} />
            <Route path="receivables/new" element={<ReceivableForm />} />
            <Route
              path="receivables/:receivableId"
              element={<ReceivableDetailPage />}
            />
            <Route path="cash-flow" element={<CashFlowPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  grants.add("receivables:edit");
  vi.mocked(financeApi.list).mockResolvedValue({
    items: [row],
    total: 1,
    page: 1,
    page_size: 20,
  });
  vi.mocked(financeApi.detail).mockResolvedValue(row);
  vi.mocked(financeApi.cash).mockResolvedValue({
    totals: [],
    monthly: [],
    by_client: [],
    by_project: [],
    movements: [],
    limitations: ["Projeção parcial"],
    undated_expenses: 0,
    undated_payments: 0,
    definitions: {},
  });
});
describe("Financial navigation through real nested routes", () => {
  it("navigates list → detail → cash → list with persistent financial navigation", async () => {
    mount("/app/finance/receivables?project_id=25");
    const nav = screen.getByRole("navigation", {
      name: "Navegação financeira",
    });
    fireEvent.click(
      await screen.findByRole("link", { name: "SINTETICO navegação" }),
    );
    await screen.findByRole("heading", { name: "SINTETICO navegação" });
    expect(screen.getByTestId("location")).toHaveTextContent("project_id=25");
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(screen.getByTestId("location")).toHaveTextContent("tab=history");
    expect(screen.getByTestId("location")).toHaveTextContent("project_id=25");
    fireEvent.click(screen.getByRole("link", { name: "Fluxo de caixa" }));
    await screen.findByText("Projeção parcial");
    expect(financeApi.cash).toHaveBeenCalledWith({ project_id: "25" });
    expect(
      screen.getByRole("navigation", { name: "Navegação financeira" }),
    ).toBe(nav);
    fireEvent.click(screen.getByRole("link", { name: "Recebíveis" }));
    await screen.findByRole("link", { name: "SINTETICO navegação" });
  });
  it("keeps project filter when switching financial tabs directly", async () => {
    mount("/app/finance/receivables?project_id=25");
    await screen.findByRole("link", { name: "SINTETICO navegação" });
    fireEvent.click(screen.getByRole("link", { name: "Fluxo de caixa" }));
    await waitFor(() =>
      expect(financeApi.cash).toHaveBeenCalledWith({ project_id: "25" }),
    );
  });
  it("hides creation for a read-only custom profile", async () => {
    grants.delete("receivables:edit");
    mount("/app/finance/receivables");
    await screen.findByRole("link", { name: "SINTETICO navegação" });
    expect(
      screen.queryByRole("link", { name: "Novo recebível" }),
    ).not.toBeInTheDocument();
  });
  it("loads a direct history URL and uses backend balances", async () => {
    mount("/app/finance/receivables/7?tab=history");
    await screen.findByRole("heading", { name: "SINTETICO navegação" });
    expect(financeApi.detail).toHaveBeenCalledWith("7");
    expect(
      screen.getByText("Recebido líquido de estornos"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Histórico" }),
    ).toBeInTheDocument();
  });
  it("requires a server preview and explicit confirmation before creating", async () => {
    vi.mocked(financeApi.preview).mockResolvedValue({
      preview_hash: "a".repeat(64),
      data: row.data,
      plan: {
        rows: [
          {
            position: 1,
            kind: "installment",
            due_on: "2026-01-31",
            amount: "10.01",
          },
        ],
      },
    });
    vi.mocked(financeApi.create).mockResolvedValue(row);
    mount("/app/finance/receivables/new");
    for (const [label, value] of [
      ["Cliente (ID)", "1"],
      ["Descrição", "SINTETICO navegação"],
      ["Valor total (decimal)", "10.01"],
      ["Justificativa", "Teste sintético"],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(
      screen.getByRole("button", { name: "Gerar prévia de parcelas" }),
    );
    await screen.findByRole("button", {
      name: "Confirmar criação do recebível",
    });
    expect(financeApi.create).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar criação do recebível" }),
    );
    await waitFor(() => expect(financeApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(financeApi.create).mock.calls[0][1]).toBe("a".repeat(64));
  });
});
