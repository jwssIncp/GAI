import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { Sidebar } from "@/layouts/Sidebar";
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
      <MemoryRouter>
        <Sidebar mobileOpen={false} onMobileOpenChange={vi.fn()} />
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
    expect(
      screen.getByRole("link", { name: "Projetos" }),
    ).toHaveAttribute("href", "/app/projects");
    expect(
      screen.queryByRole("link", { name: "Novo projeto" }),
    ).not.toBeInTheDocument();
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
