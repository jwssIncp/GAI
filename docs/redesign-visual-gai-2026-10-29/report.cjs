const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'evidencias');
const read = (name, fallback = null) => { const p = path.join(out, name); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback; };
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function tests(name) {
  const r = read(name);
  return r ? { total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests } : null;
}
function playwright(name) {
  const result = read(name), cases = [];
  function visit(s) {
    for (const spec of s.specs ?? []) for (const t of spec.tests ?? []) cases.push({ title: spec.title, status: t.results?.at(-1)?.status });
    for (const child of s.suites ?? []) visit(child);
  }
  for (const s of result?.suites ?? []) visit(s);
  return { total: cases.length, passed: cases.filter(c => c.status === 'passed').length, failed: cases.filter(c => !['passed', 'skipped'].includes(c.status)).length, skipped: cases.filter(c => c.status === 'skipped').length, cases };
}
const validation = { date: '2026-10-29', backend: tests('default-jest.json'), mysql: tests('mysql-jest.json'), frontend: tests('frontend-vitest.json'), visual: playwright('visual/playwright.json'), flows: playwright('e2e/playwright.json'), navigationRecheck: playwright('final-nav/playwright.json') };
const inventory = read('inventario-controles.json', []), modules = read('inventario-frontend.json', []);
const allVisualPassed = validation.visual.total > 0 && validation.visual.failed === 0 && validation.visual.skipped === 0;
const controlCases = [
  ['layouts/Sidebar.tsx', 'collapsed ?', 'responsive modules'],
  ['layouts/Topbar.tsx', 'Menu do usuário', 'theme persistence'],
  ['layouts/Topbar.tsx', 'Ativar tema', 'theme persistence'],
  ['layouts/Topbar.tsx', 'Perfil', 'theme persistence'],
  ['layouts/Topbar.tsx', 'Sair', 'theme persistence'],
  ['layouts/AuthLayout.tsx', 'Tema do sistema', 'theme persistence'],
  ['layouts/AuthLayout.tsx', 'Ativar tema', 'theme persistence'],
  ['layouts/AppLayout.tsx', 'Ir para o conteúdo', 'theme persistence'],
  ['features/projects/ProjectsPage.tsx', 'Novo projeto', 'real project creation'],
  ['components/base/Pagination.tsx', 'Pagina anterior', 'real project creation'],
  ['components/base/Pagination.tsx', 'Proxima pagina', 'real project creation'],
];
const coverage = inventory.map(control => {
  const item = controlCases.find(([file, label]) => control.path.endsWith(file) && control.label.includes(label));
  return { id: control.id, path: control.path, line: control.line, tag: control.tag, label: control.label,
    static: control.staticSignals,
    runtime: item && allVisualPassed ? { status: 'exercitado', evidence: control.path.endsWith('layouts/AppLayout.tsx') ? 'final-nav/playwright.json' : 'visual/playwright.json', scenario: item[2] } : { status: 'nao-verificado-individualmente', note: 'Pode participar de um fluxo ou screenshot; isso não comprova execução individual de todas as instâncias, estados e permissões.' } };
});
fs.writeFileSync(path.join(out, 'cobertura-controles.json'), JSON.stringify(coverage, null, 2));
fs.writeFileSync(path.join(out, 'acoes-nao-verificadas.json'), JSON.stringify(coverage.filter(c => c.runtime.status !== 'exercitado'), null, 2));
const initial = read('initial-files.json', []);
const changed = read('../arquivos.json', []);
const changedPaths = new Set(changed.map(c => c.path));
const preservation = initial.filter(e => !changedPaths.has(e.path)).map(e => ({ path: e.path, unchanged: fs.existsSync(path.join(root, e.path)) && hash(path.join(root, e.path)) === e.sha256 }));
fs.writeFileSync(path.join(out, 'preservacao.json'), JSON.stringify({ compared: preservation.length, unchanged: preservation.filter(e => e.unchanged).length, divergences: preservation.filter(e => !e.unchanged), backendChanged: changed.filter(c => c.path.startsWith('gai-backend/')) }, null, 2));
fs.writeFileSync(path.join(out, 'validacao-final.json'), JSON.stringify(validation, null, 2));
const observed = fs.existsSync(path.join(out, 'visual')) ? fs.readdirSync(path.join(out, 'visual')).filter(n => n.startsWith('observed-')).flatMap(n => read('visual/' + n)?.observations ?? []) : [];
const contrast = read('visual/contrast.json', []);
const write = (name, text) => fs.writeFileSync(path.join(__dirname, name), text.trim() + '\n');
const summary = r => r ? `${r.passed}/${r.total}; ${r.failed} falhas; ${r.skipped} ignorados` : 'Não executado nesta entrega';
const evidence = '[evidencias/validacao-final.json](evidencias/validacao-final.json)';
write('README.md', `# GAI — evolução visual e UX · 29/10/2026

Implementação real no frontend, preservando azul marinho, verde e teal da identidade anterior. Marca vetorial própria, navegação mais clara, sidebar recolhível, menu mobile com foco contido e retorno ao acionador, componentes compartilhados padronizados, contraste corrigido, temas sincronizados e filtros relevantes na URL.

| Validação | Resultado |
| --- | --- |
| Backend padrão | ${summary(validation.backend)} |
| MySQL descartável | ${summary(validation.mysql)} |
| Frontend completo | ${summary(validation.frontend)} |
| Playwright de UI/temas/responsividade | ${summary(validation.visual)} |
| Playwright de fluxos e navegação das Ondas anteriores | ${summary(validation.flows)} |

Resultados detalhados em ${evidence} e [testes.md](testes.md). Não somar reexecuções ou capturas como novos casos funcionais.

## Entregas

- [Auditoria visual](auditoria-visual.md)
- [Design system](design-system.md) e [identidade GAI](identidade-gai.md)
- [Navegação](navegacao-ux.md), [interatividade e cobertura](interatividade.md)
- [Temas](temas.md), [responsividade](responsividade.md), [acessibilidade](acessibilidade.md)
- [Testes](testes.md), [antes e depois](antes-depois.md), [arquivos alterados](arquivos.json)

O inventário registra ${inventory.length} declarações de controles em ${modules.length} arquivos de interface. Não equivale à execução individual de todos os botões. A lista explícita de ações ainda não verificadas individualmente está em [acoes-nao-verificadas.json](evidencias/acoes-nao-verificadas.json).

Sem alterações de backend, cálculos, RBAC, migrations de produção, dados históricos, commit, push, deploy ou acesso à AWS. Fontes locais anteriores preservadas como referência; apenas os arquivos listados no manifesto receberam esta evolução. Esta entrega de UI/UX não declara prontidão para produção ou conformidade WCAG integral.
`);
write('auditoria-visual.md', `# Auditoria visual

Referência anterior preservada antes das edições em [baseline](evidencias/baseline), com hashes em [initial-files.json](evidencias/initial-files.json) e capturas em [before](evidencias/before). Leitura dos relatórios das Ondas 0, 1 e 2 e dos contratos existentes orientou a preservação funcional.

O sistema já possuía blocos claro/escuro, raio, Tailwind semântico, Radix e componentes reutilizáveis. A implementação evolui essa base, sem criar um design system ou gerenciador de tema paralelo.

| Inconsistência comprovada | Intervenção |
| --- | --- |
| Verde vivo em links e textos pequenos claros | primary-text mais escuro; verde original preservado nos preenchimentos e na marca |
| Sucesso sobre fundo sutil com contraste de 3,52:1 | Ajuste da tonalidade semântica de sucesso, validado por contraste calculado |
| Inputs brancos forçados nos filtros mesmo em tema escuro | FilterPanel e filtros do dashboard passam a usar background/input/foreground |
| Filtros, cabeçalhos de tabela e abas competiam com a sidebar em azul saturado | Superfícies neutras e seleção sutil, preservando o azul estrutural |
| Símbolo genérico G com decoração de brilho | Símbolo geométrico G e lettering GAI próprios em SVG |
| Sidebar sem recolhimento e mobile com diálogo manual | Sidebar compacta persistente e Radix para foco, Escape e scroll lock |
| Fechar menu mobile não devolvia foco ao acionador na primeira implementação | Retorno explícito ao botão; regressão real de teclado |
| Abas de projeto começavam por laudos/financeiro | Visão geral e Dashboard primeiro; todas as rotas e permissões mantidas |
| Breadcrumbs apenas textuais | Links para ancestrais válidos e semântica de navegação |
| Dois painéis sticky competindo no dashboard de projeto | Filtros deixam de disputar a posição das abas de projeto |
| Métricas com aparência de cartões clicáveis e tipografia apertada | Sem elevação ao passar o mouse; valores com quebra e números tabulares |
| Modais translúcidos e controles de fechamento pequenos | Superfícies opacas e áreas de toque maiores |
| Tabela larga sem região focável | Região nomeada, caption, scope e indicação de rolagem no mobile |
| Navegação financeira, orçamento, DRE e laudos com tratamentos distintos | Classe compartilhada section-navigation, sem mudar os links |
| Cores literais e tooltip padrão nos gráficos da DRE | Tokens de gráficos e estilos compartilhados para Recharts |
| Preferência do sistema não acompanhava mudanças posteriores | Preferência system, observação de mídia e sincronização entre consumidores/abas |
| Busca e página de listas administrativas só em memória | Parâmetros de URL, refresh e histórico |
| Aba Pagamentos/Despesas só em memória | Parâmetro tab na URL |
| Recuperação/redefinição sem feedback de erro da API | Erro visível, limpeza do sucesso antigo e possibilidade de tentar novamente |
| Perfil abria placeholder | Dados reais da sessão em página de consulta |

Não foram encontrados handlers vazios ou links href="#" usados como ação fictícia na busca de código. Três alertas heurísticos de botão sem onClick correspondem ao próprio componente Button e a dois submits de formulário, não a botões desconectados. Recursos ainda reservados permanecem explicitamente indisponíveis.

## Inventário integral de arquivos de renderização

O JSON registra controles, atributos, conexões e sinais estáticos por declaração. A varredura estática abrange todos os arquivos listados; a validação visual é representativa dos percursos documentados e não de todos os estados possíveis.

| Arquivo | Linhas | Controles | Tabelas próprias |
| --- | ---: | ---: | ---: |
${modules.map(m => `| ${m.path.replace('gai-frontend/src/', '')} | ${m.lines} | ${m.controls} | ${m.rawTables} |`).join('\n')}

[Inventário estático completo](evidencias/inventario-controles.json). Cores literais remanescentes são decoração branca em superfícies de marca e a cor editável de modelos documentais; valores de identidade de clientes não foram convertidos automaticamente.
`);
const css = fs.readFileSync(path.join(root, 'gai-frontend/src/styles/globals.css'), 'utf8');
const light = css.match(/:root\s*\{([\s\S]*?)\n  \}/)?.[1] ?? '';
const dark = css.match(/\.dark\s*\{([\s\S]*?)\n  \}/)?.[1] ?? '';
const tokens = s => Object.fromEntries([...s.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2]]));
const l = tokens(light), d = tokens(dark);
write('design-system.md', `# Design system

Fonte de verdade: src/styles/globals.css e tailwind.config.ts. A identidade principal mantém brand-ink, brand-navy, brand-green, brand-green-deep e brand-teal. Ajustes de contraste ficam nos tokens de uso, sem trocar a paleta.

| Token | Claro (HSL ou dimensão) | Escuro (herda quando ausente) |
| --- | --- | --- |
${Object.entries(l).map(([name, value]) => `| ${name} | ${value} | ${d[name] ?? value} |`).join('\n')}

Tipografia usa a pilha local existente Inter/Geist/system-ui, sem carregar fontes remotas. Títulos principais em torno de 32 px, seções em 20/24 px e corpo/controles em 14 px. KPIs usam números tabulares e quebra quando necessário. Espaçamento usa a escala Tailwind de 4 px; cartões e formulários priorizam 16–24 px.

Raio base de 12 px, variações já existentes e sombras semânticas. Botões padrão e ícones em 44 px; versão compacta em 36 px, ampliada em ponteiros de toque. Input/select/textarea em pelo menos 44 px. Foco com ring semântico e reduced-motion respeitado.

Reutilizados Button, Input, FormField, FilterPanel, MetricCard, ProgressCard, DataTable, Pagination, Tabs, ModalForm, DrawerForm, ConfirmDialog, States e Toast. GaiLogo é o único componente visual de marca novo. Contratos existentes mantidos; DataTable recebe apenas caption opcional e Topbar recebe navigationOpen opcional.

Primary é preenchimento de marca; primary-text é texto legível. Warning-foreground é texto sobre warning preenchido; warning-text é texto sobre warning-subtle. Não intercambiar esses pares. Gráficos usam chart-1 a chart-5 e mantêm fórmulas/dados originais.
`);
write('identidade-gai.md', `# Identidade GAI

Símbolo: um G aberto em grade de 48 unidades, envolvendo um módulo patrimonial independente. O módulo sugere ativo organizado, classificação e controle. Azul marinho, verde e teal vêm da paleta existente. Geometria e lettering desenhados para esta entrega, sem imagem de terceiros, gradiente ou dependência de fonte para a sigla.

| Aplicação | Arquivo |
| --- | --- |
| Horizontal claro | [gai-horizontal-light.svg](../../gai-frontend/public/brand/gai-horizontal-light.svg) |
| Horizontal escuro | [gai-horizontal-dark.svg](../../gai-frontend/public/brand/gai-horizontal-dark.svg) |
| Compacto claro | [gai-compact-light.svg](../../gai-frontend/public/brand/gai-compact-light.svg) |
| Compacto escuro | [gai-compact-dark.svg](../../gai-frontend/public/brand/gai-compact-dark.svg) |
| Símbolo e favicon SVG | [gai-symbol.svg](../../gai-frontend/public/brand/gai-symbol.svg) |
| Raster | PNG em 32, 180, 192 e 512 px na mesma pasta |

Integrado no login desktop/mobile, sidebar expandida/compacta, perfil, favicon, apple-touch-icon, application-name e identificação de produto da prévia de laudo. O header já usa a identificação contextual e não recebeu uma marca redundante. Não existe estrutura PWA/manifest neste projeto; os PNG 192/512 ficam disponíveis sem adicionar um service worker.

GaiLogo escolhe a variante clara/escura por CSS; superfícies permanentemente marinho usam a versão escura. Documentos em papel usam a versão clara. Não substitui logotipos de organizações/clientes nem regrava versões de laudos aprovadas ou arquivos históricos.

Reprodução dos vetores/raster: node docs/redesign-visual-gai-2026-10-29/brand-assets.cjs, usando Chromium local da cópia isolada. A sigla é vetorial; o descritor horizontal usa system-ui como texto SVG.
`);
write('navegacao-ux.md', `# Navegação e UX

Rotas e permissões continuam como fonte de verdade. navigationContext/navigationHref da Onda 2 permanecem responsáveis pelo transporte e pela validação do contexto, incluindo return_to restrito. Não houve mudança de autenticação, guards ou autorização de projeto.

- Visão geral e Dashboard iniciam as abas do projeto; módulos financeiros e laudos permanecem disponíveis.
- Sidebar coloca a visão geral e os projetos antes dos módulos especializados. Recolhimento persistido em gai.sidebar.collapsed; rótulos acessíveis e titles nos ícones.
- Menu mobile usa Radix Dialog, Escape, foco contido, scroll lock e retorno explícito ao acionador. Trocar de rota fecha o menu; alcançar desktop também fecha.
- Breadcrumbs oferecem ancestrais válidos. O ProjectContextLink autorizado da Onda 2 foi preservado.
- O atalho de teclado para o conteúdo move foco e rolagem sem alterar o hash da rota, preservando a identificação da aba ativa de projeto.
- Abas e retorno da Preparação preservam return_to.
- Busca/página das listas administrativas usam URL; busca substitui o histórico de digitação e paginação cria entrada de histórico.
- A vista Pagamentos/Despesas usa tab=payments ou tab=expenses, mantendo refresh e voltar/avançar.

Validação real de links diretos, índices, filtros, voltar/avançar, refresh, origem do dashboard, leitor e limites entre organizações: suíte da Onda 2 reexecutada, resultado ${summary(validation.flows)}. Novas verificações de preparação, breadcrumb e aba financeira: suíte de redesign, ${summary(validation.visual)}. As rotas reservadas não foram transformadas em funcionalidades fictícias.
`);
write('interatividade.md', `# Interatividade e cobertura

Existem ${inventory.length} declarações estáticas de controles na varredura atual. Uma declaração em map pode produzir várias instâncias; contagem estática não é quantidade de botões executados. [inventario-controles.json](evidencias/inventario-controles.json) guarda arquivo/linha, tag, label, atributos, conexão e sinais de permissão, feedback, pendência, atualização e teclado. Os sinais são heurísticos de código, não certificações.

## Correções comprovadas

| Ação | Correção | Evidência |
| --- | --- | --- |
| Abrir/fechar navegação mobile | Foco contido, Escape e retorno ao acionador | responsive modules |
| Recolher/expandir sidebar | Funcional, persistente e nomeada | responsive modules desktop |
| Alternar tema | Claro/escuro/sistema, persistência e sincronização | useTheme.test.tsx e theme persistence |
| Perfil | Consulta real de login, email, organização e perfis | theme persistence |
| Recuperar/redefinir senha | Falhas da API visíveis, retry e bloqueio enquanto envia | PasswordPages.test.tsx e invalid reset token |
| Buscar/paginar listas | Estado na URL, refresh e histórico | useListState.test.tsx; CRUD real de projeto |
| Preparação e vista financeira | Contexto e aba na URL | preparation context |
| Tabelas e filtros | Labels, foco e rolagem; valores e operações preservados | matriz responsiva e CRUD real |

## Cobertura executada por família

Playwright de redesign: login ORG_ADMIN, busca, criação e validação de projeto, paginação real de 21 registros, ordenação no dashboard, cancelamento de confirmação sem alterar o registro, CSV real, modais/drawers, menu, perfil, logout, erro real de token, temas e histórico. O conjunto das Ondas anteriores cobre leitor, CRUDs e ações críticas de contratos, orçamentos, recebíveis, DRE, laudos/documentos, campo, avaliações e conciliação; consulte os títulos exatos em testes.md.

## Ações explicitamente não verificadas individualmente

Não foram executadas todas as combinações de permissão, estado, edição, exclusão, arquivamento, reabertura, upload, falha de rede e concorrência de cada instância de controle. A lista completa, por arquivo/linha/label, está em [acoes-nao-verificadas.json](evidencias/acoes-nao-verificadas.json). Ela inclui controles cobertos apenas por renderização/screenshot ou por famílias de fluxo, sem comprovação individual. [cobertura-controles.json](evidencias/cobertura-controles.json) distingue os poucos casos com vínculo direto e conservador à execução.

Não foram afrouxadas permissões ou removidas confirmações financeiras/patrimoniais. Handlers vazios e falsos sucessos não foram adicionados. Operações não implementadas continuam com indisponibilidade explícita; perfil deixou de ser placeholder.
`);
write('temas.md', `# Temas claro, escuro e sistema

Uma única preferência gai.theme, com valores light/dark/system; ausência ou valor desconhecido usa o sistema. O script no head aplica classe e color-scheme antes do módulo React. O hook existente foi evoluído com useSyncExternalStore: mídia, storage entre abas e evento local sincronizam os consumidores sem estados divergentes. Storage bloqueado tem fallback de memória.

Menus/diálogos em portals herdam tokens do html. Inputs não são mais forçados a branco pelo FilterPanel. Cards, tabelas, filtros, modal, drawer, toast, dropdown, foco, logo e Recharts seguem o tema. Tooltips de terceiros recebem superfície e texto semânticos. Gráficos deixam de animar, também evitando movimento que CSS reduced-motion não controlaria.

Prévia de laudo continua como papel branco com texto escuro: é conteúdo documental deliberado, não superfície da aplicação. A marca do produto foi integrada apenas na identificação GAI já existente da prévia. Cores editáveis do documento e identidades de clientes permanecem preservadas.

Contraste calculado de ${contrast.length} pares na execução atual: [contrast.json](evidencias/visual/contrast.json). Isso valida os pares especificados, não todas as composições, transparências, gráficos ou combinações possíveis da aplicação.
`);
write('responsividade.md', `# Responsividade

Matriz exigida: 360, 390, 768, 1024, 1366 e 1920 px, nos temas claro e escuro. Altura de 900 px nos testes. Foram registrados ${observed.length} percursos de página com medidas de viewport/documento e controles visíveis em observed-*.json.

Em 360 e 1366 px, a matriz percorre projetos, resumo, dashboard, itens, sessões de inventário, base contábil, preparação, campo, contratos, orçamentos, financeiro do projeto, laudos, recebíveis, caixa, DRE, usuários, perfis e empresas. Nos demais tamanhos, valida projetos, dashboard de projeto e recebíveis. Login, drawer de projeto e navegação também têm capturas próprias em 390 e 1366 px.

Sidebar de desktop a partir de 1024 px; abaixo disso, diálogo mobile. Abas de projeto e seções rolam horizontalmente. Tabelas largas mantêm todas as colunas e ações em uma região rolável/focável; indicação de gesto no mobile. Formulários preservam todos os campos e drawers podem ocupar a largura inteira no celular.

Teste adicional de toque real emulado em 360, 390, 768 e 1024 px nos dois temas: coarse pointer, todos os 27 alvos de UF com pelo menos 44×44 px, filtro SP acionado por tap e menu aberto/fechado por toque. Cards estreitos trocam a geometria do cartograma por uma grade alfabética de UFs mediante container query; nenhuma UF é removida. Rótulos dos pontos usam superfície opaca para não perder contraste sobre a intensidade do mapa. Evidência em touch.json e touch-map-*.png.

A matriz exige document.scrollWidth <= viewport + 1 px; rolagem interna intencional de tabelas/abas é permitida. Não se oculta coluna ou ação essencial para obter aprovação. Screenshots e medições não certificam todo dispositivo, zoom, conteúdo extremo ou teclado virtual.
`);
write('acessibilidade.md', `# Acessibilidade

Melhorias alinhadas a WCAG 2.2 AA, sem alegação de conformidade integral.

- Contraste semântico medido, com correção de textos verdes/sucesso e distinção entre aviso preenchido e sutil.
- Foco visível, link para pular ao conteúdo e um landmark main no layout autenticado.
- Diálogos e menu mobile com semântica Radix, Tab contido e Escape; retorno de foco explicitamente verificado.
- Navegação e breadcrumbs nomeados; rota atual identificada.
- Busca com nome acessível, labels existentes preservados, indicador visual de obrigatório sem alterar o nome acessível e aria-describedby composto.
- Caption/scope em DataTable e região de rolagem focável.
- Feedback de erro com role=alert, carregamento/status e ações pendentes desabilitadas.
- Controles padrão/toque em 44 px; alvos compactos mantidos no desktop.
- prefers-reduced-motion respeitado no CSS e animação de séries Recharts desabilitada.

## Contrastes medidos

| Tema | Texto / fundo | Razão |
| --- | --- | ---: |
${contrast.map(c => `| ${c.theme} | ${c.text} / ${c.background} | ${c.ratio.toFixed(2)}:1 |`).join('\n')}

Os pares de texto usam limiar 4,5:1. A inspeção inclui teclado real em Chromium, screenshots e verificações de semântica compartilhada. Não foi feita certificação externa, auditoria completa com leitor de tela, zoom de 400%, toda condição de erro ou todos os estados de gráficos. Mapa, tabelas próprias e formulários especializados têm cobertura representativa; consulte ações não verificadas individualmente.
`);
write('testes.md', `# Testes e reprodução

| Conjunto | Resultado |
| --- | --- |
| Backend padrão: 113 suítes | ${summary(validation.backend)} |
| MySQL real descartável | ${summary(validation.mysql)} |
| Frontend Vitest | ${summary(validation.frontend)} |
| Playwright UI/tema/responsividade | ${summary(validation.visual)} |
| Playwright fluxos reais/Onda 2 | ${summary(validation.flows)} |
| Rechecagem final de teclado/URL (casos já contados acima) | ${summary(validation.navigationRecheck)} |

TypeScript de app/config do frontend, Vite, ESLint global; TypeScript, Nest build e ESLint global do backend têm logs e arquivos *-result.json. O backend não recebeu alterações. O build frontend mantém o aviso preexistente de chunk maior que 500 kB; nenhum limite foi elevado para ocultá-lo.

## Casos Playwright de redesign

${validation.visual.cases.map(c => `- ${c.status}: ${c.title}`).join('\n')}

## Fluxos reais reexecutados

${validation.flows.cases.map(c => `- ${c.status}: ${c.title}`).join('\n') || '- Ainda sem resultado.'}

## Isolamento

Cópias próprias de fontes/dependências em evidencias/workspace, ignoradas pelo Git. Pacotes vieram da instalação isolada validada na Onda 2; sem reinstalar dependências originais. Configurações .env privadas não integram a baseline entregue. Nenhum banco 3306 ou API 3000 é alvo de teste.

MySQL: container descartável já existente gai-wave2-20261029-mysql, 127.0.0.1:33347. Regressão usa gai_validation_disposable; navegador usa gai_navigation_disposable. O harness valida o opt-in, alvo fixo, credenciais sintéticas e schema antes de recriar tabelas/migrations. API Nest em 33349; Vite preview em 33350; reuso de servidores desativado. Storage em memória no harness de navegador é explícito; não representa revalidação S3/AWS.

Fixture adicional de UI: um item sintético para o dashboard; vinte projetos via API e um via formulário, mínimo para testar paginação real de 20 linhas. Demais fluxos usam as fixtures sintéticas existentes. Não houve edição de dados históricos/persistentes.

Na raiz: node docs/redesign-visual-gai-2026-10-29/validate.cjs sync; depois modos frontend-checks, backend-checks, frontend, default, mysql, visual e e2e. visual pressupõe build atualizado. Não executar dois modos de navegador simultaneamente: ambos usam as mesmas portas e schema sintético. init preserva baseline uma única vez e recusa sobrescrevê-la.

## Tentativas e correções

Logs/resultados anteriores preservados em evidencias/attempts. A primeira captura foi bloqueada pela sandbox ao carregar esbuild; o servidor descartável foi identificado e encerrado antes de repetir. Jest não descobriu testes sob .local; a cópia foi movida para evidencias/workspace, sem relaxar o runner. Dois labels tiveram o nome acessível alterado pelo asterisco e foram corrigidos. O teste de lista recebeu MemoryRouter para a nova persistência de URL. Capturas iniciais em Vite dev tiveram reload de otimização de dependências; a validação final usa preview do build. Contraste de sucesso e semântica de aviso foram corrigidos. O teste mobile detectou retorno de foco ausente e motivou correção explícita. Resultados intermediários não são aceites finais.

Rechecagem final de quatro casos já existentes (teclado, navegação, contraste/tooltips e toque) após impedir que o skip link altere o hash da rota e reforçar alvos de toque compactos; não é somada como quatro fluxos novos. Tooltips reais do gráfico de status foram abertos nos dois temas, com cores de texto verificadas em tooltip-checks.json e capturas próprias. Um log de manutenção de exportações com "Pool is closed" no encerramento de fixture MySQL ocorreu tanto nesta rodada como na Onda 2 anterior (uma ocorrência em cada). Não houve falha dos 325 testes; não foi alterado o backend para tratar esse log de shutdown do harness.
`);
write('antes-depois.md', `# Antes e depois

Comparação de dados sintéticos equivalentes, no mesmo tamanho/tema. Screenshots anteriores vieram da cópia de fontes preservada antes das edições. Os posteriores usam o build de preview. Capturas são evidência de aparência e não substituem os testes funcionais. Não foi usada comparação automatizada com tolerância ou baseline de pixels.

## Projetos · claro · 1366 px

Antes:

![Projetos antes](evidencias/before/projects-light-1366.png)

Depois:

![Projetos depois](evidencias/visual/projects-light-1366.png)

## Projetos · escuro · 390 px

Antes:

![Projetos mobile antes](evidencias/before/projects-dark-390.png)

Depois:

![Projetos mobile depois](evidencias/visual/projects-dark-390.png)

## Login · claro · 1366 px

Antes: [login anterior](evidencias/before/login-light-1366.png). Depois: [login com marca GAI](evidencias/visual/login-light-1366.png).

## Outras inspeções

Sidebar compacta: collapsed-*.png. Menu mobile: navigation-*.png. Portals: modal-*.png e theme-menu-dark.png. Módulos: module-*.png, com índice/rota registrados em observed-*.json. Laudos, DRE e documentos com dados e downloads estão também nos artefatos da suíte e2e.

Mudanças visíveis: marca própria, verde legível nos links, azul concentrado na estrutura, filtros neutros, tabelas e cartões menos pesados, hierarquia de navegação e formulários consistentes. Nenhum valor foi alterado para favorecer a comparação visual.
`);
console.log(JSON.stringify({ validation, controls: inventory.length, pagesObserved: observed.length, unchangedFiles: preservation.filter(e => e.unchanged).length }, null, 2));
