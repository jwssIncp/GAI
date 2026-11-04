import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserFormPage } from "./UserFormPage";
import { UsersPage } from "./UsersPage";
import type { CurrentUser, User } from "@/types/api";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  options: vi.fn(),
  profiles: vi.fn(),
  organizations: vi.fn(),
  block: vi.fn(),
  actor: null as CurrentUser | null,
  restore: vi.fn(),
}));
vi.mock("@/api/endpoints", () => ({
  usersApi: mocks,
  rbacApi: { profiles: mocks.profiles },
  organizationsApi: { list: mocks.organizations },
}));
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ user: mocks.actor, restore: mocks.restore }),
}));
const admin: CurrentUser = {
  id: 2,
  login: "admin",
  email: "admin@example.com",
  status: "ACTIVE",
  organization_id: 1,
  role_assignments: [
    {
      assignment_id: 2,
      role_id: 2,
      role_key: "ORG_ADMIN",
      role_type: "SYSTEM",
      role_name: "Administrador",
      assigned_at: "2026-01-01",
    },
  ],
};
const target: User = {
  ...admin,
  id: 5,
  full_name: "Pessoa existente",
  login: "person",
  email: "person@example.com",
  phone: "11999990000",
  job_title: "Analista",
  organization_name: "Organização de teste",
  role_assignments: [
    {
      assignment_id: 8,
      role_id: 3,
      role_type: "ORGANIZATION",
      role_name: "Operador",
      assigned_at: "2026-01-01",
    },
  ],
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};
function setup(path = "/app/users/new") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/app/users", element: <UsersPage /> },
      { path: "/app/users/new", element: <UserFormPage /> },
      { path: "/app/users/:id/edit", element: <UserFormPage /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { events: userEvent.setup(), router };
}
async function fill(events: ReturnType<typeof userEvent.setup>) {
  await events.type(
    await screen.findByLabelText("Nome completo"),
    "Pessoa Nova",
  );
  await events.type(screen.getByLabelText("E-mail"), "new@example.com");
  await events.type(screen.getByLabelText("Login"), "new.person");
  await events.click(await screen.findByRole("checkbox", { name: /Operador/ }));
  await events.type(
    screen.getByLabelText("Senha temporária"),
    "A personal passphrase 2026!",
  );
}
beforeEach(() => {
  const NativeRequest = globalThis.Request;
  vi.stubGlobal('Request', class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, { ...init, signal: undefined }); }
  });
  Object.values(mocks).forEach((value) => {
    if (typeof value === "function" && "mockReset" in value) value.mockReset();
  });
  mocks.actor = admin;
  mocks.options.mockResolvedValue({
    invitation_available: false,
    password_min_length: 15,
    password_max_length: 128,
  });
  mocks.profiles.mockResolvedValue([
    {
      id: 3,
      name: "Operador",
      description: "Consulta operacional.",
      permission_count: 1,
      administrative: false,
    },
  ]);
  mocks.list.mockResolvedValue({
    data: [target],
    meta: { page: 1, page_size: 20, total: 1, total_pages: 1 },
  });
  mocks.get.mockResolvedValue(target);
  mocks.create.mockResolvedValue(target);
  mocks.update.mockResolvedValue(target);
  mocks.organizations.mockResolvedValue({
    items: [{ id: 1, legal_name: "Organização de teste", status: "ACTIVE" }],
    page: 1,
    page_size: 30,
    total_items: 1,
    total_pages: 1,
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("Dedicated user pages", () => {
  it("navigates from list to a dedicated page without a creation drawer", async () => {
    const { events } = setup("/app/users");
    await events.click(
      await screen.findByRole("link", { name: "Cadastrar usuário" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Cadastrar usuário" }),
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Nome completo")).toBeVisible();
  });
  it("loads only grantable profiles in organization scope and submits identity and roles together", async () => {
    const { events, router } = setup();
    await fill(events);
    expect(mocks.profiles).toHaveBeenCalledWith(1);
    await events.click(
      screen.getByRole("button", { name: "Cadastrar usuário" }),
    );
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Pessoa Nova",
          login: "new.person",
          role_ids: [3],
          organization_id: 1,
          activation_method: "TEMPORARY_PASSWORD",
        }),
      ),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/app/users"),
    );
  });
  it("validates required data and prevents a request with invalid login/password", async () => {
    const { events } = setup();
    await screen.findByLabelText("Nome completo");
    await events.click(
      screen.getByRole("button", { name: "Cadastrar usuário" }),
    );
    expect(await screen.findByText("Informe o nome completo.")).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("preserves input when registration fails and allows another submission", async () => {
    mocks.create.mockRejectedValueOnce(new Error("E-mail já cadastrado"));
    const { events } = setup();
    await fill(events);
    await events.click(
      screen.getByRole("button", { name: "Cadastrar usuário" }),
    );
    expect(await screen.findByText("E-mail já cadastrado")).toBeVisible();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Pessoa Nova");
    expect(
      screen.getByRole("button", { name: "Cadastrar usuário" }),
    ).toBeEnabled();
  });
  it("asks before discarding dirty data, and supports staying on the form", async () => {
    const { events, router } = setup();
    await events.type(
      await screen.findByLabelText("Nome completo"),
      "Informação pendente",
    );
    await events.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialog = await screen.findByRole("dialog");
    await events.click(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    );
    expect(screen.getByLabelText("Nome completo")).toHaveValue(
      "Informação pendente",
    );
    await events.click(screen.getByRole("button", { name: "Cancelar" }));
    await events.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/app/users"),
    );
  });
  it("loads an existing user and edits identification without exposing a current password", async () => {
    const { events } = setup("/app/users/5/edit");
    expect(await screen.findByLabelText("Nome completo")).toHaveValue(
      "Pessoa existente",
    );
    expect(screen.queryByLabelText("Senha temporária")).not.toBeInTheDocument();
    await events.clear(screen.getByLabelText("E-mail"));
    await events.type(screen.getByLabelText("E-mail"), "updated@example.com");
    await events.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        5,
        { email: "updated@example.com" },
      ),
    );
  });
  it('preserves unknown legacy names and untouched login casing when editing email', async () => {
    mocks.get.mockResolvedValue({ ...target, full_name: null, login: 'Legacy.Person' });
    const { events } = setup('/app/users/5/edit');
    expect(await screen.findByLabelText('Nome completo')).toHaveValue('');
    await events.clear(screen.getByLabelText('E-mail')); await events.type(screen.getByLabelText('E-mail'), 'legacy.updated@example.com');
    await events.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(5, { email: 'legacy.updated@example.com' }));
  });
  it("requires acknowledgment for administrative access", async () => {
    mocks.profiles.mockResolvedValue([
      { id: 3, name: "Operador", permission_count: 1, administrative: true },
    ]);
    const { events } = setup();
    await fill(events);
    await events.click(
      screen.getByRole("button", { name: "Cadastrar usuário" }),
    );
    expect(
      await screen.findByText("Confirme a concessão de acesso administrativo."),
    ).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
    await events.click(screen.getByRole("checkbox", { name: /Estou ciente/ }));
    await events.click(
      screen.getByRole("button", { name: "Cadastrar usuário" }),
    );
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
  });
  it("shows profile-load failure and retry without losing entered data", async () => {
    mocks.profiles.mockRejectedValueOnce(new Error("Falha ao carregar perfis"));
    const { events } = setup();
    await events.type(
      await screen.findByLabelText("Nome completo"),
      "Pessoa Nova",
    );
    expect(await screen.findByText("Falha ao carregar perfis")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Cadastrar usuário" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Pessoa Nova");
  });
  it("hides registration for the operator", async () => {
    mocks.actor = {
      ...admin,
      role_assignments: target.role_assignments,
      permissions: [{ key: "users:read", scope: "ORGANIZATION" }],
    };
    setup("/app/users");
    await screen.findByText("Pessoa existente");
    expect(
      screen.queryByRole("link", { name: "Cadastrar usuário" }),
    ).not.toBeInTheDocument();
  });
  it("queries only active organizations for platform registration", async () => {
    mocks.actor = {
      ...admin,
      organization_id: null,
      role_assignments: [
        { ...admin.role_assignments[0], role_key: "PLATFORM_ADMIN" },
      ],
    };
    setup();
    await screen.findByLabelText("Organização");
    await waitFor(() =>
      expect(mocks.organizations).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE" }),
      ),
    );
  });
  it("shows an empty listing and keeps filters operational", async () => {
    mocks.list.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 20, total: 0, total_pages: 0 },
    });
    const { events } = setup("/app/users");
    await screen.findByLabelText("Status");
    await events.selectOptions(
      screen.getByLabelText("Status"),
      "PENDING_ACTIVATION",
    );
    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: "PENDING_ACTIVATION" }),
      ),
    );
  });
});
