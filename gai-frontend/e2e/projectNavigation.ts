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

/** Abre o grupo (que leva à sua primeira aba visível) e depois a aba pedida. */
export async function openProjectTab(page: Page, group: string, tab: string) {
  await projectNav(page).getByRole("link", { name: group, exact: true }).click();
  await projectTabLink(page, group, tab).click();
}
