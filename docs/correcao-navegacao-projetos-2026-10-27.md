# Navegação contínua do workspace de projetos

27/10/2026 · America/Sao_Paulo. Resultado: navegação corrigida, validada na árvore de rotas e com Chromium autenticado como ORG_ADMIN, usando a API/MySQL locais reais.

## Causa raiz reproduzida

Antes da alteração, `.local/project-navigation-reproduce.cjs` abriu o resumo do projeto sintético 2 e clicou em Itens. Depois do carregamento completo, a contagem de `nav[aria-label="Abas do projeto"]` passou de **1 para 0**. Evidência: `.local/project-navigation-before.png`.

A barra `WorkspaceTabs` pertencia exclusivamente a `ProjectSummaryPage`. As outras páginas eram rotas irmãs diretamente sob AppLayout; ao mudar de rota, o resumo e sua barra eram desmontados. Nenhum layout persistente de projeto envolvia os conteúdos. Não foi reproduzido bloqueio por overlay invisível, CSS ou autenticação.

Havia também links `#unidades`, `#inventariantes` e `#configuracoes` relativos à página corrente. Essas seções só existem no resumo. O link Imagens já abria a página de itens, onde as imagens são gerenciadas no detalhe do item; não havia tela independente de imagens do projeto.

## Estrutura corrigida

```text
AppLayout (autenticação existente)
└── projects/:projectId — ProjectLayout
    ├── ProjectNavigation persistente (única barra principal)
    └── Outlet
        ├── summary / dashboard
        ├── preparation/kickoff / preparation/client-checklist
        ├── inventory-items / inventory/sessions / inventory/sessions/:sessionId
        ├── accounting-items / pending-issues
        ├── finance / finance/accountabilities
        └── import-sessions / export-jobs
```

- As mesmas páginas e URLs foram reagrupadas em `projectRoutes.tsx`, reutilizado pelo router de produção e pela integração de navegação. ProtectedRoute e permissões de cada conteúdo foram preservados; não foi acrescentado um requisito global de `projects:read` para módulos com permissão própria.
- Uma barra compartilhada usa Links com o `projectId` da rota pai. Nenhuma navegação por `window.location`, nova autenticação ou novo módulo.
- A aba ativa é calculada por pathname, hash e, no atalho Imagens, query string. Preparação permanece ativa nos dois tipos; Prestações não marca Financeiro simultaneamente. Detalhes de sessão mantêm Inventário ativo.
- Unidades/Inventariantes/Configurações agora apontam para `/app/projects/:projectId/summary#...`. O resumo aguarda os dados antes de rolar até a seção. As seções têm margem para não ficar sob a barra fixa.
- Imagens continua usando o fluxo existente no detalhe do item, com URL `inventory-items?view=images` para distinguir a seleção visual. Nenhuma rota ou galeria paralela foi criada.
- Barra mantém as classes visuais do sistema e rolagem horizontal. A aba ativa é trazida para a área visível da barra sem rolar o documento. Topbar e sidebar existentes mantidos.
- Os atalhos contextuais já existentes nas telas permanecem; a barra principal completa não é duplicada por página.
- Preparação continua nas rotas existentes. ORG_ADMIN acessou Kick-off e Checklist e voltou diretamente a Itens pela barra persistente.

## Pendências locais encontradas durante o ensaio real

1. **Catálogo incompleto:** depois da correção de layout, o navegador ainda não encontrava Inventário/Prestações. As permissões desses módulos estavam no seed declarativo atual, mas ausentes no banco. Confirmado explicitamente `NODE_ENV=local`, `DB_HOST=localhost`, `DB_PORT=3306`, `DB_DATABASE=gai`. Executado o comando existente `npm.cmd run permissions:sync`: adiciona somente entradas ausentes e não modifica/apaga concessões. Catálogo passou de 98 para 126 entradas; os vínculos customizados permaneceram com uma única concessão no perfil Operador. Não foi alterado o PermissionsGuard nem concedido bypass a ORG_USER.
2. **Prestações HTTP 400:** a requisição inicial enviava `status=` vazio. O backend rejeitava o valor de enum. A página agora omite status quando o usuário escolhe “Todos os status”. Teste verifica chamada inicial e retorno do filtro `open` para vazio. Regras financeiras e de inventário não foram modificadas.

Banco permaneceu com **23 migrations aplicadas, nenhuma pendente**. Não foram executadas migrations adicionais, resets, rollbacks ou mudanças em produção nesta entrega.

## Arquivos desta entrega

| Arquivo | Alteração |
|---|---|
| `gai-frontend/src/features/projects/ProjectLayout.tsx` | Novo layout pai com Outlet e navegação única por projeto, RBAC, seleção e rolagem horizontal. |
| `gai-frontend/src/router/projectRoutes.tsx` | Rotas de projeto extraídas e aninhadas sob o layout; páginas e guards existentes. |
| `gai-frontend/src/router/router.tsx` | Usa a árvore compartilhada; lista de projetos permanece fora do workspace. |
| `gai-frontend/src/features/projects/ProjectSummaryPage.tsx` | Remove a barra exclusiva; resolve as âncoras quando o conteúdo estiver disponível. |
| `gai-frontend/src/features/projects/ProjectUnitsPanel.tsx` | Margem da âncora Unidades sob a barra persistente. |
| `gai-frontend/src/features/field-agents/ProjectFieldAgentsPanel.tsx` | Margem da âncora Inventariantes. |
| `gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.tsx` | Omite filtro status vazio ao carregar Prestações. |
| `gai-frontend/src/features/projects/ProjectSummaryPage.test.tsx` | Exercita o resumo dentro do layout real compartilhado. |
| `gai-frontend/src/router/projectRoutes.test.tsx` | Três testes de integração com árvore real, transições, persistência do nó, histórico, troca de projeto e RBAC. Conteúdos substituídos por probes; navegação/rotas/guards reais. |
| `gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.test.tsx` | Regressão do filtro vazio inicial e ao limpar uma seleção. |
| `gai-frontend/e2e/project-navigation-real.spec.ts` | Teste opt-in com páginas/API reais, todas as abas, mobile, histórico, reload, projeto alternativo e isolamento. |
| `docs/correcao-navegacao-projetos-2026-10-27.md` | Este relatório. |

Artefatos ignorados em `.local/`: scripts de reprodução/fixtures/execução, fixture JSON, screenshot anterior e resultados Playwright. Build também regenera `dist/`, cache TypeScript e cache de ferramentas; o repositório já rastreava alguns desses artefatos. Alterações preexistentes foram preservadas. Não houve commit, push ou deploy.

## Validação funcional

Suite frontend: **194 testes aprovados em 30 arquivos**. Depois do ajuste final do filtro de Prestações, os dois testes desse componente e os três testes da árvore de navegação foram reexecutados: **5 aprovados**. TypeScript e build final aprovados. ESLint dos arquivos alterados aprovado; `git diff --check` aprovado. O build mantém aviso de bundle acima de 500 kB, preexistente ao escopo de navegação.

Playwright com Chromium e login normal `org.admin`, sem interceptação/mock de API: **1 teste completo aprovado**, execução final 27 s, incluindo:

| Sequência / verificação | Resultado |
|---|---|
| Visão geral → Itens → Financeiro → Pendências → Dashboard → Base contábil | Aprovado |
| Base contábil → Unidades → Configurações → Visão geral | Aprovado; seções visíveis abaixo da barra |
| Visão geral → Preparação → Itens | Aprovado |
| Inventário, Imagens, Inventariantes, Prestações, Importações e Exportações | Todas abertas e navegação contínua preservada |
| Checklist do Cliente → Kick-off | Aprovado; Preparação continua ativa |
| Voltar e avançar do navegador | Aprovado entre os tipos de Preparação |
| Atualização e link direto | Aprovado em Preparação; raiz `/preparation` redireciona para kickoff; acesso direto ao Financeiro |
| Viewport 390 × 844 | Unidades, Configurações, Itens, Preparação e Dashboard navegáveis; aba ativa visível; sem overflow horizontal do documento |
| Troca de projeto autorizado | Projeto 2 → lista → projeto 4 → Itens → projeto 2; IDs e destinos corretos |
| Projeto de outra organização | Projeto 5: resumo e preparação retornaram **403**; nome do projeto não foi mostrado |
| Erros no fluxo permitido | **Zero pageerrors e zero respostas API >=400** |

A identidade do mesmo nó DOM de navegação foi conferida em todas as transições desktop: continuou conectado. Em cada etapa foram validados `data-project-id="2"`, URLs, todos os hrefs internos apontando para `/projects/2/` e exatamente uma aba com `aria-current="page"`. A integração confirma também que o nó pai não desmonta e que seus links mudam para o projeto 32 ao trocar o parâmetro sintético em memória.

O ensaio criou somente dados sintéticos de apoio: projetos locais 3 e 4 na organização 1 e organização 2/empresa correspondente/projeto 5 para negativa de isolamento. O projeto 3 é registro vazio da primeira tentativa do helper de fixtures (erro no helper após a criação), mantido sem exclusão. Projeto 2/empresa 2 já eram os fixtures sintéticos da validação de Preparação. Nenhum item de inventário, lançamento financeiro ou projeto de uso existente foi alterado.

## Evidências e reprodução

Saída final: `.local/project-navigation-playwright/.last-run.json` com `status=passed`.

Screenshots inspecionados visualmente em `.local/project-navigation-playwright/project-navigation-real-OR-95fff-obile-and-tenant-boundaries-chromium/`:

- `desktop-finance.png` — navegação compartilhada presente fora do resumo.
- `mobile-dashboard.png` — Dashboard carregado na tela menor com navegação persistente e aba ativa.
- `checklist-navigation.png` — barra do projeto e abas próprias de Preparação integradas.

Com o ambiente local ativo, o wrapper ignorado `.local/run-navigation-playwright.cjs` lê as credenciais locais sem imprimi-las e os IDs em `.local/project-navigation-fixtures.json`:

```powershell
node .local/run-navigation-playwright.cjs
Set-Location gai-frontend
npm.cmd test
npm.cmd run build
```

O teste versionado é opt-in (`GAI_NAV_REAL=1`, `GAI_E2E_LOGIN`, `GAI_E2E_PASSWORD`, `GAI_NAV_PRIMARY`, `GAI_NAV_SECONDARY`, `GAI_NAV_FOREIGN`, nome estrangeiro opcional). Não cria fixtures por conta própria nem usa credenciais de produção. Reexecuções devem usar exclusivamente projetos sintéticos locais.

URLs para conferir:

- http://localhost:5173/app/projects/2/summary
- http://localhost:5173/app/projects/2/inventory-items
- http://localhost:5173/app/projects/2/finance
- http://localhost:5173/app/projects/2/preparation/kickoff
- http://localhost:5173/app/projects/2/preparation/client-checklist

## Limites e pendências

Nenhum bloqueio restante de navegação encontrado. Configurações continua exibindo os recursos e dados de consulta já suportados; não foi criado um editor novo. Imagens continua no detalhe dos itens. O placeholder antigo `/area` não faz parte das abas e não ganhou implementação nesta entrega. Somente os módulos existentes foram integrados. App/API/MySQL/storage locais permanecem em execução. Se houver uma aba antiga aberta durante a alteração de código/catálogo, recarregue para receber as rotas e permissões atuais.
