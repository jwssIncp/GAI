import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { inventoryItemsApi } from "@/api/endpoints";
import { ProjectLayout } from "@/features/projects/ProjectLayout";
import type { InventoryItem, PaginatedItems } from "@/types/api";
import {
  valuationBatchApi,
  type ValuationBatchResult,
  type ValuationSnapshot,
} from "./valuationBatchApi";
import { ProjectInventoryItemsPage } from "./ProjectInventoryItemsPage";
const items = Array.from(
  { length: 21 },
  (_, n) =>
    ({
      id: n + 1,
      organization_id: 1,
      project_id: 7,
      old_plate: "P" + (n + 1),
      description: "Item sintetico " + (n + 1),
      status: "pending",
      created_at: "2026-10-27",
      updated_at: "2026-10-27",
    }) as InventoryItem,
);
const snap = (id: number): ValuationSnapshot => ({
  id,
  old_plate: "P" + id,
  new_plate: null,
  description: "Item sintetico " + id,
  status: "pending",
  last_valuation: null,
  version: "v" + id,
});
const result = (ids = [1, 21]): ValuationBatchResult => ({
  id: 9,
  projectId: 7,
  project: { id: 7, name: "Projeto sintetico" },
  status: "preview",
  total: ids.length,
  revision: 1,
  previewHash: "a".repeat(64),
  commandKey: "synthetic-command",
  createdAt: "2026-10-27",
  createdById: 2,
  confirmedById: null,
  confirmedAt: null,
  expired: false,
  request: {
    selection: { kind: "ids", ids },
    mode: "common",
    common: {
      source: "Catalogo sintetico",
      valuation_date: "2026-10-27",
      new_value: "150.00",
      used_value: null,
      notes: null,
    },
    command_key: "synthetic-command",
  },
  summary: {
    total_requested: ids.length,
    total_processed: 0,
    total_approved: 0,
    total_rejected: 0,
    errors: [],
  },
  items: ids.map((id) => ({
    inventoryItemId: id,
    snapshot: snap(id),
    proposed: {
      source: "Catalogo sintetico",
      valuationDate: "2026-10-27",
      newValue: "150.00",
      usedValue: null,
      notes: null,
    },
    valuationId: null,
    status: "preview",
    error: null,
  })),
});
function mount(
  keys = [
    "asset-valuations:read",
    "asset-valuations:create",
    "asset-valuations:batch-create",
  ],
) {
  const auth: AuthState = {
    user: {
      id: 2,
      login: "synthetic",
      email: "synthetic@test.local",
      status: "ACTIVE",
      organization_id: 1,
      role_assignments: [],
      permissions: [...keys, "projects:read", "inventory-items:read"].map(
        (key) => ({ key, scope: "ORGANIZATION" }),
      ),
    },
    accessToken: "synthetic",
    expiresAt: "2099",
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
        <MemoryRouter initialEntries={["/app/projects/7/inventory-items"]}>
          <Routes>
            <Route path="/app/projects/:projectId" element={<ProjectLayout />}>
              <Route
                path="inventory-items"
                element={<ProjectInventoryItemsPage />}
              />
              <Route
                path="summary"
                element={<h1>Resumo do mesmo projeto</h1>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(inventoryItemsApi, "listByProject").mockImplementation(
    async (_p, q) =>
      ({
        items: items.slice(((q.page ?? 1) - 1) * 20, (q.page ?? 1) * 20),
        page: q.page ?? 1,
        page_size: 20,
        total: 21,
        total_items: 21,
        total_pages: 2,
      }) as PaginatedItems<InventoryItem>,
  );
  vi.spyOn(valuationBatchApi, "list").mockResolvedValue({
    items: [],
    total: 0,
    limit: 100,
  });
  vi.spyOn(valuationBatchApi, "selection").mockImplementation(
    async (_p, selection) => ({
      project: { id: 7, name: "Projeto sintetico" },
      limit: 100,
      total: selection.kind === "filters" ? 21 : selection.ids!.length,
      items: (selection.kind === "filters"
        ? items.map((i) => i.id)
        : selection.ids!
      ).map(snap),
    }),
  );
  vi.spyOn(valuationBatchApi, "preview").mockResolvedValue(result());
  vi.spyOn(valuationBatchApi, "confirm").mockImplementation(async () => {
    const r = result();
    return {
      ...r,
      status: "applied",
      revision: 2,
      confirmedById: 2,
      confirmedAt: "2026-10-27",
      summary: { ...r.summary, total_processed: 2, total_approved: 2 },
      items: r.items.map((i, n) => ({
        ...i,
        valuationId: 100 + n,
        status: "approved",
      })),
    };
  });
});
describe("Batch valuation integrated item workspace", () => {
  it("preserves explicit selection across pages and confirms only after the server preview", async () => {
    mount();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Selecionar item 1",
      }),
    );
    await userEvent.click(
      screen
        .getAllByRole("button", { name: "Proxima pagina" })
        .find((b) => !b.hasAttribute("disabled"))!,
    );
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Selecionar item 21",
      }),
    );
    expect(screen.getByText("2 itens selecionados")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Avaliar selecionados" }),
    );
    await screen.findByLabelText("Fonte da avaliação em lote");
    expect(valuationBatchApi.selection).toHaveBeenCalledWith(7, {
      kind: "ids",
      ids: [1, 21],
    });
    await userEvent.type(
      screen.getByLabelText("Fonte da avaliação em lote"),
      "Catalogo sintetico",
    );
    await userEvent.type(
      screen.getByLabelText("Data da avaliação em lote"),
      "2026-10-27",
    );
    await userEvent.type(screen.getByLabelText("Valor novo comum"), "150.00");
    await userEvent.click(
      screen.getByRole("button", { name: "Gerar prévia da avaliação" }),
    );
    await screen.findByRole("button", {
      name: "Confirmar e registrar 2 avaliações",
    });
    expect(valuationBatchApi.confirm).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Confirmar e registrar 2 avaliações",
      }),
    );
    expect(
      await screen.findByText("Aprovado · avaliação #100"),
    ).toBeInTheDocument();
    expect(screen.getByText("Aprovado · avaliação #101")).toBeInTheDocument();
    expect(valuationBatchApi.preview).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        selection: { kind: "ids", ids: [1, 21] },
        mode: "common",
        common: expect.objectContaining({
          source: "Catalogo sintetico",
          valuation_date: "2026-10-27",
          new_value: "150.00",
        }),
      }),
    );
  });
  it("resolves all matching filter items with a backend contract instead of loaded-page data", async () => {
    mount();
    await screen.findByRole("checkbox", {
      name: "Selecionar item 1",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Selecionar todos dos filtros" }),
    );
    expect(
      await screen.findByText("21 itens selecionados"),
    ).toBeInTheDocument();
    expect(valuationBatchApi.selection).toHaveBeenCalledWith(7, {
      kind: "filters",
      filters: expect.any(Object),
      exclude_ids: [],
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Limpar seleção" }),
    );
    expect(screen.getByText("0 itens selecionados")).toBeInTheDocument();
  });
  it("offers individualized values for each resolved item without inventing calculations", async () => {
    mount();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Selecionar item 1",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Avaliar selecionados" }),
    );
    await userEvent.selectOptions(
      await screen.findByLabelText("Modo de valores"),
      "individual",
    );
    expect(screen.getByLabelText("Valor novo do item 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor usado do item 1")).toBeInTheDocument();
  });
  it("hides selection and writing from read-only users while retaining project navigation", async () => {
    mount(["asset-valuations:read"]);
    await screen.findByText("Item sintetico 1");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Avaliar selecionados" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Visão geral" }));
    await waitFor(() =>
      expect(screen.getByText("Resumo do mesmo projeto")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("navigation", { name: "Abas do projeto" }),
    ).toBeInTheDocument();
  });
});
