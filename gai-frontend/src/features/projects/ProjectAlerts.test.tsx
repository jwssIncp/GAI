import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/features/auth/AuthContext";
import type { CurrentUser, ProjectSummary } from "@/types/api";
import { ProjectLayout } from "./ProjectLayout";
import { projectTabAlerts } from "./projectNavigation";

const dashboard = vi.fn();
vi.mock("@/api/endpoints", async (original) => ({
  ...(await original<typeof import("@/api/endpoints")>()),
  projectsApi: { dashboard: (id: number) => dashboard(id) },
}));

const zeroIssues = { total_pending_issues: 0, open_pending_issues: 0, in_review_pending_issues: 0, resolved_pending_issues: 0, ignored_pending_issues: 0, cancelled_pending_issues: 0, critical_pending_issues: 0, high_pending_issues: 0, medium_pending_issues: 0, low_pending_issues: 0 };
const clean: ProjectSummary = {
  project: { id: 10, name: "Center Norte", status: "active", organization_id: 1, start_date: "2026-01-01", end_date: null, created_at: "2026-01-01T00:00:00.000Z" } as ProjectSummary["project"],
  inventory: { total_items: 10, evaluated_items: 10, pending_items: 0, divergent_items: 0, not_found_items: 0, duplicated_items: 0, removed_items: 0, inactive_items: 0, progress_percentage: 100 },
  images: { total_images: 1, uploaded_images: 1, pending_upload_images: 0, removed_images: 0 },
  accounting: { total_accounting_items: 10, matched_accounting_items: 10, divergent_accounting_items: 0, not_found_accounting_items: 0, ignored_accounting_items: 0 },
  pending_issues: zeroIssues,
  field_agents: { total_field_agents: 1, active_field_agents: 1, inactive_field_agents: 0, finished_field_agents: 0 },
  financial: { total_payments: 0, pending_payments: 0, approved_payments: 0, paid_payments: 0, cancelled_payments: 0, total_payment_amount: "0.00", total_expenses: 0, pending_expenses: 0, approved_expenses: 0, paid_expenses: 0, rejected_expenses: 0, cancelled_expenses: 0, total_expense_amount: "0.00", financial_total_amount: "0.00" },
  imports: { total_import_sessions: 0, open_import_sessions: 0, processing_import_sessions: 0, finished_import_sessions: 0, failed_import_sessions: 0, cancelled_import_sessions: 0, expired_import_sessions: 0 },
  exports: { total_export_jobs: 0, pending_export_jobs: 0, processing_export_jobs: 0, finished_export_jobs: 0, failed_export_jobs: 0, cancelled_export_jobs: 0, expired_export_jobs: 0 },
  recent_activity: null,
};
const withProblems: ProjectSummary = {
  ...clean,
  pending_issues: { ...zeroIssues, total_pending_issues: 5, open_pending_issues: 4, in_review_pending_issues: 1, critical_pending_issues: 1 },
  inventory: { ...clean.inventory, divergent_items: 2 },
  images: { ...clean.images, pending_upload_images: 1 },
  accounting: { ...clean.accounting, not_found_accounting_items: 3 },
  field_agents: { ...clean.field_agents, active_field_agents: 0 },
  financial: { ...clean.financial!, pending_payments: 1, pending_expenses: 2 },
  imports: { ...clean.imports!, failed_import_sessions: 1 },
  exports: { ...clean.exports!, failed_export_jobs: 2 },
};

function user(permissions: string[]): CurrentUser {
  return { id: 2, login: "u", email: "u@gai.local", status: "ACTIVE", organization_id: 1, role_assignments: [], permissions: permissions.map((key) => ({ key, scope: "ORGANIZATION" as const })) };
}
const everything = ["projects:read", "project-units:read", "import-sessions:read", "export-jobs:read", "project-preparation:read", "field-coordination:read", "project-field-agents:read", "inventory-sessions:read", "inventory-items:read", "inventory-pending-issues:read", "inventory-accounting-items:read", "technical-reports:read", "contracts:read", "budgets:read", "payments:read", "expenses:read", "expense-accountabilities:read"];

function renderAt(path: string, current: CurrentUser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthState = { user: current, accessToken: "t", expiresAt: "2099-01-01", bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId" element={<ProjectLayout />}>
              <Route path="*" element={<h1>Página</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return within(screen.getByRole("navigation", { name: "Abas do projeto" }));
}
const description = (element: HTMLElement) => {
  const id = element.getAttribute("aria-describedby");
  return id ? document.getElementById(id)?.textContent ?? "" : "";
};

describe("Regras dos alertas ⚠ v1 (somente dados de /projects/:id/dashboard)", () => {
  it("não gera alerta para um projeto sem problemas", () => {
    expect(projectTabAlerts(clean)).toEqual({});
  });

  it("gera um alerta por aba com o motivo, usando só o payload do dashboard", () => {
    const alerts = projectTabAlerts(withProblems);
    expect(Object.keys(alerts).sort()).toEqual(["accounting-items", "exports", "field-team", "finance", "imports", "inventory-items", "pending-issues"]);
    expect(alerts["pending-issues"]).toEqual({ severity: "danger", description: "5 pendências abertas ou em revisão, 1 crítica ou alta" });
    expect(alerts["inventory-items"]?.description).toBe("2 itens divergentes, 1 imagem com envio pendente");
    expect(alerts["field-team"]?.description).toBe("Projeto ativo sem inventariante vinculado");
    expect(alerts.finance?.description).toBe("1 pagamento aguardando aprovação, 2 despesas aguardando aprovação");
  });

  it("equipe só alerta com projeto ativo; financeiro/importações/exportações ausentes não geram alerta", () => {
    const paused = projectTabAlerts({ ...withProblems, project: { ...withProblems.project, status: "paused" } as ProjectSummary["project"] });
    expect(paused["field-team"]).toBeUndefined();
    const partial = projectTabAlerts({ ...withProblems, financial: null, imports: null, exports: null });
    expect(partial.finance).toBeUndefined();
    expect(partial.imports).toBeUndefined();
    expect(partial.exports).toBeUndefined();
  });

  it("pendências sem críticas/altas é aviso, não perigo", () => {
    expect(projectTabAlerts({ ...clean, pending_issues: { ...zeroIssues, open_pending_issues: 2 } })["pending-issues"]?.severity).toBe("warning");
  });
});

describe("Exibição dos alertas no grupo e na aba", () => {
  beforeEach(() => {
    dashboard.mockReset();
    dashboard.mockResolvedValue(withProblems);
  });

  it("mostra ⚠ no grupo (1º nível) e na aba (2º nível), sem mudar o nome acessível", async () => {
    const nav = renderAt("/app/projects/10/pending-issues", user(everything));
    const tab = await nav.findByRole("link", { name: "Pendências" });
    expect(await nav.findByRole("link", { name: "Pendências" })).toHaveAttribute("aria-describedby");
    expect(description(tab)).toBe("Atenção: 5 pendências abertas ou em revisão, 1 crítica ou alta");
    const group = nav.getByRole("link", { name: "Inventário" });
    expect(description(group)).toContain("Pendências: 5 pendências");
    expect(description(group)).toContain("Itens e avaliação: 2 itens divergentes");
    expect(nav.getByRole("link", { name: "Financeiro" })).toHaveAttribute("aria-describedby");
    expect(nav.getByRole("link", { name: "Campo" })).toHaveAttribute("aria-describedby");
    expect(nav.getByRole("link", { name: "Contábil e laudo" })).toHaveAttribute("aria-describedby");
    // Sessões e conciliação não tem alerta.
    expect(nav.getByRole("link", { name: "Sessões e conciliação" })).not.toHaveAttribute("aria-describedby");
  });

  it("não revela dados de abas sem permissão: perfil de campo não vê alerta financeiro nem contábil", async () => {
    renderAt("/app/projects/10/inventory-items", user(["projects:read", "inventory-items:read", "inventory-sessions:read", "field-coordination:read"]));
    await screen.findByRole("link", { name: "Itens e avaliação" });
    await vi.waitFor(() => expect(dashboard).toHaveBeenCalled());
    const nav = within(screen.getByRole("navigation", { name: "Abas do projeto" }));
    await vi.waitFor(() => expect(nav.getByRole("link", { name: "Itens e avaliação" })).toHaveAttribute("aria-describedby"));
    const groupDescription = description(nav.getByRole("link", { name: "Inventário" }));
    expect(groupDescription).toContain("Itens e avaliação");
    // Sem inventory-pending-issues:read, o grupo não menciona pendências.
    expect(groupDescription).not.toMatch(/pendência/i);
    const navText = screen.getByRole("navigation", { name: "Abas do projeto" }).textContent ?? "";
    expect(navText).not.toMatch(/pagamento|despesa|contábil|importaç|exportaç|inventariante vinculado/i);
    // Campo: só Coordenação de campo é visível e ela não tem alerta; a equipe (sem permissão) não alerta o grupo.
    expect(nav.getByRole("link", { name: "Campo" })).not.toHaveAttribute("aria-describedby");
  });

  it("faz uma única chamada ao dashboard ao navegar entre abas e nenhuma sem projects:read", async () => {
    const nav = renderAt("/app/projects/10/summary", user(everything));
    await vi.waitFor(() => expect(dashboard).toHaveBeenCalledTimes(1));
    await userEvent.click(nav.getByRole("link", { name: "Inventário" }));
    await userEvent.click(await nav.findByRole("link", { name: "Pendências" }));
    await userEvent.click(nav.getByRole("link", { name: "Financeiro" }));
    expect(dashboard).toHaveBeenCalledTimes(1);
    expect(dashboard).toHaveBeenCalledWith(10);
  });

  it("sem projects:read não consulta o dashboard e não mostra alerta", async () => {
    const nav = renderAt("/app/projects/10/field-coordination", user(["field-coordination:read"]));
    expect(nav.getByRole("link", { name: "Campo" })).not.toHaveAttribute("aria-describedby");
    expect(dashboard).not.toHaveBeenCalled();
  });
});
