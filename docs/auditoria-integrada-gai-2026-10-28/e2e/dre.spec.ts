import { test, expect as baseExpect } from "../../../gai-frontend/node_modules/@playwright/test/index.mjs";
import { writeFile } from "node:fs/promises";
const expect = baseExpect.configure({ timeout: 15000 });
test.skip(
  process.env.GAI_DRE_REAL !== "1",
  "Requires local development with synthetic data",
);
test.use({ baseURL: "http://127.0.0.1:33320" });
test("ORG_ADMIN classifies accrual, adjusts, drills, exports and refreshes", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get("/api/v1/health")).status();
        } catch {
          return 0;
        }
      },
      { timeout: 60000 },
    )
    .toBe(200);
  const errors: string[] = [],
    http: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400)
      http.push(r.status() + " " + r.url());
  });
  await page.goto("/login");
  await page.getByLabel("Login ou email").fill(process.env.GAI_E2E_LOGIN!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.GAI_E2E_PASSWORD!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL("**/app/dashboard");
  const session = await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("gai.session.v1")!) as {
          accessToken: string;
        },
    ),
    headers = { Authorization: "Bearer " + session.accessToken };
  const post = async (path: string, data: object) => {
    const r = await page.request.post("/api/v1" + path, { headers, data });
    expect(r.ok(), await r.text()).toBe(true);
    return await r.json();
  };
  const stamp = Date.now(),
    name = "SINTETICO DRE " + stamp;
  const company = (
    await post("/companies", {
      organization_id: 1,
      name: "SINTETICO Cliente DRE " + stamp,
    })
  ).id;
  const project = (
    await post("/projects", {
      organization_id: 1,
      company_id: company,
      name: "SINTETICO Projeto DRE " + stamp,
    })
  ).id;
  const source = {
    company_id: company,
    project_id: project,
    origin: "manual",
    description: name,
    amount: "100.01",
    currency: "BRL",
    issued_on: "2026-10-01",
    reason: "Homologacao sintetica DRE",
    payment: { mode: "equal", count: 1, first_due_on: "2026-10-31" },
  };
  const preview = await post("/finance/receivables/preview", source),
    receivable = await post("/finance/receivables", {
      ...source,
      command_key: "synthetic-dre-receivable-" + stamp,
      preview_hash: preview.preview_hash,
    });
  await page.goto("/app/projects/" + project + "/summary");
  await page
    .getByRole("link", { name: "DRE Gerencial", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(new RegExp("project_id=" + project));
  const nav = page.getByRole("navigation", { name: "Navegação da DRE" });
  await nav.getByRole("link", { name: "Plano de contas" }).click();
  await page.getByRole("button", { name: "Nova conta gerencial" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da conta").fill(name);
  await dialog.getByLabel("Código", { exact: true }).fill("SYN." + stamp);
  await dialog.getByLabel("Grupo gerencial").selectOption("revenue");
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("Homologacao sintetica de conta DRE");
  await dialog
    .getByRole("checkbox", { name: "Confirmo a configuração gerencial" })
    .check();
  await dialog.getByRole("button", { name: "Confirmar configuração" }).click();
  await expect(dialog).not.toBeVisible();
  const accounts = await (
      await page.request.get("/api/v1/finance/dre/accounts", { headers })
    ).json(),
    account = accounts.find((a: { code: string }) => a.code === "SYN." + stamp);
  expect(account.id).toBeDefined();
  await nav.getByRole("link", { name: "Classificações e ajustes" }).click();
  await page
    .getByRole("button", {
      name: "Classificar receivable:" + receivable.id,
      exact: true,
    })
    .click();
  await dialog
    .getByLabel("Documento e evidência do evento")
    .fill("SINTETICO servico concluido janeiro 2026 " + stamp);
  await dialog.getByLabel("Competência 1", { exact: true }).fill("2026-01");
  await dialog
    .getByRole("combobox", { name: /^Conta gerencial 1/ })
    .selectOption(String(account.id));
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("Competencia documental janeiro, emissao e caixa em outubro");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Confirmar reconhecimento" })
    .click();
  await page.waitForURL("**/dre/entries/*");
  await expect(page).toHaveURL(new RegExp("project_id=" + project));
  const detailUrl = page.url(),
    entryId = Number(new URL(detailUrl).pathname.split("/").at(-1));
  await expect(
    page.getByText("2026-01", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reclassificar / ajustar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reclassificar / ajustar" }).click();
  await dialog.getByLabel("Valor 1", { exact: true }).fill("80.01");
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("SINTETICO ajuste documental de escopo reconhecido");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Salvar ajuste auditável" }).click();
  await expect(dialog).not.toBeVisible();
  const persisted = await (
    await page.request.get("/api/v1/finance/dre/entries/" + entryId, {
      headers,
    })
  ).json();
  expect(persisted.revision).toBe(2);
  expect(persisted.versions).toHaveLength(2);
  expect(persisted.data.allocations[0]).toMatchObject({
    month: "2026-01",
    amount: "80.01",
  });
  await page.goto(
    "/app/finance/dre?project_id=" +
      project +
      "&start_month=2026-01&end_month=2026-01",
  );
  await page
    .getByRole("button", { name: "Receita bruta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lançamentos de Receita bruta" }),
  ).toBeVisible();
  await expect(
    page.getByText("Não validado", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Fontes pendentes de revisão econômica",
    }),
  ).toBeVisible();
  await expect(page.getByText("R$ 20,00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Gerar XLSX da DRE" }).click();
  await expect(
    page.getByRole("button", { name: "Baixar XLSX da DRE" }),
  ).toBeVisible({ timeout: 45000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar XLSX da DRE" }).click();
  const file = await download;
  await file.saveAs(info.outputPath("dre-synthetic.xlsx"));
  await page.screenshot({
    path: info.outputPath("demonstrativo.png"),
    fullPage: true,
  });
  await nav.getByRole("link", { name: "Competências", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fechamento e reabertura de competências",
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Receita bruta", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", {
      name: "Fechamento e reabertura de competências",
    }),
  ).toBeVisible();
  const closeMonth = "2024-11";
  const existingPeriod = page.getByRole("button", {
    name: "Fechar " + closeMonth,
    exact: true,
  });
  const exists = await existingPeriod.count();
  await (
    exists
      ? existingPeriod
      : page.getByRole("button", { name: "Fechar competência", exact: true })
  ).click();
  if (!exists)
    await dialog.getByLabel("Competência", { exact: true }).fill(closeMonth);
  await dialog
    .getByLabel("Referência da política aprovada")
    .fill("SINTETICO Politica de homologacao local " + stamp);
  await dialog
    .locator('input[name="reviewed_groups"]')
    .evaluateAll((elements) =>
      elements.forEach((el) => (el as HTMLInputElement).click()),
    );
  await dialog.getByRole("checkbox", { name: /Fontes e fatos/ }).check();
  await dialog
    .getByRole("checkbox", { name: /autoriza fechamento parcial/ })
    .check();
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("SINTETICO teste de fechamento parcial e reabertura imediata");
  await dialog.getByRole("checkbox", { name: /Confirmo o efeito/ }).check();
  await dialog.getByRole("button", { name: "Confirmar fechamento" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Reabrir " + closeMonth, exact: true })
    .click();
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("SINTETICO reabertura apos homologacao para manter periodo aberto");
  await dialog.getByRole("checkbox", { name: /Confirmo o efeito/ }).check();
  await dialog.getByRole("button", { name: "Confirmar reabertura" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fechar " + closeMonth, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByRole("link", { name: "Classificações e ajustes" }).click();
  await expect(page).toHaveURL(new RegExp("project_id=" + project));
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: info.outputPath("mobile.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(http).toEqual([]);
  const evidence = JSON.stringify(
    {
      project,
      company,
      receivable: receivable.id,
      entryId,
      account: account.id,
      revision: persisted.revision,
      month: "2026-01",
      issued_on: "2026-10-01",
      amount: "80.01",
      errors,
      http,
    },
    null,
    2,
  );
  await writeFile(info.outputPath("evidence.json"), evidence);
  await info.attach("synthetic-evidence", {
    body: evidence,
    contentType: "application/json",
  });
});
