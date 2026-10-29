import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

// Opt-in: uses the actual local API and existing synthetic projects; never mocks requests.
test.skip(
  process.env.GAI_NAV_REAL !== "1",
  "Requires the local stack and synthetic navigation fixture IDs",
);
test.use({ baseURL: process.env.GAI_E2E_BASE_URL ?? "http://localhost:5173" });

test("ORG_ADMIN continuously navigates real project pages, history, deep links, mobile and tenant boundaries", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(12000);
  const fixture = process.env.GAI_TEST_MYSQL_WAVE2 === '1' ? JSON.parse(readFileSync(path.join(process.env.GAI_TEST_EVIDENCE_DIR!, 'navigation-fixture.json'), 'utf8')) : undefined;
  const primary = String(fixture?.primary ?? process.env.GAI_NAV_PRIMARY!);
  const secondary = String(fixture?.secondary ?? process.env.GAI_NAV_SECONDARY!);
  const foreign = String(fixture?.foreignProject ?? process.env.GAI_NAV_FOREIGN!);
  const root = `/app/projects/${primary}/`;
  const errors: string[] = [];
  const unexpected: Array<{ url: string; status: number }> = [];
  const steps: string[] = [];
  let checkingForeign = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.url().includes("/api/") &&
      response.status() >= 400 &&
      !checkingForeign
    ) {
      unexpected.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto("/login");
  await page.getByLabel("Login ou email").fill(process.env.GAI_E2E_LOGIN!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.GAI_E2E_PASSWORD!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL("**/app/dashboard");
  await page.goto(root + "summary");
  const nav = page.getByRole("navigation", { name: "Abas do projeto" });
  await nav.waitFor();
  await page.waitForLoadState("networkidle");
  const handle = await nav.elementHandle();
  const transitions: Array<[string, string]> = [
    ["Itens", "inventory-items"],
    ["Financeiro", "finance"],
    ["Pendências", "pending-issues"],
    ["Dashboard", "dashboard"],
    ["Base contábil", "accounting-items"],
    ["Unidades", "summary#unidades"],
    ["Configurações", "summary#configuracoes"],
    ["Visão geral", "summary"],
    ["Preparação", "preparation/kickoff"],
    ["Itens", "inventory-items"],
    ["Inventário", "inventory/sessions"],
    ["Imagens", "inventory-items?view=images"],
    ["Inventariantes", "summary#inventariantes"],
    ["Prestações", "finance/accountabilities"],
    ["Importações", "import-sessions"],
    ["Exportações", "export-jobs"],
    ["Preparação", "preparation/kickoff"],
  ];
  for (const [label, suffix] of transitions) {
    const link = nav.getByRole("link", { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL((process.env.GAI_E2E_BASE_URL ?? "http://localhost:5173") + root + suffix);
    await page.waitForLoadState("networkidle");
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator("[data-project-id]")).toHaveAttribute(
      "data-project-id",
      primary,
    );
    expect(await handle!.evaluate((node) => node.isConnected)).toBe(true);
    for (const item of await nav.getByRole("link").all()) {
      const href = new URL((await item.getAttribute("href"))!, page.url());
      if (href.pathname.startsWith(root)) expect(href.pathname).toContain(root);
      else {
        expect(href.pathname).toMatch(/^\/app\/(budgets|finance)(\/|$)/);
        expect(href.searchParams.get("project_id")).toBe(primary);
      }
    }
    if (suffix.includes("#")) {
      const target = page.locator(suffix.slice(suffix.indexOf("#")));
      await expect(target).toBeInViewport();
      const targetBox = await target.boundingBox();
      const navBox = await nav.boundingBox();
      expect(targetBox!.y).toBeGreaterThanOrEqual(
        navBox!.y + navBox!.height - 1,
      );
    }
    steps.push(label + ": " + page.url());
    console.info("Navigation passed:", label, suffix);
  }
  await page
    .getByRole("link", { name: "Checklist do Cliente", exact: true })
    .click();
  await expect(page).toHaveURL(/preparation\/client-checklist$/);
  await page.getByRole("link", { name: "Kick-off", exact: true }).click();
  await expect(page).toHaveURL(/preparation\/kickoff$/);
  await page.goBack();
  await expect(page).toHaveURL(/preparation\/client-checklist$/);
  await page.goForward();
  await expect(page).toHaveURL(/preparation\/kickoff$/);
  await page.reload();
  await expect(nav).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Preparação", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(root + "preparation");
  await expect(page).toHaveURL(/preparation\/kickoff$/);
  await page.goto(root + "finance");
  await expect(nav).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: testInfo.outputPath("desktop-finance.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, suffix] of [
    ["Unidades", "summary#unidades"],
    ["Configurações", "summary#configuracoes"],
    ["Itens", "inventory-items"],
    ["Preparação", "preparation/kickoff"],
    ["Dashboard", "dashboard"],
  ]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL((process.env.GAI_E2E_BASE_URL ?? "http://localhost:5173") + root + suffix);
    await page.waitForLoadState("networkidle");
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toBeInViewport();
  }
  await expect(page.getByRole("heading", { name: /^Dashboard/ })).toBeVisible();
  await expect(page.getByText("Calculando indicadores do projeto", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mobile-dashboard.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/projects");
  if (fixture?.secondaryName) await page.getByPlaceholder("Buscar projeto", { exact: true }).fill(fixture.secondaryName);
  const secondaryLink = page
    .locator(`a[href="/app/projects/${secondary}/summary"]`)
    .first();
  await secondaryLink.click();
  await expect(page.locator("[data-project-id]")).toHaveAttribute(
    "data-project-id",
    secondary,
  );
  await nav.getByRole("link", { name: "Itens", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${secondary}/inventory-items$`),
  );
  await page.goto(root + "summary");
  await expect(page.locator("[data-project-id]")).toHaveAttribute(
    "data-project-id",
    primary,
  );

  checkingForeign = true;
  for (const suffix of ["summary", "preparation/kickoff"]) {
    const denied = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/projects/${foreign}`) &&
        response.status() === 403,
    );
    await page.goto(`/app/projects/${foreign}/${suffix}`);
    expect((await denied).status()).toBe(403);
    await expect(
      page.getByText("Insufficient permissions", { exact: true }).first(),
    ).toBeVisible();
    if (process.env.GAI_NAV_FOREIGN_NAME)
      await expect(
        page.getByText(process.env.GAI_NAV_FOREIGN_NAME, { exact: true }),
      ).toHaveCount(0);
  }
  await page.goto(root + "preparation/client-checklist");
  await page.waitForLoadState("networkidle");
  await expect(nav).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("checklist-navigation.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await testInfo.attach("navigation-evidence", {
    body: JSON.stringify(
      {
        primary,
        secondary,
        foreign,
        steps,
        errors,
        unexpected,
        foreignStatus: 403,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
