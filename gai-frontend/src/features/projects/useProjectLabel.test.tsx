import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import type { CurrentUser } from "@/types/api";
import { projectKeys } from "./projectQueries";
import { useProjectLabel } from "./useProjectLabel";

const get = vi.fn();
vi.mock("@/api/endpoints", async (original) => ({
  ...(await original<typeof import("@/api/endpoints")>()),
  projectsApi: { get: (id: number) => get(id) },
}));

function Probe() {
  return <p>{useProjectLabel(10)}. Itens patrimoniais.</p>;
}
function renderWith(permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(projectKeys.detail(10), { id: 10, name: "Center Norte" });
  const user: CurrentUser = { id: 1, login: "u", email: "u@gai.local", status: "ACTIVE", organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" as const })) };
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user } as AuthState}>
        <Probe />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Subtítulo das telas do projeto", () => {
  it("usa o nome do projeto, como o breadcrumb", () => {
    renderWith(["projects:read"]);
    expect(screen.getByText("Center Norte. Itens patrimoniais.")).toBeInTheDocument();
  });

  it("sem projects:read, mostra Projeto #id e não consulta a API", () => {
    renderWith(["inventory-accounting-items:read"]);
    expect(screen.getByText("Projeto #10. Itens patrimoniais.")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
