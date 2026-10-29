# Banco de dados e migrations

<!-- ONDA-1-STATUS -->
## Atualização da Onda 1 — 29/10/2026

Implementação e validação local concluídas; **produção não liberada**. [Relatório da Onda 1](../correcoes-onda-1-integridade-2026-10-28/README.md). GAI-002/003/004/008/009 corrigidas e validadas; GAI-011 corrigida para novas operações UTC, com histórico pendente de análise; GAI-012 parcialmente remediada (7 alertas backend e 1 frontend em --omit=dev). GAI-001/010 preservadas e revalidadas; GAI-005/006/007 continuam abertas.

Padrão 683/683, MySQL 307/307, S3 7/7, frontend 247/247, navegador 2/2; zero skips nas rodadas finais. Cobertura original e lint global aprovados. Não somar reexecuções. **O texto anterior abaixo é histórico preservado**, incluindo a atualização da Onda 0 e as reproduções originais.
<!-- /ONDA-1-STATUS -->


## Atualização após a Onda 0 financeira — 28/10/2026

**GAI-010 e GAI-001: corrigidos e validados localmente.** A correção e as evidências estão em [correcoes-onda-0-financeiro-2026-10-28](../correcoes-onda-0-financeiro-2026-10-28/README.md). Na execução final houve 124 pares concorrentes (109 com barreira InnoDB; 100 de stress), sem regressão de baixa; os resumos foram validados até 1.310 registros e com decimais grandes. Leitura com lock, validação, escrita e auditoria agora compartilham a transação. O GAI-001 foi antecipado para esta onda. Não houve migration ou reparo histórico.

As reproduções originais e os resultados abaixo são o **registro histórico anterior à correção** e foram preservados. Os demais achados continuam abertos. Os dois testes independentes de exportação genérica foram reexecutados e continuam falhos; produção e aceite integrado final permanecem não liberados. Consulte o relatório da Onda 0 para contagens atuais e limites.


## Ambiente e método

Somente o alvo sintético fixo 127.0.0.1:33317/gai_validation_disposable foi usado. O MySQL existente da porta 3306 não recebeu migrations, rollback, seeds ou escrita da auditoria. O helper ignora DB_* nesse modo, usa credenciais sintéticas, dropSchema=true e migrationsRun=true. A suíte foi serializada. O primeiro container sofreu timeouts de DDL em disco; foi preservado e parado. A execução final usou outro container exclusivo com datadir em tmpfs; não extrapolar sua latência/durabilidade para produção.

As 32 migrations foram aplicadas em schemas descartáveis durante os testes. A comparação posterior foi somente leitura, synchronize=false/migrationsRun=false. Resultado: 101 entidades/tabelas TypeORM; 102 tabelas SQL incluindo migrations; 32 migrations registradas; pendências=false. Colunas ausentes: 0; divergências de nulabilidade/precisão/escala verificadas: 0. Evidência: [evidencias/schema.json](evidencias/schema.json).

Isso não significa igualdade completa de defaults, tipos, índices e FKs de todo o metadata. QueryRunner.getTables e SchemaBuilder.log falham ao procurar typeorm_metadata para colunas geradas criadas por SQL bruto (GAI-009). A comparação foi então feita por information_schema, sem criar a tabela faltante e sem executar sugestões de schema. O catálogo físico completo de colunas/índices/FKs/checks está no JSON; limitações de comparação são explícitas.

## Migrations inventariadas

| Arquivo | Tabelas criadas em SQL estático | FKs em texto | CHECKs | Rollback |
| --- | --- | --- | --- | --- |
| `gai-backend/src/migrations/1739500000001-create-organizations.ts:1` | organizations, organization_audit_logs | 1 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1739500000002-create-auth-tables.ts:1` | users, sessions, password_reset_tokens, auth_audit_logs | 7 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1739600000001-migrate-to-numeric-ids-and-rbac.ts:1` | organizations, permissions, org_roles, org_role_permissions, users, organization_audit_logs, sessions, password_reset_tokens, auth_audit_logs, user_audit_logs, org_role_audit_logs | 15 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1739700000001-decouple-user-authorization.ts:1` | roles, role_permissions, user_role_assignments | 9 | 0 | Irreversível explicitamente |
| `gai-backend/src/migrations/1739800000001-create-projects.ts:1` | projects, project_audit_logs | 6 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1739900000001-create-field-agents.ts:1` | field_agents, project_field_agents, field_agent_audit_logs | 10 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740000000001-create-inventory-items.ts:1` | inventory_items, inventory_item_audit_logs | 8 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740100000001-create-inventory-item-images.ts:1` | inventory_item_images, inventory_item_image_audit_logs | 7 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740200000001-create-catalog-assets.ts:1` | catalog_assets, catalog_asset_audit_logs | 6 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740300000001-create-inventory-accounting-items.ts:1` | accounting_import_batches, inventory_accounting_items, inventory_accounting_item_audit_logs | 11 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740400000001-create-inventory-pending-issues.ts:1` | inventory_pending_issues, inventory_pending_issue_audit_logs | 12 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740500000001-create-payments-expenses.ts:1` | field_agent_payments, expenses, expense_attachments, payment_expense_audit_logs | 8 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740600000001-create-import-sessions.ts:1` | import_sessions, import_payloads, import_payload_errors, import_files, import_session_audit_logs | 10 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740700000001-create-companies-company-units.ts:1` | companies, company_units, project_units, company_audit_logs, company_unit_audit_logs, project_unit_audit_logs | 23 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740800000001-protect-active-field-agent-assignments.ts:1` | Alteração de schema/índice | 0 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1740900000001-add-project-unit-soft-delete.ts:1` | Alteração de schema/índice | 0 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1741000000001-create-export-jobs.ts:1` | export_jobs, export_job_audit_logs | 8 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1741100000001-add-project-dashboard-indexes.ts:1` | Alteração de schema/índice | 0 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1741200000001-create-inventory-operations.ts:1` | inventory_sessions, inventory_rounds, inventory_observations, inventory_plate_history, inventory_reconciliations, inventory_consolidations, asset_valuations, inventory_operation_audit_logs | 41 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1741300000001-create-expense-accountabilities.ts:1` | expense_accountabilities, expense_accountability_items, expense_installments, expense_accountability_audit_logs | 17 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1741400000001-close-inventory-operation-gaps.ts:1` | inventory_observation_evidence | 6 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793000000001-fix-evidence-storage-key-index.ts:1` | Alteração de schema/índice | 0 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793100000001-create-project-preparation.ts:1` | preparation_templates, preparation_template_versions, project_preparations, preparation_answers, preparation_audit_logs | 16 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793200000001-create-field-coordination.ts:1` | field_templates, field_template_versions, field_checklists, field_tasks, field_audit_logs, field_commands | 16 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793300000001-create-assisted-reconciliation.ts:1` | assisted_reconciliation_runs, assisted_reconciliation_candidates, assisted_reconciliation_decisions, assisted_reconciliation_claims | 12 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793400000001-create-valuation-batches.ts:1` | asset_valuation_batches, asset_valuation_batch_rows | 8 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793500000001-create-project-contracts.ts:1` | project_contracts, project_contract_versions, project_contract_amendments, commercial_report_snapshots | 9 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793600000001-create-budgets.ts:1` | budget_pricing_versions, budgets, budget_versions, budget_audit_logs | 15 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793700000001-create-receivables.ts:1` | receivables, receivable_installments, receivable_events | 9 | 2 | down definido; não executado |
| `gai-backend/src/migrations/1793800000001-create-managerial-dre.ts:1` | dre_accounts, dre_account_versions, dre_entries, dre_entry_versions, dre_periods, dre_commands | 10 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793900000001-create-technical-reports.ts:1` | technical_report_templates, technical_report_template_versions, technical_report_responsibles, technical_reports, technical_report_versions, technical_report_commands | 13 | 0 | down definido; não executado |
| `gai-backend/src/migrations/1793900000002-create-professional-documents.ts:1` | document_visual_versions, document_artifacts, document_audit_logs | 2 | 2 | down definido; não executado |

## Integridade estrutural

O schema possui FKs e índices para escopo/filhos, vínculos ativos protegidos por coluna gerada, chaves únicas de snapshots/revisões e comandos idempotentes. No catálogo físico, contar constraints únicas por nome/tabela; linhas de information_schema em FKs/índices compostos representam colunas, não múltiplas constraints. Recebíveis e artefatos documentais têm CHECKs explícitos; muitas outras invariantes são de aplicação, não constraints SQL.

DECIMAL(15,2) predomina para valores; datas civis usam DATE e instantes DATETIME(3), enquanto snapshots comerciais/DRE usam JSON com strings decimais. Existem tabelas próprias para auditoria, revisões de modelos/contratos/orçamentos/laudos/DRE, eventos financeiros, comandos e operações de lote. Arquivamento/desativação não deve apagar snapshots; entidades originais usam soft delete em vários domínios. JSON polimórfico e referências sem FK exigem validação da aplicação, exercitada por testes de troca de pai/tenant. Não foi afirmado que toda relação entre organizações seja garantida apenas pelo banco.

## Upgrade e rollback

`gai-backend/src/migrations/1739600000001-migrate-to-numeric-ids-and-rbac.ts:6` derruba tabelas de organizações/autenticação para migrar IDs. `gai-backend/src/migrations/1739700000001-decouple-user-authorization.ts:135` rejeita rollback explicitamente. Portanto, cadeia completa não oferece rollback reversível universal, e execução sobre uma base antiga com dados exige estratégia de preservação/restauração antes de liberar. Isso é risco condicional confirmado pelo código; não houve perda em banco real nesta execução.

Schema novo foi validado; upgrade de uma cópia histórica representativa, contagens/checksums antes/depois, restore de backup e recuperação de desastre continuam pendentes. Nunca executar down global como prova de segurança no banco existente. MySQL DDL não é transação de dados comum; rollback lógico da aplicação não torna uma cadeia destrutiva reversível.

Produção usa `gai-backend/scripts/data-source.prod.cjs:1` e script release:prod encadeia migration/permissões/admin. Nenhum desses comandos de release foi executado. Comprovar baseline de migrations do ambiente de destino e sincronização das 161 permissões antes de homologação compartilhada.
