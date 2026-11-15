import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ExpenseProjectsPage } from "./ExpenseProjectsPage";
import type { ExpenseProjectRow } from "./expensesApi";

const mocks = vi.hoisted(() => ({ projects: vi.fn() }));
vi.mock("./expensesApi", async (original) => ({ ...(await original<object>()), expensesApi: mocks }));

const row = (id: number, patch: Partial<ExpenseProjectRow> = {}): ExpenseProjectRow => ({
  id,
  name: `Projeto ${id}`,
  status: "active",
  status_label: "Em andamento",
  contract_value: "10000.00",
  to_reimburse: "300.00",
  reimbursable: "500.00",
  non_reimbursable: "200.00",
  unclassified_count: 0,
  expenses_count: 3,
  contract_pct: "7.00",
  contract_pct_alert: false,
  finance_closed: false,
  scope: ["Inventário"],
  ...patch,
});

describe("Financeiro › Despesas (Tela A)", () => {
  it("selo com o total a reembolsar de todos os projetos, % do contrato acima de 100% em destaque e financeiro concluído", async () => {
    mocks.projects.mockResolvedValue({
      items: [row(1), row(2, { contract_pct: "112.50", contract_pct_alert: true, finance_closed: true, unclassified_count: 2 })],
      total_to_reimburse: "1250.00",
      subtotal_to_reimburse: "600.00",
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ExpenseProjectsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/A reembolsar \(todos os projetos\)/)).toHaveTextContent("R$ 1.250,00");
    const table = within(screen.getByRole("region", { name: "Despesas por projeto" }));
    expect(table.getByText("112,50%")).toHaveClass("text-destructive");
    expect(table.getByText("+2 sem tipo")).toBeInTheDocument();
    expect(table.getByRole("link", { name: "Projeto 2" })).toHaveAttribute("href", "/app/projects/2/finance");
    expect(table.getAllByText("Sim")).toHaveLength(1);
    expect(table.getByText(/Subtotal dos projetos exibidos \(2\)/).parentElement).toHaveTextContent("R$ 600,00");
  });
});
