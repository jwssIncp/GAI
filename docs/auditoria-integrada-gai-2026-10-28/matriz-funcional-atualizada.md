# Reavaliação individual das 98 capacidades

Data: 28/10/2026. Matriz original preservada; nenhuma linha foi inferida apenas do relatório anterior. Evidências são do código atual e das suítes referidas em testes.md. IMPLEMENTADA indica fluxo backend persistido + frontend correspondente no escopo descrito, não paridade irrestrita nem certificação de produção. A coluna de testes identifica arquivos existentes, não afirma que todos passaram; consultar resultados por ambiente. Ausências foram confrontadas com o inventário completo de módulos/rotas/catálogo. INCOMPATÍVEL POR DECISÃO mantém as exclusões arquiteturais justificadas na matriz original; não constitui nova decisão comercial.

- IMPLEMENTADA: 42
- PARCIAL: 27
- INCOMPATÍVEL POR DECISÃO: 10
- NÃO VERIFICADA: 7
- AUSENTE: 12

## F001 — Cadastro e lifecycle

- Módulo legado: Painel de projetos.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/projects/application/services/project-scope.service.ts:12`.
- Frontend: `gai-frontend/src/features/projects/ProjectsPage.tsx:26`.
- Evidência e delimitação: Cadastro persistido, auditoria e transições explícitas; projetos antigos sem contrato continuam válidos.
- Testes existentes: `gai-backend/test/integration/projects/projects.e2e-spec.ts`; `gai-backend/test/unit/modules/projects/project-status-transition.policy.spec.ts`; `gai-backend/test/unit/modules/projects/project.spec.ts`; `gai-backend/test/unit/modules/projects/update-project-status.use-case.spec.ts`; `gai-backend/test/unit/modules/projects/update-project.use-case.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Criar/editar no escopo correto e manter todas as transições e auditorias atuais.

## F002 — Contrato, escopo, recorrência e aditivos

- Módulo legado: Painel de projetos.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/contracts/contract.service.ts:32`.
- Frontend: `gai-frontend/src/features/contracts/ProjectContractsPage.tsx:30`.
- Evidência e delimitação: Contrato tipado por projeto; revisões e aditivos imutáveis, moeda e valores exatos. Não gera orçamento automaticamente.
- Testes existentes: `gai-backend/test/integration/contracts/contracts.e2e-spec.ts`; `gai-backend/test/unit/modules/contracts/commercial.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Projeto antigo válido sem contrato; aditivos versionados e valores/parcelas íntegros em centavos.

## F003 — Filtros cruzados da carteira

- Módulo legado: Painel de projetos.
- Estado anterior: **PARCIAL**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/project-dashboard/application/services/organization-overview.service.ts:38`.
- Frontend: `gai-frontend/src/features/dashboard/OrganizationOverviewPage.tsx:28`.
- Evidência e delimitação: Filtros operacionais e comerciais combinados por EXISTS; serviço, segmento, recorrência e faixa de ativos no mesmo recorte. Datas operacionais e contratuais têm semânticas distintas explícitas.
- Testes existentes: `gai-backend/test/integration/project-dashboard/project-dashboard.e2e-spec.ts`; `gai-backend/test/unit/modules/project-dashboard/organization-overview.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-dashboard-analytics.service.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary-calculations.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary-dates.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary.service.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Lista, indicadores e export usam mesmo recorte e organização.

## F004 — Mapa, status e grupos por empresa

- Módulo legado: Painel de projetos.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/project-dashboard/application/services/organization-overview.service.ts:38`.
- Frontend: `gai-frontend/src/features/dashboard/OrganizationOverviewPage.tsx:28`.
- Evidência e delimitação: Mapa por unidades e agrupamentos por empresa/status; EXISTS evita multiplicação por unidades. Mapa não é endereço contratual.
- Testes existentes: `gai-backend/test/integration/project-dashboard/project-dashboard.e2e-spec.ts`; `gai-backend/test/unit/modules/project-dashboard/organization-overview.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-dashboard-analytics.service.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary-calculations.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary-dates.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary.service.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Várias unidades não multiplicam total geral; grupo sem localização explícito.

## F005 — Valor anual, ticket e recorrência

- Módulo legado: Painel de projetos.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/contracts/commercial.service.ts:25`.
- Frontend: `gai-frontend/src/features/dashboard/OverviewDetails.tsx:10`.
- Evidência e delimitação: Totais original/atual, ticket arredondado e recorrência separados por moeda; desconhecidos continuam null e snapshots persistem.
- Testes existentes: `gai-backend/test/integration/contracts/contracts.e2e-spec.ts`; `gai-backend/test/unit/modules/contracts/commercial.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Indisponível não vira zero; denominador zero tratado e data contratual definida.

## F006 — Etapas e evolução da carteira

- Módulo legado: Painel de projetos.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/contracts/commercial.service.ts:25`.
- Frontend: `gai-frontend/src/features/dashboard/OverviewDetails.tsx:10`.
- Evidência e delimitação: Indicadores operacionais e contagens de campo disponíveis; não foi encontrada evolução temporal unificada das etapas da carteira.
- Testes existentes: `gai-backend/test/integration/contracts/contracts.e2e-spec.ts`; `gai-backend/test/unit/modules/contracts/commercial.policy.spec.ts`.
- Lacunas: Indicadores operacionais e contagens de campo disponíveis; não foi encontrada evolução temporal unificada das etapas da carteira.
- Aceite original confrontado: Denominador e origem visíveis para cada etapa e filtro.

## F007 — Histórico/conversão de propostas

- Módulo legado: Painel de projetos.
- Estado anterior: **AUSENTE**. Estado atual: **PARCIAL**. Prioridade: **P3**.
- Backend: `gai-backend/src/modules/budgets/budget.service.ts:50`.
- Frontend: `gai-frontend/src/features/budgets/BudgetDetailPage.tsx:21`.
- Evidência e delimitação: Orçamentos têm histórico e estados; conversão apenas retorna preview_only e creates_contract=false. Funil anual e conversão efetiva não estão completos.
- Testes existentes: `gai-backend/test/integration/budgets/budgets.e2e-spec.ts`; `gai-backend/test/unit/modules/budgets/budget.policy.spec.ts`.
- Lacunas: Orçamentos têm histórico e estados; conversão apenas retorna preview_only e creates_contract=false. Funil anual e conversão efetiva não estão completos.
- Aceite original confrontado: Conversão idempotente e histórico de status sem duplicar projeto.

## F008 — Backup JSON e restore do painel

- Módulo legado: Painel de projetos.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts:50`.
- Frontend: `gai-frontend/src/features/export-jobs/ProjectExportJobsPage.tsx:26`.
- Evidência e delimitação: Backup XLSX protegido cobre conjunto limitado; sem restauração integral JSON do painel e dos novos domínios.
- Testes existentes: `gai-backend/test/integration/export-jobs/export-jobs.e2e-spec.ts`.
- Lacunas: Backup XLSX protegido cobre conjunto limitado; sem restauração integral JSON do painel e dos novos domínios.
- Aceite original confrontado: Backup declara versão/escopo; import valida vínculos e tenant antes de gravar.

## F009 — Busca/upload de logos

- Módulo legado: Painel de projetos.
- Estado anterior: **AUSENTE**. Estado atual: **PARCIAL**. Prioridade: **P3**.
- Backend: `gai-backend/src/modules/documents/document-templates.service.ts:13`.
- Frontend: `gai-frontend/src/features/documents/DocumentExport.tsx:7`; `gai-frontend/src/features/documents/VisualTemplateEditor.tsx:7`.
- Evidência e delimitação: Logo PNG da organização pode compor modelo visual versionado; busca externa e cadastro de logo por empresa não localizados.
- Testes existentes: `gai-backend/test/integration/documents/documents.e2e-spec.ts`; `gai-backend/test/unit/modules/documents/document.render.spec.ts`; `gai-backend/test/unit/modules/documents/document.worker.spec.ts`.
- Lacunas: Logo PNG da organização pode compor modelo visual versionado; busca externa e cadastro de logo por empresa não localizados.
- Aceite original confrontado: MIME/tamanho/proveniência validados; imagem não executa conteúdo ativo.

## F010 — Cadastro e detalhe do item

- Módulo legado: Inventário e cronograma.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/inventory-items/application/use-cases/create-inventory-item.use-case.ts:27`.
- Frontend: `gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx:25`.
- Evidência e delimitação: CRUD de item e detalhe por projeto persistidos com status, escopo e auditoria; UI consome endpoints.
- Testes existentes: `gai-backend/test/integration/inventory-items/inventory-items.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-items/inventory-item.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: DTO e autorização validam item/projeto e registram auditoria.

## F011 — Import físico e lotes

- Módulo legado: Inventário e cronograma.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:92`.
- Frontend: `gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.tsx:75`.
- Evidência e delimitação: Payload físico materializa observação idempotente; não há remoção arbitrária de todas as linhas de um lote físico como no legado.
- Testes existentes: `gai-backend/test/integration/import-sessions/import-sessions.e2e-spec.ts`; `gai-backend/test/unit/modules/import-sessions/import-sessions.spec.ts`; `gai-backend/test/unit/modules/import-sessions/physical-observation-import-parser.service.spec.ts`.
- Lacunas: Payload físico materializa observação idempotente; não há remoção arbitrária de todas as linhas de um lote físico como no legado.
- Aceite original confrontado: Erros por linha e retry sem duplicação; remover não apaga evidência silenciosamente.

## F012 — Edição de planilha e operações em massa

- Módulo legado: Inventário e cronograma.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/inventory-operations/application/valuation-batch.service.ts:62`.
- Frontend: `gai-frontend/src/features/inventory-items/ValuationBatchPanel.tsx:29`.
- Evidência e delimitação: Lote existe para avaliações; edição de células/colunas e schema livre de inventário não foram implementados.
- Testes existentes: `gai-backend/test/integration/valuation-batches/valuation-batch.e2e-spec.ts`.
- Lacunas: Lote existe para avaliações; edição de células/colunas e schema livre de inventário não foram implementados.
- Aceite original confrontado: Preview e resultado por item; campos proibidos não passam pela API.

## F013 — Filtros, páginas e seleção global

- Módulo legado: Inventário e cronograma.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:72`.
- Frontend: `gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx:25`.
- Evidência e delimitação: Filtros e paginação existem; seleção entre páginas é explícita no lote de avaliação, sem equivalência universal nas tabelas.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Filtros e paginação existem; seleção entre páginas é explícita no lote de avaliação, sem equivalência universal nas tabelas.
- Aceite original confrontado: Selecionar página difere de todos filtrados; lote revalida filtros no servidor.

## F014 — Agrupamento físico/pivot

- Módulo legado: Inventário e cronograma.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/project-dashboard/application/services/organization-overview.service.ts:38`.
- Frontend: `gai-frontend/src/features/dashboard/OrganizationOverviewPage.tsx:28`.
- Evidência e delimitação: Agregações fixas por status/unidade/UF; não há pivot livre por colunas arbitrárias.
- Testes existentes: `gai-backend/test/integration/project-dashboard/project-dashboard.e2e-spec.ts`; `gai-backend/test/unit/modules/project-dashboard/organization-overview.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-dashboard-analytics.service.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary-calculations.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary-dates.spec.ts`; `gai-backend/test/unit/modules/project-dashboard/project-summary.service.spec.ts`.
- Lacunas: Agregações fixas por status/unidade/UF; não há pivot livre por colunas arbitrárias.
- Aceite original confrontado: Total bate com detalhe completo, inclusive várias páginas e grupo vazio.

## F015 — Gerar/limpar/trocar placas e códigos

- Módulo legado: Inventário e cronograma.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:72`.
- Frontend: `gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx:25`.
- Evidência e delimitação: Mestre e histórico de placas são preservados; não portar substituição/limpeza massiva de códigos das bases sem regra auditável.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Mestre e histórico de placas são preservados; não portar substituição/limpeza massiva de códigos das bases sem regra auditável.
- Aceite original confrontado: Observação não altera mestre; alteração aprovada preserva histórico e unicidade.

## F016 — Undo/redo de dados brutos

- Módulo legado: Inventário e cronograma.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:72`.
- Frontend: `gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx:25`.
- Evidência e delimitação: Histórico SQL não admite rollback de matriz bruta local capaz de desfazer decisões de outros usuários.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Histórico SQL não admite rollback de matriz bruta local capaz de desfazer decisões de outros usuários.
- Aceite original confrontado: Reversão respeita estado/concorrência e mantém trilha anterior.

## F017 — Export de inventário e bases

- Módulo legado: Inventário e cronograma.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts:50`.
- Frontend: `gai-frontend/src/features/export-jobs/ProjectExportJobsPage.tsx:26`.
- Evidência e delimitação: Jobs geram XLSX real de inventário e base contábil com download autorizado e auditoria; não implica ZIP integral.
- Testes existentes: `gai-backend/test/integration/export-jobs/export-jobs.e2e-spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: XLSX válido contém somente escopo declarado e texto não vira fórmula executável.

## F018 — Cronograma editável

- Módulo legado: Inventário e cronograma.
- Estado anterior: **AUSENTE**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/field-coordination/field.service.ts:61`.
- Frontend: `gai-frontend/src/features/field-coordination/FieldCoordinationPage.tsx:52`.
- Evidência e delimitação: Tarefas com responsáveis, prazo e ordem existem na coordenação; cronograma geral editável/Gantt e histórico de planejamento equivalentes não localizados.
- Testes existentes: `gai-backend/test/integration/field-coordination/field.e2e-spec.ts`; `gai-backend/test/unit/modules/field-coordination/field.policy.spec.ts`.
- Lacunas: Tarefas com responsáveis, prazo e ordem existem na coordenação; cronograma geral editável/Gantt e histórico de planejamento equivalentes não localizados.
- Aceite original confrontado: Datas/dependências válidas e histórico por organização.

## F019 — Sync offline de bases/deltas

- Módulo legado: Inventário e cronograma.
- Estado anterior: **NÃO VERIFICADA**. Estado atual: **NÃO VERIFICADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:92`.
- Frontend: `gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.tsx:75`.
- Evidência e delimitação: API recebe payloads idempotentes; cliente offline completo e backend legado conc-db não estão disponíveis para verificar sincronização ponta a ponta.
- Testes existentes: `gai-backend/test/integration/import-sessions/import-sessions.e2e-spec.ts`; `gai-backend/test/unit/modules/import-sessions/import-sessions.spec.ts`; `gai-backend/test/unit/modules/import-sessions/physical-observation-import-parser.service.spec.ts`.
- Lacunas: API recebe payloads idempotentes; cliente offline completo e backend legado conc-db não estão disponíveis para verificar sincronização ponta a ponta.
- Aceite original confrontado: Fila/versionamento/tenant e conflitos reproduzidos sem perda em ambiente isolado.

## F020 — Pareamento por placa e sobras

- Módulo legado: Conciliação e variantes.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:72`.
- Frontend: `gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx:25`.
- Evidência e delimitação: Conciliação por placa normalizada gera registros e sobras a partir das últimas observações, preservando fontes.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Fixtures reproduzem última observação, sobras e duplicidades com fonte/versionamento explícitos.

## F021 — Tolerância de divergência monetária

- Módulo legado: Conciliação e variantes.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P2**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado match`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há comparação monetária físico-contábil por tolerância absoluta; matching compara identificadores, texto e local.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há comparação monetária físico-contábil por tolerância absoluta; matching compara identificadores, texto e local.
- Aceite original confrontado: Moeda/base/tolerância aprovadas; limiar e arredondamento testados.

## F022 — Sugestão por série/descrição/local

- Módulo legado: Conciliação e variantes.
- Estado anterior: **AUSENTE**. Estado atual: **PARCIAL**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/assisted-reconciliation/matching.policy.ts:51`.
- Frontend: `gai-frontend/src/features/inventory-operations/AssistedReconciliationPanel.tsx:36`.
- Evidência e delimitação: Motor por placa, série e descrição/local persistido e explicável. Usa Jaccard de tokens; Dice e desempate monetário específicos do legado não existem.
- Testes existentes: `gai-backend/test/integration/assisted-reconciliation/assisted.e2e-spec.ts`; `gai-backend/test/unit/modules/assisted-reconciliation/matching.policy.spec.ts`.
- Lacunas: Motor por placa, série e descrição/local persistido e explicável. Usa Jaccard de tokens; Dice e desempate monetário específicos do legado não existem.
- Aceite original confrontado: Regra/score/candidatos explicáveis e nenhum mestre alterado antes de aprovação.

## F023 — Revisão e aprovação de sugestões

- Módulo legado: Conciliação e variantes.
- Estado anterior: **PARCIAL**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/assisted-reconciliation/assisted.service.ts:60`.
- Frontend: `gai-frontend/src/features/inventory-operations/AssistedReconciliationPanel.tsx:36`.
- Evidência e delimitação: Revisão explícita, rejeição e aprovação com comando idempotente; aprovação integra a consolidação normal e preserva decisão anterior.
- Testes existentes: `gai-backend/test/integration/assisted-reconciliation/assisted.e2e-spec.ts`; `gai-backend/test/unit/modules/assisted-reconciliation/matching.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Revisor autorizado, base vigente, decisão idempotente e sem edição retroativa.

## F024 — Duplicidade bloqueia consolidação

- Módulo legado: Conciliação e variantes.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/assisted-reconciliation/assisted.service.ts:60`.
- Frontend: `gai-frontend/src/features/inventory-operations/AssistedReconciliationPanel.tsx:36`.
- Evidência e delimitação: Ambiguidades e duplicidades bloqueiam aprovação; claims impedem muitos-para-um entre execuções.
- Testes existentes: `gai-backend/test/integration/assisted-reconciliation/assisted.e2e-spec.ts`; `gai-backend/test/unit/modules/assisted-reconciliation/matching.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Duplicidade física/contábil bloqueia via chamada direta e UI.

## F025 — Alerta de descrição incoerente

- Módulo legado: Conciliação e variantes.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/assisted-reconciliation/matching.policy.ts:51`.
- Frontend: `gai-frontend/src/features/inventory-operations/AssistedReconciliationPanel.tsx:36`.
- Evidência e delimitação: Alerta de descrição incompatível em coincidência de placa/série com limiar configurado e evidência exibida na revisão.
- Testes existentes: `gai-backend/test/integration/assisted-reconciliation/assisted.e2e-spec.ts`; `gai-backend/test/unit/modules/assisted-reconciliation/matching.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Alerta explica palavras/campos e permite revisão de caso legítimo.

## F026 — Agrupamentos dos dois lados e por placa

- Módulo legado: Conciliação e variantes.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/assisted-reconciliation/assisted.service.ts:60`.
- Frontend: `gai-frontend/src/features/inventory-operations/AssistedReconciliationPanel.tsx:36`.
- Evidência e delimitação: Listagem de candidatos, fontes e sobras disponível; agrupamentos/pivots arbitrários dos dois lados não existem.
- Testes existentes: `gai-backend/test/integration/assisted-reconciliation/assisted.e2e-spec.ts`; `gai-backend/test/unit/modules/assisted-reconciliation/matching.policy.spec.ts`.
- Lacunas: Listagem de candidatos, fontes e sobras disponível; agrupamentos/pivots arbitrários dos dois lados não existem.
- Aceite original confrontado: Contagem por bem versus linha explícita e detalhe confere com total.

## F027 — Status especial/desconciliar/trocar códigos

- Módulo legado: Conciliação e variantes.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:72`.
- Frontend: `gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx:25`.
- Evidência e delimitação: Desconciliar por mutação direta de códigos violaria snapshots e decisões já preservadas; fluxo livre do legado não é adotado.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Desconciliar por mutação direta de códigos violaria snapshots e decisões já preservadas; fluxo livre do legado não é adotado.
- Aceite original confrontado: Correção referencia decisão anterior e não apaga observação/snapshot.

## F028 — Conciliação 02 anunciada nos cards

- Módulo legado: Conciliação e variantes.
- Estado anterior: **NÃO VERIFICADA**. Estado atual: **NÃO VERIFICADA**. Prioridade: **P3**.
- Backend: `gai-backend/src/modules/assisted-reconciliation/assisted.service.ts:60`.
- Frontend: `gai-frontend/src/features/inventory-operations/AssistedReconciliationPanel.tsx:36`.
- Evidência e delimitação: Motor assistido atual existe; card Conciliação 02 original não define comportamento verificável. Não assumir equivalência pelo nome.
- Testes existentes: `gai-backend/test/integration/assisted-reconciliation/assisted.e2e-spec.ts`; `gai-backend/test/unit/modules/assisted-reconciliation/matching.policy.spec.ts`.
- Lacunas: Motor assistido atual existe; card Conciliação 02 original não define comportamento verificável. Não assumir equivalência pelo nome.
- Aceite original confrontado: Atalho deve levar a rota autorizada real; nenhum card promete processamento inexistente.

## F029 — Importar base física do projeto

- Módulo legado: Conciliação e variantes.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:72`.
- Frontend: `gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx:25`.
- Evidência e delimitação: Observações da sessão são usadas diretamente; não há cópia de matrizes IndexedDB entre namespaces do legado.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Observações da sessão são usadas diretamente; não há cópia de matrizes IndexedDB entre namespaces do legado.
- Aceite original confrontado: Sessão/base do mesmo projeto/organização e fonte usada fica registrada.

## F030 — Fonte e valor novo/usado por item

- Módulo legado: Avaliação _2 e avaliacao2.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:72`.
- Frontend: `gai-frontend/src/features/inventory-items/ProjectInventoryItemsPage.tsx:25`.
- Evidência e delimitação: Avaliação manual exige fonte/data e valor novo ou usado; histórico por item persistido e mestre preservado.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Erro sem valor; fonte/data/autor/tenant preservados.

## F031 — Avaliar seleção em lote

- Módulo legado: Avaliação _2 e avaliacao2.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/inventory-operations/application/valuation-batch.service.ts:62`.
- Frontend: `gai-frontend/src/features/inventory-items/ValuationBatchPanel.tsx:29`.
- Evidência e delimitação: Prévia com seleção explícita/filtros, confirmação atômica e histórico por item; conflito de fontes e idempotência cobertos.
- Testes existentes: `gai-backend/test/integration/valuation-batches/valuation-batch.e2e-spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Escopo de seleção claro, autorização em cada item e histórico intacto.

## F032 — Importar inventário para avaliação

- Módulo legado: Avaliação _2 e avaliacao2.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/inventory-operations/application/valuation-batch.service.ts:62`.
- Frontend: `gai-frontend/src/features/inventory-items/ValuationBatchPanel.tsx:29`.
- Evidência e delimitação: Seleciona itens reais do projeto e filtros; importação de planilha paralela para avaliação não existe.
- Testes existentes: `gai-backend/test/integration/valuation-batches/valuation-batch.e2e-spec.ts`.
- Lacunas: Seleciona itens reais do projeto e filtros; importação de planilha paralela para avaliação não existe.
- Aceite original confrontado: Avaliação não duplica ativo nem muda placa/observação.

## F033 — Cálculo CPC/vida útil/valor justo automático

- Módulo legado: Avaliação _2 e avaliacao2.
- Estado anterior: **NÃO VERIFICADA**. Estado atual: **NÃO VERIFICADA**. Prioridade: **P3**.
- Backend: `gai-backend/src/modules/inventory-operations/application/valuation-batch.service.ts:62`.
- Frontend: `gai-frontend/src/features/inventory-items/ValuationBatchPanel.tsx:29`.
- Evidência e delimitação: Valores e método são informados pelo usuário; não há evidência de motor normativo CPC automatizado nem no material legado disponível.
- Testes existentes: `gai-backend/test/integration/valuation-batches/valuation-batch.e2e-spec.ts`.
- Lacunas: Valores e método são informados pelo usuário; não há evidência de motor normativo CPC automatizado nem no material legado disponível.
- Aceite original confrontado: Fórmula/premissa/fonte/versão e revisão técnica aprovadas.

## F034 — Lançar/editar despesa por projeto/técnico

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:61`.
- Frontend: `gai-frontend/src/features/finance/ProjectFinancePage.tsx:54`.
- Evidência e delimitação: Despesa por projeto/inventariante com estados, aprovação, baixa e auditoria persistidos; reembolso é capacidade separada.
- Testes existentes: `gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts`; `gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: DTO/tenant/vínculo e estado validados com trilha de alteração.

## F035 — Anexos de despesas

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:61`.
- Frontend: `gai-frontend/src/features/finance/ProjectFinancePage.tsx:54`.
- Evidência e delimitação: Anexos possuem autorização, confirmação verificável e download; código S3 existe. Homologação AWS real continua pendente e não é inferida desta classificação local.
- Testes existentes: `gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts`; `gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Arquivo real acessível só ao autorizado; removido/estrangeiro negado.

## F036 — Tipo de contrato versus reembolso da despesa

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:61`.
- Frontend: `gai-frontend/src/features/finance/ProjectFinancePage.tsx:54`.
- Evidência e delimitação: Contrato comercial e despesa existem em domínios separados; classificação tipada reembolsável/não reembolsável por regra contratual não localizada.
- Testes existentes: `gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts`; `gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts`.
- Lacunas: Contrato comercial e despesa existem em domínios separados; classificação tipada reembolsável/não reembolsável por regra contratual não localizada.
- Aceite original confrontado: Reembolsável, solicitado, recebido e contrato possuem eventos/atributos distintos.

## F037 — Adiantamento e saldo por técnico

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P1**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado expense`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há livro de adiantamentos/depósitos por inventariante; saldo adiantamentos menos despesas não pode ser calculado com origem confiável.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há livro de adiantamentos/depósitos por inventariante; saldo adiantamentos menos despesas não pode ser calculado com origem confiável.
- Aceite original confrontado: Cada entrada/saída explica saldo e não duplica depósito em projetos/prestações.

## F038 — Parcelar despesa mensalmente

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/expense-accountabilities/expense-accountabilities.service.ts:38`.
- Frontend: `gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.tsx:19`.
- Evidência e delimitação: Parcelamento distribui centavos e usa calendário civil mensal; reenvio não recalcula parcelas antigas.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Soma exata, segunda geração bloqueada e 31/jan conforme política definida.

## F039 — Agrupar/fechar prestação de contas

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/expense-accountabilities/expense-accountabilities.service.ts:38`.
- Frontend: `gai-frontend/src/features/accountabilities/ProjectAccountabilitiesPage.tsx:19`.
- Evidência e delimitação: Prestação agrega despesas elegíveis, impede vínculo repetido e recalcula total no fechamento; não equivale a recebimento do cliente.
- Testes existentes: `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Despesa única por prestação, técnico/período válidos e total recalculado.

## F040 — Solicitar/receber reembolso do cliente

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P2**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado receivable`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Recebível genérico não implementa solicitação de reembolso vinculada à prestação fechada e sua liquidação específica.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Recebível genérico não implementa solicitação de reembolso vinculada à prestação fechada e sua liquidação específica.
- Aceite original confrontado: Solicitação/baixa/estorno distintos, valores conciliáveis sem dupla contagem.

## F041 — Resumo/gráfico/filtro por técnico

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:61`.
- Frontend: `gai-frontend/src/features/finance/ProjectFinancePage.tsx:54`.
- Evidência e delimitação: Filtros por inventariante e totais existem; depósitos, saldo de adiantamentos e gráfico de reembolso não existem. Resumo de pagamentos trunca em 100 registros (GAI-001).
- Testes existentes: `gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts`; `gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts`.
- Lacunas: Filtros por inventariante e totais existem; depósitos, saldo de adiantamentos e gráfico de reembolso não existem. Resumo de pagamentos trunca em 100 registros (GAI-001).
- Aceite original confrontado: Resumo/lista usam mesmo filtro e não exibem outro técnico quando sem gastos.

## F042 — ZIP completo com comprovantes

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts:50`.
- Frontend: `gai-frontend/src/features/export-jobs/ProjectExportJobsPage.tsx:26`.
- Evidência e delimitação: Backup XLSX não inclui binários de comprovantes e nem todos os novos módulos; não é backup restaurável completo.
- Testes existentes: `gai-backend/test/integration/export-jobs/export-jobs.e2e-spec.ts`.
- Lacunas: Backup XLSX não inclui binários de comprovantes e nem todos os novos módulos; não é backup restaurável completo.
- Aceite original confrontado: ZIP limitado, hashes/escopo declarados e nenhum arquivo de outra organização.

## F043 — Comprovante/documento demonstrativo

- Módulo legado: Despesas e prestação de contas.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:61`.
- Frontend: `gai-frontend/src/features/finance/ProjectFinancePage.tsx:54`.
- Evidência e delimitação: Documento fictício não é comprovante; somente arquivo efetivamente enviado e verificado integra evidência.
- Testes existentes: `gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts`; `gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts`.
- Lacunas: Documento fictício não é comprovante; somente arquivo efetivamente enviado e verificado integra evidência.
- Aceite original confrontado: Nenhum exemplo/seed/arquivo fictício em produção.

## F044 — Cadastro, contatos, busca e status

- Módulo legado: Inventariantes.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/field-agents/presentation/field-agents.controller.ts:58`.
- Frontend: `gai-frontend/src/features/field-agents/FieldAgentsPage.tsx:23`.
- Evidência e delimitação: Cadastro, contatos, busca, documento e status persistidos com validação e escopo organizacional.
- Testes existentes: `gai-backend/test/integration/field-agents/field-agents.e2e-spec.ts`; `gai-backend/test/unit/modules/field-agents/brazilian-contact.spec.ts`; `gai-backend/test/unit/modules/field-agents/field-agent.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Contato/documento validado e operações respeitam permissão/organização.

## F045 — Vincular técnico ao projeto

- Módulo legado: Inventariantes.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/field-agents/presentation/field-agents.controller.ts:58`.
- Frontend: `gai-frontend/src/features/field-agents/FieldAgentsPage.tsx:23`.
- Evidência e delimitação: Vínculo explícito inventariante/projeto ativo, IDs e lifecycle revalidados; nenhuma associação por nome.
- Testes existentes: `gai-backend/test/integration/field-agents/field-agents.e2e-spec.ts`; `gai-backend/test/unit/modules/field-agents/brazilian-contact.spec.ts`; `gai-backend/test/unit/modules/field-agents/field-agent.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Técnico de outro tenant não é vinculado e projeto bloqueado é respeitado.

## F046 — Documentos cadastrais do técnico

- Módulo legado: Inventariantes.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P2**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado agent`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não localizado upload de documentos cadastrais pessoais do inventariante; anexos de despesa e imagens de ativo não o substituem.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não localizado upload de documentos cadastrais pessoais do inventariante; anexos de despesa e imagens de ativo não o substituem.
- Aceite original confrontado: Documento por técnico/organização, acesso auditado e exclusão controlada.

## F047 — Login/senha no cadastro técnico

- Módulo legado: Inventariantes.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/auth/presentation/guards/permissions.guard.ts:22`.
- Frontend: `gai-frontend/src/features/auth/usePermissions.ts:4`.
- Evidência e delimitação: Identidade/autorização são separadas do cadastro técnico; não guardar senha de técnico em dados locais de cadastro.
- Testes existentes: `gai-backend/test/integration/auth/brute-force-protection.e2e-spec.ts`; `gai-backend/test/integration/auth/login.e2e-spec.ts`; `gai-backend/test/integration/auth/organization-gate.e2e-spec.ts`; `gai-backend/test/integration/auth/password-reset.e2e-spec.ts`; `gai-backend/test/integration/auth/rbac-multi-tenancy.e2e-spec.ts`; `gai-backend/test/integration/auth/session-invalidation.e2e-spec.ts`; `gai-backend/test/unit/modules/auth/login.use-case.spec.ts`; `gai-backend/test/unit/modules/auth/password.spec.ts`; `gai-backend/test/unit/modules/auth/permission-resolver.spec.ts`; `gai-backend/test/unit/modules/auth/permissions-negative.spec.ts`; `gai-backend/test/unit/modules/auth/session-auth.guard.spec.ts`.
- Lacunas: Identidade/autorização são separadas do cadastro técnico; não guardar senha de técnico em dados locais de cadastro.
- Aceite original confrontado: Nenhuma credencial importada; identidade só via auth/users.

## F048 — Diária/adicional/desconto e total

- Módulo legado: Remuneração e pagamentos.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:61`.
- Frontend: `gai-frontend/src/features/finance/ProjectFinancePage.tsx:54`.
- Evidência e delimitação: Domínio calcula dias vezes diária mais adicional menos desconto e rejeita negativo; utiliza Number/toFixed e requer limites monetários adicionais (risco registrado).
- Testes existentes: `gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts`; `gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Mesmos insumos têm total determinístico; negativo/precisão inválida rejeitados.

## F049 — Aprovação/status/baixa do pagamento

- Módulo legado: Remuneração e pagamentos.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:61`.
- Frontend: `gai-frontend/src/features/finance/ProjectFinancePage.tsx:54`.
- Evidência e delimitação: Aprovação/baixa/cancelamento existem, mas corrida HTTP/MySQL confirmou baixa bem-sucedida sobrescrita por aprovação e segunda baixa aceita sem estorno (GAI-010 crítico). Reabertura livre não é contrato de negócio; baixa de pendente é permitida explicitamente.
- Testes existentes: `gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts`; `gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts`.
- Lacunas: Aprovação/baixa/cancelamento existem, mas corrida HTTP/MySQL confirmou baixa bem-sucedida sobrescrita por aprovação e segunda baixa aceita sem estorno (GAI-010 crítico). Reabertura livre não é contrato de negócio; baixa de pendente é permitida explicitamente.
- Aceite original confrontado: Chamada direta não burla transição nem reabre pago por edição de campo.

## F050 — Consolidado mensal por técnico entre projetos

- Módulo legado: Remuneração e pagamentos.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/receivables/cash-flow.service.ts:35`.
- Frontend: `gai-frontend/src/features/receivables/CashFlowPage.tsx:10`.
- Evidência e delimitação: Caixa agrega saídas por mês/projeto, mas não implementa consolidado organizacional por técnico com todos os componentes de remuneração.
- Testes existentes: `gai-backend/test/integration/receivables/receivables.e2e-spec.ts`; `gai-backend/test/unit/modules/receivables/receivable.policy.spec.ts`.
- Lacunas: Caixa agrega saídas por mês/projeto, mas não implementa consolidado organizacional por técnico com todos os componentes de remuneração.
- Aceite original confrontado: Total por técnico confere com projetos autorizados e competência definida.

## F051 — Alterar datas/status em lote

- Módulo legado: Remuneração e pagamentos.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P2**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado expense`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há endpoint ou UI para alterar datas e status de pagamentos em lote com previsão separada.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há endpoint ou UI para alterar datas e status de pagamentos em lote com previsão separada.
- Aceite original confrontado: Idempotência, autorização em todos e estados atuais preservados.

## F052 — Exportar remuneração/pagamentos

- Módulo legado: Remuneração e pagamentos.
- Estado anterior: **EXISTENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts:50`.
- Frontend: `gai-frontend/src/features/export-jobs/ProjectExportJobsPage.tsx:26`.
- Evidência e delimitação: Exportação de pagamentos XLSX inclui componentes e valor final; download revalida payments:read e escopo.
- Testes existentes: `gai-backend/test/integration/export-jobs/export-jobs.e2e-spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Valores de domínio e apenas escopo financeiro autorizado.

## F053 — Total manual sem componente/motivo

- Módulo legado: Remuneração e pagamentos.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:61`.
- Frontend: `gai-frontend/src/features/finance/ProjectFinancePage.tsx:54`.
- Evidência e delimitação: Total manual contraditório aos componentes não é aceito; manter cálculo de domínio e trilha de auditoria.
- Testes existentes: `gai-backend/test/integration/payments-expenses/payments-expenses.e2e-spec.ts`; `gai-backend/test/unit/modules/payments-expenses/payments-expenses.spec.ts`.
- Lacunas: Total manual contraditório aos componentes não é aceito; manter cálculo de domínio e trilha de auditoria.
- Aceite original confrontado: Final recalculável por componentes/motivo autorizados.

## F054 — Kick-off e respostas estruturadas

- Módulo legado: Kick-off e checklist do cliente.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/project-preparation/preparation.service.ts:46`.
- Frontend: `gai-frontend/src/features/project-preparation/ProjectPreparationPage.tsx:38`.
- Evidência e delimitação: Kick-off tem modelo publicado, respostas tipadas, data, responsável, aprovação e histórico por projeto.
- Testes existentes: `gai-backend/test/integration/project-preparation/project-preparation.e2e-spec.ts`; `gai-backend/test/unit/modules/project-preparation/preparation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Perguntas com IDs estáveis, versão preservada e autorização por projeto.

## F055 — Checklist do cliente independente

- Módulo legado: Kick-off e checklist do cliente.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/project-preparation/preparation.service.ts:46`.
- Frontend: `gai-frontend/src/features/project-preparation/ProjectPreparationPage.tsx:38`.
- Evidência e delimitação: Checklist do cliente usa instância e respostas independentes do Kick-off, sem compartilhamento de estado.
- Testes existentes: `gai-backend/test/integration/project-preparation/project-preparation.e2e-spec.ts`; `gai-backend/test/unit/modules/project-preparation/preparation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Criar/clonar/editar não compartilha resposta entre projetos/organizações.

## F056 — Campos condicionais/N-A/sequência de etiquetas

- Módulo legado: Kick-off e checklist do cliente.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/project-preparation/preparation.service.ts:46`.
- Frontend: `gai-frontend/src/features/project-preparation/ProjectPreparationPage.tsx:38`.
- Evidência e delimitação: Condições, N/A justificado e sequência compatível com quantidade são validados também na API.
- Testes existentes: `gai-backend/test/integration/project-preparation/project-preparation.e2e-spec.ts`; `gai-backend/test/unit/modules/project-preparation/preparation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: N-A difere de pendente; dependentes/sequências inválidas retornam erro backend.

## F057 — Endereços, quantidades e participação

- Módulo legado: Kick-off e checklist do cliente.
- Estado anterior: **PARCIAL**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/project-preparation/preparation.service.ts:46`.
- Frontend: `gai-frontend/src/features/project-preparation/ProjectPreparationPage.tsx:38`.
- Evidência e delimitação: Alocação reutiliza unidades vinculadas e calcula participação com uma casa decimal; IDs estrangeiros são rejeitados.
- Testes existentes: `gai-backend/test/integration/project-preparation/project-preparation.e2e-spec.ts`; `gai-backend/test/unit/modules/project-preparation/preparation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Sem criar unidades duplicadas; totais/participações reproduzíveis.

## F058 — Progresso, texto e ordem de perguntas

- Módulo legado: Kick-off e checklist do cliente.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/project-preparation/preparation.service.ts:46`.
- Frontend: `gai-frontend/src/features/project-preparation/ProjectPreparationPage.tsx:38`.
- Evidência e delimitação: Modelos editam texto/ordem/visibilidade; progresso conta apenas perguntas aplicáveis e snapshots não reinterpretam respostas antigas.
- Testes existentes: `gai-backend/test/integration/project-preparation/project-preparation.e2e-spec.ts`; `gai-backend/test/unit/modules/project-preparation/preparation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Denominador explícito e texto novo não muda interpretação de resposta antiga.

## F059 — Ata/e-mail e orientação de técnico

- Módulo legado: Kick-off e checklist do cliente.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/project-preparation/preparation.service.ts:46`.
- Frontend: `gai-frontend/src/features/project-preparation/ProjectPreparationPage.tsx:38`.
- Evidência e delimitação: Prévia autorizada de ata/texto de comunicação com dados de projeto; não envia e-mail e não comprova entrega.
- Testes existentes: `gai-backend/test/integration/project-preparation/project-preparation.e2e-spec.ts`; `gai-backend/test/unit/modules/project-preparation/preparation.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Preview de destinatário/conteúdo sem envio implícito nem dados de outro projeto.

## F060 — Pendências operacionais de inventário

- Módulo legado: Pendências de campo.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/field-coordination/field.service.ts:61`.
- Frontend: `gai-frontend/src/features/field-coordination/FieldCoordinationPage.tsx:52`.
- Evidência e delimitação: Tarefas podem referenciar pendências reais e revalidar resolução; estados não são sincronizados automaticamente e planejamento operacional amplo permanece parcial.
- Testes existentes: `gai-backend/test/integration/field-coordination/field.e2e-spec.ts`; `gai-backend/test/unit/modules/field-coordination/field.policy.spec.ts`.
- Lacunas: Tarefas podem referenciar pendências reais e revalidar resolução; estados não são sincronizados automaticamente e planejamento operacional amplo permanece parcial.
- Aceite original confrontado: Tarefa e ocorrência mantêm IDs/estados próprios e vínculos autorizados.

## F061 — Checklist de coordenação/grupos/responsáveis

- Módulo legado: Pendências de campo.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P1**.
- Backend: `gai-backend/src/modules/field-coordination/field.service.ts:61`.
- Frontend: `gai-frontend/src/features/field-coordination/FieldCoordinationPage.tsx:52`.
- Evidência e delimitação: Modelos/grupos/tarefas versionados, usuários e inventariantes vinculados, prazos, aprovação, conclusão e reabertura auditada.
- Testes existentes: `gai-backend/test/integration/field-coordination/field.e2e-spec.ts`; `gai-backend/test/unit/modules/field-coordination/field.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Template versionado e check com ator/data no escopo do projeto.

## F062 — Concluir só pelas duas primeiras faixas

- Módulo legado: Pendências de campo.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/field-coordination/field.service.ts:61`.
- Frontend: `gai-frontend/src/features/field-coordination/FieldCoordinationPage.tsx:52`.
- Evidência e delimitação: Conclusão verifica todas as tarefas/etapas obrigatórias aplicáveis; não reproduzir atalho de considerar só as duas primeiras faixas.
- Testes existentes: `gai-backend/test/integration/field-coordination/field.e2e-spec.ts`; `gai-backend/test/unit/modules/field-coordination/field.policy.spec.ts`.
- Lacunas: Conclusão verifica todas as tarefas/etapas obrigatórias aplicáveis; não reproduzir atalho de considerar só as duas primeiras faixas.
- Aceite original confrontado: Conclusão lista condições e pendências, sem depender da posição do grupo.

## F063 — Gerar mensagens para técnico/grupo

- Módulo legado: Pendências de campo.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/field-coordination/field.service.ts:61`.
- Frontend: `gai-frontend/src/features/field-coordination/FieldCoordinationPage.tsx:52`.
- Evidência e delimitação: Prévia de mensagens para técnico/grupo com dados e permissões atuais; nenhuma entrega externa é assumida.
- Testes existentes: `gai-backend/test/integration/field-coordination/field.e2e-spec.ts`; `gai-backend/test/unit/modules/field-coordination/field.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Conteúdo visível antes de copiar; dados somente do técnico/projeto permitido.

## F064 — App móvel e download APK

- Módulo legado: Pendências de campo.
- Estado anterior: **NÃO VERIFICADA**. Estado atual: **NÃO VERIFICADA**. Prioridade: **P3**.
- Backend: `gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:92`.
- Frontend: `gai-frontend/src/features/import-sessions/ProjectImportSessionsPage.tsx:75`.
- Evidência e delimitação: APK e fonte do aplicativo móvel legado não estão no escopo disponível. Importação de payload não comprova aplicativo offline homologado.
- Testes existentes: `gai-backend/test/integration/import-sessions/import-sessions.e2e-spec.ts`; `gai-backend/test/unit/modules/import-sessions/import-sessions.spec.ts`; `gai-backend/test/unit/modules/import-sessions/physical-observation-import-parser.service.spec.ts`.
- Lacunas: APK e fonte do aplicativo móvel legado não estão no escopo disponível. Importação de payload não comprova aplicativo offline homologado.
- Aceite original confrontado: Arquivo real, versão/hash/assinatura e acesso verificados antes de divulgar download.

## F065 — Recebíveis de contratos/aditivos

- Módulo legado: Fluxo de caixa e DRE.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/receivables/receivable.service.ts:50`.
- Frontend: `gai-frontend/src/features/receivables/ReceivablesPage.tsx:10`.
- Evidência e delimitação: Geração explícita de principal e aditivo positivo com origem única, snapshot e confirmação; não automática na aprovação contratual.
- Testes existentes: `gai-backend/test/integration/receivables/receivables.e2e-spec.ts`; `gai-backend/test/unit/modules/receivables/receivable.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Parcela gerada uma vez com soma/vencimento/origem rastreáveis.

## F066 — Agenda de saídas consolidada

- Módulo legado: Fluxo de caixa e DRE.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/receivables/cash-flow.service.ts:35`.
- Frontend: `gai-frontend/src/features/receivables/CashFlowPage.tsx:10`.
- Evidência e delimitação: Agenda reúne parcelas de despesas aprovadas e pagamentos previstos; moeda das saídas é UNSPECIFIED, faltam baixas por parcela e vencimentos em parte das fontes.
- Testes existentes: `gai-backend/test/integration/receivables/receivables.e2e-spec.ts`; `gai-backend/test/unit/modules/receivables/receivable.policy.spec.ts`.
- Lacunas: Agenda reúne parcelas de despesas aprovadas e pagamentos previstos; moeda das saídas é UNSPECIFIED, faltam baixas por parcela e vencimentos em parte das fontes.
- Aceite original confrontado: Vencimento difere de pagamento efetivo e cada saída só aparece uma vez.

## F067 — Baixar/estornar recebível e atraso

- Módulo legado: Fluxo de caixa e DRE.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/receivables/receivable.service.ts:50`.
- Frontend: `gai-frontend/src/features/receivables/ReceivablesPage.tsx:10`.
- Evidência e delimitação: Baixas parciais/totais, estorno referenciado, saldo, atraso e comandos idempotentes persistem eventos imutáveis.
- Testes existentes: `gai-backend/test/integration/receivables/receivables.e2e-spec.ts`; `gai-backend/test/unit/modules/receivables/receivable.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Baixa/estorno possuem valor/data/ator e retry não duplica entrada.

## F068 — Caixa mensal realizado/projetado e gráficos

- Módulo legado: Fluxo de caixa e DRE.
- Estado anterior: **AUSENTE**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/receivables/cash-flow.service.ts:35`.
- Frontend: `gai-frontend/src/features/receivables/CashFlowPage.tsx:10`.
- Evidência e delimitação: Totais e tabela mensal esperado/realizado existem; sem saldo bancário inicial, gráfico equivalente ou soma entre moedas conhecidas e saídas sem moeda.
- Testes existentes: `gai-backend/test/integration/receivables/receivables.e2e-spec.ts`; `gai-backend/test/unit/modules/receivables/receivable.policy.spec.ts`.
- Lacunas: Totais e tabela mensal esperado/realizado existem; sem saldo bancário inicial, gráfico equivalente ou soma entre moedas conhecidas e saídas sem moeda.
- Aceite original confrontado: Saldo inicial+entradas-saídas=final; cenário identificado e separado.

## F069 — DRE e comparativo anual

- Módulo legado: Fluxo de caixa e DRE.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/managerial-dre/dre.service.ts:76`.
- Frontend: `gai-frontend/src/features/dre/DreReportPage.tsx:31`.
- Evidência e delimitação: DRE gerencial por competência, plano de contas, rateios, comparação anual e fechamento/reabertura versionados; cobertura incompleta é sinalizada.
- Testes existentes: `gai-backend/test/integration/managerial-dre/dre.e2e-spec.ts`; `gai-backend/test/unit/modules/managerial-dre/dre.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Resultado reproduzível com contas/políticas/fontes aprovadas.

## F070 — Custos/comissões/tributos e ponto de equilíbrio

- Módulo legado: Fluxo de caixa e DRE.
- Estado anterior: **AUSENTE**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/budgets/budget.policy.ts:46`.
- Frontend: `gai-frontend/src/features/budgets/BudgetPricingPage.tsx:19`.
- Evidência e delimitação: Orçamento estima impostos/comissão/margem e custos com parâmetros explícitos; ponto de equilíbrio corporativo e histórico completo de custos não localizados.
- Testes existentes: `gai-backend/test/integration/budgets/budgets.e2e-spec.ts`; `gai-backend/test/unit/modules/budgets/budget.policy.spec.ts`.
- Lacunas: Orçamento estima impostos/comissão/margem e custos com parâmetros explícitos; ponto de equilíbrio corporativo e histórico completo de custos não localizados.
- Aceite original confrontado: Parâmetros por organização/vigência sem nomes fixos; zero/limites e fonte de projeção testados.

## F071 — Simular venda/entrada/parcelas

- Módulo legado: Fluxo de caixa e DRE.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P3**.
- Backend: `gai-backend/src/modules/receivables/receivable.service.ts:50`.
- Frontend: `gai-frontend/src/features/receivables/ReceivablesPage.tsx:10`.
- Evidência e delimitação: Prévia comercial de entrada/parcelas distribui centavos sem criar fatos financeiros; confirmação explícita e hash são separados.
- Testes existentes: `gai-backend/test/integration/receivables/receivables.e2e-spec.ts`; `gai-backend/test/unit/modules/receivables/receivable.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Simulado não contamina realizado e soma100%/centavos é preservada.

## F072 — Importar/ajustar DRE e contas

- Módulo legado: Fluxo de caixa e DRE.
- Estado anterior: **AUSENTE**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/managerial-dre/dre.service.ts:76`.
- Frontend: `gai-frontend/src/features/dre/DreReportPage.tsx:31`.
- Evidência e delimitação: Contas e lançamentos podem ser criados/ajustados com histórico; importador de planilha DRE não existe.
- Testes existentes: `gai-backend/test/integration/managerial-dre/dre.e2e-spec.ts`; `gai-backend/test/unit/modules/managerial-dre/dre.policy.spec.ts`.
- Lacunas: Contas e lançamentos podem ser criados/ajustados com histórico; importador de planilha DRE não existe.
- Aceite original confrontado: Erros por linha/conta/competência, tenant e nenhuma fórmula executada.

## F073 — Cadastro de orçamento e versões

- Módulo legado: Orçamentos e propostas.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/budgets/budget.service.ts:50`.
- Frontend: `gai-frontend/src/features/budgets/BudgetDetailPage.tsx:21`.
- Evidência e delimitação: Orçamento avulso ou vinculado a projeto mantém versões, cenários e aprovação do snapshot escolhido.
- Testes existentes: `gai-backend/test/integration/budgets/budgets.e2e-spec.ts`; `gai-backend/test/unit/modules/budgets/budget.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Rascunho/revisão preservam histórico e parâmetros da organização.

## F074 — Produtividade/equipe/endereços

- Módulo legado: Orçamentos e propostas.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/budgets/budget.policy.ts:46`.
- Frontend: `gai-frontend/src/features/budgets/BudgetPricingPage.tsx:19`.
- Evidência e delimitação: Dimensionamento por produtividade, dias, equipe, endereços e justificativa de ajustes com arredondamento no servidor.
- Testes existentes: `gai-backend/test/integration/budgets/budgets.e2e-spec.ts`; `gai-backend/test/unit/modules/budgets/budget.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Zero/poucos/muitos endereços e produtividade geram memória aprovada.

## F075 — Preço mínimo e opções comerciais

- Módulo legado: Orçamentos e propostas.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/budgets/budget.policy.ts:46`.
- Frontend: `gai-frontend/src/features/budgets/BudgetPricingPage.tsx:19`.
- Evidência e delimitação: Parâmetros publicados e piso explícito governam preço; não há defaults comerciais ocultos autorizados por documentação.
- Testes existentes: `gai-backend/test/integration/budgets/budgets.e2e-spec.ts`; `gai-backend/test/unit/modules/budgets/budget.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Mesmo input/versão=mesmo preço; override exige motivo e autoridade.

## F076 — Memória de despesas/impostos/comissão/plaquetas

- Módulo legado: Orçamentos e propostas.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/budgets/budget.policy.ts:46`.
- Frontend: `gai-frontend/src/features/budgets/BudgetPricingPage.tsx:19`.
- Evidência e delimitação: Memória de custos, quartos, extras, impostos, comissão, margem e plaquetas calculada em inteiros escalados e congelada por versão.
- Testes existentes: `gai-backend/test/integration/budgets/budgets.e2e-spec.ts`; `gai-backend/test/unit/modules/budgets/budget.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Componente rastreável e tributos/limites/terceiro corretamente tratados.

## F077 — Plano de pagamento comercial customizado

- Módulo legado: Orçamentos e propostas.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/budgets/budget.policy.ts:46`.
- Frontend: `gai-frontend/src/features/budgets/BudgetPricingPage.tsx:19`.
- Evidência e delimitação: Plano igual/por percentuais/por valores, entrada e residual de centavos persistidos no snapshot comercial.
- Testes existentes: `gai-backend/test/integration/budgets/budgets.e2e-spec.ts`; `gai-backend/test/unit/modules/budgets/budget.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Percentuais100%, centavos e calendário fecham conforme versão.

## F078 — Proposta/PPTX de template

- Módulo legado: Orçamentos e propostas.
- Estado anterior: **AUSENTE**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/documents/documents.service.ts:41`.
- Frontend: `gai-frontend/src/features/documents/DocumentExport.tsx:7`; `gai-frontend/src/features/documents/VisualTemplateEditor.tsx:7`.
- Evidência e delimitação: Propostas PDF/DOCX nativos e versionados existem; geração PPTX e manipulação de slides do template legado não existem.
- Testes existentes: `gai-backend/test/integration/documents/documents.e2e-spec.ts`; `gai-backend/test/unit/modules/documents/document.render.spec.ts`; `gai-backend/test/unit/modules/documents/document.worker.spec.ts`.
- Lacunas: Propostas PDF/DOCX nativos e versionados existem; geração PPTX e manipulação de slides do template legado não existem.
- Aceite original confrontado: PPTX válido renderizado, escopo/conteúdo corretos e sem macro/conteúdo ativo.

## F079 — Laudo, narrativa e escopo

- Módulo legado: Laudos e padrão.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/technical-reports/report.service.ts:44`.
- Frontend: `gai-frontend/src/features/technical-reports/ReportDetailPage.tsx:189`.
- Evidência e delimitação: Laudo tem narrativa, escopo, modelo publicado, identificação, revisão e aprovação imutável por projeto.
- Testes existentes: `gai-backend/test/integration/technical-reports/reports.e2e-spec.ts`; `gai-backend/test/unit/modules/technical-reports/report.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Emissão autorizada imutável; revisão gera nova versão com snapshot.

## F080 — Modelo/textos padrão

- Módulo legado: Laudos e padrão.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/technical-reports/report.service.ts:44`.
- Frontend: `gai-frontend/src/features/technical-reports/ReportDetailPage.tsx:189`.
- Evidência e delimitação: Modelos/textos/campos dinâmicos publicados por versão; edições futuras não alteram documentos aprovados.
- Testes existentes: `gai-backend/test/integration/technical-reports/reports.e2e-spec.ts`; `gai-backend/test/unit/modules/technical-reports/report.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Alterar padrão não muda emissão antiga nem padrão de outro tenant.

## F081 — Quadro resumo/import de avaliações

- Módulo legado: Laudos e padrão.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/technical-reports/report.sources.ts:50`.
- Frontend: `gai-frontend/src/features/technical-reports/ReportDetailPage.tsx:189`.
- Evidência e delimitação: Extrai tabelas contábeis, conciliações e avaliações; moeda das avaliações não é informada e valuation.used_total permanece null, sem depreciação normativa automática.
- Testes existentes: `gai-backend/test/integration/technical-reports/reports.e2e-spec.ts`; `gai-backend/test/unit/modules/technical-reports/report.policy.spec.ts`.
- Lacunas: Extrai tabelas contábeis, conciliações e avaliações; moeda das avaliações não é informada e valuation.used_total permanece null, sem depreciação normativa automática.
- Aceite original confrontado: Quadro confere com fonte/versionamento e denominador/valor zero aprovados.

## F082 — Fotos e legenda no laudo

- Módulo legado: Laudos e padrão.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/documents/documents.service.ts:41`.
- Frontend: `gai-frontend/src/features/documents/DocumentExport.tsx:7`; `gai-frontend/src/features/documents/VisualTemplateEditor.tsx:7`.
- Evidência e delimitação: Imagens de itens existem; DocumentBlock não possui fotos/legendas de ativos, apenas logo visual. Composição fotográfica do laudo não implementada.
- Testes existentes: `gai-backend/test/integration/documents/documents.e2e-spec.ts`; `gai-backend/test/unit/modules/documents/document.render.spec.ts`; `gai-backend/test/unit/modules/documents/document.worker.spec.ts`.
- Lacunas: Imagens de itens existem; DocumentBlock não possui fotos/legendas de ativos, apenas logo visual. Composição fotográfica do laudo não implementada.
- Aceite original confrontado: Foto do mesmo projeto, versão emitida preservada e URL autorizada.

## F083 — Pendências antes de emissão

- Módulo legado: Laudos e padrão.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/technical-reports/report.service.ts:44`.
- Frontend: `gai-frontend/src/features/technical-reports/ReportDetailPage.tsx:189`.
- Evidência e delimitação: Validação estruturada bloqueia aprovação conforme regras publicadas, campos, responsáveis, fontes e alterações; requisitos profissionais são configuráveis e não equivalem a certificação normativa.
- Testes existentes: `gai-backend/test/integration/technical-reports/reports.e2e-spec.ts`; `gai-backend/test/unit/modules/technical-reports/report.policy.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Emissão rejeita faltantes e grava aprovador/versão.

## F084 — Impressão, HTML e Word

- Módulo legado: Laudos e padrão.
- Estado anterior: **AUSENTE**. Estado atual: **IMPLEMENTADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/documents/documents.service.ts:41`.
- Frontend: `gai-frontend/src/features/documents/DocumentExport.tsx:7`; `gai-frontend/src/features/documents/VisualTemplateEditor.tsx:7`.
- Evidência e delimitação: Renderização PDF real e DOCX OOXML editável, download privado vinculado à versão; não usa HTML renomeado como Word.
- Testes existentes: `gai-backend/test/integration/documents/documents.e2e-spec.ts`; `gai-backend/test/unit/modules/documents/document.render.spec.ts`; `gai-backend/test/unit/modules/documents/document.worker.spec.ts`.
- Lacunas: Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.
- Aceite original confrontado: Formato binário corresponde à extensão; paginação revisada e sem script.

## F085 — Cálculo normativo e assinatura de laudo

- Módulo legado: Laudos e padrão.
- Estado anterior: **NÃO VERIFICADA**. Estado atual: **NÃO VERIFICADA**. Prioridade: **P3**.
- Backend: `gai-backend/src/modules/technical-reports/report.service.ts:44`.
- Frontend: `gai-frontend/src/features/technical-reports/ReportDetailPage.tsx:189`.
- Evidência e delimitação: Não foi encontrado motor normativo ou assinatura digital/verificação de conselho. Textos CPC/CREA/ART não comprovam validade normativa.
- Testes existentes: `gai-backend/test/integration/technical-reports/reports.e2e-spec.ts`; `gai-backend/test/unit/modules/technical-reports/report.policy.spec.ts`.
- Lacunas: Não foi encontrado motor normativo ou assinatura digital/verificação de conselho. Textos CPC/CREA/ART não comprovam validade normativa.
- Aceite original confrontado: Responsável valida conteúdo/método/assinatura antes de anunciar conformidade.

## F086 — Consultar histórico e comparar

- Módulo legado: Histórico, segurança e sincronização.
- Estado anterior: **PARCIAL**. Estado atual: **PARCIAL**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/technical-reports/report.service.ts:44`.
- Frontend: `gai-frontend/src/features/technical-reports/ReportDetailPage.tsx:189`.
- Evidência e delimitação: Revisões/históricos e hashes existem em vários domínios; sem comparação/restauração universal de todo o sistema.
- Testes existentes: `gai-backend/test/integration/technical-reports/reports.e2e-spec.ts`; `gai-backend/test/unit/modules/technical-reports/report.policy.spec.ts`.
- Lacunas: Revisões/históricos e hashes existem em vários domínios; sem comparação/restauração universal de todo o sistema.
- Aceite original confrontado: Escopo/ator/ação/data com sensíveis mascarados e sem mistura de tenants.

## F087 — Restaurar total/selecionado/recuperar perdas

- Módulo legado: Histórico, segurança e sincronização.
- Estado anterior: **NÃO VERIFICADA**. Estado atual: **NÃO VERIFICADA**. Prioridade: **P2**.
- Backend: `gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts:50`.
- Frontend: `gai-frontend/src/features/export-jobs/ProjectExportJobsPage.tsx:26`.
- Evidência e delimitação: Servidor legado de restauração não disponível; GAI não oferece restore integral/selecionado testado. Backup XLSX não comprova recuperação.
- Testes existentes: `gai-backend/test/integration/export-jobs/export-jobs.e2e-spec.ts`.
- Lacunas: Servidor legado de restauração não disponível; GAI não oferece restore integral/selecionado testado. Backup XLSX não comprova recuperação.
- Aceite original confrontado: Versão/ACL/concorrência/integridade referencial e trilha validadas antes de escrever.

## F088 — Auth local, JSON de contas e flags

- Módulo legado: Histórico, segurança e sincronização.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/auth/presentation/guards/permissions.guard.ts:22`.
- Frontend: `gai-frontend/src/features/auth/usePermissions.ts:4`.
- Evidência e delimitação: Autenticação é de servidor, sessões revogáveis e permissões efetivas; JSON local de contas e flags não são mecanismo de autorização.
- Testes existentes: `gai-backend/test/integration/auth/brute-force-protection.e2e-spec.ts`; `gai-backend/test/integration/auth/login.e2e-spec.ts`; `gai-backend/test/integration/auth/organization-gate.e2e-spec.ts`; `gai-backend/test/integration/auth/password-reset.e2e-spec.ts`; `gai-backend/test/integration/auth/rbac-multi-tenancy.e2e-spec.ts`; `gai-backend/test/integration/auth/session-invalidation.e2e-spec.ts`; `gai-backend/test/unit/modules/auth/login.use-case.spec.ts`; `gai-backend/test/unit/modules/auth/password.spec.ts`; `gai-backend/test/unit/modules/auth/permission-resolver.spec.ts`; `gai-backend/test/unit/modules/auth/permissions-negative.spec.ts`; `gai-backend/test/unit/modules/auth/session-auth.guard.spec.ts`.
- Lacunas: Autenticação é de servidor, sessões revogáveis e permissões efetivas; JSON local de contas e flags não são mecanismo de autorização.
- Aceite original confrontado: Sem senha exportada/fallback autorizador; backend nega acesso apesar de UI burlada.

## F089 — sharedStore global e monkey patch

- Módulo legado: Histórico, segurança e sincronização.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/auth/presentation/guards/permissions.guard.ts:22`.
- Frontend: `gai-frontend/src/features/auth/usePermissions.ts:4`.
- Evidência e delimitação: Sem espelhamento global sharedStore; domínio SQL e escopo organizacional substituem monkey patch de chaves globais.
- Testes existentes: `gai-backend/test/integration/auth/brute-force-protection.e2e-spec.ts`; `gai-backend/test/integration/auth/login.e2e-spec.ts`; `gai-backend/test/integration/auth/organization-gate.e2e-spec.ts`; `gai-backend/test/integration/auth/password-reset.e2e-spec.ts`; `gai-backend/test/integration/auth/rbac-multi-tenancy.e2e-spec.ts`; `gai-backend/test/integration/auth/session-invalidation.e2e-spec.ts`; `gai-backend/test/unit/modules/auth/login.use-case.spec.ts`; `gai-backend/test/unit/modules/auth/password.spec.ts`; `gai-backend/test/unit/modules/auth/permission-resolver.spec.ts`; `gai-backend/test/unit/modules/auth/permissions-negative.spec.ts`; `gai-backend/test/unit/modules/auth/session-auth.guard.spec.ts`.
- Lacunas: Sem espelhamento global sharedStore; domínio SQL e escopo organizacional substituem monkey patch de chaves globais.
- Aceite original confrontado: Organização A jamais aparece/é alterada no contexto B inclusive retry/export/download.

## F090 — Backend Netlify dados/auth/permissões/conc-db

- Módulo legado: Histórico, segurança e sincronização.
- Estado anterior: **NÃO VERIFICADA**. Estado atual: **NÃO VERIFICADA**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/auth/presentation/guards/permissions.guard.ts:22`.
- Frontend: `gai-frontend/src/features/auth/usePermissions.ts:4`.
- Evidência e delimitação: Backend legado Netlify não consta dos arquivos disponíveis; não é possível certificar ACL/schema/retenção dele usando o backend GAI.
- Testes existentes: `gai-backend/test/integration/auth/brute-force-protection.e2e-spec.ts`; `gai-backend/test/integration/auth/login.e2e-spec.ts`; `gai-backend/test/integration/auth/organization-gate.e2e-spec.ts`; `gai-backend/test/integration/auth/password-reset.e2e-spec.ts`; `gai-backend/test/integration/auth/rbac-multi-tenancy.e2e-spec.ts`; `gai-backend/test/integration/auth/session-invalidation.e2e-spec.ts`; `gai-backend/test/unit/modules/auth/login.use-case.spec.ts`; `gai-backend/test/unit/modules/auth/password.spec.ts`; `gai-backend/test/unit/modules/auth/permission-resolver.spec.ts`; `gai-backend/test/unit/modules/auth/permissions-negative.spec.ts`; `gai-backend/test/unit/modules/auth/session-auth.guard.spec.ts`.
- Lacunas: Backend legado Netlify não consta dos arquivos disponíveis; não é possível certificar ACL/schema/retenção dele usando o backend GAI.
- Aceite original confrontado: Análise futura requer fonte/contrato e ambiente isolado sem usar acessos do ZIP.

## F091 — Seeds/purgas/reparos no boot

- Módulo legado: Histórico, segurança e sincronização.
- Estado anterior: **INCOMPATÍVEL**. Estado atual: **INCOMPATÍVEL POR DECISÃO**. Prioridade: **P0**.
- Backend: `gai-backend/src/modules/projects/application/services/project-scope.service.ts:12`.
- Frontend: `gai-frontend/src/features/projects/ProjectsPage.tsx:26`.
- Evidência e delimitação: Não transportar purgas/reparos automáticos em boot para dados de cliente; seed de teste é explícito e isolado.
- Testes existentes: `gai-backend/test/integration/projects/projects.e2e-spec.ts`; `gai-backend/test/unit/modules/projects/project-status-transition.policy.spec.ts`; `gai-backend/test/unit/modules/projects/project.spec.ts`; `gai-backend/test/unit/modules/projects/update-project-status.use-case.spec.ts`; `gai-backend/test/unit/modules/projects/update-project.use-case.spec.ts`.
- Lacunas: Não transportar purgas/reparos automáticos em boot para dados de cliente; seed de teste é explícito e isolado.
- Aceite original confrontado: Abrir tela não cria/remove lançamento/usuário e fixture não entra em produção.

## F092 — Atividade iniciar/pausar/encerrar

- Módulo legado: Gestão de atividades/jornada.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P3**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado project`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há módulo de atividades com iniciar/pausar/encerrar e intervalos por responsável/projeto.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há módulo de atividades com iniciar/pausar/encerrar e intervalos por responsável/projeto.
- Aceite original confrontado: Servidor define tempo e limita acesso ao próprio/gestor autorizado.

## F093 — Jornada/almoço/ociosidade e consolidado

- Módulo legado: Gestão de atividades/jornada.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P3**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado project`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há jornada, almoço, ociosidade, calendário e consolidado de horas; timestamps de login não substituem apontamento.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há jornada, almoço, ociosidade, calendário e consolidado de horas; timestamps de login não substituem apontamento.
- Aceite original confrontado: Sobreposições/múltiplos turnos/pausas/fuso reproduzidos com dados privados protegidos.

## F094 — Solicitação retroativa e aprovação

- Módulo legado: Gestão de atividades/jornada.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P3**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado project`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há solicitação de apontamento retroativo e aprovação correspondente; aprovação financeira tem outra semântica.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há solicitação de apontamento retroativo e aprovação correspondente; aprovação financeira tem outra semântica.
- Aceite original confrontado: Usuário só consulta seus pedidos e repetir decisão não duplica atividade.

## F095 — Inbound e histórico de contato

- Módulo legado: CRM, cursos e fluxograma.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P3**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado project`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há leads inbound, estágios de contato e histórico CRM tipado.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há leads inbound, estágios de contato e histórico CRM tipado.
- Aceite original confrontado: Contato/estágio com origem e tenant, política de dados e dedupe revisável.

## F096 — Outbound e metas de curso

- Módulo legado: CRM, cursos e fluxograma.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P3**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado project`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há outbound, listas, conexão/convites e metas de cursos por responsável.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há outbound, listas, conexão/convites e metas de cursos por responsável.
- Aceite original confrontado: Nenhum disparo implícito e histórico de etapa isolado por tenant.

## F097 — Inscritos/funil por empresa e curso

- Módulo legado: CRM, cursos e fluxograma.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P3**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado project`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há inscritos/funil por empresa/curso ou LMS; contratos patrimoniais não implementam esse domínio.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há inscritos/funil por empresa/curso ou LMS; contratos patrimoniais não implementam esse domínio.
- Aceite original confrontado: Import idempotente por curso/tenant e contagens/contrato com origem explícita.

## F098 — Etapas/prazos/arquivo de cursos

- Módulo legado: CRM, cursos e fluxograma.
- Estado anterior: **AUSENTE**. Estado atual: **AUSENTE**. Prioridade: **P3**.
- Backend: `Não localizado`; `ver inventário e domínio relacionado project`.
- Frontend: `Não localizado`.
- Evidência e delimitação: Não há etapas/prazos/arquivos de cursos; coordenação de campo atende projeto patrimonial e não substitui esse fluxo.
- Testes existentes: `Sem teste específico desta capacidade ausente`.
- Lacunas: Não há etapas/prazos/arquivos de cursos; coordenação de campo atende projeto patrimonial e não substitui esse fluxo.
- Aceite original confrontado: Estado por curso, timezone/prazo definidos e versão preservada.
