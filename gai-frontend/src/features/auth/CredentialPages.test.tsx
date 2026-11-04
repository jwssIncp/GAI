import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  MemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { transferableAbortController } from "node:util";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./AuthContext";
import { ChangePasswordPage } from "./CredentialPages";
import { readStoredSession, writeStoredSession } from "@/api/session-storage";
import type { CurrentUser } from "@/types/api";
import { ProtectedRoute } from "@/router/ProtectedRoute";

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  change: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
}));
vi.mock("@/api/endpoints", () => ({
  authApi: {
    me: mocks.me,
    changePassword: mocks.change,
    logout: mocks.logout,
    login: mocks.login,
  },
}));
const temporaryUser: CurrentUser = {
  id: 10,
  login: "temporary.person",
  email: "temporary@example.test",
  organization_id: 1,
  status: "ACTIVE",
  must_change_password: true,
  role_assignments: [],
  permissions: [],
};
function SessionProbe() {
  const { user, accessToken, logout, login } = useAuth();
  const location = useLocation();
  return (
    <>
      <button onClick={() => void logout({ sessionRevoked: true })}>
        End local session
      </button>
      <button
        onClick={() =>
          void login({ identifier: "temporary.person", password: "nnnnnnnn" })
        }
      >
        Start fresh session
      </button>
      <output data-testid="auth-state">
        {JSON.stringify({
          user: user?.must_change_password ?? null,
          accessToken,
          path: location.pathname,
        })}
      </output>
    </>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
  mocks.me.mockResolvedValue(temporaryUser);
  mocks.change.mockResolvedValue({
    message: "Senha alterada. Entre novamente para continuar.",
  });
  mocks.login.mockResolvedValue({
    access_token: "fresh-disposable-session",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    user: { ...temporaryUser, must_change_password: false },
  });
});
afterEach(() => vi.unstubAllGlobals());
function renderSession() {
  writeStoredSession({
    accessToken: "old-disposable-session",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: temporaryUser,
  });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter>
          <SessionProbe />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
it("does not restore a temporary identity from a response arriving after local logout", async () => {
  let resolve!: (user: CurrentUser) => void;
  mocks.me.mockReturnValueOnce(
    new Promise<CurrentUser>((done) => {
      resolve = done;
    }),
  );
  renderSession();
  await userEvent.click(
    screen.getByRole("button", { name: "End local session" }),
  );
  await act(async () => {
    resolve(temporaryUser);
  });
  expect(screen.getByTestId("auth-state")).toHaveTextContent('"user":null');
  expect(readStoredSession()).toBeNull();
});
it("ignores a stale restore response after a fresh login with permanent credentials", async () => {
  let resolve!: (user: CurrentUser) => void;
  mocks.me.mockReturnValueOnce(
    new Promise<CurrentUser>((done) => {
      resolve = done;
    }),
  );
  renderSession();
  await userEvent.click(
    screen.getByRole("button", { name: "Start fresh session" }),
  );
  await act(async () => {
    resolve(temporaryUser);
  });
  expect(screen.getByTestId("auth-state")).toHaveTextContent('"user":false');
  expect(readStoredSession()?.accessToken).toBe("fresh-disposable-session");
  expect(readStoredSession()?.user.must_change_password).toBe(false);
});
it("restores the server flag rather than a stale cached mandatory-change flag", async () => {
  mocks.me.mockResolvedValueOnce({
    ...temporaryUser,
    must_change_password: false,
  });
  renderSession();
  await waitFor(() =>
    expect(screen.getByTestId("auth-state")).toHaveTextContent('"user":false'),
  );
  expect(readStoredSession()?.user.must_change_password).toBe(false);
});
it("ends the in-memory temporary session and returns to login after a successful password change", async () => {
  // React Router uses Node's Request in jsdom; its signal must use the same realm.
  const controller = transferableAbortController();
  vi.stubGlobal("AbortController", controller.constructor);
  vi.stubGlobal("AbortSignal", controller.signal.constructor);
  writeStoredSession({
    accessToken: "old-disposable-session",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: temporaryUser,
  });
  const client = new QueryClient();
  function LoginResult() {
    const location = useLocation();
    return (
      <h1>
        {location.state?.passwordChanged
          ? "Password changed"
          : "Missing success navigation"}
      </h1>
    );
  }
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <SessionProbe />
            <Outlet />
          </>
        ),
        children: [
          {
            element: <ProtectedRoute />,
            children: [
              { path: "/app/change-password", element: <ChangePasswordPage /> },
            ],
          },
          { path: "/login", element: <LoginResult /> },
        ],
      },
    ],
    { initialEntries: ["/app/change-password"] },
  );
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("auth-state")).toHaveTextContent(
      "old-disposable-session",
    ),
  );
  await userEvent.type(
    screen.getByLabelText("Senha atual ou temporária"),
    "tttttttt",
  );
  await userEvent.type(
    screen.getByLabelText("Nova senha", { exact: true }),
    "nnnnnnnn",
  );
  await userEvent.type(
    screen.getByLabelText("Confirmar nova senha"),
    "nnnnnnnn",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Alterar senha e encerrar sessões" }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("auth-state")).toHaveTextContent('"user":null'),
  );
  expect(screen.getByTestId("auth-state")).toHaveTextContent(
    '"accessToken":null',
  );
  await waitFor(() =>
    expect(screen.getByTestId("auth-state")).toHaveTextContent(
      '"path":"/login"',
    ),
  );
  expect(readStoredSession()).toBeNull();
  expect(mocks.logout).not.toHaveBeenCalled();
  expect(
    await screen.findByRole("heading", { name: "Password changed" }),
  ).toBeVisible();
});
