import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const before = process.env.GAI_VISUAL_STAGE === 'before';
const output = process.env.GAI_TEST_EVIDENCE_DIR!;
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Login ou email').fill('org.admin');
  await page.getByLabel('Senha', { exact: true }).fill('Admin@123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/app/dashboard');
  await expect(page.getByRole('heading', { name: /Visão geral|Visão Geral/ }).first()).toBeVisible();
}
async function shot(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[role="status"]').filter({ hasText: /Carregando|Sincronizando/ })).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: !/modal-|navigation-|theme-menu/.test(name), animations: 'disabled' });
}

for (const width of [1366, 390]) for (const theme of ['light', 'dark']) {
  test(`visual ${before ? 'before' : 'after'} ${theme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(value => localStorage.setItem('gai.theme', value), theme);
    await page.goto('/login');
    await shot(page, `login-${theme}-${width}`);
    await login(page);
    await shot(page, `dashboard-${theme}-${width}`);
    await page.goto('/app/projects');
    await expect(page.getByRole('heading', { name: 'Projetos', exact: true })).toBeVisible();
    await shot(page, `projects-${theme}-${width}`);
    await page.getByRole('button', { name: 'Novo projeto', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, `modal-${theme}-${width}`);
    await page.keyboard.press('Escape');
    if (width < 1024) {
      await page.getByRole('button', { name: 'Abrir navegação' }).click();
      await expect(page.getByRole('dialog', { name: 'Navegação principal' })).toBeVisible();
      await shot(page, `navigation-${theme}-${width}`);
    }
  });
}

test('runtime evidence directory', async () => {
  fs.writeFileSync(path.join(output, 'stage.json'), JSON.stringify({ stage: before ? 'before' : 'after', api: 'real NestJS', database: 'gai_navigation_disposable', persistentDatabase: false }));
});

test.describe('redesign behaviour', () => {
  test.skip(before, 'Only the untouched baseline is captured before implementation');
  let primary: number;
  let token: string;
  test.beforeAll(async ({ request }) => {
    const fixture = JSON.parse(fs.readFileSync(path.join(output, 'navigation-fixture.json'), 'utf8'));
    primary = fixture.primary;
    const response = await request.post('/api/v1/auth/login', { data: { identifier: 'org.admin', password: 'Admin@123456' } });
    expect(response.ok()).toBe(true);
    token = (await response.json()).access_token;
    const asset = await request.post('/api/v1/projects/' + primary + '/inventory-items', {
      headers: { Authorization: 'Bearer ' + token }, data: { description: 'SINTETICO UI — estação de trabalho', unit_text: 'Unidade sintética', status: 'pending' },
    });
    expect(asset.ok(), await asset.text()).toBe(true);
  });
  for (const width of [360, 390, 768, 1024, 1366, 1920]) for (const theme of ['light', 'dark']) {
    test(`responsive modules ${theme} ${width}`, async ({ page }, info) => {
      test.setTimeout(240000);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('gai.theme', value), theme);
      const errors: string[] = [], responses: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.url().includes('/api/v1/') && r.status() >= 400) responses.push(`${r.status()} ${r.url()}`); });
      await login(page);
      const root = `/app/projects/${primary}/`;
      const routes = width === 360 || width === 1366 ? [
        '/app/projects', root + 'summary', root + 'dashboard', root + 'inventory-items', root + 'inventory/sessions',
        root + 'accounting-items', root + 'preparation/kickoff', root + 'field-coordination', root + 'contracts',
        '/app/budgets?project_id=' + primary, root + 'finance', root + 'technical-reports',
        '/app/finance/receivables?project_id=' + primary, '/app/finance/cash-flow?project_id=' + primary,
        '/app/finance/dre?project_id=' + primary, '/app/users', '/app/roles', '/app/companies',
      ] : ['/app/projects', root + 'dashboard', '/app/finance/receivables?project_id=' + primary];
      const observations = [];
      for (const [index, route] of routes.entries()) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('main').first()).toBeVisible();
        const observation = await page.evaluate(() => ({
          url: location.pathname + location.search,
          viewport: innerWidth, document: document.documentElement.scrollWidth,
          controls: Array.from(document.querySelectorAll<HTMLElement>('button,a,input,select,textarea,[role="button"]')).filter(el => el.getClientRects().length && !el.closest('[aria-hidden="true"]')).map(el => ({ tag: el.tagName, label: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 120), href: el.getAttribute('href'), disabled: el.hasAttribute('disabled') })),
        }));
        expect(observation.document, route + ' horizontal overflow').toBeLessThanOrEqual(width + 1);
        observations.push(observation);
        if (width === 360 || width === 1366 || index === 0) await shot(page, `module-${index}-${theme}-${width}`);
      }
      if (width < 1024) {
        const trigger = page.getByRole('button', { name: 'Abrir navegação' });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: 'Navegação principal' });
        await expect(dialog).toBeVisible();
        for (let i = 0; i < 15; i++) {
          await page.keyboard.press('Tab');
          expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
        }
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
      } else {
        await page.getByRole('button', { name: 'Recolher menu lateral' }).click();
        await expect(page.getByRole('button', { name: 'Expandir menu lateral' })).toBeVisible();
        await shot(page, `collapsed-${theme}-${width}`);
        await page.reload();
        await expect(page.getByRole('button', { name: 'Expandir menu lateral' })).toBeVisible();
        await page.getByRole('button', { name: 'Expandir menu lateral' }).click();
      }
      fs.writeFileSync(path.join(output, `observed-${theme}-${width}.json`), JSON.stringify({ observations, errors, responses }, null, 2));
      expect(errors).toEqual([]);
      expect(responses).toEqual([]);
      await info.attach('observations', { body: JSON.stringify(observations), contentType: 'application/json' });
    });
  }

  test('theme persistence, system changes, portal menu, profile and keyboard skip link', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/login');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Ativar tema claro' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Tema do sistema' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await login(page);
    await page.getByRole('button', { name: 'Menu do usuário org.admin' }).click();
    await page.getByRole('menuitemradio', { name: 'Escuro', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Menu do usuário org.admin' }).click();
    await shot(page, 'theme-menu-dark');
    await page.getByRole('menuitem', { name: 'Perfil', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Dados do usuário' })).toContainText('org.admin');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    const reduced = await page.evaluate(() => getComputedStyle(document.querySelector('.premium-panel')!).transitionDuration);
    expect(parseFloat(reduced)).toBeLessThanOrEqual(0.01);
    await page.getByRole('button', { name: 'Ativar tema claro' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Menu do usuário org.admin' }).click();
    await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
    await page.waitForURL('**/login');
  });

  test('semantic contrast in both themes', async ({ page }) => {
    await page.goto('/login');
    const results = [];
    for (const dark of [false, true]) {
      const readings = await page.evaluate(isDark => {
        document.documentElement.classList.toggle('dark', isDark);
        const luminance = (color: string) => {
          const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        return [['foreground', 'background'], ['foreground', 'card'], ['popover-foreground', 'popover'], ['muted-foreground', 'card'], ['primary-text', 'background'], ['primary-text', 'primary-subtle'], ['primary-foreground', 'primary'], ['destructive-foreground', 'destructive'], ['success', 'success-subtle'], ['success-foreground', 'success'], ['info', 'info-subtle'], ['warning-text', 'warning-subtle'], ['warning-foreground', 'warning']].map(([text, background]) => {
          const node = document.createElement('span');
          node.style.color = `hsl(var(--${text}))`; node.style.backgroundColor = `hsl(var(--${background}))`;
          document.body.appendChild(node);
          const style = getComputedStyle(node), fg = style.color, bg = style.backgroundColor;
          const a = luminance(fg), b = luminance(bg); node.remove();
          return { theme: isDark ? 'dark' : 'light', text, background, fg, bg, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        });
      }, dark);
      results.push(...readings);
    }
    fs.writeFileSync(path.join(output, 'contrast.json'), JSON.stringify(results, null, 2));
    for (const reading of results) expect(reading.ratio, JSON.stringify(reading)).toBeGreaterThanOrEqual(4.5);
    await login(page);
    const tooltips = [];
    for (const theme of ['light', 'dark']) {
      await page.goto(`/app/projects/${primary}/dashboard`);
      const activeDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
      if (activeDark !== (theme === 'dark')) await page.getByRole('button', { name: theme === 'dark' ? 'Ativar tema escuro' : 'Ativar tema claro' }).click();
      const sector = page.locator('.recharts-pie-sector path').first();
      const bounds = await sector.boundingBox();
      await sector.hover({ position: { x: bounds!.width / 2, y: 10 } });
      const tooltip = page.locator('.recharts-default-tooltip:visible').first();
      await expect(tooltip).toBeVisible();
      const colors = await tooltip.evaluate(el => ({ foreground: getComputedStyle(el).color, item: getComputedStyle(el.querySelector('.recharts-tooltip-item')!).color, background: getComputedStyle(el).backgroundColor }));
      expect(colors.item).toBe(colors.foreground);
      tooltips.push({ theme, ...colors });
      await tooltip.screenshot({ path: path.join(output, `chart-tooltip-${theme}.png`) });
    }
    fs.writeFileSync(path.join(output, 'tooltip-checks.json'), JSON.stringify(tooltips, null, 2));
  });

  test('real project creation, filters, pagination, ordering, confirmation and export', async ({ page, request }) => {
    test.setTimeout(180000);
    const prefix = 'SINTETICO UI paginação';
    // Twenty-one rows are the minimum to exercise the actual 20-row page size.
    for (let i = 0; i < 20; i++) {
      const response = await request.post('/api/v1/projects', { headers: { Authorization: 'Bearer ' + token }, data: { organization_id: 1, company_id: 1, name: `${prefix} ${String(i).padStart(2, '0')}` } });
      expect(response.ok()).toBe(true);
    }
    await login(page);
    await page.goto('/app/projects');
    await page.getByRole('button', { name: 'Novo projeto', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Novo projeto' });
    await drawer.getByRole('combobox').last().selectOption('1');
    await drawer.getByRole('button', { name: /Criar|Salvar/ }).click();
    await expect(drawer.getByText('Nome deve ter pelo menos 2 caracteres')).toBeVisible();
    await drawer.getByLabel('Nome', { exact: true }).fill(prefix + ' criado pela interface');
    await drawer.getByRole('combobox').last().selectOption('1');
    await drawer.getByRole('button', { name: /Criar|Salvar/ }).click();
    await expect(drawer).not.toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Projeto criado' })).toBeVisible();
    await page.getByPlaceholder('Buscar projeto', { exact: true }).fill(prefix);
    await expect(page.getByText(/Pagina 1 de 2/)).toBeVisible();
    await page.getByRole('button', { name: 'Proxima pagina' }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.reload();
    await expect(page.getByText(/Pagina 2 de 2/)).toBeVisible();
    await page.getByRole('button', { name: 'Pagina anterior' }).click();
    const cancel = page.getByRole('button', { name: 'Cancelar', exact: true }).first();
    await cancel.click();
    await expect(page.getByRole('dialog', { name: 'Cancelar', exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.goto('/app/dashboard?search=' + encodeURIComponent(prefix));
    await page.getByRole('button', { name: 'Projeto ↕', exact: true }).click();
    await expect(page.locator('th[aria-sort="ascending"]')).toHaveCount(1);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
    const file = await download;
    await file.saveAs(path.join(output, 'synthetic-dashboard.csv'));
    expect(fs.statSync(path.join(output, 'synthetic-dashboard.csv')).size).toBeGreaterThan(20);
  });

  test('invalid reset token is explained with the real API', async ({ page }) => {
    await page.goto('/reset-password?token=synthetic-invalid-token');
    await page.getByLabel('Nova senha').fill('Synthetic@123456');
    await page.getByRole('button', { name: 'Redefinir senha' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Redefinir senha' })).toBeEnabled();
    await shot(page, 'reset-error-real-api');
  });

  test('preparation context and project financial view survive refresh and history', async ({ page }) => {
    await login(page);
    const root = `/app/projects/${primary}/`;
    const context = '?return_to=' + encodeURIComponent('/app/dashboard?search=SINTETICO');
    await page.goto(root + 'preparation/kickoff' + context);
    await page.getByRole('link', { name: 'Checklist do Cliente', exact: true }).click();
    await expect(page).toHaveURL(root + 'preparation/client-checklist' + context);
    await page.reload();
    await page.getByRole('link', { name: 'Voltar ao projeto', exact: true }).click();
    await expect(page).toHaveURL(root + 'summary' + context);
    await page.getByRole('link', { name: 'Ir para o conteúdo' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    await expect(page).toHaveURL(root + 'summary' + context);
    await expect(page.getByRole('navigation', { name: 'Abas do projeto' }).getByRole('link', { name: 'Visão geral', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('navigation', { name: 'Breadcrumbs' }).getByRole('link', { name: 'Projetos', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/projects/);
    await page.goBack();
    await expect(page).toHaveURL(root + 'summary' + context);
    await page.goto(root + 'finance');
    await page.getByRole('button', { name: 'Despesas', exact: true }).click();
    await expect(page).toHaveURL(/tab=expenses/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Despesas', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Pagamentos', exact: true }).click();
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Despesas', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.goForward();
    await expect(page.getByRole('button', { name: 'Pagamentos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('touch phones and tablets keep UF targets and portal navigation usable', async ({ browser }) => {
    const observations = [];
    for (const width of [360, 390, 768, 1024]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ baseURL: 'http://127.0.0.1:33350', viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.addInitScript(value => localStorage.setItem('gai.theme', value), theme);
      await login(page);
      await page.goto(`/app/projects/${primary}/dashboard`);
      await page.waitForLoadState('networkidle');
      const group = page.getByRole('group', { name: 'Cartograma do Brasil por Unidade Federativa' });
      await expect(group.getByRole('button')).toHaveCount(27);
      const observation = await group.evaluate(el => ({
        coarse: matchMedia('(pointer: coarse)').matches, width: innerWidth, document: document.documentElement.scrollWidth,
        targets: Array.from(el.querySelectorAll('button')).map(button => ({ state: button.getAttribute('aria-label'), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
      }));
      expect(observation.coarse).toBe(true);
      expect(observation.document).toBeLessThanOrEqual(width + 1);
      for (const target of observation.targets) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44); }
      await group.screenshot({ path: path.join(output, `touch-map-${theme}-${width}.png`) });
      await group.getByRole('button', { name: 'SP', exact: true }).tap();
      await expect(page).toHaveURL(/state=SP/);
      if (width < 1024) {
        await page.getByRole('button', { name: 'Abrir navegação' }).tap();
        await expect(page.getByRole('dialog', { name: 'Navegação principal' })).toBeVisible();
        await page.getByRole('button', { name: 'Fechar menu' }).tap();
        await expect(page.getByRole('dialog')).not.toBeVisible();
      }
      await page.goto('/app/projects');
      await page.waitForLoadState('networkidle');
      const projectTargets = await page.locator('button:visible').evaluateAll(buttons => buttons.map(button => ({ label: button.getAttribute('aria-label') ?? button.textContent?.trim(), height: button.getBoundingClientRect().height })));
      for (const target of projectTargets) expect(target.height, target.label).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: path.join(output, `touch-projects-${theme}-${width}.png`), fullPage: false, animations: 'disabled' });
      observations.push({ theme, ...observation, projectTargets });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'touch.json'), JSON.stringify(observations, null, 2));
  });
});
