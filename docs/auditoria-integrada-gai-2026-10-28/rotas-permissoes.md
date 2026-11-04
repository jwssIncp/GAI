# Catálogo efetivo de rotas e permissões

Extração por reflexão Nest em inspect-runtime.cjs; 312 endpoints, 161 permissões de seed, zero chaves de rota ausentes no seed. As permissões de fonte exigidas dentro dos serviços também devem ser consideradas; ver seguranca-rbac.md. Rotas públicas são health/login/reset; me/logout exigem sessão. Organizations usa SessionAuthGuard + RolesGuard/PLATFORM_ADMIN, sem decorator de permissão por chave. Guards e permissões são os metadados atuais, não uma certificação de toda lógica interna.

| Método | Rota /api/v1 | Permissões efetivas no decorator | Guards | Controller e método |
| --- | --- | --- | --- | --- |
| GET | /api/v1/health | Sessão/papel ou público conforme guards |  | AppController.health |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/assisted-reconciliation/runs | assisted-reconciliation:read, assisted-reconciliation:generate | SessionAuthGuard, PermissionsGuard | AssistedController.generate |
| GET | /api/v1/projects/:projectId/inventory-sessions/:sessionId/assisted-reconciliation/runs | assisted-reconciliation:read | SessionAuthGuard, PermissionsGuard | AssistedController.runs |
| GET | /api/v1/projects/:projectId/inventory-sessions/:sessionId/assisted-reconciliation/runs/:runId/candidates | assisted-reconciliation:read | SessionAuthGuard, PermissionsGuard | AssistedController.candidates |
| GET | /api/v1/projects/:projectId/inventory-sessions/:sessionId/assisted-reconciliation/candidates/:id/history | assisted-reconciliation:read | SessionAuthGuard, PermissionsGuard | AssistedController.history |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/assisted-reconciliation/candidates/:id/decisions | assisted-reconciliation:read, assisted-reconciliation:review, consolidations:create | SessionAuthGuard, PermissionsGuard | AssistedController.decide |
| POST | /api/v1/auth/login | Sessão/papel ou público conforme guards |  | AuthController.login |
| POST | /api/v1/auth/logout | Sessão/papel ou público conforme guards | SessionAuthGuard | AuthController.logout |
| GET | /api/v1/auth/me | Sessão/papel ou público conforme guards | SessionAuthGuard | AuthController.me |
| POST | /api/v1/auth/password-reset/request | Sessão/papel ou público conforme guards |  | AuthController.requestPasswordReset |
| POST | /api/v1/auth/password-reset/confirm | Sessão/papel ou público conforme guards |  | AuthController.confirmPasswordReset |
| GET | /api/v1/budgets/pricing | budgets:read | SessionAuthGuard, PermissionsGuard | BudgetController.pricing |
| POST | /api/v1/budgets/pricing | budgets:read, budgets:configure-prices | SessionAuthGuard, PermissionsGuard | BudgetController.publish |
| POST | /api/v1/budgets/simulate | budgets:read, budgets:edit | SessionAuthGuard, PermissionsGuard | BudgetController.simulate |
| GET | /api/v1/budgets | budgets:read | SessionAuthGuard, PermissionsGuard | BudgetController.list |
| POST | /api/v1/budgets | budgets:read, budgets:edit | SessionAuthGuard, PermissionsGuard | BudgetController.create |
| GET | /api/v1/budgets/:id | budgets:read | SessionAuthGuard, PermissionsGuard | BudgetController.detail |
| PUT | /api/v1/budgets/:id/versions | budgets:read, budgets:edit | SessionAuthGuard, PermissionsGuard | BudgetController.edit |
| POST | /api/v1/budgets/:id/scenarios | budgets:read, budgets:edit | SessionAuthGuard, PermissionsGuard | BudgetController.scenario |
| POST | /api/v1/budgets/:id/transitions | budgets:read | SessionAuthGuard, PermissionsGuard | BudgetController.transition |
| GET | /api/v1/budgets/:id/proposal | budgets:read | SessionAuthGuard, PermissionsGuard | BudgetController.proposal |
| GET | /api/v1/budgets/:id/contract-preview | budgets:read, budgets:approve | SessionAuthGuard, PermissionsGuard | BudgetController.conversion |
| POST | /api/v1/catalog-assets | catalog-assets:create | SessionAuthGuard, PermissionsGuard | CatalogAssetsController.create |
| GET | /api/v1/catalog-assets | catalog-assets:read | SessionAuthGuard, PermissionsGuard | CatalogAssetsController.list |
| GET | /api/v1/catalog-assets/:id | catalog-assets:read | SessionAuthGuard, PermissionsGuard | CatalogAssetsController.getById |
| PATCH | /api/v1/catalog-assets/:id | catalog-assets:update | SessionAuthGuard, PermissionsGuard | CatalogAssetsController.update |
| POST | /api/v1/catalog-assets/:id/deactivate | catalog-assets:deactivate | SessionAuthGuard, PermissionsGuard | CatalogAssetsController.deactivate |
| POST | /api/v1/catalog-assets/:id/reactivate | catalog-assets:reactivate | SessionAuthGuard, PermissionsGuard | CatalogAssetsController.reactivate |
| POST | /api/v1/companies | companies:create | SessionAuthGuard, PermissionsGuard | CompaniesController.createCompany |
| GET | /api/v1/companies | companies:read | SessionAuthGuard, PermissionsGuard | CompaniesController.listCompanies |
| GET | /api/v1/companies/:id | companies:read | SessionAuthGuard, PermissionsGuard | CompaniesController.getCompany |
| PATCH | /api/v1/companies/:id | companies:update | SessionAuthGuard, PermissionsGuard | CompaniesController.updateCompany |
| POST | /api/v1/companies/:id/deactivate | companies:deactivate | SessionAuthGuard, PermissionsGuard | CompaniesController.deactivateCompany |
| POST | /api/v1/companies/:id/reactivate | companies:reactivate | SessionAuthGuard, PermissionsGuard | CompaniesController.reactivateCompany |
| POST | /api/v1/companies/:companyId/units | company-units:create | SessionAuthGuard, PermissionsGuard | CompaniesController.createUnit |
| GET | /api/v1/companies/:companyId/units | company-units:read | SessionAuthGuard, PermissionsGuard | CompaniesController.listUnits |
| GET | /api/v1/companies/:companyId/units/:unitId | company-units:read | SessionAuthGuard, PermissionsGuard | CompaniesController.getUnit |
| PATCH | /api/v1/companies/:companyId/units/:unitId | company-units:update | SessionAuthGuard, PermissionsGuard | CompaniesController.updateUnit |
| POST | /api/v1/companies/:companyId/units/:unitId/deactivate | company-units:deactivate | SessionAuthGuard, PermissionsGuard | CompaniesController.deactivateUnit |
| POST | /api/v1/companies/:companyId/units/:unitId/reactivate | company-units:reactivate | SessionAuthGuard, PermissionsGuard | CompaniesController.reactivateUnit |
| POST | /api/v1/projects/:projectId/units | project-units:assign | SessionAuthGuard, PermissionsGuard | CompaniesController.assignProjectUnit |
| GET | /api/v1/projects/:projectId/units | project-units:read | SessionAuthGuard, PermissionsGuard | CompaniesController.listProjectUnits |
| POST | /api/v1/projects/:projectId/units/:unitId/remove | project-units:remove | SessionAuthGuard, PermissionsGuard | CompaniesController.removeProjectUnit |
| GET | /api/v1/organization-overview/commercial | projects:read, commercial-indicators:read | SessionAuthGuard, PermissionsGuard | CommercialController.overview |
| POST | /api/v1/organization-overview/commercial/reports | projects:read, commercial-indicators:read | SessionAuthGuard, PermissionsGuard | CommercialController.save |
| GET | /api/v1/organization-overview/commercial/reports/:id | projects:read, commercial-indicators:read | SessionAuthGuard, PermissionsGuard | CommercialController.report |
| GET | /api/v1/organization-overview/commercial/reports/:id/export.:format | projects:read, commercial-indicators:read | SessionAuthGuard, PermissionsGuard | CommercialController.export |
| GET | /api/v1/projects/:projectId/contracts | projects:read, contracts:read | SessionAuthGuard, PermissionsGuard | ContractController.list |
| GET | /api/v1/projects/:projectId/contracts/:id | projects:read, contracts:read | SessionAuthGuard, PermissionsGuard | ContractController.detail |
| POST | /api/v1/projects/:projectId/contracts | projects:read, contracts:read, contracts:edit | SessionAuthGuard, PermissionsGuard | ContractController.create |
| PATCH | /api/v1/projects/:projectId/contracts/:id | projects:read, contracts:read, contracts:edit | SessionAuthGuard, PermissionsGuard | ContractController.edit |
| POST | /api/v1/projects/:projectId/contracts/:id/amendments | projects:read, contracts:read, contracts:amend | SessionAuthGuard, PermissionsGuard | ContractController.amend |
| POST | /api/v1/projects/:projectId/contracts/:id/archive | projects:read, contracts:read, contracts:archive | SessionAuthGuard, PermissionsGuard | ContractController.archive |
| POST | /api/v1/projects/:projectId/technical-reports/:id/versions/:versionId/documents | projects:read, technical-reports:read, technical-reports:export | SessionAuthGuard, PermissionsGuard | ReportDocumentsController.generate |
| GET | /api/v1/projects/:projectId/technical-reports/:id/versions/:versionId/documents/:artifactId | projects:read, technical-reports:read, technical-reports:export | SessionAuthGuard, PermissionsGuard | ReportDocumentsController.download |
| POST | /api/v1/budgets/:id/versions/:versionId/documents | budgets:read, budgets:export | SessionAuthGuard, PermissionsGuard | BudgetDocumentsController.generate |
| POST | /api/v1/budgets/:id/versions/:versionId/proposal-documents | budgets:read, budgets:export | SessionAuthGuard, PermissionsGuard | BudgetDocumentsController.proposal |
| GET | /api/v1/budgets/:id/versions/:versionId/documents/:artifactId | budgets:read, budgets:export | SessionAuthGuard, PermissionsGuard | BudgetDocumentsController.download |
| GET | /api/v1/budgets/:id/versions/:versionId/proposal-documents/:artifactId | budgets:read, budgets:export | SessionAuthGuard, PermissionsGuard | BudgetDocumentsController.proposalDownload |
| GET | /api/v1/organizations/:organizationId/document-templates | documents:templates | SessionAuthGuard, PermissionsGuard | DocumentTemplatesController.list |
| POST | /api/v1/organizations/:organizationId/document-templates | documents:templates | SessionAuthGuard, PermissionsGuard | DocumentTemplatesController.publish |
| POST | /api/v1/projects/:projectId/expense-accountabilities | expense-accountabilities:create | SessionAuthGuard, PermissionsGuard | ExpenseAccountabilitiesController.create |
| GET | /api/v1/projects/:projectId/expense-accountabilities | expense-accountabilities:read | SessionAuthGuard, PermissionsGuard | ExpenseAccountabilitiesController.list |
| GET | /api/v1/projects/:projectId/expense-accountabilities/:id | expense-accountabilities:read | SessionAuthGuard, PermissionsGuard | ExpenseAccountabilitiesController.get |
| POST | /api/v1/projects/:projectId/expense-accountabilities/:id/expenses | expense-accountabilities:update | SessionAuthGuard, PermissionsGuard | ExpenseAccountabilitiesController.addExpense |
| POST | /api/v1/projects/:projectId/expense-accountabilities/:id/close | expense-accountabilities:close | SessionAuthGuard, PermissionsGuard | ExpenseAccountabilitiesController.close |
| POST | /api/v1/projects/:projectId/expenses/:expenseId/installments/generate | expense-installments:create | SessionAuthGuard, PermissionsGuard | ExpenseAccountabilitiesController.generateInstallments |
| GET | /api/v1/projects/:projectId/expenses/:expenseId/installments | expense-installments:read | SessionAuthGuard, PermissionsGuard | ExpenseAccountabilitiesController.listInstallments |
| POST | /api/v1/projects/:projectId/export-jobs | export-jobs:create | SessionAuthGuard, PermissionsGuard | ExportJobsController.create |
| GET | /api/v1/projects/:projectId/export-jobs | export-jobs:read | SessionAuthGuard, PermissionsGuard | ExportJobsController.list |
| GET | /api/v1/projects/:projectId/export-jobs/:jobId/download | export-jobs:download | SessionAuthGuard, PermissionsGuard | ExportJobsController.download |
| GET | /api/v1/projects/:projectId/export-jobs/:jobId | export-jobs:read | SessionAuthGuard, PermissionsGuard | ExportJobsController.get |
| POST | /api/v1/projects/:projectId/export-jobs/:jobId/download-url | export-jobs:download | SessionAuthGuard, PermissionsGuard | ExportJobsController.createDownloadUrl |
| POST | /api/v1/projects/:projectId/export-jobs/:jobId/cancel | export-jobs:cancel | SessionAuthGuard, PermissionsGuard | ExportJobsController.cancel |
| POST | /api/v1/projects/:projectId/export-jobs/:jobId/retry | export-jobs:retry | SessionAuthGuard, PermissionsGuard | ExportJobsController.retry |
| POST | /api/v1/field-agents | field-agents:create | SessionAuthGuard, PermissionsGuard | FieldAgentsController.create |
| GET | /api/v1/field-agents | field-agents:read | SessionAuthGuard, PermissionsGuard | FieldAgentsController.list |
| GET | /api/v1/field-agents/:id | field-agents:read | SessionAuthGuard, PermissionsGuard | FieldAgentsController.getById |
| PATCH | /api/v1/field-agents/:id | field-agents:update | SessionAuthGuard, PermissionsGuard | FieldAgentsController.update |
| POST | /api/v1/field-agents/:id/deactivate | field-agents:deactivate | SessionAuthGuard, PermissionsGuard | FieldAgentsController.deactivate |
| POST | /api/v1/field-agents/:id/reactivate | field-agents:reactivate | SessionAuthGuard, PermissionsGuard | FieldAgentsController.reactivate |
| POST | /api/v1/field-agents/:id/block | field-agents:block | SessionAuthGuard, PermissionsGuard | FieldAgentsController.block |
| POST | /api/v1/field-agents/:id/unblock | field-agents:unblock | SessionAuthGuard, PermissionsGuard | FieldAgentsController.unblock |
| DELETE | /api/v1/field-agents/:id | field-agents:delete | SessionAuthGuard, PermissionsGuard | FieldAgentsController.delete |
| POST | /api/v1/projects/:projectId/field-agents | project-field-agents:assign | SessionAuthGuard, PermissionsGuard | ProjectFieldAgentsController.assign |
| GET | /api/v1/projects/:projectId/field-agents | project-field-agents:read | SessionAuthGuard, PermissionsGuard | ProjectFieldAgentsController.list |
| PATCH | /api/v1/projects/:projectId/field-agents/:assignmentId | project-field-agents:update | SessionAuthGuard, PermissionsGuard | ProjectFieldAgentsController.update |
| POST | /api/v1/projects/:projectId/field-agents/:assignmentId/remove | project-field-agents:remove | SessionAuthGuard, PermissionsGuard | ProjectFieldAgentsController.remove |
| GET | /api/v1/organizations/:organizationId/field-templates | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldTemplatesController.list |
| GET | /api/v1/organizations/:organizationId/field-templates/:id | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldTemplatesController.get |
| GET | /api/v1/organizations/:organizationId/field-templates/:id/versions/:version | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldTemplatesController.version |
| POST | /api/v1/organizations/:organizationId/field-templates | field-coordination:read, field-coordination:edit | SessionAuthGuard, PermissionsGuard | FieldTemplatesController.create |
| PATCH | /api/v1/organizations/:organizationId/field-templates/:id | field-coordination:read, field-coordination:edit | SessionAuthGuard, PermissionsGuard | FieldTemplatesController.update |
| POST | /api/v1/organizations/:organizationId/field-templates/:id/archive | field-coordination:read, field-coordination:edit | SessionAuthGuard, PermissionsGuard | FieldTemplatesController.archive |
| GET | /api/v1/projects/:projectId/field-coordination/context | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldController.context |
| GET | /api/v1/projects/:projectId/field-coordination | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldController.list |
| POST | /api/v1/projects/:projectId/field-coordination | field-coordination:read, field-coordination:edit | SessionAuthGuard, PermissionsGuard | FieldController.create |
| GET | /api/v1/projects/:projectId/field-coordination/:id | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldController.get |
| GET | /api/v1/projects/:projectId/field-coordination/:id/tasks | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldController.tasks |
| POST | /api/v1/projects/:projectId/field-coordination/:id/tasks | field-coordination:read, field-coordination:edit | SessionAuthGuard, PermissionsGuard | FieldController.add |
| PATCH | /api/v1/projects/:projectId/field-coordination/:id/tasks/:taskId | field-coordination:read, field-coordination:edit | SessionAuthGuard, PermissionsGuard | FieldController.update |
| POST | /api/v1/projects/:projectId/field-coordination/:id/tasks/:taskId/approve | field-coordination:read, field-coordination:coordinate | SessionAuthGuard, PermissionsGuard | FieldController.approve |
| GET | /api/v1/projects/:projectId/field-coordination/:id/dashboard | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldController.dashboard |
| GET | /api/v1/projects/:projectId/field-coordination/:id/readiness | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldController.readiness |
| POST | /api/v1/projects/:projectId/field-coordination/:id/transition | field-coordination:read, field-coordination:coordinate | SessionAuthGuard, PermissionsGuard | FieldController.transition |
| GET | /api/v1/projects/:projectId/field-coordination/:id/history | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldController.history |
| GET | /api/v1/projects/:projectId/field-coordination/:id/message | field-coordination:read | SessionAuthGuard, PermissionsGuard | FieldController.message |
| POST | /api/v1/projects/:projectId/import-sessions | import-sessions:create | SessionAuthGuard, PermissionsGuard | ImportSessionsController.createSession |
| GET | /api/v1/projects/:projectId/import-sessions | import-sessions:read | SessionAuthGuard, PermissionsGuard | ImportSessionsController.listSessions |
| GET | /api/v1/projects/:projectId/import-sessions/by-uuid/:sessionUuid | import-sessions:read | SessionAuthGuard, PermissionsGuard | ImportSessionsController.getSessionByUuid |
| GET | /api/v1/projects/:projectId/import-sessions/:sessionId | import-sessions:read | SessionAuthGuard, PermissionsGuard | ImportSessionsController.getSession |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/finish | import-sessions:finish | SessionAuthGuard, PermissionsGuard | ImportSessionsController.finishSession |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/cancel | import-sessions:cancel | SessionAuthGuard, PermissionsGuard | ImportSessionsController.cancelSession |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/retry | import-sessions:retry | SessionAuthGuard, PermissionsGuard | ImportSessionsController.retrySession |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/payloads | import-payloads:create | SessionAuthGuard, PermissionsGuard | ImportSessionsController.receivePayload |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/physical-observations/import | import-payloads:create | SessionAuthGuard, PermissionsGuard | ImportSessionsController.importPhysicalFile |
| GET | /api/v1/projects/:projectId/import-sessions/:sessionId/payloads | import-payloads:read | SessionAuthGuard, PermissionsGuard | ImportSessionsController.listPayloads |
| GET | /api/v1/projects/:projectId/import-sessions/:sessionId/payloads/:payloadId | import-payloads:read | SessionAuthGuard, PermissionsGuard | ImportSessionsController.getPayload |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/payloads/:payloadId/reprocess | import-payloads:reprocess | SessionAuthGuard, PermissionsGuard | ImportSessionsController.reprocessPayload |
| GET | /api/v1/projects/:projectId/import-sessions/:sessionId/errors | import-errors:read | SessionAuthGuard, PermissionsGuard | ImportSessionsController.listSessionErrors |
| GET | /api/v1/projects/:projectId/import-sessions/:sessionId/payloads/:payloadId/errors | import-errors:read | SessionAuthGuard, PermissionsGuard | ImportSessionsController.listPayloadErrors |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/files/upload-url | import-files:create | SessionAuthGuard, PermissionsGuard | ImportSessionsController.createFileUploadUrl |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/files/:fileId/confirm-upload | import-files:create | SessionAuthGuard, PermissionsGuard | ImportSessionsController.confirmFileUpload |
| GET | /api/v1/projects/:projectId/import-sessions/:sessionId/files | import-files:read | SessionAuthGuard, PermissionsGuard | ImportSessionsController.listFiles |
| POST | /api/v1/projects/:projectId/import-sessions/:sessionId/files/:fileId/download-url | import-files:download | SessionAuthGuard, PermissionsGuard | ImportSessionsController.createFileDownloadUrl |
| POST | /api/v1/projects/:projectId/accounting-imports | inventory-accounting-items:import | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.importAccountingItems |
| GET | /api/v1/projects/:projectId/accounting-imports | inventory-accounting-items:read | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.listBatches |
| GET | /api/v1/projects/:projectId/accounting-imports/:batchId | inventory-accounting-items:read | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.getBatch |
| GET | /api/v1/projects/:projectId/accounting-imports/:batchId/errors | inventory-accounting-items:export-errors | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.getBatchErrors |
| GET | /api/v1/projects/:projectId/inventory-accounting-items | inventory-accounting-items:read | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.listItems |
| GET | /api/v1/projects/:projectId/inventory-accounting-items/:id | inventory-accounting-items:read | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.getItem |
| PATCH | /api/v1/projects/:projectId/inventory-accounting-items/:id | inventory-accounting-items:update | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.updateItem |
| POST | /api/v1/projects/:projectId/inventory-accounting-items/:id/deactivate | inventory-accounting-items:deactivate | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.deactivate |
| POST | /api/v1/projects/:projectId/inventory-accounting-items/:id/reactivate | inventory-accounting-items:reactivate | SessionAuthGuard, PermissionsGuard | InventoryAccountingItemsController.reactivate |
| POST | /api/v1/projects/:projectId/inventory-items/:itemId/images/upload-url | inventory-item-images:create | SessionAuthGuard, PermissionsGuard | InventoryItemImagesController.requestUploadUrl |
| POST | /api/v1/projects/:projectId/inventory-items/:itemId/images/:imageId/confirm-upload | inventory-item-images:update | SessionAuthGuard, PermissionsGuard | InventoryItemImagesController.confirmUploadUrl |
| GET | /api/v1/projects/:projectId/inventory-items/:itemId/images | inventory-item-images:read | SessionAuthGuard, PermissionsGuard | InventoryItemImagesController.list |
| GET | /api/v1/projects/:projectId/inventory-items/:itemId/images/:imageId | inventory-item-images:read | SessionAuthGuard, PermissionsGuard | InventoryItemImagesController.getByProject |
| POST | /api/v1/projects/:projectId/inventory-items/:itemId/images/:imageId/download-url | inventory-item-images:download | SessionAuthGuard, PermissionsGuard | InventoryItemImagesController.requestDownloadUrl |
| POST | /api/v1/projects/:projectId/inventory-items/:itemId/images/:imageId/remove | inventory-item-images:remove | SessionAuthGuard, PermissionsGuard | InventoryItemImagesController.remove |
| GET | /api/v1/inventory-item-images/:id | inventory-item-images:read | SessionAuthGuard, PermissionsGuard | InventoryItemImagesController.getById |
| POST | /api/v1/inventory-item-images/:id/download-url | inventory-item-images:download | SessionAuthGuard, PermissionsGuard | InventoryItemImagesController.requestDownloadUrlById |
| POST | /api/v1/projects/:projectId/inventory-items | inventory-items:create | SessionAuthGuard, PermissionsGuard | InventoryItemsController.create |
| GET | /api/v1/projects/:projectId/inventory-items | inventory-items:read | SessionAuthGuard, PermissionsGuard | InventoryItemsController.listByProject |
| GET | /api/v1/projects/:projectId/inventory-items/:id | inventory-items:read | SessionAuthGuard, PermissionsGuard | InventoryItemsController.getByProject |
| PATCH | /api/v1/projects/:projectId/inventory-items/:id | inventory-items:update | SessionAuthGuard, PermissionsGuard | InventoryItemsController.update |
| POST | /api/v1/projects/:projectId/inventory-items/:id/deactivate | inventory-items:deactivate | SessionAuthGuard, PermissionsGuard | InventoryItemsController.deactivate |
| POST | /api/v1/projects/:projectId/inventory-items/:id/reactivate | inventory-items:reactivate | SessionAuthGuard, PermissionsGuard | InventoryItemsController.reactivate |
| GET | /api/v1/inventory-items | inventory-items:read | SessionAuthGuard, PermissionsGuard | InventoryItemsController.list |
| GET | /api/v1/inventory-items/:id | inventory-items:read | SessionAuthGuard, PermissionsGuard | InventoryItemsController.getById |
| POST | /api/v1/projects/:projectId/inventory-sessions | inventory-sessions:create | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.createSession |
| GET | /api/v1/projects/:projectId/inventory-sessions | inventory-sessions:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.listSessions |
| GET | /api/v1/projects/:projectId/inventory-sessions/:sessionId | inventory-sessions:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.getSession |
| GET | /api/v1/projects/:projectId/inventory-sessions/:sessionId/rounds | inventory-sessions:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.listRounds |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/start | inventory-sessions:update | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.startSession |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/finish | inventory-sessions:update | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.finishSession |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/cancel | inventory-sessions:update | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.cancelSession |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/reinventory | inventory-rounds:reinventory | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.requestReinventory |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/rounds/:roundId/observations | inventory-observations:create | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.createObservation |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/rounds/:roundId/observations/:observationId/evidence/upload-url | inventory-observations:create | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.createEvidenceUploadUrl |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/rounds/:roundId/observations/:observationId/evidence/:evidenceId/confirm-upload | inventory-observations:create | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.confirmEvidenceUpload |
| GET | /api/v1/projects/:projectId/inventory-sessions/:sessionId/rounds/:roundId/observations/:observationId/evidence | inventory-sessions:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.listObservationEvidence |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/rounds/:roundId/observations/:observationId/evidence/:evidenceId/download-url | inventory-sessions:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.createEvidenceDownloadUrl |
| GET | /api/v1/projects/:projectId/inventory-sessions/:sessionId/observations | inventory-sessions:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.listObservations |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/rounds/:roundId/finish | inventory-sessions:update | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.finishRound |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/reconciliations | reconciliations:create | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.reconcile |
| GET | /api/v1/projects/:projectId/inventory-sessions/:sessionId/reconciliations | reconciliations:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.listReconciliations |
| POST | /api/v1/projects/:projectId/inventory-sessions/:sessionId/reconciliations/:id/consolidate | consolidations:create | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.consolidate |
| POST | /api/v1/projects/:projectId/inventory-items/:itemId/valuations | asset-valuations:create | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.createValuation |
| GET | /api/v1/projects/:projectId/inventory-items/:itemId/valuations | asset-valuations:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.listValuations |
| GET | /api/v1/projects/:projectId/inventory-items/:itemId/plate-history | plate-history:read | SessionAuthGuard, PermissionsGuard | InventoryOperationsController.listPlateHistory |
| POST | /api/v1/projects/:projectId/valuation-batches/selection | asset-valuations:read, inventory-items:read, asset-valuations:batch-create, asset-valuations:create | SessionAuthGuard, PermissionsGuard | ValuationBatchController.selection |
| POST | /api/v1/projects/:projectId/valuation-batches/preview | asset-valuations:read, inventory-items:read, asset-valuations:batch-create, asset-valuations:create | SessionAuthGuard, PermissionsGuard | ValuationBatchController.preview |
| POST | /api/v1/projects/:projectId/valuation-batches/:id/confirm | asset-valuations:read, inventory-items:read, asset-valuations:batch-create, asset-valuations:create | SessionAuthGuard, PermissionsGuard | ValuationBatchController.confirm |
| GET | /api/v1/projects/:projectId/valuation-batches | asset-valuations:read, inventory-items:read | SessionAuthGuard, PermissionsGuard | ValuationBatchController.list |
| GET | /api/v1/projects/:projectId/valuation-batches/:id | asset-valuations:read, inventory-items:read | SessionAuthGuard, PermissionsGuard | ValuationBatchController.get |
| POST | /api/v1/projects/:projectId/pending-issues | inventory-pending-issues:create | SessionAuthGuard, PermissionsGuard | InventoryPendingIssuesController.create |
| GET | /api/v1/projects/:projectId/pending-issues | inventory-pending-issues:read | SessionAuthGuard, PermissionsGuard | InventoryPendingIssuesController.list |
| POST | /api/v1/projects/:projectId/pending-issues/generate | inventory-pending-issues:generate | SessionAuthGuard, PermissionsGuard | InventoryPendingIssuesController.generate |
| GET | /api/v1/projects/:projectId/pending-issues/:id | inventory-pending-issues:read | SessionAuthGuard, PermissionsGuard | InventoryPendingIssuesController.get |
| PATCH | /api/v1/projects/:projectId/pending-issues/:id | inventory-pending-issues:update | SessionAuthGuard, PermissionsGuard | InventoryPendingIssuesController.update |
| POST | /api/v1/projects/:projectId/pending-issues/:id/resolve | inventory-pending-issues:resolve | SessionAuthGuard, PermissionsGuard | InventoryPendingIssuesController.resolve |
| POST | /api/v1/projects/:projectId/pending-issues/:id/ignore | inventory-pending-issues:ignore | SessionAuthGuard, PermissionsGuard | InventoryPendingIssuesController.ignore |
| POST | /api/v1/projects/:projectId/pending-issues/:id/cancel | inventory-pending-issues:cancel | SessionAuthGuard, PermissionsGuard | InventoryPendingIssuesController.cancel |
| GET | /api/v1/finance/dre/accounts | dre:read | SessionAuthGuard, PermissionsGuard | DreController.accounts |
| GET | /api/v1/finance/dre/accounts/:id | dre:read | SessionAuthGuard, PermissionsGuard | DreController.account |
| POST | /api/v1/finance/dre/accounts | dre:read, dre:configure | SessionAuthGuard, PermissionsGuard | DreController.createAccount |
| POST | /api/v1/finance/dre/accounts/bootstrap | dre:read, dre:configure | SessionAuthGuard, PermissionsGuard | DreController.bootstrap |
| PUT | /api/v1/finance/dre/accounts/:id | dre:read, dre:configure | SessionAuthGuard, PermissionsGuard | DreController.editAccount |
| GET | /api/v1/finance/dre/sources | dre:read, dre:classify | SessionAuthGuard, PermissionsGuard | DreController.sources |
| GET | /api/v1/finance/dre/entries | dre:read | SessionAuthGuard, PermissionsGuard | DreController.entries |
| GET | /api/v1/finance/dre/entries/:id | dre:read | SessionAuthGuard, PermissionsGuard | DreController.entry |
| POST | /api/v1/finance/dre/entries | dre:read, dre:classify | SessionAuthGuard, PermissionsGuard | DreController.create |
| PUT | /api/v1/finance/dre/entries/:id | dre:read, dre:classify, dre:adjust | SessionAuthGuard, PermissionsGuard | DreController.edit |
| GET | /api/v1/finance/dre/report | dre:read | SessionAuthGuard, PermissionsGuard | DreController.report |
| GET | /api/v1/finance/dre/periods | dre:read | SessionAuthGuard, PermissionsGuard | DreController.periods |
| GET | /api/v1/finance/dre/periods/:month | dre:read | SessionAuthGuard, PermissionsGuard | DreController.period |
| POST | /api/v1/finance/dre/periods/:month/close | dre:read, dre:periods | SessionAuthGuard, PermissionsGuard | DreController.close |
| POST | /api/v1/finance/dre/periods/:month/reopen | dre:read, dre:periods | SessionAuthGuard, PermissionsGuard | DreController.reopen |
| POST | /api/v1/finance/dre/exports | dre:read, dre:export, export-jobs:create | SessionAuthGuard, PermissionsGuard | DreController.export |
| GET | /api/v1/finance/dre/exports/:id | dre:export | SessionAuthGuard, PermissionsGuard | DreController.status |
| GET | /api/v1/finance/dre/exports/:id/download | dre:export, export-jobs:download | SessionAuthGuard, PermissionsGuard | DreController.download |
| POST | /api/v1/organizations | Sessão/papel ou público conforme guards | SessionAuthGuard, RolesGuard | OrganizationsController.create |
| GET | /api/v1/organizations | Sessão/papel ou público conforme guards | SessionAuthGuard, RolesGuard | OrganizationsController.list |
| GET | /api/v1/organizations/:id | Sessão/papel ou público conforme guards | SessionAuthGuard, RolesGuard | OrganizationsController.getById |
| PATCH | /api/v1/organizations/:id | Sessão/papel ou público conforme guards | SessionAuthGuard, RolesGuard | OrganizationsController.update |
| POST | /api/v1/organizations/:id/deactivate | Sessão/papel ou público conforme guards | SessionAuthGuard, RolesGuard | OrganizationsController.deactivate |
| POST | /api/v1/organizations/:id/activate | Sessão/papel ou público conforme guards | SessionAuthGuard, RolesGuard | OrganizationsController.activate |
| POST | /api/v1/projects/:projectId/payments | payments:create | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.createPayment |
| GET | /api/v1/projects/:projectId/payments | payments:read | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.listPayments |
| GET | /api/v1/projects/:projectId/payments/summary | payments:read | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.paymentSummary |
| GET | /api/v1/projects/:projectId/payments/:id | payments:read | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.getPayment |
| PATCH | /api/v1/projects/:projectId/payments/:id | payments:update | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.updatePayment |
| POST | /api/v1/projects/:projectId/payments/:id/approve | payments:approve | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.approvePayment |
| POST | /api/v1/projects/:projectId/payments/:id/mark-as-paid | payments:mark-as-paid | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.markPaymentPaid |
| POST | /api/v1/projects/:projectId/payments/:id/cancel | payments:cancel | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.cancelPayment |
| POST | /api/v1/projects/:projectId/expenses | expenses:create | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.createExpense |
| GET | /api/v1/projects/:projectId/expenses | expenses:read | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.listExpenses |
| GET | /api/v1/projects/:projectId/expenses/:id | expenses:read | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.getExpense |
| PATCH | /api/v1/projects/:projectId/expenses/:id | expenses:update | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.updateExpense |
| POST | /api/v1/projects/:projectId/expenses/:id/approve | expenses:approve | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.approveExpense |
| POST | /api/v1/projects/:projectId/expenses/:id/reject | expenses:reject | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.rejectExpense |
| POST | /api/v1/projects/:projectId/expenses/:id/mark-as-paid | expenses:mark-as-paid | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.markExpensePaid |
| POST | /api/v1/projects/:projectId/expenses/:id/cancel | expenses:cancel | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.cancelExpense |
| POST | /api/v1/projects/:projectId/expenses/:expenseId/attachments/upload-url | expenses:upload-attachment | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.createAttachmentUploadUrl |
| POST | /api/v1/projects/:projectId/expenses/:expenseId/attachments/:attachmentId/confirm-upload | expenses:upload-attachment | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.confirmAttachment |
| GET | /api/v1/projects/:projectId/expenses/:expenseId/attachments | expenses:read | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.listAttachments |
| POST | /api/v1/projects/:projectId/expenses/:expenseId/attachments/:attachmentId/download-url | expenses:download-attachment | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.downloadAttachment |
| POST | /api/v1/projects/:projectId/expenses/:expenseId/attachments/:attachmentId/remove | expenses:upload-attachment | SessionAuthGuard, PermissionsGuard | PaymentsExpensesController.removeAttachment |
| GET | /api/v1/organization-overview | projects:read | SessionAuthGuard, PermissionsGuard | OrganizationOverviewController.get |
| GET | /api/v1/organization-overview/export.csv | projects:read | SessionAuthGuard, PermissionsGuard | OrganizationOverviewController.csv |
| GET | /api/v1/organization-overview/projects | projects:read | SessionAuthGuard, PermissionsGuard | OrganizationOverviewController.projects |
| GET | /api/v1/organization-overview/companies | projects:read | SessionAuthGuard, PermissionsGuard | OrganizationOverviewController.companies |
| GET | /api/v1/organization-overview/export.xlsx | projects:read | SessionAuthGuard, PermissionsGuard | OrganizationOverviewController.excel |
| GET | /api/v1/projects/:projectId/summary | projects:read | SessionAuthGuard, PermissionsGuard | ProjectDashboardController.summary |
| GET | /api/v1/projects/:projectId/dashboard | projects:read | SessionAuthGuard, PermissionsGuard | ProjectDashboardController.dashboard |
| GET | /api/v1/projects/:projectId/dashboard/analytics | projects:read | SessionAuthGuard, PermissionsGuard | ProjectDashboardController.dashboardAnalytics |
| GET | /api/v1/organizations/:organizationId/preparation-templates | project-preparation:read | SessionAuthGuard, PermissionsGuard | PreparationTemplatesController.list |
| POST | /api/v1/organizations/:organizationId/preparation-templates | project-preparation:read, project-preparation:edit | SessionAuthGuard, PermissionsGuard | PreparationTemplatesController.create |
| GET | /api/v1/organizations/:organizationId/preparation-templates/:id | project-preparation:read | SessionAuthGuard, PermissionsGuard | PreparationTemplatesController.get |
| GET | /api/v1/organizations/:organizationId/preparation-templates/:id/versions/:version | project-preparation:read | SessionAuthGuard, PermissionsGuard | PreparationTemplatesController.version |
| PATCH | /api/v1/organizations/:organizationId/preparation-templates/:id | project-preparation:read, project-preparation:edit | SessionAuthGuard, PermissionsGuard | PreparationTemplatesController.update |
| DELETE | /api/v1/organizations/:organizationId/preparation-templates/:id | project-preparation:read, project-preparation:edit | SessionAuthGuard, PermissionsGuard | PreparationTemplatesController.archive |
| POST | /api/v1/organizations/:organizationId/preparation-templates/:id/clone | project-preparation:read, project-preparation:edit | SessionAuthGuard, PermissionsGuard | PreparationTemplatesController.clone |
| GET | /api/v1/projects/:projectId/preparations/context | project-preparation:read | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.context |
| GET | /api/v1/projects/:projectId/preparations | project-preparation:read | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.list |
| POST | /api/v1/projects/:projectId/preparations | project-preparation:read, project-preparation:edit | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.create |
| GET | /api/v1/projects/:projectId/preparations/:id | project-preparation:read | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.get |
| PATCH | /api/v1/projects/:projectId/preparations/:id | project-preparation:read, project-preparation:edit | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.update |
| PATCH | /api/v1/projects/:projectId/preparations/:id/answers | project-preparation:read, project-preparation:edit | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.answers |
| POST | /api/v1/projects/:projectId/preparations/:id/approve | project-preparation:read, project-preparation:approve | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.approve |
| POST | /api/v1/projects/:projectId/preparations/:id/reopen | project-preparation:read, project-preparation:approve | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.reopen |
| DELETE | /api/v1/projects/:projectId/preparations/:id | project-preparation:read, project-preparation:edit | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.archive |
| GET | /api/v1/projects/:projectId/preparations/:id/history | project-preparation:read | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.history |
| GET | /api/v1/projects/:projectId/preparations/:id/communication | project-preparation:read | SessionAuthGuard, PermissionsGuard | ProjectPreparationController.communication |
| POST | /api/v1/projects | projects:create | SessionAuthGuard, PermissionsGuard | ProjectsController.create |
| GET | /api/v1/projects | projects:read | SessionAuthGuard, PermissionsGuard | ProjectsController.list |
| GET | /api/v1/projects/:id | projects:read | SessionAuthGuard, PermissionsGuard | ProjectsController.getById |
| PATCH | /api/v1/projects/:id | projects:update | SessionAuthGuard, PermissionsGuard | ProjectsController.update |
| POST | /api/v1/projects/:id/activate | projects:activate | SessionAuthGuard, PermissionsGuard | ProjectsController.activate |
| POST | /api/v1/projects/:id/pause | projects:pause | SessionAuthGuard, PermissionsGuard | ProjectsController.pause |
| POST | /api/v1/projects/:id/resume | projects:resume | SessionAuthGuard, PermissionsGuard | ProjectsController.resume |
| POST | /api/v1/projects/:id/deactivate | projects:deactivate | SessionAuthGuard, PermissionsGuard | ProjectsController.deactivate |
| POST | /api/v1/projects/:id/reactivate | projects:reactivate | SessionAuthGuard, PermissionsGuard | ProjectsController.reactivate |
| POST | /api/v1/projects/:id/finish | projects:finish | SessionAuthGuard, PermissionsGuard | ProjectsController.finish |
| POST | /api/v1/projects/:id/cancel | projects:cancel | SessionAuthGuard, PermissionsGuard | ProjectsController.cancel |
| POST | /api/v1/projects/:id/archive | projects:archive | SessionAuthGuard, PermissionsGuard | ProjectsController.archive |
| GET | /api/v1/finance/sources/:kind/:id | receivables:read, receivables:edit | SessionAuthGuard, PermissionsGuard | ReceivableController.source |
| GET | /api/v1/finance/receivables | receivables:read | SessionAuthGuard, PermissionsGuard | ReceivableController.list |
| POST | /api/v1/finance/receivables/preview | receivables:read, receivables:edit | SessionAuthGuard, PermissionsGuard | ReceivableController.preview |
| POST | /api/v1/finance/receivables | receivables:read, receivables:edit | SessionAuthGuard, PermissionsGuard | ReceivableController.create |
| GET | /api/v1/finance/receivables/:id | receivables:read | SessionAuthGuard, PermissionsGuard | ReceivableController.detail |
| PUT | /api/v1/finance/receivables/:id | receivables:read, receivables:edit | SessionAuthGuard, PermissionsGuard | ReceivableController.edit |
| POST | /api/v1/finance/receivables/:id/receipts | receivables:read, receivables:receive | SessionAuthGuard, PermissionsGuard | ReceivableController.receive |
| POST | /api/v1/finance/receivables/:id/receipts/:eventId/reverse | receivables:read, receivables:reverse | SessionAuthGuard, PermissionsGuard | ReceivableController.reverse |
| POST | /api/v1/finance/receivables/:id/cancel | receivables:read, receivables:edit | SessionAuthGuard, PermissionsGuard | ReceivableController.cancel |
| GET | /api/v1/finance/cash-flow | cash-flow:read | SessionAuthGuard, PermissionsGuard | ReceivableController.flow |
| POST | /api/v1/finance/exports | finance:export, export-jobs:create | SessionAuthGuard, PermissionsGuard | ReceivableController.export |
| GET | /api/v1/finance/exports/:id | finance:export | SessionAuthGuard, PermissionsGuard | ReceivableController.status |
| GET | /api/v1/finance/exports/:id/download | finance:export, export-jobs:download | SessionAuthGuard, PermissionsGuard | ReceivableController.download |
| GET | /api/v1/projects/:projectId/technical-reports/templates | projects:read, technical-reports:read | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.templates |
| GET | /api/v1/projects/:projectId/technical-reports/templates/:id | projects:read, technical-reports:read | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.template |
| POST | /api/v1/projects/:projectId/technical-reports/templates | projects:read, technical-reports:read, technical-reports:templates | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.createTemplate |
| PUT | /api/v1/projects/:projectId/technical-reports/templates/:id | projects:read, technical-reports:read, technical-reports:templates | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.editTemplate |
| POST | /api/v1/projects/:projectId/technical-reports/templates/:id/publish | projects:read, technical-reports:read, technical-reports:templates | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.publish |
| POST | /api/v1/projects/:projectId/technical-reports/templates/:id/archive | projects:read, technical-reports:read, technical-reports:templates | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.archiveTemplate |
| GET | /api/v1/projects/:projectId/technical-reports/responsibles | projects:read, technical-reports:read | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.responsibles |
| POST | /api/v1/projects/:projectId/technical-reports/responsibles | projects:read, technical-reports:read, technical-reports:templates | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.responsible |
| GET | /api/v1/projects/:projectId/technical-reports | projects:read, technical-reports:read | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.list |
| POST | /api/v1/projects/:projectId/technical-reports | projects:read, technical-reports:read, technical-reports:edit | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.create |
| GET | /api/v1/projects/:projectId/technical-reports/:id | projects:read, technical-reports:read | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.detail |
| PUT | /api/v1/projects/:projectId/technical-reports/:id | projects:read, technical-reports:read, technical-reports:edit | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.edit |
| POST | /api/v1/projects/:projectId/technical-reports/:id/refresh-sources | projects:read, technical-reports:read, technical-reports:edit | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.refresh |
| GET | /api/v1/projects/:projectId/technical-reports/:id/validation | projects:read, technical-reports:read | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.validate |
| POST | /api/v1/projects/:projectId/technical-reports/:id/transitions | projects:read, technical-reports:read, technical-reports:approve | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.transition |
| GET | /api/v1/projects/:projectId/technical-reports/:id/versions/:versionId | projects:read, technical-reports:read | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.version |
| GET | /api/v1/projects/:projectId/technical-reports/:id/versions/:versionId/export | projects:read, technical-reports:read, technical-reports:export | SessionAuthGuard, PermissionsGuard | TechnicalReportsController.export |
| GET | /api/v1/organizations/:organizationId/roles | org_roles:read | SessionAuthGuard, RolesGuard, PermissionsGuard, OrganizationScopeGuard | OrgRolesController.list |
| POST | /api/v1/organizations/:organizationId/roles | org_roles:write | SessionAuthGuard, RolesGuard, PermissionsGuard, OrganizationScopeGuard | OrgRolesController.create |
| GET | /api/v1/organizations/:organizationId/roles/:roleId | org_roles:read | SessionAuthGuard, RolesGuard, PermissionsGuard, OrganizationScopeGuard | OrgRolesController.getById |
| PATCH | /api/v1/organizations/:organizationId/roles/:roleId | org_roles:write | SessionAuthGuard, RolesGuard, PermissionsGuard, OrganizationScopeGuard | OrgRolesController.update |
| DELETE | /api/v1/organizations/:organizationId/roles/:roleId | org_roles:write | SessionAuthGuard, RolesGuard, PermissionsGuard, OrganizationScopeGuard | OrgRolesController.deactivate |
| GET | /api/v1/permissions | org_roles:read | SessionAuthGuard, RolesGuard, PermissionsGuard | PermissionsController.list |
| GET | /api/v1/users/:userId/role-assignments | users:read | SessionAuthGuard, RolesGuard, PermissionsGuard | UserRoleAssignmentsController.list |
| POST | /api/v1/users/:userId/role-assignments | users:write | SessionAuthGuard, RolesGuard, PermissionsGuard | UserRoleAssignmentsController.assign |
| DELETE | /api/v1/users/:userId/role-assignments/:assignmentId | users:write | SessionAuthGuard, RolesGuard, PermissionsGuard | UserRoleAssignmentsController.revoke |
| POST | /api/v1/users | users:write | SessionAuthGuard, RolesGuard, PermissionsGuard | UsersController.create |
| GET | /api/v1/users | users:read | SessionAuthGuard, RolesGuard, PermissionsGuard | UsersController.list |
| GET | /api/v1/users/:id | users:read | SessionAuthGuard, RolesGuard, PermissionsGuard | UsersController.getById |
| PATCH | /api/v1/users/:id | users:write | SessionAuthGuard, RolesGuard, PermissionsGuard | UsersController.update |
| POST | /api/v1/users/:id/deactivate | users:write | SessionAuthGuard, RolesGuard, PermissionsGuard | UsersController.deactivate |
| POST | /api/v1/users/:id/activate | users:write | SessionAuthGuard, RolesGuard, PermissionsGuard | UsersController.activate |

## Catálogo

| Chave | Escopo | Descrição |
| --- | --- | --- |
| organizations:read | PLATFORM | Listar e consultar organizations |
| organizations:write | PLATFORM | Criar e atualizar organizations |
| users:read | ORGANIZATION | Listar e consultar usuários da organization |
| users:write | ORGANIZATION | Criar e atualizar usuários da organization |
| org_roles:read | ORGANIZATION | Listar papéis customizados da organization |
| org_roles:write | ORGANIZATION | Gerenciar papéis customizados da organization |
| assets:read | ORGANIZATION | Reservado — leitura de ativos (módulo futuro) |
| assets:write | ORGANIZATION | Reservado — escrita de ativos (módulo futuro) |
| projects:create | ORGANIZATION | Criar projects da organization |
| projects:read | ORGANIZATION | Listar e consultar projects da organization |
| projects:update | ORGANIZATION | Atualizar projects da organization |
| projects:activate | ORGANIZATION | Ativar projects da organization |
| projects:pause | ORGANIZATION | Pausar projects da organization |
| projects:resume | ORGANIZATION | Retomar projects da organization |
| projects:deactivate | ORGANIZATION | Desativar projects da organization |
| projects:reactivate | ORGANIZATION | Reativar projects da organization |
| projects:finish | ORGANIZATION | Finalizar projects da organization |
| projects:cancel | ORGANIZATION | Cancelar projects da organization |
| projects:archive | ORGANIZATION | Arquivar projects da organization |
| field-agents:create | ORGANIZATION | Criar inventariantes da organization |
| field-agents:read | ORGANIZATION | Listar e consultar inventariantes da organization |
| field-agents:update | ORGANIZATION | Atualizar inventariantes da organization |
| field-agents:deactivate | ORGANIZATION | Desativar inventariantes da organization |
| field-agents:reactivate | ORGANIZATION | Reativar inventariantes da organization |
| field-agents:block | ORGANIZATION | Bloquear inventariantes da organization |
| field-agents:unblock | ORGANIZATION | Desbloquear inventariantes da organization |
| field-agents:delete | ORGANIZATION | Excluir inventariantes logicamente |
| project-field-agents:assign | ORGANIZATION | Vincular inventariantes a projects |
| project-field-agents:read | ORGANIZATION | Listar inventariantes de projects |
| project-field-agents:update | ORGANIZATION | Atualizar vinculos de inventariantes em projects |
| project-field-agents:remove | ORGANIZATION | Remover logicamente inventariantes de projects |
| inventory-items:create | ORGANIZATION | Criar itens inventariados da organization |
| inventory-items:read | ORGANIZATION | Listar e consultar itens inventariados da organization |
| inventory-items:update | ORGANIZATION | Atualizar itens inventariados da organization |
| inventory-items:deactivate | ORGANIZATION | Desativar itens inventariados da organization |
| inventory-items:reactivate | ORGANIZATION | Reativar itens inventariados da organization |
| inventory-item-images:create | ORGANIZATION | Criar URLs de upload de imagens dos itens inventariados |
| inventory-item-images:read | ORGANIZATION | Listar e consultar imagens dos itens inventariados |
| inventory-item-images:update | ORGANIZATION | Confirmar upload de imagens dos itens inventariados |
| inventory-item-images:remove | ORGANIZATION | Remover logicamente imagens dos itens inventariados |
| inventory-item-images:download | ORGANIZATION | Gerar URLs de download de imagens dos itens inventariados |
| inventory-accounting-items:create | ORGANIZATION | Criar itens da base contabil da organization |
| inventory-accounting-items:read | ORGANIZATION | Listar e consultar itens da base contabil da organization |
| inventory-accounting-items:update | ORGANIZATION | Atualizar itens da base contabil da organization |
| inventory-accounting-items:deactivate | ORGANIZATION | Desativar itens da base contabil da organization |
| inventory-accounting-items:reactivate | ORGANIZATION | Reativar itens da base contabil da organization |
| inventory-accounting-items:import | ORGANIZATION | Importar planilhas da base contabil da organization |
| inventory-accounting-items:export-errors | ORGANIZATION | Consultar relatorios de erro da importacao contabil |
| inventory-pending-issues:create | ORGANIZATION | Criar pendencias patrimoniais da organization |
| inventory-pending-issues:read | ORGANIZATION | Listar e consultar pendencias patrimoniais da organization |
| inventory-pending-issues:update | ORGANIZATION | Atualizar pendencias patrimoniais da organization |
| inventory-pending-issues:resolve | ORGANIZATION | Resolver pendencias patrimoniais da organization |
| inventory-pending-issues:ignore | ORGANIZATION | Ignorar pendencias patrimoniais da organization |
| inventory-pending-issues:cancel | ORGANIZATION | Cancelar pendencias patrimoniais da organization |
| inventory-pending-issues:generate | ORGANIZATION | Gerar pendencias patrimoniais automaticamente |
| expense-accountabilities:create | ORGANIZATION | Abrir prestacoes de contas |
| expense-accountabilities:read | ORGANIZATION | Consultar prestacoes de contas |
| expense-accountabilities:update | ORGANIZATION | Vincular despesas a prestacoes |
| expense-accountabilities:close | ORGANIZATION | Fechar prestacoes de contas |
| expense-installments:create | ORGANIZATION | Gerar parcelas de despesas |
| expense-installments:read | ORGANIZATION | Consultar parcelas de despesas |
| inventory-sessions:create | ORGANIZATION | Criar sessoes de inventario |
| inventory-sessions:read | ORGANIZATION | Consultar sessoes e historico de inventario |
| inventory-sessions:update | ORGANIZATION | Iniciar e finalizar sessoes e rodadas |
| inventory-rounds:reinventory | ORGANIZATION | Solicitar reinventario preservando historico |
| inventory-observations:create | ORGANIZATION | Registrar observacoes de campo |
| reconciliations:create | ORGANIZATION | Executar conciliacao fisico-contabil |
| reconciliations:read | ORGANIZATION | Consultar conciliacoes |
| consolidations:create | ORGANIZATION | Consolidar evidencias de conciliacao |
| asset-valuations:create | ORGANIZATION | Registrar avaliacao manual |
| asset-valuations:read | ORGANIZATION | Consultar historico de avaliacoes |
| plate-history:read | ORGANIZATION | Consultar historico e fontes de placas |
| payments:create | ORGANIZATION | Criar pagamentos de inventariantes |
| payments:read | ORGANIZATION | Listar e consultar pagamentos |
| payments:update | ORGANIZATION | Atualizar pagamentos |
| payments:approve | ORGANIZATION | Aprovar pagamentos |
| payments:mark-as-paid | ORGANIZATION | Marcar pagamentos como pagos |
| payments:cancel | ORGANIZATION | Cancelar pagamentos |
| payments:export | ORGANIZATION | Exportar pagamentos |
| expenses:create | ORGANIZATION | Criar despesas |
| expenses:read | ORGANIZATION | Listar e consultar despesas |
| expenses:update | ORGANIZATION | Atualizar despesas |
| expenses:approve | ORGANIZATION | Aprovar despesas |
| expenses:reject | ORGANIZATION | Rejeitar despesas |
| expenses:mark-as-paid | ORGANIZATION | Marcar despesas como pagas |
| expenses:cancel | ORGANIZATION | Cancelar despesas |
| expenses:upload-attachment | ORGANIZATION | Criar e confirmar comprovantes de despesas |
| expenses:download-attachment | ORGANIZATION | Baixar comprovantes de despesas |
| import-sessions:create | ORGANIZATION | Criar sessoes de importacao |
| import-sessions:read | ORGANIZATION | Listar e consultar sessoes de importacao |
| import-sessions:finish | ORGANIZATION | Finalizar sessoes de importacao |
| import-sessions:cancel | ORGANIZATION | Cancelar sessoes de importacao |
| import-sessions:retry | ORGANIZATION | Reprocessar sessoes com falha |
| import-payloads:create | ORGANIZATION | Receber payloads de importacao |
| import-payloads:read | ORGANIZATION | Listar e consultar payloads de importacao |
| import-payloads:reprocess | ORGANIZATION | Reprocessar payloads com falha |
| import-errors:read | ORGANIZATION | Consultar erros de importacao |
| import-files:create | ORGANIZATION | Criar e confirmar arquivos de importacao |
| import-files:read | ORGANIZATION | Listar arquivos de importacao |
| import-files:download | ORGANIZATION | Baixar arquivos de importacao |
| catalog-assets:create | ORGANIZATION | Criar ativos do catalogo da organization |
| catalog-assets:read | ORGANIZATION | Listar e consultar ativos do catalogo da organization |
| catalog-assets:update | ORGANIZATION | Atualizar ativos do catalogo da organization |
| catalog-assets:deactivate | ORGANIZATION | Desativar ativos do catalogo da organization |
| catalog-assets:reactivate | ORGANIZATION | Reativar ativos do catalogo da organization |
| export-jobs:create | ORGANIZATION | Solicitar exportacoes de projects |
| export-jobs:read | ORGANIZATION | Listar e consultar exportacoes de projects |
| export-jobs:download | ORGANIZATION | Baixar exportacoes de projects |
| export-jobs:cancel | ORGANIZATION | Cancelar exportacoes de projects |
| export-jobs:retry | ORGANIZATION | Repetir exportacoes de projects |
| companies:create | ORGANIZATION | Criar companies da organization |
| companies:read | ORGANIZATION | Listar e consultar companies |
| companies:update | ORGANIZATION | Atualizar companies |
| companies:deactivate | ORGANIZATION | Desativar companies |
| companies:reactivate | ORGANIZATION | Reativar companies |
| company-units:create | ORGANIZATION | Criar unidades de companies |
| company-units:read | ORGANIZATION | Listar e consultar unidades de companies |
| company-units:update | ORGANIZATION | Atualizar unidades de companies |
| company-units:deactivate | ORGANIZATION | Desativar unidades de companies |
| company-units:reactivate | ORGANIZATION | Reativar unidades de companies |
| project-units:assign | ORGANIZATION | Vincular unidades a projects |
| project-units:read | ORGANIZATION | Listar unidades de projects |
| project-units:remove | ORGANIZATION | Remover unidades de projects |
| project-preparation:read | ORGANIZATION | Consultar preparação, modelos, histórico e prévias de comunicação |
| project-preparation:edit | ORGANIZATION | Gerenciar modelos e preencher preparação dos projetos |
| project-preparation:approve | ORGANIZATION | Aprovar e reabrir preparação dos projetos |
| field-coordination:read | ORGANIZATION | Coordenação de campo: read |
| field-coordination:edit | ORGANIZATION | Coordenação de campo: edit |
| field-coordination:coordinate | ORGANIZATION | Coordenação de campo: coordinate |
| assisted-reconciliation:read | ORGANIZATION | Conciliação assistida: read |
| assisted-reconciliation:generate | ORGANIZATION | Conciliação assistida: generate |
| assisted-reconciliation:review | ORGANIZATION | Conciliação assistida: review |
| asset-valuations:batch-create | ORGANIZATION | Registrar avaliações patrimoniais em lote |
| contracts:read | ORGANIZATION | Gestão contratual: read |
| contracts:edit | ORGANIZATION | Gestão contratual: edit |
| contracts:amend | ORGANIZATION | Gestão contratual: amend |
| contracts:archive | ORGANIZATION | Gestão contratual: archive |
| commercial-indicators:read | ORGANIZATION | Gestão contratual: read |
| budgets:read | ORGANIZATION | Orçamentos: read |
| budgets:edit | ORGANIZATION | Orçamentos: edit |
| budgets:configure-prices | ORGANIZATION | Orçamentos: configure-prices |
| budgets:approve | ORGANIZATION | Orçamentos: approve |
| receivables:read | ORGANIZATION | Financeiro: read |
| receivables:edit | ORGANIZATION | Financeiro: edit |
| receivables:receive | ORGANIZATION | Financeiro: receive |
| receivables:reverse | ORGANIZATION | Financeiro: reverse |
| cash-flow:read | ORGANIZATION | Financeiro: read |
| finance:export | ORGANIZATION | Financeiro: export |
| dre:read | ORGANIZATION | DRE gerencial: read |
| dre:configure | ORGANIZATION | DRE gerencial: configure |
| dre:classify | ORGANIZATION | DRE gerencial: classify |
| dre:adjust | ORGANIZATION | DRE gerencial: adjust |
| dre:periods | ORGANIZATION | DRE gerencial: periods |
| dre:export | ORGANIZATION | DRE gerencial: export |
| budgets:export | ORGANIZATION | Documentos profissionais: budgets:export |
| documents:templates | ORGANIZATION | Documentos profissionais: documents:templates |
| technical-reports:read | ORGANIZATION | Laudos tecnicos: read |
| technical-reports:edit | ORGANIZATION | Laudos tecnicos: edit |
| technical-reports:templates | ORGANIZATION | Laudos tecnicos: templates |
| technical-reports:approve | ORGANIZATION | Laudos tecnicos: approve |
| technical-reports:export | ORGANIZATION | Laudos tecnicos: export |
