import { runtimePassword } from './runtime-credentials';
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
const evidence = path.resolve(
  "../docs/reformulacao-usuarios-2026-11-02/screenshots",
);
test('activates a pending invitation through the public page without leaking its fragment', async ({ page }) => {
  await page.goto('/activate-account#token=users-browser-activation-token-only');
  await expect(page.getByRole('heading', { name: 'Ative sua conta' })).toBeVisible();
  await expect(page).toHaveURL(/\/activate-account$/);
  await page.getByLabel('Nova senha', { exact: true }).fill('Personal invitation passphrase!');
  await page.getByLabel('Confirmar nova senha').fill('Personal invitation passphrase!');
  await page.screenshot({ path: path.join(evidence, 'activation-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'Ativar minha conta' }).click();
  await expect(page.getByRole('status')).toContainText('Conta ativada');
  await page.getByRole('link', { name: 'Entrar com a nova senha' }).click();
  await page.getByLabel('Login ou email').fill('activation.browser');
  await page.getByLabel('Senha', { exact: true }).fill('Personal invitation passphrase!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});
async function login(
  page: Page,
  name = "org.admin",
  password = runtimePassword(name),
  route = "/app/users",
) {
  await page.goto(route);
  await page.getByLabel("Login ou email", { exact: true }).fill(name);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(route + "$"));
}
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`${device} ${theme}: dedicated forms and list retain GAI navigation without page overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript(
        (value) => localStorage.setItem("gai.theme", value),
        theme,
      );
      await login(page);
      await expect(
        page.getByRole("link", { name: "org.admin", exact: true }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /^((?!dark).)*$/,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: path.join(evidence, `${device}-list-${theme}.png`),
        fullPage: true,
      });
      await page.getByRole("link", { name: "Cadastrar usuário" }).click();
      await expect(page).toHaveURL(/\/app\/users\/new$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByLabel("Nome completo")).toBeVisible();
      await expect(
        page.getByRole("checkbox", { name: /Operador/ }),
      ).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: path.join(evidence, `${device}-create-${theme}.png`),
        fullPage: true,
      });
      await page.getByLabel("Nome completo").focus();
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("E-mail")).toBeFocused();
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await page
        .getByRole("row")
        .filter({ hasText: "test.user" })
        .getByRole("button", { name: "Ações de test.user" })
        .click();
      await page
        .getByRole("menuitem", { name: "Editar usuário", exact: true })
        .click();
      await expect(page).toHaveURL(/\/app\/users\/3\/edit$/);
      await expect(page.getByLabel("E-mail")).toHaveValue("test@gai.local");
      await page.screenshot({
        path: path.join(evidence, `${device}-edit-${theme}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}
test("creates with an initial profile and requires a first-access password change", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Cadastrar usuário" }).click();
  await page.getByLabel("Nome completo").fill("Pessoa Sintética Navegador");
  await page.getByLabel("E-mail").fill("browser.person@example.com");
  await page.getByLabel("Login", { exact: true }).fill("browser.person");
  await page.getByRole("checkbox", { name: /Operador/ }).check();
  await page
    .getByLabel("Senha temporária", { exact: true })
    .fill("Temporary browser password 2026!");
  await page
    .getByRole("button", { name: "Cadastrar usuário", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/users$/);
  const row = page
    .getByRole("row")
    .filter({ hasText: "Pessoa Sintética Navegador" });
  await expect(row).toContainText("Operador");
  const context = await browser.newContext();
  const first = await context.newPage();
  await first.goto("http://127.0.0.1:5344/login");
  await first.getByLabel("Login ou email").fill("browser.person");
  await first
    .getByLabel("Senha", { exact: true })
    .fill("Temporary browser password 2026!");
  await first.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(first).toHaveURL(/\/app\/change-password$/);
  await first
    .getByLabel("Senha atual ou temporária")
    .fill("Temporary browser password 2026!");
  await first
    .getByLabel("Nova senha", { exact: true })
    .fill("My personal browser passphrase!");
  await first
    .getByLabel("Confirmar nova senha")
    .fill("My personal browser passphrase!");
  await first
    .getByRole("button", { name: "Alterar senha e encerrar sessões" })
    .click();
  await expect(first.getByRole("status")).toContainText("Entre novamente");
  await context.close();
});
test("protects unsaved changes and shows the last-admin error for sensitive actions", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Cadastrar usuário" }).click();
  await page.getByLabel("Nome completo").fill("Dados não salvos");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Descartar alterações?");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/users$/);
  await page.getByRole("button", { name: "Ações de org.admin" }).click();
  await page
    .getByRole("menuitem", { name: "Bloquear usuário", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "ao menos um administrador ativo",
  );
});
test("operator cannot access user management and platform sees eligible organization choices", async ({
  page,
}) => {
  await login(page, "test.user", runtimePassword('test.user'), "/app/dashboard");
  await page.goto("/app/users/new");
  await expect(page).toHaveURL(/access-denied$/);
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await login(page, "platform.admin", runtimePassword('platform.admin'), "/app/users/new");
  await expect(page.getByLabel("Organização", { exact: true })).toContainText(
    "GAI Test",
  );
  await page.getByLabel("Organização", { exact: true }).selectOption("1");
  await expect(page.getByRole("checkbox", { name: /Operador/ })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Administrador da plataforma/ }),
  ).toHaveCount(0);
});
