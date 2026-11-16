import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import type {
  CurrentUser,
  FieldAgent,
  FieldAgentTemporaryPasswordResult,
} from "@/types/api";
import { FieldAgentAccessPanel } from "./FieldAgentAccessPanel";
import { FieldAgentAccessBadge } from "./FieldAgentAccessBadge";
import {
  DEVELOPMENT_INVITATION_MESSAGE,
  invitationDeliveryMessage,
} from "@/features/users/invitationDelivery";

const mocks = vi.hoisted(() => ({
  createTemporaryAccess: vi.fn(),
  resetTemporaryAccess: vi.fn(),
  revokeAccess: vi.fn(),
  resendInvitation: vi.fn(),
}));
vi.mock("@/api/endpoints", () => ({ fieldAgentsApi: mocks }));

const WARNING =
  "Esta senha não será exibida de novo. Entregue ao inventariante; ele deverá trocá-la no 1º acesso ao app.";

const role = (role_key: string) => ({
  assignment_id: 1,
  role_id: 1,
  role_key,
  role_name: role_key,
  role_type: "SYSTEM" as const,
  organization_id: 1,
  assigned_at: "2026-01-01T00:00:00.000Z",
});
const orgAdmin: CurrentUser = {
  id: 1,
  login: "org.admin",
  email: "org.admin@gai.local",
  status: "ACTIVE",
  organization_id: 1,
  role_assignments: [role("ORG_ADMIN")],
};
const orgUser: CurrentUser = {
  ...orgAdmin,
  role_assignments: [role("ORG_USER")],
};
const base: FieldAgent = {
  id: 9,
  organization_id: 1,
  name: "Bruna Campo",
  status: "active",
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  user_id: null,
  linked_user: null,
  access: { status: "NONE", temporary_password_issued_at: null },
};
const withAccount: FieldAgent = {
  ...base,
  user_id: 30,
  linked_user: {
    id: 30,
    full_name: "Bruna Campo",
    login: "bruna.campo",
    email: null,
    status: "ACTIVE",
  },
  access: {
    status: "AWAITING_FIRST_ACCESS",
    temporary_password_issued_at: "2026-11-16T13:45:00.000Z",
  },
};
const issued = (password: string): FieldAgentTemporaryPasswordResult => ({
  field_agent_id: 9,
  linked_user: withAccount.linked_user!,
  access: withAccount.access!,
  temporary_password_expires_at: null,
  temporary_password: password,
});

function renderPanel(agent: FieldAgent, user: CurrentUser = orgAdmin) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const auth: AuthState = {
    user,
    accessToken: "token",
    expiresAt: "2099-01-01T00:00:00.000Z",
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <FieldAgentAccessPanel agent={agent} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe("FieldAgentAccessPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria acesso com senha temporária sem e-mail, mostra a senha uma vez e a apaga ao fechar", async () => {
    mocks.createTemporaryAccess.mockResolvedValue(issued("Abc234Def567"));
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { queryClient } = renderPanel(base);
    expect(screen.getByText("Sem acesso")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Criar acesso com senha temporária" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Criar acesso" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Login: 3 a 100",
    );
    expect(mocks.createTemporaryAccess).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Login de acesso"), "Bruna.Campo");
    await user.click(within(dialog).getByRole("button", { name: "Criar acesso" }));
    await waitFor(() =>
      expect(mocks.createTemporaryAccess).toHaveBeenCalledWith(9, {
        login: "bruna.campo",
      }),
    );

    const shown = await screen.findByLabelText("Senha gerada");
    expect(shown).toHaveTextContent("Abc234Def567");
    expect(screen.getByText(WARNING)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar senha" }));
    expect(writeText).toHaveBeenCalledWith("Abc234Def567");
    expect(
      await screen.findByRole("button", { name: "Copiada" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() =>
      expect(screen.queryByText("Abc234Def567")).not.toBeInTheDocument(),
    );
    // Nada da resposta fica no cache de mutações nem de consultas.
    const cached = JSON.stringify([
      queryClient.getMutationCache().getAll().map((m) => m.state.data),
      queryClient.getQueryCache().getAll().map((q) => q.state.data),
    ]);
    expect(cached).not.toContain("Abc234Def567");
  });

  it("envia o e-mail opcional normalizado e mostra o erro da API sem fechar o diálogo", async () => {
    mocks.createTemporaryAccess.mockRejectedValueOnce(
      new Error("Login ou e-mail já cadastrado."),
    );
    const user = userEvent.setup();
    renderPanel(base);
    await user.click(
      screen.getByRole("button", { name: "Criar acesso com senha temporária" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Login de acesso"), "bruna");
    await user.type(within(dialog).getByLabelText(/E-mail/), "nao-e-email");
    await user.click(within(dialog).getByRole("button", { name: "Criar acesso" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "e-mail válido",
    );
    await user.clear(within(dialog).getByLabelText(/E-mail/));
    await user.type(
      within(dialog).getByLabelText(/E-mail/),
      " Bruna@Example.com ",
    );
    await user.click(within(dialog).getByRole("button", { name: "Criar acesso" }));
    await waitFor(() =>
      expect(mocks.createTemporaryAccess).toHaveBeenCalledWith(9, {
        login: "bruna",
        email: "bruna@example.com",
      }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Login ou e-mail já cadastrado.",
    );
  });

  it("mostra a situação, redefine com confirmação e exibe a nova senha uma vez", async () => {
    mocks.resetTemporaryAccess.mockResolvedValue(issued("Nova234Senha"));
    const user = userEvent.setup();
    renderPanel(withAccount);
    expect(screen.getByText("Aguardando 1º acesso")).toBeInTheDocument();
    expect(screen.getByText(/Senha temporária emitida em/)).toBeInTheDocument();
    expect(screen.getByText(/Sem e-mail/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Redefinir senha temporária" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(mocks.resetTemporaryAccess).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Gerar nova senha" }),
    );
    expect(await screen.findByLabelText("Senha gerada")).toHaveTextContent(
      "Nova234Senha",
    );
    expect(mocks.resetTemporaryAccess).toHaveBeenCalledWith(9);
    await user.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() =>
      expect(screen.queryByText("Nova234Senha")).not.toBeInTheDocument(),
    );
  });

  it("revoga o acesso com confirmação destrutiva", async () => {
    mocks.revokeAccess.mockResolvedValue({
      field_agent_id: 9,
      access: { status: "REVOKED", temporary_password_issued_at: null },
    });
    const user = userEvent.setup();
    renderPanel(withAccount);
    await user.click(screen.getByRole("button", { name: "Revogar acesso" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", {
      name: "Revogar acesso",
    });
    expect(confirm.className).toContain("bg-destructive");
    await user.click(confirm);
    await waitFor(() => expect(mocks.revokeAccess).toHaveBeenCalledWith(9));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("mantém o diálogo aberto com o erro quando a redefinição é recusada", async () => {
    mocks.resetTemporaryAccess.mockRejectedValue(
      new Error("A conta associada não é exclusiva de inventariante."),
    );
    const user = userEvent.setup();
    renderPanel(withAccount);
    await user.click(
      screen.getByRole("button", { name: "Redefinir senha temporária" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Gerar nova senha" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "não é exclusiva de inventariante",
    );
    expect(screen.queryByLabelText("Senha gerada")).not.toBeInTheDocument();
  });

  it("não oferece senha temporária a quem não é administrador da organização", () => {
    renderPanel(base, orgUser);
    expect(
      screen.queryByRole("button", {
        name: "Criar acesso com senha temporária",
      }),
    ).not.toBeInTheDocument();
    renderPanel(withAccount, orgUser);
    expect(
      screen.queryByRole("button", { name: "Revogar acesso" }),
    ).not.toBeInTheDocument();
  });

  it("revogado não oferece revogar de novo, mas permite redefinir", () => {
    renderPanel({
      ...withAccount,
      linked_user: { ...withAccount.linked_user!, status: "INACTIVE" },
      access: { status: "REVOKED", temporary_password_issued_at: null },
    });
    expect(screen.getByText("Acesso revogado")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revogar acesso" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Redefinir senha temporária" }),
    ).toBeInTheDocument();
  });

  it("reenvio de convite no ambiente local explica que nenhum e-mail é enviado", async () => {
    mocks.resendInvitation.mockResolvedValue({
      invitation_delivery: "DEVELOPMENT",
    });
    const user = userEvent.setup();
    renderPanel({
      ...withAccount,
      linked_user: {
        ...withAccount.linked_user!,
        email: "bruna@example.com",
        status: "PENDING_ACTIVATION",
      },
      access: { status: "INVITATION_PENDING", temporary_password_issued_at: null },
    });
    expect(screen.getByText("Convite pendente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar convite" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      DEVELOPMENT_INVITATION_MESSAGE,
    );
  });
});

describe("FieldAgentAccessBadge e mensagens de convite", () => {
  it("rotula cada situação", () => {
    const { rerender } = render(<FieldAgentAccessBadge />);
    expect(screen.getByText("Sem acesso")).toBeInTheDocument();
    rerender(
      <FieldAgentAccessBadge
        access={{ status: "ACTIVE", temporary_password_issued_at: null }}
      />,
    );
    expect(screen.getByText("Acesso ativo")).toBeInTheDocument();
  });

  it("diferencia envio real, falha e ambiente de desenvolvimento", () => {
    expect(invitationDeliveryMessage("SENT")).toBe("Convite enviado por e-mail.");
    expect(invitationDeliveryMessage("FAILED")).toContain("não foi entregue");
    expect(invitationDeliveryMessage("DEVELOPMENT")).toBe(
      "Ambiente de desenvolvimento: o convite foi registrado, mas nenhum e-mail é enviado. Use a senha temporária para testar o acesso.",
    );
  });
});
