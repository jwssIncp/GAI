import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceLayout } from "../receivables/FinanceLayout";
import { DreLayout } from "./DreLayout";
import { DreAccountsPage } from "./DreAccountsPage";
import { DreEntryForm } from "./DreEntriesPage";
import { DreReportPage } from "./DreReportPage";
import { dreApi } from "./dreApi";
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 2, organization_id: 1 } }),
}));
const grants = new Set([
  "dre:read",
  "dre:configure",
  "dre:classify",
  "projects:read",
]);
vi.mock("@/features/auth/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (k: string) => grants.has(k),
    isPlatformAdmin: false,
  }),
}));
vi.mock("@/api/http", () => ({ api: { get: vi.fn().mockResolvedValue({ data: { id: 25, name: "SINTETICO Projeto autorizado" } }) } }));
vi.mock("./dreApi", async (original) => ({
  ...(await original<typeof import("./dreApi")>()),
  dreApi: { accounts: vi.fn(), report: vi.fn(), createAccount: vi.fn() },
}));
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
            <Route path="dre" element={<DreLayout />}>
              <Route index element={<DreReportPage />} />
              <Route path="accounts" element={<DreAccountsPage />} />
              <Route path="entries" element={<p>Lista de eventos</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  grants.add("dre:configure");
  vi.mocked(dreApi.accounts).mockResolvedValue([]);
  vi.mocked(dreApi.report).mockResolvedValue({
    engine_version: "managerial-accrual-v1",
    organization_id: 1,
    filters: {},
    generated_at: "2026-10-28",
    complete: false,
    totals: [],
    monthly: [],
    by_project: [],
    rows: [],
    unclassified: [],
    pending_sources: [],
    stale_sources: [],
    warnings: ["Cobertura incompleta não equivale a zero."],
    periods: [],
    entry_versions: [],
    source_permissions: [],
    comparison: null,
  });
});
describe("DRE nested navigation and explicit classification", () => {
  it("keeps both shared layouts and project scope across nonsequential navigation", async () => {
    mount("/app/finance/dre?project_id=25");
    await screen.findByText("Cobertura incompleta não equivale a zero.");
    fireEvent.click(screen.getByRole("link", { name: "Plano de contas" }));
    await screen.findByRole("button", { name: "Nova conta gerencial" });
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/app/finance/dre/accounts?project_id=25",
    );
    expect(
      await screen.findByRole("link", { name: "Retornar ao projeto" }),
    ).toHaveAttribute("href", "/app/projects/25/summary");
    fireEvent.click(
      screen.getByRole("link", { name: "Classificações e ajustes" }),
    );
    expect(await screen.findByText("Lista de eventos")).toBeVisible();
    fireEvent.click(screen.getByRole("link", { name: "Demonstrativo" }));
    await screen.findByText("Cobertura incompleta não equivale a zero.");
    expect(
      screen.getByRole("navigation", { name: "Navegação da DRE" }),
    ).toBeVisible();
  });
  it("allows clearing a project filter instead of retaining stale scope", async () => {
    mount("/app/finance/dre?project_id=25");
    await screen.findByText("Cobertura incompleta não equivale a zero.");
    fireEvent.change(screen.getByLabelText("Projeto (ID, opcional)"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar DRE" }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).not.toHaveTextContent(
        "project_id",
      ),
    );
  });
  it("does not expose account mutation to read-only users", async () => {
    grants.delete("dre:configure");
    mount("/app/finance/dre/accounts");
    await screen.findByText(/Plano de contas gerencial da organização/);
    expect(
      screen.queryByRole("button", { name: "Nova conta gerencial" }),
    ).not.toBeInTheDocument();
  });
  it("sends documented economic month and exact amount rather than inferring payment date", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<DreEntryForm accounts={[]} onSave={save} />);
    fireEvent.change(screen.getByLabelText("Chave do fato econômico"), {
      target: { value: "synthetic-economic-event" },
    });
    fireEvent.change(screen.getByLabelText("Documento e evidência do evento"), {
      target: { value: "Sintetico documento de janeiro" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Sintetico serviço prestado" },
    });
    fireEvent.change(screen.getByLabelText("Competência 1"), {
      target: { value: "2026-01" },
    });
    fireEvent.change(screen.getByLabelText("Valor 1"), {
      target: { value: "100.01" },
    });
    fireEvent.change(screen.getByLabelText("Justificativa"), {
      target: { value: "Teste sintetico explicito" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Confirmar reconhecimento" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          source_kind: "manual",
          allocations: [
            { month: "2026-01", amount: "100.01", account_id: null },
          ],
        }),
      ),
    );
  });
});
