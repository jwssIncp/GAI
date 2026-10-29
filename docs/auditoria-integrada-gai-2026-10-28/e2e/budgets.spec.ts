import { test, expect as baseExpect } from "../../../gai-frontend/node_modules/@playwright/test/index.mjs";
const expect = baseExpect.configure({ timeout: 15000 });
test.skip(
  process.env.GAI_BUDGETS_REAL !== "1",
  "Requires the local development stack and synthetic data",
);
test.use({ baseURL: "http://127.0.0.1:33320" });
test("ORG_ADMIN publishes explicit prices, builds a standalone budget, compares scenarios and approves an immutable proposal", async ({
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
    number = "SINTETICO-ORC-" + stamp,
    name = "SINTETICO PRECOS " + stamp;
  const company = (
    await post("/companies", {
      organization_id: 1,
      name: "SINTETICO Empresa orçamento " + stamp,
    })
  ).id;
  const unit = (
    await post(`/companies/${company}/units`, {
      name: "SINTETICO Unidade orçamento " + stamp,
      address: "Rua sintética, 100",
      state: "SP",
      city: "Cidade sintética",
    })
  ).id;
  await page.goto("/app/budgets");
  const nav = page.getByRole("navigation", { name: "Navegação de orçamentos" });
  await nav.getByRole("link", { name: "Parâmetros de preços" }).click();
  await page.getByRole("button", { name: "Publicar parâmetros" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do conjunto").fill(name);
  await dialog.getByLabel("Início da vigência").fill("2026-01-01");
  await dialog.getByLabel("Fim da vigência").fill("2029-12-31");
  const fields: Record<string, string> = {
    "Produtividade diária por profissional": "100",
    "Dias disponíveis": "5",
    "Equipe mínima configurada": "1",
    "Endereços por profissional-dia": "2",
    "Pessoas por quarto": "2",
    "Intervalo para dias extras": "5",
    "Dias extras por intervalo": "2",
    "Diária técnica": "100.10",
    "Despesas operacionais fixas": "10.20",
    "Deslocamento fixo": "0.00",
    "Transporte por dia": "2.00",
    "Hospedagem por quarto-dia": "20.00",
    "Alimentação por pessoa-dia": "5.00",
    Materiais: "1.10",
    "Plaqueta por bem": "0.10",
    "Custo administrativo": "3.30",
    "Preço mínimo": "0.00",
    "Impostos (%)": "10.00",
    "Comissão (%)": "5.00",
    "Margem alvo (%)": "15.00",
    "Fator de esforço por endereço": "1.0000",
  };
  for (const [label, value] of Object.entries(fields))
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog
    .getByLabel("Justificativa e referência de aprovação comercial")
    .fill("Aprovação exclusivamente sintética para homologação local");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Confirmar publicação" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(name + " · v1", { exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Orçamentos", exact: true }).click();
  await page.getByRole("button", { name: "Novo orçamento" }).click();
  await dialog
    .getByLabel("Empresa", { exact: true })
    .selectOption(String(company));
  await dialog.getByLabel("Número do orçamento").fill(number);
  await dialog.getByLabel("Data de elaboração").fill("2026-10-27");
  await dialog.getByLabel("Validade da proposta").fill("2029-12-31");
  await dialog
    .getByLabel("Segmento", { exact: true })
    .fill("Homologação sintética");
  await dialog
    .getByLabel("Serviços (separados por ponto e vírgula)")
    .fill("Inventário; Avaliação");
  await dialog.getByLabel("Quantidade estimada de bens").fill("1000");
  await dialog
    .getByLabel("Unidade", { exact: true })
    .selectOption(String(unit));
  await dialog
    .getByLabel("Endereços adicionais (um por linha)")
    .fill("Rua sintética adicional, 200");
  await dialog
    .getByLabel("Escopo", { exact: true })
    .fill("Escopo comercial exclusivamente sintético, sem prestação real.");
  await dialog
    .getByLabel("Restrições operacionais")
    .fill("Jornada sintética acordada.");
  const pricingOption = dialog
    .getByLabel("Parâmetros de preços", { exact: true })
    .getByRole("option", { name: new RegExp(name) });
  await expect(pricingOption).toHaveCount(1);
  await dialog
    .getByLabel("Parâmetros de preços", { exact: true })
    .selectOption((await pricingOption.getAttribute("value"))!);
  await dialog.getByLabel("Entrada (%)", { exact: true }).fill("10.00");
  await dialog.getByLabel("Data da entrada").fill("2026-10-27");
  await dialog.getByLabel("Quantidade de parcelas (sem entrada)").fill("3");
  await dialog.getByLabel("Primeiro vencimento").fill("2027-01-31");
  await dialog.getByRole("button", { name: "Calcular prévia" }).click();
  await expect(
    dialog.getByText("R$ 1.913,72", { exact: true }).first(),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar orçamento" }).click();
  await page.waitForURL(/\/app\/budgets\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split("/").at(-1));
  await expect(
    page.getByRole("heading", { name: "Orçamento " + number, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Novo cenário", exact: true }).click();
  await dialog.getByLabel("Equipe ajustada", { exact: true }).fill("3");
  await dialog.getByLabel("Margem ajustada (%)").fill("20.00");
  await dialog.getByLabel("Acréscimo operacional").fill("1.11");
  await dialog
    .getByLabel("Justificativa dos ajustes")
    .fill("Equipe ampliada e premissas sintéticas autorizadas");
  await dialog.getByLabel("Nome da versão ou cenário").fill("Equipe ampliada");
  await dialog
    .getByLabel("Justificativa da versão")
    .fill("Comparar prazo, equipe, despesas e margem");
  await dialog.getByRole("button", { name: "Salvar cenário" }).click();
  await expect(dialog).not.toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Abas do orçamento" });
  await tabs.getByRole("link", { name: "Comparar cenários" }).click();
  await page
    .getByRole("button", { name: "v2 · Equipe ampliada", exact: true })
    .click();
  await expect(
    page.getByText("R$ 2.376,79", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enviar versão selecionada para revisão" })
    .click();
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("Cenário selecionado para revisão comercial");
  await dialog.getByRole("button", { name: "Confirmar alteração" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Aprovar versão em revisão" }).click();
  await dialog
    .getByLabel("Justificativa", { exact: true })
    .fill("Aprovação comercial sintética da versão escolhida");
  await dialog.getByRole("button", { name: "Confirmar alteração" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Aprovado · revisão 4", { exact: true }),
  ).toBeVisible();
  await tabs
    .getByRole("link", { name: "Prévia comercial", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Prévia comercial · " + number }),
  ).toBeVisible();
  await expect(
    page.getByText("R$ 2.376,79", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preparar dados para futuro contrato" })
    .click();
  await expect(
    page.getByText(/Dados preparados sem criar contrato/),
  ).toBeVisible();
  const before = await page.request.get(`/api/v1/budgets/${id}/proposal`, {
    headers,
  });
  const approvedBefore = await before.json();
  await page.getByRole("button", { name: "Novo cenário", exact: true }).click();
  await dialog.getByLabel("Margem ajustada (%)").fill("25.00");
  await dialog
    .getByLabel("Nome da versão ou cenário")
    .fill("Cenário após aprovação");
  await dialog
    .getByLabel("Justificativa da versão")
    .fill("Comparação sem alterar a proposta aprovada");
  await dialog.getByRole("button", { name: "Salvar cenário" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByText("R$ 2.376,79", { exact: true }).first(),
  ).toBeVisible();
  const approvedAfter = await (
    await page.request.get(`/api/v1/budgets/${id}/proposal`, { headers })
  ).json();
  expect(approvedAfter).toEqual(approvedBefore);
  await tabs.getByRole("link", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "v3 · Cenário após aprovação",
      exact: true,
    }),
  ).toBeVisible();
  await tabs.getByRole("link", { name: "Pagamento", exact: true }).click();
  await expect(page.getByText("28/02/2027", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Histórico de versões", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.getByText("28/02/2027", { exact: true })).toBeVisible();
  await tabs
    .getByRole("link", { name: "Memória de cálculo", exact: true })
    .click();
  await page
    .getByText("Fórmulas e parâmetros utilizados", { exact: true })
    .click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("budget-memory-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await tabs
    .getByRole("link", { name: "Prévia comercial", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Prévia comercial · " + number }),
  ).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("budget-proposal-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Voltar aos orçamentos", exact: true })
    .click();
  await page.getByLabel("Buscar número").fill(number);
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Buscar número")).toHaveValue(number);
  await expect(
    page.getByRole("link", { name: number, exact: true }),
  ).toBeVisible();
  const result = await (
    await page.request.get(`/api/v1/budgets/${id}`, { headers })
  ).json();
  expect(result.versions).toHaveLength(3);
  expect(result.projectId).toBeNull();
  expect(result.approvedVersionId).toBe(
    approvedBefore.version === 2
      ? result.versions.find((v: { version: number }) => v.version === 2).id
      : null,
  );
  // Explicit synthetic setup of a second project-linked budget validates the
  // existing project navigation; the budget module itself creates no project.
  const project = (
    await post("/projects", {
      organization_id: 1,
      company_id: company,
      name: "SINTETICO Projeto orçamento " + stamp,
    })
  ).id;
  const originalInput = result.versions.find(
    (v: { version: number }) => v.version === 1,
  ).snapshot.input;
  const linked = (
    await post("/budgets", {
      ...originalInput,
      number: number + "-PROJETO",
      project_id: project,
    })
  ).id;
  await page.goto(`/app/projects/${project}/summary`);
  const projectNav = page.getByRole("navigation", { name: "Abas do projeto" });
  await projectNav
    .getByRole("link", { name: "Orçamentos", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/app/budgets\\?project_id=${project}$`),
  );
  await page
    .getByRole("link", { name: number + "-PROJETO", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/budgets/${linked}$`));
  await page
    .getByRole("link", { name: "Consultar projeto", exact: true })
    .click();
  await expect(page.locator("[data-project-id]")).toHaveAttribute(
    "data-project-id",
    String(project),
  );
  await projectNav
    .getByRole("link", { name: "Orçamentos", exact: true })
    .click();
  await page
    .getByRole("link", { name: number + "-PROJETO", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Consultar contratos do projeto", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/app/projects/${project}/contracts$`),
  );
  await expect(
    page.getByRole("heading", { name: "Contratos", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(http).toEqual([]);
  await info.attach("synthetic-budget", {
    body: JSON.stringify({
      budget_id: id,
      linked_budget_id: linked,
      linked_project_id: project,
      company_id: company,
      unit_id: unit,
      number,
      parameter_name: name,
      versions: 3,
      approved_price: approvedAfter.final_price,
      http_errors: http,
      page_errors: errors,
    }),
    contentType: "application/json",
  });
});
