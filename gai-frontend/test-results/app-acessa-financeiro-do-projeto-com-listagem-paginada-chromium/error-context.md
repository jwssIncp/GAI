# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> acessa financeiro do projeto com listagem paginada
- Location: e2e\app.spec.ts:821:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Financeiro do projeto' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Financeiro do projeto' })

```

```yaml
- complementary:
  - text: G
  - img
  - text: GAI Asset intelligence
  - img
  - text: Operação patrimonial conectada
  - heading "Decisões melhores começam com ativos sob controle." [level=1]
  - paragraph: Inventário, auditoria e operação financeira em um workspace preciso, rastreável e preparado para escala.
  - img
  - paragraph: Inventário
  - paragraph: Visão unificada
  - img
  - paragraph: Rastreabilidade
  - paragraph: Histórico confiável
  - img
  - paragraph: Governança
  - paragraph: Acesso por perfil
- main:
  - button "Ativar tema escuro":
    - img
  - img
  - text: Acesso seguro
  - heading "Entrar no GAI" [level=1]
  - paragraph: Acesse seu workspace de gestão patrimonial.
  - text: Login ou email
  - textbox "Login ou email":
    - /placeholder: nome@empresa.com
  - text: Senha
  - textbox "Senha":
    - /placeholder: Sua senha de acesso
  - button "Exibir conteúdo do campo":
    - img
  - link "Esqueci minha senha":
    - /url: /forgot-password
  - button "Entrar":
    - img
    - text: Entrar
  - img
  - text: Sessão protegida e acesso auditável
```

# Test source

```ts
  725 |   await authenticate(page);
  726 |   await page.goto('/app/projects/10/accounting-items');
  727 |   await page.getByLabel('Filtrar base contabil por status').selectOption('pending');
  728 |   await page.getByPlaceholder('Placa').fill('PAT');
  729 |   await expect(page.getByText('Notebook contabil')).toBeVisible();
  730 | });
  731 | 
  732 | test('abre detalhe de item contabil', async ({ page }) => {
  733 |   await mockApi(page);
  734 |   await authenticate(page);
  735 |   await page.goto('/app/projects/10/accounting-items');
  736 |   await page.getByLabel('Visualizar item contabil').click();
  737 |   await expect(page.getByText('Item contabil #21 - Projeto #10')).toBeVisible();
  738 |   await expect(page.getByLabel('Detalhes do item contabil').getByText('Sala 20')).toBeVisible();
  739 | });
  740 | 
  741 | test('acessa pendencias a partir de um projeto autenticado', async ({ page }) => {
  742 |   await mockApi(page);
  743 |   await authenticate(page);
  744 |   await page.goto('/app/projects/10/pending-issues');
  745 |   await expect(page.getByRole('heading', { name: 'Pendencias' })).toBeVisible();
  746 |   await expect(page.getByText('Placa divergente')).toBeVisible();
  747 | });
  748 | 
  749 | test('bloqueia pendencias sem permissao', async ({ page }) => {
  750 |   await mockApi(page, limitedUser);
  751 |   await authenticateAs(page, limitedUser);
  752 |   await page.goto('/app/projects/10/pending-issues');
  753 |   await expect(page.getByText('Acesso negado')).toBeVisible();
  754 | });
  755 | 
  756 | test('abre nova pendencia e valida obrigatorios', async ({ page }) => {
  757 |   await mockApi(page);
  758 |   await authenticate(page);
  759 |   await page.goto('/app/projects/10/pending-issues');
  760 |   await page.getByRole('button', { name: /nova pendencia/i }).click();
  761 |   await page.getByLabel('Titulo').fill('');
  762 |   await page.getByRole('button', { name: /salvar pendencia/i }).click();
  763 |   await expect(page.getByText('Informe o titulo')).toBeVisible();
  764 | });
  765 | 
  766 | test('filtra pendencias por status', async ({ page }) => {
  767 |   await mockApi(page);
  768 |   await authenticate(page);
  769 |   await page.goto('/app/projects/10/pending-issues');
  770 |   await page.getByLabel('Filtrar pendencia por status').selectOption('open');
  771 |   await expect(page.getByText('Placa divergente')).toBeVisible();
  772 | });
  773 | 
  774 | test('abre detalhe da pendencia', async ({ page }) => {
  775 |   await mockApi(page);
  776 |   await authenticate(page);
  777 |   await page.goto('/app/projects/10/pending-issues');
  778 |   await page.getByLabel('Visualizar pendencia').click();
  779 |   await expect(page.getByText(/Pendencia #41/)).toBeVisible();
  780 |   await expect(page.getByText('Item inventariado #11')).toBeVisible();
  781 | });
  782 | 
  783 | test('resolve pendencia com observacao', async ({ page }) => {
  784 |   await mockApi(page);
  785 |   await authenticate(page);
  786 |   await page.goto('/app/projects/10/pending-issues');
  787 |   await page.getByLabel('Resolver pendencia').click();
  788 |   await page.getByLabel('Observacoes da resolucao').fill('Conferido');
  789 |   await page.getByRole('button', { name: /resolver pendencia/i }).click();
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
> 825 |   await expect(page.getByRole('heading', { name: 'Financeiro do projeto' })).toBeVisible();
      |                                                                              ^ Error: expect(locator).toBeVisible() failed
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
  890 |   await expect(page.getByRole('heading', { name: 'Dashboard · Projeto Alpha' })).toBeVisible();
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
```