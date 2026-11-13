import { describe, expect, it } from "vitest";
import { activeProjectTabId, groupOfTab, projectTabGroups } from "./projectNavigation";

// Barra plana anterior à reorganização (ProjectLayout.tsx, commit 27366ddc), sem a aba
// "Imagens", removida por decisão aprovada (abria a mesma tela de Itens). Garante que
// nenhuma aba perdeu destino nem teve permissão alterada.
const previousTabs: Array<[path: string, permissions: string[]]> = [
  ["summary", ["projects:read"]],
  ["dashboard", ["projects:read"]],
  ["/app/budgets?project_id=7", ["budgets:read"]],
  ["contracts", ["projects:read", "contracts:read"]],
  ["preparation/kickoff", ["project-preparation:read"]],
  ["field-coordination", ["field-coordination:read"]],
  ["inventory-items", ["inventory-items:read"]],
  ["inventory/sessions", ["inventory-sessions:read"]],
  ["accounting-items", ["inventory-accounting-items:read"]],
  ["pending-issues", ["inventory-pending-issues:read"]],
  ["summary#inventariantes", ["projects:read", "project-field-agents:read"]],
  ["finance", ["payments:read", "expenses:read"]],
  ["/app/finance/dre?project_id=7", ["dre:read"]],
  ["/app/finance/receivables?project_id=7", ["receivables:read"]],
  ["/app/finance/cash-flow?project_id=7", ["cash-flow:read"]],
  ["technical-reports", ["technical-reports:read"]],
  ["finance/accountabilities", ["expense-accountabilities:read"]],
  ["import-sessions", ["import-sessions:read"]],
  ["export-jobs", ["export-jobs:read"]],
  ["summary#unidades", ["projects:read", "project-units:read"]],
  ["summary#configuracoes", ["projects:read"]],
];

describe("Navegação do projeto em dois níveis", () => {
  const groups = projectTabGroups("7");
  const tabs = groups.flatMap((group) => group.tabs);

  it("preserva destino e permissões de todas as abas anteriores (exceto Imagens)", () => {
    expect(tabs).toHaveLength(previousTabs.length);
    for (const [path, permissions] of previousTabs) {
      const tab = tabs.find((candidate) => candidate.path === path);
      expect(tab, path).toBeDefined();
      expect(tab!.permissions, path).toEqual(permissions);
    }
    expect(tabs.some((tab) => tab.path.includes("view=images"))).toBe(false);
  });

  it("organiza os grupos aprovados e marca as telas globais como externas", () => {
    expect(groups.map((group) => group.label)).toEqual([
      "Visão geral",
      "Campo",
      "Inventário",
      "Contábil e laudo",
      "Comercial",
      "Financeiro",
    ]);
    expect(tabs.filter((tab) => tab.external).map((tab) => tab.label)).toEqual([
      "Orçamentos",
      "Recebíveis",
      "Fluxo de caixa",
      "DRE Gerencial",
    ]);
    expect(new Set(tabs.map((tab) => tab.id)).size).toBe(tabs.length);
  });

  it.each([
    ["/app/projects/7/summary", "", "summary", "overview"],
    ["/app/projects/7/summary", "#unidades", "units", "overview"],
    ["/app/projects/7/summary", "#configuracoes", "settings", "overview"],
    ["/app/projects/7/summary", "#inventariantes", "field-team", "field"],
    ["/app/projects/7/preparation/client-checklist", "", "preparation", "field"],
    ["/app/projects/7/inventory/sessions/12", "", "inventory-sessions", "inventory"],
    ["/app/projects/7/inventory-items", "", "inventory-items", "inventory"],
    ["/app/projects/7/technical-reports/templates/3", "", "technical-reports", "accounting"],
    ["/app/projects/7/finance", "", "finance", "finance"],
    ["/app/projects/7/finance/accountabilities", "", "accountabilities", "finance"],
    ["/app/projects/7/import-sessions", "", "imports", "overview"],
    ["/app/projects/7/export-jobs", "", "exports", "overview"],
    ["/app/projects/7/contracts", "", "contracts", "commercial"],
  ])("%s%s ativa a aba %s no grupo %s", (pathname, hash, tabId, groupId) => {
    expect(activeProjectTabId("7", pathname, hash)).toBe(tabId);
    expect(groupOfTab(groups, tabId)?.id).toBe(groupId);
  });

  it("não ativa nada fora do projeto ou em rotas sem aba", () => {
    expect(activeProjectTabId("7", "/app/projects/7/area", "")).toBeNull();
    expect(activeProjectTabId("7", "/app/projects/8/summary", "")).toBeNull();
    expect(activeProjectTabId("7", "/app/budgets", "")).toBeNull();
    expect(activeProjectTabId("7", "/app/projects/7/financeiro", "")).toBeNull();
  });
});
