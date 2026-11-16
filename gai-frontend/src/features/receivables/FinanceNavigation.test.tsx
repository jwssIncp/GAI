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
import { cashFlowApi } from "./cashFlowBoardApi";
vi.mock("./cashFlowBoardApi", async (original) => ({
  ...(await original<typeof import("./cashFlowBoardApi")>()),
  cashFlowApi: { board: vi.fn() },
  // Indicadores do fluxo (etapa 8): sem parâmetros vigentes, sem rede.
  indicatorsApi: {
    get: vi.fn(async () => ({ configured: false, as_of: "2026-11-14", reference: { month: "2026-11", year: "2026" } })),
  },
}));
// Seletores com busca pelo nome (EntityCombobox): clientes e projetos simulados.
const companies = [{ id: 1, name: "Cliente Um", corporate_name: "Cliente Um Ltda", document: null }];
const projects = [{ id: 25, name: "Projeto Vinte e Cinco", code: "P-25", company_name: "Cliente Um" }];
vi.mock("@/api/http", () => ({
  api: {
    get: vi.fn(async (url: string) => {
      const byId = /^\/(companies|projects)\/(\d+)$/.exec(url);
      if (byId) {
        const list = byId[1] === "companies" ? companies : projects;
        return { data: list.find((x) => x.id === Number(byId[2])) };
      }
      if (url === "/companies") return { data: { items: companies, total_pages: 1 } };
      if (url === "/projects") return { data: { items: projects, total_pages: 1 } };
      throw new Error("GET não simulado: " + url);
    }),
  },
}));
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
/** Escolhe o cliente pelo nome no seletor com busca (o ID vai no campo oculto). */
async function chooseClient() {
  const box = await screen.findByRole("combobox", { name: "Cliente" });
  fireEvent.focus(box);
  fireEvent.change(box, { target: { value: "Cliente" } });
  fireEvent.mouseDown(await screen.findByRole("option", { name: /^Cliente Um/ }));
  expect(box).toHaveValue("Cliente Um");
}
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
  vi.mocked(cashFlowApi.board).mockResolvedValue({
    as_of: "2026-11-14",
    reference: { month: "2026-11", year: "2026" },
    kpis: [],
    alerts: { proposed_count: 1, proposed_amount: "3000.00", missing_parameters_since: null, missing_tax_count: 0, undated_payments: 0, unproposed_contracts: [] },
    projects: [],
    items: [],
  });
});
describe("Financial navigation through real nested routes", () => {
  it("navegação só pelo menu lateral: sem barra de abas, título da própria tela", async () => {
    mount("/app/finance/receivables?project_id=25");
    expect(screen.getByRole("heading", { level: 1, name: "Recebíveis" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegação financeira" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("link", { name: "SINTETICO navegação" }));
    await screen.findByRole("heading", { name: "SINTETICO navegação" });
    expect(screen.getByTestId("location")).toHaveTextContent("project_id=25");
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(screen.getByTestId("location")).toHaveTextContent("tab=history");
    expect(screen.getByTestId("location")).toHaveTextContent("project_id=25");
  });
  it("fluxo de caixa mantém o filtro de projeto da URL e mostra o próprio título", async () => {
    mount("/app/finance/cash-flow?project_id=25");
    expect(screen.getByRole("heading", { level: 1, name: "Fluxo de caixa" })).toBeInTheDocument();
    await screen.findByText(/não confirmada/);
    expect(cashFlowApi.board).toHaveBeenCalledWith(expect.objectContaining({ project_id: 25 }));
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
  it("detalhe e lista mostram cliente, projeto, origem e autor pelo nome (nunca #id)", async () => {
    const named = {
      ...row,
      company_name: "Cliente Um",
      project_name: "Projeto Vinte e Cinco (P-25)",
      contract_number: "CT-9",
      sourceKey: "contract:4",
      events: [
        { id: 1, operation: "create", amount: null, effectiveOn: null, installmentId: null, reversesId: null, actorId: 2, actor_name: "Ana Financeiro", recordedAt: "2026-11-10T13:00:00.000Z", details: {} },
      ],
    } as unknown as Receivable;
    vi.mocked(financeApi.detail).mockResolvedValue(named);
    mount("/app/finance/receivables/7?tab=details");
    expect(await screen.findByText(/Cliente: Cliente Um · Projeto: Projeto Vinte e Cinco \(P-25\)/)).toBeInTheDocument();
    expect(screen.getByText(/Origem: Contrato CT-9/)).toBeInTheDocument();
    expect(screen.queryByText(/Cliente #1/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(await screen.findByText(/Ana Financeiro ·/)).toBeInTheDocument();
    expect(screen.queryByText(/Usuário #2/)).not.toBeInTheDocument();
  });

  it("filtros: cliente e projeto pelo nome; contrato só depois do projeto; o ID vai para a URL", async () => {
    vi.mocked(financeApi.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 } as never);
    mount("/app/finance/receivables");
    const contract = await screen.findByRole("combobox", { name: "Contrato" });
    expect(contract).toBeDisabled();
    expect(contract).toHaveAttribute("placeholder", "Escolha o projeto primeiro");
    const project = screen.getByRole("combobox", { name: "Projeto" });
    fireEvent.focus(project);
    fireEvent.change(project, { target: { value: "Vinte" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /^Projeto Vinte e Cinco \(P-25\)/ }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Contrato" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("project_id=25"));
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
    await chooseClient();
    for (const [label, value] of [
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

  it("vencimentos personalizados aceitam dd/mm/aaaa e aaaa-mm-dd (um por linha)", async () => {
    vi.mocked(financeApi.preview).mockResolvedValue({
      preview_hash: "b".repeat(64),
      data: row.data,
      plan: { rows: [] },
    });
    mount("/app/finance/receivables/new");
    await chooseClient();
    for (const [label, value] of [
      ["Descrição", "SINTETICO datas"],
      ["Valor total (decimal)", "10.00"],
      ["Justificativa", "Teste sintético"],
      ["Vencimentos personalizados (opcional)", "31/01/2026\n2026-02-28"],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByLabelText("Vencimentos personalizados (opcional)")).toHaveAttribute(
      "placeholder",
      "dd/mm/aaaa, uma por linha",
    );
    fireEvent.click(screen.getByRole("button", { name: "Gerar prévia de parcelas" }));
    await waitFor(() => expect(financeApi.preview).toHaveBeenCalled());
    const dto = vi.mocked(financeApi.preview).mock.calls.at(-1)![0];
    expect(dto.payment).toMatchObject({ dates: ["2026-01-31", "2026-02-28"] });
  });
});
