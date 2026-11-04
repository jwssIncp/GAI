import { test, expect, type Page } from "@playwright/test";
import { runtimePassword } from "../e2e/runtime-credentials";

const temporary = "tttttttt";
const permanent = "nnnnnnnn";
async function signIn(page: Page, identifier: string, password: string) {
  await page.getByLabel("Login ou email", { exact: true }).fill(identifier);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
async function changePassword(page: Page, current: string, next: string) {
  await page.getByLabel("Senha atual ou temporária").fill(current);
  await page.getByLabel("Nova senha", { exact: true }).fill(next);
  await page.getByLabel("Confirmar nova senha").fill(next);
  await page
    .getByRole("button", { name: "Alterar senha e encerrar sessões" })
    .click();
}
const session = (page: Page) =>
  page.evaluate(() => {
    const raw = sessionStorage.getItem("gai.session.v1");
    return raw ? JSON.parse(raw) : null;
  });

for (const theme of ["light", "dark"]) {
  test(`${theme}: creates with eight characters, changes once, reloads and logs in again without a loop`, async ({
    page,
    browser,
    request,
  }, testInfo) => {
    await page.addInitScript(
      (value) => localStorage.setItem("gai.theme", value),
      theme,
    );
    await page.goto("/app/users");
    await signIn(page, "org.admin", runtimePassword("org.admin"));
    await expect(page).toHaveURL(/\/app\/users$/);
    await page.getByRole("link", { name: "Cadastrar usuário" }).click();
    const identifier = `password.browser.${theme}`;
    await page.getByLabel("Nome completo").fill(`Pessoa descartável ${theme}`);
    await page.getByLabel("E-mail").fill(`${identifier}@example.test`);
    await page.getByLabel("Login", { exact: true }).fill(identifier);
    await page.getByRole("checkbox", { name: /Operador/ }).check();
    await page.getByLabel("Senha temporária", { exact: true }).fill(temporary);
    await page
      .getByRole("button", { name: "Cadastrar usuário", exact: true })
      .click();
    await expect(page).toHaveURL(/\/app\/users$/);

    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:33340",
    });
    try {
      await context.addInitScript(
        (value) => localStorage.setItem("gai.theme", value),
        theme,
      );
      const first = await context.newPage();
      await first.goto("/login");
      await signIn(first, identifier, temporary);
      await expect(first).toHaveURL(/\/app\/change-password$/);
      const old = await session(first);
      expect(old.user.must_change_password).toBe(true);
      await changePassword(first, temporary, "nnnnnnn");
      await expect(
        first.getByText("Informe uma senha com 8 a 128 caracteres.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(first).toHaveURL(/\/app\/change-password$/);
      await changePassword(first, temporary, permanent);
      await expect(first).toHaveURL(/\/login$/);
      await expect(first.getByRole("status")).toContainText("Entre novamente");
      expect(await session(first)).toBeNull();
      expect(
        (
          await request.get("/api/v1/auth/me", {
            headers: { Authorization: `Bearer ${old.accessToken}` },
          })
        ).status(),
      ).toBe(401);
      expect(
        (
          await request.post("/api/v1/auth/login", {
            data: { identifier, password: temporary },
          })
        ).status(),
      ).toBe(401);

      // Reproduce the obsolete return path left by an expired first-access session.
      await first.goto("/app/change-password");
      await expect(first).toHaveURL(/\/login$/);
      await signIn(first, identifier, permanent);
      await expect(first).toHaveURL(/\/app\/dashboard$/);
      const fresh = await session(first);
      expect(fresh.user.must_change_password).toBe(false);
      expect(fresh.accessToken).not.toBe(old.accessToken);
      expect(fresh.user.organization_id).toBe(1);
      await first.reload();
      await expect(
        first.getByRole("button", { name: `Menu do usuário ${identifier}` }),
      ).toBeVisible();
      expect((await session(first)).user.must_change_password).toBe(false);
      await first.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(first).toHaveURL(/\/app\/dashboard$/);
      await expect(first.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /^((?!dark).)*$/,
      );
      await first.screenshot({
        path: testInfo.outputPath(`${theme}-after-relogin.png`),
        fullPage: true,
      });
      await first
        .getByRole("button", { name: `Menu do usuário ${identifier}` })
        .click();
      await first.getByRole("menuitem", { name: "Sair", exact: true }).click();
      await expect(first).toHaveURL(/\/login$/);
      expect(await session(first)).toBeNull();
      await signIn(first, identifier, permanent);
      await expect(first).toHaveURL(/\/app\/dashboard$/);
      expect((await session(first)).user.must_change_password).toBe(false);
      await first.goto("/app/users/new");
      await expect(first).toHaveURL(/access-denied$/);
    } finally {
      await context.close();
    }
  });
}
