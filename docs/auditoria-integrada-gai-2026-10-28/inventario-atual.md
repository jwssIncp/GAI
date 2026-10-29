# Inventário e arquitetura atuais

Inventário realizado antes de qualquer alteração de implementação. Foram lidos 1080 arquivos textuais nos diretórios de backend, frontend, documentação, infraestrutura, scripts e CI, com manifesto SHA-256 em [evidencias/inventory.json](evidencias/inventory.json). Esse manifesto é um censo; a revisão humana foi dirigida aos contratos, políticas, persistência, interfaces e cenários críticos descritos nos demais relatórios. Não significa prova formal de todos os caminhos de cada linha. Nenhum AGENTS.md foi localizado pelo inventário inicial.

## Composição

NestJS 11, TypeScript 5.7, TypeORM 0.3 e mysql2 no backend; React 19, React Router 7, React Query 5, Axios, React Hook Form/Zod, Tailwind e Vite 6 no frontend. Jest/ts-jest, Supertest, Vitest/Testing Library e Playwright compõem os testes. Versões declaradas e dependências completas estão em inventory.json, deps. Os números instalados vêm dos lockfiles; não foi feita atualização nem instalação de dependências nesta auditoria. Node observado: 24.18.0.

São 26 diretórios de módulos, 38 classes de controller, 312 endpoints Nest extraídos por reflexão, 161 permissões de seed e 32 migrations. O censo textual identifica 45 classes em arquivos de serviço e 106 classes em arquivos que contêm entidades; estas últimas incluem bases auxiliares e não são contagem de tabelas. A contagem física e as entidades TypeORM efetivas estão em banco-migrations.md. Também há casos de uso individuais, repositories, DTOs, políticas e ports, listados no manifesto.

| Módulo | Módulos Nest | Controllers | Serviços | Classes em arquivos de entidade | Endpoints |
| --- | --- | --- | --- | --- | --- |
| assisted-reconciliation | AssistedReconciliationModule | AssistedController | AssistedService | 5 | 5 |
| auth | AuthModule | AuthController | RoleAuthorizationService | 4 | 5 |
| budgets | BudgetsModule | BudgetController | BudgetService | 4 | 11 |
| catalog-assets | CatalogAssetsModule | CatalogAssetsController | CatalogAssetScopeService | 2 | 6 |
| companies | CompaniesModule | CompaniesController | CompaniesService, CompanyScopeService | 6 | 15 |
| contracts | ContractsModule | CommercialController, ContractController | CommercialService, ContractService | 4 | 10 |
| documents | DocumentTemplatesModule, DocumentsModule | ReportDocumentsController, BudgetDocumentsController, DocumentTemplatesController | DocumentRendererService, DocumentTemplatesService, DocumentsService | 4 | 8 |
| expense-accountabilities | ExpenseAccountabilitiesModule | ExpenseAccountabilitiesController | ExpenseAccountabilitiesService | 4 | 7 |
| export-jobs | ExportJobsModule | ExportJobsController | ExportJobProcessorService, ExportJobsService, ExportRowLimitExceededError, ExportWorkbookBuilderService | 2 | 7 |
| field-agents | FieldAgentsModule | FieldAgentsController, ProjectFieldAgentsController | FieldAgentScopeService | 3 | 13 |
| field-coordination | FieldCoordinationModule | FieldTemplatesController, FieldController | FieldService | 7 | 19 |
| import-sessions | ImportSessionsModule | ImportSessionsController | ImportSessionScopeService, ImportSessionsService, PhysicalObservationImportParserService | 5 | 18 |
| inventory-accounting-items | InventoryAccountingItemsModule | InventoryAccountingItemsController | AccountingImportParserService, InventoryAccountingItemScopeService, InventoryAccountingItemsService | 3 | 9 |
| inventory-item-images | InventoryItemImagesModule | InventoryItemImagesController | InventoryItemImageScopeService | 2 | 8 |
| inventory-items | InventoryItemsModule | InventoryItemsController | InventoryItemScopeService | 2 | 8 |
| inventory-operations | InventoryOperationsModule | InventoryOperationsController, ValuationBatchController | InventoryOperationsService, ValuationBatchService | 11 | 26 |
| inventory-pending-issues | InventoryPendingIssuesModule | InventoryPendingIssuesController | InventoryPendingIssueScopeService, InventoryPendingIssuesService | 2 | 8 |
| managerial-dre | ManagerialDreModule | DreController | DreExportService, DreService | 6 | 18 |
| organizations | OrganizationsModule | OrganizationsController | Use cases/serviços no inventário detalhado | 2 | 6 |
| payments-expenses | PaymentsExpensesModule | PaymentsExpensesController | PaymentsExpensesScopeService, PaymentsExpensesService | 4 | 21 |
| project-dashboard | ProjectDashboardModule | OrganizationOverviewController, ProjectDashboardController | OrganizationOverviewService, ProjectDashboardAnalyticsService, ProjectSummaryService | 0 | 8 |
| project-preparation | ProjectPreparationModule | PreparationTemplatesController, ProjectPreparationController | PreparationService | 6 | 18 |
| projects | ProjectsModule | ProjectsController | ProjectScopeService | 2 | 12 |
| receivables | ReceivablesModule | ReceivableController | CashFlowService, FinanceExportService, ReceivableService | 3 | 13 |
| technical-reports | TechnicalReportsModule | TechnicalReportsController | TechnicalReportsService | 7 | 17 |
| users | UsersModule | OrgRolesController, PermissionsController, UserRoleAssignmentsController, UsersController | UserScopeService | 6 | 15 |

## Organização arquitetural

Os módulos originais separam presentation, application, domain e infrastructure, com ports e repositories. Os incrementos recentes usam arquivos mais planos, serviços transacionais e políticas puras. Não há evidência de dependência Nest circular que impeça os testes inicializarem. A heterogeneidade aumenta o custo de manutenção, mas não prova incompatibilidade funcional.

O AppModule registra explicitamente entidades e módulos (`gai-backend/src/app.module.ts:100`); o helper de testes mantém uma lista paralela (`gai-backend/test/integration/test-app.helper.ts:112`). Essa duplicação exige controle de deriva. O data-source de CLI usa glob de entidades e migrations e synchronize=false; o helper usa SQLite/synchronize ou MySQL/migrations conforme opt-in. Portanto, uma suíte SQLite não certifica o schema MySQL.

Frontend: router.tsx controla navegação global; projectRoutes.tsx agrupa recursos do projeto sob ProjectLayout. Há layouts separados de orçamento/finanças/DRE, com contexto via query string. Inventário completo de componentes e testes: inventory.json → manifest/tests. Rotas, ações e permissões: [rotas-permissoes.md](rotas-permissoes.md). São registros dos decorators efetivos, inclusive aliases de autorização; não inferências pelo nome do botão.

## Duplicações e partes incompletas

1. Corpos equivalentes: `gai-backend/src/modules/companies/application/services/company-scope.service.ts:34`; `gai-backend/src/modules/inventory-items/application/services/inventory-item-scope.service.ts:33`; `gai-backend/src/modules/projects/application/services/project-scope.service.ts:38`. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.
2. Corpos equivalentes: `gai-backend/src/modules/companies/application/services/company-scope.service.ts:12`; `gai-backend/src/modules/projects/application/services/project-scope.service.ts:13`. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.
3. Corpos equivalentes: `gai-backend/src/modules/users/application/use-cases/create-org-role.use-case.ts:63`; `gai-backend/src/modules/users/application/use-cases/update-org-role.use-case.ts:86`. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.
4. Corpos equivalentes: `gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issues.service.ts:68`; `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:80`. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.
5. Corpos equivalentes: `gai-backend/src/modules/managerial-dre/dre.controller.ts:170`; `gai-backend/src/modules/receivables/receivable.controller.ts:126`. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.
6. Corpos equivalentes: `gai-backend/src/modules/inventory-accounting-items/application/services/inventory-accounting-item-scope.service.ts:17`; `gai-backend/src/modules/inventory-item-images/application/services/inventory-item-image-scope.service.ts:26`; `gai-backend/src/modules/inventory-items/application/services/inventory-item-scope.service.ts:17`. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.
7. Corpos equivalentes: `gai-backend/src/modules/catalog-assets/domain/entities/catalog-asset.ts:93`; `gai-backend/src/modules/field-agents/domain/entities/field-agent.ts:89`; `gai-backend/src/modules/field-agents/domain/entities/project-field-agent.ts:80`; `gai-backend/src/modules/projects/domain/entities/project.ts:122`. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.
8. Corpos equivalentes: `gai-backend/src/modules/companies/application/services/company-scope.service.ts:59`; `gai-backend/src/modules/projects/application/services/project-scope.service.ts:66`. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.

Fora dessas duplicações exatas, validadores de data, escopo, erros e versões se repetem com diferenças de semântica. A data civil de despesas diverge da validação estrita de orçamentos/avaliações e gerou defeito reproduzível (GAI-002).

Existem placeholders globais para catálogo, itens, imagens, base contábil, pendências, pagamentos, despesas, importações, exportações, perfil e configurações, além de projects/:id/area (`gai-frontend/src/router/router.tsx:67`; `gai-frontend/src/router/projectRoutes.tsx:81`). Os fluxos de projeto correspondentes em geral são reais; um placeholder global não deve ser contado como módulo funcional adicional. Catálogo possui backend CRUD, mas a rota global é placeholder. Não há prova de que todo endpoint tenha uso por interface; endpoints administrativos/API-only não são automaticamente código morto.

## Integrações e infraestrutura

S3 via AWS SDK/SigV4; SES como adapter de e-mail; MySQL/RDS; ECS/Fargate/ECR/ALB; frontend em S3/CloudFront; Terraform e GitHub Actions. Configuração é evidência declarativa, não comprovação de deployment. Artefatos documentais PDF/DOCX usam bytes privados no banco, não S3. Não há CRM, atividades/jornada ou cursos nos módulos registrados. Não foram criados novos módulos.

Relatórios anteriores foram lidos como contexto, com cópia textual em evidencias/reports-read.txt. Afirmações antigas como bypass de chave desconhecida, falta de verificação de upload e calendário com overflow foram confrontadas com código/testes atuais; não foram repetidas como falhas atuais sem nova prova.
