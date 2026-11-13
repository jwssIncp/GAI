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

const divergentWithoutIssues: ProjectSummary = {
  ...clean,
  inventory: { ...clean.inventory, divergent_items: 2 },
  accounting: { ...clean.accounting, not_found_accounting_items: 3 },
};
const approver = (keys: string[]) => ({ approvePayments: keys.includes("payments:approve"), approveExpenses: keys.includes("expenses:approve") });

describe("Regras dos alertas ⚠ v1 revisadas (somente dados de /projects/:id/dashboard)", () => {
  it("não gera alerta para um projeto sem problemas", () => {
    expect(projectTabAlerts(clean, approver(["payments:approve", "expenses:approve"]))).toEqual({});
  });

  it("com pendências geradas, Itens e Base contábil não alertam (a ação está em Pendências)", () => {
    const alerts = projectTabAlerts(withProblems);
    expect(Object.keys(alerts).sort()).toEqual(["exports", "field-team", "imports", "pending-issues"]);
    expect(alerts["pending-issues"]).toEqual({ count: 5, severity: "danger", description: "5 pendências abertas ou em revisão, 1 crítica ou alta" });
    expect(alerts["field-team"]).toEqual({ severity: "warning", description: "Projeto ativo sem inventariante vinculado" });
  });

  it("opção B: divergências sem nenhuma pendência gerada alertam Itens e Base contábil", () => {
    const alerts = projectTabAlerts(divergentWithoutIssues);
    expect(alerts["inventory-items"]).toEqual({ count: 2, severity: "warning", description: "2 itens divergentes, sem pendência gerada" });
    expect(alerts["accounting-items"]).toEqual({ count: 3, severity: "warning", description: "3 itens contábeis não encontrados, sem pendência gerada" });
  });

  it("imagens com envio pendente não geram alerta (estado transitório)", () => {
    expect(projectTabAlerts({ ...clean, images: { ...clean.images, pending_upload_images: 4 } })).toEqual({});
  });

  it("financeiro só para quem aprova, contando só o que a pessoa pode aprovar", () => {
    expect(projectTabAlerts(withProblems).finance).toBeUndefined();
    expect(projectTabAlerts(withProblems, approver(["payments:approve"])).finance).toEqual({ count: 1, severity: "warning", description: "1 pagamento aguardando sua aprovação" });
    expect(projectTabAlerts(withProblems, approver(["expenses:approve"])).finance?.count).toBe(2);
    expect(projectTabAlerts(withProblems, approver(["payments:approve", "expenses:approve"])).finance?.count).toBe(3);
  });

  it("equipe só alerta com projeto ativo; financeiro/importações/exportações ausentes não geram alerta", () => {
    const paused = projectTabAlerts({ ...withProblems, project: { ...withProblems.project, status: "paused" } as ProjectSummary["project"] });
    expect(paused["field-team"]).toBeUndefined();
    const partial = projectTabAlerts({ ...withProblems, financial: null, imports: null, exports: null }, approver(["payments:approve"]));
    expect(partial.finance).toBeUndefined();
    expect(partial.imports).toBeUndefined();
    expect(partial.exports).toBeUndefined();
  });

  it("pendências sem críticas/altas é aviso, não perigo", () => {
    expect(projectTabAlerts({ ...clean, pending_issues: { ...zeroIssues, total_pending_issues: 2, open_pending_issues: 2 } })["pending-issues"]?.severity).toBe("warning");
  });
});

describe("Exibição dos alertas no grupo e na aba", () => {
  beforeEach(() => {
    dashboard.mockReset();
    dashboard.mockResolvedValue(withProblems);
  });

  it("mostra ⚠ no grupo (1º nível) e na aba (2º nível), sem mudar o nome acessível", async () => {
    const nav = renderAt("/app/projects/10/pending-issues", user([...everything, "payments:approve"]));
    const tab = await nav.findByRole("link", { name: "Pendências" });
    await vi.waitFor(() => expect(tab).toHaveAttribute("aria-describedby"));
    expect(description(tab)).toBe("Atenção: 5 pendências abertas ou em revisão, 1 crítica ou alta");
    const group = nav.getByRole("link", { name: "Inventário" });
    expect(description(group)).toBe("Atenção: Pendências: 5 pendências abertas ou em revisão, 1 crítica ou alta");
    expect(description(nav.getByRole("link", { name: "Financeiro" }))).toBe("Atenção: Pagamentos e despesas: 1 pagamento aguardando sua aprovação");
    expect(nav.getByRole("link", { name: "Campo" })).toHaveAttribute("aria-describedby");
    expect(nav.getByRole("link", { name: "Contábil e laudo" })).not.toHaveAttribute("aria-describedby");
    expect(nav.getByRole("link", { name: "Sessões e conciliação" })).not.toHaveAttribute("aria-describedby");
    expect(nav.getByRole("link", { name: "Itens e avaliação" })).not.toHaveAttribute("aria-describedby");
  });

  it("sem permissão de aprovar, o grupo Financeiro não alerta", async () => {
    const nav = renderAt("/app/projects/10/finance", user(everything));
    await vi.waitFor(() => expect(nav.getByRole("link", { name: "Inventário" })).toHaveAttribute("aria-describedby"));
    expect(nav.getByRole("link", { name: "Financeiro" })).not.toHaveAttribute("aria-describedby");
    expect(nav.getByRole("link", { name: "Pagamentos e despesas" }).textContent).toBe("Pagamentos e despesas");
  });

  it("mostra a quantidade ao lado do ⚠ na aba, mas não no grupo, sem mudar o nome acessível", async () => {
    const nav = renderAt("/app/projects/10/pending-issues", user(everything));
    const tab = await nav.findByRole("link", { name: "Pendências" });
    await vi.waitFor(() => expect(tab.textContent).toBe("Pendências5"));
    expect(nav.getByRole("link", { name: "Itens e avaliação" }).textContent).toBe("Itens e avaliação");
    expect(nav.getByRole("link", { name: "Inventário" }).textContent).toBe("Inventário");
  });

  it("não revela dados de abas sem permissão: perfil de campo não vê alerta financeiro nem contábil", async () => {
    dashboard.mockResolvedValue({ ...divergentWithoutIssues, financial: { ...clean.financial!, pending_payments: 4 } });
    renderAt("/app/projects/10/inventory-items", user(["projects:read", "inventory-items:read", "inventory-sessions:read", "field-coordination:read"]));
    await screen.findByRole("link", { name: "Itens e avaliação" });
    const nav = within(screen.getByRole("navigation", { name: "Abas do projeto" }));
    await vi.waitFor(() => expect(nav.getByRole("link", { name: "Itens e avaliação" })).toHaveAttribute("aria-describedby"));
    expect(nav.getByRole("link", { name: "Itens e avaliação" }).textContent).toBe("Itens e avaliação2");
    expect(description(nav.getByRole("link", { name: "Inventário" }))).toBe("Atenção: Itens e avaliação: 2 itens divergentes, sem pendência gerada");
    const hidden = document.querySelector('[aria-label="Abas do projeto"] [hidden]')?.textContent ?? "";
    const navText = (screen.getByRole("navigation", { name: "Abas do projeto" }).textContent ?? "") + hidden;
    expect(navText).not.toMatch(/pagamento|despesa|contábil|importaç|exportaç|inventariante vinculado/i);
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
