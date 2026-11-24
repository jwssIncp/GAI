import type { Locator, Page } from "@playwright/test";

// Workspace do projeto em dois níveis: grupo (nível 1) › aba do grupo (nível 2).
// Ver src/features/projects/projectNavigation.ts.
export function projectNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Abas do projeto" });
}

/** Grupos de uma aba só (sem a segunda linha): o próprio link do grupo é a aba. */
const SINGLE_TAB_GROUPS = new Set(["Kick-off", "Avaliação", "Laudo"]);

export function projectTabLink(page: Page, group: string, tab: string): Locator {
  if (SINGLE_TAB_GROUPS.has(group)) {
    return projectNav(page).getByRole("group", { name: "Grupos do projeto" }).getByRole("link", { name: group, exact: true });
  }
  return projectNav(page)
    .getByRole("group", { name: `Abas de ${group}` })
    .getByRole("link", { name: tab, exact: true });
}

/** Abre/seleciona o grupo e depois a aba pedida. */
export async function openProjectTab(page: Page, group: string, tab: string) {
  // O grupo é um link (abre sua 1ª aba) ou, se a 1ª aba visível for ↗, um botão que só o seleciona.
  await projectNav(page)
    .getByRole("group", { name: "Grupos do projeto" })
    .getByText(group, { exact: true })
    .click();
  if (!SINGLE_TAB_GROUPS.has(group)) await projectTabLink(page, group, tab).click();
}
