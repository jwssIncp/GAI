import { test, expect, type Page } from "@playwright/test";

const agent = {
  id: 7,
  organization_id: 1,
  organization_name: "Organização sintética",
  user_id: null,
  name: "Pessoa sintética",
  email: "sintetico@example.invalid",
  phone: "11999998888",
  document: null,
  status: "active",
  created_at: "2026-11-04T12:00:00Z",
  updated_at: "2026-11-04T12:00:00Z",
};
const pageOf = (items: unknown[]) => ({
  items,
  page: 1,
  page_size: 20,
  total_items: items.length,
  total_pages: items.length ? 1 : 0,
});
async function setup(page: Page, platform = false, theme = "light") {
  const user = {
    id: 2,
    login: "sintetico",
    email: "sintetico@example.invalid",
    full_name: "Administrador sintético",
    status: "ACTIVE",
    organization_id: platform ? null : 1,
    role_assignments: [
      {
        assignment_id: 1,
        role_id: 2,
        role_key: platform ? "PLATFORM_ADMIN" : "ORG_ADMIN",
        role_name: "Administrador",
        role_type: "SYSTEM",
        organization_id: null,
        assigned_at: "2026-11-04T12:00:00Z",
      },
    ],
  };
  await page.addInitScript(
    ({ user, theme }) => {
      sessionStorage.setItem(
        "gai.session.v1",
        JSON.stringify({
          accessToken: "synthetic-browser-session",
          expiresAt: "2099-01-01T00:00:00Z",
          user,
        }),
      );
      localStorage.setItem("gai.theme", theme);
    },
    { user, theme },
  );
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      method = route.request().method();
    const data = url.pathname.endsWith("/auth/me")
      ? user
      : url.pathname.endsWith("/user-options")
        ? pageOf([
            {
              id: 8,
              full_name: "Conta sintética",
              login: "conta",
              email: "conta@example.invalid",
              status: "ACTIVE",
            },
          ])
        : url.pathname.endsWith("/history") ||
            url.pathname.endsWith("/projects")
          ? pageOf([])
          : url.pathname.endsWith("/invite") ||
              url.pathname.endsWith("/resend-invitation")
            ? { invitation_delivery: "DEVELOPMENT" }
            : url.pathname.endsWith("/record")
              ? agent
              : url.pathname.endsWith("/field-agents") && method === "GET"
                ? pageOf([agent])
                : agent;
    await route.fulfill({ json: data, status: method === "POST" ? 201 : 200 });
  });
}

for (const [width, height, label] of [
  [1440, 960, "desktop"],
  [768, 1024, "tablet"],
  [390, 844, "mobile"],
] as const) {
  for (const theme of ["light", "dark"])
    test(`${label} ${theme}: formulário, foco e ausência de overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await setup(page, false, theme);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/app/field-agents");
      await expect(
        page.getByRole("heading", { name: "Inventariantes", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Novo inventariante" }).click();
      const dialog = page.getByRole("dialog", { name: "Novo inventariante" });
      await expect(
        dialog.getByRole("group", { name: "Dados pessoais e contato" }),
      ).toBeVisible();
      await dialog.getByLabel("Nome", { exact: true }).focus();
      await expect(dialog.getByLabel("Nome", { exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByLabel("CPF/CNPJ")).toBeFocused();
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /^(?!.*dark)/,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../.local/field-agents-browser/${label}-${theme}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
}
test("plataforma não vê navegação nem acessa o módulo", async ({ page }) => {
  await setup(page, true);
  await page.goto("/app/field-agents");
  await expect(page).toHaveURL(/access-denied/);
  await expect(
    page.getByRole("link", { name: "Inventariantes", exact: true }),
  ).toHaveCount(0);
});
test("cadastro, associação pesquisável e convite sem falsa entrega", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/app/field-agents");
  await page.getByRole("button", { name: "Novo inventariante" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo inventariante" });
  await dialog
    .getByLabel("Nome", { exact: true })
    .fill("Pessoa sintética convidada");
  await dialog.getByLabel("Forma de acesso").selectOption("existing");
  await expect(
    dialog.getByLabel("Usuário vinculado", { exact: true }),
  ).toContainText("Conta sintética");
  await dialog.getByLabel("Forma de acesso").selectOption("invite");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("convite@example.invalid");
  await dialog.getByLabel("Login de acesso").fill("sintetico.convite");
  await dialog.getByRole("button", { name: "Salvar inventariante" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "o convite não foi entregue",
  );
  await expect(
    dialog.getByRole("button", { name: "Salvar inventariante" }),
  ).toBeDisabled();
});
