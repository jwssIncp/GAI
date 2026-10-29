import { test, expect as baseExpect } from "../../../gai-frontend/node_modules/@playwright/test/index.mjs";
import { createRequire } from "node:module";
const XLSX = createRequire(import.meta.url)(
  "../../../gai-backend/node_modules/xlsx",
) as typeof import("../../../gai-backend/node_modules/xlsx");
const expect = baseExpect.configure({ timeout: 15000 });
test.skip(
  process.env.GAI_CONTRACTS_REAL !== "1",
  "Requires local stack and synthetic data only",
);
test.use({ baseURL: "http://127.0.0.1:33320" });
test("ORG_ADMIN manages contracts/amendments, refreshes history and exports filtered commercial overview", async ({
  page,
}, info) => {
  test.setTimeout(180000);
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
      http.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("/login");
  await page.getByLabel("Login ou email").fill(process.env.GAI_E2E_LOGIN!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.GAI_E2E_PASSWORD!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL("**/app/dashboard");
  const stored = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("gai.session.v1")!) as {
        accessToken: string;
      },
  );
  const headers = { Authorization: "Bearer " + stored.accessToken },
    segment = "SINTETICO-COMERCIAL-" + Date.now(),
    number = "TESTE-" + Date.now();
  const createProject = async (suffix: string) => {
    const r = await page.request.post("/api/v1/projects", {
      headers,
      data: {
        organization_id: 1,
        company_id: 1,
        name: "SINTETICO Contratos reais " + suffix + " " + Date.now(),
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as { id: number };
  };
  const p = (await createProject("A")).id,
    p2 = (await createProject("B")).id;
  await page.goto(`/app/projects/${p}/summary`);
  await page
    .getByRole("navigation", { name: "Abas do projeto" })
    .getByRole("link", { name: "Contratos", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo contrato" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Número do contrato").fill(number);
  await dialog.getByLabel("Data de contratação").fill("2024-03-10");
  await dialog.getByLabel("Início da vigência").fill("2024-03-10");
  await dialog.getByLabel("Fim da vigência").fill("2029-12-31");
  await dialog.getByLabel("Valor original", { exact: true }).fill("100.10");
  await dialog.getByLabel("Tipo de contratação").fill("Serviço sintético");
  await dialog.getByLabel("Segmento", { exact: true }).fill(segment);
  await dialog
    .getByLabel("Origem comercial")
    .fill("Homologação local sintética");
  await dialog.getByLabel("Recorrência", { exact: true }).selectOption("true");
  await dialog
    .getByLabel("Serviços contratados (separados por ponto e vírgula)")
    .fill("Inventário; Avaliação");
  await dialog.getByLabel("Quantidade estimada de bens").fill("100");
  await dialog
    .getByLabel("Escopo original")
    .fill("Escopo sintético sem prestação real");
  await dialog
    .getByLabel("Condições comerciais")
    .fill("Sem cobrança real. Dados sintéticos.");
  await dialog.getByLabel("Status contratual").selectOption("active");
  await dialog.getByRole("button", { name: "Salvar contrato" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(`Contrato ${number} · versão 1`)).toBeVisible();
  const contractId = Number(new URL(page.url()).searchParams.get("contract"));
  await page.getByRole("button", { name: "Registrar aditivo" }).click();
  await dialog.getByLabel("Identificador do aditivo").fill("AD-01");
  await dialog.getByLabel("Data do aditivo").fill("2026-10-27");
  await dialog.getByLabel("Tipo do aditivo").selectOption("mixed");
  await dialog
    .getByLabel("Variação de valor (use sinal negativo para redução)")
    .fill("0.20");
  await dialog.getByLabel("Novo fim da vigência").fill("2030-12-31");
  await dialog
    .getByLabel("Novo escopo")
    .fill("Ampliação sintética documentada");
  await dialog
    .getByLabel("Justificativa")
    .fill("Teste de aditivo com centavos e histórico");
  await dialog.getByRole("button", { name: "Salvar aditivo" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(`Contrato ${number} · versão 2`)).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Ampliação sintética documentada", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText("AD-01", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar contrato" }).click();
  await dialog
    .getByLabel("Condições comerciais")
    .fill("Condições sintéticas revisadas");
  await dialog.getByLabel("Justificativa").fill("Revisão documental sintética");
  await dialog.getByRole("button", { name: "Salvar contrato" }).click();
  await expect(page.getByText(`Contrato ${number} · versão 3`)).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Abas do projeto" });
  await nav.getByRole("link", { name: "Visão geral", exact: true }).click();
  await nav.getByRole("link", { name: "Contratos", exact: true }).click();
  await expect(page.locator("[data-project-id]")).toHaveAttribute(
    "data-project-id",
    String(p),
  );
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/projects/${p}/summary$`));
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/projects/${p}/contracts$`));
  await page.goto("/app/dashboard");
  await page.getByLabel("Segmento", { exact: true }).fill(segment);
  await page.getByLabel("Contratado a partir de").fill("2024-01-01");
  await page.getByLabel("Contratado até").fill("2024-12-31");
  await page.getByLabel("Recorrência contratual").selectOption("true");
  await page
    .getByLabel("Serviço contratado", { exact: true })
    .fill("Inventário");
  await page.getByLabel("Mínimo de bens estimados").fill("90");
  await page.getByLabel("Máximo de bens estimados").fill("110");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  const commercial = page.getByRole("region", {
    name: "Indicadores comerciais",
  });
  await expect(
    commercial.getByRole("link", { name: `${number} · v3` }),
  ).toBeVisible();
  await expect(
    commercial.getByText("R$ 100,30", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    commercial.getByText("2024", { exact: false }).first(),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await commercial
    .getByRole("button", { name: "Exportar contratos Excel" })
    .click();
  const download = await downloadEvent;
  const file = await download.path();
  const workbook = XLSX.readFile(file!);
  const rows = XLSX.utils.sheet_to_json<{
    Contrato: string;
    Original: string;
    Vigente: string;
    Versao: number;
  }>(workbook.Sheets.Contratos);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    Contrato: number,
    Original: "100.10",
    Vigente: "100.30",
    Versao: 3,
  });
  await page.screenshot({
    path: info.outputPath("commercial-overview-desktop.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Segmento", { exact: true })).toHaveValue(
    segment,
  );
  await expect(
    commercial.getByRole("link", { name: `${number} · v3` }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await commercial.getByRole("link", { name: `${number} · v3` }).click();
  await expect(page.getByText(`Contrato ${number} · versão 3`)).toBeVisible();
  await page.screenshot({
    path: info.outputPath("contract-history-mobile.png"),
    fullPage: true,
  });
  await page.goto(`/app/projects/${p2}/contracts`);
  await expect(
    page.getByRole("heading", { name: "Contratos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: number, exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("[data-project-id]")).toHaveAttribute(
    "data-project-id",
    String(p2),
  );
  await page.goto(`/app/projects/${p}/contracts?contract=${contractId}`);
  await expect(page.getByText(`Contrato ${number} · versão 3`)).toBeVisible();
  const detail = await page.request.get(
    `/api/v1/projects/${p}/contracts/${contractId}`,
    { headers },
  );
  expect((await detail.json()).versions).toHaveLength(3);
  expect(errors).toEqual([]);
  expect(http).toEqual([]);
  await info.attach("synthetic-fixture", {
    body: JSON.stringify({
      project_id: p,
      second_project_id: p2,
      contract_id: contractId,
      segment,
      number,
      versions: 3,
      original: "100.10",
      current: "100.30",
      http_errors: http,
      page_errors: errors,
    }),
    contentType: "application/json",
  });
});
