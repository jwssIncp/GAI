import type { Locator, Page } from "@playwright/test";

// Área Projetos no padrão do sistema anterior (ver src/features/projects/projectArea.ts):
// sub-abas no cabeçalho ("Telas de Projetos": Painel Geral, Kick-off, ...) e, dentro do
// projeto, a barra "Abas do projeto" com as telas da sub-aba ativa quando há mais de uma.
// Os grupos Painel, Comercial e Financeiro pertencem ao Painel Geral (telas extras do GAI).
export function projectNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Abas do projeto" });
}

export function projectAreaNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Telas de Projetos" });
}

const OVERVIEW_GROUPS = new Set(["Painel", "Comercial", "Financeiro"]);
/** Sub-abas com uma tela só: o link do cabeçalho já é a tela. */
const SINGLE_TAB_AREAS = new Set(["Kick-off", "Avaliação", "Laudo"]);

function areaOf(group: string) {
  return OVERVIEW_GROUPS.has(group) ? "Painel Geral" : group;
}

export function projectTabLink(page: Page, group: string, tab: string): Locator {
  const area = areaOf(group);
  if (SINGLE_TAB_AREAS.has(area)) return projectAreaNav(page).getByRole("link", { name: area, exact: true });
  return projectNav(page).getByRole("group", { name: `Telas de ${area}` }).getByRole("link", { name: tab, exact: true });
}

/** Abre a sub-aba da área (no mesmo projeto) e depois a tela pedida. */
export async function openProjectTab(page: Page, group: string, tab: string) {
  const area = areaOf(group);
  const project = new URL(page.url()).pathname.match(/^\/app\/projects\/(\d+)/)?.[1];
  if (area === "Painel Geral") {
    // As telas extras do GAI abrem pelo projeto (resumo), não pela lista do Painel Geral.
    const link = projectTabLink(page, group, tab);
    if (!(await link.isVisible().catch(() => false)) && project) await page.goto(`/app/projects/${project}/summary`);
    await projectTabLink(page, group, tab).click();
    return;
  }
  await projectAreaNav(page).getByRole("link", { name: area, exact: true }).click();
  if (!SINGLE_TAB_AREAS.has(area)) await projectTabLink(page, group, tab).click();
}
