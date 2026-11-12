import type { Locator, Page } from "@playwright/test";

// Workspace do projeto em dois níveis: grupo (nível 1) › aba do grupo (nível 2).
// Ver src/features/projects/projectNavigation.ts.
export function projectNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Abas do projeto" });
}

export function projectTabLink(page: Page, group: string, tab: string): Locator {
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
  await projectTabLink(page, group, tab).click();
}
