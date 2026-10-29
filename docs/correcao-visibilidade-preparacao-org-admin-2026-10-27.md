# Preparação visível para ORG_ADMIN — validação local

27/10/2026, America/Sao_Paulo. Resultado: corrigido no ambiente local e validado em Chromium autenticado com `org.admin`.

## Causa raiz confirmada

O backend e o frontend já executavam a implementação atual, mas o banco de desenvolvimento estava na migration 22. `CreateProjectPreparation1793100000001` era a única pendente. As cinco tabelas do módulo e as permissões `project-preparation:read`, `project-preparation:edit` e `project-preparation:approve` não existiam.

Antes da correção, um login real de ORG_ADMIN retornou uma lista de permissões sem essas três entradas. O `PermissionGate` ocultava a opção **Preparação** no workspace e o `ProtectedRoute` bloqueava sua rota. A API retornava 403 em `/projects/1/preparations` e `/organizations/1/preparation-templates`: o PermissionsGuard exige catálogo válido antes do bypass organizacional. Não era erro no reconhecimento do ORG_ADMIN, rota ausente nem necessidade de ampliar permissões no frontend.

## Inspeção realizada

- Lido `docs/implementacao-preparacao-projetos-2026-10-27/README.md`.
- `gai-frontend/src/router/router.tsx`: rota protegida `/app/projects/:projectId/preparation/:kind`, com redirecionamento da raiz para `kickoff`.
- `ProjectSummaryPage.tsx`: link **Preparação** no `WorkspaceTabs`, condicionado a `project-preparation:read`.
- `ProjectPreparationPage.tsx`: abas Kick-off e Checklist do Cliente; botões de edição/aprovação controlados por permissão e status do projeto.
- `TemplateManager`, `PreparationForms`, queries e componentes compartilhados: interface existente reutilizada; nenhuma tela ou rota duplicada.
- `PreparationService`, controllers, ProjectScopeService, permission resolver e PermissionsGuard: organização/projeto verificados e permissões específicas preservadas.
- Estado servido: GET do módulo Vite `/src/router/router.tsx` contém a rota e `ProjectPreparationPage`; OpenAPI real contém 12 caminhos de preparação. API em watch na porta 3000 e Vite na 5173 correspondem ao código atual. Logs stderr da API sem erro na validação.

## Banco e correção

Antes de executar a migration, foram confirmados explicitamente:

| Campo | Destino |
|---|---|
| NODE_ENV | local |
| DB_HOST / DB_PORT | localhost / 3306 |
| DATABASE() | gai |
| hostname MySQL | f10269ba8da4 |
| Estado inicial | 22 migrations; nenhuma tabela/permissão de preparação |

`npm.cmd run migration:show` confirmou uma única pendência. Em seguida, `npm.cmd run migration:run` aplicou somente `1793100000001-create-project-preparation.ts`, com COMMIT e saída 0. Estado final: **23 migrations aplicadas, nenhuma pendente**, cinco tabelas novas e três permissões de escopo ORGANIZATION. Nenhum reset, rollback, seed global, remoção de dados existentes ou acesso a produção.

Após a migration, novo login ORG_ADMIN retornou as três permissões e os dois endpoints antes bloqueados retornaram 200. Não foi necessário alterar guard, autenticação, rotas, layout ou concessões de usuários.

## Arquivos desta correção

- `scripts/local-check-migrations.cjs` — preflight somente de leitura, exclusivo para NODE_ENV=local/host loopback, compara migrations do código com o banco; falha com destino e instrução quando há pendências. Não aplica migrations. Aguarda conexão MySQL durante o boot.
- `scripts/local-start.ps1` — chama o preflight antes de iniciar os servidores, impedindo que um banco desatualizado resulte silenciosamente em módulos ocultos. Checagem real aprovada: 23 aplicadas, nenhuma pendente.
- Este relatório.
- Artefatos locais ignorados: `.local/preparation-diagnose.cjs`, `.local/preparation-org-admin.cjs` e `.local/preparation-visibility/` com fixture, resultados JSON e screenshots. O teste visual cria registros identificados como SINTETICO e deixa-os disponíveis para inspeção. Uma primeira tentativa do script falhou somente ao recuperar o corpo da resposta via protocolo do Chromium; a captura foi ajustada para ler a sessão produzida pelo login normal. A execução completa seguinte passou.

Os demais arquivos da implementação já estavam modificados antes desta correção e foram preservados. Nenhum commit, push ou deploy.

## Permissões

- ORG_ADMIN: read, edit e approve reconhecidas pelo resolver a partir do catálogo organizacional; permite modelos, respostas, edição, aprovação e reabertura dentro de sua organização e respeita estados bloqueados do projeto.
- Perfis customizados/ORG_USER: sem concessão automática. `test.user` continuou com zero permissões de preparação e GET real retornou 403.
- Guard permanece estrito: permissão desconhecida/ausente no catálogo nega acesso inclusive administrativo.
- Isolamento: 42 testes direcionados passaram em duas suítes (política + integração HTTP), incluindo negativas de organização, hierarquia, catálogo ausente, read-only, edit sem approve, obrigatórias, revisão, status e persistência. Integração usou SQLite em memória via helper, sem schema reset no banco local. O ensaio visual real usou MySQL local; não criou uma segunda organização no banco persistente.

## Navegação e persistência reais

Executado Playwright/Chromium headless, sem interceptar/mocar endpoints, autenticando `org.admin` pelo formulário normal. Criados empresa sintética ID **2** e projeto sintético ID **2**, da organização 1. O projeto anterior ID 1 não foi alterado.

Resultados para **ambos** os tipos:

1. Lista de projetos aberta pelo menu e projeto sintético aberto pelo link.
2. Link **Preparação** encontrado e clicado no workspace.
3. Abas **Kick-off** e **Checklist do Cliente** acessadas.
4. Modelo em branco criado pela interface (HTTP 201).
5. Instância criada pela interface (HTTP 201): Kick-off ID **1**, Checklist ID **2**.
6. Resposta de texto salva (HTTP 200), página recarregada e texto conferido na interface e via GET real.
7. Título editado por “Responsáveis e datas”.
8. Preparação aprovada e reaberta pelos botões e confirmação da interface; estados `approved` e `in_progress` conferidos via API.
9. **Zero pageerrors e zero respostas HTTP >=400** no fluxo visual bem-sucedido. Screenshots finais inspecionados visualmente, identidade existente preservada.

Evidências locais: `.local/preparation-visibility/results.json`, `fixture.json`, `kickoff.png`, `kickoff-persistido.png`, `client-checklist-persistido.png`. Reexecução: `node .local/preparation-org-admin.cjs` (gera novos registros sintéticos). Testes direcionados: em `gai-backend`, `npm.cmd test -- --runInBand test/integration/project-preparation/project-preparation.e2e-spec.ts test/unit/modules/project-preparation/preparation.policy.spec.ts`.

## URLs e uso

- Sistema: http://localhost:5173
- Projeto sintético validado: http://localhost:5173/app/projects/2/summary
- Kick-off: http://localhost:5173/app/projects/2/preparation/kickoff
- Checklist do Cliente: http://localhost:5173/app/projects/2/preparation/client-checklist
- Projeto existente: http://localhost:5173/app/projects/1/preparation/kickoff e http://localhost:5173/app/projects/1/preparation/client-checklist (listas inicialmente vazias, sem criar dados nesse projeto).
- Swagger: http://localhost:3000/api/docs

API, frontend, MySQL e storage local mantidos em execução. Se a aba já estava aberta antes da migration, **recarregue a página ou saia e entre novamente**: o estado React anterior conserva as permissões recebidas antes da atualização; restauração da sessão consulta `/auth/me` e recebe o catálogo atualizado.

## Pendências

Nenhum bloqueio encontrado para Kick-off e Checklist no ORG_ADMIN. Não foi executada homologação de todos os módulos do sistema nem teste visual com uma segunda organização; isolamento e perfis restritos têm cobertura da integração direcionada. Nenhuma permissão foi concedida indiscriminadamente. Os registros sintéticos foram preservados para revisão, sem apagar dados.
