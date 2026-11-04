import { runtimePassword } from './runtime-credentials';
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const screenshots = path.resolve(
  "../docs/reformulacao-cadastro-projetos-2026-11-03/screenshots",
);
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`${device} ${theme}: create, review, edit and inspect a real scoped project`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (value) => localStorage.setItem("gai.theme", value),
        theme,
      );
      await page.goto("/app/projects/new");
      await page
        .getByLabel("Login ou email", { exact: true })
        .fill("org.admin");
      await page.getByLabel("Senha", { exact: true }).fill(runtimePassword('org.admin'));
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Novo projeto", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("combobox", { name: /organiza/i }),
      ).toHaveCount(0);
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /^((?!dark).)*$/,
      );
      const code = `QA-${device}-${theme}`.toUpperCase();
      await page
        .getByLabel("Empresa contratante", { exact: true })
        .selectOption({ label: "Empresa Teste" });
      await page
        .getByLabel("Nome do projeto", { exact: true })
        .fill(`Inventário ${device} ${theme}`);
      await page.getByLabel("Nome do projeto", { exact: true }).press("Tab");
      await expect(
        page.getByLabel("Código do projeto", { exact: true }),
      ).toBeFocused();
      await page.getByLabel("Código do projeto", { exact: true }).fill(code);
      await page
        .getByLabel("Tipo de projeto", { exact: true })
        .selectOption("inventory_valuation");
      await page
        .getByLabel("Descrição", { exact: true })
        .fill("Cadastro de validação com API e banco descartáveis.");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await capture(page, {
        path: path.join(screenshots, `${device}-${theme}-general.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Avançar", exact: true }).click();
      await page
        .getByLabel("Data prevista de início", { exact: true })
        .fill("2026-11-03");
      await page
        .getByLabel("Data prevista de término", { exact: true })
        .fill("2026-11-30");
      await page
        .getByLabel("Responsável pelo projeto", { exact: true })
        .selectOption({ label: "org.admin" });
      await page
        .getByLabel("Observações de planejamento", { exact: true })
        .fill("Planejar visita às unidades e alocar equipe.");
      await page.getByRole("button", { name: "Avançar", exact: true }).click();
      await expect(
        page.getByText("Unidades opcionais no cadastro", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Avançar", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Revisão e confirmação" }),
      ).toBeVisible();
      await expect(
        page.getByText("Empresa Teste", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("03/11/2026", { exact: true })).toBeVisible();
      await expect(page.getByText("30/11/2026", { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await capture(page, {
        path: path.join(screenshots, `${device}-${theme}-review.png`),
        fullPage: true,
      });
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().endsWith("/api/v1/projects"),
      );
      await page
        .getByRole("button", { name: "Criar projeto", exact: true })
        .click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const result = (await response.json()) as {
        id: number;
        organization_id: number;
        status: string;
        code: string;
      };
      expect(result.status).toBe("draft");
      expect(result.organization_id).toBe(1);
      expect(result.code).toBe(code);
      expect(
        response.request().postDataJSON() as Record<string, unknown>,
      ).not.toHaveProperty("organization_id");
      await expect(
        page.getByRole("heading", { name: "Projeto criado", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Abrir projeto e completar estrutura" })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Informações do projeto",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Planejar visita às unidades e alocar equipe.", {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Editar projeto", exact: true })
        .click();
      await page.getByRole("button", { name: "Avançar", exact: true }).click();
      await page
        .getByLabel("Observações de planejamento", { exact: true })
        .fill("Planejamento revisado após confirmação.");
      await page.getByRole("button", { name: "Avançar", exact: true }).click();
      await page.getByRole("button", { name: "Avançar", exact: true }).click();
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/app/projects/${result.id}/summary`),
      );
      await expect(
        page.getByText("Planejamento revisado após confirmação.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Histórico do cadastro",
          exact: true,
        }),
      ).toBeVisible();
      if (device === "desktop")
        await capture(page, {
          path: path.join(screenshots, `${device}-${theme}-details.png`),
          fullPage: true,
        });
      await page.goto(`/app/projects?search=${encodeURIComponent(code)}`);
      await expect(
        page.getByRole("link", {
          name: `Inventário ${device} ${theme}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByText("Empresa #1", { exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByLabel("Indicadores dos projetos filtrados"),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (device === "desktop")
        await capture(page, {
          path: path.join(screenshots, `${device}-${theme}-list.png`),
          fullPage: true,
        });
      expect(errors).toEqual([]);
    });
  }
}

async function capture(page: Page, options: Parameters<Page["screenshot"]>[0]) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ ...options, animations: "disabled", caret: "hide" });
}
