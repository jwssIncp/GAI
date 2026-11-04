# Testes executados e limites

<!-- ONDA-1-STATUS -->
## Atualização da Onda 1 — 29/10/2026

Implementação e validação local concluídas; **produção não liberada**. [Relatório da Onda 1](../correcoes-onda-1-integridade-2026-10-28/README.md). GAI-002/003/004/008/009 corrigidas e validadas; GAI-011 corrigida para novas operações UTC, com histórico pendente de análise; GAI-012 parcialmente remediada (7 alertas backend e 1 frontend em --omit=dev). GAI-001/010 preservadas e revalidadas; GAI-005/006/007 continuam abertas.

Padrão 683/683, MySQL 307/307, S3 7/7, frontend 247/247, navegador 2/2; zero skips nas rodadas finais. Cobertura original e lint global aprovados. Não somar reexecuções. **O texto anterior abaixo é histórico preservado**, incluindo a atualização da Onda 0 e as reproduções originais.
<!-- /ONDA-1-STATUS -->


## Atualização após a Onda 0 financeira — 28/10/2026

**GAI-010 e GAI-001: corrigidos e validados localmente.** A correção e as evidências estão em [correcoes-onda-0-financeiro-2026-10-28](../correcoes-onda-0-financeiro-2026-10-28/README.md). Na execução final houve 124 pares concorrentes (109 com barreira InnoDB; 100 de stress), sem regressão de baixa; os resumos foram validados até 1.310 registros e com decimais grandes. Leitura com lock, validação, escrita e auditoria agora compartilham a transação. O GAI-001 foi antecipado para esta onda. Não houve migration ou reparo histórico.

As reproduções originais e os resultados abaixo são o **registro histórico anterior à correção** e foram preservados. Os demais achados continuam abertos. Os dois testes independentes de exportação genérica foram reexecutados e continuam falhos; produção e aceite integrado final permanecem não liberados. Consulte o relatório da Onda 0 para contagens atuais e limites.


## Resultados desta execução

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Jest backend completo, runner padrão SQLite | 638 aprovados; 76 falhos; 7 ignorados; 721 executáveis declarados | evidencias/backend-jest.json; backend-tests.log |
| HTTP/integracão MySQL descartável, 42 arquivos | 272 aprovados; 2 falhos; 7 ignorados; 281 executáveis declarados | evidencias/mysql-jest.json; mysql-checks.json; mysql-tests.log |
| S3 real local, MinIO isolado | 7 aprovados; 0 falhos; 0 ignorados; 7 executáveis declarados | evidencias/storage-jest.json; storage-tests.log |
| Vitest frontend completo | 247 aprovados; 0 falhos; 0 ignorados; 247 executáveis declarados | evidencias/frontend-vitest.json; frontend-checks.json |
| TypeScript backend incluindo testes | APROVADO | backend-checks.json → backend-typescript, exit 0 |
| TypeScript frontend app + configuração Node | APROVADO | frontend-checks.json → dois checks exit 0 |
| Build backend Nest | APROVADO após corrigir apenas configuração do harness | backend-build-final.log e evidencias/build-backend; saída isolada |
| Build frontend Vite | APROVADO; aviso de chunk 1.727,55 kB (gzip 481,90 kB) | frontend-build.log; saída isolada |
| ESLint global backend, sem --fix | 83 erros; 0 avisos | backend-eslint.json |
| ESLint global frontend | 0 erros; 1 aviso | frontend-eslint.json |
| Migrations em base nova | 32 registradas; nenhuma pendente; persistência HTTP verificada | schema.json; mysql-jest.json |
| Comparação schema/entidades | 101 tabelas de entidade + migrations; nenhuma coluna ausente nem divergência de nulabilidade/precisão/escala no comparador | schema.json; diff completo bloqueado por typeorm_metadata ausente |
| Playwright Chromium com API/MySQL reais | 11 aprovados; 0 falhos; 0 ignorados | evidencias/playwright.json; playwright.log; PNGs/traces |
| Reproduções financeiras HTTP novas | CONFIRMADAS: truncamento em 100 pagamentos e rollover de data inválida | finance-reproduction.json/log; reproduce-finance.cjs |
| Documentos com 1/60/180 linhas | 6 arquivos nativos; PDF 2/5/12 páginas; DOCX com XML/relacionamentos válidos | documentos-render/inspection.json |

## Contagem sem duplicação

Não somar 721 + 281 + 7 como se fossem testes distintos. Backend completo contém os testes HTTP novamente executados em MySQL e os casos S3 inicialmente ignorados. A consolidação usa arquivo + título + número de ocorrência para preservar casos parametrizados com títulos repetidos; substitui a execução SQLite pela MySQL do mesmo caso, depois o skip de S3 pela execução real. Resultado de evidência combinada: **721 casos declarados; 719 aprovados e 2 falhos**, em evidencias/tests-consolidated.json. Isso não transforma o comando padrão npm test em verde: ele falhou e precisa de correção no runner. Frontend e Playwright são populações separadas e não foram somados ao backend.

## Falhas e diagnóstico

O runner padrão inclui suítes recentes que usam REPEATABLE READ, NOW() e concorrência MySQL no helper SQLite. Surgem 500 por limitação de driver, e não há equivalência de locks. A execução final MySQL aprovou esses fluxos e deixou duas expectativas de exportação desatualizadas: security-storage.e2e-spec.ts enumera finance_xlsx/dre_xlsx no endpoint genérico e espera 403, mas o serviço retorna 409, exigindo fluxo especializado com filtros. Não foi comprovado vazamento nessa negativa. Não se alteraram testes para encobrir resultados.

ESLint backend: 82 prettier/prettier e 1 no-control-regex, em quatro arquivos: organization-overview.controller.ts (14), ensure-platform-admin.ts (1), organization-scope-services.spec.ts (18), organization-overview.spec.ts (50). Relatórios anteriores citavam 175 erros; a contagem atual é 83, sem equivalência linha a linha com aquele momento. Frontend mantém um aviso em OverviewDetails.tsx. Nenhum --fix foi executado. CI atual chama lint com --fix no backend, npm audit com ||true e não declara Playwright/MySQL/S3 reais; portanto não representa toda a homologação integrada.

## Preparação do ambiente e tentativas não conclusivas

Primeiro esbuild foi impedido de ler configuração pela sandbox; repetição autorizada aprovou frontend. Build Nest isolado precisou de caminho relativo, typeRoots e excludes relativos corretos; falhas dessas tentativas são de configuração da auditoria, não erros de build do produto. Container MySQL em disco excedeu timeouts e contaminou tentativas seguintes com DDL inacabado; elas não foram somadas, e logs foram preservados. Execução final em tmpfs foi serializada. O harness Playwright precisou de imports ESM/caminhos próprios, empresa sintética 1, health local e cwd do Tailwind; essas falhas de preparação não são classificadas como defeitos de interface. Testes originais e fontes permaneceram intactos.

Os testes de navegador reutilizam nove specs reais em cópias isoladas, mais dois casos novos de navegação desktop/mobile. Portas 33319/33320 e outputs foram redirecionados para a auditoria; não usam page.route/mock de API. A API usa módulos reais Nest, MySQL com as migrations e seed sintético; storage de testes é FakeStorage para as suítes de negócio, com integração MinIO independente. A API de teste não replica todos os aspectos do AppModule de produção, especialmente ThrottlerGuard global, ALB/CORS/TLS/SES e infraestrutura AWS.

## Playwright por cenário

| Arquivo | Cenário | Estado |
| --- | --- | --- |
| assisted-reconciliation.spec.ts | ORG_ADMIN reviews and persists assisted reconciliation while retaining project navigation | APROVADO |
| budgets.spec.ts | ORG_ADMIN publishes explicit prices, builds a standalone budget, compares scenarios and approves an immutable proposal | APROVADO |
| contracts.spec.ts | ORG_ADMIN manages contracts/amendments, refreshes history and exports filtered commercial overview | APROVADO |
| documents.spec.ts | ORG_ADMIN generates and downloads approved PDF/DOCX and commercial versions | APROVADO |
| dre.spec.ts | ORG_ADMIN classifies accrual, adjusts, drills, exports and refreshes | APROVADO |
| field-coordination.spec.ts | ORG_ADMIN creates a versioned field model, assigns and approves a task, completes/reopens field and retains workspace navigation | APROVADO |
| receivables.spec.ts | ORG_ADMIN operates installments, partial/full receipts, reversal, cash, export and refresh | APROVADO |
| reports.spec.ts | ORG_ADMIN creates model, drafts, validates, approves and preserves historical report | APROVADO |
| valuation-batches.spec.ts | ORG_ADMIN selects between pages, previews and applies common/individual valuations with persisted results and protected XLSX | APROVADO |
| zz-navigation.spec.ts | real project navigation and refresh 1440px | APROVADO |
| zz-navigation.spec.ts | real project navigation and refresh 390px | APROVADO |

## Não executado ou ainda não certificado

Upgrade de cópia com dados históricos, rollback/restore de desastre, teste de carga/stress e todas as intercalações concorrentes, cobertura percentual nova, AWS real e IAM/CORS efetivos, entrega SES, DOCX no Word/render canônico, offline/APK, assinatura digital, motor normativo e importação completa do legado. A varredura atual npm audit de produção foi concluída e encontrou 20 entradas backend e 5 frontend; exploração não foi verificada. Detalhes em dependencias-seguranca.md. Não foi feito deploy, release:prod, acesso destrutivo ao banco existente, commit ou push.

## Regressão financeira adicional descoberta na auditoria

A bateria race-payments.cjs criou 15 pagamentos distintos exclusivamente no MySQL sintético e executou approve/mark-as-paid simultâneos. 5 casos tiveram regressão de paid para approved; inspect-payment-race.cjs confirmou SQL/auditorias e uma segunda baixa 200 sem estorno. Esses casos são reproduções de falha, não testes de aceite aprovados, e não foram somados às 721 definições da suíte existente. A amostra não estima incidência em produção. SQL e relógios também comprovam GAI-011.

## Dependências de produção

Consulta npm audit atual sobre lockfiles concluída: 20 entradas backend (2 critical/13 high/3 moderate/2 low) e 5 high frontend. Não são contagens de CVEs únicos nem prova de alcance em produção. GAI-012 exige triagem; nenhuma atualização de dependência foi feita. Evidências: npm-audit-backend-normalized.json e npm-audit-frontend-normalized.json.
