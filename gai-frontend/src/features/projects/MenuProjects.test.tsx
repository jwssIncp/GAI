import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { AppHeader } from "@/layouts/AppHeader";
import { preparationApi } from "@/features/project-preparation/preparationQueries";
import type { CurrentUser } from "@/types/api";

function renderMenu(keys: string[]) {
  const user: CurrentUser = {
    id: 1,
    login: "creator",
    email: "creator@gai.local",
    status: "ACTIVE",
    organization_id: 1,
    role_assignments: [],
    permissions: keys.map((key) => ({ key, scope: "ORGANIZATION" as const })),
  };
  render(
    <AuthContext.Provider value={{ user } as AuthState}>
      <MemoryRouter initialEntries={["/app/projects"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AppHeader />
        </QueryClientProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
describe("Project navigation with specific permissions", () => {
  beforeAll(() =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    ),
  );
  afterAll(() => vi.unstubAllGlobals());
  it("provides a creation entry without exposing the project list to create-only profiles", () => {
    renderMenu(["projects:create"]);
    expect(screen.getByRole("link", { name: "Novo projeto" })).toHaveAttribute(
      "href",
      "/app/projects/new",
    );
    expect(
      screen.queryByRole("link", { name: "Projetos" }),
    ).not.toBeInTheDocument();
  });
  it("keeps the existing list entry for project readers", () => {
    renderMenu(["projects:create", "projects:read"]);
    // A lista de projetos é a sub-aba "Painel Geral" da área Projetos (mesma rota).
    expect(
      screen.getByRole("link", { name: "Painel Geral" }),
    ).toHaveAttribute("href", "/app/projects");
    expect(
      screen.queryByRole("link", { name: "Novo projeto" }),
    ).not.toBeInTheDocument();
  });
  it("marks the Kick-off sub-tab with ⚠ while there are open kick-offs", async () => {
    vi.spyOn(preparationApi, "openSummary").mockResolvedValue({ open: 2 });
    renderMenu(["projects:read", "project-preparation:read"]);
    const tab = await screen.findByTitle("2 kick-off(s) não concluído(s)");
    expect(tab).toHaveTextContent("Kick-off⚠");
  });
  it("shows no alert when every kick-off is concluded", async () => {
    const summary = vi.spyOn(preparationApi, "openSummary").mockResolvedValue({ open: 0 });
    renderMenu(["projects:read", "project-preparation:read"]);
    await vi.waitFor(() => expect(summary).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Kick-off" })).not.toHaveTextContent("⚠");
  });
  it("does not expose project entries without a project permission", () => {
    renderMenu([]);
    expect(
      screen.queryByRole("link", { name: "Projetos" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Novo projeto" }),
    ).not.toBeInTheDocument();
  });
});
