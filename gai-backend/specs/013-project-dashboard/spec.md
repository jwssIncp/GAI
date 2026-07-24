# Feature Specification: Project Dashboard / Project Summary

**Feature Branch**: `013-project-dashboard`

**Created**: 2026-07-08

**Status**: Draft

**Repository Scope**: Este repositorio e apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementacao de interface fica fora de escopo.

## User Scenarios & Testing

### User Story 1 - Consultar summary operacional (Priority: P1)

Como usuario autorizado, quero consultar um resumo consolidado de um project, para
acompanhar rapidamente o estado do inventario patrimonial.

**Independent Test**: Consultar `GET /projects/{projectId}/summary` com permissao
`projects:read`, validando escopo por organization e totais agregados.

**Acceptance Scenarios**:

1. **Given** usuario da organization do project, **When** consulta summary, **Then**
   recebe identificacao do project, indicadores de inventario, imagens, base contabil,
   pendencias e inventariantes.
2. **Given** administrador de plataforma, **When** consulta qualquer project, **Then**
   recebe o summary independentemente da organization.
3. **Given** usuario de outra organization, **When** consulta o project, **Then** o
   sistema retorna acesso negado conforme o padrao de Projects.
4. **Given** project inexistente, **When** consulta summary, **Then** o sistema retorna
   `NOT_FOUND`.

### User Story 2 - Consultar blocos opcionais (Priority: P2)

Como usuario autorizado, quero solicitar blocos opcionais, para reduzir custo de consulta
quando financeiro, importacoes, exportacoes ou atividades recentes nao forem necessarios.

**Acceptance Scenarios**:

1. **Given** `include_financial=true`, **When** consulta summary, **Then** o response
   inclui totais de pagamentos, despesas e valor financeiro consolidado.
2. **Given** `include_imports=true`, **When** consulta summary, **Then** o response
   inclui totais de import sessions por status.
3. **Given** `include_exports=true`, **When** consulta summary, **Then** o response
   inclui objeto de exportacoes. Nesta versao, como nao ha entidade/tabela `export_jobs`
   implementada no backend, os contadores retornam zero e a regra fica documentada para
   evolucao quando o modulo existir.
4. **Given** `include_recent_activity=true`, **When** consulta summary, **Then** o
   response inclui timestamps das ultimas atividades relevantes.

## Requirements

### Functional Requirements

- **FR-001**: Summary DEVE estar vinculado a um project existente.
- **FR-002**: Summary DEVE respeitar isolamento por organization usando as regras de
  Projects.
- **FR-003**: Administrador de plataforma PODE consultar summary de qualquer organization.
- **FR-004**: Usuario de organization NAO PODE consultar project de outra organization.
- **FR-005**: Endpoint principal DEVE ser `GET /projects/{projectId}/summary`.
- **FR-006**: Endpoint `GET /projects/{projectId}/dashboard` DEVE funcionar como alias
  de leitura, sem regra diferente.
- **FR-007**: Permissao requerida DEVE ser `projects:read`; nao criar permissao nova na
  primeira versao.
- **FR-008**: Modulo NAO DEVE criar mutacoes.
- **FR-009**: Modulo NAO DEVE duplicar dados em tabela propria, snapshot ou cache nesta
  versao.
- **FR-010**: Valores monetarios DEVEM ser retornados como strings decimais com duas
  casas.
- **FR-011**: Percentuais DEVEM evitar divisao por zero; project sem itens retorna
  progresso `0`.
- **FR-012**: Project com todos os itens operacionais avaliados retorna progresso `100`.
- **FR-013**: `total_items` e o denominador de progresso consideram itens operacionais:
  `pending`, `evaluated`, `divergent`, `not_found` e `duplicated`. Itens `removed`,
  `inactive` ou soft-deleted sao contados separadamente e nao entram no denominador.
- **FR-014**: `evaluated_items` considera apenas status `evaluated`.
- **FR-015**: Pendencias `ignored` e `cancelled` nao entram em `open_pending_issues`.
- **FR-016**: Pagamentos `cancelled` nao entram em `total_payment_amount`.
- **FR-017**: Despesas `rejected` e `cancelled` nao entram em `total_expense_amount`.
- **FR-018**: Import sessions soft-deleted nao entram nos totais operacionais.
- **FR-019**: Export jobs ficam zerados enquanto o backend nao possuir entidade/tabela
  propria de exportacoes.
- **FR-020**: Response NAO DEVE expor senhas, tokens, paths internos de storage, buckets
  ou metadados sensiveis.
- **FR-021**: Endpoint analitico DEVE ser
  `GET /projects/{projectId}/dashboard/analytics`, preservando os endpoints de summary.
- **FR-022**: Filtros analiticos suportados DEVEM ser periodo, agrupamento, unidade
  textual, UF da unidade vinculada e status real do item.
- **FR-023**: `evaluated` e a regra de item inventariado; `updated_at` e usado como
  proxy temporal enquanto nao existir `inventoried_at`.
- **FR-024**: Setor, consolidacao e produtividade individual DEVEM retornar
  disponibilidade falsa, e nunca zero fabricado, enquanto o modelo nao possuir os
  campos e relacionamentos necessarios.
- **FR-025**: A UF tem como fonte `company_units.state`; a associacao de itens usa
  correspondencia normalizada entre `inventory_items.unit_text` e o nome da unidade.

### Non-Functional Requirements

- **NFR-001**: Consultas DEVEM usar agregacoes por repository para evitar N+1.
- **NFR-002**: Leitura DEVE registrar log estruturado de consulta e erros.
- **NFR-003**: Auditoria formal nao e obrigatoria para esta leitura.
- **NFR-004**: Feature MUST maintain >= 80% test coverage.
- **NFR-005**: Backend only; frontend fora de escopo.

### Key Entities Consumed

- **Project**: Identificacao, status e escopo do summary.
- **InventoryItem**: Progresso e atividades de inventario.
- **InventoryItemImage**: Totais de imagens por status.
- **InventoryAccountingItem**: Base contabil por status.
- **InventoryPendingIssue**: Pendencias por status e severidade.
- **ProjectFieldAgent**: Inventariantes vinculados por status.
- **FieldAgentPayment**: Pagamentos por status e total financeiro.
- **Expense**: Despesas por status e total financeiro.
- **ImportSession**: Importacoes por status e ultima finalizacao.
- **ExportJob**: Fora do modelo atual; reservado para evolucao.

## Dependencies

- **001-user-auth**: Sessao e usuario autenticado.
- **003-users-roles-permissions**: RBAC e permissao `projects:read`.
- **004-projects**: Project tenant, status e regras de escopo.
- **006-inventory-items**: Itens inventariados.
- **007-inventory-item-images**: Imagens dos itens.
- **009-inventory-accounting-items**: Base contabil.
- **010-inventory-pending-issues**: Pendencias.
- **011-payments-expenses**: Financeiro opcional.
- **012-import-sessions**: Importacoes opcionais.
