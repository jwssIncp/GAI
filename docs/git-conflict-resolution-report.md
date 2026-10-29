# Consolidação Git — 26/10/2026

## A. Diagnóstico inicial

Branch `feature/gai-ajustes-homologacao`, HEAD `fa068e06`, idêntico à
`develop` local. Esta está três commits à frente de `origin/develop`.
As referências remotas locais não foram atualizadas por fetch.
`origin/master...origin/develop` mostra três merges exclusivos de origin/master.
`master` local permanece em `41532a5dfc3cda2d4e97604b9885792c35015b6f`.
O stash preservado é `stash@{0}`, criado nessa master.
Os blobs stage 2 correspondem ao HEAD de destino e os stage 3 ao trabalho
recuperado. Havia quatro conflitos, uma entity preparada e quatro arquivos novos.
Não havia merge de branches em andamento.

## B. Resoluções

- `1741400000001-close-inventory-operation-gaps.ts`: comparadas integralmente
  as versões. A develop consulta information_schema, cria duas colunas
  condicionais, tabela com seis FKs e índice único utf8mb4 de prefixo 768.
  O stash usa hasColumn/hasTable, ASCII binário e índice integral; também
  condiciona o down. Colunas, tipos, defaults, FKs e demais índices coincidem.
  Preservada a migration histórica da develop sem alterações. Suas guardas de
  colunas já permitem retomar o DDL parcial conhecido; não foi incorporado
  hasTable, pois ignoraria uma tabela existente de estrutura incompatível.
  O down histórico remove a tabela antes das colunas, sendo destrutivo por
  definição e destinado apenas a rollback deliberado. Não foi executado.
- `expense-accountabilities.service.ts`: preservados escopo organizacional,
  projeto, agente, período, estado aberto, transação e auditoria. Incorporado
  o catch do stash para converter exclusivamente ER_DUP_ENTRY/1062 da
  constraint `uq_expense_accountability_items_expense` em 409. Outros erros
  continuam propagados. Removidas as asserções não nulas desnecessárias do
  stash, mantendo o narrowing da develop e o helper notFound(): never.
- `new-operations-migrations.spec.ts`: preservados testes anteriores,
  expectativa do índice histórico, retry com colunas já existentes e novos
  testes da migration complementar e recusa antes de DDL inseguro.
- `OrganizationsPage.tsx`: preservada integralmente a develop. A versão
  simples do stash só listava/criava, com permissão de criação; não oferece
  funcionalidade exclusiva ausente na tela atual. A develop mantém criação,
  edição, detalhe, ativação, filtros, paginação, estados e permissões, além
  do formulário separado com normalização e validação de CNPJ/telefone.
  Os testes existentes cobrem esses comportamentos e foram mantidos.

## C. Migrations e dados

Criada `1793000000001-fix-evidence-storage-key-index.ts`, posterior às demais.
O histórico Git mostra alterações anteriores da migration original e o
relatório do stash declara sua execução em homologação. Isso é indício de
implantação, não confirmação independente da tabela de migrations.
Nenhum banco configurado foi acessado para verificar execução em produção.

A nova migration converte somente storage_key para ASCII/ascii_bin e troca
o UNIQUE de prefixo pelo integral (1024 bytes), mantendo tabela, dados, FKs
e índices restantes. O gerador atual de caminhos produz ASCII. A verificação
prévia recusa dados não ASCII, evitando conversão silenciosa. Um único ALTER
troca coluna/índice, sem mascarar esquema ausente/incompatível. Aplica também
em esquema de homologação já ASCII. O down verifica colisões por prefixo e
collation legada antes de reverter. Não remove tabelas ou colunas.

Riscos: DDL MySQL tem commit implícito e pode bloquear a tabela; verificar
backup, dados legados, divergência de esquema e execução em MySQL isolado
antes de implantação. Não há comprovação de execução SQL desta nova migration.
Entity mantém charset/collation fora dos metadados para compatibilidade SQLite;
produção deve continuar com synchronize desabilitado.

## D. Validação atual

Comandos Git: status, branch -vv, stash list, ls-files -u, diff --cc,
comparação dos stages completos, log --left-right origin/master...origin/develop,
log de histórico da migration, diff develop, diff --check e diff --cached --check.

As tentativas iniciais usaram os scripts de package.json (`npm.cmd run build`,
`npm.cmd test`). Como houve atalhos incompatíveis ou execuções sem progresso,
foram usadas diretamente as mesmas ferramentas locais via Node, sem instalar
dependências. O npm exec Prettier na raiz foi interrompido; usou-se o Prettier
local do backend. Não houve mudança de lockfiles.

- Backend: `node node_modules/@nestjs/cli/bin/nest.js build` aprovado.
- Backend: `node node_modules/jest/bin/jest.js --runInBand` aprovado:
  91 suites, 371 testes, incluindo integrações em SQLite em memória,
  em 242,545 segundos. A execução começou antes da ampliação final do teste
  negativo do serviço; os três arquivos afetados foram reexecutados ao final.
- Backend: Jest focado com `--runInBand` para new-operations-migrations,
  expense-accountabilities.service e inventory-operation.entity: 3 suites,
  11 testes aprovados. Inclui erro concorrente convertido e erro alheio
  propagado. Uma execução intermediária revelou erro na expectativa do novo
  teste negativo; corrigido, sem alterar a regra do serviço.
- Backend: `node node_modules/typescript/bin/tsc --noEmit` falhou em testes
  fora da alteração: test-app.helper (implicit any), branch-coverage (spread),
  domain-entities (mock PermissionResolver), brazilian-contact e
  update-project.use-case (tipagem de fixtures).
- Backend: ESLint geral, com o glob do script e sem --fix para evitar
  alterações alheias, encontrou formatação em ensure-platform-admin,
  payments-expenses.e2e-spec e organization-scope-services.spec. A formatação
  dos arquivos novos/consolidados foi corrigida pelo Prettier; ESLint focado
  em migration nova, service e testes de migration aprovado.
- Frontend: `node node_modules/typescript/bin/tsc -b --pretty false` aprovado.
- Frontend: `node node_modules/eslint/bin/eslint.js .` aprovado.
- Frontend: Vite build e Vitest falham antes de executar por ausência de
  `@rollup/rollup-win32-x64-msvc`. Os scripts npm também não encontram tsc,
  vite e vitest nos atalhos locais do Windows.
- Frontend: `node node_modules/@playwright/test/cli.js test` bloqueado na
  inicialização do webServer: vite não reconhecido. Nenhum E2E foi aprovado.
- MySQL: `docker info` não conecta ao daemon; não há ambiente Docker isolado
  disponível. Não foram executadas migrations em bancos reais.

O E2E real foi preservado e passou a obter login/senha de GAI_E2E_LOGIN e
GAI_E2E_PASSWORD, exigidos junto de GAI_REAL_E2E=1. Continua dependente das
fixtures específicas (projeto/sessão 1 e item ABC004) da stack descartável.
O relatório antigo foi identificado como histórico; suas métricas, auditoria
e resultados MySQL não são evidência desta revisão.

## E. Estado e revisão

Os quatro caminhos foram marcados como resolvidos no índice. A migration
histórica e a tela coincidem com develop, portanto não aparecem no diff final.
Mudanças funcionais rastreadas: service, entity e testes de migrations.
Preservado o mapeamento evidenceSnapshot -> evidence_snapshot do stash,
coerente com a coluna da migration de inventário, e seu teste de regressão.
Novos: migration complementar, este relatório, relatório histórico,
dois testes unitários e E2E real. Nenhum teste existente foi excluído.

Artefatos rastreados de Playwright/tsbuildinfo regenerados nesta validação
foram restaurados aos conteúdos iniciais. Não incluir artefatos, logs,
credenciais ou .env no commit. Nenhum commit, push, merge, descarte de stash
ou alteração de master foi realizado. Não foram instaladas dependências.

Recomenda-se revisar a migration complementar, reparar a instalação de
dependências Windows, concluir frontend/MySQL e resolver falhas gerais de
qualidade antes de commit e PR para develop. Aprovação integrada permanece
parcial, sem recomendação de implantação em produção.

Verificação final: nenhum caminho unmerged ou marcador de conflito nos
diretórios de código/testes; diff --check e diff --cached --check sem erros.
master e stash conferidos novamente e preservados. Arquivos novos permanecem
locais, não rastreados, para revisão; resoluções rastreadas estão preparadas.
