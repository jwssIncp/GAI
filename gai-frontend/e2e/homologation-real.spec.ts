import { expect, test } from '@playwright/test';

test.skip(
  process.env.GAI_REAL_E2E !== '1' || !process.env.GAI_E2E_LOGIN || !process.env.GAI_E2E_PASSWORD,
  'Requires the disposable integrated homologation stack',
);

test('login, refresh, deep link and logout against the real API', async ({
  page,
  context,
}) => {
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Login ou email').fill(process.env.GAI_E2E_LOGIN!);
  await page.getByLabel('Senha').fill(process.env.GAI_E2E_PASSWORD!);
  await page.getByRole('button', { name: /entrar/i }).click();

  await page.waitForURL('**/app/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Dashboard operacional' }),
  ).toBeVisible();

  const deepLink =
    'http://localhost:5173/app/projects/1/inventory/sessions/1';
  await page.goto(deepLink);
  await expect(
    page.getByRole('heading', { name: 'Integrated Inventory A' }),
  ).toBeVisible();
  await expect(page.getByText('ABC004')).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Integrated Inventory A' }),
  ).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto(deepLink);
  await expect(
    secondPage.getByRole('heading', { name: 'Entrar no GAI' }),
  ).toBeVisible();
  await secondPage.getByLabel('Login ou email').fill(process.env.GAI_E2E_LOGIN!);
  await secondPage.getByLabel('Senha').fill(process.env.GAI_E2E_PASSWORD!);
  await secondPage.getByRole('button', { name: /entrar/i }).click();
  await expect(
    secondPage.getByRole('heading', { name: 'Integrated Inventory A' }),
  ).toBeVisible();
  await secondPage.close();

  await page.getByRole('button', { name: /org.admin/i }).click();
  await page.getByText('Sair').click();
  await expect(
    page.getByRole('heading', { name: 'Entrar no GAI' }),
  ).toBeVisible();
});
