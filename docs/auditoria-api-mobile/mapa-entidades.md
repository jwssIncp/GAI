# Entidades e schema declarados no código

Não confirmado no MySQL; tentativa local ECONNREFUSED. Este mapa usa entities, não introspecção do banco. As FKs podem existir somente nas migrations. A aplicação efetiva das migrations não foi verificada.

| Módulo | Tabela | Entity e evidência | Índices declarados |
|---|---|---|---|
| assisted-reconciliation | assisted_reconciliation_runs | [AssistedRun:27](../../gai-backend/src/modules/assisted-reconciliation/assisted.entity.ts#L27) | @Index('idx_assisted_runs_scope', [   'organizationId',   'projectId',   'sessionId',   'id', ]) |
| assisted-reconciliation | assisted_reconciliation_candidates | [AssistedCandidate:45](../../gai-backend/src/modules/assisted-reconciliation/assisted.entity.ts#L45) | @Index('idx_assisted_candidates_run', ['runId', 'id']); @Index(   'uq_assisted_candidate_pair',   ['runId', 'inventoryItemId', 'accountingItemId'],   { unique: true }, ) |
| assisted-reconciliation | assisted_reconciliation_decisions | [AssistedDecision:65](../../gai-backend/src/modules/assisted-reconciliation/assisted.entity.ts#L65) | @Index('idx_assisted_decision_candidate', ['candidateId', 'id']); @Index(   'uq_assisted_decision_command',   ['organizationId', 'projectId', 'commandKey'],   { unique: true }, ) |
| assisted-reconciliation | assisted_reconciliation_claims | [AssistedClaim:90](../../gai-backend/src/modules/assisted-reconciliation/assisted.entity.ts#L90) | @Index('uq_assisted_claim_accounting', ['projectId', 'accountingItemId'], {   unique: true, }); @Index('uq_assisted_claim_physical', ['projectId', 'inventoryItemId'], {   unique: true, }) |
| auth | auth_audit_logs | [AuthAuditLogEntity:16](../../gai-backend/src/modules/auth/infrastructure/persistence/auth-audit-log.entity.ts#L16) |  |
| auth | password_reset_tokens | [PasswordResetTokenEntity:14](../../gai-backend/src/modules/auth/infrastructure/persistence/password-reset-token.entity.ts#L14) | @Index('idx_reset_tokens_user_id', ['userId']); @Index('idx_reset_tokens_hash', ['tokenHash']) |
| auth | sessions | [SessionEntity:11](../../gai-backend/src/modules/auth/infrastructure/persistence/session.entity.ts#L11) | @Index('idx_sessions_user_id', ['userId']); @Index('idx_sessions_expires_at', ['expiresAt']) |
| auth | users | [UserEntity:15](../../gai-backend/src/modules/auth/infrastructure/persistence/user.entity.ts#L15) | @Index('uq_users_field_scope', ['id', 'organizationId'], { unique: true }); @Index('idx_users_organization_id', ['organizationId']); @Index('idx_users_status', ['status']) |
| budgets | budget_pricing_versions | [BudgetPricingEntity:33](../../gai-backend/src/modules/budgets/budget.entity.ts#L33) | @Index('uq_budget_pricing_version', ['organizationId', 'name', 'version'], {   unique: true, }) |
| budgets | budgets | [BudgetEntity:64](../../gai-backend/src/modules/budgets/budget.entity.ts#L64) | @Index('uq_budget_number', ['organizationId', 'number'], { unique: true }) |
| budgets | budget_versions | [BudgetVersionEntity:116](../../gai-backend/src/modules/budgets/budget.entity.ts#L116) | @Index('uq_budget_version', ['budgetId', 'version'], { unique: true }) |
| budgets | budget_audit_logs | [BudgetAuditEntity:146](../../gai-backend/src/modules/budgets/budget.entity.ts#L146) | @Index('uq_budget_audit_revision', ['budgetId', 'revision'], { unique: true }) |
| catalog-assets | catalog_asset_audit_logs | [CatalogAssetAuditLogEntity:13](../../gai-backend/src/modules/catalog-assets/infrastructure/persistence/catalog-asset-audit-log.entity.ts#L13) | @Index('idx_catalog_asset_audit_asset_created', ['catalogAssetId', 'createdAt']); @Index('idx_catalog_asset_audit_organization_id', ['organizationId']) |
| catalog-assets | catalog_assets | [CatalogAssetEntity:17](../../gai-backend/src/modules/catalog-assets/infrastructure/persistence/catalog-asset.entity.ts#L17) | @Index('idx_catalog_assets_org_status', ['organizationId', 'status']); @Index('idx_catalog_assets_org_category', ['organizationId', 'category']); @Index(   'uq_catalog_assets_org_description_normalized',   ['organizationId', 'descriptionNormalized'],   { unique: true }, ) |
| companies | company_audit_logs | [CompanyAuditLogEntity:15](../../gai-backend/src/modules/companies/infrastructure/persistence/company-audit-log.entity.ts#L15) | @Index('idx_company_audit_company_created', ['companyId', 'createdAt']); @Index('idx_company_audit_organization_id', ['organizationId']) |
| companies | company_unit_audit_logs | [CompanyUnitAuditLogEntity:15](../../gai-backend/src/modules/companies/infrastructure/persistence/company-unit-audit-log.entity.ts#L15) | @Index('idx_company_unit_audit_unit_created', ['companyUnitId', 'createdAt']); @Index('idx_company_unit_audit_organization_id', ['organizationId']) |
| companies | company_units | [CompanyUnitEntity:17](../../gai-backend/src/modules/companies/infrastructure/persistence/company-unit.entity.ts#L17) | @Index('idx_company_units_organization_company_status', [   'organizationId',   'companyId',   'status', ]); @Index('idx_company_units_organization_company_code', [   'organizationId',   'companyId',   'code', ]); @Index('idx_company_units_organization_city_state', [   'organizationId',   'city',   'state', ]); @Index('idx_company_units_name', ['name']) |
| companies | companies | [CompanyEntity:17](../../gai-backend/src/modules/companies/infrastructure/persistence/company.entity.ts#L17) | @Index('idx_companies_organization_status', ['organizationId', 'status']); @Index('idx_companies_organization_document', ['organizationId', 'document'], {   unique: true, }); @Index('idx_companies_organization_city_state', [   'organizationId',   'city',   'state', ]); @Index('idx_companies_name', ['name']) |
| companies | project_unit_audit_logs | [ProjectUnitAuditLogEntity:15](../../gai-backend/src/modules/companies/infrastructure/persistence/project-unit-audit-log.entity.ts#L15) | @Index('idx_project_unit_audit_project_created', ['projectId', 'createdAt']); @Index('idx_project_unit_audit_organization_id', ['organizationId']) |
| companies | project_units | [ProjectUnitEntity:15](../../gai-backend/src/modules/companies/infrastructure/persistence/project-unit.entity.ts#L15) | @Index('idx_project_units_organization_project', [   'organizationId',   'projectId', ]); @Index('idx_project_units_organization_unit', [   'organizationId',   'companyUnitId', ]); @Index('idx_project_units_project_deleted', ['projectId', 'deletedAt']); @Index('uq_project_units_project_unit', ['projectId', 'companyUnitId'], {   unique: true, }) |
| contracts | project_contracts | [ContractEntity:40](../../gai-backend/src/modules/contracts/contract.entity.ts#L40) | @Index('uq_contract_number', ['organizationId', 'number'], { unique: true }) |
| contracts | project_contract_versions | [ContractVersionEntity:55](../../gai-backend/src/modules/contracts/contract.entity.ts#L55) | @Index('uq_contract_revision', ['contractId', 'revision'], { unique: true }) |
| contracts | project_contract_amendments | [ContractAmendmentEntity:74](../../gai-backend/src/modules/contracts/contract.entity.ts#L74) | @Index('uq_contract_amendment', ['contractId', 'identifier'], { unique: true }) |
| contracts | commercial_report_snapshots | [CommercialReportEntity:115](../../gai-backend/src/modules/contracts/contract.entity.ts#L115) |  |
| documents | document_visual_versions | [DocumentVisualVersion:44](../../gai-backend/src/modules/documents/document.entity.ts#L44) |  |
| documents | document_artifacts | [DocumentArtifact:49](../../gai-backend/src/modules/documents/document.entity.ts#L49) | @Index('uq_document_artifact_key', ['cacheKey'], { unique: true }) |
| documents | document_audit_logs | [DocumentAudit:76](../../gai-backend/src/modules/documents/document.entity.ts#L76) |  |
| expense-accountabilities | expense_accountabilities | [ExpenseAccountabilityEntity:21](../../gai-backend/src/modules/expense-accountabilities/expense-accountability.entity.ts#L21) | @Index('idx_expense_accountabilities_project_status', ['projectId', 'status']) |
| expense-accountabilities | expense_accountability_items | [ExpenseAccountabilityItemEntity:69](../../gai-backend/src/modules/expense-accountabilities/expense-accountability.entity.ts#L69) | @Index('uq_expense_accountability_items_expense', ['expenseId'], {   unique: true, }) |
| expense-accountabilities | expense_installments | [ExpenseInstallmentEntity:85](../../gai-backend/src/modules/expense-accountabilities/expense-accountability.entity.ts#L85) | @Index(   'uq_expense_installments_expense_number',   ['expenseId', 'installmentNumber'],   { unique: true }, ) |
| expense-accountabilities | expense_accountability_audit_logs | [ExpenseAccountabilityAuditLogEntity:116](../../gai-backend/src/modules/expense-accountabilities/expense-accountability.entity.ts#L116) | @Index('idx_expense_accountability_audit_project', ['projectId', 'createdAt']) |
| export-jobs | export_job_audit_logs | [ExportJobAuditLogEntity:14](../../gai-backend/src/modules/export-jobs/infrastructure/persistence/export-job-audit-log.entity.ts#L14) | @Index('idx_export_job_audit_job_created', ['exportJobId', 'createdAt']); @Index('idx_export_job_audit_org_project', ['organizationId', 'projectId']) |
| export-jobs | export_jobs | [ExportJobEntity:18](../../gai-backend/src/modules/export-jobs/infrastructure/persistence/export-job.entity.ts#L18) | @Index('idx_export_jobs_org_project_status', [   'organizationId',   'projectId',   'status', ]); @Index('idx_export_jobs_project_type_created', [   'projectId',   'type',   'createdAt', ]); @Index('idx_export_jobs_status_created', ['status', 'createdAt']); @Index('idx_export_jobs_expires_at', ['expiresAt']) |
| field-agents | field_agent_audit_logs | [FieldAgentAuditLogEntity:19](../../gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity.ts#L19) | @Index('idx_field_agent_audit_agent_created', ['fieldAgentId', 'createdAt']); @Index('idx_field_agent_audit_project_created', ['projectId', 'createdAt']) |
| field-agents | field_agents | [FieldAgentEntity:20](../../gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent.entity.ts#L20) | @Index('uq_field_agents_scope', ['id', 'organizationId'], { unique: true }); @Index('idx_field_agents_organization_status', ['organizationId', 'status']); @Index('idx_field_agents_user_id', ['userId']); @Index('idx_field_agents_name', ['name']); @Index('uq_field_agents_org_email', ['organizationId', 'email'], {   unique: true, }); @Index('uq_field_agents_org_document', ['organizationId', 'document'], {   unique: true, }); @Index('uq_field_agents_live_user', ['liveUserId'], { unique: true }) |
| field-agents | project_field_agents | [ProjectFieldAgentEntity:20](../../gai-backend/src/modules/field-agents/infrastructure/persistence/project-field-agent.entity.ts#L20) | @Index('idx_project_field_agents_project_status', ['projectId', 'status']); @Index('idx_project_field_agents_agent_status', ['fieldAgentId', 'status']); @Index('uq_project_field_agents_active_key', ['activeAssignmentKey'], {   unique: true, }) |
| field-coordination | field_templates | [FieldTemplate:27](../../gai-backend/src/modules/field-coordination/field.entity.ts#L27) | @Index('idx_field_templates_org', ['organizationId', 'archivedAt']) |
| field-coordination | field_template_versions | [FieldTemplateVersion:41](../../gai-backend/src/modules/field-coordination/field.entity.ts#L41) | @Index('uq_field_template_version', ['templateId', 'version'], { unique: true }) |
| field-coordination | field_checklists | [FieldChecklist:52](../../gai-backend/src/modules/field-coordination/field.entity.ts#L52) | @Index('idx_field_checklists_scope', ['organizationId', 'projectId']) |
| field-coordination | field_tasks | [FieldTask:82](../../gai-backend/src/modules/field-coordination/field.entity.ts#L82) | @Index('uq_field_task_stable', ['checklistId', 'stableId'], { unique: true }); @Index('idx_field_task_filter', [   'organizationId',   'projectId',   'checklistId',   'state',   'dueDate', ]) |
| field-coordination | field_audit_logs | [FieldAudit:150](../../gai-backend/src/modules/field-coordination/field.entity.ts#L150) | @Index('idx_field_audit_scope', [   'organizationId',   'projectId',   'checklistId',   'id', ]) |
| field-coordination | field_commands | [FieldCommand:169](../../gai-backend/src/modules/field-coordination/field.entity.ts#L169) | @Index('uq_field_command', ['organizationId', 'projectId', 'commandKey'], {   unique: true, }) |
| import-sessions | import_files | [ImportFileEntity:17](../../gai-backend/src/modules/import-sessions/infrastructure/persistence/import-file.entity.ts#L17) | @Index('idx_import_files_session_status', ['importSessionId', 'status']) |
| import-sessions | import_payload_errors | [ImportPayloadErrorEntity:14](../../gai-backend/src/modules/import-sessions/infrastructure/persistence/import-payload-error.entity.ts#L14) | @Index('idx_import_payload_errors_session', ['importSessionId', 'createdAt']); @Index('idx_import_payload_errors_payload', ['importPayloadId', 'createdAt']) |
| import-sessions | import_payloads | [ImportPayloadEntity:16](../../gai-backend/src/modules/import-sessions/infrastructure/persistence/import-payload.entity.ts#L16) | @Index(   'idx_import_payloads_session_number',   ['importSessionId', 'payloadNumber'],   { unique: true }, ); @Index(   'idx_import_payloads_session_key',   ['importSessionId', 'idempotencyKey'],   { unique: true }, ); @Index('idx_import_payloads_org_status', ['organizationId', 'status']) |
| import-sessions | import_session_audit_logs | [ImportSessionAuditLogEntity:15](../../gai-backend/src/modules/import-sessions/infrastructure/persistence/import-session-audit-log.entity.ts#L15) | @Index('idx_import_session_audit_project_created', ['projectId', 'createdAt']) |
| import-sessions | import_sessions | [ImportSessionEntity:19](../../gai-backend/src/modules/import-sessions/infrastructure/persistence/import-session.entity.ts#L19) | @Index('idx_import_sessions_org_project_status', [   'organizationId',   'projectId',   'status', ]); @Index('idx_import_sessions_project_created', ['projectId', 'createdAt']); @Index('idx_import_sessions_session_uuid', ['sessionUuid'], { unique: true }) |
| inventory-accounting-items | accounting_import_batches | [AccountingImportBatchEntity:16](../../gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/accounting-import-batch.entity.ts#L16) | @Index('idx_accounting_import_batches_project_status', ['projectId', 'status']); @Index('idx_accounting_import_batches_organization_project', [   'organizationId',   'projectId', ]) |
| inventory-accounting-items | inventory_accounting_item_audit_logs | [InventoryAccountingItemAuditLogEntity:13](../../gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item-audit-log.entity.ts#L13) | @Index('idx_inventory_accounting_item_audit_item_created', [   'inventoryAccountingItemId',   'createdAt', ]); @Index('idx_inventory_accounting_item_audit_project_created', [   'projectId',   'createdAt', ]) |
| inventory-accounting-items | inventory_accounting_items | [InventoryAccountingItemEntity:18](../../gai-backend/src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity.ts#L18) | @Index('idx_inventory_accounting_items_project_status', ['projectId', 'status']); @Index('idx_inventory_accounting_items_organization_project', [   'organizationId',   'projectId', ]); @Index('idx_inventory_accounting_items_plate', ['plate']); @Index('idx_inventory_accounting_items_base_code', ['baseCode']); @Index('idx_inventory_accounting_items_investor_code', ['investorCode']) |
| inventory-item-images | inventory_item_image_audit_logs | [InventoryItemImageAuditLogEntity:13](../../gai-backend/src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image-audit-log.entity.ts#L13) | @Index('idx_inventory_item_image_audit_image_created', [   'inventoryItemImageId',   'createdAt', ]); @Index('idx_inventory_item_image_audit_item_created', [   'inventoryItemId',   'createdAt', ]) |
| inventory-item-images | inventory_item_images | [InventoryItemImageEntity:16](../../gai-backend/src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image.entity.ts#L16) | @Index('idx_inventory_item_images_item_status', ['inventoryItemId', 'status']); @Index('idx_inventory_item_images_organization_item', [   'organizationId',   'inventoryItemId', ]); @Index('idx_inventory_item_images_uploaded_by_id', ['uploadedById']) |
| inventory-items | inventory_item_audit_logs | [InventoryItemAuditLogEntity:13](../../gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item-audit-log.entity.ts#L13) | @Index('idx_inventory_item_audit_item_created', [   'inventoryItemId',   'createdAt', ]); @Index('idx_inventory_item_audit_project_created', ['projectId', 'createdAt']) |
| inventory-items | inventory_items | [InventoryItemEntity:17](../../gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item.entity.ts#L17) | @Index('idx_inventory_items_project_status', ['projectId', 'status']); @Index('idx_inventory_items_organization_project', [   'organizationId',   'projectId', ]); @Index('idx_inventory_items_old_plate', ['oldPlate']); @Index('idx_inventory_items_new_plate', ['newPlate']); @Index('idx_inventory_items_external_item_id', ['externalItemId']) |
| inventory-operations | inventory_sessions | [InventorySessionEntity:27](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L27) | @Index('idx_inventory_sessions_org_project', ['organizationId', 'projectId']); @Index('idx_inventory_sessions_project_status', ['projectId', 'status']) |
| inventory-operations | inventory_rounds | [InventoryRoundEntity:74](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L74) | @Index('uq_inventory_rounds_session_number', ['sessionId', 'roundNumber'], {   unique: true, }); @Index('idx_inventory_rounds_target', ['inventoryItemId', 'status']) |
| inventory-operations | inventory_observations | [InventoryObservationEntity:108](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L108) | @Index(   'uq_inventory_observations_org_idempotency',   ['organizationId', 'idempotencyKey'],   { unique: true }, ); @Index('uq_inventory_observations_round_item', ['roundId', 'inventoryItemId'], {   unique: true, }); @Index('idx_inventory_observations_item_captured', [   'inventoryItemId',   'capturedAt', ]) |
| inventory-operations | inventory_observation_evidence | [InventoryObservationEvidenceEntity:175](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L175) | @Index('idx_inventory_observation_evidence_observation_created', [   'observationId',   'createdAt', ]); @Index('idx_inventory_observation_evidence_scope', [   'organizationId',   'projectId',   'sessionId',   'roundId', ]); @Index('uq_inventory_observation_evidence_storage_key', ['storageKey'], {   unique: true, }) |
| inventory-operations | inventory_plate_history | [InventoryPlateHistoryEntity:235](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L235) | @Index('idx_inventory_plate_history_item_created', [   'inventoryItemId',   'createdAt', ]) |
| inventory-operations | inventory_reconciliations | [InventoryReconciliationEntity:270](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L270) | @Index('idx_inventory_reconciliations_session_run', ['sessionId', 'runNumber']); @Index('idx_inventory_reconciliations_item_status', [   'inventoryItemId',   'status', ]) |
| inventory-operations | inventory_consolidations | [InventoryConsolidationEntity:312](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L312) | @Index('uq_inventory_consolidations_reconciliation', ['reconciliationId'], {   unique: true, }) |
| inventory-operations | asset_valuations | [AssetValuationEntity:336](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L336) | @Index(   'uq_asset_valuation_batch_item',   ['batchOperationId', 'inventoryItemId'],   { unique: true }, ); @Index('idx_asset_valuations_item_date', ['inventoryItemId', 'valuationDate']) |
| inventory-operations | inventory_operation_audit_logs | [InventoryOperationAuditLogEntity:382](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity.ts#L382) | @Index('idx_inventory_operation_audit_project_created', [   'projectId',   'createdAt', ]) |
| inventory-operations | asset_valuation_batches | [ValuationBatch:14](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/valuation-batch.entity.ts#L14) | @Index(   'uq_valuation_batch_command',   ['organizationId', 'projectId', 'commandKey'],   { unique: true }, ); @Index('idx_valuation_batches_project', ['organizationId', 'projectId', 'id']) |
| inventory-operations | asset_valuation_batch_rows | [ValuationBatchRow:58](../../gai-backend/src/modules/inventory-operations/infrastructure/persistence/valuation-batch.entity.ts#L58) | @Index('uq_valuation_batch_item', ['batchId', 'inventoryItemId'], {   unique: true, }) |
| inventory-pending-issues | inventory_pending_issue_audit_logs | [InventoryPendingIssueAuditLogEntity:13](../../gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue-audit-log.entity.ts#L13) | @Index('idx_inventory_pending_issue_audit_issue_created', [   'inventoryPendingIssueId',   'createdAt', ]); @Index('idx_inventory_pending_issue_audit_project_created', [   'projectId',   'createdAt', ]) |
| inventory-pending-issues | inventory_pending_issues | [InventoryPendingIssueEntity:19](../../gai-backend/src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity.ts#L19) | @Index('idx_inventory_pending_issues_project_status', ['projectId', 'status']); @Index('idx_inventory_pending_issues_project_type', ['projectId', 'type']); @Index('idx_inventory_pending_issues_inventory_item', ['inventoryItemId']); @Index('idx_inventory_pending_issues_accounting_item', ['accountingItemId']) |
| managerial-dre | dre_accounts | [DreAccount:64](../../gai-backend/src/modules/managerial-dre/dre.entity.ts#L64) | @Index('uq_dre_account_code', ['organizationId', 'code'], { unique: true }) |
| managerial-dre | dre_account_versions | [DreAccountVersion:77](../../gai-backend/src/modules/managerial-dre/dre.entity.ts#L77) | @Index('uq_dre_account_revision', ['accountId', 'revision'], { unique: true }) |
| managerial-dre | dre_entries | [DreEntry:94](../../gai-backend/src/modules/managerial-dre/dre.entity.ts#L94) | @Index('uq_dre_economic_key', ['organizationId', 'economicKey'], {   unique: true, }); @Index('uq_dre_source', ['organizationId', 'sourceKey'], { unique: true }) |
| managerial-dre | dre_entry_versions | [DreEntryVersion:115](../../gai-backend/src/modules/managerial-dre/dre.entity.ts#L115) | @Index('uq_dre_entry_revision', ['entryId', 'revision'], { unique: true }) |
| managerial-dre | dre_periods | [DrePeriod:142](../../gai-backend/src/modules/managerial-dre/dre.entity.ts#L142) | @Index('uq_dre_period', ['organizationId', 'month'], { unique: true }) |
| managerial-dre | dre_commands | [DreCommand:156](../../gai-backend/src/modules/managerial-dre/dre.entity.ts#L156) | @Index('uq_dre_command', ['organizationId', 'commandKey'], { unique: true }) |
| organizations | organization_audit_logs | [OrganizationAuditLogEntity:14](../../gai-backend/src/modules/organizations/infrastructure/persistence/organization-audit-log.entity.ts#L14) | @Index('idx_org_audit_org_created', ['organizationId', 'createdAt']) |
| organizations | organizations | [OrganizationEntity:12](../../gai-backend/src/modules/organizations/infrastructure/persistence/organization.entity.ts#L12) | @Index('idx_organizations_status', ['status']); @Index('idx_organizations_legal_name', ['legalName']) |
| payments-expenses | expense_attachments | [ExpenseAttachmentEntity:16](../../gai-backend/src/modules/payments-expenses/infrastructure/persistence/expense-attachment.entity.ts#L16) | @Index('idx_expense_attachments_expense_status', ['expenseId', 'status']) |
| payments-expenses | expenses | [ExpenseEntity:18](../../gai-backend/src/modules/payments-expenses/infrastructure/persistence/expense.entity.ts#L18) | @Index('idx_expenses_project_status', ['projectId', 'status']); @Index('idx_expenses_field_agent', ['fieldAgentId']) |
| payments-expenses | field_agent_payments | [FieldAgentPaymentEntity:18](../../gai-backend/src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity.ts#L18) | @Index('idx_field_agent_payments_project_status', ['projectId', 'status']); @Index('idx_field_agent_payments_field_agent', ['fieldAgentId']) |
| payments-expenses | payment_expense_audit_logs | [PaymentExpenseAuditLogEntity:13](../../gai-backend/src/modules/payments-expenses/infrastructure/persistence/payment-expense-audit-log.entity.ts#L13) | @Index('idx_payment_expense_audit_project_created', ['projectId', 'createdAt']) |
| project-preparation | preparation_templates | [PreparationTemplateEntity:30](../../gai-backend/src/modules/project-preparation/preparation.entity.ts#L30) | @Index('idx_preparation_templates_org_kind', ['organizationId', 'kind']) |
| project-preparation | preparation_template_versions | [PreparationTemplateVersionEntity:47](../../gai-backend/src/modules/project-preparation/preparation.entity.ts#L47) | @Index('uq_preparation_template_version', ['templateId', 'version'], {   unique: true, }) |
| project-preparation | project_preparations | [ProjectPreparationEntity:59](../../gai-backend/src/modules/project-preparation/preparation.entity.ts#L59) | @Index('idx_project_preparations_scope', [   'organizationId',   'projectId',   'kind', ]) |
| project-preparation | preparation_answers | [PreparationAnswerEntity:110](../../gai-backend/src/modules/project-preparation/preparation.entity.ts#L110) | @Index('uq_preparation_answer_question', ['preparationId', 'questionId'], {   unique: true, }); @Index('idx_preparation_answers_scope', ['organizationId', 'projectId']) |
| project-preparation | preparation_audit_logs | [PreparationAuditEntity:149](../../gai-backend/src/modules/project-preparation/preparation.entity.ts#L149) | @Index('idx_preparation_audit_scope', [   'organizationId',   'projectId',   'preparationId',   'id', ]) |
| projects | project_audit_logs | [ProjectAuditLogEntity:13](../../gai-backend/src/modules/projects/infrastructure/persistence/project-audit-log.entity.ts#L13) | @Index('idx_project_audit_project_created', ['projectId', 'createdAt']) |
| projects | projects | [ProjectEntity:19](../../gai-backend/src/modules/projects/infrastructure/persistence/project.entity.ts#L19) | @Index('uq_field_project_scope', ['id', 'organizationId'], { unique: true }); @Index('uq_projects_organization_code', ['organizationId', 'code'], {   unique: true, }); @Index('idx_projects_organization_type', ['organizationId', 'projectType']); @Index('idx_projects_responsible', ['responsibleUserId']); @Index('idx_projects_planning_responsible', ['planningResponsibleUserId']); @Index('idx_projects_organization_status', ['organizationId', 'status']); @Index('idx_projects_name', ['name']) |
| receivables | receivables | [ReceivableEntity:24](../../gai-backend/src/modules/receivables/receivable.entity.ts#L24) | @Index('uq_receivable_source', ['organizationId', 'sourceKey'], {   unique: true, }); @Index('idx_receivable_cohort', ['organizationId', 'companyId', 'projectId']) |
| receivables | receivable_installments | [ReceivableInstallmentEntity:59](../../gai-backend/src/modules/receivables/receivable.entity.ts#L59) | @Index('uq_receivable_position', ['receivableId', 'position'], { unique: true }); @Index('idx_receivable_due', ['organizationId', 'dueOn']) |
| receivables | receivable_events | [ReceivableEventEntity:77](../../gai-backend/src/modules/receivables/receivable.entity.ts#L77) | @Index('uq_finance_command', ['organizationId', 'commandKey'], { unique: true }); @Index('uq_receivable_revision', ['receivableId', 'revision'], { unique: true }); @Index('uq_receipt_reversal', ['reversesId'], { unique: true }) |
| technical-reports | technical_report_templates | [ReportTemplate:106](../../gai-backend/src/modules/technical-reports/report.entity.ts#L106) | @Index('idx_technical_templates_org', ['organizationId', 'id']) |
| technical-reports | technical_report_template_versions | [ReportTemplateVersion:119](../../gai-backend/src/modules/technical-reports/report.entity.ts#L119) | @Index('uq_technical_template_revision', ['templateId', 'revision'], {   unique: true, }) |
| technical-reports | technical_report_responsibles | [ReportResponsible:134](../../gai-backend/src/modules/technical-reports/report.entity.ts#L134) | @Index('uq_technical_responsible_user', ['organizationId', 'userId'], {   unique: true, }) |
| technical-reports | technical_reports | [TechnicalReport:142](../../gai-backend/src/modules/technical-reports/report.entity.ts#L142) | @Index('idx_technical_reports_project', ['organizationId', 'projectId', 'id']) |
| technical-reports | technical_report_versions | [TechnicalReportVersion:156](../../gai-backend/src/modules/technical-reports/report.entity.ts#L156) | @Index('uq_technical_report_revision', ['reportId', 'revision'], {   unique: true, }) |
| technical-reports | technical_report_commands | [ReportCommand:173](../../gai-backend/src/modules/technical-reports/report.entity.ts#L173) | @Index('uq_technical_report_command', ['organizationId', 'commandKey'], {   unique: true, }) |
| users | permissions | [PermissionEntity:10](../../gai-backend/src/modules/users/infrastructure/persistence/permission.entity.ts#L10) |  |
| users | role_audit_logs | [RoleAuditLogEntity:13](../../gai-backend/src/modules/users/infrastructure/persistence/role-audit-log.entity.ts#L13) | @Index('idx_role_audit_role_created', ['roleId', 'createdAt']) |
| users | role_permissions | [RolePermissionEntity:4](../../gai-backend/src/modules/users/infrastructure/persistence/role-permission.entity.ts#L4) |  |
| users | roles | [RoleEntity:15](../../gai-backend/src/modules/users/infrastructure/persistence/role.entity.ts#L15) | @Index('uk_roles_key', ['key'], { unique: true }); @Index('uk_roles_org_name', ['organizationId', 'name'], { unique: true }); @Index('idx_roles_organization_id', ['organizationId']); @Index('idx_roles_type', ['type']) |
| users | user_audit_logs | [UserAuditLogEntity:14](../../gai-backend/src/modules/users/infrastructure/persistence/user-audit-log.entity.ts#L14) | @Index('idx_user_audit_user_created', ['userId', 'createdAt']) |
| users | user_role_assignments | [UserRoleAssignmentEntity:13](../../gai-backend/src/modules/users/infrastructure/persistence/user-role-assignment.entity.ts#L13) | @Index('idx_user_role_assignments_user_id', ['userId']); @Index('idx_user_role_assignments_role_id', ['roleId']) |

## Colunas, tipos e decorators reais

### assisted_reconciliation_runs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| config | MatchConfig | @Column({ type: 'json' }) |
| sourceHash | string | @Column({ name: 'source_hash', length: 64 }) |
| afterItemId | number | @Column({ name: 'after_item_id', ...FOREIGN_KEY_COLUMN }) |
| nextItemId | number \| null | @Column({ name: 'next_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| summary | Record<string, number> | @Column({ type: 'json' }) |
| createdById | number | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN }) |

### assisted_reconciliation_candidates

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| runId | number | @Column({ name: 'run_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| accountingItemId | number \| null | @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| physical | MatchSource | @Column({ type: 'json' }) |
| accounting | MatchSource \| null | @Column({ type: 'json', nullable: true }) |
| evidence | MatchEvidence \| null | @Column({ type: 'json', nullable: true }) |
| warnings | string[] | @Column({ type: 'json' }) |
| status | string | @Column({ length: 20, default: 'pending' }) |
| revision | number | @Column({ type: 'int', default: 1 }) |

### assisted_reconciliation_decisions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| candidateId | number | @Column({ name: 'candidate_id', ...FOREIGN_KEY_COLUMN }) |
| commandKey | string | @Column({ name: 'command_key', length: 80 }) |
| fingerprint | string | @Column({ length: 64 }) |
| action | string | @Column({ length: 20 }) |
| reason | string | @Column({ type: 'text' }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| sourceHash | string | @Column({ name: 'source_hash', length: 64 }) |
| reconciliationId | number \| null | @Column({ name: 'reconciliation_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| result | {
    id: number;
    status: string;
    revision: number;
    reconciliationId: number \| null;
  } | @Column({ type: 'json' }) |

### assisted_reconciliation_claims

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| candidateId | number | @Column({ name: 'candidate_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| accountingItemId | number | @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN }) |

### auth_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| userId | number \| null | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| operation | AuthAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| ipAddress | string \| null | @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true }) |
| result | AuthAuditResult | @Column({ type: 'varchar', length: 20 }) |
| metadata | Record<string, unknown> \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### password_reset_tokens

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| tokenHash | string | @Column({ name: 'token_hash', type: 'varchar', length: 64 }) |
| purpose | 'PASSWORD_RESET' \| 'INVITATION' | @Column({ type: 'varchar', length: 24, default: 'PASSWORD_RESET' }) |
| expiresAt | Date | @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) |
| usedAt | Date \| null | @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### sessions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | string | @PrimaryColumn('varchar', { length: 36 }) |
| authVersion | number | @Column({ name: 'auth_version', type: 'int', default: 0 }) |
| userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number \| null | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| expiresAt | Date | @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) |
| revokedAt | Date \| null | @Column({     name: 'revoked_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| lastActivityAt | Date | @Column({ name: 'last_activity_at', type: 'datetime', precision: 3 }) |

### users

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| fullName | string \| null | @Column({ name: 'full_name', type: 'varchar', length: 160, nullable: true }) |
| phone | string \| null | @Column({ type: 'varchar', length: 30, nullable: true }) |
| jobTitle | string \| null | @Column({ name: 'job_title', type: 'varchar', length: 120, nullable: true }) |
| lastLoginAt | Date \| null | @Column({     name: 'last_login_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| temporaryPasswordExpiresAt | Date \| null | @Column({     name: 'temporary_password_expires_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| mustChangePassword | boolean | @Column({ name: 'must_change_password', type: 'boolean', default: false }) |
| authVersion | number | @Column({ name: 'auth_version', type: 'int', default: 0 }) |
| organizationId | number \| null | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| login | string | @Column({ type: 'varchar', length: 100, unique: true }) |
| email | string | @Column({ type: 'varchar', length: 255, unique: true }) |
| passwordHash | string | @Column({ name: 'password_hash', type: 'varchar', length: 255 }) |
| status | UserStatus | @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE }) |
| failedLoginAttempts | number | @Column({ name: 'failed_login_attempts', type: 'int', default: 0 }) |
| lockedUntil | Date \| null | @Column({     name: 'locked_until',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| passwordChangedAt | Date | @Column({ name: 'password_changed_at', type: 'datetime', precision: 3 }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### budget_pricing_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| name | string | @Column({ length: 100 }) |
| version | number | @Column({ type: 'int' }) |
| validFrom | string | @Column({     name: 'valid_from',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| validTo | string | @Column({     name: 'valid_to',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| values | PricingValuesDto | @Column({ type: 'json' }) |
| reason | string | @Column({ type: 'text' }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |

### budgets

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| number | string | @Column({ length: 100 }) |
| status | BudgetStatus | @Column({ type: 'varchar', length: 20 }) |
| revision | number | @Column({ type: 'int' }) |
| headVersionId | number \| null | @Column({ name: 'head_version_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| approvedVersionId | number \| null | @Column({     name: 'approved_version_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| createdAt | Date | @Column({ name: 'created_at', type: 'datetime', precision: 3 }) |

### budget_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| budgetId | number | @Column({ name: 'budget_id', ...FOREIGN_KEY_COLUMN }) |
| pricingId | number | @Column({ name: 'pricing_id', ...FOREIGN_KEY_COLUMN }) |
| version | number | @Column({ type: 'int' }) |
| kind | 'draft' \| 'scenario' | @Column({ type: 'varchar', length: 20 }) |
| name | string | @Column({ length: 120 }) |
| baseVersionId | number \| null | @Column({ name: 'base_version_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| snapshot | BudgetSnapshot | @Column({ type: 'json' }) |
| hash | string | @Column({ length: 64 }) |
| reason | string | @Column({ type: 'text' }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |

### budget_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| budgetId | number | @Column({ name: 'budget_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| operation | string | @Column({ length: 30 }) |
| details | Record<string, unknown> | @Column({ type: 'json' }) |
| reason | string | @Column({ type: 'text' }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |

### catalog_asset_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| catalogAssetId | number | @Column({ name: 'catalog_asset_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### catalog_assets

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| description | string | @Column({ type: 'varchar', length: 255 }) |
| descriptionNormalized | string | @Column({ name: 'description_normalized', type: 'varchar', length: 255 }) |
| category | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| status | CatalogAssetStatus | @Column({ type: 'varchar', length: 20, default: CatalogAssetStatus.ACTIVE }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### company_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| operation | CompanyAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | JsonRecord | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### company_unit_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| companyUnitId | number | @Column({ name: 'company_unit_id', ...FOREIGN_KEY_COLUMN }) |
| companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| operation | CompanyAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | JsonRecord | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### company_units

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| name | string | @Column({ type: 'varchar', length: 255 }) |
| code | string \| null | @Column({ type: 'varchar', length: 80, nullable: true }) |
| zipcode | string \| null | @Column({ type: 'varchar', length: 20, nullable: true }) |
| address | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| number | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| complement | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| district | string \| null | @Column({ type: 'varchar', length: 120, nullable: true }) |
| city | string \| null | @Column({ type: 'varchar', length: 120, nullable: true }) |
| state | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| country | string \| null | @Column({ type: 'varchar', length: 80, nullable: true, default: 'BR' }) |
| status | CompanyUnitStatus | @Column({ type: 'varchar', length: 20, default: CompanyUnitStatus.ACTIVE }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### companies

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| name | string | @Column({ type: 'varchar', length: 255 }) |
| corporateName | string \| null | @Column({     name: 'corporate_name',     type: 'varchar',     length: 255,     nullable: true,   }) |
| document | string \| null | @Column({ type: 'varchar', length: 20, nullable: true }) |
| stateRegistration | string \| null | @Column({     name: 'state_registration',     type: 'varchar',     length: 50,     nullable: true,   }) |
| municipalRegistration | string \| null | @Column({     name: 'municipal_registration',     type: 'varchar',     length: 50,     nullable: true,   }) |
| email | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| phone | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| zipcode | string \| null | @Column({ type: 'varchar', length: 20, nullable: true }) |
| address | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| number | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| complement | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| district | string \| null | @Column({ type: 'varchar', length: 120, nullable: true }) |
| city | string \| null | @Column({ type: 'varchar', length: 120, nullable: true }) |
| state | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| country | string \| null | @Column({ type: 'varchar', length: 80, nullable: true, default: 'BR' }) |
| status | CompanyStatus | @Column({ type: 'varchar', length: 20, default: CompanyStatus.ACTIVE }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### project_unit_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| companyUnitId | number | @Column({ name: 'company_unit_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| operation | CompanyAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | JsonRecord | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### project_units

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| companyUnitId | number | @Column({ name: 'company_unit_id', ...FOREIGN_KEY_COLUMN }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### project_contracts

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| number | string | @Column({ length: 100 }) |
| revision | number | @Column({ type: 'int' }) |
| data | ContractSnapshot | @Column({ type: 'json' }) |

### project_contract_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| contractId | number | @Column({ name: 'contract_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| data | ContractSnapshot | @Column({ type: 'json' }) |
| operation | string | @Column({ length: 20 }) |
| reason | string | @Column({ type: 'text' }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |

### project_contract_amendments

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| contractId | number | @Column({ name: 'contract_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| identifier | string | @Column({ length: 100 }) |
| datedOn | string | @Column({     name: 'dated_on',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| type | string | @Column({ length: 20 }) |
| valueDelta | string \| null | @Column({     name: 'value_delta',     type: 'decimal',     precision: 15,     scale: 2,     nullable: true,   }) |
| endsOn | string \| null | @Column({     name: 'ends_on',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| scope | string \| null | @Column({ type: 'text', nullable: true }) |
| reason | string | @Column({ type: 'text' }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |

### commercial_report_snapshots

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |
| payload | Record<string, unknown> | @Column({ type: 'json' }) |

### document_visual_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| data | VisualTemplate | @Column({ type: 'json' }) |
| hash | string | @Column({ length: 64 }) |

### document_artifacts

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| cacheKey | string | @Column({ name: 'cache_key', length: 64 }) |
| kind | DocumentKind | @Column({ type: 'varchar', length: 12 }) |
| sourceId | number | @Column({ name: 'source_id', ...FOREIGN_KEY_COLUMN }) |
| versionId | number | @Column({ name: 'version_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| format | DocumentFormat | @Column({ type: 'varchar', length: 8 }) |
| sourceHash | string | @Column({ name: 'source_hash', length: 64 }) |
| visualHash | string | @Column({ name: 'visual_hash', length: 64 }) |
| visualVersion | string | @Column({ name: 'visual_version', length: 80 }) |
| includeMemory | boolean | @Column({ name: 'include_memory', type: 'boolean' }) |
| status | string | @Column({ length: 120 }) |
| checksum | string | @Column({ length: 64 }) |
| sizeBytes | number | @Column({ name: 'size_bytes', type: 'int' }) |
| bytes | Buffer | @Column({     type:       process.env.NODE_ENV === 'test' &&       process.env.GAI_TEST_MYSQL_DISPOSABLE !== '1'         ? 'blob'         : 'mediumblob',     select: false,   }) |

### document_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| operation | string | @Column({ length: 30 }) |
| details | Record<string, unknown> | @Column({ type: 'json' }) |

### expense_accountabilities

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| fieldAgentId | number | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN }) |
| periodStart | Date | @Column({     name: 'period_start',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| periodEnd | Date | @Column({     name: 'period_end',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| status | ExpenseAccountabilityStatus | @Column({     type: 'varchar',     length: 20,     default: ExpenseAccountabilityStatus.OPEN,   }) |
| totalAmount | string | @Column({     name: 'total_amount',     type: 'decimal',     precision: 15,     scale: 2,     default: '0.00',   }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| responsibleById | number \| null | @Column({ name: 'responsible_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| closedById | number \| null | @Column({ name: 'closed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| closedAt | Date \| null | @Column({ name: 'closed_at', type: 'datetime', precision: 3, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### expense_accountability_items

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| accountabilityId | number | @Column({ name: 'accountability_id', ...FOREIGN_KEY_COLUMN }) |
| expenseId | number | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### expense_installments

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| expenseId | number | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) |
| installmentNumber | number | @Column({ name: 'installment_number', type: 'int', unsigned: true }) |
| installmentCount | number | @Column({ name: 'installment_count', type: 'int', unsigned: true }) |
| dueDate | string | @Column({     name: 'due_date',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| amount | string | @Column({ type: 'decimal', precision: 15, scale: 2 }) |
| origin | \| string
    \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### expense_accountability_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| accountabilityId | number \| null | @Column({ name: 'accountability_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| expenseId | number \| null | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| operation | string | @Column({ type: 'varchar', length: 60 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, unknown> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### export_job_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| exportJobId | number | @Column({ name: 'export_job_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| operation | ExportJobAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, unknown> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### export_jobs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| financePayload | FinanceWorkbook \| null | @Column({     name: 'finance_payload',     type: 'json',     nullable: true,     select: false,   }) |
| type | ExportJobType | @Column({ type: 'varchar', length: 60 }) |
| status | ExportJobStatus | @Column({ type: 'varchar', length: 20, default: ExportJobStatus.PENDING }) |
| fileName | string \| null | @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true }) |
| mimeType | string \| null | @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true }) |
| sizeBytes | number \| null | @Column({     name: 'size_bytes',     type: 'bigint',     unsigned: true,     nullable: true,   }) |
| fileContent | Buffer \| null | @Column({     name: 'file_content',     type: process.env.NODE_ENV === 'test' ? 'blob' : 'mediumblob',     nullable: true,     select: false,   }) |
| checksum | string \| null | @Column({ type: 'varchar', length: 64, nullable: true }) |
| requestedById | number \| null | @Column({ name: 'requested_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| retryOfId | number \| null | @Column({ name: 'retry_of_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| attemptCount | number | @Column({ name: 'attempt_count', type: 'int', unsigned: true, default: 1 }) |
| requestedAt | Date | @Column({ name: 'requested_at', type: 'datetime', precision: 3 }) |
| startedAt | Date \| null | @Column({     name: 'started_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| finishedAt | Date \| null | @Column({     name: 'finished_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| expiresAt | Date \| null | @Column({     name: 'expires_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| errorCode | string \| null | @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true }) |
| errorMessage | string \| null | @Column({ name: 'error_message', type: 'text', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### field_agent_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| fieldAgentId | number \| null | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| projectFieldAgentId | number \| null | @Column({     name: 'project_field_agent_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### field_agents

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| liveUserId | number \| null | @Column({     name: 'live_user_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,     select: false,     insert: false,     update: false,     generatedType: 'STORED',     asExpression: 'CASE WHEN deleted_at IS NULL THEN user_id ELSE NULL END',   }) |
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| userId | number \| null | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| name | string | @Column({ type: 'varchar', length: 255 }) |
| email | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| phone | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| document | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| status | FieldAgentStatus | @Column({ type: 'varchar', length: 20, default: FieldAgentStatus.ACTIVE }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### project_field_agents

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| fieldAgentId | number | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN }) |
| role | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| status | ProjectFieldAgentStatus | @Column({     type: 'varchar',     length: 20,     default: ProjectFieldAgentStatus.ACTIVE,   }) |
| activeAssignmentKey | string \| null | @Column({     name: 'active_assignment_key',     type: 'varchar',     length: 64,     nullable: true,     select: false,     insert: false,     update: false,     generatedType: 'STORED',     asExpression:       process.env.NODE_ENV === 'test' &&       process.env.GAI_TEST_MYSQL_DISPOSABLE !== '1'         ? "CASE WHEN status = 'active' THEN organization_id \|\| ':' \|\| project_id \|\| ':' \|\| field_agent_id ELSE NULL END"         : "CASE WHEN status = 'active' THEN CONCAT(organization_id, ':', project_id, ':', field_agent_id) ELSE NULL END",   }) |
| startDate | Date \| null | @Column({     name: 'start_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| endDate | Date \| null | @Column({     name: 'end_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### field_templates

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| name | string | @Column({ length: 200 }) |
| description | string \| null | @Column({ type: 'text', nullable: true }) |
| currentVersion | number | @Column({ name: 'current_version', type: 'int' }) |
| archivedAt | Date \| null | @Column({     name: 'archived_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### field_template_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| templateId | number | @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN }) |
| version | number | @Column({ type: 'int' }) |
| name | string | @Column({ length: 200 }) |
| description | string \| null | @Column({ type: 'text', nullable: true }) |
| definition | FieldDefinition | @Column({ type: 'json' }) |
| createdById | number | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN }) |

### field_checklists

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| templateVersionId | number | @Column({ name: 'template_version_id', ...FOREIGN_KEY_COLUMN }) |
| title | string | @Column({ length: 200 }) |
| snapshot | FieldDefinition & {
    name: string;
    version: number;
  } | @Column({ type: 'json' }) |
| status | \| 'open'
    \| 'completed'
    \| 'archived' | @Column({ length: 30, default: 'open' }) |
| revision | number | @Column({ type: 'int', default: 1 }) |
| createdById | number | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN }) |
| completedById | number \| null | @Column({ name: 'completed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| completedAt | Date \| null | @Column({     name: 'completed_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### field_tasks

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| checklistId | number | @Column({ name: 'checklist_id', ...FOREIGN_KEY_COLUMN }) |
| stableId | string | @Column({ name: 'stable_id', length: 80 }) |
| groupId | string | @Column({ name: 'group_id', length: 80 }) |
| title | string | @Column({ length: 200 }) |
| definition | FieldTaskDefinition | @Column({ type: 'json' }) |
| position | number | @Column({ type: 'int' }) |
| required | boolean | @Column({ type: 'boolean' }) |
| applicable | boolean | @Column({ type: 'boolean', default: true }) |
| state | TaskState | @Column({ type: 'varchar', length: 30, default: 'pending' }) |
| priority | Priority | @Column({ type: 'varchar', length: 20, default: 'normal' }) |
| responsibleUserId | number \| null | @Column({     name: 'responsible_user_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| fieldAgentId | number \| null | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| startDate | string \| null | @Column({     name: 'start_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| dueDate | string \| null | @Column({     name: 'due_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| completedAt | Date \| null | @Column({     name: 'completed_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| reason | string \| null | @Column({ type: 'text', nullable: true }) |
| linkedIssueId | number \| null | @Column({ name: 'linked_issue_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| approvedById | number \| null | @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| approvedAt | Date \| null | @Column({     name: 'approved_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### field_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| checklistId | number \| null | @Column({ name: 'checklist_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| templateId | number \| null | @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| performedById | number | @Column({ name: 'performed_by_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ length: 60 }) |
| changes | object | @Column({ type: 'json' }) |

### field_commands

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| commandKey | string | @Column({ name: 'command_key', length: 80 }) |
| fingerprint | string | @Column({ length: 64 }) |
| result | object \| null | @Column({ type: 'json', nullable: true }) |

### import_files

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| importSessionId | number | @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN }) |
| importPayloadId | number \| null | @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| type | ImportFileType | @Column({ type: 'varchar', length: 30 }) |
| storageProvider | string | @Column({ name: 'storage_provider', type: 'varchar', length: 50 }) |
| bucket | string | @Column({ type: 'varchar', length: 255 }) |
| path | string | @Column({ type: 'varchar', length: 500 }) |
| originalName | string | @Column({ name: 'original_name', type: 'varchar', length: 255 }) |
| mimeType | string | @Column({ name: 'mime_type', type: 'varchar', length: 100 }) |
| sizeBytes | number | @Column({ name: 'size_bytes', type: 'bigint', unsigned: true }) |
| checksum | string \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| status | ImportFileStatus | @Column({     type: 'varchar',     length: 20,     default: ImportFileStatus.PENDING_UPLOAD,   }) |
| uploadedById | number \| null | @Column({ name: 'uploaded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### import_payload_errors

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| importSessionId | number | @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN }) |
| importPayloadId | number | @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN }) |
| rowNumber | number \| null | @Column({ name: 'row_number', type: 'int', unsigned: true, nullable: true }) |
| itemReference | string \| null | @Column({     name: 'item_reference',     type: 'varchar',     length: 150,     nullable: true,   }) |
| errorCode | string | @Column({ name: 'error_code', type: 'varchar', length: 80 }) |
| errorMessage | string | @Column({ name: 'error_message', type: 'text' }) |
| rawData | JsonRecord \| null | @Column({ name: 'raw_data', type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### import_payloads

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| importSessionId | number | @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN }) |
| payloadNumber | number | @Column({ name: 'payload_number', type: 'int', unsigned: true }) |
| idempotencyKey | string | @Column({ name: 'idempotency_key', type: 'varchar', length: 128 }) |
| checksum | string \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| status | ImportPayloadStatus | @Column({     type: 'varchar',     length: 20,     default: ImportPayloadStatus.RECEIVED,   }) |
| itemsCount | number | @Column({ name: 'items_count', type: 'int', unsigned: true, default: 0 }) |
| imagesCount | number | @Column({ name: 'images_count', type: 'int', unsigned: true, default: 0 }) |
| createdCount | number | @Column({ name: 'created_count', type: 'int', unsigned: true, default: 0 }) |
| updatedCount | number | @Column({ name: 'updated_count', type: 'int', unsigned: true, default: 0 }) |
| deletedCount | number | @Column({ name: 'deleted_count', type: 'int', unsigned: true, default: 0 }) |
| failedCount | number | @Column({ name: 'failed_count', type: 'int', unsigned: true, default: 0 }) |
| rawPayloadPath | string \| null | @Column({     name: 'raw_payload_path',     type: 'varchar',     length: 500,     nullable: true,   }) |
| receivedAt | Date | @Column({ name: 'received_at', type: 'datetime', precision: 3 }) |
| processedAt | Date \| null | @Column({     name: 'processed_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| errorMessage | string \| null | @Column({ name: 'error_message', type: 'text', nullable: true }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| payload | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### import_session_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| importSessionId | number \| null | @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| importPayloadId | number \| null | @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| importFileId | number \| null | @Column({ name: 'import_file_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| operation | ImportOperation | @Column({ type: 'varchar', length: 60 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | JsonRecord | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### import_sessions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| type | ImportSessionType | @Column({ type: 'varchar', length: 40 }) |
| source | ImportSessionSource | @Column({ type: 'varchar', length: 30 }) |
| status | ImportSessionStatus | @Column({ type: 'varchar', length: 20, default: ImportSessionStatus.OPEN }) |
| sessionUuid | string | @Column({ name: 'session_uuid', type: 'varchar', length: 64 }) |
| expectedPayloads | number \| null | @Column({     name: 'expected_payloads',     type: 'int',     unsigned: true,     nullable: true,   }) |
| receivedPayloads | number | @Column({     name: 'received_payloads',     type: 'int',     unsigned: true,     default: 0,   }) |
| processedPayloads | number | @Column({     name: 'processed_payloads',     type: 'int',     unsigned: true,     default: 0,   }) |
| failedPayloads | number | @Column({ name: 'failed_payloads', type: 'int', unsigned: true, default: 0 }) |
| totalItems | number | @Column({ name: 'total_items', type: 'int', unsigned: true, default: 0 }) |
| totalImages | number | @Column({ name: 'total_images', type: 'int', unsigned: true, default: 0 }) |
| totalCreated | number | @Column({ name: 'total_created', type: 'int', unsigned: true, default: 0 }) |
| totalUpdated | number | @Column({ name: 'total_updated', type: 'int', unsigned: true, default: 0 }) |
| totalDeleted | number | @Column({ name: 'total_deleted', type: 'int', unsigned: true, default: 0 }) |
| totalFailed | number | @Column({ name: 'total_failed', type: 'int', unsigned: true, default: 0 }) |
| rawBackupPath | string \| null | @Column({     name: 'raw_backup_path',     type: 'varchar',     length: 500,     nullable: true,   }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| startedAt | Date \| null | @Column({     name: 'started_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| finishedAt | Date \| null | @Column({     name: 'finished_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| expiresAt | Date \| null | @Column({     name: 'expires_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| errorMessage | string \| null | @Column({ name: 'error_message', type: 'text', nullable: true }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### accounting_import_batches

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| originalFileName | string | @Column({ name: 'original_file_name', type: 'varchar', length: 255 }) |
| storageProvider | string \| null | @Column({     name: 'storage_provider',     type: 'varchar',     length: 50,     nullable: true,   }) |
| bucket | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| path | string \| null | @Column({ type: 'varchar', length: 500, nullable: true }) |
| status | AccountingImportBatchStatus | @Column({     type: 'varchar',     length: 20,     default: AccountingImportBatchStatus.PENDING,   }) |
| totalRows | number | @Column({ name: 'total_rows', type: 'int', unsigned: true, default: 0 }) |
| processedRows | number | @Column({ name: 'processed_rows', type: 'int', unsigned: true, default: 0 }) |
| successRows | number | @Column({ name: 'success_rows', type: 'int', unsigned: true, default: 0 }) |
| failedRows | number | @Column({ name: 'failed_rows', type: 'int', unsigned: true, default: 0 }) |
| errorReportPath | string \| null | @Column({     name: 'error_report_path',     type: 'varchar',     length: 500,     nullable: true,   }) |
| importedById | number \| null | @Column({ name: 'imported_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| startedAt | Date \| null | @Column({     name: 'started_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| finishedAt | Date \| null | @Column({     name: 'finished_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### inventory_accounting_item_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| inventoryAccountingItemId | number | @Column({ name: 'inventory_accounting_item_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### inventory_accounting_items

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| serialNumber | string \| null | @Column({     name: 'serial_number',     type: 'varchar',     length: 100,     nullable: true,   }) |
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| plate | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| description | string \| null | @Column({ type: 'text', nullable: true }) |
| accountingAccountDescription | string \| null | @Column({     name: 'accounting_account_description',     type: 'text',     nullable: true,   }) |
| location | string \| null | @Column({ type: 'text', nullable: true }) |
| acquisitionDate | Date \| null | @Column({     name: 'acquisition_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| acquisitionValue | string \| null | @Column({     name: 'acquisition_value',     type: 'decimal',     precision: 15,     scale: 2,     nullable: true,   }) |
| baseCode | string \| null | @Column({ name: 'base_code', type: 'varchar', length: 100, nullable: true }) |
| status | InventoryAccountingItemStatus | @Column({     type: 'varchar',     length: 20,     default: InventoryAccountingItemStatus.PENDING,   }) |
| investorCode | string \| null | @Column({     name: 'investor_code',     type: 'varchar',     length: 100,     nullable: true,   }) |
| note1 | string \| null | @Column({ name: 'note_1', type: 'text', nullable: true }) |
| note2 | string \| null | @Column({ name: 'note_2', type: 'text', nullable: true }) |
| newInventoryPlate | string \| null | @Column({     name: 'new_inventory_plate',     type: 'varchar',     length: 100,     nullable: true,   }) |
| inventoryDescription | string \| null | @Column({ name: 'inventory_description', type: 'text', nullable: true }) |
| inventoryLocation | string \| null | @Column({ name: 'inventory_location', type: 'text', nullable: true }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| importedById | number \| null | @Column({ name: 'imported_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| importBatchId | number \| null | @Column({ name: 'import_batch_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### inventory_item_image_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| inventoryItemImageId | number | @Column({ name: 'inventory_item_image_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### inventory_item_images

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| storageProvider | string | @Column({ name: 'storage_provider', type: 'varchar', length: 30 }) |
| bucket | string | @Column({ type: 'varchar', length: 255 }) |
| path | string | @Column({ type: 'varchar', length: 1024 }) |
| originalName | string | @Column({ name: 'original_name', type: 'varchar', length: 255 }) |
| mimeType | string | @Column({ name: 'mime_type', type: 'varchar', length: 100 }) |
| sizeBytes | number | @Column({ name: 'size_bytes', ...FOREIGN_KEY_COLUMN }) |
| checksum | string \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| status | InventoryItemImageStatus | @Column({     type: 'varchar',     length: 30,     default: InventoryItemImageStatus.PENDING_UPLOAD,   }) |
| uploadedById | number \| null | @Column({ name: 'uploaded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### inventory_item_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### inventory_items

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| externalItemId | string \| null | @Column({     name: 'external_item_id',     type: 'varchar',     length: 100,     nullable: true,   }) |
| sequence | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| oldPlate | string \| null | @Column({ name: 'old_plate', type: 'varchar', length: 100, nullable: true }) |
| newPlate | string \| null | @Column({ name: 'new_plate', type: 'varchar', length: 100, nullable: true }) |
| unitText | string \| null | @Column({ name: 'unit_text', type: 'varchar', length: 255, nullable: true }) |
| addressText | string \| null | @Column({ name: 'address_text', type: 'text', nullable: true }) |
| locationText | string \| null | @Column({ name: 'location_text', type: 'text', nullable: true }) |
| description | string \| null | @Column({ type: 'text', nullable: true }) |
| brand | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| model | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| serialNumber | string \| null | @Column({     name: 'serial_number',     type: 'varchar',     length: 100,     nullable: true,   }) |
| capacity | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| year | number \| null | @Column({ type: 'int', nullable: true }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| source | string \| null | @Column({ type: 'varchar', length: 50, nullable: true }) |
| usedValue | string \| null | @Column({     name: 'used_value',     type: 'decimal',     precision: 15,     scale: 2,     nullable: true,   }) |
| newValue | string \| null | @Column({     name: 'new_value',     type: 'decimal',     precision: 15,     scale: 2,     nullable: true,   }) |
| status | InventoryItemStatus | @Column({ type: 'varchar', length: 20, default: InventoryItemStatus.PENDING }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### inventory_sessions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| name | string | @Column({ type: 'varchar', length: 255 }) |
| status | InventorySessionStatus | @Column({     type: 'varchar',     length: 20,     default: InventorySessionStatus.DRAFT,   }) |
| startedAt | Date \| null | @Column({     name: 'started_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| finishedAt | Date \| null | @Column({     name: 'finished_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| cancelledAt | Date \| null | @Column({     name: 'cancelled_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| cancellationReason | string \| null | @Column({ name: 'cancellation_reason', type: 'text', nullable: true }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| metadata | JsonObject \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### inventory_rounds

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| roundNumber | number | @Column({ name: 'round_number', type: 'int', unsigned: true }) |
| kind | InventoryRoundKind | @Column({ type: 'varchar', length: 20 }) |
| inventoryItemId | number \| null | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| reason | string \| null | @Column({ type: 'text', nullable: true }) |
| status | InventoryRoundStatus | @Column({ type: 'varchar', length: 20, default: InventoryRoundStatus.ACTIVE }) |
| requestedById | number \| null | @Column({ name: 'requested_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| startedAt | Date | @Column({ name: 'started_at', type: 'datetime', precision: 3 }) |
| finishedAt | Date \| null | @Column({     name: 'finished_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### inventory_observations

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| roundId | number | @Column({ name: 'round_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| fieldAgentId | number | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN }) |
| priorObservationId | number \| null | @Column({     name: 'prior_observation_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| idempotencyKey | string \| null | @Column({     name: 'idempotency_key',     type: 'varchar',     length: 100,     nullable: true,   }) |
| result | InventoryObservationResult | @Column({ type: 'varchar', length: 30 }) |
| observedPlate | string \| null | @Column({     name: 'observed_plate',     type: 'varchar',     length: 100,     nullable: true,   }) |
| observedSerialNumber | string \| null | @Column({     name: 'observed_serial_number',     type: 'varchar',     length: 100,     nullable: true,   }) |
| unitText | string \| null | @Column({ name: 'unit_text', type: 'varchar', length: 255, nullable: true }) |
| sectorText | string \| null | @Column({ name: 'sector_text', type: 'varchar', length: 255, nullable: true }) |
| locationText | string \| null | @Column({ name: 'location_text', type: 'text', nullable: true }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| capturedAt | Date | @Column({ name: 'captured_at', type: 'datetime', precision: 3 }) |
| receivedAt | Date | @Column({ name: 'received_at', type: 'datetime', precision: 3 }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |

### inventory_observation_evidence

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| roundId | number | @Column({ name: 'round_id', ...FOREIGN_KEY_COLUMN }) |
| observationId | number | @Column({ name: 'observation_id', ...FOREIGN_KEY_COLUMN }) |
| storageProvider | string | @Column({ name: 'storage_provider', type: 'varchar', length: 30 }) |
| bucket | string | @Column({ type: 'varchar', length: 255 }) |
| storageKey | string | @Column({     name: 'storage_key',     type: 'varchar',     length: 1024,   }) |
| originalName | string | @Column({ name: 'original_name', type: 'varchar', length: 255 }) |
| mimeType | string | @Column({ name: 'mime_type', type: 'varchar', length: 100 }) |
| sizeBytes | number | @Column({ name: 'size_bytes', ...FOREIGN_KEY_COLUMN }) |
| checksum | string \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| status | InventoryObservationEvidenceStatus | @Column({     type: 'varchar',     length: 30,     default: InventoryObservationEvidenceStatus.PENDING_UPLOAD,   }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| confirmedAt | Date \| null | @Column({     name: 'confirmed_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### inventory_plate_history

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| observationId | number \| null | @Column({ name: 'observation_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| previousPlate | string \| null | @Column({     name: 'previous_plate',     type: 'varchar',     length: 100,     nullable: true,   }) |
| observedPlate | string \| null | @Column({     name: 'observed_plate',     type: 'varchar',     length: 100,     nullable: true,   }) |
| source | PlateEvidenceSource | @Column({ type: 'varchar', length: 30 }) |
| recordedById | number \| null | @Column({ name: 'recorded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### inventory_reconciliations

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| runNumber | number | @Column({ name: 'run_number', type: 'int', unsigned: true }) |
| inventoryItemId | number \| null | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| observationId | number \| null | @Column({ name: 'observation_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| accountingItemId | number \| null | @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| status | ReconciliationStatus | @Column({ type: 'varchar', length: 30 }) |
| physicalPlate | string \| null | @Column({     name: 'physical_plate',     type: 'varchar',     length: 100,     nullable: true,   }) |
| accountingPlate | string \| null | @Column({     name: 'accounting_plate',     type: 'varchar',     length: 100,     nullable: true,   }) |
| evidence | JsonObject | @Column({ type: 'json' }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### inventory_consolidations

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| sessionId | number | @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) |
| reconciliationId | number | @Column({ name: 'reconciliation_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number \| null | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| decision | ConsolidationDecision | @Column({ type: 'varchar', length: 20 }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| evidenceSnapshot | JsonObject | @Column({ name: 'evidence_snapshot', type: 'json' }) |
| decidedById | number \| null | @Column({ name: 'decided_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| decidedAt | Date | @Column({ name: 'decided_at', type: 'datetime', precision: 3 }) |

### asset_valuations

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| batchOperationId | number \| null | @Column({ name: 'batch_operation_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| source | string | @Column({ type: 'varchar', length: 255 }) |
| newValue | string \| null | @Column({     name: 'new_value',     type: 'decimal',     precision: 15,     scale: 2,     nullable: true,   }) |
| usedValue | string \| null | @Column({     name: 'used_value',     type: 'decimal',     precision: 15,     scale: 2,     nullable: true,   }) |
| valuationDate | Date \| string | @Column({     name: 'valuation_date',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| responsibleById | number \| null | @Column({ name: 'responsible_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### inventory_operation_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| entity | string | @Column({ type: 'varchar', length: 50 }) |
| entityId | number \| null | @Column({ name: 'entity_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| operation | string | @Column({ type: 'varchar', length: 60 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | JsonObject | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### asset_valuation_batches

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| commandKey | string | @Column({ name: 'command_key', length: 80 }) |
| fingerprint | string | @Column({ length: 64 }) |
| previewHash | string | @Column({ name: 'preview_hash', length: 64 }) |
| request | PreviewValuationBatchDto | @Column({ type: 'json' }) |
| status | string | @Column({ length: 20, default: 'preview' }) |
| revision | number | @Column({ type: 'int', default: 1 }) |
| total | number | @Column({ type: 'int' }) |
| createdById | number | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN }) |
| confirmedById | number \| null | @Column({ name: 'confirmed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| confirmedAt | Date \| null | @Column({     name: 'confirmed_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| expiresAt | Date | @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) |

### asset_valuation_batch_rows

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| batchId | number | @Column({ name: 'batch_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN }) |
| snapshot | ValuationItemSnapshot | @Column({ type: 'json' }) |
| proposed | ReturnType<typeof valuationValues> | @Column({ type: 'json' }) |
| valuationId | number \| null | @Column({ name: 'valuation_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |

### inventory_pending_issue_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| inventoryPendingIssueId | number | @Column({ name: 'inventory_pending_issue_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### inventory_pending_issues

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| inventoryItemId | number \| null | @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| accountingItemId | number \| null | @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| type | InventoryPendingIssueType | @Column({ type: 'varchar', length: 60 }) |
| status | InventoryPendingIssueStatus | @Column({     type: 'varchar',     length: 20,     default: InventoryPendingIssueStatus.OPEN,   }) |
| severity | InventoryPendingIssueSeverity | @Column({     type: 'varchar',     length: 20,     default: InventoryPendingIssueSeverity.MEDIUM,   }) |
| title | string | @Column({ type: 'varchar', length: 255 }) |
| description | string \| null | @Column({ type: 'text', nullable: true }) |
| oldValue | JsonRecord \| null | @Column({ name: 'old_value', type: 'json', nullable: true }) |
| newValue | JsonRecord \| null | @Column({ name: 'new_value', type: 'json', nullable: true }) |
| resolutionNotes | string \| null | @Column({ name: 'resolution_notes', type: 'text', nullable: true }) |
| resolvedById | number \| null | @Column({ name: 'resolved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| resolvedAt | Date \| null | @Column({     name: 'resolved_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| ignoredById | number \| null | @Column({ name: 'ignored_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| ignoredAt | Date \| null | @Column({     name: 'ignored_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### dre_accounts

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| code | string | @Column({ type: 'varchar', length: 40 }) |
| revision | number | @Column({ type: 'int' }) |
| data | AccountData | @Column({ type: 'json' }) |

### dre_account_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| accountId | number | @Column({ name: 'account_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| data | AccountData | @Column({ type: 'json' }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |
| reason | string | @Column({ type: 'text' }) |

### dre_entries

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| economicKey | string | @Column({ name: 'economic_key', type: 'varchar', length: 180 }) |
| sourceKey | string \| null | @Column({ name: 'source_key', type: 'varchar', length: 100, nullable: true }) |
| revision | number | @Column({ type: 'int' }) |
| data | EntryData | @Column({ type: 'json' }) |

### dre_entry_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| entryId | number | @Column({ name: 'entry_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| data | EntryData | @Column({ type: 'json' }) |
| hash | string | @Column({ type: 'varchar', length: 64 }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |
| reason | string | @Column({ type: 'text' }) |

### dre_periods

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| month | string | @Column({ type: 'varchar', length: 7 }) |
| revision | number | @Column({ type: 'int' }) |
| closed | boolean | @Column({ type: 'boolean' }) |
| data | PeriodData | @Column({ type: 'json' }) |

### dre_commands

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| commandKey | string | @Column({ name: 'command_key', type: 'varchar', length: 100 }) |
| hash | string | @Column({ type: 'varchar', length: 64 }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |
| operation | string | @Column({ type: 'varchar', length: 40 }) |
| result | Record<string, unknown> | @Column({ type: 'json' }) |
| reason | string | @Column({ type: 'text' }) |

### organization_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| operation | OrganizationAuditOperation | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### organizations

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| legalName | string | @Column({ name: 'legal_name', type: 'varchar', length: 255 }) |
| tradeName | string \| null | @Column({ name: 'trade_name', type: 'varchar', length: 255, nullable: true }) |
| cnpj | string | @Column({ type: 'varchar', length: 14, unique: true }) |
| contactEmail | string \| null | @Column({     name: 'contact_email',     type: 'varchar',     length: 255,     nullable: true,   }) |
| contactPhone | string \| null | @Column({     name: 'contact_phone',     type: 'varchar',     length: 20,     nullable: true,   }) |
| status | OrganizationStatus | @Column({     type: 'varchar',     length: 20,     default: OrganizationStatus.ACTIVE,   }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### expense_attachments

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| expenseId | number | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) |
| storageProvider | string | @Column({ name: 'storage_provider', type: 'varchar', length: 50 }) |
| bucket | string | @Column({ type: 'varchar', length: 255 }) |
| path | string | @Column({ type: 'varchar', length: 500 }) |
| originalName | string | @Column({ name: 'original_name', type: 'varchar', length: 255 }) |
| mimeType | string | @Column({ name: 'mime_type', type: 'varchar', length: 100 }) |
| sizeBytes | number | @Column({ name: 'size_bytes', type: 'bigint', unsigned: true }) |
| checksum | \| string
    \| null | @Column({ type: 'varchar', length: 128, nullable: true }) |
| status | ExpenseAttachmentStatus | @Column({     type: 'varchar',     length: 20,     default: ExpenseAttachmentStatus.PENDING_UPLOAD,   }) |
| uploadedById | number \| null | @Column({ name: 'uploaded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### expenses

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| fieldAgentId | number \| null | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| description | string | @Column({ type: 'text' }) |
| reason | string \| null | @Column({ type: 'text', nullable: true }) |
| expenseDate | Date | @Column({     name: 'expense_date',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| amount | string | @Column({ type: 'decimal', precision: 15, scale: 2 }) |
| status | ExpenseStatus | @Column({ type: 'varchar', length: 20, default: ExpenseStatus.PENDING }) |
| approvedById | number \| null | @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| approvedAt | Date \| null | @Column({     name: 'approved_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| rejectedById | number \| null | @Column({ name: 'rejected_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| rejectedAt | Date \| null | @Column({     name: 'rejected_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| paidById | number \| null | @Column({ name: 'paid_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| paidAt | Date \| null | @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### field_agent_payments

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| fieldAgentId | number | @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN }) |
| state | string \| null | @Column({ type: 'varchar', length: 2, nullable: true }) |
| startDate | Date | @Column({     name: 'start_date',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| endDate | Date | @Column({     name: 'end_date',     type: 'date',     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| paymentDate | Date \| null | @Column({     name: 'payment_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| days | number | @Column({ type: 'int', unsigned: true, default: 0 }) |
| dailyRate | string | @Column({ name: 'daily_rate', type: 'decimal', precision: 15, scale: 2 }) |
| additionalAmount | string | @Column({     name: 'additional_amount',     type: 'decimal',     precision: 15,     scale: 2,     default: 0,   }) |
| dailyTotal | string | @Column({     name: 'daily_total',     type: 'decimal',     precision: 15,     scale: 2,     default: 0,   }) |
| discountAmount | string | @Column({     name: 'discount_amount',     type: 'decimal',     precision: 15,     scale: 2,     default: 0,   }) |
| finalAmount | string | @Column({     name: 'final_amount',     type: 'decimal',     precision: 15,     scale: 2,     default: 0,   }) |
| status | PaymentStatus | @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| approvedById | number \| null | @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| approvedAt | Date \| null | @Column({     name: 'approved_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| paidById | number \| null | @Column({ name: 'paid_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| paidAt | Date \| null | @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### payment_expense_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| paymentId | number \| null | @Column({ name: 'payment_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| expenseId | number \| null | @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| expenseAttachmentId | number \| null | @Column({     name: 'expense_attachment_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| operation | string | @Column({ type: 'varchar', length: 60 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<
    string,
    { before: unknown; after: unknown }
  > | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### preparation_templates

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| name | string | @Column({ type: 'varchar', length: 200 }) |
| kind | PreparationKind | @Column({ type: 'varchar', length: 30 }) |
| currentVersion | number | @Column({ name: 'current_version', type: 'int', default: 1 }) |
| archivedAt | Date \| null | @Column({     name: 'archived_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### preparation_template_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| templateId | number | @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN }) |
| version | number | @Column({ type: 'int' }) |
| name | string | @Column({ type: 'varchar', length: 200 }) |
| questions | PreparationQuestion[] | @Column({ type: 'json' }) |
| createdById | number | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN }) |

### project_preparations

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| templateVersionId | number | @Column({ name: 'template_version_id', ...FOREIGN_KEY_COLUMN }) |
| kind | PreparationKind | @Column({ type: 'varchar', length: 30 }) |
| title | string | @Column({ type: 'varchar', length: 200 }) |
| snapshot | PreparationSnapshot | @Column({ type: 'json' }) |
| status | PreparationStatus | @Column({ type: 'varchar', length: 30, default: 'draft' }) |
| revision | number | @Column({ type: 'int', default: 1 }) |
| responsibleUserId | number \| null | @Column({     name: 'responsible_user_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| scheduledDate | string \| null | @Column({     name: 'scheduled_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| dueDate | string \| null | @Column({     name: 'due_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| createdById | number | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN }) |
| approvedById | number \| null | @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| approvedAt | Date \| null | @Column({     name: 'approved_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### preparation_answers

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| preparationId | number | @Column({ name: 'preparation_id', ...FOREIGN_KEY_COLUMN }) |
| questionId | string | @Column({ name: 'question_id', type: 'varchar', length: 80 }) |
| state | AnswerState | @Column({ type: 'varchar', length: 30 }) |
| value | PreparationValue | @Column({ type: 'json', nullable: true }) |
| notes | string \| null | @Column({ type: 'text', nullable: true }) |
| responsibleUserId | number \| null | @Column({     name: 'responsible_user_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| dueDate | string \| null | @Column({     name: 'due_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| answeredById | number | @Column({ name: 'answered_by_id', ...FOREIGN_KEY_COLUMN }) |
| answeredAt | Date \| null | @Column({     name: 'answered_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### preparation_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| preparationId | number \| null | @Column({ name: 'preparation_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| templateId | number \| null | @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| operation | string | @Column({ type: 'varchar', length: 60 }) |
| performedById | number | @Column({ name: 'performed_by_id', ...FOREIGN_KEY_COLUMN }) |
| changes | Record<string, unknown> | @Column({ type: 'json' }) |

### project_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### projects

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| companyId | number \| null | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| name | string | @Column({ type: 'varchar', length: 255 }) |
| code | string \| null | @Column({ type: 'varchar', length: 40, nullable: true }) |
| projectType | ProjectType \| null | @Column({ name: 'project_type', type: 'varchar', length: 30, nullable: true }) |
| responsibleUserId | number \| null | @Column({     name: 'responsible_user_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| planningResponsibleUserId | number \| null | @Column({     name: 'planning_responsible_user_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |
| planningNotes | string \| null | @Column({ name: 'planning_notes', type: 'text', nullable: true }) |
| companyName | string \| null |  |
| responsibleUserName | string \| null |  |
| planningResponsibleUserName | string \| null |  |
| description | string \| null | @Column({ type: 'text', nullable: true }) |
| status | ProjectStatus | @Column({ type: 'varchar', length: 20, default: ProjectStatus.DRAFT }) |
| startDate | Date \| null | @Column({     name: 'start_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| endDate | Date \| null | @Column({     name: 'end_date',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| finishedAt | Date \| null | @Column({     name: 'finished_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| settings | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| metadata | JsonRecord \| null | @Column({ type: 'json', nullable: true }) |
| createdById | number \| null | @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| updatedById | number \| null | @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |
| deletedAt | Date \| null | @DeleteDateColumn({     name: 'deleted_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |

### receivables

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| companyId | number | @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number \| null | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| contractId | number \| null | @Column({ name: 'contract_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| sourceKey | string \| null | @Column({ name: 'source_key', type: 'varchar', length: 100, nullable: true }) |
| data | ReceivableInputDto & {
    source_snapshot: Record<string, unknown> \| null;
  } | @Column({ type: 'json' }) |
| amount | string | @Column({ type: 'decimal', precision: 15, scale: 2 }) |
| currency | string | @Column({ type: 'varchar', length: 3 }) |
| revision | number | @Column({ type: 'int' }) |
| cancelled | boolean | @Column({ type: 'boolean', default: false }) |
| createdAt | Date | @Column({ name: 'created_at', type: 'datetime', precision: 3 }) |

### receivable_installments

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| receivableId | number | @Column({ name: 'receivable_id', ...FOREIGN_KEY_COLUMN }) |
| position | number | @Column({ type: 'int' }) |
| kind | string | @Column({ type: 'varchar', length: 20 }) |
| dueOn | string | @Column({ name: 'due_on', type: 'date', transformer: CIVIL_DATE_TRANSFORMER }) |
| amount | string | @Column({ type: 'decimal', precision: 15, scale: 2 }) |

### receivable_events

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| organizationId | number | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN }) |
| receivableId | number | @Column({ name: 'receivable_id', ...FOREIGN_KEY_COLUMN }) |
| installmentId | number \| null | @Column({ name: 'installment_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| reversesId | number \| null | @Column({ name: 'reverses_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| commandKey | string | @Column({ name: 'command_key', type: 'varchar', length: 100 }) |
| commandHash | string | @Column({ name: 'command_hash', type: 'varchar', length: 64 }) |
| revision | number | @Column({ type: 'int' }) |
| operation | string | @Column({ type: 'varchar', length: 20 }) |
| amount | string \| null | @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) |
| effectiveOn | string \| null | @Column({     name: 'effective_on',     type: 'date',     nullable: true,     transformer: CIVIL_DATE_TRANSFORMER,   }) |
| details | Record<string, unknown> | @Column({ type: 'json' }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |

### technical_report_templates

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| revision | number | @Column({ type: 'int' }) |
| archived | boolean | @Column({ type: 'boolean' }) |
| data | TemplateDataDto | @Column({ type: 'json' }) |
| publishedVersionId | number \| null | @Column({     name: 'published_version_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |

### technical_report_template_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| templateId | number | @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| operation | string | @Column({ length: 20 }) |
| data | TemplateDataDto | @Column({ type: 'json' }) |
| hash | string | @Column({ length: 64 }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |
| reason | string | @Column({ type: 'text' }) |

### technical_report_responsibles

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| data | ResponsibleData | @Column({ type: 'json' }) |

### technical_reports

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| status | string | @Column({ length: 20 }) |
| data | ReportContent | @Column({ type: 'json' }) |
| approvedVersionId | number \| null | @Column({     name: 'approved_version_id',     ...FOREIGN_KEY_COLUMN,     nullable: true,   }) |

### technical_report_versions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| reportId | number | @Column({ name: 'report_id', ...FOREIGN_KEY_COLUMN }) |
| projectId | number | @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) |
| revision | number | @Column({ type: 'int' }) |
| status | string | @Column({ length: 20 }) |
| data | ReportContent | @Column({ type: 'json' }) |
| validation | Validation | @Column({ type: 'json' }) |
| hash | string | @Column({ length: 64 }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |
| reason | string | @Column({ type: 'text' }) |

### technical_report_commands

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| commandKey | string | @Column({ name: 'command_key', length: 100 }) |
| hash | string | @Column({ length: 64 }) |
| actorId | number | @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ length: 80 }) |
| reason | string | @Column({ type: 'text' }) |
| recordedAt | Date | @Column({ name: 'recorded_at', type: 'datetime', precision: 3 }) |
| result | Record<string, unknown> | @Column({ type: 'json' }) |

### permissions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| key | string | @Column({ type: 'varchar', length: 100, unique: true }) |
| resource | string | @Column({ type: 'varchar', length: 50 }) |
| action | string | @Column({ type: 'varchar', length: 50 }) |
| scope | PermissionScope | @Column({     type: 'varchar',     length: 20,   }) |
| description | string | @Column({ type: 'varchar', length: 255 }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### role_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| roleId | number | @Column({ name: 'role_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### role_permissions

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| roleId | number | @PrimaryColumn({ name: 'role_id', ...FOREIGN_KEY_COLUMN }) |
| permissionId | number | @PrimaryColumn({ name: 'permission_id', ...FOREIGN_KEY_COLUMN }) |

### roles

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| key | string \| null | @Column({ type: 'varchar', length: 100, nullable: true }) |
| type | RoleType | @Column({ type: 'varchar', length: 20 }) |
| organizationId | number \| null | @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| name | string | @Column({ type: 'varchar', length: 100 }) |
| description | string \| null | @Column({ type: 'varchar', length: 255, nullable: true }) |
| isActive | boolean | @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |
| updatedAt | Date | @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) |

### user_audit_logs

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| operation | string | @Column({ type: 'varchar', length: 50 }) |
| performedBy | number \| null | @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| changes | Record<string, { before: unknown; after: unknown }> | @Column({ type: 'json' }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

### user_role_assignments

| Propriedade | Tipo TS | Decorators TypeORM |
|---|---|---|
| id | number | @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) |
| userId | number | @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) |
| roleId | number | @Column({ name: 'role_id', ...FOREIGN_KEY_COLUMN }) |
| isActive | boolean | @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 }) |
| assignedBy | number \| null | @Column({ name: 'assigned_by', ...FOREIGN_KEY_COLUMN, nullable: true }) |
| assignedAt | Date | @Column({ name: 'assigned_at', type: 'datetime', precision: 3 }) |
| revokedAt | Date \| null | @Column({     name: 'revoked_at',     type: 'datetime',     precision: 3,     nullable: true,   }) |
| createdAt | Date | @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) |

