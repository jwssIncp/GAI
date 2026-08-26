# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> acessa dashboard analitico do projeto e aplica filtro
- Location: e2e\app.spec.ts:886:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Dashboard · Projeto Alpha' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Dashboard · Projeto Alpha' })

```

```yaml
- complementary:
  - text: G
  - img
  - text: GAI Gestão inteligente de ativos
  - navigation "Navegação principal":
    - paragraph: Workspace
    - link "Visão geral":
      - /url: /app/dashboard
      - img
      - text: Visão geral
    - link "Projetos":
      - /url: /app/projects
      - img
      - text: Projetos
    - link "Inventariantes":
      - /url: /app/field-agents
      - img
      - text: Inventariantes
    - paragraph: Administração
    - link "Organizações":
      - /url: /app/organizations
      - img
      - text: Organizações
    - link "Usuários":
      - /url: /app/users
      - img
      - text: Usuários
    - link "Perfis e acessos":
      - /url: /app/roles
      - img
      - text: Perfis e acessos
    - link "Empresas":
      - /url: /app/companies
      - img
      - text: Empresas
  - img
  - text: Ambiente protegido
  - paragraph: Acesso segmentado por perfil e organização.
- banner:
  - text: Projetos
  - img
  - text: "#10"
  - img
  - text: Visão geral Plataforma
  - button "Ativar tema escuro":
    - img
  - button "Menu do usuário platform.admin":
    - text: PL platform.admin Plataforma
    - img
- main:
  - link "Projetos":
    - /url: /app/projects
  - text: / Projeto / Dashboard Workspace
  - heading "Dashboard do projeto" [level=1]
  - paragraph: Progresso do inventário, ritmo recente, distribuição operacional e cobertura geográfica em uma visão única.
  - button "Limpar filtros":
    - img
    - text: Limpar filtros
  - region "Filtros do dashboard":
    - text: Período
    - combobox "Período":
      - option "Últimos 7 dias"
      - option "Últimos 30 dias" [selected]
      - option "Mês atual"
      - option "Período total"
      - option "Personalizado"
    - text: Agrupamento
    - combobox "Agrupamento":
      - option "Diário" [selected]
      - option "Semanal"
      - option "Mensal"
    - text: Unidade
    - combobox "Unidade":
      - option "Todas" [selected]
    - text: UF
    - combobox "UF":
      - option "Todas" [selected]
    - text: Status
    - combobox "Status":
      - option "Todos" [selected]
  - status "Carregando dashboard":
    - status:
      - img
      - paragraph: Calculando indicadores do projeto
      - paragraph: Sincronizando as informacoes mais recentes.
```

# Test source

```ts
  790 |   await expect(page.getByRole('heading', { name: 'Resolver pendencia' })).not.toBeVisible();
  791 | });
  792 | 
  793 | test('ignora pendencia', async ({ page }) => {
  794 |   await mockApi(page);
  795 |   await authenticate(page);
  796 |   await page.goto('/app/projects/10/pending-issues');
  797 |   await page.getByLabel('Ignorar pendencia').click();
  798 |   await page.getByLabel('Motivo ou observacao').fill('Nao aplicavel');
  799 |   await page.getByRole('button', { name: /ignorar pendencia/i }).click();
  800 |   await expect(page.getByRole('heading', { name: 'Ignorar pendencia' })).not.toBeVisible();
  801 | });
  802 | 
  803 | test('cancela pendencia com confirmacao', async ({ page }) => {
  804 |   await mockApi(page);
  805 |   await authenticate(page);
  806 |   await page.goto('/app/projects/10/pending-issues');
  807 |   await page.getByLabel('Cancelar pendencia').click();
  808 |   await page.getByRole('button', { name: 'Confirmar' }).click();
  809 |   await expect(page.getByText('Cancelar pendencia')).not.toBeVisible();
  810 | });
  811 | 
  812 | test('aciona geracao automatica de pendencias', async ({ page }) => {
  813 |   await mockApi(page);
  814 |   await authenticate(page);
  815 |   await page.goto('/app/projects/10/pending-issues');
  816 |   await page.getByRole('button', { name: /gerar pendencias/i }).click();
  817 |   await page.getByRole('button', { name: 'Confirmar' }).click();
  818 |   await expect(page.getByText('Geracao concluida: 3 criada(s), 1 ignorada(s).')).toBeVisible();
  819 | });
  820 | 
  821 | test('acessa financeiro do projeto com listagem paginada', async ({ page }) => {
  822 |   await mockApi(page);
  823 |   await authenticate(page);
  824 |   await page.goto('/app/projects/10/finance');
  825 |   await expect(page.getByRole('heading', { name: 'Financeiro do projeto' })).toBeVisible();
  826 |   await expect(page.getByText('Pagamento #10')).toBeVisible();
  827 |   await expect(page.getByText('Pagina 1 de 1')).toBeVisible();
  828 | });
  829 | 
  830 | test('bloqueia financeiro sem permissao', async ({ page }) => {
  831 |   await mockApi(page, limitedUser);
  832 |   await authenticateAs(page, limitedUser);
  833 |   await page.goto('/app/projects/10/finance');
  834 |   await expect(page.getByText('Acesso negado')).toBeVisible();
  835 | });
  836 | 
  837 | test('valida novo pagamento no financeiro', async ({ page }) => {
  838 |   await mockApi(page);
  839 |   await authenticate(page);
  840 |   await page.goto('/app/projects/10/finance');
  841 |   await page.getByRole('button', { name: /novo pagamento/i }).click();
  842 |   await page.getByRole('button', { name: /criar pagamento/i }).click();
  843 |   await expect(page.getByText('Selecione o inventariante')).toBeVisible();
  844 | });
  845 | 
  846 | test('filtra pagamentos no financeiro', async ({ page }) => {
  847 |   await mockApi(page);
  848 |   await authenticate(page);
  849 |   await page.goto('/app/projects/10/finance');
  850 |   await page.getByLabel('Filtrar pagamento por status').selectOption('pending');
  851 |   await page.getByPlaceholder('UF/Estado').fill('SP');
  852 |   await expect(page.getByText('Pagamento #10')).toBeVisible();
  853 | });
  854 | 
  855 | test('envia comprovante de despesa no financeiro', async ({ page }) => {
  856 |   await mockApi(page);
  857 |   await authenticate(page);
  858 |   await page.goto('/app/projects/10/finance');
  859 |   await page.getByRole('button', { name: 'Despesas' }).click();
  860 |   await expect(page.getByText('Almoco em campo')).toBeVisible();
  861 |   await page.getByLabel('Comprovantes da despesa').click();
  862 |   await expect(page.getByText('recibo.pdf')).toBeVisible();
  863 |   await page.getByLabel('Enviar comprovante').setInputFiles({ name: 'novo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('fake-pdf') });
  864 |   await expect(page.getByText('Comprovante enviado com sucesso.')).toBeVisible();
  865 | });
  866 | 
  867 | test('acessa exportacoes a partir de um projeto autenticado', async ({ page }) => {
  868 |   await mockApi(page);
  869 |   await authenticate(page);
  870 |   await page.goto('/app/projects/10/export-jobs');
  871 |   await expect(page.getByRole('heading', { name: 'Exportacoes' })).toBeVisible();
  872 |   await expect(page.getByText('Nenhum registro encontrado')).toBeVisible();
  873 |   await expect(page.getByRole('button', { name: /nova exportacao/i })).toBeEnabled();
  874 | });
  875 | 
  876 | test('acessa workspace consolidado do projeto', async ({ page }) => {
  877 |   await mockApi(page);
  878 |   await authenticate(page);
  879 |   await page.goto('/app/projects/10/summary');
  880 |   await expect(page.getByRole('heading', { name: 'Projeto Alpha' })).toBeVisible();
  881 |   await expect(page.getByText('Inventario da filial SP')).toBeVisible();
  882 |   await expect(page.getByText('Total de itens')).toBeVisible();
  883 |   await expect(page.getByText('Alertas operacionais')).toBeVisible();
  884 | });
  885 | 
  886 | test('acessa dashboard analitico do projeto e aplica filtro', async ({ page }) => {
  887 |   await mockApi(page);
  888 |   await authenticate(page);
  889 |   await page.goto('/app/projects/10/dashboard');
> 890 |   await expect(page.getByRole('heading', { name: 'Dashboard · Projeto Alpha' })).toBeVisible();
      |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  891 |   await expect(page.getByText('65 de 100 itens inventariados')).toBeVisible();
  892 |   await expect(page.getByRole('button', { name: 'SP' })).toBeVisible();
  893 |   await page.getByLabel('Status', { exact: true }).selectOption('evaluated');
  894 |   await expect(page).toHaveURL(/status=evaluated/);
  895 | });
  896 | 
  897 | test('navega entre abas do workspace do projeto', async ({ page }) => {
  898 |   await mockApi(page);
  899 |   await authenticate(page);
  900 |   await page.goto('/app/projects/10/summary');
  901 |   await page.getByRole('link', { name: 'Itens', exact: true }).click();
  902 |   await expect(page.getByRole('heading', { name: 'Itens inventariados' })).toBeVisible();
  903 | });
  904 | 
  905 | test('abre atalho rapido de novo item no workspace', async ({ page }) => {
  906 |   await mockApi(page);
  907 |   await authenticate(page);
  908 |   await page.goto('/app/projects/10/summary');
  909 |   await page.getByRole('button', { name: /novo item/i }).click();
  910 |   await expect(page.getByRole('heading', { name: 'Itens inventariados' })).toBeVisible();
  911 | });
  912 | 
  913 | test('bloqueia workspace sem permissao de projeto', async ({ page }) => {
  914 |   await mockApi(page, limitedUser);
  915 |   await authenticateAs(page, limitedUser);
  916 |   await page.goto('/app/projects/10/summary');
  917 |   await expect(page.getByText('Acesso negado')).toBeVisible();
  918 | });
  919 | 
  920 | test('bloqueia exportacoes sem permissao de projeto', async ({ page }) => {
  921 |   await mockApi(page, limitedUser);
  922 |   await authenticateAs(page, limitedUser);
  923 |   await page.goto('/app/projects/10/export-jobs');
  924 |   await expect(page.getByText('Acesso negado')).toBeVisible();
  925 | });
  926 | 
  927 | test('abre exportacoes pelo resumo do projeto', async ({ page }) => {
  928 |   await mockApi(page);
  929 |   await authenticate(page);
  930 |   await page.goto('/app/projects/10/summary');
  931 |   await page.getByRole('link', { name: 'Exportacoes' }).first().click();
  932 |   await expect(page.getByRole('heading', { name: 'Exportacoes' })).toBeVisible();
  933 | });
  934 | 
  935 | test('acessa importacoes a partir de um projeto autenticado', async ({ page }) => {
  936 |   await mockApi(page);
  937 |   await authenticate(page);
  938 |   await page.goto('/app/projects/10/import-sessions');
  939 |   await expect(page.getByRole('heading', { name: 'Importacoes' })).toBeVisible();
  940 |   await expect(page.getByText('uuid-50')).toBeVisible();
  941 | });
  942 | 
  943 | test('bloqueia importacoes sem permissao', async ({ page }) => {
  944 |   await mockApi(page, limitedUser);
  945 |   await authenticateAs(page, limitedUser);
  946 |   await page.goto('/app/projects/10/import-sessions');
  947 |   await expect(page.getByText('Acesso negado')).toBeVisible();
  948 | });
  949 | 
  950 | test('abre nova importacao e valida tipo obrigatorio', async ({ page }) => {
  951 |   await mockApi(page);
  952 |   await authenticate(page);
  953 |   await page.goto('/app/projects/10/import-sessions');
  954 |   await page.getByRole('button', { name: /nova importacao/i }).click();
  955 |   await page.getByRole('button', { name: /criar importacao/i }).click();
  956 |   await expect(page.getByText('Selecione o tipo')).toBeVisible();
  957 | });
  958 | 
  959 | test('preenche formulario de criacao de importacao', async ({ page }) => {
  960 |   await mockApi(page);
  961 |   await page.route('**/api/v1/projects/10/import-sessions', async (route: any) => {
  962 |     if (route.request().method() === 'POST') await route.fulfill({ status: 201, json: importSession });
  963 |     else await route.fallback();
  964 |   });
  965 |   await authenticate(page);
  966 |   await page.goto('/app/projects/10/import-sessions');
  967 |   await page.getByRole('button', { name: /nova importacao/i }).click();
  968 |   await page.locator('select[name="type"]').selectOption('mobile_sync');
  969 |   await page.locator('select[name="source"]').selectOption('mobile_app');
  970 |   await page.locator('input[name="expected_payloads"]').fill('2');
  971 |   await expect(page.locator('select[name="type"]')).toHaveValue('mobile_sync');
  972 |   await expect(page.locator('select[name="source"]')).toHaveValue('mobile_app');
  973 | });
  974 | 
  975 | test('abre detalhe de importacao e navega nas abas', async ({ page }) => {
  976 |   await mockApi(page);
  977 |   await page.route('**/api/v1/projects/10/import-sessions/50/errors**', async (route: any) =>
  978 |     route.fulfill({ json: { items: [importError], page: 1, page_size: 10, total_items: 1, total_pages: 1 } }),
  979 |   );
  980 |   await page.route('**/api/v1/projects/10/import-sessions/50/files**', async (route: any) => route.fulfill({ json: [importFile] }));
  981 |   await authenticate(page);
  982 |   await page.goto('/app/projects/10/import-sessions');
  983 |   await page.getByLabel('Visualizar importacao').click();
  984 |   await expect(page.getByText('Payloads recebidos')).toBeVisible();
  985 |   await page.getByRole('button', { name: 'Erros' }).click();
  986 |   await expect(page.getByText('Item invalido')).toBeVisible();
  987 |   await page.getByRole('button', { name: 'Arquivos' }).click();
  988 |   await expect(page.getByText('raw.json')).toBeVisible();
  989 |   await expect(page.getByText('private/raw.zip')).not.toBeVisible();
  990 | });
```