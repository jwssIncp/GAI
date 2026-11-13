import type { ProjectSummary } from "@/types/api";

// Estrutura de navegação do workspace do projeto em dois níveis (grupo › aba).
// Só organiza a apresentação: caminhos e permissões são exatamente os das rotas
// existentes em router/projectRoutes.tsx. Nenhuma URL nova é criada aqui.

export type ProjectTab = {
  id: string;
  label: string;
  /** Relativo a /app/projects/:id/ ou absoluto (começa com "/"). Pode conter ?query e #hash. */
  path: string;
  permissions: string[];
  hint?: string;
  /** Abre uma tela global (fora do workspace), filtrada pelo projeto. */
  external?: boolean;
};

export type ProjectTabGroup = {
  id: string;
  label: string;
  tabs: ProjectTab[];
};

export function projectTabGroups(projectId: string): ProjectTabGroup[] {
  return [
    {
      id: "overview",
      label: "Visão geral",
      tabs: [
        { id: "summary", label: "Resumo", path: "summary", permissions: ["projects:read"] },
        { id: "dashboard", label: "Dashboard", path: "dashboard", permissions: ["projects:read"] },
        { id: "units", label: "Unidades", path: "summary#unidades", permissions: ["projects:read", "project-units:read"] },
        { id: "settings", label: "Configurações", path: "summary#configuracoes", permissions: ["projects:read"] },
        { id: "imports", label: "Importações", path: "import-sessions", permissions: ["import-sessions:read"] },
        { id: "exports", label: "Exportações", path: "export-jobs", permissions: ["export-jobs:read"] },
      ],
    },
    {
      id: "field",
      label: "Campo",
      tabs: [
        { id: "preparation", label: "Preparação", path: "preparation/kickoff", permissions: ["project-preparation:read"], hint: "Kick-off e checklist do cliente." },
        { id: "field-coordination", label: "Coordenação de campo", path: "field-coordination", permissions: ["field-coordination:read"], hint: "Checklist operacional, tarefas e prontidão de campo." },
        { id: "field-team", label: "Equipe de campo", path: "summary#inventariantes", permissions: ["projects:read", "project-field-agents:read"], hint: "Inventariantes vinculados a este projeto." },
      ],
    },
    {
      id: "inventory",
      label: "Inventário",
      tabs: [
        { id: "inventory-sessions", label: "Sessões e conciliação", path: "inventory/sessions", permissions: ["inventory-sessions:read"], hint: "Sessões, rodadas, observações, conciliações e conciliação assistida." },
        { id: "inventory-items", label: "Itens e avaliação", path: "inventory-items", permissions: ["inventory-items:read"], hint: "Itens, imagens (no detalhe do item) e avaliação manual ou em lote." },
        { id: "pending-issues", label: "Pendências", path: "pending-issues", permissions: ["inventory-pending-issues:read"], hint: "Ocorrências do inventário: divergências, não encontrados e duplicidades." },
      ],
    },
    {
      id: "accounting",
      label: "Contábil e laudo",
      tabs: [
        { id: "accounting-items", label: "Base contábil", path: "accounting-items", permissions: ["inventory-accounting-items:read"] },
        { id: "technical-reports", label: "Laudos", path: "technical-reports", permissions: ["technical-reports:read"] },
      ],
    },
    {
      id: "commercial",
      label: "Comercial",
      tabs: [
        { id: "contracts", label: "Contratos", path: "contracts", permissions: ["projects:read", "contracts:read"] },
        { id: "budgets", label: "Orçamentos", path: `/app/budgets?project_id=${projectId}`, permissions: ["budgets:read"], external: true, hint: "Abre Orçamentos (fora do projeto), filtrado por este projeto." },
      ],
    },
    {
      id: "finance",
      label: "Financeiro",
      tabs: [
        { id: "finance", label: "Pagamentos e despesas", path: "finance", permissions: ["payments:read", "expenses:read"] },
        { id: "accountabilities", label: "Prestações", path: "finance/accountabilities", permissions: ["expense-accountabilities:read"] },
        { id: "receivables", label: "Recebíveis", path: `/app/finance/receivables?project_id=${projectId}`, permissions: ["receivables:read"], external: true, hint: "Abre Recebíveis (fora do projeto), filtrado por este projeto." },
        { id: "cash-flow", label: "Fluxo de caixa", path: `/app/finance/cash-flow?project_id=${projectId}`, permissions: ["cash-flow:read"], external: true, hint: "Abre Fluxo de caixa (fora do projeto), filtrado por este projeto." },
        { id: "dre", label: "DRE Gerencial", path: `/app/finance/dre?project_id=${projectId}`, permissions: ["dre:read"], external: true, hint: "Abre a DRE Gerencial (fora do projeto), filtrada por este projeto." },
      ],
    },
  ];
}

/**
 * Aba ativa para a localização atual dentro de /app/projects/:id/.
 * Abas externas nunca ficam ativas: ao abri-las o usuário sai do workspace.
 */
export function activeProjectTabId(projectId: string, pathname: string, hash: string): string | null {
  const root = `/app/projects/${projectId}/`;
  if (!pathname.startsWith(root)) return null;
  const rest = pathname.slice(root.length).replace(/\/+$/, "");
  const anchor = hash.replace(/^#/, "");
  if (rest === "summary") {
    if (anchor === "unidades") return "units";
    if (anchor === "configuracoes") return "settings";
    if (anchor === "inventariantes") return "field-team";
    return "summary";
  }
  const exact: Record<string, string> = {
    dashboard: "dashboard",
    "import-sessions": "imports",
    "export-jobs": "exports",
    "field-coordination": "field-coordination",
    "inventory-items": "inventory-items",
    "pending-issues": "pending-issues",
    "accounting-items": "accounting-items",
    contracts: "contracts",
    finance: "finance",
    "finance/accountabilities": "accountabilities",
  };
  if (exact[rest]) return exact[rest];
  const prefixes: Array<[string, string]> = [
    ["preparation", "preparation"],
    ["inventory/sessions", "inventory-sessions"],
    ["technical-reports", "technical-reports"],
  ];
  for (const [prefix, id] of prefixes) if (rest === prefix || rest.startsWith(prefix + "/")) return id;
  return null;
}

export function groupOfTab(groups: ProjectTabGroup[], tabId: string | null): ProjectTabGroup | null {
  if (!tabId) return null;
  return groups.find((group) => group.tabs.some((tab) => tab.id === tabId)) ?? null;
}

export type BreadcrumbStep = { label: string; to?: string };

/**
 * Trilha do workspace depois de "Projetos › <projeto>": grupo › aba › detalhe, com os
 * mesmos nomes da navegação em dois níveis. `to` é relativo a /app/projects/:id/.
 */
export function projectBreadcrumbSteps(projectId: string, pathname: string, hash: string): BreadcrumbStep[] {
  const root = `/app/projects/${projectId}/`;
  if (!pathname.startsWith(root)) return [];
  const rest = pathname.slice(root.length).replace(/\/+$/, "");
  const groups = projectTabGroups(projectId);
  const tabId = activeProjectTabId(projectId, pathname, hash);
  const group = groupOfTab(groups, tabId);
  const tab = group?.tabs.find((candidate) => candidate.id === tabId);
  if (!group || !tab) return rest === "area" ? [{ label: "Área" }] : [];
  const parts = rest.split("/");
  const details: BreadcrumbStep[] = [];
  if (tab.id === "preparation" && parts[1]) {
    details.push({ label: parts[1] === "client-checklist" ? "Checklist do cliente" : "Kick-off" });
  } else if (tab.id === "inventory-sessions" && parts[2]) {
    details.push({ label: `Sessão #${parts[2]}` });
  } else if (tab.id === "technical-reports" && parts[1]) {
    if (parts[1] === "templates") {
      details.push({ label: "Modelos da organização", to: parts[2] ? "technical-reports/templates" : undefined });
      if (parts[2]) details.push({ label: `Modelo #${parts[2]}` });
    } else if (parts[1] === "responsibles") {
      details.push({ label: "Responsáveis cadastrados" });
    } else {
      details.push({ label: `Laudo #${parts[1]}` });
    }
  }
  const tabPath = tab.path.split("#")[0];
  return [{ label: group.label }, { label: tab.label, to: details.length ? tabPath : undefined }, ...details];
}

/** count: quantidade exibida ao lado do ⚠ na aba (ausente quando a regra não é uma contagem). */
export type ProjectTabAlert = { severity: "danger" | "warning"; description: string; count?: number };

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

/**
 * Alertas ⚠ v1 por aba, calculados SOMENTE a partir do payload de GET /projects/:id/dashboard
 * (o mesmo que a Visão geral já busca). Quem chama deve exibir apenas os alertas das abas
 * que o usuário pode ver, para não revelar dados de abas sem permissão.
 */
export type ProjectAlertAccess = { approvePayments: boolean; approveExpenses: boolean };

export function projectTabAlerts(
  summary: ProjectSummary,
  access: ProjectAlertAccess = { approvePayments: false, approveExpenses: false },
): Partial<Record<string, ProjectTabAlert>> {
  const alerts: Partial<Record<string, ProjectTabAlert>> = {};
  // Opção B (revisão da Etapa 3): divergências de itens/base contábil só alertam enquanto o
  // projeto não tem nenhuma pendência gerada — a ação esperada é "Gerar pendências".
  const noIssuesGenerated = summary.pending_issues.total_pending_issues === 0;
  const issues = summary.pending_issues;
  const open = issues.open_pending_issues + issues.in_review_pending_issues;
  if (open > 0) {
    const severe = issues.critical_pending_issues + issues.high_pending_issues;
    alerts["pending-issues"] = {
      count: open,
      severity: severe > 0 ? "danger" : "warning",
      description: `${plural(open, "pendência aberta ou em revisão", "pendências abertas ou em revisão")}${severe ? `, ${plural(severe, "crítica ou alta", "críticas ou altas")}` : ""}`,
    };
  }
  const inventory = summary.inventory;
  const itemProblems = inventory.divergent_items + inventory.not_found_items + inventory.duplicated_items;
  if (itemProblems > 0 && noIssuesGenerated) {
    const parts = [
      inventory.divergent_items ? plural(inventory.divergent_items, "item divergente", "itens divergentes") : null,
      inventory.not_found_items ? plural(inventory.not_found_items, "item não encontrado", "itens não encontrados") : null,
      inventory.duplicated_items ? plural(inventory.duplicated_items, "item duplicado", "itens duplicados") : null,
    ].filter(Boolean);
    alerts["inventory-items"] = { count: itemProblems, severity: "warning", description: `${parts.join(", ")}, sem pendência gerada` };
  }
  const accounting = summary.accounting;
  const accountingProblems = accounting.divergent_accounting_items + accounting.not_found_accounting_items;
  if (accountingProblems > 0 && noIssuesGenerated) {
    alerts["accounting-items"] = {
      count: accountingProblems,
      severity: "warning",
      description: [
        accounting.divergent_accounting_items ? plural(accounting.divergent_accounting_items, "item contábil divergente", "itens contábeis divergentes") : null,
        accounting.not_found_accounting_items ? plural(accounting.not_found_accounting_items, "item contábil não encontrado", "itens contábeis não encontrados") : null,
      ].filter(Boolean).join(", ") + ", sem pendência gerada",
    };
  }
  if (summary.project.status === "active" && summary.field_agents.active_field_agents === 0) {
    alerts["field-team"] = { severity: "warning", description: "Projeto ativo sem inventariante vinculado" };
  }
  // Só para quem pode aprovar, contando apenas o que a pessoa pode aprovar.
  if (summary.financial && (access.approvePayments || access.approveExpenses)) {
    const payments = access.approvePayments ? summary.financial.pending_payments : 0;
    const expenses = access.approveExpenses ? summary.financial.pending_expenses : 0;
    if (payments + expenses > 0) {
      alerts.finance = {
        count: payments + expenses,
        severity: "warning",
        description: [
          payments ? plural(payments, "pagamento aguardando sua aprovação", "pagamentos aguardando sua aprovação") : null,
          expenses ? plural(expenses, "despesa aguardando sua aprovação", "despesas aguardando sua aprovação") : null,
        ].filter(Boolean).join(", "),
      };
    }
  }
  if (summary.imports && summary.imports.failed_import_sessions > 0) {
    alerts.imports = { count: summary.imports.failed_import_sessions, severity: "danger", description: plural(summary.imports.failed_import_sessions, "importação com falha", "importações com falha") };
  }
  if (summary.exports && summary.exports.failed_export_jobs > 0) {
    alerts.exports = { count: summary.exports.failed_export_jobs, severity: "danger", description: plural(summary.exports.failed_export_jobs, "exportação com falha", "exportações com falha") };
  }
  return alerts;
}
