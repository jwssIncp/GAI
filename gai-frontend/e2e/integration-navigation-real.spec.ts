import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { templateFixture } from '../../gai-backend/test/unit/modules/technical-reports/report.fixtures';
import { testBudget, testPricing } from '../../gai-backend/test/unit/modules/budgets/budget.fixtures';

test.skip(process.env.GAI_TEST_MYSQL_WAVE2 !== '1', 'Requires isolated Wave 2 API/MySQL');
let fixture: { project: number; secondary: number; budget: number; receivable: number; foreign: number; name: string; description: string; contractNumber: string; reportTitle: string };
test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/v1/auth/login', { data: { identifier: 'org.admin', password: 'Admin@123456' } });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: 'Bearer ' + (await login.json()).access_token };
  const post = async (route: string, data: object) => {
    const r = await request.post('/api/v1' + route, { data, headers });
    expect(r.ok(), await r.text()).toBe(true); return r.json();
  };
  const stamp = Date.now(), name = 'SINTETICO Navegação Onda2 ' + stamp;
  const p = (await post('/projects', { organization_id: 1, company_id: 1, name })).id;
  const secondary = (await post('/projects', { organization_id: 1, company_id: 1, name: name + ' outro' })).id;
  const contractNumber = 'SYN-NAV-CONTRACT-' + stamp;
  await post('/projects/' + p + '/contracts', { number: contractNumber, company_id: 1, currency: 'BRL', services: ['Inventário sintético'], status: 'active', original_value: '10.01', contracted_on: '2026-10-29', starts_on: '2026-10-29', ends_on: '2027-10-29' });
  const cmd = () => ({ command_key: crypto.randomUUID(), reason: 'SINTETICO laudo vinculado explicitamente' });
  const reportTitle = 'SINTETICO Laudo navegação ' + stamp;
  const reportBase = '/projects/' + p + '/technical-reports';
  let template = await post(reportBase + '/templates', { ...cmd(), data: templateFixture() });
  template = await post(reportBase + '/templates/' + template.id + '/publish', { ...cmd(), revision: template.revision });
  await post(reportBase, { ...cmd(), template_version_id: template.publishedVersionId, title: reportTitle, selection: { families: ['identity'] } });
  const pricing = await post('/budgets/pricing', testPricing({ name: 'SYN-NAV-PRICING-' + stamp }));
  const budget = await post('/budgets', testBudget({ project_id: p, pricing_id: pricing.id, number: 'SYN-NAV-' + stamp }));
  const description = 'SINTETICO Recebível navegação ' + stamp;
  const data = { organization_id: 1, company_id: 1, project_id: p, origin: 'manual', description, amount: '10.01', currency: 'BRL', issued_on: '2026-10-29', reason: 'SINTETICO recebível manual vinculado explicitamente', payment: { mode: 'equal', count: 1, first_due_on: '2026-11-30' } };
  const preview = await post('/finance/receivables/preview', data);
  const receivable = await post('/finance/receivables', { ...data, preview_hash: preview.preview_hash, command_key: crypto.randomUUID() });
  const seeded = JSON.parse(readFileSync(path.join(process.env.GAI_TEST_EVIDENCE_DIR!, 'navigation-fixture.json'), 'utf8'));
  fixture = { project: p, secondary, budget: budget.id, receivable: receivable.id, foreign: seeded.foreignProject, name, description, contractNumber, reportTitle };
});

for (const width of [1440, 390]) for (const reader of [false, true]) {
  test(`${reader ? 'restricted reader' : 'ORG_ADMIN'} preserves context, history and tenant boundaries at ${width}px`, async ({ page }, info) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Login ou email').fill(reader ? 'test.user' : 'org.admin');
    await page.getByLabel('Senha', { exact: true }).fill(reader ? 'Test@123456' : 'Admin@123456');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/app/dashboard');
    const query = new URLSearchParams({ search: fixture.name });
    if (reader) {
      await page.getByRole('link', { name: 'Abrir projetos', exact: true }).click();
      await page.getByPlaceholder('Buscar projeto', { exact: true }).fill(fixture.name);
      await page.getByRole('link', { name: fixture.name, exact: true }).click();
    } else {
      await page.goto('/app/dashboard?' + query);
      await page.getByRole('link', { name: fixture.name, exact: true }).click();
    }
    await expect(page).toHaveURL(new RegExp(`/projects/${fixture.project}/summary\\?return_to=`));
    await page.goto(page.url().replace('/summary?', '?'));
    await expect(page).toHaveURL(new RegExp(`/projects/${fixture.project}/summary\\?return_to=`));
    await page.reload();
    await expect(page.getByRole('link', { name: 'Retornar ao dashboard da organização' })).toBeVisible();
    const projectNav = () => page.getByRole('navigation', { name: 'Abas do projeto' });
    const tab = (label: string) => projectNav().getByRole('link', { name: label, exact: true }).click();
    for (const label of ['Contratos', 'Laudos']) {
      await tab(label);
      if (label === 'Contratos') await page.getByRole('button', { name: fixture.contractNumber, exact: true }).click();
      else await page.getByRole('link', { name: fixture.reportTitle, exact: true }).click();
      await page.reload(); await expect(projectNav()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Retornar ao dashboard da organização' })).toBeVisible();
      if (label === 'Contratos' && reader) await expect(page.getByRole('button', { name: 'Novo contrato', exact: true })).toHaveCount(0);
      await tab('Visão geral');
    }
    await tab('Itens');
    // Assessments are an existing panel of inventory items, not a separate route.
    await expect(page.getByText('Avaliação patrimonial em lote', { exact: true })).toBeVisible();
    await tab('Visão geral');
    await tab('Orçamentos');
    await expect(page.getByRole('navigation', { name: 'Contexto do projeto' })).toContainText(fixture.name);
    await page.getByRole('navigation', { name: 'Navegação de orçamentos' }).getByRole('link', { name: 'Parâmetros de preços' }).click();
    await expect(page).toHaveURL(new RegExp(`pricing\\?project_id=${fixture.project}`));
    await page.reload();
    await page.getByRole('navigation', { name: 'Navegação de orçamentos' }).getByRole('link', { name: 'Orçamentos', exact: true }).click();
    await page.getByRole('link', { name: /^SYN-NAV-/ }).click();
    await expect(page).toHaveURL(new RegExp(`/budgets/${fixture.budget}\\?project_id=${fixture.project}`));
    await page.getByRole('link', { name: 'Histórico', exact: true }).click();
    await page.reload(); await expect(page).toHaveURL(new RegExp(`project_id=${fixture.project}.*tab=history`));
    await page.goBack(); await page.goForward();
    await page.getByRole('link', { name: 'Voltar aos orçamentos', exact: true }).click();
    await expect(page.getByLabel('Projeto (ID)', { exact: true })).toHaveValue(String(fixture.project));
    await page.getByRole('link', { name: 'Retornar ao projeto', exact: true }).click();
    await tab('Recebíveis');
    await page.getByRole('link', { name: fixture.description, exact: true }).click();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/receivables/${fixture.receivable}\\?project_id=${fixture.project}`));
    await page.getByRole('button', { name: 'Histórico', exact: true }).click();
    const cashLoaded = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/finance/cash-flow' && response.request().method() === 'GET');
    await page.getByRole('navigation', { name: 'Navegação financeira' }).getByRole('link', { name: 'Fluxo de caixa', exact: true }).click();
    expect((await cashLoaded).status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`cash-flow\\?project_id=${fixture.project}`));
    const dreLoaded = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/finance/dre/report' && response.request().method() === 'GET');
    await page.getByRole('navigation', { name: 'Navegação financeira' }).getByRole('link', { name: 'DRE Gerencial', exact: true }).click();
    expect((await dreLoaded).status()).toBe(200);
    await page.getByRole('link', { name: 'Classificações e ajustes', exact: true }).click();
    await page.reload();
    await page.getByRole('link', { name: 'Retornar ao projeto', exact: true }).click();
    await tab('Coordenação de Campo'); await tab('Inventário'); await tab('Visão geral');
    await tab('Preparação'); await tab('Laudos'); await tab('Visão geral');
    await page.getByRole('link', { name: 'Retornar ao dashboard da organização' }).click();
    await expect(page).toHaveURL(reader ? '/app/dashboard' : '/app/dashboard?' + query);
    // Direct URLs select a different project without a localStorage fallback.
    await page.goto(`/app/budgets?project_id=${fixture.secondary}`);
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Contexto do projeto' })).toContainText(fixture.name + ' outro');
    await expect(page.getByRole('link', { name: /^SYN-NAV-/ })).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gai.session.v1')!));
    const headers = { Authorization: 'Bearer ' + stored.accessToken };
    const foreignProject = await page.request.get(`/api/v1/projects/${fixture.foreign}`, { headers });
    expect(foreignProject.status()).toBe(403);
    expect(await foreignProject.text()).not.toContain('PROJETO EXTERNO SIGILOSO');
    const foreignBudgets = await page.request.get(`/api/v1/budgets?project_id=${fixture.foreign}`, { headers });
    expect(foreignBudgets.status()).toBe(200);
    expect(await foreignBudgets.json()).toMatchObject({ total: 0, items: [] });
    const foreignReceivables = await page.request.get(`/api/v1/finance/receivables?project_id=${fixture.foreign}`, { headers });
    expect(foreignReceivables.status()).toBe(400);
    expect(await foreignReceivables.text()).not.toContain('PROJETO EXTERNO SIGILOSO');
    if (reader) {
      const denied = await page.request.post(`/api/v1/projects/${fixture.project}/technical-reports`, { headers, data: {} });
      expect(denied.status()).toBe(403);
      await page.goto(`/app/finance/receivables/${fixture.receivable}?project_id=${fixture.project}`);
      await expect(page.getByRole('heading', { name: fixture.description, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Registrar recebimento', exact: true })).toHaveCount(0);
      const write = await page.request.post(`/api/v1/finance/receivables/${fixture.receivable}/receipts`, { headers, data: {} });
      expect(write.status()).toBe(403);
    }
    await page.goto(`/app/budgets?project_id=${fixture.foreign}&return_to=${encodeURIComponent('//outside.example')}`);
    await expect(page.getByRole('link', { name: 'Retornar ao projeto', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Contexto do projeto' })).toHaveCount(0);
    await expect(page.locator('a[href^="//outside"]')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('context-security.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
}
