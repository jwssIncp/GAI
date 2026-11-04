import { runtimePassword } from './runtime-credentials';
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const evidence = path.resolve('../docs/modernizacao-empresas-2026-11-02/screenshots');
async function login(page: Page) {
  await page.goto('/app/companies');
  await page.getByLabel('Login ou email', { exact: true }).fill('org.admin');
  await page.getByLabel('Senha', { exact: true }).fill(runtimePassword('org.admin'));
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/app/companies');
  await expect(page.getByRole('heading', { name: 'Empresas', exact: true })).toBeVisible();
}

test('real API lifecycle: create, list, detail, edit, query again, deactivate and restore', async ({ page }) => {
  await login(page);
  await page.route('https://viacep.com.br/**', (route) => route.fulfill({ json: { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' } }));
  await page.getByRole('button', { name: 'Nova empresa' }).click();
  await expect(page).toHaveURL(/\/app\/companies\/new/);
  await expect(page.getByLabel('Organização', { exact: true })).toHaveCount(0);
  await page.getByLabel('Nome da empresa', { exact: true }).fill('Empresa de homologação');
  await page.getByLabel('Razão social', { exact: true }).fill('Empresa de homologação Ltda');
  await page.getByLabel('CNPJ', { exact: true }).fill('12abc34501de35');
  await expect(page.getByLabel('CNPJ', { exact: true })).toHaveValue('12.ABC.345/01DE-35');
  await page.getByLabel('E-mail', { exact: true }).fill('contato@homologacao.com.br');
  await page.getByLabel('Telefone', { exact: true }).fill('11999998888');
  await page.getByLabel('CEP', { exact: true }).fill('01001000');
  await page.getByLabel('Número', { exact: true }).fill('35');
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('São Paulo');
  await page.getByLabel('Complemento', { exact: true }).fill('Sala 4');
  await page.getByRole('button', { name: 'Cadastrar empresa', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/companies\/\d+$/);
  await expect(page.getByText('contato@homologacao.com.br', { exact: true })).toBeVisible();
  const detailUrl = page.url();
  await page.screenshot({ path: path.join(evidence, 'desktop-detail-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'Editar empresa' }).click();
  await page.getByLabel('Inscrição estadual', { exact: true }).fill('ISENTO');
  await page.getByLabel('E-mail', { exact: true }).fill('atualizado@homologacao.com.br');
  await page.getByLabel('Complemento', { exact: true }).fill('Sala 9');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page).toHaveURL(detailUrl);
  await page.reload();
  await expect(page.getByText('atualizado@homologacao.com.br', { exact: true })).toBeVisible();
  await expect(page.getByText('Sala 9', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à listagem' }).click();
  await page.getByPlaceholder('Buscar por nome, razão social ou CNPJ').fill('12.ABC.345/01DE-35');
  await expect(page.getByRole('link', { name: 'Empresa de homologação', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await page.getByRole('button', { name: 'Desativar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reativar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar empresa' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reativar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar empresa' })).toBeVisible();
});

for (const [device, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${device} ${theme}: responsive form, keyboard, pending navigation and manual CEP fallback`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript((value) => localStorage.setItem('gai.theme', value), theme);
      await login(page);
      await page.goto('/app/companies/new');
      await expect(page.getByLabel('Nome da empresa', { exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Cadastrar empresa', exact: true }).click();
      await expect(page.getByText('Informe o nome da empresa.', { exact: true })).toBeVisible();
      await page.getByLabel('Nome da empresa', { exact: true }).fill('Empresa em revisão');
      await page.getByLabel('Razão social', { exact: true }).fill('Empresa em revisão Ltda');
      await page.getByLabel('CNPJ', { exact: true }).fill('11444777000161');
      await page.getByRole('button', { name: 'Voltar à listagem' }).click();
      await expect(page.getByRole('dialog')).toContainText('Descartar alterações?');
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
      await page.route('https://viacep.com.br/**', (route) => route.fulfill({ json: { erro: true } }));
      await page.getByLabel('CEP', { exact: true }).fill('99999999');
      await page.getByLabel('CEP', { exact: true }).press('Tab');
      await expect(page.getByText(/CEP não encontrado/)).toBeVisible();
      await page.getByLabel('Logradouro', { exact: true }).fill('Rua preenchida manualmente');
      await page.getByLabel('Número', { exact: true }).fill('42');
      await page.getByLabel('Cidade', { exact: true }).fill('Curitiba');
      await page.getByLabel('Estado', { exact: true }).fill('PR');
      await page.getByLabel('Nome da empresa', { exact: true }).focus();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^((?!dark).)*$/);
      await page.screenshot({ path: path.join(evidence, `${device}-form-${theme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
      await expect(page).toHaveURL(/\/app\/companies$/);
    });
  }
}
