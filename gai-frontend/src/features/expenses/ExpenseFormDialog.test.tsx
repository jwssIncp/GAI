import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { ExpenseFormDialog } from "./ExpenseFormDialog";
import type { ExpenseBoard } from "./expensesApi";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), upload: vi.fn() }));
vi.mock("./expensesApi", async (original) => ({
  ...(await original<object>()),
  expensesApi: { create: mocks.create, update: mocks.update },
}));
vi.mock("@/features/finance/financeQueries", async (original) => ({
  ...(await original<object>()),
  uploadExpenseAttachment: mocks.upload,
}));

function auth(permissions: string[]) {
  return {
    user: {
      id: 1,
      organization_id: 1,
      role_assignments: [],
      permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" })),
    },
    bootstrapping: false,
  } as unknown as AuthState;
}

const board = {
  project: { id: 3, name: "Projeto Alfa", status: "active" },
  today: "2026-11-25",
  closure: null,
  parameters: { configured: true, reasons: ["Transporte", "Refeição"], attachment_max_bytes: 8 * 1024 * 1024, attachment_max_files: 2 },
  default_expense_type: "reimbursable",
  contract_type_label: "Reembolsável",
  agents: [],
} as unknown as ExpenseBoard;

function mount(permissions: string[], onSaved = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={auth(permissions)}>
        <ExpenseFormDialog projectId={3} board={board} initial={null} onClose={vi.fn()} onSaved={onSaved} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return onSaved;
}

async function fillAndAttach(u: ReturnType<typeof userEvent.setup>) {
  await u.selectOptions(screen.getByLabelText("Motivo"), "Transporte");
  await u.type(screen.getByLabelText("Valor da despesa (R$)"), "45,90");
  await u.upload(
    screen.getByLabelText("Anexar comprovante"),
    new File(["%PDF-1.4"], "recibo.pdf", { type: "application/pdf" }),
  );
}

describe("Nova despesa: comprovante no próprio formulário", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 77 });
    mocks.upload.mockResolvedValue({ id: 5 });
  });

  it("envia o comprovante escolhido logo depois de lançar a despesa", async () => {
    const u = userEvent.setup();
    const onSaved = mount(["expenses:create", "expenses:upload-attachment"]);
    await fillAndAttach(u);
    expect(screen.getByText("recibo.pdf")).toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Lançar despesa" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(undefined));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledWith(3, 77, expect.objectContaining({ name: "recibo.pdf" }));
  });

  it("falha no envio não desfaz a despesa: avisa quais comprovantes faltaram", async () => {
    mocks.upload.mockRejectedValue(new Error("Tempo esgotado"));
    const u = userEvent.setup();
    const onSaved = mount(["expenses:create", "expenses:upload-attachment"]);
    await fillAndAttach(u);
    await u.click(screen.getByRole("button", { name: "Lançar despesa" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.stringContaining("recibo.pdf: Tempo esgotado")));
  });

  it("recusa formato não permitido e respeita o limite de arquivos", async () => {
    const u = userEvent.setup({ applyAccept: false });
    mount(["expenses:create", "expenses:upload-attachment"]);
    const input = screen.getByLabelText("Anexar comprovante");
    await u.upload(input, new File(["x"], "planilha.xlsx", { type: "application/vnd.ms-excel" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Formato não permitido");
    await u.upload(input, new File(["a"], "a.pdf", { type: "application/pdf" }));
    await u.upload(input, new File(["b"], "b.pdf", { type: "application/pdf" }));
    expect(screen.getByLabelText("Anexar comprovante")).toBeDisabled();
  });

  it("sem permissão de anexar, o campo não aparece", () => {
    mount(["expenses:create"]);
    expect(screen.queryByLabelText("Anexar comprovante")).not.toBeInTheDocument();
  });
});
