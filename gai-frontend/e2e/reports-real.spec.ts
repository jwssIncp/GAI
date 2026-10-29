import { test, expect as baseExpect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const expect = baseExpect.configure({ timeout: 15000 });
test.skip(
  process.env.GAI_REPORTS_REAL !== "1",
  "Requires local development and synthetic data",
);
test.use({ baseURL: process.env.GAI_E2E_BASE_URL ?? "http://localhost:5173" });
test("ORG_ADMIN creates model, drafts, validates, approves and preserves historical report", async ({
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
  const api = async (
    method: "post" | "get" | "patch",
    path: string,
    data?: object,
  ) => {
    const r = await page.request[method]("/api/v1" + path, {
      headers,
      ...(data ? { data } : {}),
    });
    expect(r.ok(), await r.text()).toBe(true);
    return await r.json();
  };
  const stamp = Date.now(),
    name = "SINTETICO Laudo " + stamp,
    model = "SINTETICO Modelo Laudo " + stamp;
  const company = (
    await api("post", "/companies", {
      organization_id: 1,
      name: "SINTETICO Cliente laudos " + stamp,
    })
  ).id;
  const project = (
    await api("post", "/projects", {
      organization_id: 1,
      company_id: company,
      name: "SINTETICO Projeto laudos " + stamp,
    })
  ).id;
  const item = (
    await api("post", `/projects/${project}/inventory-items`, {
      old_plate: "SYN-" + stamp,
      description: "SINTETICO Equipamento original " + stamp,
    })
  ).id;
  const base = `/projects/${project}/technical-reports`,
    root = "/app" + base;
  await page.goto(`/app/projects/${project}/summary`);
  await page.getByRole("link", { name: "Laudos", exact: true }).click();
  await expect(page).toHaveURL(root);
  const nav = page.getByRole("navigation", { name: "Navegação dos laudos" });
  await nav.getByRole("link", { name: "Responsáveis cadastrados" }).click();
  await expect(
    page.getByRole("heading", { name: "Responsáveis previamente cadastrados" }),
  ).toBeVisible();
  let profiles = await api("get", base + "/responsibles");
  let profile = profiles.find(
    (v: { data: { user_id: number } }) => Number(v.data.user_id) === 2,
  );
  if (!profile) {
    await page.getByLabel("Usuário da organização (ID)").fill("2");
    await page
      .getByLabel("Nome para identificação no documento")
      .fill("SINTETICO Responsavel laudos");
    await page
      .getByLabel("Função declarada")
      .fill("Elaborador documental em homologacao");
    await page
      .getByLabel("Justificativa", { exact: true })
      .fill("SINTETICO cadastro autorizado para homologacao");
    await page
      .getByRole("checkbox", { name: /Confirmo a autorização/ })
      .check();
    await page
      .getByRole("button", { name: "Cadastrar responsável", exact: true })
      .click();
    await expect(
      page.getByText("SINTETICO Responsavel laudos", { exact: true }),
    ).toBeVisible();
    profiles = await api("get", base + "/responsibles");
    profile = profiles.find(
      (v: { data: { user_id: number } }) => Number(v.data.user_id) === 2,
    );
  }
  await nav.getByRole("link", { name: "Modelos da organização" }).click();
  await page
    .getByRole("link", { name: "Criar modelo de laudo", exact: true })
    .click();
  await page.getByLabel("Nome do modelo").fill(model);
  await page
    .getByLabel("Texto padrão da seção 2")
    .fill("SINTETICO escopo documental do modelo");
  await page
    .getByRole("checkbox", { name: "Inventário físico", exact: true })
    .check();
  await page
    .getByLabel("Justificativa", { exact: true })
    .fill("SINTETICO modelo de homologacao");
  await page
    .getByRole("checkbox", {
      name: "Confirmo as regras e o conteúdo do modelo",
    })
    .check();
  await page.getByRole("button", { name: "Salvar rascunho do modelo" }).click();
  await page.waitForURL(/technical-reports\/templates\/\d+$/);
  await page.getByRole("button", { name: "Publicar nova versão" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("SINTETICO publicacao de versao de modelo");
  await dialog
    .getByRole("checkbox", { name: "Confirmo a operação documental" })
    .check();
  await dialog.getByRole("button", { name: "Confirmar publicação" }).click();
  await expect(dialog).not.toBeVisible();
  const templates = await api("get", base + "/templates"),
    template = templates.find(
      (t: { data: { name: string } }) => t.data.name === model,
    );
  expect(template.publishedVersionId).toBeTruthy();
  await nav
    .getByRole("link", { name: "Laudos do projeto", exact: true })
    .click();
  await page.getByRole("button", { name: "Criar laudo", exact: true }).click();
  await dialog.getByLabel("Título do laudo").fill(name);
  await dialog
    .getByRole("combobox", { name: /Modelo publicado/ })
    .selectOption(String(template.publishedVersionId));
  await dialog
    .getByRole("checkbox", { name: "Inventário físico", exact: true })
    .check();
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("SINTETICO geracao de documento a partir do projeto");
  await dialog.getByRole("checkbox", { name: /Confirmo o modelo/ }).check();
  await dialog.getByRole("button", { name: "Gerar rascunho do laudo" }).click();
  await page.waitForURL(/technical-reports\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split("/").at(-1));
  await page
    .getByRole("textbox", { name: "Seção: Objetivo e escopo", exact: true })
    .fill("SINTETICO escopo editado no laudo, com limitacoes documentais");
  await page
    .getByLabel("Conclusão técnica", { exact: true })
    .fill(
      "SINTETICO conclusao baseada apenas nas fontes extraidas, sem afirmacao normativa",
    );
  await page
    .getByRole("checkbox", { name: new RegExp(profile.data.display_name) })
    .check();
  await page
    .getByLabel("Justificativa", { exact: true })
    .fill("SINTETICO preenchimento e revisao inicial do laudo");
  await page.getByRole("button", { name: "Salvar rascunho do laudo" }).click();
  await expect(page.getByText(/Revisão atual 2/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", {
      name: "Seção: Objetivo e escopo",
      exact: true,
    }),
  ).toHaveValue(
    "SINTETICO escopo editado no laudo, com limitacoes documentais",
  );
  await page
    .getByRole("button", { name: "Validação prévia", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sem bloqueios na validação atual" }),
  ).toBeVisible();
  const transition = async (button: string, reason: string) => {
    await page.getByRole("button", { name: button, exact: true }).click();
    await dialog.getByLabel("Justificativa", { exact: true }).fill(reason);
    await dialog
      .getByRole("checkbox", {
        name: "Confirmo a operação e as limitações documentais",
      })
      .check();
    await dialog
      .getByRole("button", { name: "Confirmar operação", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  };
  await transition(
    "Preparar para revisão",
    "SINTETICO preparacao da revisao documental",
  );
  await expect(
    page.getByRole("button", { name: "Aprovar laudo", exact: true }),
  ).toBeVisible();
  await transition(
    "Aprovar laudo",
    "SINTETICO aprovacao interna de homologacao",
  );
  await expect(
    page.getByRole("heading", { name: "Histórico imutável de revisões" }),
  ).toBeVisible();
  const current = await api("get", base + "/" + id),
    approved = await api(
      "get",
      `${base}/${id}/versions/${current.approvedVersionId}`,
    );
  expect(approved.status).toBe("approved");
  expect(approved.data.template.version_id).toBe(template.publishedVersionId);
  await page
    .getByRole("button", { name: "Versão aprovada preservada", exact: true })
    .click();
  await expect(page.locator(".technical-report-document h1")).toHaveText(name);
  await expect(
    page
      .locator(".technical-report-document")
      .getByText("SINTETICO Equipamento original " + stamp, { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar snapshot aprovado", exact: true })
    .click();
  await (await download).saveAs(info.outputPath("laudo-aprovado.json"));
  await page.screenshot({
    path: info.outputPath("previa-aprovada.png"),
    fullPage: true,
  });
  await api("patch", `/projects/${project}/inventory-items/${item}`, {
    description: "SINTETICO Equipamento atualizado " + stamp,
  });
  await page.reload();
  await expect(
    page.getByText(/Novas fontes disponíveis no projeto/),
  ).toBeVisible();
  await expect(
    page
      .locator(".technical-report-document")
      .getByText("SINTETICO Equipamento original " + stamp, { exact: true }),
  ).toBeVisible();
  await transition(
    "Reabrir laudo",
    "SINTETICO nova revisao apos mudanca das fontes",
  );
  await page.getByRole("button", { name: "Conteúdo", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Seção: Objetivo e escopo", exact: true })
    .fill("SINTETICO nova revisao sem sobrescrever a versao aprovada");
  await page
    .getByLabel("Justificativa", { exact: true })
    .fill("SINTETICO ajuste apos reabertura");
  await page.getByRole("button", { name: "Salvar rascunho do laudo" }).click();
  await expect(page.getByText(/Revisão atual 6/)).toBeVisible();
  await transition(
    "Atualizar fontes explicitamente",
    "SINTETICO atualizacao controlada das fontes",
  );
  const final = await api("get", base + "/" + id),
    preserved = await api(
      "get",
      `${base}/${id}/versions/${current.approvedVersionId}`,
    );
  expect(preserved.hash).toBe(approved.hash);
  expect(
    final.data.sources.tables.find(
      (t: { family: string }) => t.family === "inventory",
    ).rows[0],
  ).toContain("SINTETICO Equipamento atualizado " + stamp);
  await page
    .getByRole("button", { name: "Versão aprovada preservada", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".technical-report-document h1")).toHaveText(name);
  await page.screenshot({
    path: info.outputPath("previa-mobile.png"),
    fullPage: true,
  });
  await nav
    .getByRole("link", { name: "Laudos do projeto", exact: true })
    .click();
  await page.goBack();
  await expect(page.locator(".technical-report-document h1")).toHaveText(name);
  await page.goForward();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Itens", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${project}/inventory-items`),
  );
  await page.getByRole("link", { name: "Laudos", exact: true }).click();
  await expect(page).toHaveURL(root);
  expect(errors).toEqual([]);
  expect(http).toEqual([]);
  const evidence = {
    project,
    company,
    item,
    template: template.id,
    template_version: template.publishedVersionId,
    report: id,
    approved_version: current.approvedVersionId,
    approved_hash: approved.hash,
    final_revision: final.revision,
    final_status: final.status,
    errors,
    http,
  };
  await writeFile(
    info.outputPath("evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  await info.attach("synthetic-evidence", {
    body: JSON.stringify(evidence),
    contentType: "application/json",
  });
});
