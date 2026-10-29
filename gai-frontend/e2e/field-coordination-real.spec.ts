import { test, expect } from "@playwright/test";
test.skip(
  process.env.GAI_FIELD_REAL !== "1",
  "Requires local stack and synthetic data only",
);
test.use({ baseURL: process.env.GAI_E2E_BASE_URL ?? "http://localhost:5173" });
test("ORG_ADMIN creates a versioned field model, assigns and approves a task, completes/reopens field and retains workspace navigation", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [],
    http: Array<{ url: string; status: number }> = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400)
      http.push({ url: response.url(), status: response.status() });
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
  const stamp = Date.now();
  const created = await page.request.post(
    "/api/v1/projects",
    {
      headers,
      data: {
        organization_id: 1,
        company_id: 1,
        name: "SINTETICO Campo " + stamp,
      },
    },
  );
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: number };
  const root = `/app/projects/${project.id}/`;
  await page.goto(root + "summary");
  const nav = page.getByRole("navigation", { name: "Abas do projeto" });
  await nav
    .getByRole("link", { name: "Coordenação de Campo", exact: true })
    .click();
  await expect(page).toHaveURL(/field-coordination$/);
  await page
    .getByRole("button", { name: "Modelos de campo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Novo modelo de campo", exact: true })
    .click();
  const name = "SINTETICO Modelo Campo " + stamp;
  await page.getByLabel("Nome do modelo", { exact: true }).fill(name);
  await page
    .getByLabel("Nome da etapa 1", { exact: true })
    .fill("Conferência de campo");
  await page
    .getByRole("button", { name: "Adicionar tarefa à etapa 1", exact: true })
    .click();
  await page
    .getByLabel("Nome da tarefa", { exact: true })
    .fill("SINTETICO Verificação técnica");
  for (const label of [
    "Exigir responsável",
    "Exigir prazo",
    "Exigir observações na conclusão",
    "Exigir aprovação da coordenação",
  ])
    await page.getByRole("checkbox", { name: label, exact: true }).check();
  await page
    .getByRole("button", { name: "Aplicar tarefa ao modelo", exact: true })
    .click();
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/field-templates") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Salvar modelo", exact: true })
    .click();
  expect((await saved).status()).toBe(201);
  await expect(
    page.getByLabel("Modelo de campo", { exact: true }),
  ).toContainText(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar checklist de campo", exact: true })
    .click();
  await page
    .getByLabel("Modelo", { exact: true })
    .selectOption({ label: name + " · v1" });
  await page
    .getByLabel("Título do checklist", { exact: true })
    .fill("SINTETICO Checklist Campo " + stamp);
  const checklistResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/field-coordination") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Criar checklist", exact: true })
    .click();
  const checklistRes = await checklistResponse;
  expect(checklistRes.status()).toBe(201);
  const checklist = (await checklistRes.json()) as { id: number };
  await page
    .getByRole("button", { name: "Validar conclusão de campo", exact: true })
    .click();
  await expect(
    page.getByText(/Tarefa obrigatória não resolvida/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar conclusão", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir tarefa", exact: true }).click();
  await page
    .getByLabel("Estado da tarefa", { exact: true })
    .selectOption("completed");
  await page
    .getByLabel("Responsável pela tarefa", { exact: true })
    .selectOption({ label: "org.admin" });
  await page.getByLabel("Prazo da tarefa", { exact: true }).fill("2026-11-01");
  await page
    .getByLabel("Observações da tarefa", { exact: true })
    .fill("Conferência sintética persistida");
  const taskResponse = page.waitForResponse(
    (r) =>
      r.url().includes(`/field-coordination/${checklist.id}/tasks/`) &&
      r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Salvar tarefa", exact: true })
    .click();
  expect((await taskResponse).status()).toBe(200);
  await page.reload();
  await expect(
    page.getByText("SINTETICO Verificação técnica", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir tarefa", exact: true }).click();
  await expect(
    page.getByLabel("Observações da tarefa", { exact: true }),
  ).toHaveValue("Conferência sintética persistida");
  const approved = page.waitForResponse(
    (r) => r.url().endsWith("/approve") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Aprovar tarefa", exact: true })
    .click();
  expect((await approved).status()).toBe(201);
  await page
    .getByRole("button", { name: "Validar conclusão de campo", exact: true })
    .click();
  await expect(
    page.getByText("Sem impedimentos de tarefas obrigatórias."),
  ).toBeVisible();
  const finished = page.waitForResponse((r) => r.url().endsWith("/transition"));
  await page
    .getByRole("button", { name: "Confirmar conclusão", exact: true })
    .click();
  expect((await finished).status()).toBe(201);
  await page
    .getByRole("button", { name: "Reabrir campo", exact: true })
    .click();
  await page
    .getByLabel("Motivo da ação", { exact: true })
    .fill("Nova rodada de conferência sintética");
  const reopened = page.waitForResponse((r) => r.url().endsWith("/transition"));
  await page
    .getByRole("button", { name: "Confirmar reabertura", exact: true })
    .click();
  expect((await reopened).status()).toBe(201);
  await page
    .getByRole("button", { name: "Prévia de mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copiar prévia revisada" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
  await expect(
    page.getByLabel("Mensagem para revisão", { exact: true }),
  ).toContainText("Nenhuma mensagem foi enviada.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Histórico de campo", exact: true })
    .click();
  await expect(
    page.getByText("Campo concluído", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Campo reaberto", { exact: true })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await nav.getByRole("link", { name: "Itens", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(root + "inventory-items$"));
  await nav
    .getByRole("link", { name: "Coordenação de Campo", exact: true })
    .click();
  await expect(
    page.getByText("SINTETICO Verificação técnica", { exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(nav.getByRole('link',{name:'Coordenação de Campo',exact:true})).toHaveAttribute('aria-current','page');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({
    path: info.outputPath("field-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    nav.getByRole("link", { name: "Coordenação de Campo", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText("SINTETICO Verificação técnica", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("field-mobile.png"),
    fullPage: false,
  });
  const actual = await page.request.get(
    `/api/v1/projects/${project.id}/field-coordination/${checklist.id}/tasks`,
    { headers },
  );
  expect(actual.status()).toBe(200);
  const tasks = (await actual.json()) as {
    items: { notes: string; approvedById: number }[];
  };
  expect(tasks.items[0].notes).toBe("Conferência sintética persistida");
  expect(tasks.items[0].approvedById).toBeTruthy();
  expect(errors).toEqual([]);
  expect(http).toEqual([]);
  await info.attach("field-fixture", {
    body: JSON.stringify({
      projectId: project.id,
      checklistId: checklist.id,
      url: (process.env.GAI_E2E_BASE_URL ?? "http://localhost:5173") + root + "field-coordination",
      errors,
      http,
    }),
    contentType: "application/json",
  });
});
