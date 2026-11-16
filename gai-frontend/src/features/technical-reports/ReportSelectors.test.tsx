import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import { SourceSelection } from "./ReportForms";
import { ReportResponsiblesPage } from "./ReportTemplatesPage";
import { selectionFrom, type Selection } from "./reportApi";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api/http", () => ({ api: { get: mocks.get, post: mocks.post } }));

const sessions = [
  { id: 5, name: "Campanha matriz 2026", status: "finished" },
  { id: 6, name: "Recontagem filial", status: "active" },
];
const batches = [
  { id: 30, status: "applied", total: 12, confirmedAt: "2026-10-01T13:00:00.000Z" },
  { id: 31, status: "preview", total: 4, confirmedAt: null },
];
const people = [
  { id: 2, full_name: "Ana Admin", login: "org.admin" },
  { id: 8, full_name: "Carla Perita", login: "carla" },
];

function route(url: string, config?: { params?: Record<string, unknown> }) {
  if (url === "/projects/7/inventory-sessions")
    return Promise.resolve({ data: { items: sessions, page: 1, page_size: 100, total_items: 2, total_pages: 1 } });
  const s = url.match(/^\/projects\/7\/inventory-sessions\/(\d+)$/);
  if (s) return Promise.resolve({ data: sessions.find((x) => x.id === Number(s[1])) });
  if (url === "/projects/7/valuation-batches")
    return Promise.resolve({ data: { items: batches, total: 2, page: 1, page_size: 100, limit: 500 } });
  const b = url.match(/^\/projects\/7\/valuation-batches\/(\d+)$/);
  if (b) return Promise.resolve({ data: batches.find((x) => x.id === Number(b[1])) });
  if (url === "/projects/7/technical-reports/responsible-user-options") {
    const q = String(config?.params?.search ?? "").toLowerCase();
    const items = people.filter((p) => !q || `${p.full_name} ${p.login}`.toLowerCase().includes(q));
    return Promise.resolve({ data: { items, page: 1, page_size: 20, total: items.length, total_pages: 1 } });
  }
  if (url === "/projects/7/technical-reports/responsibles")
    return Promise.resolve({
      data: [
        {
          id: 1,
          userId: 2,
          user_name: "Ana Admin",
          user_login: "org.admin",
          data: { id: 1, user_id: 2, display_name: "Ana", function: "Elaboradora", professional_registration: "", registration_evidence: "" },
        },
      ],
    });
  return Promise.reject(new Error("rota inesperada " + url));
}

function wrap(ui: React.ReactNode, path = "/projects/7/x") {
  const auth = {
    user: { id: 2, login: "org.admin", organization_id: 1, permissions: [] },
    bootstrapping: false,
  } as unknown as AuthState;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/projects/:projectId/x" element={ui} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

function SelectionForm({ initial }: { initial?: Selection }) {
  const [sent, setSent] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(JSON.stringify(selectionFrom(new FormData(e.currentTarget))));
      }}
    >
      <SourceSelection initial={initial} />
      <button type="submit">Enviar</button>
      <output>{sent}</output>
    </form>
  );
}

describe("Laudos: sessão, lote e responsável escolhidos pelo nome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(route);
    mocks.post.mockResolvedValue({ data: { id: 2 } });
  });

  it("escolhe a sessão do projeto pelo nome e envia o ID dela", async () => {
    wrap(<SelectionForm />);
    const user = userEvent.setup();
    expect(screen.queryByText(/\(ID/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Observações da sessão" }));
    const box = screen.getByRole("combobox", { name: "Sessão de inventário" });
    await user.type(box, "recont");
    await user.click(await screen.findByRole("option", { name: /^Recontagem filial/ }));
    expect(box).toHaveValue("Recontagem filial");
    expect(mocks.get).toHaveBeenCalledWith("/projects/7/inventory-sessions", { params: { page: 1, page_size: 100 } });
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    const sent = JSON.parse(screen.getByRole("status").textContent!);
    expect(sent.families.sort()).toEqual(["identity", "observations"]);
    expect(sent.session_id).toBe(6);
  });

  it("lista só lotes confirmados e mostra o rótulo de seleção já salva", async () => {
    wrap(<SelectionForm initial={{ families: ["identity", "valuation", "observations"], session_id: 5, valuation_batch_id: 30 }} />);
    const user = userEvent.setup();
    const batch = screen.getByRole("combobox", { name: "Lote confirmado de avaliação" });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Sessão de inventário" })).toHaveValue("Campanha matriz 2026"));
    await waitFor(() => expect((batch as HTMLInputElement).value).toMatch(/^Lote confirmado em \d{2}\/10\/2026/));
    expect((batch as HTMLInputElement).value).not.toContain("30");
    await user.click(batch);
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("12 itens avaliados");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(JSON.parse(screen.getByRole("status").textContent!)).toMatchObject({ session_id: 5, valuation_batch_id: 30 });
  });

  it("cadastra responsável escolhendo o usuário pelo nome, sem exigir users:read", async () => {
    wrap(<ReportResponsiblesPage />);
    const user = userEvent.setup();
    expect(await screen.findByText("Ana Admin (org.admin)")).toBeInTheDocument();
    expect(screen.queryByText("Usuário ID")).not.toBeInTheDocument();
    const box = screen.getByRole("combobox", { name: "Usuário da organização" });
    await user.type(box, "carla");
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        "/projects/7/technical-reports/responsible-user-options",
        expect.objectContaining({ params: expect.objectContaining({ search: "carla" }) }),
      ),
    );
    expect(mocks.get).not.toHaveBeenCalledWith("/users", expect.anything());
    await user.click(await screen.findByRole("option", { name: "Carla Perita (carla)" }));
    await user.type(screen.getByLabelText("Nome para identificação no documento"), "Carla Perita");
    await user.type(screen.getByLabelText("Função declarada"), "Perita avaliadora");
    await user.type(screen.getByLabelText("Justificativa"), "Cadastro da perita");
    await user.click(screen.getByRole("checkbox", { name: /Confirmo a autorização/ }));
    await user.click(screen.getByRole("button", { name: "Cadastrar responsável" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/projects/7/technical-reports/responsibles",
        expect.objectContaining({ user_id: 8, display_name: "Carla Perita" }),
      ),
    );
  });
});
