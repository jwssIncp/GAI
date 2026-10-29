import { test, expect as baseExpect } from "../../../gai-frontend/node_modules/@playwright/test/index.mjs";
const expect = baseExpect.configure({ timeout: 15000 });
import { createRequire } from "node:module";
const XLSX = createRequire(import.meta.url)(
  "../../../gai-backend/node_modules/xlsx",
) as typeof import("../../../gai-backend/node_modules/xlsx");
test.skip(
  process.env.GAI_ASSISTED_REAL !== "1",
  "Requires local development services and synthetic fixtures",
);
test.use({ baseURL: "http://127.0.0.1:33320" });
test("ORG_ADMIN reviews and persists assisted reconciliation while retaining project navigation", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await expect
    .poll(
      async () => {
        try {
          return (
            await page.request.get("http://127.0.0.1:33320/api/v1/health")
          ).status();
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
  const errors: string[] = [],
    http: Array<{ url: string; status: number }> = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400)
      http.push({ url: r.url(), status: r.status() });
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
  const headers = { Authorization: "Bearer " + stored.accessToken };
  const api = "http://127.0.0.1:33319/api/v1";
  const post = async (path: string, data: object = {}) => {
    const r = await page.request.post(api + path, { headers, data });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as Record<string, unknown>;
  };
  const stamp = Date.now();
  const p = (
    await post("/projects", {
      organization_id: 1,
      company_id: 1,
      name: "SINTETICO Conciliacao assistida " + stamp,
    })
  ).id as number;
  const agent = (
    await post("/field-agents", { name: "SINTETICO Assistido " + stamp })
  ).id as number;
  await post(`/projects/${p}/field-agents`, { field_agent_id: agent });
  const item = (
    await post(`/projects/${p}/inventory-items`, {
      old_plate: "P100",
      description: "Motor eletrico industrial",
    })
  ).id as number;
  const s = (
    await post(`/projects/${p}/inventory-sessions`, {
      name: "SINTETICO Revisao assistida " + stamp,
    })
  ).id as number;
  const started = await post(`/projects/${p}/inventory-sessions/${s}/start`);
  const round = (started.round as { id: number }).id;
  await post(
    `/projects/${p}/inventory-sessions/${s}/rounds/${round}/observations`,
    {
      inventory_item_id: item,
      field_agent_id: agent,
      result: "found",
      observed_plate: "P100",
      observed_serial_number: "SN100",
      location_text: "Galpao 1",
    },
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        placa: "P200",
        descricao_01: "Motor eletrico industrial",
        numero_serie: "SN100",
        localizacao: "Galpao 1",
      },
    ]),
    "Base",
  );
  const imported = await page.request.post(
    api + `/projects/${p}/accounting-imports`,
    {
      headers,
      multipart: {
        file: {
          name: "sintetico.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: XLSX.write(wb, {
            type: "buffer",
            bookType: "xlsx",
          }) as Buffer,
        },
      },
    },
  );
  expect(imported.status()).toBe(201);
  await page.goto(`/app/projects/${p}/inventory/sessions/${s}`);
  const panel = page.getByRole("region", { name: "Conciliação assistida" });
  await panel
    .getByRole("button", { name: "Gerar sugestões · primeiros 20 itens" })
    .click();
  await panel.getByRole("button", { name: "Comparar e revisar" }).click();
  await expect(page.getByRole("dialog")).toContainText("Série exata");
  await expect(page.getByRole("dialog")).toContainText("placas divergem");
  await page
    .getByLabel("Justificativa")
    .fill(
      "SINTETICO: conferido numero de serie e descricao em revisao humana.",
    );
  await page.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(panel.getByRole("cell", { name: /Aprovada/ })).toBeVisible();
  await page.reload();
  await expect(panel.getByRole("cell", { name: /Aprovada/ })).toBeVisible();
  await panel.getByRole("button", { name: "Comparar e revisar" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "SINTETICO: conferido numero de serie",
  );
  await expect(page.getByRole("dialog")).toContainText("Conciliação #");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("assisted-desktop.png") });
  const nav = page.getByRole("navigation", { name: "Abas do projeto" });
  await nav.getByRole("link", { name: "Itens", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${p}/inventory-items$`));
  await page.goBack();
  await expect(panel.getByRole("cell", { name: /Aprovada/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await panel.scrollIntoViewIfNeeded();
  await expect(
    panel.getByRole("button", { name: "Comparar e revisar" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("assisted-mobile.png") });
  const check = await page.request.get(
    api + `/projects/${p}/inventory-sessions/${s}/assisted-reconciliation/runs`,
    { headers },
  );
  expect(check.status()).toBe(200);
  const runs = (await check.json()) as { items: Array<{ id: number }> };
  const candidates = await page.request.get(
    api +
      `/projects/${p}/inventory-sessions/${s}/assisted-reconciliation/runs/${runs.items[0].id}/candidates`,
    { headers },
  );
  expect(
    ((await candidates.json()) as { items: Array<{ status: string }> }).items[0]
      .status,
  ).toBe("approved");
  await info.attach("synthetic-fixture", {
    body: JSON.stringify({
      projectId: p,
      sessionId: s,
      itemId: item,
      url: `http://127.0.0.1:33320/app/projects/${p}/inventory/sessions/${s}`,
    }),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
  expect(http).toEqual([]);
});
