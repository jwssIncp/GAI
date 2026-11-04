# Resolução dos conflitos do PR #9

## Contexto e estratégia

- PR: https://github.com/jwssIncp/GAI/pull/9 (aberto).
- Origem: `feature/gai-ajustes-homologacao`, inicialmente `d67b7ae17a0e8289237070634a9387b4cceef7b6`.
- Destino identificado pela API do GitHub: `develop`, `b0c2b0d74f8fe4a79d26a21149f513232853e1cb`.
- Ancestral comum: `fa068e06f66d63760a0dd67389826e0d3c6f962b`.
- Diagnóstico: branch limpa e sincronizada antes do merge; um commit exclusivo da origem e oito do destino.
- Merge convencional de `origin/develop` na própria feature, sem rebase, force push ou troca de branch.
- 32 arquivos conflitantes. Ambas as versões foram comparadas por arquivo; decisões abaixo.

## Decisões por arquivo

| Arquivo | Resolução e motivo |
| --- | --- |
| `.github/scripts/prepare-document-task.cjs` | Incorporada a versão de develop: configura bucket, tipos MIME e armazenamento; mantém limites de CPU/memória e validações. Transformação local, sem execução AWS. |
| `.github/scripts/prepare-document-task.test.cjs` | Incorporados cinco testes de develop, incluindo ausência de bucket e idempotência. |
| `.github/workflows/ci.yml` | Preservadas as integrações MySQL/S3 e a execução dos testes de credenciais da feature. Develop não acrescentava cobertura exclusiva neste arquivo. |
| `docs/auditoria-integrada-gai-2026-10-28/inspect-payment-race.cjs` | Mantidas credenciais de runtime, sem senha local embutida. |
| `docs/auditoria-integrada-gai-2026-10-28/race-payments.cjs` | Mantidas credenciais de runtime e cenário de concorrência. |
| `docs/auditoria-integrada-gai-2026-10-28/run-browser.cjs` | Mantidas credenciais de runtime e configuração das fixtures descartáveis. |
| `docs/auditoria-integrada-gai-2026-10-28/run-mysql.cjs` | Mantidas credenciais externas e isolamento do ensaio MySQL. |
| `docs/correcoes-onda-0-financeiro-2026-10-28/probe.cjs` | Preservada a correção de credenciais da feature e o probe financeiro. |
| `docs/correcoes-onda-0-financeiro-2026-10-28/race-original.cjs` | Preservado o cenário financeiro e a versão revisada da feature; diferença residual de formatação. |
| `docs/correcoes-onda-0-financeiro-2026-10-28/run.cjs` | Mantidas credenciais externas e as fixtures correspondentes. |
| `docs/correcoes-onda-1-integridade-2026-10-28/probe.cjs` | Mantidas credenciais externas e verificações de integridade. |
| `docs/correcoes-onda-1-integridade-2026-10-28/smoke-related.cjs` | Mantidas credenciais externas e cobertura relacionada. |
| `docs/implementacao-documentos-profissionais-2026-10-28/README.md` | Preservado exemplo que recebe a senha do ambiente. |
| `gai-backend/.env.example` | Segredos de seed vazios, senha independente de ORG_ADMIN e opções de convite/senha temporária preservados. |
| `gai-backend/src/modules/projects/application/dto/create-project.dto.ts` | Preservados campos de cadastro, validação JSON e organização opcional no DTO para derivação segura no backend. |
| `gai-backend/src/modules/projects/application/dto/update-project.dto.ts` | Preservados campos recentes e controle de edição concorrente por `expected_updated_at`. |
| `gai-backend/src/modules/projects/infrastructure/persistence/project.entity.ts` | Preservados código, tipo, responsáveis, planejamento e índices recentes. |
| `gai-backend/src/scripts/seed/ensure-platform-admin.ts` | Preservados transação, locks, auditoria, política de senha e rotação com revogação. A rotação já limpa tentativas/bloqueio temporário; não reativa contas administrativamente inativas. |
| `gai-backend/test/integration/technical-validation/generated-metadata.mysql.e2e-spec.ts` | Contagem dinâmica das migrations carregadas, sem restaurar constante antiga de 33. |
| `gai-backend/test/integration/test-app.helper.ts` | Mantidas fixtures sintéticas isoladas e senhas de runtime quando usadas pelo navegador. |
| `gai-backend/test/unit/modules/branch-coverage.spec.ts` | Mantidos os testes atuais; quatro casos exclusivos de develop foram portados para `test/integration/auth/merged-authentication.e2e-spec.ts`, exercitando persistência e autenticação reais. |
| `gai-frontend/e2e/integration-navigation-real.spec.ts` | Mantida leitura das credenciais do ambiente. |
| `gai-frontend/e2e/redesign-real.spec.ts` | Mantida leitura das credenciais do ambiente. |
| `gai-frontend/playwright.real.config.ts` | Preservada validação das credenciais e configuração das fixtures de runtime. |
| `gai-frontend/playwright.redesign.config.ts` | Preservada validação das credenciais e configuração das fixtures de runtime. |
| `gai-frontend/src/components/base/SearchInput.tsx` | Preservado `id` encaminhado ao input para associação acessível de labels. |
| `gai-frontend/src/features/auth/PasswordPages.test.tsx` | Preservados testes com senha sintética válida para a política atual. |
| `gai-frontend/src/features/auth/PasswordPages.tsx` | Preservada política compartilhada de 15 a 128 caracteres e mensagens correspondentes. |
| `gai-frontend/src/features/auth/ProfilePage.tsx` | Preservados nome completo e navegação para troca da senha. |
| `gai-frontend/src/features/projects/ProjectsPage.tsx` | Preservados cadastro/edição dedicados, filtros, indicadores, campos novos, retorno contextual e permissões. A versão de develop era anterior a esses recursos. |
| `gai-frontend/src/layouts/Sidebar.tsx` | Preservado acesso ao cadastro de projetos para perfil com permissão de criar sem listar. |
| `gai-frontend/src/router/router.tsx` | Preservadas rotas protegidas recentes de usuários, empresas e projetos e rotas públicas de ativação/troca de credenciais. |

## Alterações complementares do destino

Foram mantidos os merges automáticos de `.github/scripts/ecs-update-service.sh`, `.github/workflows/deploy-app.yml` e `infra/terraform/parameters.tf`: verificação de estabilidade na revisão ECS esperada e publicação do identificador do bucket de assets. Esses arquivos foram revisados, sem executar deploy, Terraform ou comandos AWS.

Também foram incorporados `docs/LOCAL_VALIDATION_ARTIFACTS.md` e as regras complementares de `.gitignore`. Quatro screenshots gerados antigos removidos por develop permanecem removidos; código e relatórios técnicos foram preservados.

## Garantias funcionais

`ProjectScopeService.resolveOrganizationForCreate` deriva a organização do usuário autenticado para ORG_ADMIN, aceita omissão do campo e rejeita outra organização. O use case valida empresa e responsáveis no tenant e registra auditoria. Os testes de cadastro cobrem adulteração, edição concorrente e ausência de escritas indevidas.

Foram mantidos os módulos financeiros/patrimoniais, transações, concorrência, isolamento por organização, permissões, ciclo de vida dos usuários, primeira troca de senha, recuperação e revogação de sessões. Os quatro testes de autenticação portados verificam estados de conta/organização, envio de recuperação com hash do token, login autorizado e rotação com consumo único/revogação.

## Validação

Resultados já concluídos:

| Verificação | Resultado |
| --- | --- |
| Lint backend e frontend | Aprovados |
| TypeScript backend completo | Aprovado (`tsc --noEmit --incremental false`) |
| Build backend | Aprovado |
| TypeScript e build frontend | Aprovados (`tsc -b && vite build`) |
| Testes frontend | 335 aprovados, nenhuma falha |
| Testes backend completos | 802 aprovados em 121 suítes, nenhuma falha; 4 casos condicionais omitidos nesse modo |
| Integração MySQL completa | 415 aprovados em 51 suítes, nenhuma falha ou omissão |
| Testes dos scripts de deploy/credenciais | 8 aprovados |
| Integração S3 local descartável | 7 aprovados |
| Casos de autenticação portados | 4 aprovados com banco real de teste; também incluídos nas suítes completas |
| Navegador: usuários | 2 aprovados |
| Navegador: empresas | 1 aprovado, ciclo completo de cadastro, edição, consulta, desativação e reativação |
| Navegador: projetos | 6 aprovados, desktop/tablet/mobile nos temas claro/escuro |
| Sintaxe do helper ECS | Aprovada com `bash -n`, sem execução do helper |
| Sintaxe YAML de CI/deploy/infra | 3 workflows analisados sem erro |
| Auditoria estática de migrations | 36 classes e timestamps únicos, métodos up/down presentes, sem inconsistências detectadas |
| Execução das migrations em MySQL | Aprovada em banco descartável; testes de metadados, índice único e idempotência aprovados |
| Auditoria de segurança do índice | Sem correspondências com segredos locais, padrões de chaves/tokens, arquivos de ambiente reais ou marcadores de conflito |

Todos os casos presentes na última publicação foram encontrados nas novas execuções de backend, frontend e MySQL, sem remoções. Os quatro casos omitidos no modo SQLite passaram no MySQL: concorrência de permissões/último administrador, identificadores de cadastro, recuperação versus login e consumo único de ativação. Os quatro testes portados de develop também passaram nesse motor.

Na primeira tentativa adicional de navegador, empresas excedeu o limite global de 30 segundos ao final do fluxo, e projetos encontrou ausência do schema específico no container descartável. O schema foi criado somente nesse container e os mesmos cenários foram repetidos com limite de 120 segundos, sem alterar asserções nem o código dos testes. Todos passaram. Os 64 arquivos de evidência previamente versionados foram preservados e restaurados após a geração transitória dos testes.

A evidência de concorrência financeira regenerada pela suíte MySQL foi preservada em `.local/pr9-mysql-concurrency-after.json`, e a versão histórica do documento foi restaurada. Os três containers descartáveis desta validação foram encerrados. Os containers persistentes `gai-mysql` e `gai-local-storage-storage-1` permaneceram ativos.

O build frontend emitiu o aviso já existente de tamanho de chunks. Não houve falha de compilação.

As integrações usaram exclusivamente MySQL e S3 locais descartáveis nas portas 33337 e 33318; o navegador de projetos usou outro MySQL descartável na porta 33347. Os serviços persistentes locais e ambientes de produção não foram alvos dessas execuções.

## Publicação

O commit terá dois pais, correspondentes à origem e ao destino acima. O push será exclusivamente para `origin/feature/gai-ajustes-homologacao`. Este trabalho não realiza merge do PR em develop.

O relatório descreve o conteúdo e as validações locais do merge. O hash publicado e a situação posterior do PR são conferidos após o push e informados na entrega, sem declarar antecipadamente a aprovação da CI remota. Os workflows de deploy dependem de acionamento manual; nenhum foi acionado neste trabalho.
