import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ForgotPasswordPage, ResetPasswordPage } from "./PasswordPages";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  confirm: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("./AuthContext", () => ({ useAuth: () => ({ logout: mocks.logout }) }));
vi.mock("@/api/endpoints", () => ({
  authApi: {
    requestPasswordReset: mocks.request,
    confirmPasswordReset: mocks.confirm,
  },
}));
beforeEach(() => vi.resetAllMocks());
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
    screen.getByRole("button", { name: "Enviar instrucoes" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Serviço temporariamente indisponível",
  );
  expect(screen.queryByText("Solicitação recebida")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Enviar instrucoes" }),
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
