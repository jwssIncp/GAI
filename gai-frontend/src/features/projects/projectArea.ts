import { activeProjectTabId, groupOfTab, projectTabGroups } from "./projectNavigation";

// Área "Projetos" no padrão do sistema anterior (Netlify): uma segunda linha de abas que vale
// para todos os projetos — Painel Geral, Kick-off, Pendências - Campo, Inventário,
// Conciliação Físico-Contábil, Avaliação e Laudo. Cada sub-aba começa escolhendo o projeto
// (lista) e mostra a tela daquele projeto; o projeto escolhido fica lembrado entre as abas.

export type ProjectAreaTab = {
  id: string;
  label: string;
  /** Rota da sub-aba na área (lista para escolher o projeto, ou o Painel Geral). */
  to: string;
  /** Tela do projeto aberta pela sub-aba, relativa a /app/projects/:id/. */
  projectPath?: string;
  /** Grupos de navegação do projeto (projectNavigation.ts) que pertencem a esta sub-aba. */
  groups: string[];
  permissions: string[];
};

export const projectAreaTabs: ProjectAreaTab[] = [
  // O Painel Geral também reúne as telas do GAI que não existem no Netlify (resumo/cadastro,
  // dashboard, unidades, contratos, financeiro e exportações): abrem no clique do projeto.
  { id: "overview", label: "Painel Geral", to: "/app/projects", groups: ["overview", "commercial", "finance"], permissions: ["projects:read"] },
  { id: "kickoff", label: "Kick-off", to: "/app/projects/kickoff", projectPath: "preparation/kickoff", groups: ["kickoff"], permissions: ["projects:read", "project-preparation:read"] },
  { id: "field", label: "Pendências - Campo", to: "/app/projects/field", projectPath: "field-coordination", groups: ["field"], permissions: ["projects:read", "field-coordination:read"] },
  { id: "inventory", label: "Inventário", to: "/app/projects/inventory", projectPath: "inventory-items", groups: ["inventory"], permissions: ["projects:read", "inventory-items:read"] },
  { id: "reconciliation", label: "Conciliação Físico-Contábil", to: "/app/projects/reconciliation", projectPath: "inventory/sessions", groups: ["reconciliation"], permissions: ["projects:read", "inventory-sessions:read"] },
  { id: "valuation", label: "Avaliação", to: "/app/projects/valuation", projectPath: "inventory-items#avaliacao", groups: ["valuation"], permissions: ["projects:read", "inventory-items:read", "asset-valuations:read"] },
  { id: "reports", label: "Laudo", to: "/app/projects/reports", projectPath: "technical-reports", groups: ["reports"], permissions: ["projects:read", "technical-reports:read"] },
];

export function projectAreaTab(id: string): ProjectAreaTab {
  return projectAreaTabs.find((tab) => tab.id === id)!;
}

/** Sub-aba ativa para a rota atual: as rotas da área e qualquer tela dentro de um projeto. */
export function activeProjectAreaTab(pathname: string, hash = ""): ProjectAreaTab | null {
  const path = pathname.replace(/\/+$/, "");
  const direct = projectAreaTabs.find((tab) => tab.id !== "overview" && path === tab.to);
  if (direct) return direct;
  if (path === "/app/projects" || path === "/app/projects/new") return projectAreaTab("overview");
  const project = path.match(/^\/app\/projects\/([1-9]\d*)(?:\/|$)/)?.[1];
  if (!project) return null;
  const group = groupOfTab(projectTabGroups(project), activeProjectTabId(project, path, hash));
  return projectAreaTabs.find((tab) => group && tab.groups.includes(group.id)) ?? projectAreaTab("overview");
}

const STORAGE_KEY = "gai.projects.current";

/** Projeto escolhido por último na área (vale ao trocar de sub-aba). */
export function rememberedProject(): number | null {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function rememberProject(projectId: number | null) {
  try {
    if (projectId) window.localStorage.setItem(STORAGE_KEY, String(projectId));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem armazenamento (navegação privada): cada sub-aba volta a pedir o projeto.
  }
}

/** Endereço da tela do projeto para a sub-aba (Painel Geral: resumo/cadastro do projeto). */
export function projectAreaHref(tab: ProjectAreaTab, projectId: number) {
  return `/app/projects/${projectId}/${tab.projectPath ?? "summary"}`;
}
