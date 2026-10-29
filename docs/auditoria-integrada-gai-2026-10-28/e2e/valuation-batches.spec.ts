import { test, expect as baseExpect } from "../../../gai-frontend/node_modules/@playwright/test/index.mjs";
import { createRequire } from "node:module";
const XLSX = createRequire(import.meta.url)(
  "../../../gai-backend/node_modules/xlsx",
) as typeof import("../../../gai-backend/node_modules/xlsx");
const expect = baseExpect.configure({ timeout: 15000 });
test.skip(
  process.env.GAI_VALUATIONS_REAL !== "1",
  "Requires local development stack and synthetic fixtures",
);
test.use({ baseURL: "http://127.0.0.1:33320" });
test("ORG_ADMIN selects between pages, previews and applies common/individual valuations with persisted results and protected XLSX", async ({
  page,
}, info) => {
  test.setTimeout(240000);
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
      { timeout: 60000 },
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
  const post = async (path: string, data: object) => {
    const r = await page.request.post(api + path, { headers, data });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as { id: number };
  };
  const p = (
    await post("/projects", {
      organization_id: 1,
      company_id: 1,
      name: "SINTETICO Avaliacoes em lote " + Date.now(),
    })
  ).id;
  const ids: number[] = [];
  for (let n = 0; n < 23; n++)
    ids.push(
      (
        await post(`/projects/${p}/inventory-items`, {
          old_plate: "B" + n,
          description: "SINTETICO Bem avaliavel " + n,
          new_value: "999.99",
          used_value: "333.33",
        })
      ).id,
    );
  const root = `/app/projects/${p}/inventory-items`;
  await page.goto(root);
  await page
    .getByRole("checkbox", { name: `Selecionar item ${ids[22]}`, exact: true })
    .check();
  await page
    .getByRole("button", { name: "Proxima pagina", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: `Selecionar item ${ids[0]}`, exact: true })
    .check();
  await expect(
    page.getByText("2 itens selecionados", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Avaliar selecionados", exact: true })
    .click();
  await page
    .getByLabel("Fonte da avaliação em lote", { exact: true })
    .fill("SINTETICO Catalogo comum documentado");
  await page
    .getByLabel("Data da avaliação em lote", { exact: true })
    .fill("2026-10-27");
  await page.getByLabel("Valor novo comum", { exact: true }).fill("150.00");
  await page.getByLabel("Valor usado comum", { exact: true }).fill("75.00");
  const previewResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/valuation-batches/preview") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Gerar prévia da avaliação", exact: true })
    .click();
  const b = (await (await previewResponse).json()) as {
    id: number;
    total: number;
  };
  expect(b.total).toBe(2);
  await expect(page.getByRole("dialog")).toContainText("Sem histórico");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("cell", {
        name: /SINTETICO Catalogo comum documentado · 27\/10\/2026/,
      })
      .first(),
  ).toBeVisible();
  // Preview alone must not append individual history.
  const before = await page.request.get(
    api + `/projects/${p}/inventory-items/${ids[0]}/valuations`,
    { headers },
  );
  expect(((await before.json()) as { items: unknown[] }).items).toHaveLength(0);
  await page
    .getByRole("button", {
      name: "Confirmar e registrar 2 avaliações",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Aplicação confirmada");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await page.reload();
  await page.getByText("Operações anteriores", { exact: true }).click();
  await page
    .getByRole("button", { name: `Consultar operação #${b.id}`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Aprovado · avaliação #",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "SINTETICO Catalogo comum documentado",
  );
  await page.screenshot({
    path: info.outputPath("valuation-common-result-desktop.png"),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Limpar seleção", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: `Selecionar item ${ids[22]}`, exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: `Selecionar item ${ids[21]}`, exact: true })
    .check();
  await page
    .getByRole("button", { name: "Avaliar selecionados", exact: true })
    .click();
  await page
    .getByLabel("Modo de valores", { exact: true })
    .selectOption("individual");
  await page
    .getByLabel("Fonte da avaliação em lote", { exact: true })
    .fill("SINTETICO Catalogo individual documentado");
  await page
    .getByLabel("Data da avaliação em lote", { exact: true })
    .fill("2026-10-27");
  await page
    .getByLabel(`Valor usado do item ${ids[22]}`, { exact: true })
    .fill("25.50");
  await page
    .getByLabel(`Valor novo do item ${ids[21]}`, { exact: true })
    .fill("350.75");
  const secondPreview = page.waitForResponse(
    (r) =>
      r.url().endsWith("/valuation-batches/preview") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Gerar prévia da avaliação", exact: true })
    .click();
  const b2 = (await (await secondPreview).json()) as { id: number };
  await expect(page.getByRole("dialog")).toContainText(
    "SINTETICO Catalogo comum documentado",
  );
  await page
    .getByRole("button", {
      name: "Confirmar e registrar 2 avaliações",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Aplicação confirmada");
  const exporting = page.waitForResponse(
    (r) => r.url().endsWith("/export-jobs") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", {
      name: "Exportar resultados do projeto em XLSX",
      exact: true,
    })
    .click();
  const job = (await (await exporting).json()) as { id: number };
  await expect
    .poll(
      async () => {
        const r = await page.request.get(
          api + `/projects/${p}/export-jobs/${job.id}`,
          { headers },
        );
        return ((await r.json()) as { status: string }).status;
      },
      { timeout: 45000 },
    )
    .toBe("finished");
  const file = await page.request.get(
    api + `/projects/${p}/export-jobs/${job.id}/download`,
    { headers },
  );
  expect(file.status()).toBe(200);
  const book = XLSX.read(await file.body(), { type: "buffer" });
  expect(
    XLSX.utils.sheet_to_json(book.Sheets["Avaliacoes em lote"]),
  ).toHaveLength(4);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  const nav = page.getByRole("navigation", { name: "Abas do projeto" });
  await nav.getByRole("link", { name: "Visão geral", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${p}/summary$`));
  await nav.getByRole("link", { name: "Itens", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${p}/inventory-items$`));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByText("Operações anteriores", { exact: true }).click();
  await page
    .getByRole("button", { name: `Consultar operação #${b2.id}`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Aprovado · avaliação #",
  );
  await page.screenshot({
    path: info.outputPath("valuation-individual-result-mobile.png"),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `Histórico do item #${ids[22]}`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Avaliacoes manuais");
  await expect(page.getByRole("dialog")).toContainText(
    "SINTETICO Catalogo individual documentado",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "SINTETICO Catalogo comum documentado",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  const history = await page.request.get(
    api + `/projects/${p}/inventory-items/${ids[22]}/valuations`,
    { headers },
  );
  const records = (await history.json()) as {
    items: Array<{
      used_value: string;
      source: string;
      batch_operation_id: number;
    }>;
  };
  expect(records.items).toHaveLength(2);
  expect(records.items[0]).toMatchObject({
    used_value: "25.50",
    batch_operation_id: b2.id,
  });
  const master = await page.request.get(
    api + `/projects/${p}/inventory-items/${ids[22]}`,
    { headers },
  );
  expect(await master.json()).toMatchObject({
    old_plate: "B22",
    new_value: "999.99",
    used_value: "333.33",
  });
  await info.attach("synthetic-fixture", {
    body: JSON.stringify({
      projectId: p,
      commonOperation: b.id,
      individualOperation: b2.id,
      exportJob: job.id,
      url: "http://127.0.0.1:33320" + root,
    }),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
  expect(http).toEqual([]);
});
