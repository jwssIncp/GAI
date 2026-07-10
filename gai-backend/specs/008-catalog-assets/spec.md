# Feature Specification: Catalog Assets / Catalogo de Ativos

**Feature Branch**: `008-catalog-assets`

**Created**: 2026-07-07

**Status**: Draft

**Repository Scope**: Este repositorio e apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementacao de interface fica fora de escopo.

## User Scenarios & Testing

### User Story 1 - Cadastrar Catalog Asset (Priority: P1)

Como usuario autorizado, quero cadastrar uma descricao padronizada de ativo dentro da
minha organization, para apoiar classificacao e padronizacao futura dos inventory items.

**Independent Test**: Criar catalog asset com `organization_id` valido, validar status
inicial `active`, descricao normalizada, isolamento por organization, unicidade e auditoria.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma autenticado, **When** cria catalog asset para
   uma organization ativa, **Then** o registro e persistido com status `active`.
2. **Given** usuario de organization autenticado, **When** cria catalog asset, **Then**
   o registro fica vinculado obrigatoriamente a propria organization.
3. **Given** description duplicada na mesma organization com diferenca de caixa, acento
   ou espacos extras, **When** tenta criar, **Then** o sistema rejeita por conflito.
4. **Given** a mesma description em outra organization, **When** cria catalog asset,
   **Then** o sistema permite o cadastro.

### User Story 2 - Listar e Consultar Catalog Assets (Priority: P2)

Como usuario autorizado, quero listar e consultar catalog assets de forma paginada,
com filtros por status, category e busca textual, respeitando isolamento por organization.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma, **When** lista catalog assets, **Then** pode
   filtrar por `organization_id`, `status`, `category` e `search`.
2. **Given** usuario de organization, **When** lista catalog assets, **Then** recebe
   apenas registros da propria organization.
3. **Given** catalog asset de outra organization, **When** usuario de organization
   consulta, **Then** o sistema retorna acesso negado.

### User Story 3 - Atualizar Catalog Asset (Priority: P3)

Como usuario autorizado, quero atualizar description, category e metadata do catalog
asset sem perder rastreabilidade, para manter o catalogo padronizado.

**Acceptance Scenarios**:

1. **Given** catalog asset existente no escopo permitido, **When** atualiza campos
   validos, **Then** alteracoes sao persistidas em transacao e auditadas.
2. **Given** atualizacao que geraria description duplicada na mesma organization,
   **When** submete alteracao, **Then** o sistema rejeita por conflito.
3. **Given** tentativa de trocar `organization_id`, **When** atualiza catalog asset,
   **Then** o campo nao e aceito pelo contrato.

### User Story 4 - Desativar e Reativar Catalog Asset (Priority: P4)

Como usuario autorizado, quero desativar e reativar catalog assets sem exclusao fisica,
para preservar historico e evitar impacto automatico em itens inventariados antigos.

**Acceptance Scenarios**:

1. **Given** catalog asset ativo, **When** desativa, **Then** status vira `inactive`,
   `deleted_at` e preenchido e auditoria e registrada.
2. **Given** catalog asset inativo, **When** reativa, **Then** status volta para
   `active`, `deleted_at` e limpo e auditoria e registrada.
3. **Given** catalog asset ja inativo, **When** tenta desativar novamente, **Then**
   sistema retorna conflito de negocio.
4. **Given** vinculo futuro com inventory items, **When** desativa catalog asset, **Then**
   inventory items existentes nao sao alterados automaticamente.

## Requirements

### Functional Requirements

- **FR-001**: Catalog asset DEVE pertencer obrigatoriamente a uma organization ativa.
- **FR-002**: Usuario de organization so PODE operar catalog assets da propria organization.
- **FR-003**: Administrador de plataforma PODE operar catalog assets de qualquer organization.
- **FR-004**: `description` e obrigatoria, deve ser limpa de espacos extras e possuir texto util.
- **FR-005**: O sistema DEVE manter uma forma normalizada de `description` para comparar
  duplicidade ignorando caixa, acentos e espacos extras.
- **FR-006**: Nao PODE haver duplicidade de description normalizada dentro da mesma organization.
- **FR-007**: A mesma description PODE existir em organizations diferentes.
- **FR-008**: `category` e opcional nesta primeira versao.
- **FR-009**: `metadata` DEVE aceitar dados extras sem quebrar o contrato principal.
- **FR-010**: Listagens DEVEM ser paginadas e aceitar filtros por `organization_id`,
  `status`, `category` e busca textual por `description`.
- **FR-011**: Exclusao fisica esta fora do escopo; remocao e logica por status
  `inactive` e `deleted_at`.
- **FR-012**: Mutacoes DEVEM ocorrer em transacao e gerar auditoria.
- **FR-013**: Desativar catalog asset NAO DEVE alterar automaticamente inventory items.
- **FR-014**: Permissoes expostas: `catalog-assets:create`, `catalog-assets:read`,
  `catalog-assets:update`, `catalog-assets:deactivate`, `catalog-assets:reactivate`.

### Non-Functional Requirements

- **NFR-001**: Feature MUST maintain >= 80% test coverage.
- **NFR-002**: Data mutations MUST use transactions with audit trail.
- **NFR-003**: Domain validations MUST occur before persistence.
- **NFR-004**: CRUD operations MUST emit structured JSON logs indexable in Kibana.
- **NFR-005**: Backend only; frontend fora de escopo.

### Key Entities

- **CatalogAsset**: Descricao padronizada de ativo patrimonial dentro de uma organization.
- **CatalogAssetAuditLog**: Registro imutavel de mutacoes do catalog asset.

## Dependencies

- **001-user-auth**: Sessao e usuario autenticado.
- **002-organizations-crud**: Organization tenant e status ativo/inativo.
- **003-users-roles-permissions**: RBAC e resolucao de permissoes.
- **006-inventory-items**: Consumidor futuro do catalogo, sem vinculo obrigatorio nesta versao.
