# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> acessa base contabil a partir de um projeto autenticado
- Location: e2e\app.spec.ts:698:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Notebook contabil')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Notebook contabil')

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
  603 |   await expect(form.getByText('Opcional')).toBeVisible();
  604 | 
  605 |   await form.getByRole('button', { name: 'Ajuda sobre Usuário vinculado' }).click();
  606 |   const help = page.getByRole('dialog', { name: 'Sobre este campo' });
  607 |   await expect(help.getByText(/Vincula o inventariante a uma conta já cadastrada em Usuários/)).toBeVisible();
  608 |   await help.getByRole('button', { name: 'Fechar ajuda' }).click();
  609 | 
  610 |   await form.getByRole('button', { name: /salvar inventariante/i }).click();
  611 |   await expect(form.getByText('Nome deve ter pelo menos 2 caracteres')).toBeVisible();
  612 | });
  613 | 
  614 | test('abre detalhe de inventariante', async ({ page }) => {
  615 |   await mockApi(page);
  616 |   await authenticate(page);
  617 |   await page.goto('/app/field-agents');
  618 |   await page.getByLabel('Visualizar inventariante').click();
  619 |   await expect(page.getByText('Detalhes do inventariante')).toBeVisible();
  620 |   await expect(page.getByText('Inventariante #7')).toBeVisible();
  621 | });
  622 | 
  623 | test('acessa itens a partir de um projeto autenticado', async ({ page }) => {
  624 |   await mockApi(page);
  625 |   await authenticate(page);
  626 |   await page.goto('/app/projects/10/inventory-items');
  627 |   await expect(page.getByRole('heading', { name: 'Itens inventariados' })).toBeVisible();
  628 |   await expect(page.getByText('Notebook Dell')).toBeVisible();
  629 | });
  630 | 
  631 | test('bloqueia itens sem permissao', async ({ page }) => {
  632 |   await mockApi(page, limitedUser);
  633 |   await authenticateAs(page, limitedUser);
  634 |   await page.goto('/app/projects/10/inventory-items');
  635 |   await expect(page.getByText('Acesso negado')).toBeVisible();
  636 | });
  637 | 
  638 | test('abre formulario e valida campos obrigatorios de item', async ({ page }) => {
  639 |   await mockApi(page);
  640 |   await authenticate(page);
  641 |   await page.goto('/app/projects/10/inventory-items');
  642 |   await page.getByRole('button', { name: /novo item/i }).click();
  643 |   await page.getByRole('button', { name: /salvar item/i }).click();
  644 |   await expect(page.getByText('Informe a descricao do item')).toBeVisible();
  645 | });
  646 | 
  647 | test('abre detalhe de item', async ({ page }) => {
  648 |   await mockApi(page);
  649 |   await authenticate(page);
  650 |   await page.goto('/app/projects/10/inventory-items');
  651 |   await expect(page.getByText('Notebook Dell')).toBeVisible();
  652 |   await page.getByLabel('Visualizar item').click();
  653 |   await expect(page.getByText('Item #11 - Projeto #10')).toBeVisible();
  654 |   await expect(page.getByLabel('Detalhes do item').getByText('Sala 10')).toBeVisible();
  655 |   await expect(page.getByText('frente.webp')).toBeVisible();
  656 | });
  657 | 
  658 | test('visualiza imagem de item por download-url temporaria', async ({ page }) => {
  659 |   await mockApi(page);
  660 |   await authenticate(page);
  661 |   await page.goto('/app/projects/10/inventory-items');
  662 |   await expect(page.getByText('Notebook Dell')).toBeVisible();
  663 |   await page.getByLabel('Visualizar item').click();
  664 |   await page.getByRole('button', { name: /visualizar/i }).click();
  665 |   await expect(page.getByRole('img', { name: 'frente.webp' })).toHaveAttribute('src', 'https://signed.example/preview.webp');
  666 | });
  667 | 
  668 | test('envia imagem de item com upload-url e confirmacao', async ({ page }) => {
  669 |   await mockApi(page);
  670 |   await authenticate(page);
  671 |   await page.goto('/app/projects/10/inventory-items');
  672 |   await expect(page.getByText('Notebook Dell')).toBeVisible();
  673 |   await page.getByLabel('Visualizar item').click();
  674 |   await page.getByLabel('Adicionar imagem').setInputFiles({ name: 'nova.webp', mimeType: 'image/webp', buffer: Buffer.from('fake-image') });
  675 |   await expect(page.getByText('Imagem enviada com sucesso.')).toBeVisible();
  676 | });
  677 | 
  678 | test('remove imagem de item com confirmacao', async ({ page }) => {
  679 |   await mockApi(page);
  680 |   await authenticate(page);
  681 |   await page.goto('/app/projects/10/inventory-items');
  682 |   await expect(page.getByText('Notebook Dell')).toBeVisible();
  683 |   await page.getByLabel('Visualizar item').click();
  684 |   await page.getByLabel('Remover frente.webp').click();
  685 |   await page.getByRole('button', { name: 'Confirmar' }).click();
  686 |   await expect(page.getByText('Remover imagem')).not.toBeVisible();
  687 | });
  688 | 
  689 | test('filtra itens por status e busca', async ({ page }) => {
  690 |   await mockApi(page);
  691 |   await authenticate(page);
  692 |   await page.goto('/app/projects/10/inventory-items');
  693 |   await page.getByLabel('Filtrar por status').selectOption('pending');
  694 |   await page.getByPlaceholder('Buscar item').fill('Notebook');
  695 |   await expect(page.getByText('Notebook Dell')).toBeVisible();
  696 | });
  697 | 
  698 | test('acessa base contabil a partir de um projeto autenticado', async ({ page }) => {
  699 |   await mockApi(page);
  700 |   await authenticate(page);
  701 |   await page.goto('/app/projects/10/accounting-items');
  702 |   await expect(page.getByRole('heading', { name: 'Base contabil' })).toBeVisible();
> 703 |   await expect(page.getByText('Notebook contabil')).toBeVisible();
      |                                                     ^ Error: expect(locator).toBeVisible() failed
  704 |   await expect(page.getByText('base.xlsx')).toBeVisible();
  705 | });
  706 | 
  707 | test('bloqueia base contabil sem permissao', async ({ page }) => {
  708 |   await mockApi(page, limitedUser);
  709 |   await authenticateAs(page, limitedUser);
  710 |   await page.goto('/app/projects/10/accounting-items');
  711 |   await expect(page.getByText('Acesso negado')).toBeVisible();
  712 | });
  713 | 
  714 | test('abre modal e valida arquivo invalido da base contabil', async ({ page }) => {
  715 |   await mockApi(page);
  716 |   await authenticate(page);
  717 |   await page.goto('/app/projects/10/accounting-items');
  718 |   await page.getByRole('button', { name: /importar xlsx/i }).click();
  719 |   await page.getByLabel('Selecionar XLSX contabil').setInputFiles({ name: 'base.csv', mimeType: 'text/csv', buffer: Buffer.from('csv') });
  720 |   await expect(page.getByText('Envie um arquivo .xlsx valido.')).toBeVisible();
  721 | });
  722 | 
  723 | test('filtra base contabil por status e placa', async ({ page }) => {
  724 |   await mockApi(page);
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
```