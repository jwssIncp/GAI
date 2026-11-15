import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStoredSession, writeStoredSession } from "@/api/session-storage";
import type { CurrentUser } from "@/types/api";
import { useAuth } from "./AuthContext";
import { AuthProvider, MAX_TIMER_DELAY } from "./AuthProvider";

const me = vi.hoisted(() => vi.fn());
vi.mock("@/api/endpoints", () => ({ authApi: { me, login: vi.fn(), logout: vi.fn() } }));

const DAY = 24 * 60 * 60 * 1000;
const user: CurrentUser = { id: 1, login: "teste", email: "t@example.invalid", status: "ACTIVE" as CurrentUser["status"], role_assignments: [], permissions: [] };

function Who() {
  const { user: current, expiresAt } = useAuth();
  return <p>{current ? `logado até ${expiresAt}` : "deslogado"}</p>;
}

function mount() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Who />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

/** Deixa as promessas pendentes (restore → me) andarem com o relógio parado. */
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe("AuthProvider: expiração da sessão", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
    window.sessionStorage.clear();
    me.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("validade acima de ~24,8 dias não desloga na hora; desloga só ao vencer", async () => {
    const expiresAt = new Date(Date.now() + 30 * DAY).toISOString();
    expect(30 * DAY).toBeGreaterThan(MAX_TIMER_DELAY);
    writeStoredSession({ accessToken: "tok", expiresAt, user });
    me.mockResolvedValue(user);
    mount();
    await settle();
    expect(screen.getByText(`logado até ${expiresAt}`)).toBeInTheDocument();
    // passa 1 segundo e depois 25 dias (estouro do timer antigo): continua logado
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(25 * DAY); });
    expect(screen.getByText(`logado até ${expiresAt}`)).toBeInTheDocument();
    expect(readStoredSession()?.accessToken).toBe("tok");
    // ao vencer (30 dias), desloga e limpa a sessão guardada
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * DAY + 1000); });
    expect(screen.getByText("deslogado")).toBeInTheDocument();
    expect(readStoredSession()).toBeNull();
  });

  it("validade inválida conta como expirada (não vira atraso zero com sessão aberta)", async () => {
    writeStoredSession({ accessToken: "tok", expiresAt: "não é data", user });
    me.mockResolvedValue(user);
    mount();
    await settle();
    expect(screen.getByText("deslogado")).toBeInTheDocument();
    expect(me).not.toHaveBeenCalled();
  });

  it("sincroniza a validade estendida pelo servidor (sessão desliza com o uso)", async () => {
    const first = new Date(Date.now() + 8 * 3600_000).toISOString();
    const extended = new Date(Date.now() + 9 * 3600_000).toISOString();
    writeStoredSession({ accessToken: "tok", expiresAt: first, user });
    me.mockResolvedValue({ ...user, session_expires_at: extended });
    mount();
    await settle();
    expect(screen.getByText(`logado até ${extended}`)).toBeInTheDocument();
    expect(readStoredSession()?.expiresAt).toBe(extended);
    // não desloga na validade antiga
    await act(async () => { await vi.advanceTimersByTimeAsync(8 * 3600_000 + 1000); });
    expect(screen.getByText(`logado até ${extended}`)).toBeInTheDocument();
  });
});
