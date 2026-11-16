import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { AccessDeniedInAppPage, AccessDeniedPage, ForgotPasswordPage, ResetPasswordPage } from "./PasswordPages";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  confirm: vi.fn(),
  logout: vi.fn(),
  user: null as null | { id: number },
}));
vi.mock("./AuthContext", () => ({ useAuth: () => ({ logout: mocks.logout, user: mocks.user }) }));
vi.mock("@/api/endpoints", () => ({
  authApi: {
    requestPasswordReset: mocks.request,
    confirmPasswordReset: mocks.confirm,
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = null;
});
function Where() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}
it("acesso negado sem sessão oferece o login", () => {
  render(
    <MemoryRouter>
      <AccessDeniedPage />
    </MemoryRouter>,
  );
  expect(screen.getByText("Acesso negado")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir para login" })).toHaveAttribute("href", "/login");
});
it("acesso negado com sessão abre dentro do layout (não oferece login)", () => {
  mocks.user = { id: 1 };
  render(
    <MemoryRouter initialEntries={["/access-denied"]}>
      <Routes>
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByTestId("location")).toHaveTextContent("/app/access-denied");
});
it("acesso negado no layout: título e volta para a Visão geral", () => {
  render(
    <MemoryRouter initialEntries={["/app/access-denied"]}>
      <AccessDeniedInAppPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Acesso negado" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Voltar para a Visão geral" })).toHaveAttribute("href", "/app/dashboard");
  expect(screen.queryByRole("link", { name: "Ir para login" })).not.toBeInTheDocument();
});
it("shows a recovery API error and allows retry without success feedback", async () => {
  mocks.request
    .mockRejectedValueOnce(new Error("Serviço temporariamente indisponível"))
    .mockResolvedValueOnce({ message: "Solicitação recebida" });
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
  await userEvent.type(screen.getByLabelText("Email"), "synthetic@gai.test");
  await userEvent.click(
    screen.getByRole("button", { name: "Enviar instruções" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Serviço temporariamente indisponível",
  );
  expect(screen.queryByText("Solicitação recebida")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Enviar instruções" }),
  );
  expect(await screen.findByText("Solicitação recebida")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("shows an invalid-token response and prevents duplicate pending submissions", async () => {
  let reject!: (error: Error) => void;
  mocks.confirm.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  render(
    <MemoryRouter initialEntries={["/reset-password?token=synthetic-invalid"]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
  await userEvent.type(
    screen.getByLabelText("Nova senha"),
    "Synthetic long password 2026!",
  );
  const submit = screen.getByRole("button", { name: "Redefinir senha" });
  await userEvent.click(submit);
  await waitFor(() => expect(submit).toBeDisabled());
  await userEvent.click(submit);
  expect(mocks.confirm).toHaveBeenCalledTimes(1);
  reject(new Error("Token inválido ou expirado"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Token inválido ou expirado",
  );
  expect(submit).toBeEnabled();
});
it.each([7, 8, 15])(
  "applies the eight-character policy to recovery (%i characters)",
  async (length) => {
    mocks.confirm.mockResolvedValue({ message: "Senha redefinida" });
    render(
      <MemoryRouter initialEntries={["/reset-password?token=isolated-token"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    await userEvent.type(
      screen.getByLabelText("Nova senha"),
      "x".repeat(length),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Redefinir senha" }),
    );
    if (length === 7) {
      expect(
        await screen.findByText("Informe uma senha com 8 a 128 caracteres."),
      ).toBeVisible();
      expect(mocks.confirm).not.toHaveBeenCalled();
    } else {
      expect(await screen.findByText("Senha redefinida")).toBeVisible();
      expect(mocks.confirm).toHaveBeenCalledWith(
        "isolated-token",
        "x".repeat(length),
      );
      expect(mocks.logout).toHaveBeenCalledWith();
    }
  },
);
it("keeps reset success when the previously revoked session rejects logout", async () => {
  mocks.confirm.mockResolvedValue({ message: "Senha redefinida" });
  mocks.logout.mockRejectedValue(new Error("Unauthorized"));
  render(
    <MemoryRouter initialEntries={["/reset-password?token=isolated-token"]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
  await userEvent.type(screen.getByLabelText("Nova senha"), "nnnnnnnn");
  await userEvent.click(
    screen.getByRole("button", { name: "Redefinir senha" }),
  );
  expect(await screen.findByText("Senha redefinida")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
