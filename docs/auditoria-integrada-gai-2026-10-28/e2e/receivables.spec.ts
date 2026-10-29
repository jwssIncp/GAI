import { test, expect as baseExpect } from "../../../gai-frontend/node_modules/@playwright/test/index.mjs";
const expect = baseExpect.configure({ timeout: 15000 });
test.skip(
  process.env.GAI_RECEIVABLES_REAL !== "1",
  "Requires local development stack and synthetic data",
);
test.use({ baseURL: "http://127.0.0.1:33320" });
test("ORG_ADMIN operates installments, partial/full receipts, reversal, cash, export and refresh", async ({
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
    ),
    headers = { Authorization: "Bearer " + stored.accessToken };
  const post = async (path: string, data: object) => {
    const r = await page.request.post("/api/v1" + path, { headers, data });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as { id: number };
  };
  const stamp = Date.now(),
    name = "SINTETICO Recebível " + stamp;
  const company = (
    await post("/companies", {
      organization_id: 1,
      name: "SINTETICO Cliente recebíveis " + stamp,
    })
  ).id;
  const project = (
    await post("/projects", {
      organization_id: 1,
      company_id: company,
      name: "SINTETICO Projeto recebíveis " + stamp,
    })
  ).id;
  await page.goto(`/app/projects/${project}/summary`);
  await page.getByRole("link", { name: "Recebíveis", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`project_id=${project}`));
  await page.getByRole("link", { name: "Novo recebível" }).click();
  await expect(
    page.getByRole("heading", { name: "Novo recebível", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Cliente (ID)", { exact: true }).fill(String(company));
  await expect(page.getByLabel("Cliente (ID)", { exact: true })).toHaveValue(
    String(company),
  );
  await expect(page.getByLabel("Projeto (ID, opcional)")).toHaveValue(
    String(project),
  );
  await page.getByLabel("Descrição", { exact: true }).fill(name);
  await expect(page.getByLabel("Cliente (ID)", { exact: true })).toHaveValue(
    String(company),
  );
  await page.getByLabel("Valor total (decimal)").fill("100.01");
  await expect(page.getByLabel("Cliente (ID)", { exact: true })).toHaveValue(
    String(company),
  );
  await page.getByLabel("Emissão", { exact: true }).fill("2026-01-01");
  await expect(page.getByLabel("Cliente (ID)", { exact: true })).toHaveValue(
    String(company),
  );
  await page.getByLabel("Quantidade de parcelas do saldo").fill("3");
  await expect(page.getByLabel("Cliente (ID)", { exact: true })).toHaveValue(
    String(company),
  );
  await page.getByLabel("Primeiro vencimento").fill("2026-01-31");
  await page
    .getByLabel("Justificativa", { exact: true })
    .fill("Homologação exclusivamente sintética");
  await expect(page.getByLabel("Cliente (ID)", { exact: true })).toHaveValue(
    String(company),
  );
  await page.getByRole("button", { name: "Gerar prévia de parcelas" }).click();
  await expect(page.getByLabel("Cliente (ID)", { exact: true })).toHaveValue(
    String(company),
  );
  await expect(
    page.getByRole("cell", { name: "2026-02-28", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar criação do recebível" })
    .click();
  await page.waitForURL(/\/app\/finance\/receivables\/\d+$/);
  const id = Number(page.url().match(/receivables\/(\d+)/)![1]);
  const get = async () => {
    const r = await page.request.get(`/api/v1/finance/receivables/${id}`, {
      headers,
    });
    expect(r.ok()).toBe(true);
    return (await r.json()) as {
      revision: number;
      received: string;
      open: string;
      status: string;
      installments: { id: number; position: number; open: string }[];
      events: { id: number; operation: string; amount: string }[];
    };
  };
  const receive = async (position: number, amount: string, ref: string) => {
    await page
      .getByRole("button", { name: "Registrar recebimento", exact: true })
      .click();
    const d = page.getByRole("dialog");
    const r = await get();
    await d
      .getByRole("combobox", { name: "Parcela", exact: true })
      .selectOption(
        String(r.installments.find((i) => i.position === position)!.id),
      );
    await d.getByLabel("Valor recebido", { exact: true }).fill(amount);
    await d.getByLabel("Data do recebimento").fill("2026-10-01");
    await d.getByLabel("Forma de recebimento").fill("SINTETICO");
    await d.getByLabel("Referência única do recebimento").fill(ref);
    await d
      .getByLabel("Justificativa")
      .fill("Recebimento sintético de homologação");
    await d.getByRole("checkbox").check();
    await d
      .getByRole("button", { name: "Confirmar registrar recebimento" })
      .click();
    await expect(d).not.toBeVisible();
  };
  await receive(1, "10.00", "SINT-PARCIAL-" + stamp);
  expect((await get()).received).toBe("10.00");
  await page.reload();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  expect((await get()).open).toBe("90.01");
  await receive(1, "23.33", "SINT-SALDO-" + stamp);
  await receive(2, "33.33", "SINT-SEGUNDA-" + stamp);
  await receive(3, "33.35", "SINT-TERCEIRA-" + stamp);
  expect((await get()).status).toBe("paid");
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  const first = (await get()).events.find(
    (e) => e.operation === "receipt" && e.amount === "10.00",
  )!;
  await page
    .getByRole("button", { name: `Estornar evento #${first.id}`, exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Data do estorno").fill("2026-10-02");
  await d
    .getByLabel("Justificativa")
    .fill("Estorno sintético preservando histórico");
  await d.getByRole("checkbox").check();
  await d
    .getByRole("button", { name: "Confirmar estornar recebimento" })
    .click();
  await expect(d).not.toBeVisible();
  expect(await get()).toMatchObject({
    received: "90.01",
    open: "10.00",
    status: "partial",
  });
  await page.reload();
  await expect(
    page.getByRole("cell", { name: /^#\d+ Estorno$/ }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("receivable-history-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Fluxo do cliente" }).click();
  await expect(
    page.getByRole("heading", { name: "Fluxo de caixa", exact: true }),
  ).toBeVisible();
  const cash = await page.request.get(
    `/api/v1/finance/cash-flow?company_id=${company}`,
    { headers },
  );
  expect(cash.ok()).toBe(true);
  const report = (await cash.json()) as {
    totals: { currency: string; expected_in: string; actual_in: string }[];
    movements: unknown[];
  };
  expect(report.totals.find((t) => t.currency === "BRL")).toMatchObject({
    expected_in: "10.00",
    actual_in: "90.01",
  });
  await page.reload();
  await expect(page.getByLabel("Cliente (ID)", { exact: true })).toHaveValue(
    String(company),
  );
  await page.getByLabel("Tipo de exportação").selectOption("statement");
  await page.getByRole("button", { name: "Gerar XLSX" }).click();
  await expect(page.getByRole("button", { name: "Baixar XLSX" })).toBeVisible({
    timeout: 30000,
  });
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar XLSX" }).click();
  const download = await downloading;
  await download.saveAs(info.outputPath("cash-statement.xlsx"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("cash-mobile.png"),
    fullPage: true,
  });
  await page.goto(`/app/finance/receivables/${id}?tab=history`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page
    .getByRole("link", { name: `Consultar projeto #${project}` })
    .click();
  await expect(page.locator("[data-project-id]")).toHaveAttribute(
    "data-project-id",
    String(project),
  );
  await page.goBack();
  await expect(page).toHaveURL(/tab=history/);
  await page.goForward();
  await expect(page.locator("[data-project-id]")).toHaveAttribute(
    "data-project-id",
    String(project),
  );
  expect(errors).toEqual([]);
  expect(http).toEqual([]);
});
