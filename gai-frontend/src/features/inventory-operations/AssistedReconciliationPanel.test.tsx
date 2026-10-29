import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { AssistedReconciliationPanel } from "./AssistedReconciliationPanel";
import {
  assistedApi,
  type AssistedRun,
  type AssistedCandidate,
} from "./assistedApi";
const run: AssistedRun = {
  id: 1,
  config: {
    version: 1,
    textThreshold: 0.92,
    localTextThreshold: 0.85,
    descriptionAlertThreshold: 0.25,
  },
  sourceHash: "a".repeat(64),
  afterItemId: 0,
  nextItemId: null,
  summary: {
    physical: 1,
    candidates: 1,
    ambiguous: 0,
    probable: 1,
    descriptionAlerts: 0,
    withoutCandidates: 0,
  },
  createdAt: "2026-10-27T12:00:00Z",
};
const candidate: AssistedCandidate = {
  id: 5,
  revision: 1,
  status: "pending",
  physical: {
    id: 1,
    plate: "P100",
    serial: "S100",
    description: "Motor eletrico",
    location: "Sala 1",
    unit: null,
    version: "physical",
    observationId: 10,
    roundId: 2,
  },
  accounting: {
    id: 3,
    plate: "P100",
    serial: "S100",
    description: "Motor eletrico",
    location: "Sala 1",
    unit: null,
    version: "accounting",
  },
  warnings: [],
  evidence: {
    rule: "exact_plate",
    coincident: ["plate", "serial", "location"],
    divergent: [],
    missing: ["unit"],
    similarity: 1,
    score: 1,
    alerts: [],
  },
};
function mount(permissions = ["read", "generate", "review"]) {
  const auth: AuthState = {
    user: {
      id: 2,
      login: "synthetic",
      email: "synthetic@test.local",
      status: "ACTIVE",
      organization_id: 1,
      role_assignments: [],
      permissions: [
        ...permissions.map((p) => ({
          key: "assisted-reconciliation:" + p,
          scope: "ORGANIZATION" as const,
        })),
        { key: "consolidations:create", scope: "ORGANIZATION" },
      ],
    },
    accessToken: "synthetic",
    expiresAt: "2099-01-01",
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <AuthContext.Provider value={auth}>
        <AssistedReconciliationPanel projectId={7} sessionId={2} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(assistedApi, "runs").mockResolvedValue({ items: [run], total: 1 });
  vi.spyOn(assistedApi, "candidates").mockResolvedValue({
    run,
    stale: false,
    items: [candidate],
    total: 1,
    page: 1,
    page_size: 20,
  });
  vi.spyOn(assistedApi, "history").mockResolvedValue({ items: [], total: 0 });
  vi.spyOn(assistedApi, "generate").mockResolvedValue(run);
  vi.spyOn(assistedApi, "decide").mockResolvedValue({
    id: 5,
    status: "approved",
    revision: 2,
    reconciliationId: 9,
  });
});
describe("Assisted review integrated panel", () => {
  it("compares actual source fields and submits versioned justified decision", async () => {
    mount();
    await userEvent.click(
      await screen.findByRole("button", { name: "Comparar e revisar" }),
    );
    expect(await screen.findByText("Físico observado")).toBeInTheDocument();
    expect(screen.getByText("Registro contábil original")).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Justificativa"),
      "Conferencia humana concluida",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Registrar decisão" }),
    );
    await waitFor(() =>
      expect(assistedApi.decide).toHaveBeenCalledWith(
        7,
        2,
        5,
        expect.objectContaining({
          revision: 1,
          source_hash: run.sourceHash,
          action: "approved",
          reason: "Conferencia humana concluida",
          command_key: expect.any(String),
        }),
      ),
    );
  });
  it("blocks stale approval and shows obsolescence explicitly", async () => {
    vi.mocked(assistedApi.candidates).mockResolvedValue({
      run,
      stale: true,
      items: [candidate],
      total: 1,
      page: 1,
      page_size: 20,
    });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Fontes obsoletas",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Comparar e revisar" }),
    );
    await userEvent.type(
      screen.getByLabelText("Justificativa"),
      "Conferencia humana concluida",
    );
    expect(
      screen.getByRole("button", { name: "Registrar decisão" }),
    ).toBeDisabled();
    expect(assistedApi.decide).not.toHaveBeenCalled();
  });
  it("keeps read-only users from generating or deciding and displays history", async () => {
    vi.mocked(assistedApi.history).mockResolvedValue({
      items: [
        {
          id: 1,
          action: "rejected",
          reason: "Descricao incompativel revisada",
          actorId: 2,
          revision: 2,
          createdAt: "2026-10-27T12:00:00Z",
          sourceHash: run.sourceHash,
          reconciliationId: null,
        },
      ],
      total: 1,
    });
    mount(["read"]);
    await userEvent.click(
      await screen.findByRole("button", { name: "Comparar e revisar" }),
    );
    expect(
      await screen.findByText("Descricao incompativel revisada"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar decisão" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Gerar sugestões/ }),
    ).not.toBeInTheDocument();
  });
  it("persists chosen conservative configuration in generation request", async () => {
    mount();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Gerar sugestões · primeiros 20 itens",
      }),
    );
    await waitFor(() =>
      expect(assistedApi.generate).toHaveBeenCalledWith(7, 2, 0, run.config),
    );
  });
});
