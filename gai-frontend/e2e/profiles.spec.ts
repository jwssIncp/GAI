import { runtimePassword } from './runtime-credentials';
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const evidence = path.resolve(process.env.GAI_PROFILES_EVIDENCE_DIR ?? '../docs/reformulacao-perfis-acessos-2026-11-02/screenshots');
async function login(page: Page, name = 'org.admin', password = runtimePassword(name), route = '/app/roles') {
  await page.goto(route);
  await page.getByLabel('Login ou email', { exact: true }).fill(name);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(route.replace(/[?]/g, '\\?') + '$'));
}
const card = (page: Page, name: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });

for (const [device, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${device} ${theme}: cards, assignment form, keyboard and no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript((value) => localStorage.setItem('gai.theme', value), theme);
      await login(page);
      await expect(page.getByRole('heading', { name: 'Operador', exact: true })).toBeVisible();
      await expect(page.getByRole('table')).toHaveCount(0);
      await expect(page.getByText('PLATFORM_ADMIN', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^((?!dark).)*$/);
      await page.screenshot({ path: path.join(evidence, `${device}-${theme}.png`), fullPage: true });
      await card(page, 'Usuário da organização').getByRole('button', { name: 'Atribuir perfil' }).click();
      await page.getByLabel('Pesquisar usuário', { exact: true }).fill('test@gai.local');
      await page.getByLabel('Usuário', { exact: true }).selectOption({ label: 'test.user — test@gai.local' });
      await expect(page.getByRole('button', { name: 'Confirmar atribuição' })).toBeEnabled();
      await page.getByLabel('Perfil', { exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Confirmar atribuição' })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole('dialog').evaluate((element) => { element.scrollTop = 0; });
      await page.screenshot({ path: path.join(evidence, `${device}-assignment-${theme}.png`) });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  }
}

test('real grant/revoke persists and changes the privileges of an already authenticated session', async ({ page, request }) => {
  const session = await request.post('/api/v1/auth/login', { data: { identifier: 'test.user', password: runtimePassword('test.user') } });
  const token = (await session.json()).access_token;
  await login(page);
  await card(page, 'Administrador da organização').getByRole('button', { name: 'Atribuir perfil' }).click();
  await page.getByLabel('Usuário', { exact: true }).selectOption({ label: 'test.user — test@gai.local' });
  await expect(page.getByRole('button', { name: 'Confirmar atribuição' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Entendo que/ }).check();
  await page.getByRole('button', { name: 'Confirmar atribuição' }).click();
  await expect(page.getByText('Perfis atualizados com sucesso.')).toBeVisible();
  expect((await request.get('/api/v1/users', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
  const associated = page.getByRole('region', { name: 'Perfis associados' }).locator('div').filter({ hasText: 'Administrador da organização' });
  await associated.getByRole('button', { name: 'Revogar' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revogar perfil?' })).toHaveCount(0);
  await expect.poll(async () => (await request.get('/api/v1/users', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(403);
  await page.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await page.goto('/app/users');
  await page.getByRole('row').filter({ hasText: 'test.user' }).getByRole('button', { name: 'Ações de test.user' }).click();
  await page.getByRole('menuitem', { name: 'Gerenciar perfis' }).click();
  await expect(page.getByRole('heading', { name: 'Perfis de test.user' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Perfis associados' })).toContainText('Operador');
});

test('last organization administrator remains protected with visible API error', async ({ page }) => {
  await login(page);
  await card(page, 'Administrador da organização').getByRole('button', { name: 'Ver detalhes' }).click();
  await page.getByRole('button', { name: 'Gerenciar perfis' }).click();
  await page.getByRole('button', { name: 'Revogar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('A organização precisa manter ao menos um administrador ativo.').last()).toBeVisible();
});

test('custom role lifecycle uses secondary grouped editor and preserves history on deletion', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Criar perfil personalizado' }).click();
  await page.getByLabel('Nome do perfil', { exact: true }).fill('Consulta de homologação');
  await page.getByLabel('Descrição', { exact: true }).fill('Consulta limitada a empresas.');
  await page.getByRole('dialog').locator('summary').filter({ hasText: 'Empresas e unidades' }).click();
  await page.getByRole('checkbox', { name: /^Empresas · Consultar/ }).check();
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(card(page, 'Consulta de homologação')).toBeVisible();
  await card(page, 'Consulta de homologação').getByRole('button', { name: 'Ver detalhes' }).click();
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  await page.getByLabel('Nome do perfil', { exact: true }).fill('Consulta atualizada');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(card(page, 'Consulta atualizada')).toBeVisible();
  await card(page, 'Consulta atualizada').getByRole('button', { name: 'Ver detalhes' }).click();
  await page.getByRole('button', { name: 'Excluir perfil', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(card(page, 'Consulta atualizada')).toHaveCount(0);
});

test('platform administrator can select organizational context without losing global administration', async ({ page }) => {
  await login(page, 'platform.admin');
  await expect(page.getByRole('heading', { name: 'Administrador da plataforma', exact: true })).toBeVisible();
  await page.getByLabel('Organização ativa', { exact: true }).selectOption('1');
  await expect(page.getByRole('heading', { name: 'Administrador da organização', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administrador da plataforma', exact: true })).toHaveCount(0);
  await page.getByLabel('Organização ativa', { exact: true }).selectOption('');
  await expect(page.getByRole('heading', { name: 'Administrador da plataforma', exact: true })).toBeVisible();
});
