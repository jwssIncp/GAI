# Feature Specification: Inventory Items / Itens Inventariados

**Feature Branch**: `006-inventory-items`

**Created**: 2026-07-07

**Status**: Draft

**Repository Scope**: Este repositorio e apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementacao de interface fica fora de escopo.

## User Scenarios & Testing

### User Story 1 - Cadastrar Inventory Item (Priority: P1)

Como usuario autorizado, quero cadastrar manualmente um bem patrimonial inventariado
dentro de um project operacional, para registrar a base de patrimonio apurada em campo.

**Independent Test**: Criar inventory item em project `draft`, `active` ou `paused`,
verificando `organization_id`, `project_id`, normalizacao de placas, status inicial
`pending` e auditoria.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma autenticado, **When** cria item em project
   operacional de qualquer organization, **Then** o item e persistido no tenant do project.
2. **Given** usuario de organization autenticado, **When** cria item em project da
   propria organization, **Then** o item e persistido com isolamento correto.
3. **Given** project `inactive`, `finished`, `cancelled` ou `archived`, **When** tenta
   criar item, **Then** o sistema bloqueia a mutacao.
4. **Given** project de outra organization, **When** usuario de organization tenta criar
   item, **Then** o sistema nega acesso.

### User Story 2 - Listar e Consultar Inventory Items (Priority: P2)

Como usuario autorizado, quero listar e consultar itens inventariados de forma paginada,
com filtros operacionais, respeitando isolamento por organization.

**Acceptance Scenarios**:

1. **Given** usuario autorizado no project, **When** lista itens, **Then** recebe pagina
   com `items`, `page`, `page_size`, `total_items` e `total_pages`.
2. **Given** filtros por status, placa antiga, placa nova, descricao ou busca textual,
   **When** lista itens, **Then** o sistema retorna somente registros correspondentes.
3. **Given** usuario de organization X, **When** tenta consultar item de organization Y,
   **Then** o sistema retorna acesso negado.
4. **Given** item desativado logicamente, **When** lista por status `inactive`, **Then**
   o registro pode ser localizado sem exclusao fisica.

### User Story 3 - Atualizar Inventory Item (Priority: P3)

Como usuario autorizado, quero atualizar dados editaveis do item enquanto o project
permite operacoes, mantendo dados livres de campo quando divergentes.

**Acceptance Scenarios**:

1. **Given** item em project operacional, **When** atualiza campos validos, **Then** as
   alteracoes sao persistidas em transacao e auditadas.
2. **Given** item em project bloqueado, **When** tenta atualizar, **Then** o sistema
   bloqueia a mutacao.
3. **Given** placas informadas na atualizacao, **When** salva o item, **Then** `old_plate`
   e `new_plate` sao normalizadas.
4. **Given** valores monetarios informados, **When** salva o item, **Then** valores sao
   tratados como decimal e nunca como float.

### User Story 4 - Desativar e Reativar Inventory Item (Priority: P4)

Como usuario autorizado, quero desativar e reativar logicamente itens inventariados sem
remover historico, para preservar rastreabilidade operacional.

**Acceptance Scenarios**:

1. **Given** item ativo em project operacional, **When** desativa, **Then** status vira
   `inactive`, `deleted_at` e preenchido e auditoria e registrada.
2. **Given** item `inactive` em project operacional, **When** reativa, **Then** status
   volta para `pending`, `deleted_at` e limpo e auditoria e registrada.
3. **Given** item ja `inactive`, **When** tenta desativar novamente, **Then** sistema
   retorna conflito de negocio.
4. **Given** project bloqueado, **When** tenta desativar ou reativar item, **Then** a
   mutacao e rejeitada.

## Requirements

### Functional Requirements

- **FR-001**: Inventory item DEVE pertencer obrigatoriamente a uma organization.
- **FR-002**: Inventory item DEVE pertencer obrigatoriamente a um project existente.
- **FR-003**: Item NAO PODE ser criado em project de outra organization.
- **FR-004**: Usuario de organization so PODE operar itens da propria organization.
- **FR-005**: Administrador de plataforma PODE operar itens de qualquer organization.
- **FR-006**: Criacao, atualizacao, desativacao e reativacao DEVEM ser bloqueadas em
  project `inactive`, `finished`, `cancelled` ou `archived`.
- **FR-007**: Listagens DEVEM ser paginadas e aceitar filtros por `project_id`, `status`,
  `old_plate`, `new_plate`, `description` e busca textual.
- **FR-008**: `old_plate` e `new_plate` DEVEM ser normalizadas quando informadas.
- **FR-009**: Valores monetarios `used_value` e `new_value` DEVEM usar decimal no banco,
  nunca float.
- **FR-010**: `metadata` DEVE aceitar dados extras sem quebrar o contrato principal.
- **FR-011**: Campos livres como `unit_text`, `address_text` e `location_text` DEVEM ser
  mantidos como texto livre para dados de campo sujos ou divergentes.
- **FR-012**: Exclusao fisica esta fora do escopo; remocao e logica por status
  `inactive` e `deleted_at`.
- **FR-013**: Mutacoes DEVEM ocorrer em transacao e gerar auditoria.
- **FR-014**: Permissoes expostas: `inventory-items:create`, `inventory-items:read`,
  `inventory-items:update`, `inventory-items:deactivate`, `inventory-items:reactivate`.

### Non-Functional Requirements

- **NFR-001**: Feature MUST maintain >= 80% test coverage.
- **NFR-002**: Data mutations MUST use transactions with audit trail.
- **NFR-003**: Domain validations MUST occur before persistence.
- **NFR-004**: CRUD operations MUST emit structured JSON logs indexable in Kibana.
- **NFR-005**: Backend only; frontend fora de escopo.

### Key Entities

- **InventoryItem**: Bem patrimonial inventariado dentro de um project e organization.
- **InventoryItemAuditLog**: Registro imutavel de mutacoes do inventory item.

## Dependencies

- **001-user-auth**: Sessao e usuario autenticado.
- **002-organizations-crud**: Organization tenant e status ativo/inativo.
- **003-users-roles-permissions**: RBAC e resolucao de permissoes.
- **004-projects**: Project tenant, status e regras operacionais.
