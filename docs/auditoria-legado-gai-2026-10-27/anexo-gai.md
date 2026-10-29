# Anexo — fontes, arquitetura e testes do GAI

Índice estático do estado atual do diretório de trabalho, incluindo arquivos locais não commitados. Tipos/rotas não comprovam execução. O relatório principal descreve achados, limites e plano. Todos os caminhos são do repositório; valores de ambientes/credenciais não são transcritos.

## Rotas HTTP, guards e permissões

### gai-backend/src/app.controller.ts

[gai-backend/src/app.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/app.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 5 | @Controller() |
| 7 | @Get('health') |

| Linha | Fim | Método |
|---|---|---|
| 7 | 10 | health |

### gai-backend/src/modules/auth/presentation/auth.controller.ts

[gai-backend/src/modules/auth/presentation/auth.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/presentation/auth.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 49 | @Controller('auth') |
| 59 | @Post('login') |
| 75 | @Post('logout') |
| 78 | @UseGuards(SessionAuthGuard) |
| 93 | @Get('me') |
| 95 | @UseGuards(SessionAuthGuard) |
| 106 | @Post('password-reset/request') |
| 123 | @Post('password-reset/confirm') |

| Linha | Fim | Método |
|---|---|---|
| 59 | 73 | login |
| 75 | 91 | logout |
| 93 | 104 | me |
| 106 | 121 | requestPasswordReset |
| 123 | 138 | confirmPasswordReset |
| 140 | 146 | extractIp |

### gai-backend/src/modules/catalog-assets/presentation/catalog-assets.controller.ts

[gai-backend/src/modules/catalog-assets/presentation/catalog-assets.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/presentation/catalog-assets.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 58 | @Controller('catalog-assets') |
| 59 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 69 | @Post() |
| 71 | @RequirePermissions('catalog-assets:create') |
| 86 | @Get() |
| 87 | @RequirePermissions('catalog-assets:read') |
| 100 | @Get(':id') |
| 101 | @RequirePermissions('catalog-assets:read') |
| 115 | @Patch(':id') |
| 116 | @RequirePermissions('catalog-assets:update') |
| 133 | @Post(':id/deactivate') |
| 135 | @RequirePermissions('catalog-assets:deactivate') |
| 149 | @Post(':id/reactivate') |
| 151 | @RequirePermissions('catalog-assets:reactivate') |

| Linha | Fim | Método |
|---|---|---|
| 69 | 84 | create |
| 86 | 98 | list |
| 100 | 113 | getById |
| 115 | 131 | update |
| 133 | 147 | deactivate |
| 149 | 163 | reactivate |
| 165 | 171 | toActor |

### gai-backend/src/modules/companies/presentation/companies.controller.ts

[gai-backend/src/modules/companies/presentation/companies.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/presentation/companies.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 64 | @Controller() |
| 65 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 69 | @Post('companies') |
| 71 | @RequirePermissions('companies:create') |
| 85 | @Get('companies') |
| 86 | @RequirePermissions('companies:read') |
| 96 | @Get('companies/:id') |
| 97 | @RequirePermissions('companies:read') |
| 109 | @Patch('companies/:id') |
| 110 | @RequirePermissions('companies:update') |
| 122 | @Post('companies/:id/deactivate') |
| 124 | @RequirePermissions('companies:deactivate') |
| 138 | @Post('companies/:id/reactivate') |
| 140 | @RequirePermissions('companies:reactivate') |
| 154 | @Post('companies/:companyId/units') |
| 156 | @RequirePermissions('company-units:create') |
| 167 | @Get('companies/:companyId/units') |
| 168 | @RequirePermissions('company-units:read') |
| 179 | @Get('companies/:companyId/units/:unitId') |
| 180 | @RequirePermissions('company-units:read') |
| 191 | @Patch('companies/:companyId/units/:unitId') |
| 192 | @RequirePermissions('company-units:update') |
| 204 | @Post('companies/:companyId/units/:unitId/deactivate') |
| 206 | @RequirePermissions('company-units:deactivate') |
| 222 | @Post('companies/:companyId/units/:unitId/reactivate') |
| 224 | @RequirePermissions('company-units:reactivate') |
| 240 | @Post('projects/:projectId/units') |
| 242 | @RequirePermissions('project-units:assign') |
| 253 | @Get('projects/:projectId/units') |
| 254 | @RequirePermissions('project-units:read') |
| 264 | @Post('projects/:projectId/units/:unitId/remove') |
| 266 | @RequirePermissions('project-units:remove') |

| Linha | Fim | Método |
|---|---|---|
| 69 | 83 | createCompany |
| 85 | 94 | listCompanies |
| 96 | 107 | getCompany |
| 109 | 120 | updateCompany |
| 122 | 136 | deactivateCompany |
| 138 | 152 | reactivateCompany |
| 154 | 165 | createUnit |
| 167 | 177 | listUnits |
| 179 | 189 | getUnit |
| 191 | 202 | updateUnit |
| 204 | 220 | deactivateUnit |
| 222 | 238 | reactivateUnit |
| 240 | 251 | assignProjectUnit |
| 253 | 262 | listProjectUnits |
| 264 | 279 | removeProjectUnit |
| 281 | 287 | toActor |

### gai-backend/src/modules/expense-accountabilities/expense-accountabilities.controller.ts

[gai-backend/src/modules/expense-accountabilities/expense-accountabilities.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/expense-accountabilities/expense-accountabilities.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 38 | @Controller('projects/:projectId') |
| 39 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 42 | @Post('expense-accountabilities') |
| 44 | @RequirePermissions('expense-accountabilities:create') |
| 53 | @Get('expense-accountabilities') |
| 54 | @RequirePermissions('expense-accountabilities:read') |
| 63 | @Get('expense-accountabilities/:id') |
| 64 | @RequirePermissions('expense-accountabilities:read') |
| 73 | @Post('expense-accountabilities/:id/expenses') |
| 75 | @RequirePermissions('expense-accountabilities:update') |
| 85 | @Post('expense-accountabilities/:id/close') |
| 87 | @RequirePermissions('expense-accountabilities:close') |
| 96 | @Post('expenses/:expenseId/installments/generate') |
| 98 | @RequirePermissions('expense-installments:create') |
| 115 | @Get('expenses/:expenseId/installments') |
| 116 | @RequirePermissions('expense-installments:read') |

| Linha | Fim | Método |
|---|---|---|
| 42 | 52 | create |
| 53 | 62 | list |
| 63 | 72 | get |
| 73 | 84 | addExpense |
| 85 | 95 | close |
| 96 | 114 | generateInstallments |
| 115 | 130 | listInstallments |
| 131 | 137 | actor |

### gai-backend/src/modules/export-jobs/presentation/export-jobs.controller.ts

[gai-backend/src/modules/export-jobs/presentation/export-jobs.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/export-jobs/presentation/export-jobs.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 70 | @Controller('projects/:projectId/export-jobs') |
| 71 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 75 | @Post() |
| 77 | @RequirePermissions('export-jobs:create') |
| 88 | @Get() |
| 89 | @RequirePermissions('export-jobs:read') |
| 100 | @Get(':jobId/download') |
| 101 | @RequirePermissions('export-jobs:download') |
| 141 | @Get(':jobId') |
| 142 | @RequirePermissions('export-jobs:read') |
| 153 | @Post(':jobId/download-url') |
| 155 | @RequirePermissions('export-jobs:download') |
| 174 | @Post(':jobId/cancel') |
| 176 | @RequirePermissions('export-jobs:cancel') |
| 191 | @Post(':jobId/retry') |
| 193 | @RequirePermissions('export-jobs:retry') |

| Linha | Fim | Método |
|---|---|---|
| 75 | 86 | create |
| 88 | 98 | list |
| 100 | 139 | download |
| 141 | 151 | get |
| 153 | 172 | createDownloadUrl |
| 174 | 189 | cancel |
| 191 | 206 | retry |
| 208 | 214 | toActor |

### gai-backend/src/modules/field-agents/presentation/field-agents.controller.ts

[gai-backend/src/modules/field-agents/presentation/field-agents.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/presentation/field-agents.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 58 | @Controller('field-agents') |
| 59 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 70 | @Post() |
| 72 | @RequirePermissions('field-agents:create') |
| 90 | @Get() |
| 91 | @RequirePermissions('field-agents:read') |
| 104 | @Get(':id') |
| 105 | @RequirePermissions('field-agents:read') |
| 119 | @Patch(':id') |
| 120 | @RequirePermissions('field-agents:update') |
| 137 | @Post(':id/deactivate') |
| 139 | @RequirePermissions('field-agents:deactivate') |
| 153 | @Post(':id/reactivate') |
| 155 | @RequirePermissions('field-agents:reactivate') |
| 169 | @Post(':id/block') |
| 171 | @RequirePermissions('field-agents:block') |
| 181 | @Post(':id/unblock') |
| 183 | @RequirePermissions('field-agents:unblock') |
| 197 | @Delete(':id') |
| 199 | @RequirePermissions('field-agents:delete') |

| Linha | Fim | Método |
|---|---|---|
| 70 | 88 | create |
| 90 | 102 | list |
| 104 | 117 | getById |
| 119 | 135 | update |
| 137 | 151 | deactivate |
| 153 | 167 | reactivate |
| 169 | 179 | block |
| 181 | 195 | unblock |
| 197 | 207 | delete |
| 209 | 215 | toActor |

### gai-backend/src/modules/field-agents/presentation/project-field-agents.controller.ts

[gai-backend/src/modules/field-agents/presentation/project-field-agents.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/presentation/project-field-agents.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 57 | @Controller('projects/:projectId/field-agents') |
| 58 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 67 | @Post() |
| 69 | @RequirePermissions('project-field-agents:assign') |
| 93 | @Get() |
| 94 | @RequirePermissions('project-field-agents:read') |
| 113 | @Patch(':assignmentId') |
| 114 | @RequirePermissions('project-field-agents:update') |
| 141 | @Post(':assignmentId/remove') |
| 143 | @RequirePermissions('project-field-agents:remove') |

| Linha | Fim | Método |
|---|---|---|
| 67 | 91 | assign |
| 93 | 111 | list |
| 113 | 139 | update |
| 141 | 165 | remove |
| 167 | 173 | toActor |

### gai-backend/src/modules/import-sessions/presentation/import-sessions.controller.ts

[gai-backend/src/modules/import-sessions/presentation/import-sessions.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/presentation/import-sessions.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 62 | @Controller('projects/:projectId/import-sessions') |
| 63 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 67 | @Post() |
| 69 | @RequirePermissions('import-sessions:create') |
| 80 | @Get() |
| 81 | @RequirePermissions('import-sessions:read') |
| 91 | @Get('by-uuid/:sessionUuid') |
| 92 | @RequirePermissions('import-sessions:read') |
| 106 | @Get(':sessionId') |
| 107 | @RequirePermissions('import-sessions:read') |
| 117 | @Post(':sessionId/finish') |
| 119 | @RequirePermissions('import-sessions:finish') |
| 129 | @Post(':sessionId/cancel') |
| 131 | @RequirePermissions('import-sessions:cancel') |
| 141 | @Post(':sessionId/retry') |
| 143 | @RequirePermissions('import-sessions:retry') |
| 153 | @Post(':sessionId/payloads') |
| 155 | @RequirePermissions('import-payloads:create') |
| 171 | @Post(':sessionId/physical-observations/import') |
| 173 | @RequirePermissions('import-payloads:create') |
| 174 | @UseInterceptors(FileInterceptor('file')) |
| 207 | @Get(':sessionId/payloads') |
| 208 | @RequirePermissions('import-payloads:read') |
| 224 | @Get(':sessionId/payloads/:payloadId') |
| 225 | @RequirePermissions('import-payloads:read') |
| 241 | @Post(':sessionId/payloads/:payloadId/reprocess') |
| 243 | @RequirePermissions('import-payloads:reprocess') |
| 259 | @Get(':sessionId/errors') |
| 260 | @RequirePermissions('import-errors:read') |
| 276 | @Get(':sessionId/payloads/:payloadId/errors') |
| 277 | @RequirePermissions('import-errors:read') |
| 295 | @Post(':sessionId/files/upload-url') |
| 297 | @RequirePermissions('import-files:create') |
| 313 | @Post(':sessionId/files/:fileId/confirm-upload') |
| 315 | @RequirePermissions('import-files:create') |
| 333 | @Get(':sessionId/files') |
| 334 | @RequirePermissions('import-files:read') |
| 344 | @Post(':sessionId/files/:fileId/download-url') |
| 346 | @RequirePermissions('import-files:download') |

| Linha | Fim | Método |
|---|---|---|
| 67 | 78 | createSession |
| 80 | 89 | listSessions |
| 91 | 104 | getSessionByUuid |
| 106 | 115 | getSession |
| 117 | 127 | finishSession |
| 129 | 139 | cancelSession |
| 141 | 151 | retrySession |
| 153 | 169 | receivePayload |
| 171 | 205 | importPhysicalFile |
| 207 | 222 | listPayloads |
| 224 | 239 | getPayload |
| 241 | 257 | reprocessPayload |
| 259 | 274 | listSessionErrors |
| 276 | 293 | listPayloadErrors |
| 295 | 311 | createFileUploadUrl |
| 313 | 331 | confirmFileUpload |
| 333 | 342 | listFiles |
| 344 | 360 | createFileDownloadUrl |
| 362 | 368 | toActor |

### gai-backend/src/modules/inventory-accounting-items/presentation/inventory-accounting-items.controller.ts

[gai-backend/src/modules/inventory-accounting-items/presentation/inventory-accounting-items.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-accounting-items/presentation/inventory-accounting-items.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 54 | @Controller('projects/:projectId') |
| 55 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 59 | @Post('accounting-imports') |
| 61 | @RequirePermissions('inventory-accounting-items:import') |
| 62 | @UseInterceptors(FileInterceptor('file')) |
| 83 | @Get('accounting-imports') |
| 84 | @RequirePermissions('inventory-accounting-items:read') |
| 95 | @Get('accounting-imports/:batchId') |
| 96 | @RequirePermissions('inventory-accounting-items:read') |
| 107 | @Get('accounting-imports/:batchId/errors') |
| 108 | @RequirePermissions('inventory-accounting-items:export-errors') |
| 118 | @Get('inventory-accounting-items') |
| 119 | @RequirePermissions('inventory-accounting-items:read') |
| 130 | @Get('inventory-accounting-items/:id') |
| 131 | @RequirePermissions('inventory-accounting-items:read') |
| 142 | @Patch('inventory-accounting-items/:id') |
| 143 | @RequirePermissions('inventory-accounting-items:update') |
| 155 | @Post('inventory-accounting-items/:id/deactivate') |
| 157 | @RequirePermissions('inventory-accounting-items:deactivate') |
| 173 | @Post('inventory-accounting-items/:id/reactivate') |
| 175 | @RequirePermissions('inventory-accounting-items:reactivate') |

| Linha | Fim | Método |
|---|---|---|
| 59 | 81 | importAccountingItems |
| 83 | 93 | listBatches |
| 95 | 105 | getBatch |
| 107 | 116 | getBatchErrors |
| 118 | 128 | listItems |
| 130 | 140 | getItem |
| 142 | 153 | updateItem |
| 155 | 171 | deactivate |
| 173 | 189 | reactivate |
| 191 | 199 | toActor |

### gai-backend/src/modules/inventory-item-images/presentation/inventory-item-images.controller.ts

[gai-backend/src/modules/inventory-item-images/presentation/inventory-item-images.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/presentation/inventory-item-images.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 60 | @Controller() |
| 61 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 72 | @Post('projects/:projectId/inventory-items/:itemId/images/upload-url') |
| 74 | @RequirePermissions('inventory-item-images:create') |
| 101 | @Post( 'projects/:projectId/inventory-items/:itemId/images/:imageId/confirm-upload', ) |
| 105 | @RequirePermissions('inventory-item-images:update') |
| 132 | @Get('projects/:projectId/inventory-items/:itemId/images') |
| 133 | @RequirePermissions('inventory-item-images:read') |
| 145 | @Get('projects/:projectId/inventory-items/:itemId/images/:imageId') |
| 146 | @RequirePermissions('inventory-item-images:read') |
| 164 | @Post( 'projects/:projectId/inventory-items/:itemId/images/:imageId/download-url', ) |
| 168 | @RequirePermissions('inventory-item-images:download') |
| 190 | @Post('projects/:projectId/inventory-items/:itemId/images/:imageId/remove') |
| 192 | @RequirePermissions('inventory-item-images:remove') |
| 216 | @Get('inventory-item-images/:id') |
| 217 | @RequirePermissions('inventory-item-images:read') |
| 227 | @Post('inventory-item-images/:id/download-url') |
| 229 | @RequirePermissions('inventory-item-images:download') |

| Linha | Fim | Método |
|---|---|---|
| 72 | 99 | requestUploadUrl |
| 101 | 130 | confirmUploadUrl |
| 132 | 143 | list |
| 145 | 162 | getByProject |
| 164 | 188 | requestDownloadUrl |
| 190 | 214 | remove |
| 216 | 225 | getById |
| 227 | 237 | requestDownloadUrlById |
| 239 | 245 | toActor |

### gai-backend/src/modules/inventory-items/presentation/inventory-items.controller.ts

[gai-backend/src/modules/inventory-items/presentation/inventory-items.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/presentation/inventory-items.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 58 | @Controller() |
| 59 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 69 | @Post('projects/:projectId/inventory-items') |
| 71 | @RequirePermissions('inventory-items:create') |
| 91 | @Get('projects/:projectId/inventory-items') |
| 92 | @RequirePermissions('inventory-items:read') |
| 104 | @Get('projects/:projectId/inventory-items/:id') |
| 105 | @RequirePermissions('inventory-items:read') |
| 121 | @Patch('projects/:projectId/inventory-items/:id') |
| 122 | @RequirePermissions('inventory-items:update') |
| 149 | @Post('projects/:projectId/inventory-items/:id/deactivate') |
| 151 | @RequirePermissions('inventory-items:deactivate') |
| 167 | @Post('projects/:projectId/inventory-items/:id/reactivate') |
| 169 | @RequirePermissions('inventory-items:reactivate') |
| 185 | @Get('inventory-items') |
| 186 | @RequirePermissions('inventory-items:read') |
| 196 | @Get('inventory-items/:id') |
| 197 | @RequirePermissions('inventory-items:read') |

| Linha | Fim | Método |
|---|---|---|
| 69 | 89 | create |
| 91 | 102 | listByProject |
| 104 | 119 | getByProject |
| 121 | 147 | update |
| 149 | 165 | deactivate |
| 167 | 183 | reactivate |
| 185 | 194 | list |
| 196 | 206 | getById |
| 208 | 214 | toActor |

### gai-backend/src/modules/inventory-operations/presentation/inventory-operations.controller.ts

[gai-backend/src/modules/inventory-operations/presentation/inventory-operations.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-operations/presentation/inventory-operations.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 53 | @Controller('projects/:projectId') |
| 54 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 58 | @Post('inventory-sessions') |
| 60 | @RequirePermissions('inventory-sessions:create') |
| 71 | @Get('inventory-sessions') |
| 72 | @RequirePermissions('inventory-sessions:read') |
| 82 | @Get('inventory-sessions/:sessionId') |
| 83 | @RequirePermissions('inventory-sessions:read') |
| 93 | @Get('inventory-sessions/:sessionId/rounds') |
| 94 | @RequirePermissions('inventory-sessions:read') |
| 110 | @Post('inventory-sessions/:sessionId/start') |
| 112 | @RequirePermissions('inventory-sessions:update') |
| 122 | @Post('inventory-sessions/:sessionId/finish') |
| 124 | @RequirePermissions('inventory-sessions:update') |
| 134 | @Post('inventory-sessions/:sessionId/cancel') |
| 136 | @RequirePermissions('inventory-sessions:update') |
| 152 | @Post('inventory-sessions/:sessionId/reinventory') |
| 154 | @RequirePermissions('inventory-rounds:reinventory') |
| 172 | @Post('inventory-sessions/:sessionId/rounds/:roundId/observations') |
| 174 | @RequirePermissions('inventory-observations:create') |
| 192 | @Post( 'inventory-sessions/:sessionId/rounds/:roundId/observations/:observationId/evidence/upload-url', ) |
| 196 | @RequirePermissions('inventory-observations:create') |
| 216 | @Post( 'inventory-sessions/:sessionId/rounds/:roundId/observations/:observationId/evidence/:evidenceId/confirm-upload', ) |
| 220 | @RequirePermissions('inventory-observations:create') |
| 242 | @Get( 'inventory-sessions/:sessionId/rounds/:roundId/observations/:observationId/evidence', ) |
| 245 | @RequirePermissions('inventory-sessions:read') |
| 265 | @Post( 'inventory-sessions/:sessionId/rounds/:roundId/observations/:observationId/evidence/:evidenceId/download-url', ) |
| 269 | @RequirePermissions('inventory-sessions:read') |
| 289 | @Get('inventory-sessions/:sessionId/observations') |
| 290 | @RequirePermissions('inventory-sessions:read') |
| 306 | @Post('inventory-sessions/:sessionId/rounds/:roundId/finish') |
| 308 | @RequirePermissions('inventory-sessions:update') |
| 324 | @Post('inventory-sessions/:sessionId/reconciliations') |
| 326 | @RequirePermissions('reconciliations:create') |
| 336 | @Get('inventory-sessions/:sessionId/reconciliations') |
| 337 | @RequirePermissions('reconciliations:read') |
| 353 | @Post('inventory-sessions/:sessionId/reconciliations/:id/consolidate') |
| 355 | @RequirePermissions('consolidations:create') |
| 373 | @Post('inventory-items/:itemId/valuations') |
| 375 | @RequirePermissions('asset-valuations:create') |
| 391 | @Get('inventory-items/:itemId/valuations') |
| 392 | @RequirePermissions('asset-valuations:read') |
| 408 | @Get('inventory-items/:itemId/plate-history') |
| 409 | @RequirePermissions('plate-history:read') |

| Linha | Fim | Método |
|---|---|---|
| 58 | 69 | createSession |
| 71 | 80 | listSessions |
| 82 | 91 | getSession |
| 93 | 108 | listRounds |
| 110 | 120 | startSession |
| 122 | 132 | finishSession |
| 134 | 150 | cancelSession |
| 152 | 170 | requestReinventory |
| 172 | 190 | createObservation |
| 192 | 214 | createEvidenceUploadUrl |
| 216 | 240 | confirmEvidenceUpload |
| 242 | 263 | listObservationEvidence |
| 265 | 287 | createEvidenceDownloadUrl |
| 289 | 304 | listObservations |
| 306 | 322 | finishRound |
| 324 | 334 | reconcile |
| 336 | 351 | listReconciliations |
| 353 | 371 | consolidate |
| 373 | 389 | createValuation |
| 391 | 406 | listValuations |
| 408 | 423 | listPlateHistory |
| 425 | 431 | actor |

### gai-backend/src/modules/inventory-pending-issues/presentation/inventory-pending-issues.controller.ts

[gai-backend/src/modules/inventory-pending-issues/presentation/inventory-pending-issues.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-pending-issues/presentation/inventory-pending-issues.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 49 | @Controller('projects/:projectId/pending-issues') |
| 50 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 54 | @Post() |
| 56 | @RequirePermissions('inventory-pending-issues:create') |
| 68 | @Get() |
| 69 | @RequirePermissions('inventory-pending-issues:read') |
| 80 | @Post('generate') |
| 82 | @RequirePermissions('inventory-pending-issues:generate') |
| 92 | @Get(':id') |
| 93 | @RequirePermissions('inventory-pending-issues:read') |
| 104 | @Patch(':id') |
| 105 | @RequirePermissions('inventory-pending-issues:update') |
| 117 | @Post(':id/resolve') |
| 119 | @RequirePermissions('inventory-pending-issues:resolve') |
| 131 | @Post(':id/ignore') |
| 133 | @RequirePermissions('inventory-pending-issues:ignore') |
| 145 | @Post(':id/cancel') |
| 147 | @RequirePermissions('inventory-pending-issues:cancel') |

| Linha | Fim | Método |
|---|---|---|
| 54 | 66 | create |
| 68 | 78 | list |
| 80 | 90 | generate |
| 92 | 102 | get |
| 104 | 115 | update |
| 117 | 129 | resolve |
| 131 | 143 | ignore |
| 145 | 156 | cancel |
| 158 | 166 | toActor |

### gai-backend/src/modules/organizations/presentation/organizations.controller.ts

[gai-backend/src/modules/organizations/presentation/organizations.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/presentation/organizations.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 54 | @Controller('organizations') |
| 55 | @UseGuards(SessionAuthGuard, RolesGuard) |
| 56 | @Roles(UserRole.PLATFORM_ADMIN) |
| 67 | @Post() |
| 92 | @Get() |
| 106 | @Get(':id') |
| 120 | @Patch(':id') |
| 140 | @Post(':id/deactivate') |
| 162 | @Post(':id/activate') |

| Linha | Fim | Método |
|---|---|---|
| 67 | 90 | create |
| 92 | 104 | list |
| 106 | 118 | getById |
| 120 | 138 | update |
| 140 | 160 | deactivate |
| 162 | 182 | activate |

### gai-backend/src/modules/payments-expenses/presentation/payments-expenses.controller.ts

[gai-backend/src/modules/payments-expenses/presentation/payments-expenses.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/payments-expenses/presentation/payments-expenses.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 59 | @Controller('projects/:projectId') |
| 60 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 64 | @Post('payments') |
| 66 | @RequirePermissions('payments:create') |
| 76 | @Get('payments') |
| 77 | @RequirePermissions('payments:read') |
| 86 | @Get('payments/summary') |
| 87 | @RequirePermissions('payments:read') |
| 95 | @Get('payments/:id') |
| 96 | @RequirePermissions('payments:read') |
| 105 | @Patch('payments/:id') |
| 106 | @RequirePermissions('payments:update') |
| 116 | @Post('payments/:id/approve') |
| 118 | @RequirePermissions('payments:approve') |
| 127 | @Post('payments/:id/mark-as-paid') |
| 129 | @RequirePermissions('payments:mark-as-paid') |
| 139 | @Post('payments/:id/cancel') |
| 141 | @RequirePermissions('payments:cancel') |
| 151 | @Post('expenses') |
| 153 | @RequirePermissions('expenses:create') |
| 162 | @Get('expenses') |
| 163 | @RequirePermissions('expenses:read') |
| 172 | @Get('expenses/:id') |
| 173 | @RequirePermissions('expenses:read') |
| 182 | @Patch('expenses/:id') |
| 183 | @RequirePermissions('expenses:update') |
| 193 | @Post('expenses/:id/approve') |
| 195 | @RequirePermissions('expenses:approve') |
| 204 | @Post('expenses/:id/reject') |
| 206 | @RequirePermissions('expenses:reject') |
| 216 | @Post('expenses/:id/mark-as-paid') |
| 218 | @RequirePermissions('expenses:mark-as-paid') |
| 227 | @Post('expenses/:id/cancel') |
| 229 | @RequirePermissions('expenses:cancel') |
| 239 | @Post('expenses/:expenseId/attachments/upload-url') |
| 241 | @RequirePermissions('expenses:upload-attachment') |
| 256 | @Post('expenses/:expenseId/attachments/:attachmentId/confirm-upload') |
| 258 | @RequirePermissions('expenses:upload-attachment') |
| 275 | @Get('expenses/:expenseId/attachments') |
| 276 | @RequirePermissions('expenses:read') |
| 289 | @Post('expenses/:expenseId/attachments/:attachmentId/download-url') |
| 291 | @RequirePermissions('expenses:download-attachment') |
| 306 | @Post('expenses/:expenseId/attachments/:attachmentId/remove') |
| 308 | @RequirePermissions('expenses:upload-attachment') |

| Linha | Fim | Método |
|---|---|---|
| 64 | 75 | createPayment |
| 76 | 85 | listPayments |
| 86 | 94 | paymentSummary |
| 95 | 104 | getPayment |
| 105 | 115 | updatePayment |
| 116 | 126 | approvePayment |
| 127 | 138 | markPaymentPaid |
| 139 | 149 | cancelPayment |
| 151 | 161 | createExpense |
| 162 | 171 | listExpenses |
| 172 | 181 | getExpense |
| 182 | 192 | updateExpense |
| 193 | 203 | approveExpense |
| 204 | 215 | rejectExpense |
| 216 | 226 | markExpensePaid |
| 227 | 237 | cancelExpense |
| 239 | 255 | createAttachmentUploadUrl |
| 256 | 274 | confirmAttachment |
| 275 | 288 | listAttachments |
| 289 | 305 | downloadAttachment |
| 306 | 322 | removeAttachment |
| 324 | 330 | toActor |

### gai-backend/src/modules/project-dashboard/presentation/organization-overview.controller.ts

[gai-backend/src/modules/project-dashboard/presentation/organization-overview.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/project-dashboard/presentation/organization-overview.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 15 | @Controller('organization-overview') |
| 16 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 17 | @RequirePermissions('projects:read') |
| 23 | @Get() |
| 28 | @Get('export.csv') |
| 38 | @Get('projects') |
| 43 | @Get('companies') |
| 48 | @Get('export.xlsx') |

| Linha | Fim | Método |
|---|---|---|
| 11 | 13 | safeSpreadsheetText |
| 21 | 21 | actor |
| 23 | 26 | get |
| 28 | 36 | csv |
| 38 | 41 | projects |
| 43 | 46 | companies |
| 48 | 56 | excel |

### gai-backend/src/modules/project-dashboard/presentation/project-dashboard.controller.ts

[gai-backend/src/modules/project-dashboard/presentation/project-dashboard.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/project-dashboard/presentation/project-dashboard.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 44 | @Controller('projects/:projectId') |
| 45 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 52 | @Get('summary') |
| 53 | @RequirePermissions('projects:read') |
| 69 | @Get('dashboard') |
| 70 | @RequirePermissions('projects:read') |
| 86 | @Get('dashboard/analytics') |
| 87 | @RequirePermissions('projects:read') |

| Linha | Fim | Método |
|---|---|---|
| 52 | 67 | summary |
| 69 | 84 | dashboard |
| 86 | 105 | dashboardAnalytics |
| 107 | 113 | toActor |

### gai-backend/src/modules/projects/presentation/projects.controller.ts

[gai-backend/src/modules/projects/presentation/projects.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/presentation/projects.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 57 | @Controller('projects') |
| 58 | @UseGuards(SessionAuthGuard, PermissionsGuard) |
| 68 | @Post() |
| 70 | @RequirePermissions('projects:create') |
| 87 | @Get() |
| 88 | @RequirePermissions('projects:read') |
| 101 | @Get(':id') |
| 102 | @RequirePermissions('projects:read') |
| 116 | @Patch(':id') |
| 117 | @RequirePermissions('projects:update') |
| 137 | @Post(':id/activate') |
| 139 | @RequirePermissions( ProjectStatusTransitionPolicy.getRule('activate').permission, ) |
| 158 | @Post(':id/pause') |
| 160 | @RequirePermissions(ProjectStatusTransitionPolicy.getRule('pause').permission) |
| 177 | @Post(':id/resume') |
| 179 | @RequirePermissions( ProjectStatusTransitionPolicy.getRule('resume').permission, ) |
| 198 | @Post(':id/deactivate') |
| 200 | @RequirePermissions( ProjectStatusTransitionPolicy.getRule('deactivate').permission, ) |
| 223 | @Post(':id/reactivate') |
| 225 | @RequirePermissions( ProjectStatusTransitionPolicy.getRule('reactivate').permission, ) |
| 251 | @Post(':id/finish') |
| 253 | @RequirePermissions( ProjectStatusTransitionPolicy.getRule('finish').permission, ) |
| 272 | @Post(':id/cancel') |
| 274 | @RequirePermissions( ProjectStatusTransitionPolicy.getRule('cancel').permission, ) |
| 293 | @Post(':id/archive') |
| 295 | @RequirePermissions( ProjectStatusTransitionPolicy.getRule('archive').permission, ) |

| Linha | Fim | Método |
|---|---|---|
| 68 | 85 | create |
| 87 | 99 | list |
| 101 | 114 | getById |
| 116 | 135 | update |
| 137 | 156 | activate |
| 158 | 175 | pause |
| 177 | 196 | resume |
| 198 | 221 | deactivate |
| 223 | 249 | reactivate |
| 251 | 270 | finish |
| 272 | 291 | cancel |
| 293 | 312 | archive |
| 314 | 320 | toActor |

### gai-backend/src/modules/users/presentation/org-roles.controller.ts

[gai-backend/src/modules/users/presentation/org-roles.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/presentation/org-roles.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 57 | @Controller('organizations/:organizationId/roles') |
| 58 | @UseGuards( SessionAuthGuard, RolesGuard, PermissionsGuard, OrganizationScopeGuard, ) |
| 64 | @Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN) |
| 74 | @Get() |
| 75 | @RequirePermissions('org_roles:read') |
| 95 | @Post() |
| 97 | @RequirePermissions('org_roles:write') |
| 117 | @Get(':roleId') |
| 118 | @RequirePermissions('org_roles:read') |
| 134 | @Patch(':roleId') |
| 135 | @RequirePermissions('org_roles:write') |
| 162 | @Delete(':roleId') |
| 164 | @RequirePermissions('org_roles:write') |

| Linha | Fim | Método |
|---|---|---|
| 74 | 93 | list |
| 95 | 115 | create |
| 117 | 132 | getById |
| 134 | 160 | update |
| 162 | 186 | deactivate |
| 188 | 194 | toActor |

### gai-backend/src/modules/users/presentation/permissions.controller.ts

[gai-backend/src/modules/users/presentation/permissions.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/presentation/permissions.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 25 | @Controller('permissions') |
| 26 | @UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard) |
| 27 | @Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN) |
| 31 | @Get() |
| 32 | @RequirePermissions('org_roles:read') |

| Linha | Fim | Método |
|---|---|---|
| 31 | 40 | list |

### gai-backend/src/modules/users/presentation/user-role-assignments.controller.ts

[gai-backend/src/modules/users/presentation/user-role-assignments.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/presentation/user-role-assignments.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 50 | @Controller('users/:userId/role-assignments') |
| 51 | @UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard) |
| 52 | @Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN) |
| 60 | @Get() |
| 61 | @RequirePermissions('users:read') |
| 75 | @Post() |
| 77 | @RequirePermissions('users:write') |
| 93 | @Delete(':assignmentId') |
| 95 | @RequirePermissions('users:write') |

| Linha | Fim | Método |
|---|---|---|
| 60 | 73 | list |
| 75 | 91 | assign |
| 93 | 117 | revoke |
| 119 | 125 | toActor |

### gai-backend/src/modules/users/presentation/users.controller.ts

[gai-backend/src/modules/users/presentation/users.controller.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/presentation/users.controller.ts)

| Linha | Contrato/decorator |
|---|---|
| 58 | @Controller('users') |
| 59 | @UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard) |
| 60 | @Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN) |
| 71 | @Post() |
| 73 | @RequirePermissions('users:write') |
| 87 | @Get() |
| 88 | @RequirePermissions('users:read') |
| 100 | @Get(':id') |
| 101 | @RequirePermissions('users:read') |
| 115 | @Patch(':id') |
| 116 | @RequirePermissions('users:write') |
| 136 | @Post(':id/deactivate') |
| 138 | @RequirePermissions('users:write') |
| 156 | @Post(':id/activate') |
| 158 | @RequirePermissions('users:write') |

| Linha | Fim | Método |
|---|---|---|
| 71 | 85 | create |
| 87 | 98 | list |
| 100 | 113 | getById |
| 115 | 134 | update |
| 136 | 154 | deactivate |
| 156 | 170 | activate |
| 172 | 178 | toActor |

## Entidades TypeORM e campos

### gai-backend/src/modules/auth/infrastructure/persistence/auth-audit-log.entity.ts

[gai-backend/src/modules/auth/infrastructure/persistence/auth-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/infrastructure/persistence/auth-audit-log.entity.ts)

Classe `AuthAuditLogEntity`, linha 16.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 18 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 21 | userId | number \| null | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 24 | operation | AuthAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| 27 | ipAddress | string \| null | @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true }) |
| 30 | result | AuthAuditResult | @Column({ type: 'varchar', length: 20 }) |
| 33 | metadata | Record<string, unknown> \| null | @Column({ type: 'json', nullable: true }) |
| 36 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 16 | @Entity('auth_audit_logs') |

### gai-backend/src/modules/auth/infrastructure/persistence/password-reset-token.entity.ts

[gai-backend/src/modules/auth/infrastructure/persistence/password-reset-token.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/infrastructure/persistence/password-reset-token.entity.ts)

Classe `PasswordResetTokenEntity`, linha 14.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 18 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 21 | userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| 24 | tokenHash | string | @Column({ name: 'token_hash', type: 'varchar', length: 64 }) |
| 27 | expiresAt | Date | @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) |
| 30 | usedAt | Date \| null | @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true }) |
| 33 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 14 | @Entity('password_reset_tokens') |
| 15 | @Index('idx_reset_tokens_user_id', ['userId']) |
| 16 | @Index('idx_reset_tokens_hash', ['tokenHash']) |

### gai-backend/src/modules/auth/infrastructure/persistence/session.entity.ts

[gai-backend/src/modules/auth/infrastructure/persistence/session.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/infrastructure/persistence/session.entity.ts)

Classe `SessionEntity`, linha 11.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 18 | userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| 21 | organizationId | number \| null | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 24 | expiresAt | Date | @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) |
| 27 | revokedAt | Date \| null | @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true, }) |
| 35 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 38 | lastActivityAt | Date | @Column({ name: 'last_activity_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 11 | @Entity('sessions') |
| 12 | @Index('idx_sessions_user_id', ['userId']) |
| 13 | @Index('idx_sessions_expires_at', ['expiresAt']) |

### gai-backend/src/modules/auth/infrastructure/persistence/user.entity.ts

[gai-backend/src/modules/auth/infrastructure/persistence/user.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/infrastructure/persistence/user.entity.ts)

Classe `UserEntity`, linha 15.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 19 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 22 | organizationId | number \| null | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 25 | login | string | @Column({ type: 'varchar', length: 100, unique: true }) |
| 28 | email | string | @Column({ type: 'varchar', length: 255, unique: true }) |
| 31 | passwordHash | string | @Column({ name: 'password_hash', type: 'varchar', length: 255 }) |
| 34 | status | UserStatus | @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE }) |
| 37 | failedLoginAttempts | number | @Column({ name: 'failed_login_attempts', type: 'int', default: 0 }) |
| 40 | lockedUntil | Date \| null | @Column({ name: 'locked_until', type: 'datetime', precision: 3, nullable: true, }) |
| 48 | passwordChangedAt | Date | @Column({ name: 'password_changed_at', type: 'datetime', precision: 3 }) |
| 51 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 54 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 15 | @Entity('users') |
| 16 | @Index('idx_users_organization_id', ['organizationId']) |
| 17 | @Index('idx_users_status', ['status']) |

### gai-backend/src/modules/catalog-assets/infrastructure/persistence/catalog-asset-audit-log.entity.ts

[gai-backend/src/modules/catalog-assets/infrastructure/persistence/catalog-asset-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/infrastructure/persistence/catalog-asset-audit-log.entity.ts)

Classe `CatalogAssetAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 17 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 20 | catalogAssetId | number | @Column({ name: 'catalog_asset_id', ...FOREIGN_KEY_COLUMN }) |
| 23 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 26 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 29 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 32 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 35 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('catalog_asset_audit_logs') |
| 14 | @Index('idx_catalog_asset_audit_asset_created', ['catalogAssetId', 'createdAt']) |
| 15 | @Index('idx_catalog_asset_audit_organization_id', ['organizationId']) |

### gai-backend/src/modules/catalog-assets/infrastructure/persistence/catalog-asset.entity.ts

[gai-backend/src/modules/catalog-assets/infrastructure/persistence/catalog-asset.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/infrastructure/persistence/catalog-asset.entity.ts)

Classe `CatalogAssetEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 26 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 29 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 32 | description | string | @Column({ type: 'varchar', length: 255 }) |
| 35 | descriptionNormalized | string | @Column({ name: 'description_normalized', type: 'varchar', length: 255 }) |
| 38 | category | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| 41 | status | CatalogAssetStatus | @Column({ type: 'varchar', length: 20, default: CatalogAssetStatus.ACTIVE }) |
| 44 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 47 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 50 | updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 53 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 56 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 59 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('catalog_assets') |
| 18 | @Index('idx_catalog_assets_org_status', ['organizationId', 'status']) |
| 19 | @Index('idx_catalog_assets_org_category', ['organizationId', 'category']) |
| 20 | @Index( 'uq_catalog_assets_org_description_normalized', ['organizationId', 'descriptionNormalized'], { unique: true }, ) |

### gai-backend/src/modules/companies/infrastructure/persistence/company-audit-log.entity.ts

[gai-backend/src/modules/companies/infrastructure/persistence/company-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/infrastructure/persistence/company-audit-log.entity.ts)

Classe `CompanyAuditLogEntity`, linha 15.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 19 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 22 | companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| 25 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 28 | operation | CompanyAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| 31 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 34 | changes | JsonRecord | @Column({ type: 'json' }) |
| 37 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 15 | @Entity('company_audit_logs') |
| 16 | @Index('idx_company_audit_company_created', ['companyId', 'createdAt']) |
| 17 | @Index('idx_company_audit_organization_id', ['organizationId']) |

### gai-backend/src/modules/companies/infrastructure/persistence/company-unit-audit-log.entity.ts

[gai-backend/src/modules/companies/infrastructure/persistence/company-unit-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/infrastructure/persistence/company-unit-audit-log.entity.ts)

Classe `CompanyUnitAuditLogEntity`, linha 15.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 19 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 22 | companyUnitId | number | @Column({ name: 'company_unit_id', ...FOREIGN_KEY_COLUMN }) |
| 25 | companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| 28 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 31 | operation | CompanyAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| 34 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 37 | changes | JsonRecord | @Column({ type: 'json' }) |
| 40 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 15 | @Entity('company_unit_audit_logs') |
| 16 | @Index('idx_company_unit_audit_unit_created', ['companyUnitId', 'createdAt']) |
| 17 | @Index('idx_company_unit_audit_organization_id', ['organizationId']) |

### gai-backend/src/modules/companies/infrastructure/persistence/company-unit.entity.ts

[gai-backend/src/modules/companies/infrastructure/persistence/company-unit.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/infrastructure/persistence/company-unit.entity.ts)

Classe `CompanyUnitEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 35 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 38 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 41 | companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| 44 | name | string | @Column({ type: 'varchar', length: 255 }) |
| 47 | code | string \| null | @Column({ type: 'varchar', length: 80, nullable: true }) |
| 50 | zipcode | string \| null | @Column({ type: 'varchar', length: 20, nullable: true }) |
| 53 | address | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 56 | number | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 59 | complement | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 62 | district | string \| null | @Column({ type: 'varchar', length: 120, nullable: true }) |
| 65 | city | string \| null | @Column({ type: 'varchar', length: 120, nullable: true }) |
| 68 | state | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 71 | country | string \| null | @Column({ type: 'varchar', length: 80, nullable: true, default: 'BR' }) |
| 74 | status | CompanyUnitStatus | @Column({ type: 'varchar', length: 20, default: CompanyUnitStatus.ACTIVE }) |
| 77 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 80 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 83 | updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 86 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 89 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 92 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('company_units') |
| 18 | @Index('idx_company_units_organization_company_status', [ 'organizationId', 'companyId', 'status', ]) |
| 23 | @Index('idx_company_units_organization_company_code', [ 'organizationId', 'companyId', 'code', ]) |
| 28 | @Index('idx_company_units_organization_city_state', [ 'organizationId', 'city', 'state', ]) |
| 33 | @Index('idx_company_units_name', ['name']) |

### gai-backend/src/modules/companies/infrastructure/persistence/company.entity.ts

[gai-backend/src/modules/companies/infrastructure/persistence/company.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/infrastructure/persistence/company.entity.ts)

Classe `CompanyEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 29 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 32 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 35 | name | string | @Column({ type: 'varchar', length: 255 }) |
| 38 | corporateName | string \| null | @Column({ name: 'corporate_name', type: 'varchar', length: 255, nullable: true, }) |
| 46 | document | string \| null | @Column({ type: 'varchar', length: 20, nullable: true }) |
| 49 | stateRegistration | string \| null | @Column({ name: 'state_registration', type: 'varchar', length: 50, nullable: true, }) |
| 57 | municipalRegistration | string \| null | @Column({ name: 'municipal_registration', type: 'varchar', length: 50, nullable: true, }) |
| 65 | email | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 68 | phone | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 71 | zipcode | string \| null | @Column({ type: 'varchar', length: 20, nullable: true }) |
| 74 | address | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 77 | number | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 80 | complement | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 83 | district | string \| null | @Column({ type: 'varchar', length: 120, nullable: true }) |
| 86 | city | string \| null | @Column({ type: 'varchar', length: 120, nullable: true }) |
| 89 | state | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 92 | country | string \| null | @Column({ type: 'varchar', length: 80, nullable: true, default: 'BR' }) |
| 95 | status | CompanyStatus | @Column({ type: 'varchar', length: 20, default: CompanyStatus.ACTIVE }) |
| 98 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 101 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 104 | updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 107 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 110 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 113 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('companies') |
| 18 | @Index('idx_companies_organization_status', ['organizationId', 'status']) |
| 19 | @Index('idx_companies_organization_document', ['organizationId', 'document'], { unique: true, }) |
| 22 | @Index('idx_companies_organization_city_state', [ 'organizationId', 'city', 'state', ]) |
| 27 | @Index('idx_companies_name', ['name']) |

### gai-backend/src/modules/companies/infrastructure/persistence/project-unit-audit-log.entity.ts

[gai-backend/src/modules/companies/infrastructure/persistence/project-unit-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/infrastructure/persistence/project-unit-audit-log.entity.ts)

Classe `ProjectUnitAuditLogEntity`, linha 15.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 19 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 22 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 25 | companyUnitId | number | @Column({ name: 'company_unit_id', ...FOREIGN_KEY_COLUMN }) |
| 28 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 31 | operation | CompanyAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| 34 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 37 | changes | JsonRecord | @Column({ type: 'json' }) |
| 40 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 15 | @Entity('project_unit_audit_logs') |
| 16 | @Index('idx_project_unit_audit_project_created', ['projectId', 'createdAt']) |
| 17 | @Index('idx_project_unit_audit_organization_id', ['organizationId']) |

### gai-backend/src/modules/companies/infrastructure/persistence/project-unit.entity.ts

[gai-backend/src/modules/companies/infrastructure/persistence/project-unit.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/infrastructure/persistence/project-unit.entity.ts)

Classe `ProjectUnitEntity`, linha 15.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 29 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 32 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 35 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 38 | companyUnitId | number | @Column({ name: 'company_unit_id', ...FOREIGN_KEY_COLUMN }) |
| 41 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 44 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 47 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 15 | @Entity('project_units') |
| 16 | @Index('idx_project_units_organization_project', [ 'organizationId', 'projectId', ]) |
| 20 | @Index('idx_project_units_organization_unit', [ 'organizationId', 'companyUnitId', ]) |
| 24 | @Index('idx_project_units_project_deleted', ['projectId', 'deletedAt']) |
| 25 | @Index('uq_project_units_project_unit', ['projectId', 'companyUnitId'], { unique: true, }) |

### gai-backend/src/modules/expense-accountabilities/expense-accountability.entity.ts

[gai-backend/src/modules/expense-accountabilities/expense-accountability.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/expense-accountabilities/expense-accountability.entity.ts)

Classe `ExpenseAccountabilityEntity`, linha 20.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 23 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 24 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 26 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 27 | fieldAgentId | number | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN }) |
| 29 | periodStart | Date | @Column({ name: 'period_start', type: 'date' }) |
| 30 | periodEnd | Date | @Column({ name: 'period_end', type: 'date' }) |
| 31 | status | ExpenseAccountabilityStatus | @Column({ type: 'varchar', length: 20, default: ExpenseAccountabilityStatus.OPEN, }) |
| 37 | totalAmount | string | @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: '0.00', }) |
| 45 | notes | string \| null | @Column({ type: 'text', nullable: true }) |
| 46 | responsibleById | number \| null | @Column({ name: 'responsible_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 48 | closedById | number \| null | @Column({ name: 'closed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 50 | closedAt | Date \| null | @Column({ name: 'closed_at', type: 'datetime', precision: 3, nullable: true }) |
| 52 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 54 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

Classe `ExpenseAccountabilityItemEntity`, linha 58.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 63 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 64 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 66 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 67 | accountabilityId | number | @Column({ name: 'accountability_id', ...FOREIGN_KEY_COLUMN }) |
| 69 | expenseId | number | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) |
| 70 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

Classe `ExpenseInstallmentEntity`, linha 74.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 81 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 82 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 84 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 85 | expenseId | number | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) |
| 86 | installmentNumber | number | @Column({ name: 'installment_number', type: 'int', unsigned: true }) |
| 88 | installmentCount | number | @Column({ name: 'installment_count', type: 'int', unsigned: true }) |
| 90 | dueDate | Date | @Column({ name: 'due_date', type: 'date' }) |
| 91 | amount | string | @Column({ type: 'decimal', precision: 15, scale: 2 }) |
| 92 | origin | \| string     \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 95 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

Classe `ExpenseAccountabilityAuditLogEntity`, linha 99.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 102 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 103 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 105 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 106 | accountabilityId | number \| null | @Column({ name: 'accountability_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 108 | expenseId | number \| null | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 110 | operation | string | @Column({ type: 'varchar', length: 60 }) |
| 111 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 113 | changes | Record<string, unknown> | @Column({ type: 'json' }) |
| 114 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 20 | @Entity('expense_accountabilities') |
| 21 | @Index('idx_expense_accountabilities_project_status', ['projectId', 'status']) |
| 58 | @Entity('expense_accountability_items') |
| 59 | @Index('uq_expense_accountability_items_expense', ['expenseId'], { unique: true, }) |
| 74 | @Entity('expense_installments') |
| 75 | @Index( 'uq_expense_installments_expense_number', ['expenseId', 'installmentNumber'], { unique: true }, ) |
| 99 | @Entity('expense_accountability_audit_logs') |
| 100 | @Index('idx_expense_accountability_audit_project', ['projectId', 'createdAt']) |

### gai-backend/src/modules/export-jobs/infrastructure/persistence/export-job-audit-log.entity.ts

[gai-backend/src/modules/export-jobs/infrastructure/persistence/export-job-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/export-jobs/infrastructure/persistence/export-job-audit-log.entity.ts)

Classe `ExportJobAuditLogEntity`, linha 14.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 18 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 21 | exportJobId | number | @Column({ name: 'export_job_id', ...FOREIGN_KEY_COLUMN }) |
| 24 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 27 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 30 | operation | ExportJobAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| 33 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 36 | changes | Record<string, unknown> | @Column({ type: 'json' }) |
| 39 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 14 | @Entity('export_job_audit_logs') |
| 15 | @Index('idx_export_job_audit_job_created', ['exportJobId', 'createdAt']) |
| 16 | @Index('idx_export_job_audit_org_project', ['organizationId', 'projectId']) |

### gai-backend/src/modules/export-jobs/infrastructure/persistence/export-job.entity.ts

[gai-backend/src/modules/export-jobs/infrastructure/persistence/export-job.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/export-jobs/infrastructure/persistence/export-job.entity.ts)

Classe `ExportJobEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 31 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 34 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 37 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 40 | type | ExportJobType | @Column({ type: 'varchar', length: 60 }) |
| 43 | status | ExportJobStatus | @Column({ type: 'varchar', length: 20, default: ExportJobStatus.PENDING }) |
| 46 | fileName | string \| null | @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true }) |
| 49 | mimeType | string \| null | @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true }) |
| 52 | sizeBytes | number \| null | @Column({ name: 'size_bytes', type: 'bigint', unsigned: true, nullable: true, }) |
| 60 | fileContent | Buffer \| null | @Column({ name: 'file_content', type: process.env.NODE_ENV === 'test' ? 'blob' : 'mediumblob', nullable: true, select: false, }) |
| 68 | checksum | string \| null | @Column({ type: 'varchar', length: 64, nullable: true }) |
| 71 | requestedById | number \| null | @Column({ name: 'requested_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 74 | retryOfId | number \| null | @Column({ name: 'retry_of_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 77 | attemptCount | number | @Column({ name: 'attempt_count', type: 'int', unsigned: true, default: 1 }) |
| 80 | requestedAt | Date | @Column({ name: 'requested_at', type: 'datetime', precision: 3 }) |
| 83 | startedAt | Date \| null | @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true, }) |
| 91 | finishedAt | Date \| null | @Column({ name: 'finished_at', type: 'datetime', precision: 3, nullable: true, }) |
| 99 | expiresAt | Date \| null | @Column({ name: 'expires_at', type: 'datetime', precision: 3, nullable: true, }) |
| 107 | errorCode | string \| null | @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true }) |
| 110 | errorMessage | string \| null | @Column({ name: 'error_message', type: 'text', nullable: true }) |
| 113 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 116 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 119 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('export_jobs') |
| 18 | @Index('idx_export_jobs_org_project_status', [ 'organizationId', 'projectId', 'status', ]) |
| 23 | @Index('idx_export_jobs_project_type_created', [ 'projectId', 'type', 'createdAt', ]) |
| 28 | @Index('idx_export_jobs_status_created', ['status', 'createdAt']) |
| 29 | @Index('idx_export_jobs_expires_at', ['expiresAt']) |

### gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity.ts

[gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity.ts)

Classe `FieldAgentAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 17 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 20 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 23 | fieldAgentId | number \| null | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 26 | projectFieldAgentId | number \| null | @Column({ name: 'project_field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true, }) |
| 33 | projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 36 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 39 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 42 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 45 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('field_agent_audit_logs') |
| 14 | @Index('idx_field_agent_audit_agent_created', ['fieldAgentId', 'createdAt']) |
| 15 | @Index('idx_field_agent_audit_project_created', ['projectId', 'createdAt']) |

### gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent.entity.ts

[gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent.entity.ts)

Classe `FieldAgentEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 22 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 25 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 28 | userId | number \| null | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 31 | name | string | @Column({ type: 'varchar', length: 255 }) |
| 34 | email | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 37 | phone | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 40 | document | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 43 | status | FieldAgentStatus | @Column({ type: 'varchar', length: 20, default: FieldAgentStatus.ACTIVE }) |
| 46 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 49 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 52 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 55 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('field_agents') |
| 18 | @Index('idx_field_agents_organization_status', ['organizationId', 'status']) |
| 19 | @Index('idx_field_agents_user_id', ['userId']) |
| 20 | @Index('idx_field_agents_name', ['name']) |

### gai-backend/src/modules/field-agents/infrastructure/persistence/project-field-agent.entity.ts

[gai-backend/src/modules/field-agents/infrastructure/persistence/project-field-agent.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/infrastructure/persistence/project-field-agent.entity.ts)

Classe `ProjectFieldAgentEntity`, linha 15.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 19 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 22 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 25 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 28 | fieldAgentId | number | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN }) |
| 31 | role | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| 34 | status | ProjectFieldAgentStatus | @Column({ type: 'varchar', length: 20, default: ProjectFieldAgentStatus.ACTIVE, }) |
| 41 | startDate | Date \| null | @Column({ name: 'start_date', type: 'date', nullable: true }) |
| 44 | endDate | Date \| null | @Column({ name: 'end_date', type: 'date', nullable: true }) |
| 47 | notes | string \| null | @Column({ type: 'text', nullable: true }) |
| 50 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 53 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 15 | @Entity('project_field_agents') |
| 16 | @Index('idx_project_field_agents_project_status', ['projectId', 'status']) |
| 17 | @Index('idx_project_field_agents_agent_status', ['fieldAgentId', 'status']) |

### gai-backend/src/modules/import-sessions/infrastructure/persistence/import-file.entity.ts

[gai-backend/src/modules/import-sessions/infrastructure/persistence/import-file.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/infrastructure/persistence/import-file.entity.ts)

Classe `ImportFileEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 20 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 23 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 26 | importSessionId | number | @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN }) |
| 29 | importPayloadId | number \| null | @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 32 | type | ImportFileType | @Column({ type: 'varchar', length: 30 }) |
| 35 | storageProvider | string | @Column({ name: 'storage_provider', type: 'varchar', length: 50 }) |
| 38 | bucket | string | @Column({ type: 'varchar', length: 255 }) |
| 41 | path | string | @Column({ type: 'varchar', length: 500 }) |
| 44 | originalName | string | @Column({ name: 'original_name', type: 'varchar', length: 255 }) |
| 47 | mimeType | string | @Column({ name: 'mime_type', type: 'varchar', length: 100 }) |
| 50 | sizeBytes | number | @Column({ name: 'size_bytes', type: 'bigint', unsigned: true }) |
| 53 | checksum | string \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| 56 | status | ImportFileStatus | @Column({ type: 'varchar', length: 20, default: ImportFileStatus.PENDING_UPLOAD, }) |
| 63 | uploadedById | number \| null | @Column({ name: 'uploaded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 66 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 69 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 72 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('import_files') |
| 18 | @Index('idx_import_files_session_status', ['importSessionId', 'status']) |

### gai-backend/src/modules/import-sessions/infrastructure/persistence/import-payload-error.entity.ts

[gai-backend/src/modules/import-sessions/infrastructure/persistence/import-payload-error.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/infrastructure/persistence/import-payload-error.entity.ts)

Classe `ImportPayloadErrorEntity`, linha 14.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 18 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 21 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 24 | importSessionId | number | @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN }) |
| 27 | importPayloadId | number | @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN }) |
| 30 | rowNumber | number \| null | @Column({ name: 'row_number', type: 'int', unsigned: true, nullable: true }) |
| 33 | itemReference | string \| null | @Column({ name: 'item_reference', type: 'varchar', length: 150, nullable: true, }) |
| 41 | errorCode | string | @Column({ name: 'error_code', type: 'varchar', length: 80 }) |
| 44 | errorMessage | string | @Column({ name: 'error_message', type: 'text' }) |
| 47 | rawData | JsonRecord \| null | @Column({ name: 'raw_data', type: 'json', nullable: true }) |
| 50 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 14 | @Entity('import_payload_errors') |
| 15 | @Index('idx_import_payload_errors_session', ['importSessionId', 'createdAt']) |
| 16 | @Index('idx_import_payload_errors_payload', ['importPayloadId', 'createdAt']) |

### gai-backend/src/modules/import-sessions/infrastructure/persistence/import-payload.entity.ts

[gai-backend/src/modules/import-sessions/infrastructure/persistence/import-payload.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/infrastructure/persistence/import-payload.entity.ts)

Classe `ImportPayloadEntity`, linha 16.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 29 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 32 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 35 | importSessionId | number | @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN }) |
| 38 | payloadNumber | number | @Column({ name: 'payload_number', type: 'int', unsigned: true }) |
| 41 | idempotencyKey | string | @Column({ name: 'idempotency_key', type: 'varchar', length: 128 }) |
| 44 | checksum | string \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| 47 | status | ImportPayloadStatus | @Column({ type: 'varchar', length: 20, default: ImportPayloadStatus.RECEIVED, }) |
| 54 | itemsCount | number | @Column({ name: 'items_count', type: 'int', unsigned: true, default: 0 }) |
| 57 | imagesCount | number | @Column({ name: 'images_count', type: 'int', unsigned: true, default: 0 }) |
| 60 | createdCount | number | @Column({ name: 'created_count', type: 'int', unsigned: true, default: 0 }) |
| 63 | updatedCount | number | @Column({ name: 'updated_count', type: 'int', unsigned: true, default: 0 }) |
| 66 | deletedCount | number | @Column({ name: 'deleted_count', type: 'int', unsigned: true, default: 0 }) |
| 69 | failedCount | number | @Column({ name: 'failed_count', type: 'int', unsigned: true, default: 0 }) |
| 72 | rawPayloadPath | string \| null | @Column({ name: 'raw_payload_path', type: 'varchar', length: 500, nullable: true, }) |
| 80 | receivedAt | Date | @Column({ name: 'received_at', type: 'datetime', precision: 3 }) |
| 83 | processedAt | Date \| null | @Column({ name: 'processed_at', type: 'datetime', precision: 3, nullable: true, }) |
| 91 | errorMessage | string \| null | @Column({ name: 'error_message', type: 'text', nullable: true }) |
| 94 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 97 | payload | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 100 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 103 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 16 | @Entity('import_payloads') |
| 17 | @Index( 'idx_import_payloads_session_number', ['importSessionId', 'payloadNumber'], { unique: true }, ) |
| 22 | @Index( 'idx_import_payloads_session_key', ['importSessionId', 'idempotencyKey'], { unique: true }, ) |
| 27 | @Index('idx_import_payloads_org_status', ['organizationId', 'status']) |

### gai-backend/src/modules/import-sessions/infrastructure/persistence/import-session-audit-log.entity.ts

[gai-backend/src/modules/import-sessions/infrastructure/persistence/import-session-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/infrastructure/persistence/import-session-audit-log.entity.ts)

Classe `ImportSessionAuditLogEntity`, linha 15.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 18 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 21 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 24 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 27 | importSessionId | number \| null | @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 30 | importPayloadId | number \| null | @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 33 | importFileId | number \| null | @Column({ name: 'import_file_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 36 | operation | ImportOperation | @Column({ type: 'varchar', length: 60 }) |
| 39 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 42 | changes | JsonRecord | @Column({ type: 'json' }) |
| 45 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 15 | @Entity('import_session_audit_logs') |
| 16 | @Index('idx_import_session_audit_project_created', ['projectId', 'createdAt']) |

### gai-backend/src/modules/import-sessions/infrastructure/persistence/import-session.entity.ts

[gai-backend/src/modules/import-sessions/infrastructure/persistence/import-session.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/infrastructure/persistence/import-session.entity.ts)

Classe `ImportSessionEntity`, linha 19.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 28 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 31 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 34 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 37 | type | ImportSessionType | @Column({ type: 'varchar', length: 40 }) |
| 40 | source | ImportSessionSource | @Column({ type: 'varchar', length: 30 }) |
| 43 | status | ImportSessionStatus | @Column({ type: 'varchar', length: 20, default: ImportSessionStatus.OPEN }) |
| 46 | sessionUuid | string | @Column({ name: 'session_uuid', type: 'varchar', length: 64 }) |
| 49 | expectedPayloads | number \| null | @Column({ name: 'expected_payloads', type: 'int', unsigned: true, nullable: true, }) |
| 57 | receivedPayloads | number | @Column({ name: 'received_payloads', type: 'int', unsigned: true, default: 0, }) |
| 65 | processedPayloads | number | @Column({ name: 'processed_payloads', type: 'int', unsigned: true, default: 0, }) |
| 73 | failedPayloads | number | @Column({ name: 'failed_payloads', type: 'int', unsigned: true, default: 0 }) |
| 76 | totalItems | number | @Column({ name: 'total_items', type: 'int', unsigned: true, default: 0 }) |
| 79 | totalImages | number | @Column({ name: 'total_images', type: 'int', unsigned: true, default: 0 }) |
| 82 | totalCreated | number | @Column({ name: 'total_created', type: 'int', unsigned: true, default: 0 }) |
| 85 | totalUpdated | number | @Column({ name: 'total_updated', type: 'int', unsigned: true, default: 0 }) |
| 88 | totalDeleted | number | @Column({ name: 'total_deleted', type: 'int', unsigned: true, default: 0 }) |
| 91 | totalFailed | number | @Column({ name: 'total_failed', type: 'int', unsigned: true, default: 0 }) |
| 94 | rawBackupPath | string \| null | @Column({ name: 'raw_backup_path', type: 'varchar', length: 500, nullable: true, }) |
| 102 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 105 | startedAt | Date \| null | @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true, }) |
| 113 | finishedAt | Date \| null | @Column({ name: 'finished_at', type: 'datetime', precision: 3, nullable: true, }) |
| 121 | expiresAt | Date \| null | @Column({ name: 'expires_at', type: 'datetime', precision: 3, nullable: true, }) |
| 129 | errorMessage | string \| null | @Column({ name: 'error_message', type: 'text', nullable: true }) |
| 132 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 135 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 138 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 141 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 19 | @Entity('import_sessions') |
| 20 | @Index('idx_import_sessions_org_project_status', [ 'organizationId', 'projectId', 'status', ]) |
| 25 | @Index('idx_import_sessions_project_created', ['projectId', 'createdAt']) |
| 26 | @Index('idx_import_sessions_session_uuid', ['sessionUuid'], { unique: true }) |

### gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/accounting-import-batch.entity.ts

[gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/accounting-import-batch.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/accounting-import-batch.entity.ts)

Classe `AccountingImportBatchEntity`, linha 16.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 23 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 26 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 29 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 32 | originalFileName | string | @Column({ name: 'original_file_name', type: 'varchar', length: 255 }) |
| 35 | storageProvider | string \| null | @Column({ name: 'storage_provider', type: 'varchar', length: 50, nullable: true, }) |
| 43 | bucket | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 46 | path | string \| null | @Column({ type: 'varchar', length: 500, nullable: true }) |
| 49 | status | AccountingImportBatchStatus | @Column({ type: 'varchar', length: 20, default: AccountingImportBatchStatus.PENDING, }) |
| 56 | totalRows | number | @Column({ name: 'total_rows', type: 'int', unsigned: true, default: 0 }) |
| 59 | processedRows | number | @Column({ name: 'processed_rows', type: 'int', unsigned: true, default: 0 }) |
| 62 | successRows | number | @Column({ name: 'success_rows', type: 'int', unsigned: true, default: 0 }) |
| 65 | failedRows | number | @Column({ name: 'failed_rows', type: 'int', unsigned: true, default: 0 }) |
| 68 | errorReportPath | string \| null | @Column({ name: 'error_report_path', type: 'varchar', length: 500, nullable: true, }) |
| 76 | importedById | number \| null | @Column({ name: 'imported_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 79 | startedAt | Date \| null | @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true, }) |
| 87 | finishedAt | Date \| null | @Column({ name: 'finished_at', type: 'datetime', precision: 3, nullable: true, }) |
| 95 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 98 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 101 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 16 | @Entity('accounting_import_batches') |
| 17 | @Index('idx_accounting_import_batches_project_status', ['projectId', 'status']) |
| 18 | @Index('idx_accounting_import_batches_organization_project', [ 'organizationId', 'projectId', ]) |

### gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item-audit-log.entity.ts

[gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item-audit-log.entity.ts)

Classe `InventoryAccountingItemAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 23 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 26 | inventoryAccountingItemId | number | @Column({ name: 'inventory_accounting_item_id', ...FOREIGN_KEY_COLUMN }) |
| 29 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 32 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 35 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 38 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 41 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 44 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('inventory_accounting_item_audit_logs') |
| 14 | @Index('idx_inventory_accounting_item_audit_item_created', [ 'inventoryAccountingItemId', 'createdAt', ]) |
| 18 | @Index('idx_inventory_accounting_item_audit_project_created', [ 'projectId', 'createdAt', ]) |

### gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity.ts

[gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity.ts)

Classe `InventoryAccountingItemEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 27 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 30 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 33 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 36 | plate | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| 39 | description | string \| null | @Column({ type: 'text', nullable: true }) |
| 42 | accountingAccountDescription | string \| null | @Column({ name: 'accounting_account_description', type: 'text', nullable: true, }) |
| 49 | location | string \| null | @Column({ type: 'text', nullable: true }) |
| 52 | acquisitionDate | Date \| null | @Column({ name: 'acquisition_date', type: 'date', nullable: true }) |
| 55 | acquisitionValue | string \| null | @Column({ name: 'acquisition_value', type: 'decimal', precision: 15, scale: 2, nullable: true, }) |
| 64 | baseCode | string \| null | @Column({ name: 'base_code', type: 'varchar', length: 100, nullable: true }) |
| 67 | status | InventoryAccountingItemStatus | @Column({ type: 'varchar', length: 20, default: InventoryAccountingItemStatus.PENDING, }) |
| 74 | investorCode | string \| null | @Column({ name: 'investor_code', type: 'varchar', length: 100, nullable: true, }) |
| 82 | note1 | string \| null | @Column({ name: 'note_1', type: 'text', nullable: true }) |
| 85 | note2 | string \| null | @Column({ name: 'note_2', type: 'text', nullable: true }) |
| 88 | newInventoryPlate | string \| null | @Column({ name: 'new_inventory_plate', type: 'varchar', length: 100, nullable: true, }) |
| 96 | inventoryDescription | string \| null | @Column({ name: 'inventory_description', type: 'text', nullable: true }) |
| 99 | inventoryLocation | string \| null | @Column({ name: 'inventory_location', type: 'text', nullable: true }) |
| 102 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 105 | importedById | number \| null | @Column({ name: 'imported_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 108 | importBatchId | number \| null | @Column({ name: 'import_batch_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 111 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 114 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 117 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('inventory_accounting_items') |
| 18 | @Index('idx_inventory_accounting_items_project_status', ['projectId', 'status']) |
| 19 | @Index('idx_inventory_accounting_items_organization_project', [ 'organizationId', 'projectId', ]) |
| 23 | @Index('idx_inventory_accounting_items_plate', ['plate']) |
| 24 | @Index('idx_inventory_accounting_items_base_code', ['baseCode']) |
| 25 | @Index('idx_inventory_accounting_items_investor_code', ['investorCode']) |

### gai-backend/src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image-audit-log.entity.ts

[gai-backend/src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image-audit-log.entity.ts)

Classe `InventoryItemImageAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 23 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 26 | inventoryItemImageId | number | @Column({ name: 'inventory_item_image_id', ...FOREIGN_KEY_COLUMN }) |
| 29 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 32 | inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| 35 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 38 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 41 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 44 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('inventory_item_image_audit_logs') |
| 14 | @Index('idx_inventory_item_image_audit_image_created', [ 'inventoryItemImageId', 'createdAt', ]) |
| 18 | @Index('idx_inventory_item_image_audit_item_created', [ 'inventoryItemId', 'createdAt', ]) |

### gai-backend/src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image.entity.ts

[gai-backend/src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image.entity.ts)

Classe `InventoryItemImageEntity`, linha 16.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 24 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 27 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 30 | inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| 33 | storageProvider | string | @Column({ name: 'storage_provider', type: 'varchar', length: 30 }) |
| 36 | bucket | string | @Column({ type: 'varchar', length: 255 }) |
| 39 | path | string | @Column({ type: 'varchar', length: 1024 }) |
| 42 | originalName | string | @Column({ name: 'original_name', type: 'varchar', length: 255 }) |
| 45 | mimeType | string | @Column({ name: 'mime_type', type: 'varchar', length: 100 }) |
| 48 | sizeBytes | number | @Column({ name: 'size_bytes', ...FOREIGN_KEY_COLUMN }) |
| 51 | checksum | string \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| 54 | status | InventoryItemImageStatus | @Column({ type: 'varchar', length: 30, default: InventoryItemImageStatus.PENDING_UPLOAD, }) |
| 61 | uploadedById | number \| null | @Column({ name: 'uploaded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 64 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 67 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 70 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 16 | @Entity('inventory_item_images') |
| 17 | @Index('idx_inventory_item_images_item_status', ['inventoryItemId', 'status']) |
| 18 | @Index('idx_inventory_item_images_organization_item', [ 'organizationId', 'inventoryItemId', ]) |
| 22 | @Index('idx_inventory_item_images_uploaded_by_id', ['uploadedById']) |

### gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item-audit-log.entity.ts

[gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item-audit-log.entity.ts)

Classe `InventoryItemAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 20 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 23 | inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| 26 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 29 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 32 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 35 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 38 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 41 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('inventory_item_audit_logs') |
| 14 | @Index('idx_inventory_item_audit_item_created', [ 'inventoryItemId', 'createdAt', ]) |
| 18 | @Index('idx_inventory_item_audit_project_created', ['projectId', 'createdAt']) |

### gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item.entity.ts

[gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item.entity.ts)

Classe `InventoryItemEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 27 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 30 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 33 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 36 | externalItemId | string \| null | @Column({ name: 'external_item_id', type: 'varchar', length: 100, nullable: true, }) |
| 44 | sequence | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 47 | oldPlate | string \| null | @Column({ name: 'old_plate', type: 'varchar', length: 100, nullable: true }) |
| 50 | newPlate | string \| null | @Column({ name: 'new_plate', type: 'varchar', length: 100, nullable: true }) |
| 53 | unitText | string \| null | @Column({ name: 'unit_text', type: 'varchar', length: 255, nullable: true }) |
| 56 | addressText | string \| null | @Column({ name: 'address_text', type: 'text', nullable: true }) |
| 59 | locationText | string \| null | @Column({ name: 'location_text', type: 'text', nullable: true }) |
| 62 | description | string \| null | @Column({ type: 'text', nullable: true }) |
| 65 | brand | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| 68 | model | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| 71 | serialNumber | string \| null | @Column({ name: 'serial_number', type: 'varchar', length: 100, nullable: true, }) |
| 79 | capacity | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| 82 | year | number \| null | @Column({ type: 'int', nullable: true }) |
| 85 | notes | string \| null | @Column({ type: 'text', nullable: true }) |
| 88 | source | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| 91 | usedValue | string \| null | @Column({ name: 'used_value', type: 'decimal', precision: 15, scale: 2, nullable: true, }) |
| 100 | newValue | string \| null | @Column({ name: 'new_value', type: 'decimal', precision: 15, scale: 2, nullable: true, }) |
| 109 | status | InventoryItemStatus | @Column({ type: 'varchar', length: 20, default: InventoryItemStatus.PENDING }) |
| 112 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 115 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 118 | updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 121 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 124 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 127 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('inventory_items') |
| 18 | @Index('idx_inventory_items_project_status', ['projectId', 'status']) |
| 19 | @Index('idx_inventory_items_organization_project', [ 'organizationId', 'projectId', ]) |
| 23 | @Index('idx_inventory_items_old_plate', ['oldPlate']) |
| 24 | @Index('idx_inventory_items_new_plate', ['newPlate']) |
| 25 | @Index('idx_inventory_items_external_item_id', ['externalItemId']) |

### gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts

[gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts)

Classe `InventorySessionEntity`, linha 26.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 30 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 31 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 33 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 34 | name | string | @Column({ type: 'varchar', length: 255 }) |
| 35 | status | InventorySessionStatus | @Column({ type: 'varchar', length: 20, default: InventorySessionStatus.DRAFT, }) |
| 41 | startedAt | Date \| null | @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true, }) |
| 48 | finishedAt | Date \| null | @Column({ name: 'finished_at', type: 'datetime', precision: 3, nullable: true, }) |
| 55 | cancelledAt | Date \| null | @Column({ name: 'cancelled_at', type: 'datetime', precision: 3, nullable: true, }) |
| 62 | cancellationReason | string \| null | @Column({ name: 'cancellation_reason', type: 'text', nullable: true }) |
| 64 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 66 | metadata | JsonObject \| null | @Column({ type: 'json', nullable: true }) |
| 67 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 69 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

Classe `InventoryRoundEntity`, linha 73.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 79 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 80 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 82 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 83 | sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| 84 | roundNumber | number | @Column({ name: 'round_number', type: 'int', unsigned: true }) |
| 86 | kind | InventoryRoundKind | @Column({ type: 'varchar', length: 20 }) |
| 87 | inventoryItemId | number \| null | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 89 | reason | string \| null | @Column({ type: 'text', nullable: true }) |
| 90 | status | InventoryRoundStatus | @Column({ type: 'varchar', length: 20, default: InventoryRoundStatus.ACTIVE }) |
| 92 | requestedById | number \| null | @Column({ name: 'requested_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 94 | startedAt | Date | @Column({ name: 'started_at', type: 'datetime', precision: 3 }) |
| 96 | finishedAt | Date \| null | @Column({ name: 'finished_at', type: 'datetime', precision: 3, nullable: true, }) |
| 103 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

Classe `InventoryObservationEntity`, linha 107.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 121 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 122 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 124 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 125 | sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| 126 | roundId | number | @Column({ name: 'round_id', ...FOREIGN_KEY_COLUMN }) |
| 127 | inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| 129 | fieldAgentId | number | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN }) |
| 131 | priorObservationId | number \| null | @Column({ name: 'prior_observation_id', ...FOREIGN_KEY_COLUMN, nullable: true, }) |
| 137 | idempotencyKey | string \| null | @Column({ name: 'idempotency_key', type: 'varchar', length: 100, nullable: true, }) |
| 144 | result | InventoryObservationResult | @Column({ type: 'varchar', length: 30 }) |
| 145 | observedPlate | string \| null | @Column({ name: 'observed_plate', type: 'varchar', length: 100, nullable: true, }) |
| 152 | observedSerialNumber | string \| null | @Column({ name: 'observed_serial_number', type: 'varchar', length: 100, nullable: true, }) |
| 159 | unitText | string \| null | @Column({ name: 'unit_text', type: 'varchar', length: 255, nullable: true }) |
| 161 | sectorText | string \| null | @Column({ name: 'sector_text', type: 'varchar', length: 255, nullable: true }) |
| 163 | locationText | string \| null | @Column({ name: 'location_text', type: 'text', nullable: true }) |
| 165 | notes | string \| null | @Column({ type: 'text', nullable: true }) |
| 166 | capturedAt | Date | @Column({ name: 'captured_at', type: 'datetime', precision: 3 }) |
| 168 | receivedAt | Date | @Column({ name: 'received_at', type: 'datetime', precision: 3 }) |
| 170 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |

Classe `InventoryObservationEvidenceEntity`, linha 174.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 189 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 190 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 192 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 193 | sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| 194 | roundId | number | @Column({ name: 'round_id', ...FOREIGN_KEY_COLUMN }) |
| 195 | observationId | number | @Column({ name: 'observation_id', ...FOREIGN_KEY_COLUMN }) |
| 197 | storageProvider | string | @Column({ name: 'storage_provider', type: 'varchar', length: 30 }) |
| 199 | bucket | string | @Column({ type: 'varchar', length: 255 }) |
| 200 | storageKey | string | @Column({ name: 'storage_key', type: 'varchar', length: 1024, }) |
| 206 | originalName | string | @Column({ name: 'original_name', type: 'varchar', length: 255 }) |
| 208 | mimeType | string | @Column({ name: 'mime_type', type: 'varchar', length: 100 }) |
| 210 | sizeBytes | number | @Column({ name: 'size_bytes', ...FOREIGN_KEY_COLUMN }) |
| 211 | checksum | string \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| 213 | status | InventoryObservationEvidenceStatus | @Column({ type: 'varchar', length: 30, default: InventoryObservationEvidenceStatus.PENDING_UPLOAD, }) |
| 219 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 221 | confirmedAt | Date \| null | @Column({ name: 'confirmed_at', type: 'datetime', precision: 3, nullable: true, }) |
| 228 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 230 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

Classe `InventoryPlateHistoryEntity`, linha 234.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 240 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 241 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 243 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 244 | inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| 246 | observationId | number \| null | @Column({ name: 'observation_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 248 | previousPlate | string \| null | @Column({ name: 'previous_plate', type: 'varchar', length: 100, nullable: true, }) |
| 255 | observedPlate | string \| null | @Column({ name: 'observed_plate', type: 'varchar', length: 100, nullable: true, }) |
| 262 | source | PlateEvidenceSource | @Column({ type: 'varchar', length: 30 }) |
| 263 | recordedById | number \| null | @Column({ name: 'recorded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 265 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

Classe `InventoryReconciliationEntity`, linha 269.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 276 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 277 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 279 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 280 | sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| 281 | runNumber | number | @Column({ name: 'run_number', type: 'int', unsigned: true }) |
| 283 | inventoryItemId | number \| null | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 285 | observationId | number \| null | @Column({ name: 'observation_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 287 | accountingItemId | number \| null | @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 289 | status | ReconciliationStatus | @Column({ type: 'varchar', length: 30 }) |
| 290 | physicalPlate | string \| null | @Column({ name: 'physical_plate', type: 'varchar', length: 100, nullable: true, }) |
| 297 | accountingPlate | string \| null | @Column({ name: 'accounting_plate', type: 'varchar', length: 100, nullable: true, }) |
| 304 | evidence | JsonObject | @Column({ type: 'json' }) |
| 305 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 307 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

Classe `InventoryConsolidationEntity`, linha 311.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 316 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 317 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 319 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 320 | sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| 321 | reconciliationId | number | @Column({ name: 'reconciliation_id', ...FOREIGN_KEY_COLUMN }) |
| 323 | inventoryItemId | number \| null | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 325 | decision | ConsolidationDecision | @Column({ type: 'varchar', length: 20 }) |
| 326 | notes | string \| null | @Column({ type: 'text', nullable: true }) |
| 327 | evidenceSnapshot | JsonObject | @Column({ name: 'evidence_snapshot', type: 'json' }) |
| 329 | decidedById | number \| null | @Column({ name: 'decided_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 331 | decidedAt | Date | @Column({ name: 'decided_at', type: 'datetime', precision: 3 }) |

Classe `AssetValuationEntity`, linha 335.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 338 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 339 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 341 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 342 | inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| 344 | source | string | @Column({ type: 'varchar', length: 255 }) |
| 345 | newValue | string \| null | @Column({ name: 'new_value', type: 'decimal', precision: 15, scale: 2, nullable: true, }) |
| 353 | usedValue | string \| null | @Column({ name: 'used_value', type: 'decimal', precision: 15, scale: 2, nullable: true, }) |
| 361 | valuationDate | Date | @Column({ name: 'valuation_date', type: 'date' }) |
| 362 | notes | string \| null | @Column({ type: 'text', nullable: true }) |
| 363 | responsibleById | number \| null | @Column({ name: 'responsible_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 365 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

Classe `InventoryOperationAuditLogEntity`, linha 369.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 375 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 376 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 378 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 379 | entity | string | @Column({ type: 'varchar', length: 50 }) |
| 380 | entityId | number \| null | @Column({ name: 'entity_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 382 | operation | string | @Column({ type: 'varchar', length: 60 }) |
| 383 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 385 | changes | JsonObject | @Column({ type: 'json' }) |
| 386 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 26 | @Entity('inventory_sessions') |
| 27 | @Index('idx_inventory_sessions_org_project', ['organizationId', 'projectId']) |
| 28 | @Index('idx_inventory_sessions_project_status', ['projectId', 'status']) |
| 73 | @Entity('inventory_rounds') |
| 74 | @Index('uq_inventory_rounds_session_number', ['sessionId', 'roundNumber'], { unique: true, }) |
| 77 | @Index('idx_inventory_rounds_target', ['inventoryItemId', 'status']) |
| 107 | @Entity('inventory_observations') |
| 108 | @Index( 'uq_inventory_observations_org_idempotency', ['organizationId', 'idempotencyKey'], { unique: true }, ) |
| 113 | @Index('uq_inventory_observations_round_item', ['roundId', 'inventoryItemId'], { unique: true, }) |
| 116 | @Index('idx_inventory_observations_item_captured', [ 'inventoryItemId', 'capturedAt', ]) |
| 174 | @Entity('inventory_observation_evidence') |
| 175 | @Index('idx_inventory_observation_evidence_observation_created', [ 'observationId', 'createdAt', ]) |
| 179 | @Index('idx_inventory_observation_evidence_scope', [ 'organizationId', 'projectId', 'sessionId', 'roundId', ]) |
| 185 | @Index('uq_inventory_observation_evidence_storage_key', ['storageKey'], { unique: true, }) |
| 234 | @Entity('inventory_plate_history') |
| 235 | @Index('idx_inventory_plate_history_item_created', [ 'inventoryItemId', 'createdAt', ]) |
| 269 | @Entity('inventory_reconciliations') |
| 270 | @Index('idx_inventory_reconciliations_session_run', ['sessionId', 'runNumber']) |
| 271 | @Index('idx_inventory_reconciliations_item_status', [ 'inventoryItemId', 'status', ]) |
| 311 | @Entity('inventory_consolidations') |
| 312 | @Index('uq_inventory_consolidations_reconciliation', ['reconciliationId'], { unique: true, }) |
| 335 | @Entity('asset_valuations') |
| 336 | @Index('idx_asset_valuations_item_date', ['inventoryItemId', 'valuationDate']) |
| 369 | @Entity('inventory_operation_audit_logs') |
| 370 | @Index('idx_inventory_operation_audit_project_created', [ 'projectId', 'createdAt', ]) |

### gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue-audit-log.entity.ts

[gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue-audit-log.entity.ts)

Classe `InventoryPendingIssueAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 23 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 26 | inventoryPendingIssueId | number | @Column({ name: 'inventory_pending_issue_id', ...FOREIGN_KEY_COLUMN }) |
| 29 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 32 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 35 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 38 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 41 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 44 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('inventory_pending_issue_audit_logs') |
| 14 | @Index('idx_inventory_pending_issue_audit_issue_created', [ 'inventoryPendingIssueId', 'createdAt', ]) |
| 18 | @Index('idx_inventory_pending_issue_audit_project_created', [ 'projectId', 'createdAt', ]) |

### gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity.ts

[gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity.ts)

Classe `InventoryPendingIssueEntity`, linha 19.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 25 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 28 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 31 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 34 | inventoryItemId | number \| null | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 37 | accountingItemId | number \| null | @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 40 | type | InventoryPendingIssueType | @Column({ type: 'varchar', length: 60 }) |
| 43 | status | InventoryPendingIssueStatus | @Column({ type: 'varchar', length: 20, default: InventoryPendingIssueStatus.OPEN, }) |
| 50 | severity | InventoryPendingIssueSeverity | @Column({ type: 'varchar', length: 20, default: InventoryPendingIssueSeverity.MEDIUM, }) |
| 57 | title | string | @Column({ type: 'varchar', length: 255 }) |
| 60 | description | string \| null | @Column({ type: 'text', nullable: true }) |
| 63 | oldValue | JsonRecord \| null | @Column({ name: 'old_value', type: 'json', nullable: true }) |
| 66 | newValue | JsonRecord \| null | @Column({ name: 'new_value', type: 'json', nullable: true }) |
| 69 | resolutionNotes | string \| null | @Column({ name: 'resolution_notes', type: 'text', nullable: true }) |
| 72 | resolvedById | number \| null | @Column({ name: 'resolved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 75 | resolvedAt | Date \| null | @Column({ name: 'resolved_at', type: 'datetime', precision: 3, nullable: true, }) |
| 83 | ignoredById | number \| null | @Column({ name: 'ignored_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 86 | ignoredAt | Date \| null | @Column({ name: 'ignored_at', type: 'datetime', precision: 3, nullable: true, }) |
| 94 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 97 | updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 100 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 103 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 106 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 109 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 19 | @Entity('inventory_pending_issues') |
| 20 | @Index('idx_inventory_pending_issues_project_status', ['projectId', 'status']) |
| 21 | @Index('idx_inventory_pending_issues_project_type', ['projectId', 'type']) |
| 22 | @Index('idx_inventory_pending_issues_inventory_item', ['inventoryItemId']) |
| 23 | @Index('idx_inventory_pending_issues_accounting_item', ['accountingItemId']) |

### gai-backend/src/modules/organizations/infrastructure/persistence/organization-audit-log.entity.ts

[gai-backend/src/modules/organizations/infrastructure/persistence/organization-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/infrastructure/persistence/organization-audit-log.entity.ts)

Classe `OrganizationAuditLogEntity`, linha 14.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 17 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 20 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 23 | operation | OrganizationAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| 26 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 29 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 32 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 14 | @Entity('organization_audit_logs') |
| 15 | @Index('idx_org_audit_org_created', ['organizationId', 'createdAt']) |

### gai-backend/src/modules/organizations/infrastructure/persistence/organization.entity.ts

[gai-backend/src/modules/organizations/infrastructure/persistence/organization.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/infrastructure/persistence/organization.entity.ts)

Classe `OrganizationEntity`, linha 12.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 16 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 19 | legalName | string | @Column({ name: 'legal_name', type: 'varchar', length: 255 }) |
| 22 | tradeName | string \| null | @Column({ name: 'trade_name', type: 'varchar', length: 255, nullable: true }) |
| 25 | cnpj | string | @Column({ type: 'varchar', length: 14, unique: true }) |
| 28 | contactEmail | string \| null | @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true, }) |
| 36 | contactPhone | string \| null | @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true, }) |
| 44 | status | OrganizationStatus | @Column({ type: 'varchar', length: 20, default: OrganizationStatus.ACTIVE, }) |
| 51 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 54 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 12 | @Entity('organizations') |
| 13 | @Index('idx_organizations_status', ['status']) |
| 14 | @Index('idx_organizations_legal_name', ['legalName']) |

### gai-backend/src/modules/payments-expenses/infrastructure/persistence/expense-attachment.entity.ts

[gai-backend/src/modules/payments-expenses/infrastructure/persistence/expense-attachment.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/payments-expenses/infrastructure/persistence/expense-attachment.entity.ts)

Classe `ExpenseAttachmentEntity`, linha 16.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 19 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 20 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 22 | expenseId | number | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) |
| 23 | storageProvider | string | @Column({ name: 'storage_provider', type: 'varchar', length: 50 }) |
| 25 | bucket | string | @Column({ type: 'varchar', length: 255 }) |
| 26 | path | string | @Column({ type: 'varchar', length: 500 }) |
| 27 | originalName | string | @Column({ name: 'original_name', type: 'varchar', length: 255 }) |
| 29 | mimeType | string | @Column({ name: 'mime_type', type: 'varchar', length: 100 }) |
| 31 | sizeBytes | number | @Column({ name: 'size_bytes', type: 'bigint', unsigned: true }) |
| 33 | checksum | \| string     \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| 36 | status | ExpenseAttachmentStatus | @Column({ type: 'varchar', length: 20, default: ExpenseAttachmentStatus.PENDING_UPLOAD, }) |
| 42 | uploadedById | number \| null | @Column({ name: 'uploaded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 44 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 46 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 48 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 16 | @Entity('expense_attachments') |
| 17 | @Index('idx_expense_attachments_expense_status', ['expenseId', 'status']) |

### gai-backend/src/modules/payments-expenses/infrastructure/persistence/expense.entity.ts

[gai-backend/src/modules/payments-expenses/infrastructure/persistence/expense.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/payments-expenses/infrastructure/persistence/expense.entity.ts)

Classe `ExpenseEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 21 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 22 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 24 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 25 | fieldAgentId | number \| null | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 27 | description | string | @Column({ type: 'text' }) |
| 28 | reason | string \| null | @Column({ type: 'text', nullable: true }) |
| 29 | expenseDate | Date | @Column({ name: 'expense_date', type: 'date' }) |
| 30 | amount | string | @Column({ type: 'decimal', precision: 15, scale: 2 }) |
| 31 | status | ExpenseStatus | @Column({ type: 'varchar', length: 20, default: ExpenseStatus.PENDING }) |
| 33 | approvedById | number \| null | @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 35 | approvedAt | Date \| null | @Column({ name: 'approved_at', type: 'datetime', precision: 3, nullable: true, }) |
| 42 | rejectedById | number \| null | @Column({ name: 'rejected_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 44 | rejectedAt | Date \| null | @Column({ name: 'rejected_at', type: 'datetime', precision: 3, nullable: true, }) |
| 51 | paidById | number \| null | @Column({ name: 'paid_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 53 | paidAt | Date \| null | @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true }) |
| 55 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 57 | updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 59 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 60 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 62 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 64 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('expenses') |
| 18 | @Index('idx_expenses_project_status', ['projectId', 'status']) |
| 19 | @Index('idx_expenses_field_agent', ['fieldAgentId']) |

### gai-backend/src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity.ts

[gai-backend/src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity.ts)

Classe `FieldAgentPaymentEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 21 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 22 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 24 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 25 | fieldAgentId | number | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN }) |
| 27 | state | string \| null | @Column({ type: 'varchar', length: 2, nullable: true }) |
| 28 | startDate | Date | @Column({ name: 'start_date', type: 'date' }) |
| 29 | endDate | Date | @Column({ name: 'end_date', type: 'date' }) |
| 30 | paymentDate | Date \| null | @Column({ name: 'payment_date', type: 'date', nullable: true }) |
| 32 | days | number | @Column({ type: 'int', unsigned: true, default: 0 }) |
| 33 | dailyRate | string | @Column({ name: 'daily_rate', type: 'decimal', precision: 15, scale: 2 }) |
| 35 | additionalAmount | string | @Column({ name: 'additional_amount', type: 'decimal', precision: 15, scale: 2, default: 0, }) |
| 43 | dailyTotal | string | @Column({ name: 'daily_total', type: 'decimal', precision: 15, scale: 2, default: 0, }) |
| 51 | discountAmount | string | @Column({ name: 'discount_amount', type: 'decimal', precision: 15, scale: 2, default: 0, }) |
| 59 | finalAmount | string | @Column({ name: 'final_amount', type: 'decimal', precision: 15, scale: 2, default: 0, }) |
| 67 | status | PaymentStatus | @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING }) |
| 69 | notes | string \| null | @Column({ type: 'text', nullable: true }) |
| 70 | approvedById | number \| null | @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 72 | approvedAt | Date \| null | @Column({ name: 'approved_at', type: 'datetime', precision: 3, nullable: true, }) |
| 79 | paidById | number \| null | @Column({ name: 'paid_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 81 | paidAt | Date \| null | @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true }) |
| 83 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 85 | updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 87 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 88 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 90 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 92 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('field_agent_payments') |
| 18 | @Index('idx_field_agent_payments_project_status', ['projectId', 'status']) |
| 19 | @Index('idx_field_agent_payments_field_agent', ['fieldAgentId']) |

### gai-backend/src/modules/payments-expenses/infrastructure/persistence/payment-expense-audit-log.entity.ts

[gai-backend/src/modules/payments-expenses/infrastructure/persistence/payment-expense-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/payments-expenses/infrastructure/persistence/payment-expense-audit-log.entity.ts)

Classe `PaymentExpenseAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 16 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 17 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 19 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 20 | paymentId | number \| null | @Column({ name: 'payment_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 22 | expenseId | number \| null | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 24 | expenseAttachmentId | number \| null | @Column({ name: 'expense_attachment_id', ...FOREIGN_KEY_COLUMN, nullable: true, }) |
| 30 | operation | string | @Column({ type: 'varchar', length: 60 }) |
| 31 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 33 | changes | Record<     string,     { before: unknown; after: unknown }   > | @Column({ type: 'json' }) |
| 37 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('payment_expense_audit_logs') |
| 14 | @Index('idx_payment_expense_audit_project_created', ['projectId', 'createdAt']) |

### gai-backend/src/modules/projects/infrastructure/persistence/project-audit-log.entity.ts

[gai-backend/src/modules/projects/infrastructure/persistence/project-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/infrastructure/persistence/project-audit-log.entity.ts)

Classe `ProjectAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 16 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 19 | projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| 22 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 25 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 28 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 31 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 34 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('project_audit_logs') |
| 14 | @Index('idx_project_audit_project_created', ['projectId', 'createdAt']) |

### gai-backend/src/modules/projects/infrastructure/persistence/project.entity.ts

[gai-backend/src/modules/projects/infrastructure/persistence/project.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/infrastructure/persistence/project.entity.ts)

Classe `ProjectEntity`, linha 17.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 21 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 24 | organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| 27 | companyId | number \| null | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 30 | name | string | @Column({ type: 'varchar', length: 255 }) |
| 33 | description | string \| null | @Column({ type: 'text', nullable: true }) |
| 36 | status | ProjectStatus | @Column({ type: 'varchar', length: 20, default: ProjectStatus.DRAFT }) |
| 39 | startDate | Date \| null | @Column({ name: 'start_date', type: 'date', nullable: true }) |
| 42 | endDate | Date \| null | @Column({ name: 'end_date', type: 'date', nullable: true }) |
| 45 | finishedAt | Date \| null | @Column({ name: 'finished_at', type: 'datetime', precision: 3, nullable: true, }) |
| 53 | settings | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 56 | metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| 59 | createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 62 | updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 65 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 68 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| 71 | deletedAt | Date \| null | @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 17 | @Entity('projects') |
| 18 | @Index('idx_projects_organization_status', ['organizationId', 'status']) |
| 19 | @Index('idx_projects_name', ['name']) |

### gai-backend/src/modules/users/infrastructure/persistence/permission.entity.ts

[gai-backend/src/modules/users/infrastructure/persistence/permission.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/permission.entity.ts)

Classe `PermissionEntity`, linha 10.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 12 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 15 | key | string | @Column({ type: 'varchar', length: 100, unique: true }) |
| 18 | resource | string | @Column({ type: 'varchar', length: 50 }) |
| 21 | action | string | @Column({ type: 'varchar', length: 50 }) |
| 24 | scope | PermissionScope | @Column({ type: 'varchar', length: 20, }) |
| 30 | description | string | @Column({ type: 'varchar', length: 255 }) |
| 33 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 10 | @Entity('permissions') |

### gai-backend/src/modules/users/infrastructure/persistence/role-audit-log.entity.ts

[gai-backend/src/modules/users/infrastructure/persistence/role-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/role-audit-log.entity.ts)

Classe `RoleAuditLogEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 16 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 19 | roleId | number | @Column({ name: 'role_id', ...FOREIGN_KEY_COLUMN }) |
| 22 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 25 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 28 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 31 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('role_audit_logs') |
| 14 | @Index('idx_role_audit_role_created', ['roleId', 'createdAt']) |

### gai-backend/src/modules/users/infrastructure/persistence/role-permission.entity.ts

[gai-backend/src/modules/users/infrastructure/persistence/role-permission.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/role-permission.entity.ts)

Classe `RolePermissionEntity`, linha 4.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|


| Linha | Declaração de tabela/índice |
|---|---|
| 4 | @Entity('role_permissions') |

### gai-backend/src/modules/users/infrastructure/persistence/role.entity.ts

[gai-backend/src/modules/users/infrastructure/persistence/role.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/role.entity.ts)

Classe `RoleEntity`, linha 15.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 21 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 24 | key | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| 27 | type | RoleType | @Column({ type: 'varchar', length: 20 }) |
| 30 | organizationId | number \| null | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 33 | name | string | @Column({ type: 'varchar', length: 100 }) |
| 36 | description | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| 39 | isActive | boolean | @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 }) |
| 42 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| 45 | updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 15 | @Entity('roles') |
| 16 | @Index('uk_roles_key', ['key'], { unique: true }) |
| 17 | @Index('uk_roles_org_name', ['organizationId', 'name'], { unique: true }) |
| 18 | @Index('idx_roles_organization_id', ['organizationId']) |
| 19 | @Index('idx_roles_type', ['type']) |

### gai-backend/src/modules/users/infrastructure/persistence/user-audit-log.entity.ts

[gai-backend/src/modules/users/infrastructure/persistence/user-audit-log.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/user-audit-log.entity.ts)

Classe `UserAuditLogEntity`, linha 14.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 17 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 20 | userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| 23 | operation | string | @Column({ type: 'varchar', length: 50 }) |
| 26 | performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 29 | changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| 32 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 14 | @Entity('user_audit_logs') |
| 15 | @Index('idx_user_audit_user_created', ['userId', 'createdAt']) |

### gai-backend/src/modules/users/infrastructure/persistence/user-role-assignment.entity.ts

[gai-backend/src/modules/users/infrastructure/persistence/user-role-assignment.entity.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/user-role-assignment.entity.ts)

Classe `UserRoleAssignmentEntity`, linha 13.

| Linha | Campo/membro | Tipo | Persistência/índice |
|---|---|---|---|
| 17 | id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| 20 | userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| 23 | roleId | number | @Column({ name: 'role_id', ...FOREIGN_KEY_COLUMN }) |
| 26 | isActive | boolean | @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 }) |
| 29 | assignedBy | number \| null | @Column({ name: 'assigned_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| 32 | assignedAt | Date | @Column({ name: 'assigned_at', type: 'datetime', precision: 3 }) |
| 35 | revokedAt | Date \| null | @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true, }) |
| 43 | createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

| Linha | Declaração de tabela/índice |
|---|---|
| 13 | @Entity('user_role_assignments') |
| 14 | @Index('idx_user_role_assignments_user_id', ['userId']) |
| 15 | @Index('idx_user_role_assignments_role_id', ['roleId']) |

## Migrations existentes — não executadas

| Arquivo | Linhas | Classe/métodos |
|---|---|---|
| [gai-backend/src/migrations/1739500000001-create-organizations.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1739500000001-create-organizations.ts) | 45 | 6:up; 40:down |
| [gai-backend/src/migrations/1739500000002-create-auth-tables.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1739500000002-create-auth-tables.ts) | 92 | 6:up; 82:down |
| [gai-backend/src/migrations/1739600000001-migrate-to-numeric-ids-and-rbac.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1739600000001-migrate-to-numeric-ids-and-rbac.ts) | 214 | 6:up; 198:down |
| [gai-backend/src/migrations/1739700000001-decouple-user-authorization.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1739700000001-decouple-user-authorization.ts) | 141 | 6:up; 135:down |
| [gai-backend/src/migrations/1739800000001-create-projects.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1739800000001-create-projects.ts) | 59 | 6:up; 54:down |
| [gai-backend/src/migrations/1739900000001-create-field-agents.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1739900000001-create-field-agents.ts) | 85 | 6:up; 79:down |
| [gai-backend/src/migrations/1740000000001-create-inventory-items.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740000000001-create-inventory-items.ts) | 78 | 6:up; 73:down |
| [gai-backend/src/migrations/1740100000001-create-inventory-item-images.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740100000001-create-inventory-item-images.ts) | 61 | 6:up; 56:down |
| [gai-backend/src/migrations/1740200000001-create-catalog-assets.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740200000001-create-catalog-assets.ts) | 57 | 6:up; 52:down |
| [gai-backend/src/migrations/1740300000001-create-inventory-accounting-items.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740300000001-create-inventory-accounting-items.ts) | 104 | 6:up; 98:down |
| [gai-backend/src/migrations/1740400000001-create-inventory-pending-issues.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740400000001-create-inventory-pending-issues.ts) | 76 | 6:up; 71:down |
| [gai-backend/src/migrations/1740500000001-create-payments-expenses.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740500000001-create-payments-expenses.ts) | 47 | 5:up; 40:down |
| [gai-backend/src/migrations/1740600000001-create-import-sessions.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740600000001-create-import-sessions.ts) | 56 | 6:up; 48:down |
| [gai-backend/src/migrations/1740700000001-create-companies-company-units.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740700000001-create-companies-company-units.ts) | 178 | 6:up; 162:down |
| [gai-backend/src/migrations/1740800000001-protect-active-field-agent-assignments.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740800000001-protect-active-field-agent-assignments.ts) | 51 | 13:up; 43:down |
| [gai-backend/src/migrations/1740900000001-add-project-unit-soft-delete.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1740900000001-add-project-unit-soft-delete.ts) | 22 | 6:up; 14:down |
| [gai-backend/src/migrations/1741000000001-create-export-jobs.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1741000000001-create-export-jobs.ts) | 69 | 6:up; 64:down |
| [gai-backend/src/migrations/1741100000001-add-project-dashboard-indexes.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1741100000001-add-project-dashboard-indexes.ts) | 26 | 6:up; 17:down |
| [gai-backend/src/migrations/1741200000001-create-inventory-operations.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1741200000001-create-inventory-operations.ts) | 203 | 6:up; 192:down |
| [gai-backend/src/migrations/1741300000001-create-expense-accountabilities.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1741300000001-create-expense-accountabilities.ts) | 60 | 4:up; 53:down |
| [gai-backend/src/migrations/1741400000001-close-inventory-operation-gaps.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1741400000001-close-inventory-operation-gaps.ts) | 64 | 6:up; 57:down |
| [gai-backend/src/migrations/1793000000001-fix-evidence-storage-key-index.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/migrations/1793000000001-fix-evidence-storage-key-index.ts) | 44 | 6:up; 26:down |

## Serviços, use-cases, policies e repositories

### gai-backend/src/common/storage/configured-storage-signer.service.ts

[gai-backend/src/common/storage/configured-storage-signer.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/common/storage/configured-storage-signer.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 11 | 13 | createUploadUrl |
| 15 | 17 | createDownloadUrl |
| 19 | 36 | sign |

### gai-backend/src/modules/auth/application/services/role-authorization.service.ts

[gai-backend/src/modules/auth/application/services/role-authorization.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/application/services/role-authorization.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 13 | 24 | extractSystemRoles |
| 26 | 33 | resolvePrimaryRole |
| 35 | 37 | hasSystemRole |
| 39 | 44 | canManageUsers |
| 46 | 48 | isUserRole |

### gai-backend/src/modules/auth/application/use-cases/confirm-password-reset.use-case.ts

[gai-backend/src/modules/auth/application/use-cases/confirm-password-reset.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/application/use-cases/confirm-password-reset.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 48 | 93 | execute |

### gai-backend/src/modules/auth/application/use-cases/get-current-user.use-case.ts

[gai-backend/src/modules/auth/application/use-cases/get-current-user.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/application/use-cases/get-current-user.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 27 | 49 | execute |

### gai-backend/src/modules/auth/application/use-cases/login.use-case.ts

[gai-backend/src/modules/auth/application/use-cases/login.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/application/use-cases/login.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 66 | 223 | execute |

### gai-backend/src/modules/auth/application/use-cases/logout.use-case.ts

[gai-backend/src/modules/auth/application/use-cases/logout.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/application/use-cases/logout.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 26 | 53 | execute |

### gai-backend/src/modules/auth/application/use-cases/request-password-reset.use-case.ts

[gai-backend/src/modules/auth/application/use-cases/request-password-reset.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/application/use-cases/request-password-reset.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 47 | 92 | execute |

### gai-backend/src/modules/auth/infrastructure/persistence/typeorm-auth-audit.repository.ts

[gai-backend/src/modules/auth/infrastructure/persistence/typeorm-auth-audit.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/infrastructure/persistence/typeorm-auth-audit.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 25 | save |

### gai-backend/src/modules/auth/infrastructure/persistence/typeorm-password-reset-token.repository.ts

[gai-backend/src/modules/auth/infrastructure/persistence/typeorm-password-reset-token.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/infrastructure/persistence/typeorm-password-reset-token.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 21 | create |
| 23 | 34 | findValidByHash |
| 36 | 38 | markUsed |
| 40 | 45 | invalidateAllForUser |

### gai-backend/src/modules/auth/infrastructure/persistence/typeorm-session.repository.ts

[gai-backend/src/modules/auth/infrastructure/persistence/typeorm-session.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/infrastructure/persistence/typeorm-session.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 20 | create |
| 22 | 24 | findById |
| 26 | 34 | findActiveById |
| 36 | 38 | revoke |
| 40 | 46 | revokeAllForUser |
| 48 | 61 | revokeAllForOrganization |
| 63 | 69 | touch |

### gai-backend/src/modules/auth/infrastructure/persistence/typeorm-user.repository.ts

[gai-backend/src/modules/auth/infrastructure/persistence/typeorm-user.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/infrastructure/persistence/typeorm-user.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 15 | 18 | findById |
| 20 | 25 | findByLoginOrEmail |
| 27 | 30 | findByEmail |
| 32 | 69 | save |
| 71 | 85 | toDomain |

### gai-backend/src/modules/auth/presentation/guards/dev-admin.guard.ts

[gai-backend/src/modules/auth/presentation/guards/dev-admin.guard.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/presentation/guards/dev-admin.guard.ts)

| Linha | Final | Método/função |
|---|---|---|
| 21 | 42 | canActivate |

### gai-backend/src/modules/auth/presentation/guards/organization-scope.guard.ts

[gai-backend/src/modules/auth/presentation/guards/organization-scope.guard.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/presentation/guards/organization-scope.guard.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 47 | canActivate |

### gai-backend/src/modules/auth/presentation/guards/permissions.guard.ts

[gai-backend/src/modules/auth/presentation/guards/permissions.guard.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/presentation/guards/permissions.guard.ts)

| Linha | Final | Método/função |
|---|---|---|
| 30 | 76 | canActivate |

### gai-backend/src/modules/auth/presentation/guards/roles.guard.ts

[gai-backend/src/modules/auth/presentation/guards/roles.guard.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/presentation/guards/roles.guard.ts)

| Linha | Final | Método/função |
|---|---|---|
| 15 | 33 | canActivate |

### gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts

[gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts)

| Linha | Final | Método/função |
|---|---|---|
| 66 | 135 | canActivate |
| 137 | 143 | extractToken |

### gai-backend/src/modules/catalog-assets/application/services/catalog-asset-scope.service.ts

[gai-backend/src/modules/catalog-assets/application/services/catalog-asset-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/application/services/catalog-asset-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 12 | 26 | resolveOrganizationForCreate |
| 28 | 45 | resolveOrganizationFilter |
| 47 | 57 | assertCanAccessOrganization |
| 59 | 68 | cleanText |
| 70 | 77 | normalizeDescription |
| 79 | 84 | forbidden |

### gai-backend/src/modules/catalog-assets/application/use-cases/create-catalog-asset.use-case.ts

[gai-backend/src/modules/catalog-assets/application/use-cases/create-catalog-asset.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/application/use-cases/create-catalog-asset.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 40 | 114 | execute |
| 116 | 130 | assertUniqueDescription |
| 132 | 137 | validation |

### gai-backend/src/modules/catalog-assets/application/use-cases/get-catalog-asset.use-case.ts

[gai-backend/src/modules/catalog-assets/application/use-cases/get-catalog-asset.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/application/use-cases/get-catalog-asset.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 20 | 33 | execute |

### gai-backend/src/modules/catalog-assets/application/use-cases/list-catalog-assets.use-case.ts

[gai-backend/src/modules/catalog-assets/application/use-cases/list-catalog-assets.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/application/use-cases/list-catalog-assets.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 24 | 50 | execute |

### gai-backend/src/modules/catalog-assets/application/use-cases/update-catalog-asset-status.use-case.ts

[gai-backend/src/modules/catalog-assets/application/use-cases/update-catalog-asset-status.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/application/use-cases/update-catalog-asset-status.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 32 | 81 | execute |

### gai-backend/src/modules/catalog-assets/application/use-cases/update-catalog-asset.use-case.ts

[gai-backend/src/modules/catalog-assets/application/use-cases/update-catalog-asset.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/application/use-cases/update-catalog-asset.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 32 | 105 | execute |
| 107 | 123 | assertUniqueDescription |
| 125 | 130 | validation |

### gai-backend/src/modules/catalog-assets/infrastructure/persistence/typeorm-catalog-asset.repository.ts

[gai-backend/src/modules/catalog-assets/infrastructure/persistence/typeorm-catalog-asset.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/catalog-assets/infrastructure/persistence/typeorm-catalog-asset.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 20 | 27 | findById |
| 29 | 50 | findByNormalizedDescription |
| 52 | 88 | list |
| 90 | 111 | saveWithAudit |
| 113 | 132 | toEntity |
| 134 | 151 | toDomain |
| 153 | 155 | toDate |
| 157 | 159 | toNullableDate |
| 161 | 168 | normalizeSearch |

### gai-backend/src/modules/companies/application/services/companies.service.ts

[gai-backend/src/modules/companies/application/services/companies.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/application/services/companies.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 60 | 124 | createCompany |
| 126 | 152 | listCompanies |
| 154 | 161 | getCompany |
| 163 | 211 | updateCompany |
| 213 | 249 | changeCompanyStatus |
| 251 | 293 | createUnit |
| 295 | 321 | listUnits |
| 323 | 331 | getUnit |
| 333 | 361 | updateUnit |
| 363 | 402 | changeUnitStatus |
| 404 | 475 | assignProjectUnit |
| 477 | 492 | listProjectUnits |
| 494 | 551 | removeProjectUnit |
| 553 | 571 | assertCompanyCanReceiveProject |
| 573 | 582 | findCompanyOrFail |
| 584 | 596 | findUnitOrFail |
| 598 | 607 | findProjectOrFail |
| 609 | 625 | assertUniqueDocument |
| 627 | 639 | normalizeDocument |
| 641 | 658 | isValidCnpj |
| 660 | 663 | clean |
| 665 | 674 | cleanRequired |
| 676 | 688 | change |
| 690 | 692 | toSnake |

### gai-backend/src/modules/companies/application/services/company-scope.service.ts

[gai-backend/src/modules/companies/application/services/company-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/application/services/company-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 12 | 32 | resolveOrganizationForCreate |
| 34 | 57 | resolveOrganizationFilter |
| 59 | 72 | assertCanAccessOrganization |

### gai-backend/src/modules/companies/infrastructure/persistence/typeorm-companies.repository.ts

[gai-backend/src/modules/companies/infrastructure/persistence/typeorm-companies.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/companies/infrastructure/persistence/typeorm-companies.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 83 | 89 | findCompanyById |
| 91 | 107 | findCompanyByDocument |
| 109 | 147 | listCompanies |
| 149 | 168 | saveCompanyWithAudit |
| 170 | 176 | findUnitById |
| 178 | 212 | listUnits |
| 214 | 234 | saveUnitWithAudit |
| 236 | 241 | findProjectUnit |
| 243 | 255 | findProjectUnitIncludingRemoved |
| 257 | 281 | listProjectUnits |
| 283 | 385 | assignProjectUnitWithAudit |
| 387 | 464 | removeProjectUnitWithAudit |
| 466 | 482 | lockProject |
| 484 | 497 | lockCompanyUnit |
| 499 | 509 | findCompanyUnit |
| 511 | 515 | supportsPessimisticLock |
| 517 | 535 | isProjectUnitDuplicate |
| 537 | 539 | normalizeDigits |

### gai-backend/src/modules/expense-accountabilities/expense-accountabilities.service.ts

[gai-backend/src/modules/expense-accountabilities/expense-accountabilities.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/expense-accountabilities/expense-accountabilities.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 54 | 101 | create |
| 103 | 143 | list |
| 145 | 221 | addExpense |
| 223 | 230 | get |
| 232 | 282 | close |
| 284 | 341 | generateInstallments |
| 342 | 371 | listInstallments |
| 373 | 397 | project |
| 398 | 404 | requireAccountability |
| 405 | 407 | date |
| 408 | 412 | dateKey |
| 413 | 426 | isDuplicateExpenseMembership |
| 427 | 432 | notFound |
| 433 | 450 | audit |
| 451 | 472 | response |
| 473 | 484 | installmentResponse |
| 485 | 498 | paginate |

### gai-backend/src/modules/expense-accountabilities/installment-allocation.policy.ts

[gai-backend/src/modules/expense-accountabilities/installment-allocation.policy.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/expense-accountabilities/installment-allocation.policy.ts)

| Linha | Final | Método/função |
|---|---|---|
| 2 | 9 | allocate |

### gai-backend/src/modules/export-jobs/application/services/export-job-processor.service.ts

[gai-backend/src/modules/export-jobs/application/services/export-job-processor.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/export-jobs/application/services/export-job-processor.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 41 | 49 | onModuleInit |
| 51 | 57 | onModuleDestroy |
| 59 | 92 | enqueue |
| 94 | 109 | processJob |
| 111 | 129 | drainPendingJobs |
| 131 | 141 | runMaintenanceCycle |
| 143 | 181 | claimJob |
| 183 | 233 | finishJob |
| 235 | 276 | failJob |
| 278 | 318 | recoverStaleJobs |
| 320 | 358 | expireFinishedJobs |
| 360 | 362 | pollIntervalMs |
| 364 | 370 | staleAfterMs |
| 372 | 374 | retentionDays |
| 376 | 383 | maxConcurrency |
| 385 | 394 | maxFileSizeBytes |
| 396 | 399 | positiveNumber |

### gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts

[gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 55 | 101 | create |
| 103 | 164 | list |
| 166 | 178 | get |
| 180 | 238 | cancel |
| 240 | 339 | retry |
| 341 | 368 | createDownloadUrl |
| 370 | 413 | download |
| 415 | 428 | getAuthorizedProject |
| 430 | 445 | getJobEntity |
| 447 | 472 | assertDownloadable |
| 474 | 488 | expireProjectJobs |
| 490 | 500 | expireIfNeeded |
| 502 | 529 | expireJob |
| 531 | 545 | transitionConflict |

### gai-backend/src/modules/export-jobs/application/services/export-workbook-builder.service.ts

[gai-backend/src/modules/export-jobs/application/services/export-workbook-builder.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/export-jobs/application/services/export-workbook-builder.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 31 | 81 | build |
| 83 | 165 | addProjectBackup |
| 167 | 233 | addInventorySheet |
| 235 | 293 | addAccountingSheet |
| 295 | 353 | addPendingIssuesSheet |
| 355 | 419 | addPaymentsSheet |
| 421 | 475 | addExpensesSheet |
| 477 | 499 | addSheet |
| 501 | 514 | loadProject |
| 516 | 534 | loadInventoryItems |
| 536 | 554 | loadAccountingItems |
| 556 | 574 | loadPendingIssues |
| 576 | 594 | loadPayments |
| 596 | 614 | loadExpenses |
| 616 | 625 | loadWithLimit |
| 627 | 632 | withDeleted |
| 634 | 639 | maxRows |
| 641 | 644 | cell |
| 646 | 650 | number |
| 652 | 656 | date |
| 658 | 661 | json |

### gai-backend/src/modules/field-agents/application/services/field-agent-scope.service.ts

[gai-backend/src/modules/field-agents/application/services/field-agent-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/services/field-agent-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 12 | 17 | resolveOrganizationForCreate |
| 19 | 33 | resolveOrganizationFilter |
| 35 | 42 | assertCanAccessOrganization |
| 44 | 49 | forbidden |

### gai-backend/src/modules/field-agents/application/use-cases/assign-project-field-agent.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/assign-project-field-agent.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/assign-project-field-agent.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 50 | 155 | execute |
| 157 | 159 | parseDate |
| 161 | 167 | validation |

### gai-backend/src/modules/field-agents/application/use-cases/create-field-agent.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/create-field-agent.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/create-field-agent.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 44 | 118 | execute |
| 120 | 141 | assertUserScope |
| 143 | 148 | validation |

### gai-backend/src/modules/field-agents/application/use-cases/delete-field-agent.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/delete-field-agent.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/delete-field-agent.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 29 | 63 | execute |

### gai-backend/src/modules/field-agents/application/use-cases/get-field-agent.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/get-field-agent.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/get-field-agent.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 20 | 33 | execute |

### gai-backend/src/modules/field-agents/application/use-cases/list-field-agents.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/list-field-agents.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/list-field-agents.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 24 | 49 | execute |

### gai-backend/src/modules/field-agents/application/use-cases/list-project-field-agents.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/list-project-field-agents.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/list-project-field-agents.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 30 | 60 | execute |

### gai-backend/src/modules/field-agents/application/use-cases/remove-project-field-agent.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/remove-project-field-agent.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/remove-project-field-agent.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 41 | 104 | execute |

### gai-backend/src/modules/field-agents/application/use-cases/update-field-agent-status.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/update-field-agent-status.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/update-field-agent-status.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 36 | 90 | execute |

### gai-backend/src/modules/field-agents/application/use-cases/update-field-agent.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/update-field-agent.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/update-field-agent.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 36 | 102 | execute |
| 104 | 125 | assertUserScope |

### gai-backend/src/modules/field-agents/application/use-cases/update-project-field-agent.use-case.ts

[gai-backend/src/modules/field-agents/application/use-cases/update-project-field-agent.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/application/use-cases/update-project-field-agent.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 49 | 156 | execute |
| 158 | 163 | parseDate |

### gai-backend/src/modules/field-agents/infrastructure/persistence/typeorm-field-agent.repository.ts

[gai-backend/src/modules/field-agents/infrastructure/persistence/typeorm-field-agent.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/field-agents/infrastructure/persistence/typeorm-field-agent.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 33 | 36 | findById |
| 38 | 41 | findAssignmentById |
| 43 | 48 | findUserOrganizationId |
| 50 | 66 | hasActiveAssignment |
| 68 | 93 | findConflict |
| 95 | 124 | list |
| 126 | 145 | listAssignments |
| 147 | 168 | saveFieldAgentWithAudit |
| 170 | 196 | saveAssignmentWithAudit |
| 198 | 248 | saveAssignmentEnsuringUniqueActive |
| 250 | 271 | lockOperationalProject |
| 273 | 292 | toFieldAgentEntity |
| 294 | 314 | toAssignmentEntity |
| 316 | 331 | toFieldAgentDomain |
| 333 | 349 | toAssignmentDomain |
| 351 | 353 | toDate |
| 355 | 357 | toNullableDate |

### gai-backend/src/modules/import-sessions/application/services/import-session-scope.service.ts

[gai-backend/src/modules/import-sessions/application/services/import-session-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/application/services/import-session-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 31 | assertCanAccessOrganization |
| 33 | 39 | assertProjectAllowsMutation |
| 41 | 43 | sessionTtlHours |
| 45 | 47 | maxItemsPerPayload |
| 49 | 51 | maxImagesPerPayload |
| 53 | 55 | storageProvider |
| 57 | 59 | storageBucket |
| 61 | 63 | presignedUrlTtlSeconds |
| 65 | 70 | normalizePlate |
| 72 | 77 | cleanText |
| 79 | 87 | buildImportFilePath |

### gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts

[gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 108 | 154 | createSession |
| 156 | 177 | listSessions |
| 179 | 187 | getSession |
| 189 | 203 | getSessionByUuid |
| 205 | 251 | receivePayload |
| 253 | 274 | listPayloads |
| 276 | 285 | getPayload |
| 287 | 316 | finishSession |
| 318 | 335 | cancelSession |
| 337 | 365 | retrySession |
| 367 | 385 | reprocessPayload |
| 387 | 411 | listErrors |
| 413 | 458 | createFileUploadUrl |
| 460 | 504 | confirmFileUpload |
| 506 | 514 | listFiles |
| 516 | 548 | createFileDownloadUrl |
| 550 | 635 | processPayload |
| 637 | 672 | importPhysicalFile |
| 674 | 843 | applyPhysicalObservation |
| 845 | 848 | positiveInteger |
| 850 | 856 | physicalObservationKey |
| 858 | 924 | applyItem |
| 926 | 965 | assignItemFields |
| 967 | 992 | findDuplicate |
| 994 | 1007 | assertPayloadLimits |
| 1009 | 1030 | assertSessionAcceptsPayload |
| 1032 | 1056 | applySessionDelta |
| 1058 | 1072 | getProject |
| 1074 | 1089 | findSession |
| 1091 | 1104 | assertSessionScope |
| 1106 | 1118 | findPayload |
| 1120 | 1137 | findFile |
| 1139 | 1142 | extractItems |
| 1144 | 1146 | countImages |
| 1148 | 1158 | findInventoryItemByExternalId |
| 1160 | 1167 | errorCode |
| 1169 | 1171 | errorMessage |
| 1173 | 1192 | paginate |

### gai-backend/src/modules/import-sessions/application/services/physical-observation-import-parser.service.ts

[gai-backend/src/modules/import-sessions/application/services/physical-observation-import-parser.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/application/services/physical-observation-import-parser.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 47 | 93 | parse |
| 95 | 108 | normalizeKeys |
| 109 | 117 | pick |
| 118 | 129 | text |
| 130 | 133 | integer |
| 134 | 150 | dateTime |
| 151 | 168 | result |

### gai-backend/src/modules/import-sessions/infrastructure/persistence/typeorm-import-sessions.repository.ts

[gai-backend/src/modules/import-sessions/infrastructure/persistence/typeorm-import-sessions.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/import-sessions/infrastructure/persistence/typeorm-import-sessions.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 32 | 34 | findSessionById |
| 36 | 38 | findSessionByUuid |
| 40 | 58 | listSessions |
| 60 | 80 | saveSession |
| 82 | 84 | findPayloadById |
| 86 | 93 | findPayloadByNumber |
| 95 | 102 | findPayloadByIdempotencyKey |
| 104 | 117 | listPayloads |
| 119 | 139 | savePayloadWithAudit |
| 141 | 160 | listErrors |
| 162 | 164 | findFileById |
| 166 | 174 | listFiles |
| 176 | 194 | saveFileWithAudit |
| 196 | 207 | audit |

### gai-backend/src/modules/inventory-accounting-items/application/services/accounting-import-parser.service.ts

[gai-backend/src/modules/inventory-accounting-items/application/services/accounting-import-parser.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-accounting-items/application/services/accounting-import-parser.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 32 | 48 | parse |
| 50 | 159 | parseRow |
| 161 | 174 | normalizeKeys |
| 176 | 190 | pick |
| 192 | 208 | parseStatus |

### gai-backend/src/modules/inventory-accounting-items/application/services/inventory-accounting-item-scope.service.ts

[gai-backend/src/modules/inventory-accounting-items/application/services/inventory-accounting-item-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-accounting-items/application/services/inventory-accounting-item-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 31 | assertCanAccessOrganization |
| 33 | 40 | assertProjectAllowsMutation |
| 42 | 50 | normalizePlate |
| 52 | 57 | cleanText |
| 59 | 89 | parseDate |
| 91 | 102 | normalizeMoney |
| 104 | 117 | toScalarString |

### gai-backend/src/modules/inventory-accounting-items/application/services/inventory-accounting-items.service.ts

[gai-backend/src/modules/inventory-accounting-items/application/services/inventory-accounting-items.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-accounting-items/application/services/inventory-accounting-items.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 62 | 168 | importFile |
| 170 | 199 | listItems |
| 201 | 215 | getItem |
| 217 | 264 | updateItem |
| 266 | 308 | changeStatus |
| 310 | 333 | listBatches |
| 335 | 349 | getBatch |
| 351 | 358 | getBatchErrors |
| 360 | 377 | getAuthorizedProject |
| 379 | 411 | newItem |

### gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/typeorm-inventory-accounting-item.repository.ts

[gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/typeorm-inventory-accounting-item.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/typeorm-inventory-accounting-item.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 28 | 35 | findById |
| 37 | 68 | findByNaturalKey |
| 70 | 120 | list |
| 122 | 146 | saveWithAudit |
| 148 | 153 | saveImportBatch |
| 155 | 158 | findBatchById |
| 160 | 185 | listBatches |
| 187 | 192 | getBatchErrors |
| 194 | 226 | toItemEntity |
| 228 | 258 | toItemDomain |
| 260 | 288 | toBatchEntity |
| 290 | 315 | toBatchDomain |
| 317 | 319 | toDate |
| 321 | 323 | toNullableDate |
| 325 | 330 | toMoneyString |

### gai-backend/src/modules/inventory-item-images/application/services/inventory-item-image-scope.service.ts

[gai-backend/src/modules/inventory-item-images/application/services/inventory-item-image-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/application/services/inventory-item-image-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 26 | 40 | assertCanAccessOrganization |
| 42 | 49 | assertItemBelongsToProject |
| 51 | 58 | assertProjectAllowsMutation |
| 60 | 67 | assertMimeType |
| 69 | 77 | assertSize |
| 79 | 87 | assertImageLimit |
| 89 | 94 | maxSizeBytes |
| 96 | 98 | maxImagesPerItem |
| 100 | 105 | presignedUrlTtlSeconds |
| 107 | 109 | storageBucket |
| 111 | 113 | storageProvider |
| 115 | 127 | buildStoragePath |
| 129 | 135 | cleanText |
| 137 | 145 | safeFileName |

### gai-backend/src/modules/inventory-item-images/application/use-cases/confirm-inventory-item-image-upload.use-case.ts

[gai-backend/src/modules/inventory-item-images/application/use-cases/confirm-inventory-item-image-upload.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/application/use-cases/confirm-inventory-item-image-upload.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 34 | 91 | execute |

### gai-backend/src/modules/inventory-item-images/application/use-cases/create-inventory-item-image-download-url.use-case.ts

[gai-backend/src/modules/inventory-item-images/application/use-cases/create-inventory-item-image-download-url.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/application/use-cases/create-inventory-item-image-download-url.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 37 | 85 | execute |

### gai-backend/src/modules/inventory-item-images/application/use-cases/create-inventory-item-image-upload-url.use-case.ts

[gai-backend/src/modules/inventory-item-images/application/use-cases/create-inventory-item-image-upload-url.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/application/use-cases/create-inventory-item-image-upload-url.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 55 | 151 | execute |

### gai-backend/src/modules/inventory-item-images/application/use-cases/get-inventory-item-image.use-case.ts

[gai-backend/src/modules/inventory-item-images/application/use-cases/get-inventory-item-image.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/application/use-cases/get-inventory-item-image.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 26 | 33 | execute |
| 35 | 69 | findAndAuthorize |

### gai-backend/src/modules/inventory-item-images/application/use-cases/list-inventory-item-images.use-case.ts

[gai-backend/src/modules/inventory-item-images/application/use-cases/list-inventory-item-images.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/application/use-cases/list-inventory-item-images.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 30 | 65 | execute |

### gai-backend/src/modules/inventory-item-images/application/use-cases/remove-inventory-item-image.use-case.ts

[gai-backend/src/modules/inventory-item-images/application/use-cases/remove-inventory-item-image.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/application/use-cases/remove-inventory-item-image.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 33 | 83 | execute |

### gai-backend/src/modules/inventory-item-images/infrastructure/persistence/typeorm-inventory-item-image.repository.ts

[gai-backend/src/modules/inventory-item-images/infrastructure/persistence/typeorm-inventory-item-image.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-item-images/infrastructure/persistence/typeorm-inventory-item-image.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 21 | 28 | findById |
| 30 | 38 | countActiveByItem |
| 40 | 65 | list |
| 67 | 89 | saveWithAudit |
| 91 | 102 | audit |
| 104 | 126 | toEntity |
| 128 | 147 | toDomain |
| 149 | 151 | toDate |
| 153 | 155 | toNullableDate |

### gai-backend/src/modules/inventory-items/application/services/inventory-item-scope.service.ts

[gai-backend/src/modules/inventory-items/application/services/inventory-item-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/application/services/inventory-item-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 31 | assertCanAccessOrganization |
| 33 | 56 | resolveOrganizationFilter |
| 58 | 65 | assertProjectAllowsMutation |
| 67 | 79 | normalizePlate |
| 81 | 90 | cleanText |

### gai-backend/src/modules/inventory-items/application/use-cases/create-inventory-item.use-case.ts

[gai-backend/src/modules/inventory-items/application/use-cases/create-inventory-item.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/application/use-cases/create-inventory-item.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 39 | 112 | execute |
| 114 | 120 | validation |

### gai-backend/src/modules/inventory-items/application/use-cases/get-inventory-item.use-case.ts

[gai-backend/src/modules/inventory-items/application/use-cases/get-inventory-item.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/application/use-cases/get-inventory-item.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 20 | 34 | execute |

### gai-backend/src/modules/inventory-items/application/use-cases/list-inventory-items.use-case.ts

[gai-backend/src/modules/inventory-items/application/use-cases/list-inventory-items.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/application/use-cases/list-inventory-items.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 30 | 74 | execute |

### gai-backend/src/modules/inventory-items/application/use-cases/update-inventory-item-status.use-case.ts

[gai-backend/src/modules/inventory-items/application/use-cases/update-inventory-item-status.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/application/use-cases/update-inventory-item-status.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 39 | 94 | execute |
| 96 | 105 | applyAction |
| 107 | 113 | operationFor |

### gai-backend/src/modules/inventory-items/application/use-cases/update-inventory-item.use-case.ts

[gai-backend/src/modules/inventory-items/application/use-cases/update-inventory-item.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/application/use-cases/update-inventory-item.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 37 | 111 | execute |
| 113 | 119 | validation |

### gai-backend/src/modules/inventory-items/infrastructure/persistence/typeorm-inventory-item.repository.ts

[gai-backend/src/modules/inventory-items/infrastructure/persistence/typeorm-inventory-item.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-items/infrastructure/persistence/typeorm-inventory-item.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 20 | 27 | findById |
| 29 | 71 | list |
| 73 | 95 | saveWithAudit |
| 97 | 131 | toEntity |
| 133 | 165 | toDomain |
| 167 | 169 | toDate |
| 171 | 173 | toNullableDate |

### gai-backend/src/modules/inventory-operations/application/inventory-operation.policy.ts

[gai-backend/src/modules/inventory-operations/application/inventory-operation.policy.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-operations/application/inventory-operation.policy.ts)

| Linha | Final | Método/função |
|---|---|---|
| 9 | 16 | normalizePlate |
| 18 | 24 | assertCanStart |
| 26 | 40 | assertCanFinishSession |
| 42 | 52 | assertCanCancelSession |
| 54 | 74 | assertCanReceiveObservation |

### gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts

[gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 98 | 129 | createSession |
| 131 | 154 | listSessions |
| 156 | 176 | getSession |
| 178 | 203 | listRounds |
| 205 | 253 | startSession |
| 255 | 302 | finishSession |
| 304 | 357 | cancelSession |
| 359 | 427 | requestReinventory |
| 429 | 593 | recordObservation |
| 595 | 622 | listObservations |
| 624 | 700 | createEvidenceUploadUrl |
| 702 | 764 | confirmEvidenceUpload |
| 766 | 793 | listObservationEvidence |
| 795 | 832 | createEvidenceDownloadUrl |
| 834 | 870 | finishRound |
| 872 | 1006 | reconcile |
| 1008 | 1034 | listReconciliations |
| 1036 | 1097 | consolidate |
| 1099 | 1141 | createValuation |
| 1143 | 1162 | listValuations |
| 1164 | 1217 | listPlateHistory |
| 1219 | 1243 | getProject |
| 1245 | 1249 | requireSession |
| 1250 | 1266 | requireObservation |
| 1267 | 1273 | assertSessionAcceptsEvidence |
| 1274 | 1296 | observationEvidenceStorageKey |
| 1297 | 1301 | requireItem |
| 1302 | 1307 | notFound |
| 1308 | 1311 | clean |
| 1312 | 1326 | isUniqueViolation |
| 1327 | 1339 | paginate |
| 1340 | 1359 | audit |
| 1360 | 1376 | sessionResponse |
| 1377 | 1393 | roundResponse |
| 1394 | 1413 | observationResponse |
| 1414 | 1435 | evidenceResponse |
| 1436 | 1453 | reconciliationResponse |
| 1454 | 1466 | consolidationResponse |
| 1467 | 1479 | valuationResponse |

### gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issue-scope.service.ts

[gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issue-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issue-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 27 | assertCanAccessOrganization |
| 29 | 36 | assertProjectAllowsMutation |
| 38 | 46 | normalizePlate |
| 48 | 53 | cleanText |

### gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issues.service.ts

[gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issues.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issues.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 63 | 120 | create |
| 122 | 152 | list |
| 154 | 161 | get |
| 163 | 194 | update |
| 196 | 203 | resolve |
| 205 | 212 | ignore |
| 214 | 220 | cancel |
| 222 | 333 | generate |
| 335 | 382 | transition |
| 384 | 443 | createGeneratedIssue |
| 445 | 459 | getProject |
| 461 | 474 | findIssue |
| 476 | 509 | assertLinkedItems |
| 511 | 530 | assertNoOpenDuplicate |
| 532 | 547 | listAllInventoryItems |
| 549 | 564 | listAllAccountingItems |
| 566 | 569 | differs |

### gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/typeorm-inventory-pending-issue.repository.ts

[gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/typeorm-inventory-pending-issue.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/typeorm-inventory-pending-issue.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 21 | 28 | findById |
| 30 | 62 | findOpenDuplicate |
| 64 | 133 | list |
| 135 | 159 | saveWithAudit |
| 161 | 189 | toEntity |
| 191 | 225 | toDomain |
| 227 | 229 | toDate |
| 231 | 233 | toNullableDate |

### gai-backend/src/modules/organizations/application/use-cases/activate-organization.use-case.ts

[gai-backend/src/modules/organizations/application/use-cases/activate-organization.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/application/use-cases/activate-organization.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 32 | 75 | execute |

### gai-backend/src/modules/organizations/application/use-cases/create-organization.use-case.ts

[gai-backend/src/modules/organizations/application/use-cases/create-organization.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/application/use-cases/create-organization.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 24 | 68 | execute |

### gai-backend/src/modules/organizations/application/use-cases/deactivate-organization.use-case.ts

[gai-backend/src/modules/organizations/application/use-cases/deactivate-organization.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/application/use-cases/deactivate-organization.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 32 | 75 | execute |

### gai-backend/src/modules/organizations/application/use-cases/get-organization.use-case.ts

[gai-backend/src/modules/organizations/application/use-cases/get-organization.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/application/use-cases/get-organization.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 15 | 24 | execute |

### gai-backend/src/modules/organizations/application/use-cases/list-organizations.use-case.ts

[gai-backend/src/modules/organizations/application/use-cases/list-organizations.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/application/use-cases/list-organizations.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 34 | execute |

### gai-backend/src/modules/organizations/application/use-cases/update-organization.use-case.ts

[gai-backend/src/modules/organizations/application/use-cases/update-organization.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/application/use-cases/update-organization.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 26 | 74 | execute |

### gai-backend/src/modules/organizations/infrastructure/persistence/typeorm-organization.repository.ts

[gai-backend/src/modules/organizations/infrastructure/persistence/typeorm-organization.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/organizations/infrastructure/persistence/typeorm-organization.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 23 | 27 | save |
| 29 | 32 | findById |
| 34 | 37 | findByCnpj |
| 39 | 66 | list |
| 68 | 88 | saveWithAudit |
| 90 | 106 | toEntity |
| 108 | 120 | toDomain |

### gai-backend/src/modules/payments-expenses/application/services/payments-expenses-scope.service.ts

[gai-backend/src/modules/payments-expenses/application/services/payments-expenses-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/payments-expenses/application/services/payments-expenses-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 30 | assertCanAccessOrganization |
| 31 | 37 | assertProjectAllowsMutation |
| 38 | 43 | cleanText |
| 44 | 50 | parseDate |
| 51 | 55 | nextDateString |
| 56 | 58 | daysBetweenInclusive |
| 59 | 61 | storageProvider |
| 62 | 64 | storageBucket |
| 65 | 67 | presignedUrlTtlSeconds |
| 68 | 76 | buildExpenseAttachmentPath |

### gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts

[gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 75 | 125 | createPayment |
| 126 | 155 | listPayments |
| 156 | 164 | getPayment |
| 165 | 197 | updatePayment |
| 198 | 204 | approvePayment |
| 205 | 212 | markPaymentPaid |
| 213 | 219 | cancelPayment |
| 220 | 241 | paymentSummary |
| 243 | 287 | createExpense |
| 288 | 314 | listExpenses |
| 315 | 323 | getExpense |
| 324 | 356 | updateExpense |
| 357 | 363 | approveExpense |
| 364 | 371 | rejectExpense |
| 372 | 378 | markExpensePaid |
| 379 | 385 | cancelExpense |
| 387 | 439 | createAttachmentUploadUrl |
| 440 | 468 | confirmAttachment |
| 469 | 478 | listAttachments |
| 479 | 516 | downloadAttachment |
| 517 | 541 | removeAttachment |
| 543 | 578 | paymentTransition |
| 579 | 614 | expenseTransition |
| 615 | 629 | getProject |
| 630 | 652 | assertFieldAgent |
| 653 | 666 | findPayment |
| 667 | 680 | findExpense |
| 681 | 695 | findAttachment |
| 696 | 704 | requiredDate |

### gai-backend/src/modules/payments-expenses/infrastructure/persistence/typeorm-payments-expenses.repository.ts

[gai-backend/src/modules/payments-expenses/infrastructure/persistence/typeorm-payments-expenses.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/payments-expenses/infrastructure/persistence/typeorm-payments-expenses.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 30 | 37 | findPaymentById |
| 38 | 70 | listPayments |
| 71 | 84 | savePaymentWithAudit |
| 85 | 92 | findExpenseById |
| 93 | 125 | listExpenses |
| 126 | 139 | saveExpenseWithAudit |
| 140 | 147 | findAttachmentById |
| 148 | 151 | listAttachments |
| 152 | 166 | saveAttachmentWithAudit |
| 167 | 171 | audit |
| 172 | 183 | toPaymentEntity |
| 184 | 191 | toExpenseEntity |
| 192 | 198 | toAttachmentEntity |
| 199 | 219 | toPayment |
| 220 | 233 | toExpense |
| 234 | 246 | toAttachment |
| 247 | 249 | money |
| 250 | 252 | date |
| 253 | 255 | nullDate |
| 256 | 260 | hasPaymentDateFilters |
| 261 | 263 | hasExpenseDateFilters |
| 264 | 279 | matchesPaymentDateFilters |
| 280 | 289 | matchesExpenseDateFilters |
| 290 | 292 | dateKey |
| 293 | 295 | nullDateKey |

### gai-backend/src/modules/project-dashboard/application/services/organization-overview.service.ts

[gai-backend/src/modules/project-dashboard/application/services/organization-overview.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/project-dashboard/application/services/organization-overview.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 23 | 51 | query |
| 53 | 82 | overview |
| 84 | 98 | projectPage |
| 100 | 113 | companyPage |
| 115 | 120 | exportRows |

### gai-backend/src/modules/project-dashboard/application/services/project-dashboard-analytics.service.ts

[gai-backend/src/modules/project-dashboard/application/services/project-dashboard-analytics.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/project-dashboard/application/services/project-dashboard-analytics.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 107 | 237 | getDashboard |
| 239 | 286 | resolveFilters |
| 288 | 308 | toTimeline |
| 310 | 320 | toStatusDistribution |
| 322 | 347 | fillDailyGaps |
| 349 | 361 | toUnits |
| 363 | 406 | toGeography |
| 408 | 425 | unlocatedItems |
| 427 | 437 | estimateCompletion |
| 439 | 442 | normalizeState |
| 444 | 450 | normalize |
| 452 | 459 | dateInTimezone |
| 461 | 463 | startOfDay |
| 465 | 467 | endOfDay |
| 469 | 471 | validation |
| 473 | 479 | logFilters |

### gai-backend/src/modules/project-dashboard/application/services/project-summary-calculations.ts

[gai-backend/src/modules/project-dashboard/application/services/project-summary-calculations.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/project-dashboard/application/services/project-summary-calculations.ts)

| Linha | Final | Método/função |
|---|---|---|
| 1 | 9 | calculateProgressPercentage |
| 11 | 15 | sumMoney |

### gai-backend/src/modules/project-dashboard/application/services/project-summary.service.ts

[gai-backend/src/modules/project-dashboard/application/services/project-summary.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/project-dashboard/application/services/project-summary.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 39 | 109 | getSummary |
| 111 | 133 | toProjectDto |

### gai-backend/src/modules/project-dashboard/infrastructure/persistence/typeorm-project-dashboard-analytics.repository.ts

[gai-backend/src/modules/project-dashboard/infrastructure/persistence/typeorm-project-dashboard-analytics.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/project-dashboard/infrastructure/persistence/typeorm-project-dashboard-analytics.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 62 | 130 | getAnalytics |
| 132 | 169 | getSummary |
| 171 | 186 | getTimeline |
| 188 | 198 | getStatuses |
| 200 | 216 | getUnits |
| 218 | 231 | getQuality |
| 233 | 249 | getGeographyUnits |
| 251 | 269 | getRecentActivity |
| 271 | 280 | getAvailableUnits |
| 282 | 332 | baseItemsQuery |
| 334 | 350 | periodExpression |
| 352 | 356 | dayExpression |
| 358 | 366 | startOfToday |
| 368 | 373 | statusAfter |
| 375 | 378 | number |
| 380 | 393 | date |
| 395 | 405 | string |

### gai-backend/src/modules/project-dashboard/infrastructure/persistence/typeorm-project-summary.repository.ts

[gai-backend/src/modules/project-dashboard/infrastructure/persistence/typeorm-project-summary.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/project-dashboard/infrastructure/persistence/typeorm-project-summary.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 90 | 192 | getInventorySummary |
| 194 | 230 | getImagesSummary |
| 232 | 332 | getAccountingSummary |
| 334 | 402 | getPendingIssuesSummary |
| 404 | 436 | getFieldAgentsSummary |
| 438 | 482 | getFinancialSummary |
| 484 | 540 | getImportsSummary |
| 542 | 592 | getExportsSummary |
| 594 | 648 | getRecentActivitySummary |
| 650 | 697 | getPaymentSummary |
| 699 | 756 | getExpenseSummary |
| 758 | 760 | countStatus |
| 762 | 764 | countCase |
| 766 | 768 | number |
| 770 | 772 | money |
| 774 | 782 | isoDate |

### gai-backend/src/modules/projects/application/services/project-scope.service.ts

[gai-backend/src/modules/projects/application/services/project-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/application/services/project-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 12 | 35 | resolveOrganizationForCreate |
| 37 | 63 | resolveOrganizationFilter |
| 65 | 79 | assertCanAccessProject |

### gai-backend/src/modules/projects/application/use-cases/create-project.use-case.ts

[gai-backend/src/modules/projects/application/use-cases/create-project.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/application/use-cases/create-project.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 42 | 115 | execute |
| 117 | 119 | parseDate |
| 121 | 126 | toValidationError |

### gai-backend/src/modules/projects/application/use-cases/get-project.use-case.ts

[gai-backend/src/modules/projects/application/use-cases/get-project.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/application/use-cases/get-project.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 20 | 33 | execute |

### gai-backend/src/modules/projects/application/use-cases/list-projects.use-case.ts

[gai-backend/src/modules/projects/application/use-cases/list-projects.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/application/use-cases/list-projects.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 24 | 51 | execute |

### gai-backend/src/modules/projects/application/use-cases/update-project-status.use-case.ts

[gai-backend/src/modules/projects/application/use-cases/update-project-status.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/application/use-cases/update-project-status.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 33 | 98 | execute |

### gai-backend/src/modules/projects/application/use-cases/update-project.use-case.ts

[gai-backend/src/modules/projects/application/use-cases/update-project.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/application/use-cases/update-project.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 33 | 113 | execute |
| 115 | 130 | toEditableFields |
| 132 | 137 | parseDate |
| 139 | 150 | toDomainError |

### gai-backend/src/modules/projects/domain/services/project-status-transition.policy.ts

[gai-backend/src/modules/projects/domain/services/project-status-transition.policy.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/domain/services/project-status-transition.policy.ts)

| Linha | Final | Método/função |
|---|---|---|
| 115 | 117 | getRule |
| 119 | 128 | resolve |
| 130 | 132 | allRules |
| 134 | 144 | availableActions |
| 146 | 150 | allowsOperationalMutation |

### gai-backend/src/modules/projects/infrastructure/persistence/typeorm-project.repository.ts

[gai-backend/src/modules/projects/infrastructure/persistence/typeorm-project.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/projects/infrastructure/persistence/typeorm-project.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 53 | 56 | findById |
| 58 | 89 | list |
| 91 | 110 | saveWithAudit |
| 112 | 173 | updateFieldsWithAudit |
| 175 | 267 | transitionStatusWithAudit |
| 269 | 273 | supportsPessimisticLock |
| 275 | 453 | findBlockingOperations |
| 455 | 474 | countOpenExportJobs |
| 476 | 499 | toEntity |
| 501 | 522 | toDomain |
| 524 | 526 | toDate |
| 528 | 530 | toNullableDate |

### gai-backend/src/modules/users/application/services/user-scope.service.ts

[gai-backend/src/modules/users/application/services/user-scope.service.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/services/user-scope.service.ts)

| Linha | Final | Método/função |
|---|---|---|
| 18 | 25 | assertCanManageUsers |
| 27 | 29 | assertCanAssignRoles |
| 31 | 47 | assertCanAccessUser |
| 49 | 74 | assertCanFilterByOrganization |
| 76 | 95 | assertCanAccessOrganization |
| 97 | 116 | resolveOrganizationIdForCreate |
| 118 | 131 | assertPlatformOnlyAssignment |
| 133 | 137 | assertCanChangeUserOrganization |
| 139 | 165 | assertCanAssignRole |
| 167 | 189 | assertCanRevokeRole |
| 191 | 196 | isAdmin |
| 198 | 203 | forbidden |

### gai-backend/src/modules/users/application/use-cases/activate-user.use-case.ts

[gai-backend/src/modules/users/application/use-cases/activate-user.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/activate-user.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 35 | 78 | execute |

### gai-backend/src/modules/users/application/use-cases/assign-user-role.use-case.ts

[gai-backend/src/modules/users/application/use-cases/assign-user-role.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/assign-user-role.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 41 | 117 | execute |

### gai-backend/src/modules/users/application/use-cases/create-org-role.use-case.ts

[gai-backend/src/modules/users/application/use-cases/create-org-role.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/create-org-role.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 41 | 106 | execute |
| 108 | 120 | assertOrganizationExists |
| 122 | 142 | assertValidPermissions |

### gai-backend/src/modules/users/application/use-cases/create-user.use-case.ts

[gai-backend/src/modules/users/application/use-cases/create-user.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/create-user.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 31 | 91 | execute |

### gai-backend/src/modules/users/application/use-cases/deactivate-org-role.use-case.ts

[gai-backend/src/modules/users/application/use-cases/deactivate-org-role.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/deactivate-org-role.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 26 | 78 | execute |

### gai-backend/src/modules/users/application/use-cases/deactivate-user.use-case.ts

[gai-backend/src/modules/users/application/use-cases/deactivate-user.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/deactivate-user.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 41 | 106 | execute |

### gai-backend/src/modules/users/application/use-cases/get-org-role.use-case.ts

[gai-backend/src/modules/users/application/use-cases/get-org-role.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/get-org-role.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 17 | 36 | execute |

### gai-backend/src/modules/users/application/use-cases/get-user.use-case.ts

[gai-backend/src/modules/users/application/use-cases/get-user.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/get-user.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 23 | 35 | execute |

### gai-backend/src/modules/users/application/use-cases/list-org-roles.use-case.ts

[gai-backend/src/modules/users/application/use-cases/list-org-roles.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/list-org-roles.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 22 | 45 | execute |

### gai-backend/src/modules/users/application/use-cases/list-permissions.use-case.ts

[gai-backend/src/modules/users/application/use-cases/list-permissions.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/list-permissions.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 16 | 21 | execute |

### gai-backend/src/modules/users/application/use-cases/list-user-role-assignments.use-case.ts

[gai-backend/src/modules/users/application/use-cases/list-user-role-assignments.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/list-user-role-assignments.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 23 | 43 | execute |

### gai-backend/src/modules/users/application/use-cases/list-users.use-case.ts

[gai-backend/src/modules/users/application/use-cases/list-users.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/list-users.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 24 | 61 | execute |

### gai-backend/src/modules/users/application/use-cases/revoke-user-role-assignment.use-case.ts

[gai-backend/src/modules/users/application/use-cases/revoke-user-role-assignment.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/revoke-user-role-assignment.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 33 | 92 | execute |

### gai-backend/src/modules/users/application/use-cases/update-org-role.use-case.ts

[gai-backend/src/modules/users/application/use-cases/update-org-role.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/update-org-role.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 35 | 131 | execute |
| 133 | 153 | assertValidPermissions |

### gai-backend/src/modules/users/application/use-cases/update-user.use-case.ts

[gai-backend/src/modules/users/application/use-cases/update-user.use-case.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/application/use-cases/update-user.use-case.ts)

| Linha | Final | Método/função |
|---|---|---|
| 41 | 148 | execute |

### gai-backend/src/modules/users/infrastructure/persistence/typeorm-org-role.repository.ts

[gai-backend/src/modules/users/infrastructure/persistence/typeorm-org-role.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/typeorm-org-role.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 31 | 40 | findById |
| 42 | 54 | findByIdAndOrganization |
| 56 | 68 | findByNameInOrganization |
| 70 | 91 | listByOrganization |
| 93 | 97 | countActiveUsersWithRole |
| 99 | 167 | saveWithAudit |
| 169 | 175 | loadPermissions |
| 177 | 190 | loadPermissionsWithRepo |
| 192 | 203 | toDomain |
| 205 | 214 | toPermissionRef |

### gai-backend/src/modules/users/infrastructure/persistence/typeorm-permission.repository.ts

[gai-backend/src/modules/users/infrastructure/persistence/typeorm-permission.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/typeorm-permission.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 18 | 25 | findAll |
| 27 | 33 | findByIds |
| 35 | 41 | findByKeys |
| 43 | 52 | toRecord |

### gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-management.repository.ts

[gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-management.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-management.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 26 | 29 | findById |
| 31 | 34 | findByLogin |
| 36 | 39 | findByEmail |
| 41 | 87 | list |
| 89 | 110 | countActivePlatformAdmins |
| 112 | 164 | saveWithAudit |
| 166 | 177 | toDomain |

### gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-role-assignment.repository.ts

[gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-role-assignment.repository.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-role-assignment.repository.ts)

| Linha | Final | Método/função |
|---|---|---|
| 27 | 31 | findActiveByUserId |
| 33 | 37 | findAllActiveByUserId |
| 39 | 43 | findActiveByUserIds |
| 45 | 53 | findActiveAssignment |
| 55 | 86 | assign |
| 88 | 93 | revoke |
| 95 | 121 | countActiveUsersWithSystemRole |
| 123 | 144 | findUsersBySystemRole |
| 146 | 196 | loadAssignments |
| 198 | 212 | toAssignedRole |

## Frontend: rotas, features, formulários, schemas e componentes

### gai-frontend/src/api/endpoints.ts

[gai-frontend/src/api/endpoints.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/api/endpoints.ts) — 489 linhas.

### gai-frontend/src/api/http.ts

[gai-frontend/src/api/http.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/api/http.ts) — 72 linhas.

| Linha | Final | Função |
|---|---|---|
| 48 | 50 | getPresignedUrl |
| 52 | 71 | uploadToPresignedUrl |

### gai-frontend/src/api/pagination.ts

[gai-frontend/src/api/pagination.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/api/pagination.ts) — 22 linhas.

| Linha | Final | Função |
|---|---|---|
| 3 | 21 | normalizePage |

### gai-frontend/src/api/session-storage.ts

[gai-frontend/src/api/session-storage.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/api/session-storage.ts) — 29 linhas.

| Linha | Final | Função |
|---|---|---|
| 11 | 20 | readStoredSession |
| 22 | 24 | writeStoredSession |
| 26 | 28 | clearStoredSession |

### gai-frontend/src/app/AppProviders.tsx

[gai-frontend/src/app/AppProviders.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/app/AppProviders.tsx) — 31 linhas.

| Linha | Final | Função |
|---|---|---|
| 6 | 30 | AppProviders |

### gai-frontend/src/components/base/Cards.tsx

[gai-frontend/src/components/base/Cards.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/Cards.tsx) — 52 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 35 | MetricCard |
| 37 | 51 | ProgressCard |

### gai-frontend/src/components/base/DataTable.tsx

[gai-frontend/src/components/base/DataTable.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/DataTable.tsx) — 32 linhas.

| Linha | Final | Função |
|---|---|---|
| 11 | 31 | DataTable |

### gai-frontend/src/components/base/FilterPanel.tsx

[gai-frontend/src/components/base/FilterPanel.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/FilterPanel.tsx) — 14 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 13 | FilterPanel |

### gai-frontend/src/components/base/FormField.tsx

[gai-frontend/src/components/base/FormField.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/FormField.tsx) — 42 linhas.

| Linha | Final | Função |
|---|---|---|
| 14 | 41 | FormField |

| Linha | UI/ação/permissão declarada |
|---|---|
| 32 | label={`Ajuda sobre ${label}`} |
| 32 | title={helpTitle} |

### gai-frontend/src/components/base/Inputs.tsx

[gai-frontend/src/components/base/Inputs.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/Inputs.tsx) — 15 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 6 | MoneyInput |
| 8 | 10 | DateInput |
| 12 | 14 | FileUpload |

### gai-frontend/src/components/base/PageContainer.tsx

[gai-frontend/src/components/base/PageContainer.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/PageContainer.tsx) — 6 linhas.

| Linha | Final | Função |
|---|---|---|
| 3 | 5 | PageContainer |

### gai-frontend/src/components/base/PageHeader.tsx

[gai-frontend/src/components/base/PageHeader.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/PageHeader.tsx) — 15 linhas.

| Linha | Final | Função |
|---|---|---|
| 3 | 14 | PageHeader |

### gai-frontend/src/components/base/Pagination.tsx

[gai-frontend/src/components/base/Pagination.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/Pagination.tsx) — 21 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 20 | Pagination |

| Linha | UI/ação/permissão declarada |
|---|---|
| 11 | disabled={page <= 1} |
| 11 | onClick={() => onPageChange(page - 1)} |
| 14 | disabled={page >= totalPages} |
| 14 | onClick={() => onPageChange(page + 1)} |

### gai-frontend/src/components/base/SearchInput.tsx

[gai-frontend/src/components/base/SearchInput.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/SearchInput.tsx) — 17 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 16 | SearchInput |

| Linha | UI/ação/permissão declarada |
|---|---|
| 10 | onClick={() => onChange('')} |

### gai-frontend/src/components/base/States.tsx

[gai-frontend/src/components/base/States.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/States.tsx) — 53 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 21 | LoadingState |
| 23 | 35 | EmptyState |
| 37 | 52 | ErrorState |

| Linha | UI/ação/permissão declarada |
|---|---|
| 46 | onClick={onRetry} |

### gai-frontend/src/components/base/StatusBadge.tsx

[gai-frontend/src/components/base/StatusBadge.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/StatusBadge.tsx) — 87 linhas.

| Linha | Final | Função |
|---|---|---|
| 83 | 86 | StatusBadge |

| Linha | UI/ação/permissão declarada |
|---|---|
| 85 | title={raw} |

### gai-frontend/src/components/base/Tabs.tsx

[gai-frontend/src/components/base/Tabs.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/base/Tabs.tsx) — 16 linhas.

| Linha | Final | Função |
|---|---|---|
| 5 | 15 | Tabs |

### gai-frontend/src/components/ui/button.tsx

[gai-frontend/src/components/ui/button.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/ui/button.tsx) — 55 linhas.

| Linha | UI/ação/permissão declarada |
|---|---|
| 46 | disabled={disabled \|\| loading} |

### gai-frontend/src/components/ui/dialog.tsx

[gai-frontend/src/components/ui/dialog.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/ui/dialog.tsx) — 68 linhas.

| Linha | Final | Função |
|---|---|---|
| 7 | 28 | ModalForm |
| 30 | 51 | DrawerForm |
| 53 | 67 | ConfirmDialog |

| Linha | UI/ação/permissão declarada |
|---|---|
| 55 | title={title} |
| 58 | disabled={busy} |
| 58 | onClick={() => onOpenChange(false)} |
| 61 | disabled={busy} |
| 61 | onClick={onConfirm} |

### gai-frontend/src/components/ui/help-popover.tsx

[gai-frontend/src/components/ui/help-popover.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/ui/help-popover.tsx) — 47 linhas.

| Linha | Final | Função |
|---|---|---|
| 11 | 46 | HelpPopover |

### gai-frontend/src/components/ui/icon-input.tsx

[gai-frontend/src/components/ui/icon-input.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/ui/icon-input.tsx) — 24 linhas.

### gai-frontend/src/components/ui/input.tsx

[gai-frontend/src/components/ui/input.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/ui/input.tsx) — 20 linhas.

### gai-frontend/src/components/ui/toast-context.ts

[gai-frontend/src/components/ui/toast-context.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/ui/toast-context.ts) — 22 linhas.

| Linha | Final | Função |
|---|---|---|
| 19 | 21 | useToast |

### gai-frontend/src/components/ui/toast.tsx

[gai-frontend/src/components/ui/toast.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/ui/toast.tsx) — 68 linhas.

| Linha | Final | Função |
|---|---|---|
| 11 | 37 | ToastProvider |
| 39 | 67 | ToastItem |

| Linha | UI/ação/permissão declarada |
|---|---|
| 61 | onClick={() => onDismiss(entry.id)} |

### gai-frontend/src/constants/navigation.ts

[gai-frontend/src/constants/navigation.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/constants/navigation.ts) — 12 linhas.

### gai-frontend/src/features/accountabilities/accountabilityQueries.ts

[gai-frontend/src/features/accountabilities/accountabilityQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accountabilities/accountabilityQueries.ts) — 20 linhas.

| Linha | Final | Função |
|---|---|---|
| 11 | 11 | useAccountabilities |
| 12 | 12 | useAccountability |
| 13 | 13 | useProjectMutation |
| 14 | 14 | useCreateAccountability |
| 15 | 15 | useAddAccountabilityExpense |
| 16 | 16 | useCloseAccountability |
| 17 | 17 | useEligibleExpenses |
| 18 | 18 | useInstallments |
| 19 | 19 | useGenerateInstallments |

### gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.tsx

[gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.tsx) — 34 linhas.

| Linha | Final | Função |
|---|---|---|
| 19 | 24 | ProjectAccountabilitiesPage |
| 26 | 26 | CreateDrawer |
| 26 | 26 | submit |
| 28 | 28 | AccountabilityDrawer |
| 30 | 30 | InstallmentsDrawer |
| 32 | 32 | Field |
| 33 | 33 | Info |

| Linha | UI/ação/permissão declarada |
|---|---|
| 22 | onClick={() => setViewing(item)} |
| 23 | title="Prestacao de contas" |
| 23 | onClick={() => setCreateOpen(true)} |
| 23 | label="Carregando prestacoes" |
| 26 | title="Nova prestacao" |
| 26 | onSubmit={submit} |
| 26 | label="Inventariante" |
| 26 | label="Inicio do periodo" |
| 26 | label="Fim do periodo" |
| 26 | label="Observacoes" |
| 26 | disabled={mutation.isPending \|\| !agent \|\| !start \|\| !end \|\| start > end} |
| 28 | title={`Prestacao #${item.id}`} |
| 28 | label="Status" |
| 28 | label="Total final" |
| 28 | label="Periodo" |
| 28 | label="Fechada em" |
| 28 | onClick={() => setInstallmentExpense(id)} |
| 28 | disabled={!expenseId \|\| add.isPending} |
| 28 | onClick={() => add.mutate({ id: item.id, expenseId: Number(expenseId) }, { onSuccess: () => setExpenseId('') })} |
| 28 | disabled={!item.expense_ids.length} |
| 28 | onClick={() => setClosing(true)} |
| 28 | title="Fechar prestacao de contas" |
| 30 | title={`Parcelas da despesa #${expenseId ?? ''}`} |
| 30 | label="Quantidade" |
| 30 | label="Primeiro vencimento" |
| 30 | disabled={!expenseId \|\| !count \|\| Number(count) > 120 \|\| !date \|\| generate.isPending} |
| 30 | onClick={() => expenseId && generate.mutate({ expenseId, count: Number(count), first_due_date: date })} |

### gai-frontend/src/features/accounting-items/AccountingImportsPanel.tsx

[gai-frontend/src/features/accounting-items/AccountingImportsPanel.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accounting-items/AccountingImportsPanel.tsx) — 100 linhas.

| Linha | Final | Função |
|---|---|---|
| 16 | 99 | AccountingImportsPanel |
| 25 | 35 | handleFile |

| Linha | UI/ação/permissão declarada |
|---|---|
| 48 | disabled={!batch.failed_rows} |
| 48 | onClick={() => setErrorsBatch(batch)} |
| 64 | onClick={() => setImportOpen(true)} |
| 67 | label="Carregando importacoes" |
| 69 | title="Nenhuma importacao registrada" |
| 71 | title="Importar base contabil XLSX" |
| 77 | disabled={upload.isPending} |
| 78 | label="Enviando arquivo" |
| 83 | title={`Erros da importacao ${errorsBatch ? `#${errorsBatch.id}` : ''}`} |
| 84 | label="Carregando erros" |
| 95 | title="Sem erros registrados" |

### gai-frontend/src/features/accounting-items/AccountingItemDetailDrawer.tsx

[gai-frontend/src/features/accounting-items/AccountingItemDetailDrawer.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accounting-items/AccountingItemDetailDrawer.tsx) — 65 linhas.

| Linha | Final | Função |
|---|---|---|
| 8 | 55 | AccountingItemDetailDrawer |
| 57 | 64 | Info |

| Linha | UI/ação/permissão declarada |
|---|---|
| 13 | title="Detalhes do item contabil" |
| 26 | label="Valor de aquisicao" |
| 27 | label="Data de aquisicao" |
| 28 | label="Codigo base" |
| 29 | label="Codigo investor" |
| 31 | label="Descricao" |
| 32 | label="Conta contabil" |
| 33 | label="Localizacao" |
| 34 | label="Obs. 1" |
| 35 | label="Obs. 2" |
| 36 | label="Placa nova inventario" |
| 37 | label="Descricao inventario" |
| 38 | label="Localizacao inventario" |
| 39 | label="Import batch" |
| 40 | label="Criado em" |
| 41 | label="Atualizado em" |

### gai-frontend/src/features/accounting-items/AccountingItemForm.tsx

[gai-frontend/src/features/accounting-items/AccountingItemForm.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accounting-items/AccountingItemForm.tsx) — 67 linhas.

| Linha | Final | Função |
|---|---|---|
| 10 | 62 | AccountingItemForm |
| 64 | 66 | clean |

| Linha | UI/ação/permissão declarada |
|---|---|
| 32 | onSubmit={form.handleSubmit((values) => onSubmit(clean(values as unknown as InventoryAccountingItemInput)))} |
| 34 | label="Placa" |
| 35 | label="Codigo base" |
| 36 | label="Codigo investor" |
| 37 | label="Localizacao" |
| 39 | label="Descricao" |
| 40 | label="Conta contabil" |
| 42 | label="Data de aquisicao" |
| 43 | label="Valor de aquisicao" |
| 44 | label="Status" |
| 51 | label="Obs. 1" |
| 52 | label="Obs. 2" |
| 55 | label="Placa nova inventario" |
| 56 | label="Localizacao inventario" |
| 58 | label="Descricao inventario" |

### gai-frontend/src/features/accounting-items/accountingItemSchemas.ts

[gai-frontend/src/features/accounting-items/accountingItemSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accounting-items/accountingItemSchemas.ts) — 40 linhas.

| Linha | Final | Função |
|---|---|---|
| 32 | 39 | validateAccountingImportFile |

### gai-frontend/src/features/accounting-items/accountingItemsQueries.ts

[gai-frontend/src/features/accounting-items/accountingItemsQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accounting-items/accountingItemsQueries.ts) — 94 linhas.

| Linha | Final | Função |
|---|---|---|
| 28 | 34 | useProjectAccountingItems |
| 36 | 42 | useProjectAccountingItem |
| 44 | 54 | useUpdateAccountingItem |
| 56 | 65 | useChangeAccountingItemStatus |
| 67 | 73 | useAccountingImports |
| 75 | 85 | useImportAccountingFile |
| 87 | 93 | useAccountingImportErrors |

### gai-frontend/src/features/accounting-items/ProjectAccountingItemsPage.tsx

[gai-frontend/src/features/accounting-items/ProjectAccountingItemsPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accounting-items/ProjectAccountingItemsPage.tsx) — 129 linhas.

| Linha | Final | Função |
|---|---|---|
| 24 | 128 | ProjectAccountingItemsPage |

| Linha | UI/ação/permissão declarada |
|---|---|
| 67 | onClick={() => setViewingId(item.id)} |
| 69 | onClick={() => setEditing(item)} |
| 73 | onClick={() => setConfirm({ action: 'reactivate', item })} |
| 77 | onClick={() => setConfirm({ action: 'deactivate', item })} |
| 87 | title="Base contabil" |
| 112 | title="Editar item contabil" |
| 113 | onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} |
| 118 | title={confirm?.action === 'deactivate' ? 'Desativar item contabil' : 'Reativar item contabil'} |

### gai-frontend/src/features/auth/AuthContext.ts

[gai-frontend/src/features/auth/AuthContext.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/auth/AuthContext.ts) — 21 linhas.

| Linha | Final | Função |
|---|---|---|
| 16 | 20 | useAuth |

### gai-frontend/src/features/auth/AuthProvider.tsx

[gai-frontend/src/features/auth/AuthProvider.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/auth/AuthProvider.tsx) — 83 linhas.

| Linha | Final | Função |
|---|---|---|
| 9 | 82 | AuthProvider |

### gai-frontend/src/features/auth/LoginPage.tsx

[gai-frontend/src/features/auth/LoginPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/auth/LoginPage.tsx) — 74 linhas.

| Linha | Final | Função |
|---|---|---|
| 15 | 73 | LoginPage |
| 23 | 33 | onSubmit |

| Linha | UI/ação/permissão declarada |
|---|---|
| 44 | onSubmit={handleSubmit(onSubmit)} |
| 46 | label="Login ou email" |
| 49 | label="Senha" |
| 56 | onClick={() => setShowPassword((visible) => !visible)} |
| 56 | title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} |

### gai-frontend/src/features/auth/PasswordPages.tsx

[gai-frontend/src/features/auth/PasswordPages.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/auth/PasswordPages.tsx) — 85 linhas.

| Linha | Final | Função |
|---|---|---|
| 13 | 28 | ForgotPasswordPage |
| 30 | 48 | ResetPasswordPage |
| 50 | 52 | SessionExpiredPage |
| 53 | 55 | AccessDeniedPage |
| 56 | 58 | AccountLockedPage |
| 60 | 69 | Message |
| 71 | 80 | AuthPanel |
| 82 | 84 | BackToLogin |

| Linha | UI/ação/permissão declarada |
|---|---|
| 17 | title="Recuperar senha" |
| 18 | onSubmit={form.handleSubmit(async ({ email }) => setDone((await authApi.requestPasswordReset(email)).message))} |
| 19 | label="Email" |
| 38 | title="Redefinir senha" |
| 39 | onSubmit={form.handleSubmit(async ({ token, new_password }) => setDone((await authApi.confirmPasswordReset(token, new_password)).message))} |
| 40 | label="Token" |
| 41 | label="Nova senha" |
| 51 | title="Sessao expirada" |
| 54 | title="Acesso negado" |
| 57 | title="Conta bloqueada" |
| 64 | title={title} |

### gai-frontend/src/features/auth/PermissionGate.tsx

[gai-frontend/src/features/auth/PermissionGate.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/auth/PermissionGate.tsx) — 8 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 7 | PermissionGate |

### gai-frontend/src/features/auth/permissions.ts

[gai-frontend/src/features/auth/permissions.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/auth/permissions.ts) — 30 linhas.

| Linha | Final | Função |
|---|---|---|
| 3 | 7 | getSystemRoles |
| 9 | 11 | isPlatformAdmin |
| 13 | 24 | hasPermission |
| 26 | 29 | canAccess |

### gai-frontend/src/features/auth/usePermissions.ts

[gai-frontend/src/features/auth/usePermissions.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/auth/usePermissions.ts) — 13 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 12 | usePermissions |

### gai-frontend/src/features/companies/CompaniesPage.tsx

[gai-frontend/src/features/companies/CompaniesPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/companies/CompaniesPage.tsx) — 44 linhas.

| Linha | Final | Função |
|---|---|---|
| 10 | 30 | CompaniesPage |
| 32 | 43 | CompanyForm |

| Linha | UI/ação/permissão declarada |
|---|---|
| 13 | title="Empresas" |
| 27 | onSubmit={submit} |
| 35 | onSubmit={form.handleSubmit((values) => onSubmit({ ...values, organization_id: Number(values.organization_id) }))} |
| 36 | label="Organization ID" |
| 37 | label="Nome" |
| 38 | label="Razao social" |
| 39 | label="Documento" |

### gai-frontend/src/features/dashboard/DashboardPage.tsx

[gai-frontend/src/features/dashboard/DashboardPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/dashboard/DashboardPage.tsx) — 128 linhas.

| Linha | Final | Função |
|---|---|---|
| 16 | 20 | DashboardPage |
| 22 | 95 | OperationalDashboardPage |
| 97 | 127 | PortfolioPulse |

| Linha | UI/ação/permissão declarada |
|---|---|
| 43 | title="Dashboard operacional" |
| 66 | label={card.label} |
| 92 | title="Nenhum indicador disponivel" |

### gai-frontend/src/features/dashboard/OrganizationOverviewPage.tsx

[gai-frontend/src/features/dashboard/OrganizationOverviewPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/dashboard/OrganizationOverviewPage.tsx) — 110 linhas.

| Linha | Final | Função |
|---|---|---|
| 25 | 109 | OrganizationOverviewPage |
| 31 | 35 | crossFilter |
| 43 | 52 | download |

| Linha | UI/ação/permissão declarada |
|---|---|
| 55 | title="Visão Geral" |
| 56 | onSubmit={event => {       event.preventDefault();       const values = new FormData(event.currentTarget);       setParams(Object.fromEntries(fields.flatMap(key => values.get(key) ? [[key, String(values.get(key))]] : [])));     }} |
| 69 | onClick={() => crossFilter('company_id')} |
| 72 | onClick={() => setParams({})} |
| 78 | label="Valor total em contratos" |
| 79 | label="Quantidade de projetos" |
| 80 | label="Projetos em aberto" |
| 81 | label="Ticket médio dos contratos" |
| 82 | label="Valor em contratos abertos" |
| 83 | label="Quantidade de itens em contratos" |
| 90 | title="Nenhum projeto encontrado" |
| 94 | title="Dashboards dependentes de dados contratuais" |
| 104 | disabled={exporting \|\| query.isFetching} |
| 104 | onClick={() => void download(format)} |

### gai-frontend/src/features/dashboard/OverviewDetails.tsx

[gai-frontend/src/features/dashboard/OverviewDetails.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/dashboard/OverviewDetails.tsx) — 72 linhas.

| Linha | Final | Função |
|---|---|---|
| 10 | 12 | OverviewSection |
| 14 | 23 | PortfolioStatus |
| 25 | 36 | OrganizationPresenceMap |
| 41 | 43 | Pagination |
| 44 | 71 | OverviewTables |
| 54 | 56 | sortProjects |

| Linha | UI/ação/permissão declarada |
|---|---|
| 18 | title="Status da carteira" |
| 20 | onClick={entry => onSelect(selected === entry.status ? undefined : entry.status)} |
| 21 | onClick={() => onSelect(selected === row.status ? undefined : row.status)} |
| 28 | title="Mapa do Brasil — presença por estado" |
| 32 | onClick={() => onSelect(selected === state ? undefined : state)} |
| 33 | onClick={() => onSelect(selected === row.state ? undefined : row.state)} |
| 34 | onClick={() => onSelect(undefined)} |
| 42 | disabled={page <= 1} |
| 42 | onClick={() => onPage(page - 1)} |
| 42 | disabled={page * size >= total} |
| 42 | onClick={() => onPage(page + 1)} |
| 60 | title="Agrupamento por empresa" |
| 61 | onSubmit={event => { event.preventDefault(); setCompanyPage(1); setCompanySearch(String(new FormData(event.currentTarget).get('company_search') ?? '')); }} |
| 63 | onClick={() => { setCompanySort(key); setCompanyDirection(companySort === key && companyDirection === 'DESC' ? 'ASC' : 'DESC'); setCompanyPage(1); }} |
| 63 | onClick={() => onCompany(row.id!)} |
| 65 | title="Projetos filtrados" |
| 66 | onClick={() => { setDirection(direction === 'ASC' ? 'DESC' : 'ASC'); setPage(1); }} |
| 68 | onClick={() => sortProjects(key)} |

### gai-frontend/src/features/export-jobs/exportJobSchemas.ts

[gai-frontend/src/features/export-jobs/exportJobSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/export-jobs/exportJobSchemas.ts) — 34 linhas.

### gai-frontend/src/features/export-jobs/exportJobsQueries.ts

[gai-frontend/src/features/export-jobs/exportJobsQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/export-jobs/exportJobsQueries.ts) — 62 linhas.

| Linha | Final | Função |
|---|---|---|
| 21 | 28 | useExportJobs |
| 30 | 36 | useInvalidateExportJobs |
| 38 | 41 | useCreateExportJob |
| 43 | 46 | useCancelExportJob |
| 48 | 51 | useRetryExportJob |
| 53 | 61 | useDownloadExportJob |

### gai-frontend/src/features/export-jobs/ProjectExportJobsPage.tsx

[gai-frontend/src/features/export-jobs/ProjectExportJobsPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/export-jobs/ProjectExportJobsPage.tsx) — 210 linhas.

| Linha | Final | Função |
|---|---|---|
| 25 | 151 | ProjectExportJobsPage |
| 47 | 54 | updateParams |
| 56 | 65 | cancelJob |
| 67 | 76 | retryJob |
| 78 | 86 | downloadJob |
| 153 | 174 | CreateExportForm |
| 176 | 180 | exportError |
| 182 | 189 | saveBlob |
| 191 | 196 | formatBytes |
| 198 | 201 | positiveInt |
| 203 | 205 | exportType |
| 207 | 209 | exportStatus |

| Linha | UI/ação/permissão declarada |
|---|---|
| 95 | title={job.error_code ?? undefined} |
| 100 | disabled={download.isPending} |
| 100 | onClick={() => void downloadJob(job)} |
| 101 | onClick={() => setCanceling(job)} |
| 102 | onClick={() => setRetrying(job)} |
| 111 | title="Exportacoes" |
| 113 | onClick={() => updateParams({ new: 1 }, false)} |
| 132 | label="Carregando exportacoes" |
| 140 | title="Nova exportacao" |
| 141 | onSubmit={async (value) => {           await create.mutateAsync(value);           updateParams({ new: undefined });           toast({ title: 'Exportacao solicitada', description: 'O processamento foi iniciado e a lista sera atualizada automaticamente.', tone: 'success' });         }} |
| 147 | title="Cancelar exportacao" |
| 148 | title="Tentar exportacao novamente" |
| 156 | onSubmit={form.handleSubmit(async ({ type }) => {       try {         await onSubmit(type);       } catch (error) {         form.setError('root', { message: error instanceof Error ? error.message : 'Nao foi possivel solicitar a exportacao.' });       }     })} |

### gai-frontend/src/features/field-agents/brazilianContact.ts

[gai-frontend/src/features/field-agents/brazilianContact.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/brazilianContact.ts) — 62 linhas.

| Linha | Final | Função |
|---|---|---|
| 3 | 5 | normalizeDocument |
| 7 | 13 | isValidDocument |
| 15 | 18 | normalizePhone |
| 20 | 23 | isValidPhone |
| 25 | 31 | maskDocument |
| 33 | 37 | maskPhone |
| 39 | 47 | isValidCpf |
| 49 | 61 | isValidCnpj |

### gai-frontend/src/features/field-agents/FieldAgentDetailDrawer.tsx

[gai-frontend/src/features/field-agents/FieldAgentDetailDrawer.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/FieldAgentDetailDrawer.tsx) — 47 linhas.

| Linha | Final | Função |
|---|---|---|
| 7 | 37 | FieldAgentDetailDrawer |
| 39 | 46 | Info |

| Linha | UI/ação/permissão declarada |
|---|---|
| 11 | title="Detalhes do inventariante" |
| 23 | label="Email" |
| 24 | label="Telefone" |
| 25 | label="Documento" |
| 26 | label="Organization" |
| 27 | label="Usuario vinculado" |
| 28 | label="Criado em" |
| 29 | label="Atualizado em" |

### gai-frontend/src/features/field-agents/FieldAgentForm.tsx

[gai-frontend/src/features/field-agents/FieldAgentForm.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/FieldAgentForm.tsx) — 75 linhas.

| Linha | Final | Função |
|---|---|---|
| 15 | 70 | FieldAgentForm |
| 72 | 74 | removeUndefined |

| Linha | UI/ação/permissão declarada |
|---|---|
| 34 | onSubmit={form.handleSubmit(async (values) => {         form.clearErrors();         try {           await props.onSubmit(removeUndefined(values as unknown as CreateFieldAgentRequest \| UpdateFieldAgentRequest) as never);         } catch (error) {           const apiError = error as ApiError;           const detail = apiError.details?.find(({ field }) => field === 'email' \|\| field === 'document');           if (detail) form.setError(detail.field as 'email' \| 'document', { message: detail.me |
| 46 | label="Nome" |
| 49 | label="Email" |
| 52 | label="Telefone" |
| 55 | label="CPF/CNPJ" |
| 59 | label="Usuário vinculado" |
| 67 | disabled={props.busy \|\| form.formState.isSubmitting} |

### gai-frontend/src/features/field-agents/fieldAgentSchemas.ts

[gai-frontend/src/features/field-agents/fieldAgentSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/fieldAgentSchemas.ts) — 54 linhas.

### gai-frontend/src/features/field-agents/FieldAgentSelect.tsx

[gai-frontend/src/features/field-agents/FieldAgentSelect.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/FieldAgentSelect.tsx) — 69 linhas.

| Linha | Final | Função |
|---|---|---|
| 13 | 68 | FieldAgentSelect |

| Linha | UI/ação/permissão declarada |
|---|---|
| 38 | disabled={query.isLoading \|\| query.isError} |
| 56 | onClick={() => void query.refetch()} |
| 61 | disabled={page <= 1} |
| 61 | onClick={() => setPage((current) => current - 1)} |
| 63 | disabled={page >= data.totalPages} |
| 63 | onClick={() => setPage((current) => current + 1)} |

### gai-frontend/src/features/field-agents/FieldAgentsPage.tsx

[gai-frontend/src/features/field-agents/FieldAgentsPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/FieldAgentsPage.tsx) — 144 linhas.

| Linha | Final | Função |
|---|---|---|
| 23 | 139 | FieldAgentsPage |
| 141 | 143 | actionLabel |

| Linha | UI/ação/permissão declarada |
|---|---|
| 55 | onClick={() => setViewingId(item.id)} |
| 57 | onClick={() => setEditing(item)} |
| 62 | onClick={() => setConfirm({ action: 'deactivate', item })} |
| 65 | onClick={() => setConfirm({ action: 'block', item })} |
| 70 | onClick={() => setConfirm({ action: 'unblock', item })} |
| 74 | onClick={() => setConfirm({ action: 'reactivate', item })} |
| 78 | onClick={() => setConfirm({ action: 'delete', item })} |
| 88 | title="Inventariantes" |
| 90 | onClick={() => setCreateOpen(true)} |
| 113 | title="Novo inventariante" |
| 117 | onSubmit={async (payload) => { await create.mutateAsync(payload); setCreateOpen(false); }} |
| 120 | title="Editar inventariante" |
| 121 | onSubmit={async (payload) => { await update.mutateAsync({ id: editing.id, payload }); setEditing(null); }} |
| 127 | title={`${actionLabel(confirm?.action)} inventariante`} |

### gai-frontend/src/features/field-agents/fieldAgentsQueries.ts

[gai-frontend/src/features/field-agents/fieldAgentsQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/fieldAgentsQueries.ts) — 93 linhas.

| Linha | Final | Função |
|---|---|---|
| 13 | 15 | useFieldAgents |
| 17 | 19 | useFieldAgent |
| 21 | 27 | useCreateFieldAgent |
| 29 | 38 | useUpdateFieldAgent |
| 40 | 46 | useChangeFieldAgentStatus |
| 48 | 54 | useDeleteFieldAgent |
| 56 | 58 | useProjectFieldAgents |
| 60 | 69 | useAssignProjectFieldAgent |
| 71 | 80 | useRemoveProjectFieldAgent |
| 82 | 92 | useUpdateProjectFieldAgent |

### gai-frontend/src/features/field-agents/ProjectFieldAgentsPanel.tsx

[gai-frontend/src/features/field-agents/ProjectFieldAgentsPanel.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/ProjectFieldAgentsPanel.tsx) — 209 linhas.

| Linha | Final | Função |
|---|---|---|
| 25 | 121 | ProjectFieldAgentsPanel |
| 46 | 55 | removeAssignment |
| 123 | 129 | ProjectFieldAgentIdentity |
| 131 | 168 | ProjectFieldAgentForm |
| 170 | 197 | ProjectFieldAgentEditForm |
| 199 | 204 | projectFieldAgentError |
| 206 | 208 | removeUndefined |

| Linha | UI/ação/permissão declarada |
|---|---|
| 64 | onClick={() => setAssignOpen(true)} |
| 83 | onClick={() => setEditing(item)} |
| 84 | onClick={() => setRemoveTarget(item)} |
| 93 | title="Vincular inventariante" |
| 97 | onSubmit={async (payload) => {               await assign.mutateAsync(payload);               setAssignOpen(false);             }} |
| 105 | title="Editar vinculo" |
| 106 | onSubmit={async (payload) => { await update.mutateAsync({ assignmentId: editing.id, payload }); setEditing(null); }} |
| 113 | title="Remover vinculo" |
| 134 | onSubmit={form.handleSubmit(async (values) => {       form.clearErrors();       try {         await onSubmit(removeUndefined(values as unknown as AssignProjectFieldAgentRequest) as AssignProjectFieldAgentRequest);       } catch (error) {         const apiError = error as ApiError;         const detail = apiError.details?.find(({ field }) => field === 'field_agent_id');         if (detail) form.setError('field_agent_id', { message: detail.message });         else form.setError('root', { m |
| 145 | label="Inventariante" |
| 152 | label="Papel no projeto" |
| 155 | label="Inicio" |
| 158 | label="Fim" |
| 161 | label="Observacoes" |
| 165 | disabled={busy \|\| form.formState.isSubmitting} |
| 176 | onSubmit={form.handleSubmit(async (values) => {       form.clearErrors();       try {         await onSubmit(removeUndefined(values as unknown as UpdateProjectFieldAgentRequest) as UpdateProjectFieldAgentRequest);       } catch (error) {         form.setError('root', { message: projectFieldAgentError(error, 'Nao foi possivel atualizar o vinculo') });       }     })} |
| 184 | label="Papel no projeto" |
| 185 | label="Status" |
| 190 | label="Inicio" |
| 191 | label="Fim" |
| 192 | label="Observacoes" |
| 194 | disabled={busy \|\| form.formState.isSubmitting} |

### gai-frontend/src/features/finance/ExpenseAttachmentsPanel.tsx

[gai-frontend/src/features/finance/ExpenseAttachmentsPanel.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/finance/ExpenseAttachmentsPanel.tsx) — 148 linhas.

| Linha | Final | Função |
|---|---|---|
| 16 | 21 | formatBytes |
| 23 | 147 | ExpenseAttachmentsPanel |
| 34 | 53 | handleFile |
| 55 | 63 | openDownload |
| 65 | 69 | confirmRemove |

| Linha | UI/ação/permissão declarada |
|---|---|
| 81 | disabled={upload.isPending} |
| 95 | label="Carregando comprovantes" |
| 112 | disabled={download.isPending \|\| attachment.status !== 'uploaded'} |
| 112 | onClick={() => openDownload(attachment)} |
| 117 | disabled={remove.isPending \|\| attachment.status === 'removed'} |
| 117 | onClick={() => setRemoving(attachment)} |
| 126 | title="Nenhum comprovante anexado" |
| 128 | title={downloadLink?.attachment.original_name ?? 'Comprovante'} |
| 141 | title="Remover comprovante" |

### gai-frontend/src/features/finance/ExpenseForm.tsx

[gai-frontend/src/features/finance/ExpenseForm.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/finance/ExpenseForm.tsx) — 45 linhas.

| Linha | Final | Função |
|---|---|---|
| 10 | 18 | toValues |
| 20 | 44 | ExpenseForm |

| Linha | UI/ação/permissão declarada |
|---|---|
| 24 | onSubmit={form.handleSubmit((values) => onSubmit(expenseFormSchema.parse(values)))} |
| 25 | label="Descricao" |
| 29 | label="Data" |
| 30 | label="Valor" |
| 32 | label="Inventariante" |
| 38 | label="Motivo" |

### gai-frontend/src/features/finance/financeQueries.ts

[gai-frontend/src/features/finance/financeQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/finance/financeQueries.ts) — 142 linhas.

| Linha | Final | Função |
|---|---|---|
| 24 | 26 | useFinanceFieldAgents |
| 28 | 30 | usePayments |
| 32 | 34 | usePaymentSummary |
| 36 | 38 | useExpenses |
| 40 | 45 | invalidateFinance |
| 47 | 53 | useCreatePayment |
| 55 | 61 | useUpdatePayment |
| 63 | 73 | usePaymentAction |
| 75 | 81 | useCreateExpense |
| 83 | 89 | useUpdateExpense |
| 91 | 102 | useExpenseAction |
| 104 | 110 | useExpenseAttachments |
| 112 | 129 | useUploadExpenseAttachment |
| 131 | 133 | useExpenseAttachmentDownloadUrl |
| 135 | 141 | useRemoveExpenseAttachment |

### gai-frontend/src/features/finance/financeSchemas.ts

[gai-frontend/src/features/finance/financeSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/finance/financeSchemas.ts) — 72 linhas.

### gai-frontend/src/features/finance/PaymentForm.tsx

[gai-frontend/src/features/finance/PaymentForm.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/finance/PaymentForm.tsx) — 55 linhas.

| Linha | Final | Função |
|---|---|---|
| 10 | 22 | toValues |
| 24 | 54 | PaymentForm |

| Linha | UI/ação/permissão declarada |
|---|---|
| 28 | onSubmit={form.handleSubmit((values) => onSubmit(paymentFormSchema.parse(values)))} |
| 29 | label="Inventariante" |
| 36 | label="Inicio" |
| 37 | label="Fim" |
| 40 | label="Valor diario" |
| 41 | label="UF/Estado" |
| 44 | label="Adicional" |
| 45 | label="Desconto" |
| 47 | label="Data de pagamento" |
| 48 | label="Observacoes" |

### gai-frontend/src/features/finance/ProjectFinancePage.tsx

[gai-frontend/src/features/finance/ProjectFinancePage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/finance/ProjectFinancePage.tsx) — 360 linhas.

| Linha | Final | Função |
|---|---|---|
| 54 | 78 | ProjectFinancePage |
| 80 | 82 | tabClass |
| 84 | 98 | PaymentSummaryCards |
| 100 | 186 | PaymentsTab |
| 188 | 276 | ExpensesTab |
| 278 | 285 | AgentSelect |
| 287 | 305 | PaymentDetailDrawer |
| 307 | 322 | ExpenseDetailDrawer |
| 324 | 331 | Detail |
| 333 | 345 | MarkPaymentPaidModal |
| 347 | 359 | RejectExpenseModal |

| Linha | UI/ação/permissão declarada |
|---|---|
| 62 | title="Financeiro do projeto" |
| 72 | onClick={() => setTab('payments')} |
| 73 | onClick={() => setTab('expenses')} |
| 86 | label="Carregando resumo financeiro" |
| 91 | label="Pendentes" |
| 92 | label="Aprovados" |
| 93 | label="Pagos" |
| 94 | label="Cancelados" |
| 95 | label="Registros" |
| 144 | onClick={() => setViewing(payment)} |
| 145 | disabled={payment.status === 'paid' \|\| payment.status === 'cancelled'} |
| 145 | onClick={() => setEditing(payment)} |
| 146 | disabled={payment.status !== 'pending'} |
| 146 | onClick={() => setApproving(payment)} |
| 147 | disabled={payment.status !== 'approved'} |
| 147 | onClick={() => setPaying(payment)} |
| 148 | disabled={payment.status === 'paid' \|\| payment.status === 'cancelled'} |
| 148 | onClick={() => setCanceling(payment)} |
| 167 | onClick={() => setCreateOpen(true)} |
| 174 | title="Novo pagamento" |
| 175 | onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} |
| 177 | title="Editar pagamento" |
| 178 | onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} |
| 181 | title="Aprovar pagamento" |
| 182 | onSubmit={(payload) => paying && markPaid.mutate({ id: paying.id, payload }, { onSuccess: () => setPaying(null) })} |
| 183 | title="Cancelar pagamento" |
| 230 | onClick={() => setViewing(expense)} |
| 231 | onClick={() => setAttachments(expense)} |
| 232 | disabled={expense.status === 'paid' \|\| expense.status === 'cancelled'} |
| 232 | onClick={() => setEditing(expense)} |
| 233 | disabled={expense.status !== 'pending'} |
| 233 | onClick={() => setApproving(expense)} |
| 234 | disabled={expense.status !== 'pending'} |
| 234 | onClick={() => setRejecting(expense)} |
| 235 | disabled={expense.status !== 'approved'} |
| 235 | onClick={() => setPaying(expense)} |
| 236 | disabled={expense.status === 'paid' \|\| expense.status === 'cancelled'} |
| 236 | onClick={() => setCanceling(expense)} |
| 253 | onClick={() => setCreateOpen(true)} |
| 260 | title="Nova despesa" |
| 261 | onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} |
| 263 | title="Editar despesa" |
| 264 | onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} |
| 267 | title="Comprovantes da despesa" |
| 270 | title="Aprovar despesa" |
| 271 | onSubmit={(payload) => rejecting && reject.mutate({ id: rejecting.id, payload }, { onSuccess: () => setRejecting(null) })} |
| 272 | title="Marcar despesa como paga" |
| 273 | title="Cancelar despesa" |
| 289 | title="Detalhes do pagamento" |
| 292 | label="Status" |
| 293 | label="Periodo" |
| 294 | label="Dias" |
| 295 | label="Diaria" |
| 296 | label="Total diario" |
| 297 | label="Adicional" |
| 298 | label="Desconto" |
| 299 | label="Final" |
| 300 | label="Observacoes" |
| 309 | title="Detalhes da despesa" |
| 312 | label="Status" |
| 313 | label="Descricao" |
| 314 | label="Data" |
| 315 | label="Valor" |
| 316 | label="Inventariante" |
| 317 | label="Motivo" |
| 336 | title="Marcar pagamento como pago" |
| 337 | onSubmit={form.handleSubmit((values) => onSubmit(paidDateSchema.parse(values)))} |
| 338 | label="Data de pagamento" |
| 350 | title="Rejeitar despesa" |
| 351 | onSubmit={form.handleSubmit((values) => onSubmit(rejectExpenseSchema.parse(values)))} |
| 352 | label="Motivo" |

### gai-frontend/src/features/import-sessions/importSessionSchemas.ts

[gai-frontend/src/features/import-sessions/importSessionSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/import-sessions/importSessionSchemas.ts) — 66 linhas.

### gai-frontend/src/features/import-sessions/importSessionsQueries.ts

[gai-frontend/src/features/import-sessions/importSessionsQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/import-sessions/importSessionsQueries.ts) — 143 linhas.

| Linha | Final | Função |
|---|---|---|
| 17 | 19 | isImportSessionRunning |
| 21 | 28 | useImportSessions |
| 30 | 37 | useImportSession |
| 39 | 45 | useImportPayloads |
| 47 | 53 | useImportErrors |
| 55 | 61 | useImportFiles |
| 63 | 72 | useCreateImportSession |
| 74 | 88 | useImportSessionAction |
| 90 | 98 | useCreateImportPayload |
| 100 | 106 | useReprocessImportPayload |
| 108 | 126 | useUploadImportFile |
| 128 | 130 | useImportFileDownloadUrl |
| 132 | 142 | useImportPhysicalObservations |

### gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.tsx

[gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.tsx) — 392 linhas.

| Linha | Final | Função |
|---|---|---|
| 62 | 66 | progress |
| 68 | 73 | formatBytes |
| 75 | 159 | ProjectImportSessionsPage |
| 161 | 191 | ImportSessionForm |
| 193 | 233 | ImportSessionDetailDrawer |
| 235 | 249 | PhysicalObservationsPanel |
| 240 | 243 | submit |
| 244 | 247 | select |
| 251 | 280 | PayloadsPanel |
| 282 | 302 | PayloadForm |
| 304 | 315 | ErrorsPanel |
| 317 | 370 | FilesPanel |
| 334 | 353 | handleFile |
| 372 | 382 | SafeTechnicalPanel |
| 384 | 391 | Info |

| Linha | UI/ação/permissão declarada |
|---|---|
| 107 | onClick={() => setViewing(session)} |
| 108 | disabled={session.status !== 'open' && session.status !== 'receiving'} |
| 108 | onClick={() => setFinishing(session)} |
| 109 | disabled={session.status === 'finished' \|\| session.status === 'cancelled' \|\| session.status === 'expired'} |
| 109 | onClick={() => setCanceling(session)} |
| 110 | disabled={session.status !== 'failed'} |
| 110 | onClick={() => setRetrying(session)} |
| 118 | title="Importacoes" |
| 120 | onClick={() => setCreateOpen(true)} |
| 129 | disabled |
| 133 | disabled |
| 141 | disabled |
| 142 | disabled |
| 150 | title="Nova importacao" |
| 151 | onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} |
| 154 | title="Finalizar importacao" |
| 155 | title="Cancelar importacao" |
| 156 | title="Retry da importacao" |
| 164 | onSubmit={form.handleSubmit((values) => {       const expectedPayloads = values.expected_payloads === '' \|\| values.expected_payloads == null ? undefined : Number(values.expected_payloads);       onSubmit({         type: values.type as ImportSession['type'],         source: values.source as ImportSession['source'],         expected_payloads: expectedPayloads,       });     })} |
| 172 | label="Tipo" |
| 178 | label="Origem" |
| 184 | label="Payloads esperados" |
| 198 | title="Detalhes da importacao" |
| 202 | label="Payloads recebidos" |
| 203 | label="Payloads falhos" |
| 204 | label="Itens" |
| 205 | label="Falhas totais" |
| 207 | label="Progresso dos payloads" |
| 209 | label="Status" |
| 210 | label="UUID" |
| 211 | label="Tipo" |
| 212 | label="Origem" |
| 213 | label="Criada em" |
| 214 | label="Atualizada em" |
| 215 | label="Erro" |
| 219 | onClick={() => setTab(item)} |
| 248 | disabled={!file \|\| !payloadNumber \|\| mutation.isPending} |
| 248 | onClick={submit} |
| 268 | disabled={payload.status !== 'failed'} |
| 268 | onClick={() => setReprocessing(payload)} |
| 272 | onClick={() => setCreateOpen(true)} |
| 273 | label="Carregando payloads" |
| 274 | title="Enviar payload tecnico" |
| 275 | onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} |
| 277 | title="Reprocessar payload" |
| 285 | onSubmit={form.handleSubmit((values) => {       const body = JSON.parse(values.payload_json) as { items: Array<Record<string, unknown>>; metadata?: Record<string, unknown> };       onSubmit({         payload_number: Number(values.payload_number),         idempotency_key: values.idempotency_key,         checksum: values.checksum \|\| undefined,         items: body.items,         metadata: body.metadata,       });     })} |
| 295 | label="Numero do payload" |
| 296 | label="Chave idempotente" |
| 297 | label="Checksum" |
| 298 | label="Payload JSON" |
| 314 | label="Carregando erros" |
| 332 | disabled={file.status !== 'uploaded' && file.status !== 'processed'} |
| 332 | onClick={() => downloadUrl.mutate(file.id, { onSuccess: (result) => setDownload({ url: result.download_url, file: result.file }) })} |
| 363 | label="Upload" |
| 364 | label="Carregando arquivos" |
| 365 | title={download?.file.original_name ?? 'Download'} |
| 375 | label="ID" |
| 376 | label="Organization" |
| 377 | label="Projeto" |
| 378 | label="Metadados" |

### gai-frontend/src/features/inventory-item-images/InventoryItemImagesGallery.tsx

[gai-frontend/src/features/inventory-item-images/InventoryItemImagesGallery.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-item-images/InventoryItemImagesGallery.tsx) — 144 linhas.

| Linha | Final | Função |
|---|---|---|
| 16 | 21 | formatBytes |
| 23 | 143 | InventoryItemImagesGallery |
| 35 | 54 | handleFile |
| 56 | 64 | openPreview |
| 66 | 70 | confirmRemove |

| Linha | UI/ação/permissão declarada |
|---|---|
| 82 | disabled={upload.isPending} |
| 98 | label="Carregando imagens" |
| 114 | onClick={() => openPreview(image)} |
| 114 | disabled={download.isPending \|\| image.status !== 'uploaded'} |
| 118 | onClick={() => setRemoving(image)} |
| 118 | disabled={remove.isPending \|\| image.status === 'removed'} |
| 127 | title="Nenhuma imagem cadastrada" |
| 130 | title={preview?.image.original_name ?? 'Visualizacao da imagem'} |
| 137 | title="Remover imagem" |

### gai-frontend/src/features/inventory-item-images/inventoryItemImagesQueries.ts

[gai-frontend/src/features/inventory-item-images/inventoryItemImagesQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-item-images/inventoryItemImagesQueries.ts) — 57 linhas.

| Linha | Final | Função |
|---|---|---|
| 13 | 19 | useInventoryItemImages |
| 21 | 39 | useUploadInventoryItemImage |
| 41 | 45 | useInventoryItemImageDownloadUrl |
| 47 | 56 | useRemoveInventoryItemImage |

### gai-frontend/src/features/inventory-items/InventoryItemDetailDrawer.tsx

[gai-frontend/src/features/inventory-items/InventoryItemDetailDrawer.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-items/InventoryItemDetailDrawer.tsx) — 70 linhas.

| Linha | Final | Função |
|---|---|---|
| 11 | 56 | InventoryItemDetailDrawer |
| 58 | 65 | Info |
| 67 | 69 | ImagePlaceholder |

| Linha | UI/ação/permissão declarada |
|---|---|
| 16 | title="Detalhes do item" |
| 29 | label="Placa mestre anterior" |
| 30 | label="Placa mestre atual" |
| 31 | label="Valor usado" |
| 32 | label="Valor novo" |
| 34 | label="Sequencia" |
| 35 | label="Localizacao" |
| 36 | label="Unidade" |
| 37 | label="Endereco" |
| 38 | label="Marca / Modelo" |
| 39 | label="Numero de serie" |
| 40 | label="Capacidade" |
| 41 | label="Ano" |
| 42 | label="Observacoes" |
| 43 | label="Criado em" |
| 44 | label="Atualizado em" |

### gai-frontend/src/features/inventory-items/InventoryItemForm.tsx

[gai-frontend/src/features/inventory-items/InventoryItemForm.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-items/InventoryItemForm.tsx) — 77 linhas.

| Linha | Final | Função |
|---|---|---|
| 10 | 72 | InventoryItemForm |
| 74 | 76 | clean |

| Linha | UI/ação/permissão declarada |
|---|---|
| 36 | onSubmit={form.handleSubmit((values) => onSubmit(clean(values as unknown as InventoryItemInput)))} |
| 38 | label="ID externo" |
| 39 | label="Sequencia" |
| 40 | label="Placa antiga" |
| 41 | label="Placa nova" |
| 43 | label="Descricao" |
| 47 | label="Marca" |
| 48 | label="Modelo" |
| 49 | label="Numero de serie" |
| 50 | label="Capacidade" |
| 51 | label="Ano" |
| 52 | label="Origem" |
| 55 | label="Unidade" |
| 56 | label="Localizacao" |
| 58 | label="Endereco" |
| 60 | label="Valor usado" |
| 61 | label="Valor novo" |
| 62 | label="Status" |
| 68 | label="Observacoes" |

### gai-frontend/src/features/inventory-items/inventoryItemSchemas.ts

[gai-frontend/src/features/inventory-items/inventoryItemSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-items/inventoryItemSchemas.ts) — 38 linhas.

### gai-frontend/src/features/inventory-items/inventoryItemsQueries.ts

[gai-frontend/src/features/inventory-items/inventoryItemsQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-items/inventoryItemsQueries.ts) — 59 linhas.

| Linha | Final | Função |
|---|---|---|
| 14 | 16 | useProjectInventoryItems |
| 18 | 20 | useProjectInventoryItem |
| 22 | 24 | useInventoryItemImages |
| 26 | 35 | useCreateInventoryItem |
| 37 | 47 | useUpdateInventoryItem |
| 49 | 58 | useChangeInventoryItemStatus |

### gai-frontend/src/features/inventory-items/ItemEvidencePanels.tsx

[gai-frontend/src/features/inventory-items/ItemEvidencePanels.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-items/ItemEvidencePanels.tsx) — 18 linhas.

| Linha | Final | Função |
|---|---|---|
| 13 | 15 | ItemEvidencePanels |
| 16 | 16 | PlateHistory |
| 17 | 17 | Valuations |
| 17 | 17 | submit |

| Linha | UI/ação/permissão declarada |
|---|---|
| 17 | onSubmit={submit} |
| 17 | disabled={create.isPending \|\| !source.trim() \|\| !date} |

### gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx

[gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx) — 136 linhas.

| Linha | Final | Função |
|---|---|---|
| 24 | 135 | ProjectInventoryItemsPage |

| Linha | UI/ação/permissão declarada |
|---|---|
| 67 | onClick={() => setViewingId(item.id)} |
| 69 | onClick={() => setEditing(item)} |
| 72 | onClick={() => setViewingId(item.id)} |
| 76 | onClick={() => setConfirm({ action: 'reactivate', item })} |
| 80 | onClick={() => setConfirm({ action: 'deactivate', item })} |
| 91 | title="Itens inventariados" |
| 93 | onClick={() => setCreateOpen(true)} |
| 115 | title="Novo item" |
| 116 | onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setCreateOpen(false) })} |
| 118 | title="Editar item" |
| 119 | onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} |
| 125 | title={confirm?.action === 'deactivate' ? 'Desativar item' : 'Reativar item'} |

### gai-frontend/src/features/inventory-operations/idempotency.ts

[gai-frontend/src/features/inventory-operations/idempotency.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/idempotency.ts) — 4 linhas.

| Linha | Final | Função |
|---|---|---|
| 1 | 3 | createIdempotencyKey |

### gai-frontend/src/features/inventory-operations/inventoryOperationErrors.ts

[gai-frontend/src/features/inventory-operations/inventoryOperationErrors.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/inventoryOperationErrors.ts) — 28 linhas.

| Linha | Final | Função |
|---|---|---|
| 22 | 27 | getInventoryOperationErrorMessage |

### gai-frontend/src/features/inventory-operations/inventoryOperationsQueries.ts

[gai-frontend/src/features/inventory-operations/inventoryOperationsQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/inventoryOperationsQueries.ts) — 109 linhas.

| Linha | Final | Função |
|---|---|---|
| 28 | 33 | invalidateInventoryProject |
| 35 | 37 | useInventorySessions |
| 39 | 41 | useInventorySession |
| 43 | 45 | useInventoryRounds |
| 47 | 50 | useInventoryMutation |
| 52 | 52 | useCreateInventorySession |
| 53 | 53 | useStartInventorySession |
| 54 | 54 | useFinishInventorySession |
| 55 | 55 | useCancelInventorySession |
| 56 | 56 | useRequestReinventory |
| 58 | 67 | useCreateObservation |
| 69 | 69 | useFinishRound |
| 71 | 73 | useInventoryObservations |
| 75 | 81 | useInventoryEvidence |
| 83 | 98 | useUploadInventoryEvidence |
| 100 | 102 | useInventoryEvidenceDownloadUrl |
| 104 | 106 | useReconciliations |
| 107 | 107 | useRunReconciliation |
| 108 | 108 | useConsolidate |

### gai-frontend/src/features/inventory-operations/InventorySessionDetailPage.tsx

[gai-frontend/src/features/inventory-operations/InventorySessionDetailPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/InventorySessionDetailPage.tsx) — 234 linhas.

| Linha | Final | Função |
|---|---|---|
| 47 | 120 | InventorySessionDetailPage |
| 72 | 77 | confirmCancellation |
| 122 | 146 | RoundsSection |
| 148 | 186 | ObservationsSection |
| 188 | 205 | ObservationDrawer |
| 199 | 203 | submit |
| 207 | 213 | ReinventoryDrawer |
| 211 | 211 | submit |
| 215 | 229 | ReconciliationsSection |
| 231 | 231 | Info |
| 232 | 232 | NumberField |
| 233 | 233 | TextField |

| Linha | UI/ação/permissão declarada |
|---|---|
| 59 | label="Carregando sessao e rodadas" |
| 80 | title={item.name} |
| 83 | label="Status" |
| 84 | label="Rodada atual" |
| 85 | label="Iniciada em" |
| 86 | label={item.status === 'cancelled' ? 'Cancelada em' : 'Finalizada em'} |
| 87 | label="Motivo do cancelamento" |
| 91 | disabled={start.isPending} |
| 91 | onClick={() => start.mutate(undefined)} |
| 92 | onClick={() => setFinishingSession(true)} |
| 93 | onClick={() => setCancellingSession(true)} |
| 104 | title="Finalizar sessao de inventario?" |
| 109 | title="Cancelar sessao de inventario?" |
| 110 | onSubmit={confirmCancellation} |
| 114 | disabled={cancel.isPending} |
| 114 | onClick={() => setCancellingSession(false)} |
| 115 | disabled={!cancellationReason.trim()} |
| 144 | label="Carregando rodadas" |
| 173 | onClick={() => setEvidenceTarget(item)} |
| 178 | onClick={() => setObserveOpen(true)} |
| 178 | onClick={() => setReinventoryOpen(true)} |
| 178 | onClick={() => setFinishing(true)} |
| 180 | label="Carregando observacoes" |
| 183 | title="Finalizar rodada" |
| 204 | title={`Nova observacao - rodada #${roundId ?? '?'}`} |
| 204 | onSubmit={submit} |
| 204 | label="Item patrimonial" |
| 204 | label="Inventariante" |
| 204 | label="Placa observada (evidencia)" |
| 204 | label="Serie observada" |
| 204 | label="Setor informado" |
| 204 | label="Localizacao" |
| 204 | label="Notas" |
| 204 | disabled={mutation.isPending \|\| !itemId \|\| !agentId \|\| !roundId} |
| 212 | title="Solicitar reinventario" |
| 212 | onSubmit={submit} |
| 212 | label="Item divergente" |
| 212 | disabled={mutation.isPending \|\| !itemId \|\| !reason.trim()} |
| 226 | disabled={item.status === 'duplicate'} |
| 226 | onClick={() => setTarget(item)} |
| 228 | disabled={execute.isPending} |
| 228 | onClick={() => execute.mutate(undefined)} |
| 228 | label="Carregando conciliacoes" |
| 228 | title="Consolidar resultado" |

### gai-frontend/src/features/inventory-operations/ObservationEvidenceDrawer.tsx

[gai-frontend/src/features/inventory-operations/ObservationEvidenceDrawer.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/ObservationEvidenceDrawer.tsx) — 154 linhas.

| Linha | Final | Função |
|---|---|---|
| 19 | 24 | formatBytes |
| 26 | 153 | ObservationEvidenceDrawer |
| 62 | 82 | handleFile |
| 84 | 92 | openPreview |

| Linha | UI/ação/permissão declarada |
|---|---|
| 95 | title={`Evidencias da observacao #${observation?.id ?? ''}`} |
| 101 | disabled={upload.isPending} |
| 114 | label="Carregando evidencias" |
| 129 | onClick={() => openPreview(item)} |
| 129 | disabled={download.isPending \|\| item.status !== 'uploaded'} |
| 138 | title="Nenhuma evidencia anexada" |
| 145 | onClick={() => setPreview(null)} |

### gai-frontend/src/features/inventory-operations/ProjectInventorySessionsPage.tsx

[gai-frontend/src/features/inventory-operations/ProjectInventorySessionsPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/ProjectInventorySessionsPage.tsx) — 62 linhas.

| Linha | Final | Função |
|---|---|---|
| 19 | 49 | ProjectInventorySessionsPage |
| 51 | 61 | CreateSessionDrawer |
| 54 | 59 | submit |

| Linha | UI/ação/permissão declarada |
|---|---|
| 37 | title="Sessoes de inventario" |
| 44 | onClick={() => setCreateOpen(true)} |
| 45 | label="Carregando sessoes de inventario" |
| 60 | title="Nova sessao de inventario" |
| 60 | onSubmit={submit} |
| 60 | disabled={mutation.isPending \|\| !name.trim()} |

### gai-frontend/src/features/organizations/OrganizationDetailDrawer.tsx

[gai-frontend/src/features/organizations/OrganizationDetailDrawer.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/organizations/OrganizationDetailDrawer.tsx) — 48 linhas.

| Linha | Final | Função |
|---|---|---|
| 8 | 38 | OrganizationDetailDrawer |
| 40 | 47 | Info |

| Linha | UI/ação/permissão declarada |
|---|---|
| 13 | title="Detalhes da organização" |
| 29 | label="CNPJ" |
| 30 | label="Email" |
| 31 | label="Telefone" |
| 32 | label="Criada em" |
| 33 | label="Atualizada em" |

### gai-frontend/src/features/organizations/OrganizationForm.tsx

[gai-frontend/src/features/organizations/OrganizationForm.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/organizations/OrganizationForm.tsx) — 97 linhas.

| Linha | Final | Função |
|---|---|---|
| 21 | 92 | OrganizationForm |
| 94 | 96 | removeUndefined |

| Linha | UI/ação/permissão declarada |
|---|---|
| 40 | onSubmit={form.handleSubmit(async (values) => {         form.clearErrors();         try {           await props.onSubmit(removeUndefined(values as unknown as CreateOrganizationRequest \| UpdateOrganizationRequest) as never);         } catch (error) {           const apiError = error as ApiError;           const detail = apiError.details?.find(({ field }) => field === 'cnpj' \|\| field === 'contact_email' \|\| field === 'legal_name');           if (detail) form.setError(detail.field as 'cnpj' \| |
| 52 | label="Razão social" |
| 55 | label="Nome fantasia" |
| 60 | label="CNPJ" |
| 71 | label="CNPJ" |
| 72 | disabled |
| 75 | label="Email de contato" |
| 78 | label="Telefone" |
| 87 | disabled={props.busy \|\| form.formState.isSubmitting} |

### gai-frontend/src/features/organizations/organizationSchemas.ts

[gai-frontend/src/features/organizations/organizationSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/organizations/organizationSchemas.ts) — 43 linhas.

### gai-frontend/src/features/organizations/OrganizationsPage.tsx

[gai-frontend/src/features/organizations/OrganizationsPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/organizations/OrganizationsPage.tsx) — 177 linhas.

| Linha | Final | Função |
|---|---|---|
| 23 | 172 | OrganizationsPage |
| 174 | 176 | actionLabel |

| Linha | UI/ação/permissão declarada |
|---|---|
| 61 | onClick={() => setViewingId(item.id)} |
| 65 | onClick={() => setEditing(item)} |
| 71 | onClick={() => setConfirm({ action: 'deactivate', item })} |
| 77 | onClick={() => setConfirm({ action: 'activate', item })} |
| 90 | title="Organizações" |
| 94 | onClick={() => setCreateOpen(true)} |
| 134 | title="Nova organização" |
| 138 | onSubmit={async (payload) => {             await create.mutateAsync(payload);             setCreateOpen(false);           }} |
| 144 | title="Editar organização" |
| 150 | onSubmit={async (payload) => {               await update.mutateAsync({ id: editing.id, payload });               setEditing(null);             }} |
| 161 | title={`${actionLabel(confirm?.action)} organização`} |

### gai-frontend/src/features/organizations/organizationsQueries.ts

[gai-frontend/src/features/organizations/organizationsQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/organizations/organizationsQueries.ts) — 45 linhas.

| Linha | Final | Função |
|---|---|---|
| 11 | 13 | useOrganizations |
| 15 | 17 | useOrganization |
| 19 | 25 | useCreateOrganization |
| 27 | 36 | useUpdateOrganization |
| 38 | 44 | useChangeOrganizationStatus |

### gai-frontend/src/features/pending-issues/PendingIssueDetailDrawer.tsx

[gai-frontend/src/features/pending-issues/PendingIssueDetailDrawer.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/pending-issues/PendingIssueDetailDrawer.tsx) — 68 linhas.

| Linha | Final | Função |
|---|---|---|
| 10 | 58 | PendingIssueDetailDrawer |
| 60 | 67 | Info |

| Linha | UI/ação/permissão declarada |
|---|---|
| 15 | title="Detalhes da pendencia" |
| 28 | label="Status" |
| 29 | label="Severidade" |
| 30 | label="Criada em" |
| 31 | label="Resolvida em" |
| 33 | label="Descricao" |
| 34 | label="Valor antigo" |
| 35 | label="Valor novo" |
| 36 | label="Resolucao" |
| 37 | label="Resolvido por" |
| 38 | label="Ignorado por" |
| 39 | label="Ignorado em" |
| 40 | label="Atualizado em" |

### gai-frontend/src/features/pending-issues/PendingIssueForm.tsx

[gai-frontend/src/features/pending-issues/PendingIssueForm.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/pending-issues/PendingIssueForm.tsx) — 70 linhas.

| Linha | Final | Função |
|---|---|---|
| 9 | 65 | PendingIssueForm |
| 67 | 69 | clean |

| Linha | UI/ação/permissão declarada |
|---|---|
| 27 | onSubmit={form.handleSubmit((values) => onSubmit(clean(values as unknown as InventoryPendingIssueInput)))} |
| 29 | label="Tipo" |
| 34 | label="Severidade" |
| 41 | label="Status" |
| 47 | label="Titulo" |
| 48 | label="Descricao" |
| 50 | label="Item inventariado ID" |
| 51 | label="Item contabil ID" |
| 53 | label="Valor antigo JSON" |
| 56 | label="Valor novo JSON" |
| 59 | label="Metadata JSON" |

### gai-frontend/src/features/pending-issues/pendingIssueSchemas.ts

[gai-frontend/src/features/pending-issues/pendingIssueSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/pending-issues/pendingIssueSchemas.ts) — 79 linhas.

### gai-frontend/src/features/pending-issues/pendingIssuesQueries.ts

[gai-frontend/src/features/pending-issues/pendingIssuesQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/pending-issues/pendingIssuesQueries.ts) — 105 linhas.

| Linha | Final | Função |
|---|---|---|
| 30 | 36 | useProjectPendingIssues |
| 38 | 44 | useProjectPendingIssue |
| 46 | 52 | useCreatePendingIssue |
| 54 | 63 | useUpdatePendingIssue |
| 65 | 74 | useResolvePendingIssue |
| 76 | 85 | useIgnorePendingIssue |
| 87 | 93 | useCancelPendingIssue |
| 95 | 104 | useGeneratePendingIssues |

### gai-frontend/src/features/pending-issues/ProjectPendingIssuesPage.tsx

[gai-frontend/src/features/pending-issues/ProjectPendingIssuesPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/pending-issues/ProjectPendingIssuesPage.tsx) — 214 linhas.

| Linha | Final | Função |
|---|---|---|
| 46 | 185 | ProjectPendingIssuesPage |
| 187 | 199 | ResolutionModal |
| 201 | 213 | IgnoreModal |

| Linha | UI/ação/permissão declarada |
|---|---|
| 98 | onClick={() => setViewingId(issue.id)} |
| 100 | onClick={() => setEditing(issue)} |
| 103 | disabled={issue.status === 'resolved'} |
| 103 | onClick={() => setResolving(issue)} |
| 106 | disabled={issue.status === 'ignored'} |
| 106 | onClick={() => setIgnoring(issue)} |
| 109 | disabled={issue.status === 'cancelled'} |
| 109 | onClick={() => setCanceling(issue)} |
| 119 | title="Pendencias" |
| 123 | onClick={() => setGenerateOpen(true)} |
| 124 | onClick={() => setCreateOpen(true)} |
| 159 | title="Nova pendencia" |
| 160 | onSubmit={(payload) => create.mutate(payload as Parameters<typeof create.mutate>[0], { onSuccess: () => setCreateOpen(false) })} |
| 162 | title="Editar pendencia" |
| 163 | onSubmit={(payload) => update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })} |
| 166 | onSubmit={(notes) => resolving && resolve.mutate({ id: resolving.id, payload: { resolution_notes: notes } }, { onSuccess: () => setResolving(null) })} |
| 167 | onSubmit={(notes) => ignoring && ignore.mutate({ id: ignoring.id, payload: { resolution_notes: notes \|\| undefined } }, { onSuccess: () => setIgnoring(null) })} |
| 171 | title="Cancelar pendencia" |
| 178 | title="Gerar pendencias automaticamente" |
| 190 | title="Resolver pendencia" |
| 191 | onSubmit={form.handleSubmit((values) => onSubmit(values.resolution_notes))} |
| 192 | label="Observacoes da resolucao" |
| 204 | title="Ignorar pendencia" |
| 205 | onSubmit={form.handleSubmit((values) => onSubmit(values.resolution_notes))} |
| 206 | label="Motivo ou observacao" |

### gai-frontend/src/features/placeholders/PlaceholderPage.tsx

[gai-frontend/src/features/placeholders/PlaceholderPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/placeholders/PlaceholderPage.tsx) — 13 linhas.

| Linha | Final | Função |
|---|---|---|
| 5 | 12 | PlaceholderPage |

| Linha | UI/ação/permissão declarada |
|---|---|
| 8 | title={title} |
| 9 | title="Modulo preparado para proxima rodada" |

### gai-frontend/src/features/project-dashboard/BrazilProjectMap.tsx

[gai-frontend/src/features/project-dashboard/BrazilProjectMap.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/project-dashboard/BrazilProjectMap.tsx) — 80 linhas.

| Linha | Final | Função |
|---|---|---|
| 17 | 79 | BrazilProjectMap |

| Linha | UI/ação/permissão declarada |
|---|---|
| 53 | title={                 point                   ? `${state}: ${point.inventoried_items} de ${point.total_items} inventariados (${point.completion_percentage}%)`                   : `${state}: sem dados vinculados`               } |
| 60 | onClick={() => onSelectState(active ? undefined : state)} |

### gai-frontend/src/features/project-dashboard/dashboardVisuals.tsx

[gai-frontend/src/features/project-dashboard/dashboardVisuals.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/project-dashboard/dashboardVisuals.tsx) — 175 linhas.

| Linha | Final | Função |
|---|---|---|
| 28 | 69 | InventoryTimelineChart |
| 71 | 106 | CumulativeProgressChart |
| 108 | 143 | StatusDistributionChart |
| 145 | 166 | UnitsChart |
| 168 | 174 | ChartEmpty |

### gai-frontend/src/features/project-dashboard/ProjectDashboardPage.tsx

[gai-frontend/src/features/project-dashboard/ProjectDashboardPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/project-dashboard/ProjectDashboardPage.tsx) — 364 linhas.

| Linha | Final | Função |
|---|---|---|
| 53 | 108 | ProjectDashboardPage |
| 110 | 158 | DashboardFilters |
| 160 | 169 | FilterField |
| 171 | 284 | DashboardContent |
| 286 | 296 | ChartCard |
| 298 | 304 | StatusTextTable |
| 306 | 317 | UnitsTable |
| 319 | 329 | GeographyTable |
| 331 | 333 | QualityItem |
| 335 | 342 | UnavailableBlock |
| 344 | 351 | DashboardSkeleton |
| 353 | 363 | parseFilters |

| Linha | UI/ação/permissão declarada |
|---|---|
| 85 | title={query.data ? `Dashboard · ${query.data.project.name}` : 'Dashboard do projeto'} |
| 87 | onClick={resetFilters} |
| 122 | label="Período" |
| 129 | label="Data inicial" |
| 130 | label="Data final" |
| 133 | label="Agrupamento" |
| 138 | label="Unidade" |
| 144 | label="UF" |
| 150 | label="Status" |
| 194 | label="Conclusão geral" |
| 199 | title="Nenhum item no recorte atual" |
| 203 | label="Total de itens" |
| 204 | label="Inventariados" |
| 205 | label="Não inventariados" |
| 206 | label="Média por dia ativo" |
| 207 | label="Inventariados hoje" |
| 208 | label="Unidades" |
| 209 | label="Equipe vinculada" |
| 210 | label="Previsão de conclusão" |
| 214 | title="Itens inventariados por período" |
| 217 | title="Evolução acumulada" |
| 223 | title="Distribuição por status" |
| 227 | title="Itens por unidade" |
| 232 | title="Cobertura geográfica" |
| 240 | title="Unidades do projeto" |
| 241 | title="Unidades que precisam de atenção" |
| 245 | title="Qualidade dos dados" |
| 247 | label="Sem unidade" |
| 248 | label="Sem localização" |
| 249 | label="Sem descrição" |
| 250 | label="Sem UF confiável" |
| 253 | title="Atividades recentes" |
| 271 | title="Setores" |
| 272 | title="Consolidação" |
| 273 | title="Produtividade individual" |
| 308 | title={title} |
| 347 | label="Calculando indicadores do projeto" |

### gai-frontend/src/features/project-dashboard/projectDashboardQueries.ts

[gai-frontend/src/features/project-dashboard/projectDashboardQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/project-dashboard/projectDashboardQueries.ts) — 23 linhas.

| Linha | Final | Função |
|---|---|---|
| 11 | 22 | useProjectDashboardAnalytics |

### gai-frontend/src/features/project-dashboard/statusPresentation.ts

[gai-frontend/src/features/project-dashboard/statusPresentation.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/project-dashboard/statusPresentation.ts) — 13 linhas.

### gai-frontend/src/features/projects/ProjectForm.tsx

[gai-frontend/src/features/projects/ProjectForm.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectForm.tsx) — 167 linhas.

| Linha | Final | Função |
|---|---|---|
| 23 | 134 | ProjectForm |
| 136 | 157 | ProjectReadonlyContext |
| 159 | 161 | isProjectField |
| 163 | 166 | toId |

| Linha | UI/ação/permissão declarada |
|---|---|
| 45 | onSubmit={form.handleSubmit(async (values) => {         form.clearErrors();         try {           const organizationId = toId(values.organization_id);           const companyId = toId(values.company_id);           const payload: CreateProjectRequest \| UpdateProjectRequest = mode === 'create'             ? {                 organization_id: organizationId!,                 company_id: companyId!,                 name: values.name,                 ...(values.description ? { description |
| 81 | label="Organizacao" |
| 98 | label="Organizacao" |
| 103 | label="Empresa" |
| 118 | label="Nome" |
| 121 | label="Descricao" |
| 125 | label="Inicio" |
| 126 | label="Fim" |
| 129 | disabled={busy \|\| form.formState.isSubmitting \|\| !canSelectCompany} |
| 149 | label="Organizacao" |
| 152 | label="Empresa" |

### gai-frontend/src/features/projects/projectLifecycle.ts

[gai-frontend/src/features/projects/projectLifecycle.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/projectLifecycle.ts) — 20 linhas.

| Linha | Final | Função |
|---|---|---|
| 13 | 15 | availableProjectActions |
| 17 | 19 | canMutateProjectOperations |

### gai-frontend/src/features/projects/ProjectLifecycleActions.tsx

[gai-frontend/src/features/projects/ProjectLifecycleActions.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectLifecycleActions.tsx) — 94 linhas.

| Linha | Final | Função |
|---|---|---|
| 21 | 70 | ProjectLifecycleActions |
| 28 | 37 | run |
| 72 | 89 | lifecycleErrorFeedback |
| 91 | 93 | isRecord |

| Linha | UI/ação/permissão declarada |
|---|---|
| 52 | disabled={mutation.isPending} |
| 53 | onClick={() => item.confirm ? setConfirming(action) : void run(action)} |
| 63 | title={config?.label ?? 'Confirmar acao'} |

### gai-frontend/src/features/projects/projectQueries.ts

[gai-frontend/src/features/projects/projectQueries.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/projectQueries.ts) — 110 linhas.

| Linha | Final | Função |
|---|---|---|
| 16 | 25 | invalidateProject |
| 27 | 29 | useProjects |
| 31 | 38 | useProject |
| 40 | 51 | useProjectDashboard |
| 53 | 59 | useCreateProject |
| 61 | 70 | useUpdateProject |
| 72 | 88 | useProjectLifecycleAction |
| 90 | 92 | useProjectUnits |
| 94 | 100 | useAssignProjectUnit |
| 102 | 108 | useRemoveProjectUnit |

### gai-frontend/src/features/projects/projectSchemas.ts

[gai-frontend/src/features/projects/projectSchemas.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/projectSchemas.ts) — 48 linhas.

| Linha | Final | Função |
|---|---|---|
| 16 | 20 | validateDates |
| 44 | 47 | isPositiveInteger |

### gai-frontend/src/features/projects/ProjectSelectors.tsx

[gai-frontend/src/features/projects/ProjectSelectors.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectSelectors.tsx) — 181 linhas.

| Linha | Final | Função |
|---|---|---|
| 18 | 48 | OrganizationSelect |
| 50 | 84 | CompanySelect |
| 86 | 115 | CompanyUnitSelect |
| 117 | 167 | PagedSelect |
| 169 | 172 | mergeSelected |
| 174 | 177 | toId |

| Linha | UI/ação/permissão declarada |
|---|---|
| 37 | label="Organizacao" |
| 71 | disabled={props.disabled \|\| !enabled} |
| 72 | label="Empresa" |
| 102 | disabled={props.disabled \|\| !enabled} |
| 103 | label="Unidade" |
| 151 | disabled={disabled} |
| 153 | disabled={disabled \|\| loading \|\| error} |
| 160 | disabled={disabled \|\| page <= 1} |
| 160 | onClick={() => onPage(page - 1)} |
| 162 | disabled={disabled \|\| page >= totalPages} |
| 162 | onClick={() => onPage(page + 1)} |

### gai-frontend/src/features/projects/ProjectsPage.tsx

[gai-frontend/src/features/projects/ProjectsPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectsPage.tsx) — 151 linhas.

| Linha | Final | Função |
|---|---|---|
| 26 | 137 | ProjectsPage |
| 45 | 52 | updateParams |
| 54 | 56 | closeDrawer |
| 58 | 62 | create |
| 64 | 68 | update |
| 139 | 142 | positiveInt |
| 144 | 146 | projectStatus |
| 148 | 150 | statusLabel |

| Linha | UI/ação/permissão declarada |
|---|---|
| 80 | onClick={() => updateParams({ edit: item.id, new: undefined }, false)} |
| 90 | title="Projetos" |
| 92 | onClick={() => updateParams({ new: 1, edit: undefined }, false)} |
| 112 | label="Carregando projetos" |
| 122 | title="Novo projeto" |
| 123 | onSubmit={create} |
| 128 | title="Editar projeto" |
| 129 | label="Carregando projeto" |
| 131 | onSubmit={update} |

### gai-frontend/src/features/projects/ProjectSummaryPage.tsx

[gai-frontend/src/features/projects/ProjectSummaryPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectSummaryPage.tsx) — 459 linhas.

| Linha | Final | Função |
|---|---|---|
| 57 | 89 | ProjectSummaryPage |
| 91 | 112 | ProjectWorkspace |
| 114 | 148 | ProjectHero |
| 150 | 161 | ProjectActions |
| 163 | 179 | MetricGrid |
| 181 | 201 | ProjectProgress |
| 203 | 232 | OperationalAlerts |
| 234 | 256 | WorkspaceTabs |
| 258 | 271 | WorkspaceTab |
| 273 | 309 | QuickActions |
| 311 | 343 | ModuleSummary |
| 345 | 368 | RecentActivity |
| 370 | 385 | ProjectSettings |
| 387 | 414 | buildAlerts |
| 416 | 422 | ProjectError |
| 424 | 431 | Info |
| 433 | 453 | ProjectContextInfo |
| 455 | 457 | LinkButton |

| Linha | UI/ação/permissão declarada |
|---|---|
| 76 | title={title} |
| 80 | label="Carregando workspace do projeto" |
| 84 | title="Projeto nao encontrado" |
| 128 | label="Inicio" |
| 129 | label="Termino" |
| 130 | label="Criado em" |
| 131 | label="Atualizado em" |
| 132 | label="Avaliados" |
| 133 | label="Inventariantes ativos" |
| 141 | label="Inventario avaliado" |
| 155 | label="Editar projeto" |
| 169 | label="Total de itens" |
| 170 | label="Itens pendentes" |
| 171 | label="Imagens" |
| 172 | label="Base contabil" |
| 173 | label="Pendencias abertas" |
| 174 | label="Financeiro total" |
| 175 | label="Importacoes em processamento" |
| 176 | label="Exportacoes concluidas" |
| 193 | label="Itens avaliados" |
| 260 | title={tab.hint} |
| 262 | title={tab.hint} |
| 266 | title={tab.hint} |
| 297 | disabled={locked && action.label !== 'Nova exportacao'} |
| 297 | onClick={() => navigate(action.to)} |
| 363 | label={row.label} |
| 419 | title="Projeto nao encontrado" |
| 449 | label="Empresa vinculada" |
| 450 | label="Organizacao" |

### gai-frontend/src/features/projects/ProjectUnitsPanel.tsx

[gai-frontend/src/features/projects/ProjectUnitsPanel.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectUnitsPanel.tsx) — 107 linhas.

| Linha | Final | Função |
|---|---|---|
| 14 | 100 | ProjectUnitsPanel |
| 28 | 38 | assignSelected |
| 40 | 49 | removeSelected |
| 102 | 106 | unitErrorToast |

| Linha | UI/ação/permissão declarada |
|---|---|
| 62 | disabled={!selectedId \|\| assign.isPending} |
| 62 | onClick={() => void assignSelected()} |
| 68 | label="Carregando unidades" |
| 70 | title="Nenhuma unidade vinculada" |
| 83 | onClick={() => setRemoving(assignment)} |
| 93 | title="Remover unidade" |

### gai-frontend/src/features/roles/RolesPage.tsx

[gai-frontend/src/features/roles/RolesPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/roles/RolesPage.tsx) — 41 linhas.

| Linha | Final | Função |
|---|---|---|
| 9 | 40 | RolesPage |

| Linha | UI/ação/permissão declarada |
|---|---|
| 17 | title="Perfis e acessos" |

### gai-frontend/src/features/shared/ResourceListPage.tsx

[gai-frontend/src/features/shared/ResourceListPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/shared/ResourceListPage.tsx) — 81 linhas.

| Linha | Final | Função |
|---|---|---|
| 19 | 80 | ResourceListPage |

| Linha | UI/ação/permissão declarada |
|---|---|
| 65 | title={title} |
| 67 | onClick={() => setOpen(true)} |
| 76 | title={`Novo ${entityLabel ?? title}`} |

### gai-frontend/src/features/users/UsersPage.tsx

[gai-frontend/src/features/users/UsersPage.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/users/UsersPage.tsx) — 44 linhas.

| Linha | Final | Função |
|---|---|---|
| 10 | 30 | UsersPage |
| 32 | 43 | UserForm |

| Linha | UI/ação/permissão declarada |
|---|---|
| 13 | title="Usuários" |
| 27 | onSubmit={submit} |
| 35 | onSubmit={form.handleSubmit((values) => onSubmit({ ...values, organization_id: values.organization_id ? Number(values.organization_id) : undefined }))} |
| 36 | label="Login" |
| 37 | label="Email" |
| 38 | label="Senha inicial" |
| 39 | label="Organization ID" |

### gai-frontend/src/hooks/useListState.ts

[gai-frontend/src/hooks/useListState.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/hooks/useListState.ts) — 9 linhas.

| Linha | Final | Função |
|---|---|---|
| 3 | 8 | useListState |

### gai-frontend/src/hooks/useTheme.ts

[gai-frontend/src/hooks/useTheme.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/hooks/useTheme.ts) — 50 linhas.

| Linha | Final | Função |
|---|---|---|
| 7 | 12 | applyTheme |
| 14 | 16 | currentTheme |
| 18 | 49 | useTheme |

### gai-frontend/src/layouts/AppLayout.tsx

[gai-frontend/src/layouts/AppLayout.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/layouts/AppLayout.tsx) — 34 linhas.

| Linha | Final | Função |
|---|---|---|
| 6 | 33 | AppLayout |

### gai-frontend/src/layouts/AuthLayout.tsx

[gai-frontend/src/layouts/AuthLayout.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/layouts/AuthLayout.tsx) — 60 linhas.

| Linha | Final | Função |
|---|---|---|
| 6 | 49 | AuthLayout |
| 51 | 59 | Capability |

| Linha | UI/ação/permissão declarada |
|---|---|
| 35 | label="Inventário" |
| 36 | label="Rastreabilidade" |
| 37 | label="Governança" |
| 42 | onClick={toggleTheme} |

### gai-frontend/src/layouts/Sidebar.tsx

[gai-frontend/src/layouts/Sidebar.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/layouts/Sidebar.tsx) — 111 linhas.

| Linha | Final | Função |
|---|---|---|
| 18 | 52 | Sidebar |
| 54 | 110 | SidebarContent |

| Linha | UI/ação/permissão declarada |
|---|---|
| 34 | onClick={() => onMobileOpenChange(false)} |
| 44 | onClick={() => onMobileOpenChange(false)} |

### gai-frontend/src/layouts/Topbar.tsx

[gai-frontend/src/layouts/Topbar.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/layouts/Topbar.tsx) — 97 linhas.

| Linha | Final | Função |
|---|---|---|
| 27 | 40 | Breadcrumbs |
| 42 | 96 | Topbar |

| Linha | UI/ação/permissão declarada |
|---|---|
| 53 | onClick={onOpenNavigation} |
| 62 | onClick={toggleTheme} |

### gai-frontend/src/main.tsx

[gai-frontend/src/main.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/main.tsx) — 15 linhas.

### gai-frontend/src/router/ProtectedRoute.tsx

[gai-frontend/src/router/ProtectedRoute.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/router/ProtectedRoute.tsx) — 27 linhas.

| Linha | Final | Função |
|---|---|---|
| 8 | 26 | ProtectedRoute |

| Linha | UI/ação/permissão declarada |
|---|---|
| 21 | label="Restaurando sessao" |
| 22 | label="Validando sessao" |

### gai-frontend/src/router/router.tsx

[gai-frontend/src/router/router.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/router/router.tsx) — 87 linhas.

| Linha | UI/ação/permissão declarada |
|---|---|
| 57 | title="Project Area" |
| 71 | title="Catalog Assets" |
| 72 | title="Inventory Items" |
| 73 | title="Inventory Item Images" |
| 74 | title="Accounting Items" |
| 75 | title="Pending Issues" |
| 76 | title="Payments" |
| 77 | title="Expenses" |
| 78 | title="Import Sessions" |
| 79 | title="Export Jobs" |
| 80 | title="Perfil do usuario" |
| 81 | title="Configuracoes" |

### gai-frontend/src/types/api.ts

[gai-frontend/src/types/api.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/types/api.ts) — 1171 linhas.

### gai-frontend/src/utils/cn.ts

[gai-frontend/src/utils/cn.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/utils/cn.ts) — 7 linhas.

| Linha | Final | Função |
|---|---|---|
| 4 | 6 | cn |

### gai-frontend/src/utils/format.ts

[gai-frontend/src/utils/format.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/utils/format.ts) — 15 linhas.

| Linha | Final | Função |
|---|---|---|
| 1 | 4 | formatDate |
| 6 | 9 | formatDateTime |
| 11 | 14 | formatMoney |

### gai-frontend/src/vite-env.d.ts

[gai-frontend/src/vite-env.d.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/vite-env.d.ts) — 2 linhas.

## Testes existentes e casos identificados

O extrator inclui tanto `.spec.ts` quanto `.e2e-spec.ts`, `.test.ts(x)` e arquivos auxiliares no manifesto. Nenhum foi executado nesta auditoria. Nomes de casos não garantem cobertura efetiva; ver fixtures/mocks/asserts na origem. A suíte de integração usa SQLite em memória; a maioria dos testes frontend usa mocks/interceptações.

### gai-backend/src/app.controller.spec.ts

[gai-backend/src/app.controller.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/src/app.controller.spec.ts) — 21 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | AppController |
| 15 | describe | health |
| 16 | it | returns ok status |

### gai-backend/test/contract/auth-api.spec.ts

[gai-backend/test/contract/auth-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/auth-api.spec.ts) — 79 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | auth-api contract |
| 10 | it | defines required auth endpoints |
| 18 | it | defines required schemas |
| 28 | it | defines ErrorCode enum values including ACCOUNT_LOCKED |
| 39 | it | documents HTTP status codes per endpoint |
| 47 | it | documents parallel flow tables |
| 54 | it | uses snake_case field names aligned with backend DTOs |
| 65 | it | defines UserRole and UserStatus enums |
| 72 | it | documents effective permissions returned by login and me |

### gai-backend/test/contract/catalog-assets-api.spec.ts

[gai-backend/test/contract/catalog-assets-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/catalog-assets-api.spec.ts) — 56 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | catalog-assets-api contract |
| 13 | it | defines required catalog asset endpoints |
| 24 | it | defines schemas, statuses and snake_case fields |
| 44 | it | documents required permissions |

### gai-backend/test/contract/companies-company-units-api.spec.ts

[gai-backend/test/contract/companies-company-units-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/companies-company-units-api.spec.ts) — 67 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | companies-company-units-api contract |
| 13 | it | defines companies, company units and project unit endpoints |
| 28 | it | defines schemas, statuses and snake_case fields |
| 56 | it | documents required permissions |

### gai-backend/test/contract/expense-accountabilities-api.spec.ts

[gai-backend/test/contract/expense-accountabilities-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/expense-accountabilities-api.spec.ts) — 29 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 3 | describe | expense-accountabilities contract |
| 8 | it | documents lifecycle and endpoints |
| 17 | it | documents all permissions |

### gai-backend/test/contract/export-jobs-api.spec.ts

[gai-backend/test/contract/export-jobs-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/export-jobs-api.spec.ts) — 54 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | export-jobs-api contract |
| 10 | it | defines the complete export job lifecycle endpoints |
| 23 | it | limits types to supported XLSX exports and defines all statuses |
| 39 | it | documents RBAC and keeps persistence internals out of public DTOs |

### gai-backend/test/contract/field-agents-api.spec.ts

[gai-backend/test/contract/field-agents-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/field-agents-api.spec.ts) — 89 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | field-agents-api contract |
| 13 | it | defines required field agent endpoints |
| 29 | it | defines schemas, statuses and snake_case fields |
| 52 | it | documents required permissions |
| 71 | it | documents the stable terminal-project conflict |
| 79 | it | derives organization on create and documents Brazilian validation |

### gai-backend/test/contract/import-sessions-api.spec.ts

[gai-backend/test/contract/import-sessions-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/import-sessions-api.spec.ts) — 45 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | import-sessions-api contract |
| 13 | it | defines sessions, payloads, errors and files endpoints |
| 29 | it | documents statuses and permissions |

### gai-backend/test/contract/inventory-accounting-items-api.spec.ts

[gai-backend/test/contract/inventory-accounting-items-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/inventory-accounting-items-api.spec.ts) — 66 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | inventory-accounting-items-api contract |
| 13 | it | defines required accounting import and accounting item endpoints |
| 27 | it | defines schemas, statuses and snake_case fields |
| 53 | it | documents required permissions |

### gai-backend/test/contract/inventory-item-images-api.spec.ts

[gai-backend/test/contract/inventory-item-images-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/inventory-item-images-api.spec.ts) — 68 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | inventory-item-images-api contract |
| 13 | it | defines required inventory item image endpoints |
| 28 | it | defines schemas, statuses and public fields |
| 56 | it | documents required permissions |

### gai-backend/test/contract/inventory-items-api.spec.ts

[gai-backend/test/contract/inventory-items-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/inventory-items-api.spec.ts) — 65 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | inventory-items-api contract |
| 13 | it | defines required inventory item endpoints |
| 26 | it | defines schemas, statuses and snake_case fields |
| 53 | it | documents required permissions |

### gai-backend/test/contract/inventory-operations-api.spec.ts

[gai-backend/test/contract/inventory-operations-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/inventory-operations-api.spec.ts) — 55 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | inventory-operations contract |
| 10 | it | documents sessions, reinventory, observations, reconciliation and consolidation |
| 30 | it | documents authorization keys |
| 43 | it | documents restart recovery, lifecycle and storage authorization |

### gai-backend/test/contract/inventory-pending-issues-api.spec.ts

[gai-backend/test/contract/inventory-pending-issues-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/inventory-pending-issues-api.spec.ts) — 65 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | inventory-pending-issues-api contract |
| 13 | it | defines required pending issue endpoints |
| 26 | it | defines schemas, statuses, types and snake_case fields |
| 51 | it | documents required permissions |

### gai-backend/test/contract/organizations-api.spec.ts

[gai-backend/test/contract/organizations-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/organizations-api.spec.ts) — 82 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | organizations-api contract |
| 13 | it | defines required organization endpoints |
| 20 | it | defines required schemas |
| 30 | it | defines ErrorCode enum values |
| 44 | it | documents HTTP status codes per endpoint |
| 53 | it | documents parallel flow tables in operation descriptions |
| 60 | it | uses snake_case field names aligned with backend DTOs |
| 77 | it | defines OrganizationStatus enum |

### gai-backend/test/contract/payments-expenses-api.spec.ts

[gai-backend/test/contract/payments-expenses-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/payments-expenses-api.spec.ts) — 48 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | payments-expenses-api contract |
| 13 | it | defines payment, expense and attachment endpoints |
| 29 | it | documents statuses, fields and permissions |

### gai-backend/test/contract/project-dashboard-api.spec.ts

[gai-backend/test/contract/project-dashboard-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/project-dashboard-api.spec.ts) — 63 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | project-dashboard-api contract |
| 13 | it | defines summary and dashboard endpoints |
| 20 | it | documents analytics filters, temporal series and unavailable domains |
| 36 | it | documents optional include query params and response blocks |
| 51 | it | uses snake_case dashboard fields |

### gai-backend/test/contract/projects-api.spec.ts

[gai-backend/test/contract/projects-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/projects-api.spec.ts) — 102 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | projects-api contract |
| 10 | it | defines required project endpoints |
| 28 | it | defines schemas and status enum |
| 49 | it | uses snake_case fields aligned with DTOs |
| 69 | it | documents permissions and error flow names |
| 88 | it | keeps status out of PATCH and exposes available actions |

### gai-backend/test/contract/swagger-fidelity.spec.ts

[gai-backend/test/contract/swagger-fidelity.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/swagger-fidelity.spec.ts) — 113 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 12 | describe | Swagger OpenAPI fidelity (contract) |
| 25 | it | generates OpenAPI document with organization paths and schemas |
| 52 | it | matches contract field names and enums |

### gai-backend/test/contract/users-api.spec.ts

[gai-backend/test/contract/users-api.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/contract/users-api.spec.ts) — 82 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | users-api contract |
| 13 | it | defines required user endpoints |
| 24 | it | defines required schemas |
| 34 | it | uses profile-only create request without embedded role |
| 44 | it | documents role_assignments in user response |
| 57 | it | uses snake_case field names aligned with backend DTOs |
| 68 | it | defines UserStatus and RoleType enums |
| 75 | it | documents HTTP status codes for role assignment endpoints |

### gai-backend/test/integration/auth/brute-force-protection.e2e-spec.ts

[gai-backend/test/integration/auth/brute-force-protection.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/auth/brute-force-protection.e2e-spec.ts) — 32 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 5 | describe | Auth - Brute force protection (e2e) |
| 17 | it | returns generic 401 and then 423 after repeated failures |

### gai-backend/test/integration/auth/login.e2e-spec.ts

[gai-backend/test/integration/auth/login.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/auth/login.e2e-spec.ts) — 103 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 16 | describe | Auth - Login/Logout/Me (e2e) |
| 28 | it | POST /auth/login returns token for valid credentials |
| 52 | it | GET /auth/me returns current user with valid token |
| 73 | it | POST /auth/logout invalidates session |
| 93 | it | POST /auth/login returns 401 for invalid credentials |

### gai-backend/test/integration/auth/organization-gate.e2e-spec.ts

[gai-backend/test/integration/auth/organization-gate.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/auth/organization-gate.e2e-spec.ts) — 33 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 8 | describe | Auth - Organization gate (e2e) |
| 26 | it | blocks login when organization is inactive |

### gai-backend/test/integration/auth/password-reset.e2e-spec.ts

[gai-backend/test/integration/auth/password-reset.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/auth/password-reset.e2e-spec.ts) — 61 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 9 | describe | Auth - Password Reset (e2e) |
| 27 | it | POST /auth/password-reset/request always returns generic message |
| 36 | it | POST /auth/password-reset/confirm updates password and revokes sessions |

### gai-backend/test/integration/auth/rbac-multi-tenancy.e2e-spec.ts

[gai-backend/test/integration/auth/rbac-multi-tenancy.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/auth/rbac-multi-tenancy.e2e-spec.ts) — 433 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 32 | describe | RBAC multi-tenancy isolation (e2e) |
| 240 | it | allows PLATFORM_ADMIN to assign a platform role to a platform user |
| 258 | it | allows valid same-tenant assignment by PLATFORM_ADMIN and ORG_ADMIN |
| 272 | it | blocks cross-tenant and null-organization custom role assignments |
| 296 | it | keeps ORG_ADMIN inside its own users and roles |
| 315 | it | rejects assignment of an inactive role |
| 323 | it | isolates project list and detail between two organizations |
| 341 | it | does not authorize a legacy organization role assigned to a user without organization |
| 348 | it | removes effective permission immediately when an assignment is revoked |
| 373 | it | removes effective permission immediately when a role becomes inactive |
| 387 | it | blocks organization change while incompatible assignments remain active |
| 400 | it | keeps login and /auth/me working for valid users |

### gai-backend/test/integration/auth/session-invalidation.e2e-spec.ts

[gai-backend/test/integration/auth/session-invalidation.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/auth/session-invalidation.e2e-spec.ts) — 196 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 18 | describe | Auth - Session invalidation on status changes (e2e) |
| 89 | it | revokes every user session and requires login after reactivation |
| 133 | it | revokes only sessions from the deactivated organization |

### gai-backend/test/integration/catalog-assets/catalog-assets.e2e-spec.ts

[gai-backend/test/integration/catalog-assets/catalog-assets.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/catalog-assets/catalog-assets.e2e-spec.ts) — 139 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 27 | describe | Catalog Assets API (e2e) |
| 41 | it | creates, lists, updates and audits catalog assets |
| 87 | it | blocks duplicate normalized descriptions in the same organization |
| 107 | it | deactivates and reactivates without deleting the record |

### gai-backend/test/integration/companies/companies.e2e-spec.ts

[gai-backend/test/integration/companies/companies.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/companies/companies.e2e-spec.ts) — 390 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 50 | describe | Companies and Company Units API (e2e) |
| 64 | it | creates company, unit, project assignment and audit records |
| 183 | it | blocks project-unit mutations after the project becomes terminal |
| 235 | it | prevents assigning inactive units to projects |
| 267 | it | lists a legacy project without company and only requires company on assign |
| 321 | it | rejects a unit from another tenant without writing an audit row |

### gai-backend/test/integration/export-jobs/export-jobs.e2e-spec.ts

[gai-backend/test/integration/export-jobs/export-jobs.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/export-jobs/export-jobs.e2e-spec.ts) — 374 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 57 | describe | Export Jobs (e2e) |
| 71 | it | generates, lists and downloads a real XLSX with audit and dashboard totals |
| 209 | it | rejects formats outside the supported XLSX contract |
| 228 | it | fails safely before serializing a workbook above the configured row limit |
| 273 | it | expires retained bytes in the background without a client read |

### gai-backend/test/integration/field-agents/field-agents.e2e-spec.ts

[gai-backend/test/integration/field-agents/field-agents.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/field-agents/field-agents.e2e-spec.ts) — 480 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 46 | describe | Field Agents API (e2e) |
| 60 | it | creates, lists and audits field agents |
| 98 | it | assigns and removes a field agent from an operational project |
| 146 | it | blocks assignment to finished project |
| 188 | it | revalidates the locked project inside assign, update and remove transactions |
| 297 | it | rejects organization_id supplied by the client |
| 305 | it | prevents reading a field agent from another organization |
| 358 | it | returns field-specific 409 for duplicate email and document |
| 390 | it | blocks, unblocks and soft deletes without exposing deleted records |
| 432 | it | prevents PATCH from reactivating a duplicate assignment atomically |

### gai-backend/test/integration/import-sessions/import-sessions.e2e-spec.ts

[gai-backend/test/integration/import-sessions/import-sessions.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/import-sessions/import-sessions.e2e-spec.ts) — 185 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 43 | describe | Import Sessions (e2e) |
| 66 | it | creates session, processes payload idempotently and exposes errors/files |

### gai-backend/test/integration/inventory-accounting-items/inventory-accounting-items.e2e-spec.ts

[gai-backend/test/integration/inventory-accounting-items/inventory-accounting-items.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/inventory-accounting-items/inventory-accounting-items.e2e-spec.ts) — 108 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 32 | describe | Inventory Accounting Items (e2e) |
| 55 | it | imports XLSX accounting items and lists normalized rows |

### gai-backend/test/integration/inventory-item-images/inventory-item-images.e2e-spec.ts

[gai-backend/test/integration/inventory-item-images/inventory-item-images.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/inventory-item-images/inventory-item-images.e2e-spec.ts) — 245 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 48 | describe | Inventory Item Images (e2e) |
| 91 | it | creates upload url, confirms, lists, downloads and removes an image |
| 167 | it | allows an operational user with image permissions to list images |
| 176 | it | rejects unsupported mime type and project blocked mutations |
| 215 | it | enforces the max 3 images per item rule |

### gai-backend/test/integration/inventory-items/inventory-items.e2e-spec.ts

[gai-backend/test/integration/inventory-items/inventory-items.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/inventory-items/inventory-items.e2e-spec.ts) — 159 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 33 | describe | Inventory Items (e2e) |
| 58 | it | creates, lists, updates, deactivates and reactivates an item inside a project |
| 130 | it | allows an operational user with inventory item permissions |
| 139 | it | blocks item mutations when project is finished |

### gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts

[gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts) — 452 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 14 | describe | Inventory operation gap closure (e2e) |
| 71 | it | resumes after refresh, preserves reinventory lineage and closes the lifecycle |
| 338 | it | cancels an active session and all of its active rounds without deletion |
| 379 | it | enforces authentication, permission, project and organization scope |

### gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts

[gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts) — 390 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 10 | describe | Inventory operations and accountabilities (e2e) |
| 23 | it | enforces authentication and module permissions |
| 40 | it | preserves initial evidence when requesting and recording a reinventory |
| 183 | it | closes an accountability with server-calculated total and exact installments |
| 286 | it | materializes a physical-base payload idempotently without changing the master plate |

### gai-backend/test/integration/inventory-pending-issues/inventory-pending-issues.e2e-spec.ts

[gai-backend/test/integration/inventory-pending-issues/inventory-pending-issues.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/inventory-pending-issues/inventory-pending-issues.e2e-spec.ts) — 131 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 31 | describe | Inventory Pending Issues (e2e) |
| 54 | it | creates, lists, resolves and generates pending issues |

### gai-backend/test/integration/organizations/create-organization.e2e-spec.ts

[gai-backend/test/integration/organizations/create-organization.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/organizations/create-organization.e2e-spec.ts) — 55 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 5 | describe | Organizations - Create (e2e) |
| 19 | it | POST /organizations creates organization with valid CNPJ |
| 37 | it | POST /organizations returns 409 for duplicate CNPJ |
| 48 | it | POST /organizations returns 401 without token |

### gai-backend/test/integration/organizations/deactivate-activate-organization.e2e-spec.ts

[gai-backend/test/integration/organizations/deactivate-activate-organization.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/organizations/deactivate-activate-organization.e2e-spec.ts) — 50 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 5 | describe | Organizations - Deactivate/Activate (e2e) |
| 29 | it | deactivates and reactivates organization |

### gai-backend/test/integration/organizations/error-flows.e2e-spec.ts

[gai-backend/test/integration/organizations/error-flows.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/organizations/error-flows.e2e-spec.ts) — 102 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 10 | describe | Organizations - Error flows (e2e) |
| 26 | it | POST /organizations returns 400 VALIDATION_ERROR for invalid CNPJ |
| 42 | it | POST /organizations returns 409 CONFLICT for duplicate CNPJ |
| 65 | it | POST /organizations returns 403 FORBIDDEN for ORG_USER role |
| 78 | it | POST /organizations/:id/deactivate returns 409 when already inactive |

### gai-backend/test/integration/organizations/get-organization.e2e-spec.ts

[gai-backend/test/integration/organizations/get-organization.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/organizations/get-organization.e2e-spec.ts) — 38 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 5 | describe | Organizations - Get by id (e2e) |
| 19 | it | GET /organizations/:id returns seeded organization from list |

### gai-backend/test/integration/organizations/list-organizations.e2e-spec.ts

[gai-backend/test/integration/organizations/list-organizations.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/organizations/list-organizations.e2e-spec.ts) — 57 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 5 | describe | Organizations - List/Get (e2e) |
| 29 | it | GET /organizations returns paginated list |
| 41 | it | GET /organizations/:id returns organization |
| 50 | it | GET /organizations/:id returns 404 for unknown id |

### gai-backend/test/integration/organizations/update-organization.e2e-spec.ts

[gai-backend/test/integration/organizations/update-organization.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/organizations/update-organization.e2e-spec.ts) — 39 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 5 | describe | Organizations - Update (e2e) |
| 29 | it | PATCH /organizations/:id updates trade_name |

### gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts

[gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts) — 195 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 36 | describe | Payments & Expenses (e2e) |
| 78 | it | creates payment, marks paid, creates expense and handles attachment URLs |

### gai-backend/test/integration/project-dashboard/project-dashboard.e2e-spec.ts

[gai-backend/test/integration/project-dashboard/project-dashboard.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/project-dashboard/project-dashboard.e2e-spec.ts) — 408 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 76 | describe | Project Dashboard (e2e) |
| 90 | it | returns aggregated project summary with optional blocks |
| 151 | it | validates dashboard date filters |
| 167 | it | denies access to a project from another organization |

### gai-backend/test/integration/projects/projects.e2e-spec.ts

[gai-backend/test/integration/projects/projects.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/projects/projects.e2e-spec.ts) — 393 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 45 | describe | Projects (e2e) |
| 61 | it | creates, lists, updates and finishes a project inside the organization scope |
| 168 | it | pauses, resumes, cancels and archives only through allowed transitions |
| 220 | it | blocks finish, cancel and legacy deactivate while operational records are open |
| 268 | it | blocks archive while operational records are open |
| 314 | it | rejects a stale field update without overwriting concurrent finish data |
| 372 | it | allows an operational user with projects permissions |
| 379 | it | rejects invalid date ranges |

### gai-backend/test/integration/users/create-user.e2e-spec.ts

[gai-backend/test/integration/users/create-user.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/users/create-user.e2e-spec.ts) — 70 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 10 | describe | Users - Create (e2e) |
| 26 | it | POST /users creates profile-only user without role_assignments |
| 45 | it | ORG_ADMIN creates user scoped to own organization |
| 59 | it | POST /users returns 401 without token |

### gai-backend/test/integration/users/list-users.e2e-spec.ts

[gai-backend/test/integration/users/list-users.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/users/list-users.e2e-spec.ts) — 80 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 11 | describe | Users - List (e2e) |
| 29 | it | PLATFORM_ADMIN lists all users with role_assignments |
| 43 | it | ORG_ADMIN lists only users from own organization |
| 59 | it | GET /users/:id returns user detail with role_assignments |
| 73 | it | operational user without admin role receives 403 |

### gai-backend/test/integration/users/org-roles.e2e-spec.ts

[gai-backend/test/integration/users/org-roles.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/users/org-roles.e2e-spec.ts) — 77 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 10 | describe | Users - Org Roles (e2e) |
| 26 | it | GET /organizations/:id/roles lists custom roles |
| 39 | it | POST /organizations/:id/roles creates custom role with permissions |
| 57 | it | GET /organizations/:id/roles/:roleId returns role detail |

### gai-backend/test/integration/users/role-assignments.e2e-spec.ts

[gai-backend/test/integration/users/role-assignments.e2e-spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/integration/users/role-assignments.e2e-spec.ts) — 95 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 10 | describe | Users - Role Assignments (e2e) |
| 40 | it | POST /users/:userId/role-assignments assigns organization role |
| 53 | it | GET /users/:userId/role-assignments lists active assignments |
| 66 | it | DELETE /users/:userId/role-assignments/:assignmentId revokes assignment |
| 87 | it | ORG_ADMIN cannot assign PLATFORM_ADMIN role |

### gai-backend/test/unit/common/common.spec.ts

[gai-backend/test/unit/common/common.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/common/common.spec.ts) — 271 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 21 | describe | Common infrastructure |
| 22 | it | buildPaginatedResult calculates pages |
| 28 | it | HttpExceptionFilter formats validation errors |
| 51 | it | HttpExceptionFilter handles unknown errors |
| 76 | it | HttpExceptionFilter does not serialize a sensitive non-Error value |
| 104 | it | CorrelationIdInterceptor sets header |
| 126 | describe | Config factories |
| 127 | it | loads app and auth config |
| 133 | describe | RolesGuard |
| 134 | it | allows when role matches |
| 151 | it | denies when role mismatches |
| 167 | describe | SessionAuthGuard |
| 168 | it | rejects missing bearer token |
| 192 | describe | DevAdminGuard |
| 193 | it | sets dev admin user in non-production |
| 207 | describe | MockEmailSender |
| 208 | it | logs mock email without exposing its password reset token |
| 235 | describe | ActivateOrganizationUseCase |
| 236 | it | activates inactive organization |

### gai-backend/test/unit/common/logger-redaction.spec.ts

[gai-backend/test/unit/common/logger-redaction.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/common/logger-redaction.spec.ts) — 266 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 111 | describe | Pino sensitive log redaction |
| 125 | it | redacts Authorization, Cookie and Set-Cookie while preserving request metadata |
| 187 | it | redacts login passwords and returned auth tokens from structured logs |
| 222 | it | redacts password recovery and session tokens |

### gai-backend/test/unit/migrations/new-operations-migrations.spec.ts

[gai-backend/test/unit/migrations/new-operations-migrations.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/migrations/new-operations-migrations.spec.ts) — 137 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 6 | describe | new operations migrations |
| 24 | it | creates inventory dependencies in order and rolls them back in reverse order |
| 53 | it | enforces unique expense membership and exact financial precision |
| 75 | it | adds cancellable sessions and append-only observation evidence |
| 95 | it | resumes after session columns were committed by MySQL |
| 110 | it | uses full binary ASCII uniqueness in a forward migration |

### gai-backend/test/unit/modules/auth/login.use-case.spec.ts

[gai-backend/test/unit/modules/auth/login.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/auth/login.use-case.spec.ts) — 106 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 12 | describe | LoginUseCase |
| 85 | it | locks account after max failed attempts |

### gai-backend/test/unit/modules/auth/password.spec.ts

[gai-backend/test/unit/modules/auth/password.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/auth/password.spec.ts) — 22 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | Password value object |
| 5 | it | accepts strong password |
| 10 | it | rejects short password |
| 14 | it | rejects password without special character |
| 18 | it | rejects password without uppercase |

### gai-backend/test/unit/modules/auth/permission-resolver.spec.ts

[gai-backend/test/unit/modules/auth/permission-resolver.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/auth/permission-resolver.spec.ts) — 174 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 6 | describe | TypeOrmPermissionResolver tenant isolation |
| 47 | it | grants a valid organization permission only inside the same tenant |
| 63 | it | does not grant permissions from an inactive role |
| 70 | it | does not grant permissions from an inactive or revoked assignment |
| 77 | it | rejects a role from another organization |
| 91 | it | does not grant organization permissions to a user without organization |
| 111 | it | does not grant permissions to inactive users or users in inactive organizations |
| 124 | it | materializes the complete catalog for PLATFORM_ADMIN |
| 151 | it | materializes every organization permission for ORG_ADMIN |

### gai-backend/test/unit/modules/auth/session-auth.guard.spec.ts

[gai-backend/test/unit/modules/auth/session-auth.guard.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/auth/session-auth.guard.spec.ts) — 161 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 30 | describe | SessionAuthGuard session eligibility |
| 94 | it | accepts an active user in an active organization and renews afterwards |
| 113 | it | rejects an inactive user without renewing the session |
| 125 | it | rejects a currently locked user without renewing the session |
| 139 | it | rejects a user from an inactive organization without renewing |
| 151 | it | does not require an organization for a platform user |

### gai-backend/test/unit/modules/branch-coverage.spec.ts

[gai-backend/test/unit/modules/branch-coverage.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/branch-coverage.spec.ts) — 524 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 30 | describe | Branch coverage boosters |
| 111 | it | LoginUseCase handles unknown, inactive, locked and inactive org users |
| 154 | it | RequestPasswordResetUseCase sends email when user exists |
| 180 | it | HttpExceptionFilter maps common HTTP statuses |
| 214 | it | RolesGuard allows when no roles required |
| 227 | it | SessionAuthGuard accepts valid bearer session |
| 258 | it | organization read/update use cases handle not found and no-op update |
| 291 | it | TypeOrmOrganizationRepository maps entities |
| 357 | it | LoginUseCase succeeds for organization user when org is active |
| 368 | it | ConfirmPasswordResetUseCase updates password for valid token |
| 404 | it | DeactivateOrganizationUseCase returns conflict when already inactive |
| 426 | it | DevAdminGuard blocks production environment |
| 434 | it | User entity handles LOCKED status and password update |
| 441 | it | Organization entity updates all optional fields |
| 462 | it | Cnpj equals compares values |
| 468 | it | SessionAuthGuard rejects invalid session and missing user |
| 507 | it | Organization entity rejects duplicate state transitions |

### gai-backend/test/unit/modules/catalog-assets/catalog-asset.spec.ts

[gai-backend/test/unit/modules/catalog-assets/catalog-asset.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/catalog-assets/catalog-asset.spec.ts) — 87 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 7 | describe | CatalogAsset domain |
| 23 | it | requires description |
| 29 | it | deactivates and reactivates without physical delete |
| 43 | it | blocks repeated deactivation |
| 56 | describe | CatalogAssetScopeService |
| 59 | it | normalizes descriptions ignoring case, accents and extra spaces |
| 65 | it | allows platform admin to target any organization |
| 78 | it | blocks organization user from accessing another organization |

### gai-backend/test/unit/modules/companies/company.spec.ts

[gai-backend/test/unit/modules/companies/company.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/companies/company.spec.ts) — 84 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 9 | describe | Company domain and scope |
| 10 | it | requires meaningful company and unit names |
| 38 | it | exposes status guards for project and unit assignment rules |
| 62 | it | enforces organization scope unless actor is platform admin |

### gai-backend/test/unit/modules/domain-entities.spec.ts

[gai-backend/test/unit/modules/domain-entities.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/domain-entities.spec.ts) — 125 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 10 | describe | Organization entity |
| 23 | it | deactivates and activates |
| 31 | it | tracks field updates |
| 38 | describe | User entity |
| 54 | it | locks after failed attempts |
| 61 | it | resets on successful login |
| 67 | describe | LogoutUseCase |
| 68 | it | revokes session and writes audit |
| 81 | it | rejects missing session |
| 93 | describe | GetCurrentUserUseCase |
| 94 | it | returns current user dto |

### gai-backend/test/unit/modules/expense-accountabilities/expense-accountabilities.service.spec.ts

[gai-backend/test/unit/modules/expense-accountabilities/expense-accountabilities.service.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/expense-accountabilities/expense-accountabilities.service.spec.ts) — 92 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 6 | describe | ExpenseAccountabilitiesService |

### gai-backend/test/unit/modules/expense-accountabilities/installment-allocation.policy.spec.ts

[gai-backend/test/unit/modules/expense-accountabilities/installment-allocation.policy.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/expense-accountabilities/installment-allocation.policy.spec.ts) — 49 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 2 | describe | InstallmentAllocationPolicy |
| 3 | it | preserves every cent when the amount is not evenly divisible |
| 10 | it | supports installments smaller than one cent per part |

### gai-backend/test/unit/modules/field-agents/brazilian-contact.spec.ts

[gai-backend/test/unit/modules/field-agents/brazilian-contact.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/field-agents/brazilian-contact.spec.ts) — 55 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 13 | describe | Brazilian field-agent contact validation |
| 28 | it | normalizes documents and phones |
| 47 | it | does not turn unrelated database failures into conflicts |

### gai-backend/test/unit/modules/field-agents/field-agent.spec.ts

[gai-backend/test/unit/modules/field-agents/field-agent.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/field-agents/field-agent.spec.ts) — 89 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 43 | describe | FieldAgent domain |
| 44 | it | rejects short names |
| 50 | it | deactivates without deleting project history |
| 59 | it | reactivates only inactive field agents |
| 68 | describe | ProjectFieldAgent domain |
| 69 | it | rejects end_date earlier than start_date |
| 80 | it | removes assignment by finishing it |

### gai-backend/test/unit/modules/import-sessions/import-sessions.spec.ts

[gai-backend/test/unit/modules/import-sessions/import-sessions.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/import-sessions/import-sessions.spec.ts) — 67 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 7 | describe | ImportSessionScopeService |
| 10 | it | enforces organization scope unless actor is platform admin |
| 30 | it | blocks mutations on non-operational projects |
| 55 | it | normalizes plates and builds stable storage paths |

### gai-backend/test/unit/modules/import-sessions/physical-observation-import-parser.service.spec.ts

[gai-backend/test/unit/modules/import-sessions/physical-observation-import-parser.service.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/import-sessions/physical-observation-import-parser.service.spec.ts) — 31 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | PhysicalObservationImportParserService |
| 5 | it | normalizes legacy headers through the centralized alias catalogue |

### gai-backend/test/unit/modules/inventory-accounting-items/inventory-accounting-item.spec.ts

[gai-backend/test/unit/modules/inventory-accounting-items/inventory-accounting-item.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/inventory-accounting-items/inventory-accounting-item.spec.ts) — 128 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 38 | describe | InventoryAccountingItem domain |
| 39 | it | rejects invalid decimal strings |
| 49 | it | updates fields and records changes |
| 61 | it | deactivates and reactivates without physical deletion |
| 77 | describe | InventoryAccountingItemScopeService |
| 80 | it | normalizes plates and trims empty text to null |
| 85 | it | validates real ISO dates and normalizes Brazilian money strings |
| 94 | describe | AccountingImportParserService |
| 95 | it | parses XLSX rows, aliases and extra metadata |

### gai-backend/test/unit/modules/inventory-item-images/inventory-item-image.spec.ts

[gai-backend/test/unit/modules/inventory-item-images/inventory-item-image.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/inventory-item-images/inventory-item-image.spec.ts) — 61 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 28 | describe | InventoryItemImage |
| 29 | it | confirms pending upload |
| 43 | it | rejects confirm when not pending |
| 51 | it | removes logically |

### gai-backend/test/unit/modules/inventory-items/inventory-item.spec.ts

[gai-backend/test/unit/modules/inventory-items/inventory-item.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/inventory-items/inventory-item.spec.ts) — 79 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 37 | describe | InventoryItem domain |
| 38 | it | rejects invalid decimal strings |
| 48 | it | updates fields and records changes |
| 62 | it | deactivates and reactivates without physical deletion |

### gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts

[gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts) — 32 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 7 | describe | InventoryConsolidationEntity |
| 8 | it | maps the evidence snapshot property to the migrated snake_case column |
| 19 | it | keeps storage-key collation database-agnostic in entity metadata |

### gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts

[gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts) — 89 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 9 | describe | InventoryOperationPolicy |
| 10 | it | normalizes plate evidence without changing the master record |
| 17 | it | allows only draft sessions to start |
| 26 | it | finishes only active sessions without active rounds |
| 47 | it | cancels only draft or active sessions |
| 65 | it | restricts a reinventory round to its requested item |
| 77 | it | rejects observations in closed rounds or sessions |

### gai-backend/test/unit/modules/inventory-pending-issues/inventory-pending-issue.spec.ts

[gai-backend/test/unit/modules/inventory-pending-issues/inventory-pending-issue.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/inventory-pending-issues/inventory-pending-issue.spec.ts) — 84 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 36 | describe | InventoryPendingIssue domain |
| 37 | it | requires title |
| 43 | it | updates editable fields and records changes |
| 55 | it | requires resolution notes for relevant divergences |
| 63 | it | resolves and ignores with actor/date metadata |
| 75 | describe | InventoryPendingIssueScopeService |
| 78 | it | normalizes plate and trims text |

### gai-backend/test/unit/modules/organization-scope-services.spec.ts

[gai-backend/test/unit/modules/organization-scope-services.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/organization-scope-services.spec.ts) — 55 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 9 | describe | Organization-scoped list filters |
| 45 | it | FieldAgentScopeService requires an active organization even for PLATFORM_ADMIN |

### gai-backend/test/unit/modules/organizations/cnpj.spec.ts

[gai-backend/test/unit/modules/organizations/cnpj.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/organizations/cnpj.spec.ts) — 32 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | Cnpj value object |
| 5 | it | accepts valid CNPJ 11222333000181 |
| 10 | it | strips non-digit characters |
| 15 | it | rejects invalid check digits |
| 19 | it | rejects wrong length |
| 23 | it | rejects repeated digits |
| 27 | it | validates via isValid helper |

### gai-backend/test/unit/modules/organizations/create-organization.use-case.spec.ts

[gai-backend/test/unit/modules/organizations/create-organization.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/organizations/create-organization.use-case.spec.ts) — 64 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 8 | describe | CreateOrganizationUseCase |
| 25 | it | creates organization with valid data |
| 44 | it | throws conflict for duplicate CNPJ |

### gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts

[gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts) — 123 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 40 | describe | FieldAgentPayment domain |
| 41 | it | calculates daily and final totals |
| 46 | it | approves and marks as paid |
| 53 | it | rejects invalid date ranges |
| 64 | describe | Expense domain |
| 65 | it | approves, rejects and pays according to status rules |
| 97 | describe | ExpenseAttachment domain |
| 98 | it | confirms upload and removes logically |

### gai-backend/test/unit/modules/project-dashboard/organization-overview.spec.ts

[gai-backend/test/unit/modules/project-dashboard/organization-overview.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/project-dashboard/organization-overview.spec.ts) — 112 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 12 | describe | Organization overview isolation and exports |
| 42 | it | cross-filters UF and company without duplicates or cross-organization unit links |
| 49 | it | paginates and sorts projects in SQL and scopes company names/addresses |
| 60 | it | groups companies with a real unlinked bucket, search and pagination |
| 68 | it | scopes actual SQL to the authenticated organization and excludes deleted projects |
| 74 | it | ignores injected organization identifiers and combines name/status/date filters |
| 80 | it | rejects other roles, missing organization and reversed date ranges |
| 87 | it | validates impossible dates, invalid statuses and date/month/year ranges |
| 92 | it | exports readable CSV and XLSX with the same scope and neutralized formulas |

### gai-backend/test/unit/modules/project-dashboard/project-dashboard-analytics.service.spec.ts

[gai-backend/test/unit/modules/project-dashboard/project-dashboard-analytics.service.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/project-dashboard/project-dashboard-analytics.service.spec.ts) — 131 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 65 | describe | ProjectDashboardAnalyticsService |
| 66 | it | calculates metrics and preserves unavailable domains as null |
| 88 | it | rejects invalid custom periods |
| 99 | it | fills days without activity with zero in daily custom ranges |
| 119 | it | returns not found without querying analytics |

### gai-backend/test/unit/modules/project-dashboard/project-summary-calculations.spec.ts

[gai-backend/test/unit/modules/project-dashboard/project-summary-calculations.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/project-dashboard/project-summary-calculations.spec.ts) — 20 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 6 | describe | Project summary calculations |
| 7 | it | calculates inventory progress and avoids division by zero |
| 14 | it | sums money as fixed decimal strings |

### gai-backend/test/unit/modules/project-dashboard/project-summary.service.spec.ts

[gai-backend/test/unit/modules/project-dashboard/project-summary.service.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/project-dashboard/project-summary.service.spec.ts) — 173 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 129 | describe | ProjectSummaryService |
| 130 | it | returns basic summary without optional blocks by default |
| 144 | it | includes optional blocks when requested |
| 165 | it | returns not found when project does not exist |

### gai-backend/test/unit/modules/projects/project-status-transition.policy.spec.ts

[gai-backend/test/unit/modules/projects/project-status-transition.policy.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/projects/project-status-transition.policy.spec.ts) — 74 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 7 | describe | ProjectStatusTransitionPolicy |
| 8 | it | models the canonical lifecycle and its permissions |
| 30 | it | rejects transitions outside the matrix |
| 39 | it | returns only canonical available actions |
| 51 | it | centralizes statuses that accept operational mutations |

### gai-backend/test/unit/modules/projects/project.spec.ts

[gai-backend/test/unit/modules/projects/project.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/projects/project.spec.ts) — 58 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 26 | describe | Project domain |
| 27 | it | rejects end_date earlier than start_date |
| 38 | it | blocks operational updates for terminal or inactive statuses |
| 46 | it | finishes project and records finished_at change |

### gai-backend/test/unit/modules/projects/update-project-status.use-case.spec.ts

[gai-backend/test/unit/modules/projects/update-project-status.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/projects/update-project-status.use-case.spec.ts) — 101 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 27 | describe | UpdateProjectStatusUseCase |
| 49 | it | returns the stable transition error for a concurrent status change |
| 75 | it | returns operation names and counts when readiness fails |

### gai-backend/test/unit/modules/projects/update-project.use-case.spec.ts

[gai-backend/test/unit/modules/projects/update-project.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/projects/update-project.use-case.spec.ts) — 116 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 28 | describe | UpdateProjectUseCase |
| 36 | it | returns a stable conflict when the compare-and-set detects a concurrent change |
| 76 | it | persists only editable fields through the transactional partial-update port |

### gai-backend/test/unit/modules/use-cases-extended.spec.ts

[gai-backend/test/unit/modules/use-cases-extended.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/use-cases-extended.spec.ts) — 185 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 18 | describe | Auth use cases (extended) |
| 34 | it | LoginUseCase succeeds with valid credentials |
| 98 | it | RequestPasswordResetUseCase returns generic message when user missing |
| 122 | it | ConfirmPasswordResetUseCase rejects invalid token |
| 139 | describe | Organization use cases (extended) |
| 152 | it | UpdateOrganizationUseCase rejects CNPJ change |
| 162 | it | DeactivateOrganizationUseCase deactivates active org |

### gai-backend/test/unit/modules/users/activate-user.use-case.spec.ts

[gai-backend/test/unit/modules/users/activate-user.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/users/activate-user.use-case.spec.ts) — 73 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 10 | describe | ActivateUserUseCase session invalidation |
| 32 | it | revokes historical sessions before reactivating the user |

### gai-backend/test/unit/modules/users/assign-user-role.use-case.spec.ts

[gai-backend/test/unit/modules/users/assign-user-role.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/users/assign-user-role.use-case.spec.ts) — 292 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 17 | describe | AssignUserRoleUseCase |
| 89 | it | assigns organization role to user |
| 118 | it | assigns PLATFORM_ADMIN role to a platform user |
| 146 | it | allows ORG_ADMIN to assign an organization role inside its tenant |
| 173 | it | blocks PLATFORM_ADMIN from assigning organization A role to organization B user |
| 189 | it | blocks PLATFORM_ADMIN from assigning organization role to platform user |
| 204 | it | blocks ORG_ADMIN from assigning role from another organization |
| 219 | it | blocks ORG_ADMIN from assigning role to another organization user |
| 228 | it | rejects an inactive role |
| 243 | it | returns existing assignment when role already assigned |
| 269 | it | throws NotFound when user does not exist |
| 277 | it | ORG_ADMIN cannot assign PLATFORM_ADMIN role |

### gai-backend/test/unit/modules/users/create-user.use-case.spec.ts

[gai-backend/test/unit/modules/users/create-user.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/users/create-user.use-case.spec.ts) — 133 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 11 | describe | CreateUserUseCase |
| 48 | it | creates user with profile-only fields |
| 72 | it | ORG_ADMIN creates user scoped to own organization |
| 92 | it | throws conflict for duplicate login |
| 114 | it | non-admin actor cannot create users |

### gai-backend/test/unit/modules/users/deactivate-user.use-case.spec.ts

[gai-backend/test/unit/modules/users/deactivate-user.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/users/deactivate-user.use-case.spec.ts) — 133 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 12 | describe | DeactivateUserUseCase |
| 58 | it | deactivates non-platform-admin user |
| 93 | it | throws Conflict when deactivating last PLATFORM_ADMIN |
| 125 | it | throws NotFound when user does not exist |

### gai-backend/test/unit/modules/users/revoke-user-role-assignment.use-case.spec.ts

[gai-backend/test/unit/modules/users/revoke-user-role-assignment.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/users/revoke-user-role-assignment.use-case.spec.ts) — 105 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 12 | describe | RevokeUserRoleAssignmentUseCase |
| 55 | it | revokes organization role assignment |
| 75 | it | throws Conflict when revoking last PLATFORM_ADMIN assignment |
| 96 | it | throws NotFound when assignment does not exist |

### gai-backend/test/unit/modules/users/update-user-organization.use-case.spec.ts

[gai-backend/test/unit/modules/users/update-user-organization.use-case.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/users/update-user-organization.use-case.spec.ts) — 114 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 12 | describe | UpdateUserUseCase organization isolation |
| 69 | it | blocks organization change while an incompatible assignment is active |
| 93 | it | allows PLATFORM_ADMIN to change organization after assignments are revoked |
| 106 | it | blocks ORG_ADMIN from moving a user to another organization |

### gai-backend/test/unit/modules/users/user-scope.service.spec.ts

[gai-backend/test/unit/modules/users/user-scope.service.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-backend/test/unit/modules/users/user-scope.service.spec.ts) — 87 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 6 | describe | UserScopeService tenant boundaries |
| 9 | it | does not turn a null organization into a global filter |
| 22 | it | allows explicit global filtering only for PLATFORM_ADMIN |
| 35 | it | rejects a cross-tenant organization role even for PLATFORM_ADMIN |
| 53 | it | allows organization system roles only for organization users |

### gai-frontend/src/api/pagination.test.ts

[gai-frontend/src/api/pagination.test.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/api/pagination.test.ts) — 25 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | normalizePage |
| 5 | it | normaliza respostas com items |
| 15 | it | normaliza respostas com data/meta |

### gai-frontend/src/components/ui/help-popover.test.tsx

[gai-frontend/src/components/ui/help-popover.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/components/ui/help-popover.test.tsx) — 28 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 6 | describe | HelpPopover |
| 7 | it | abre a ajuda por teclado e fecha com Escape devolvendo o foco |

### gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.test.tsx

[gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.test.tsx) — 15 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 14 | describe | ProjectAccountabilitiesPage |
| 14 | it | exibe total e tres despesas retornados pelo backend |
| 14 | it | envia filtros reais para a API |

### gai-frontend/src/features/accounting-items/ProjectAccountingItemsPage.test.tsx

[gai-frontend/src/features/accounting-items/ProjectAccountingItemsPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/accounting-items/ProjectAccountingItemsPage.test.tsx) — 210 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 113 | describe | ProjectAccountingItemsPage |
| 126 | it | renderiza listagem da base contabil |
| 132 | it | renderiza loading |
| 138 | it | renderiza vazio |
| 144 | it | renderiza erro |
| 150 | it | oculta importar sem permissao |
| 156 | it | valida arquivo invalido |
| 164 | it | filtros chamam API com parametros corretos |
| 172 | it | pagina usando page/page_size |
| 179 | it | detalhe renderiza dados principais |
| 186 | it | edicao valida valor monetario |
| 195 | it | desativa com confirmacao |
| 202 | it | renderiza historico e erros de importacao |

### gai-frontend/src/features/auth/permissions.test.ts

[gai-frontend/src/features/auth/permissions.test.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/auth/permissions.test.ts) — 53 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 14 | describe | permissions |
| 15 | it | libera plataforma para qualquer permissao visual |
| 21 | it | mapeia ORG_ADMIN para users e org roles |
| 28 | it | usa permissoes efetivas quando o backend as retorna |
| 39 | it | nao aplica fallback administrativo quando permissions vem vazio |
| 48 | it | exige todas as permissoes declaradas |

### gai-frontend/src/features/dashboard/OrganizationOverviewPage.test.tsx

[gai-frontend/src/features/dashboard/OrganizationOverviewPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/dashboard/OrganizationOverviewPage.test.tsx) — 77 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 16 | describe | Organization overview |
| 18 | it | shows unavailable contractual metrics separately from real zero counts |
| 24 | it | restores URL filters and only requests when applying a combined selection |
| 36 | it | rejects reversed date ranges without a request |
| 42 | it | handles service failures without misleading zero cards |
| 49 | it | cross-filters status, map and company through the shared URL selection |
| 61 | it | sorts, paginates, selects and configures project columns without editing data |

### gai-frontend/src/features/export-jobs/ProjectExportJobsPage.test.tsx

[gai-frontend/src/features/export-jobs/ProjectExportJobsPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/export-jobs/ProjectExportJobsPage.test.tsx) — 157 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 86 | describe | ProjectExportJobsPage |
| 108 | it | lista jobs reais e renderiza o estado vazio |
| 118 | it | exibe erro real da listagem |
| 125 | it | solicita uma nova exportacao com tipo validado |
| 134 | it | obtem a URL autorizada antes de baixar o blob autenticado |
| 142 | it | confirma cancelamento e cria nova tentativa para estados permitidos |

### gai-frontend/src/features/field-agents/brazilianContact.test.ts

[gai-frontend/src/features/field-agents/brazilianContact.test.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/brazilianContact.test.ts) — 26 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | brazilianContact |
| 13 | it | normaliza documento e telefone brasileiros |

### gai-frontend/src/features/field-agents/FieldAgentsPage.test.tsx

[gai-frontend/src/features/field-agents/FieldAgentsPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/field-agents/FieldAgentsPage.test.tsx) — 305 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 108 | describe | FieldAgentsPage |
| 122 | it | renderiza listagem de inventariantes |
| 128 | it | renderiza estado de loading |
| 134 | it | renderiza estado vazio |
| 140 | it | renderiza estado de erro |
| 146 | it | valida formulario de criacao |
| 154 | it | explica o campo opcional de usuario vinculado sem enviar o formulario |
| 167 | it | normaliza documento e telefone sem enviar organization_id |
| 180 | it | mostra conflito de documento no campo e preserva o formulario |
| 193 | it | oculta botao de criar sem permissao |
| 199 | it | desativa inventariante com confirmacao |
| 207 | it | exclui inventariante somente apos confirmacao |
| 215 | it | paginacao chama API com page/page_size |
| 222 | it | renderiza inventariantes vinculados ao projeto |
| 230 | it | trata conflito ao reativar vinculo e mantem o formulario aberto |
| 242 | it | seleciona inventariante ativo com busca remota sem campo de ID manual |
| 260 | it | renderiza loading e estado vazio no seletor remoto |
| 270 | it | renderiza erro e permite tentar novamente no seletor remoto |
| 278 | it | mantem vinculos somente para consulta quando o projeto e terminal |
| 290 | it | exige field-agents:read para abrir o seletor de vinculo |

### gai-frontend/src/features/finance/ProjectFinancePage.test.tsx

[gai-frontend/src/features/finance/ProjectFinancePage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/finance/ProjectFinancePage.test.tsx) — 255 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 160 | describe | ProjectFinancePage |
| 186 | it | renderiza resumo e listagem de pagamentos |
| 192 | it | filtra pagamentos com parametros reais |
| 199 | it | valida formulario de pagamento |
| 206 | it | aprova pagamento com permissao |
| 213 | it | oculta criacao para usuario sem permissao |
| 219 | it | renderiza despesas em aba dedicada |
| 225 | it | valida formulario de despesa |
| 233 | it | rejeita despesa com motivo obrigatorio |
| 244 | it | envia comprovante usando upload-url e confirm-upload |

### gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.test.tsx

[gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.test.tsx) — 235 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 104 | describe | ProjectImportSessionsPage |
| 124 | it | renderiza listagem de importacoes |
| 130 | it | renderiza loading, vazio e erro |
| 140 | it | renderiza erro |
| 146 | it | oculta nova importacao sem permissao |
| 152 | it | valida formulario de nova importacao |
| 159 | it | cria sessao com payload real |
| 169 | it | filtra por status com parametro real |
| 175 | it | pagina usando page/page_size |
| 182 | it | detalhe renderiza abas, contadores e omite paths internos |
| 196 | it | upload chama upload-url e confirm-upload |
| 207 | it | download usa endpoint download-url |
| 215 | it | retry usa confirmacao quando sessao falhou |
| 224 | it | finalizar e cancelar usam confirmacao |

### gai-frontend/src/features/inventory-item-images/InventoryItemImagesGallery.test.tsx

[gai-frontend/src/features/inventory-item-images/InventoryItemImagesGallery.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-item-images/InventoryItemImagesGallery.test.tsx) — 156 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 78 | describe | InventoryItemImagesGallery |
| 91 | it | renderiza a galeria com metadados seguros |
| 99 | it | renderiza loading |
| 105 | it | renderiza vazio |
| 111 | it | renderiza erro |
| 117 | it | oculta upload e remocao sem permissao |
| 124 | it | valida formato de arquivo antes de solicitar upload-url |
| 132 | it | executa upload-url, envio direto e confirm-upload |
| 142 | it | gera download-url sob demanda e exibe preview |
| 149 | it | remove imagem com confirmacao |

### gai-frontend/src/features/inventory-items/ItemEvidencePanels.test.tsx

[gai-frontend/src/features/inventory-items/ItemEvidencePanels.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-items/ItemEvidencePanels.test.tsx) — 60 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 43 | describe | ItemEvidencePanels plate history |
| 50 | it | mostra contexto resolvido sem requisicoes adicionais por linha |

### gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.test.tsx

[gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.test.tsx) — 165 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 90 | describe | ProjectInventoryItemsPage |
| 100 | it | renderiza listagem de itens |
| 106 | it | renderiza loading |
| 112 | it | renderiza vazio |
| 118 | it | renderiza erro |
| 124 | it | valida formulario de criacao |
| 131 | it | oculta criar sem permissao |
| 137 | it | desativa com confirmacao |
| 144 | it | pagina chamando page/page_size |
| 151 | it | filtros chamam API com parametros reais |
| 158 | it | detalhe renderiza dados principais |

### gai-frontend/src/features/inventory-operations/idempotency.test.ts

[gai-frontend/src/features/inventory-operations/idempotency.test.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/idempotency.test.ts) — 12 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 4 | describe | createIdempotencyKey |
| 5 | it | gera uma chave valida uma vez para ser reutilizada em retries |

### gai-frontend/src/features/inventory-operations/InventorySessionDetailPage.test.tsx

[gai-frontend/src/features/inventory-operations/InventorySessionDetailPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/InventorySessionDetailPage.test.tsx) — 297 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 178 | describe | InventorySessionDetailPage |
| 200 | it | reconstroi deep link e rodada atual apenas pelas APIs |
| 210 | it | recupera a nova rodada apos reinventario e nova montagem |
| 228 | it | finaliza uma sessao sem rodada ativa e remove acoes operacionais |
| 242 | it | cancela a sessao somente com motivo explicito |
| 256 | it | apresenta mensagem de dominio quando o lifecycle muda concorrentemente |
| 267 | it | traduz 409 por codigo e reutiliza a idempotency_key no retry |
| 282 | it | executa upload presigned, confirmacao, listagem e download sob demanda |

### gai-frontend/src/features/inventory-operations/ProjectInventorySessionsPage.test.tsx

[gai-frontend/src/features/inventory-operations/ProjectInventorySessionsPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/inventory-operations/ProjectInventorySessionsPage.test.tsx) — 16 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 15 | describe | ProjectInventorySessionsPage |
| 15 | it | lista sessoes reais e aplica filtro de status |
| 15 | it | cria sessao com loading e validacao |

### gai-frontend/src/features/organizations/OrganizationsPage.test.tsx

[gai-frontend/src/features/organizations/OrganizationsPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/organizations/OrganizationsPage.test.tsx) — 256 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 117 | describe | OrganizationsPage |
| 128 | it | renderiza listagem de organizações |
| 134 | it | renderiza estado de loading |
| 140 | it | renderiza estado vazio |
| 146 | it | renderiza estado de erro |
| 152 | it | mostra botão de criar com organizations:write |
| 157 | it | oculta botão de criar sem permissão |
| 163 | it | valida formulário de criação |
| 171 | it | cria organização normalizando CNPJ e telefone |
| 189 | it | mostra conflito de CNPJ no campo e preserva o formulário |
| 206 | it | edita organização sem permitir alterar CNPJ |
| 219 | it | desativa organização com confirmação |
| 227 | it | reativa organização com confirmação |
| 235 | it | abre detalhes da organização |
| 242 | it | paginação chama API com page/page_size |
| 249 | it | filtra por status |

### gai-frontend/src/features/pending-issues/ProjectPendingIssuesPage.test.tsx

[gai-frontend/src/features/pending-issues/ProjectPendingIssuesPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/pending-issues/ProjectPendingIssuesPage.test.tsx) — 197 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 94 | describe | ProjectPendingIssuesPage |
| 107 | it | renderiza listagem de pendencias |
| 113 | it | renderiza loading |
| 119 | it | renderiza vazio |
| 125 | it | renderiza erro |
| 131 | it | oculta criar e gerar sem permissao |
| 138 | it | filtros chamam API com parametros corretos |
| 146 | it | pagina usando page/page_size |
| 153 | it | detalhe renderiza dados principais |
| 160 | it | formulario de criacao valida campos obrigatorios |
| 168 | it | resolver exige observacoes |
| 175 | it | ignora pendencia com motivo opcional |
| 183 | it | cancela com confirmacao |
| 190 | it | gera pendencias automaticamente |

### gai-frontend/src/features/project-dashboard/ProjectDashboardPage.test.tsx

[gai-frontend/src/features/project-dashboard/ProjectDashboardPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/project-dashboard/ProjectDashboardPage.test.tsx) — 123 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 87 | describe | ProjectDashboardPage |
| 93 | it | renders cards, charts, map data and unavailable domains |
| 103 | it | synchronizes filter changes with the API query |
| 117 | it | renders the standard error state |

### gai-frontend/src/features/projects/ProjectLifecycleActions.test.tsx

[gai-frontend/src/features/projects/ProjectLifecycleActions.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectLifecycleActions.test.tsx) — 125 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 72 | describe | ProjectLifecycleActions |
| 75 | it | respeita available_actions, a permissao informada pelo backend e detalha blockers 409 |
| 96 | it | executa sem confirmacao uma acao liberada pelo backend |
| 105 | it | diferencia 403 de indisponibilidade por status |
| 115 | it | trata 404 quando o projeto deixa de existir |

### gai-frontend/src/features/projects/ProjectsPage.test.tsx

[gai-frontend/src/features/projects/ProjectsPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectsPage.test.tsx) — 130 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 52 | describe | ProjectsPage |
| 65 | it | cria no tenant autenticado e normaliza campos opcionais |
| 75 | it | edita apenas campos mutaveis |
| 93 | it | envia filtros da URL e mantem o tenant do usuario |
| 98 | it | explica bloqueio quando falta companies:read |
| 105 | it | mapeia erro 422 do backend no campo sem perder o formulario |
| 120 | it | mantem projeto terminal somente para consulta inclusive por URL direta |

### gai-frontend/src/features/projects/ProjectSummaryPage.test.tsx

[gai-frontend/src/features/projects/ProjectSummaryPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectSummaryPage.test.tsx) — 179 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 95 | describe | ProjectSummaryPage workspace |
| 108 | it | renderiza workspace com breadcrumbs, cabecalho e metricas reais |
| 120 | it | renderiza loading |
| 127 | it | renderiza erro |
| 133 | it | renderiza projeto nao encontrado |
| 139 | it | oculta card e atalho quando usuario nao possui permissao |
| 147 | it | navega entre abas e atalho novo item |
| 153 | it | atalho importar base contabil redireciona para o fluxo existente |
| 159 | it | sinaliza projeto finalizado e bloqueia acoes operacionais |
| 170 | it | nao inventa configuracoes editaveis e preserva dados legados para consulta |

### gai-frontend/src/features/projects/ProjectUnitsPanel.test.tsx

[gai-frontend/src/features/projects/ProjectUnitsPanel.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/projects/ProjectUnitsPanel.test.tsx) — 115 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 81 | describe | ProjectUnitsPanel |
| 90 | it | lista, vincula e remove unidades pelos endpoints reais |
| 106 | it | mantem somente consulta em status terminal |

### gai-frontend/src/features/shared/ResourceListPage.test.tsx

[gai-frontend/src/features/shared/ResourceListPage.test.tsx](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/src/features/shared/ResourceListPage.test.tsx) — 56 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 45 | describe | ResourceListPage permissions |
| 46 | it | oculta acao de criacao sem permissao visual |
| 51 | it | exibe acao de criacao para usuario com permissao efetiva |

### gai-frontend/e2e/app.spec.ts

[gai-frontend/e2e/app.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/e2e/app.spec.ts) — 1218 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 677 | test | login |
| 692 | test | logout |
| 702 | test | rota protegida redireciona para login |
| 707 | test | acesso negado |
| 712 | test | listagem paginada |
| 720 | test | acessa tela de inventariantes autenticado |
| 728 | test | bloqueia inventariantes sem permissao |
| 735 | test | abre formulario e valida campos obrigatorios de inventariante |
| 753 | test | abre detalhe de inventariante |
| 762 | test | acessa itens a partir de um projeto autenticado |
| 770 | test | bloqueia itens sem permissao |
| 777 | test | abre formulario e valida campos obrigatorios de item |
| 786 | test | abre detalhe de item |
| 797 | test | visualiza imagem de item por download-url temporaria |
| 807 | test | envia imagem de item com upload-url e confirmacao |
| 817 | test | remove imagem de item com confirmacao |
| 828 | test | filtra itens por status e busca |
| 837 | test | acessa base contabil a partir de um projeto autenticado |
| 846 | test | bloqueia base contabil sem permissao |
| 853 | test | abre modal e valida arquivo invalido da base contabil |
| 862 | test | filtra base contabil por status e placa |
| 871 | test | abre detalhe de item contabil |
| 880 | test | acessa pendencias a partir de um projeto autenticado |
| 888 | test | bloqueia pendencias sem permissao |
| 895 | test | abre nova pendencia e valida obrigatorios |
| 905 | test | filtra pendencias por status |
| 913 | test | abre detalhe da pendencia |
| 922 | test | resolve pendencia com observacao |
| 932 | test | ignora pendencia |
| 942 | test | cancela pendencia com confirmacao |
| 951 | test | aciona geracao automatica de pendencias |
| 960 | test | acessa financeiro do projeto com listagem paginada |
| 969 | test | bloqueia financeiro sem permissao |
| 976 | test | valida novo pagamento no financeiro |
| 985 | test | filtra pagamentos no financeiro |
| 994 | test | envia comprovante de despesa no financeiro |
| 1006 | test | acessa exportacoes a partir de um projeto autenticado |
| 1015 | test | acessa workspace consolidado do projeto |
| 1025 | test | acessa dashboard analitico do projeto e aplica filtro |
| 1036 | test | navega entre abas do workspace do projeto |
| 1044 | test | abre atalho rapido de novo item no workspace |
| 1052 | test | bloqueia workspace sem permissao de projeto |
| 1059 | test | bloqueia exportacoes sem permissao de projeto |
| 1066 | test | abre exportacoes pelo resumo do projeto |
| 1074 | test | acessa importacoes a partir de um projeto autenticado |
| 1082 | test | bloqueia importacoes sem permissao |
| 1089 | test | abre nova importacao e valida tipo obrigatorio |
| 1098 | test | preenche formulario de criacao de importacao |
| 1114 | test | abre detalhe de importacao e navega nas abas |
| 1131 | test | filtra importacoes por status |
| 1139 | test | finaliza e cancela importacao com confirmacao |
| 1151 | test | retoma sessao de inventario por deep link e refresh |
| 1164 | test | anexa evidencia, cria reinventario e retoma nova rodada apos refresh |
| 1191 | test | finaliza rodada e sessao removendo acoes operacionais |
| 1205 | test | apresenta conflito 409 de observacao por codigo de dominio |

### gai-frontend/e2e/homologation-real.spec.ts

[gai-frontend/e2e/homologation-real.spec.ts](C:/Users/Jonathan/Documents/GAI/GAI/gai-frontend/e2e/homologation-real.spec.ts) — 54 linhas.

| Linha | Tipo | Caso |
|---|---|---|
| 8 | test | login, refresh, deep link and logout against the real API |

