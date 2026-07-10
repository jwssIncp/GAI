# Feature Specification: Field Agents / Inventariantes

**Feature Branch**: `005-field-agents`

**Created**: 2026-07-07

**Status**: Draft

**Repository Scope**: Este repositorio e apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementacao de interface fica fora de escopo.

## User Scenarios & Testing

### User Story 1 - Cadastrar Field Agent (Priority: P1)

Como administrador autorizado, quero cadastrar inventariantes dentro de uma organization,
com ou sem vinculo a usuario do sistema, para controlar equipe operacional e financeira
dos projetos de inventario patrimonial.

**Independent Test**: Criar field agent com `organization_id` valido, validar status
inicial `active`, isolamento por organization e auditoria.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma autenticado, **When** cria field agent para
   uma organization ativa, **Then** o registro e persistido com status `active`.
2. **Given** administrador de organization autenticado, **When** cria field agent,
   **Then** o registro fica vinculado obrigatoriamente a propria organization.
3. **Given** `user_id` informado, **When** o usuario pertence a outra organization,
   **Then** o sistema rejeita a operacao por conflito de escopo.
4. **Given** `email` ou `document` invalidos, **When** tenta criar field agent, **Then**
   o sistema retorna erro de validacao sem criar registro parcial.

### User Story 2 - Listar e Consultar Field Agents (Priority: P2)

Como usuario autorizado, quero listar e consultar inventariantes de forma paginada,
respeitando RBAC e isolamento por organization.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma, **When** lista field agents, **Then** pode
   filtrar por `organization_id`, status e busca textual.
2. **Given** usuario de organization, **When** lista field agents, **Then** recebe
   apenas registros da propria organization.
3. **Given** field agent de outra organization, **When** usuario de organization consulta,
   **Then** o sistema retorna acesso negado.

### User Story 3 - Atualizar, Desativar e Reativar Field Agents (Priority: P3)

Como administrador autorizado, quero atualizar dados e controlar o status do inventariante
sem exclusao fisica, para preservar historico operacional.

**Acceptance Scenarios**:

1. **Given** field agent ativo, **When** atualiza campos validos, **Then** alteracoes
   sao persistidas em transacao e auditadas.
2. **Given** field agent ativo ou bloqueado, **When** desativa, **Then** status vira
   `inactive`, novas operacoes sao bloqueadas e vinculos historicos permanecem.
3. **Given** field agent inativo, **When** reativa, **Then** status vira `active`.
4. **Given** field agent vinculado a projects ativos, **When** desativa, **Then** o
   cadastro fica inativo sem apagar nem finalizar automaticamente os vinculos.

### User Story 4 - Vincular Field Agent a Project (Priority: P4)

Como usuario autorizado, quero vincular inventariantes a projects operacionais da mesma
organization, com papel, status, datas e notas, para planejar execucao de inventario.

**Acceptance Scenarios**:

1. **Given** project `draft`, `active` ou `paused` e field agent ativo da mesma
   organization, **When** cria vinculo, **Then** assignment e persistido com status
   `active` e auditoria.
2. **Given** project `inactive`, `finished`, `cancelled` ou `archived`, **When** tenta
   vincular field agent, **Then** o sistema rejeita a operacao.
3. **Given** field agent ou project de outra organization, **When** tenta vincular,
   **Then** o sistema rejeita por escopo.
4. **Given** assignment ativo, **When** remove, **Then** status vira `finished` sem
   exclusao fisica.

## Requirements

### Functional Requirements

- **FR-001**: Field agent DEVE pertencer obrigatoriamente a uma organization ativa.
- **FR-002**: `user_id` DEVE ser opcional; quando informado, o usuario DEVE pertencer
  a mesma organization, exceto usuario de plataforma quando a regra futura permitir.
- **FR-003**: Listagens DEVEM ser paginadas e aceitar filtros por organization, status
  e busca textual.
- **FR-004**: Usuario de organization so PODE operar field agents da propria organization.
- **FR-005**: Administrador de plataforma PODE operar field agents de qualquer organization.
- **FR-006**: Email e document sao opcionais; quando informados DEVEM ser validados.
- **FR-007**: Exclusao fisica esta fora do escopo; remocao e desativacao sao logicas.
- **FR-008**: Mutacoes DEVEM ocorrer em transacao e gerar auditoria.
- **FR-009**: Desativar field agent NAO DEVE apagar historico de projects nem assignments.
- **FR-010**: Assignment NAO PODE cruzar organizations entre project e field agent.
- **FR-011**: Assignment NAO PODE ser criado em project `inactive`, `finished`,
  `cancelled` ou `archived`.
- **FR-012**: Permissoes expostas: `field-agents:create`, `field-agents:read`,
  `field-agents:update`, `field-agents:deactivate`, `field-agents:reactivate`,
  `project-field-agents:assign`, `project-field-agents:read`,
  `project-field-agents:update`, `project-field-agents:remove`.

### Non-Functional Requirements

- **NFR-001**: Feature MUST maintain >= 80% test coverage.
- **NFR-002**: Data mutations MUST use transactions with audit trail.
- **NFR-003**: Domain validations MUST occur before persistence.
- **NFR-004**: CRUD operations MUST emit structured JSON logs indexable in Kibana.
- **NFR-005**: Backend only; frontend fora de escopo.

### Key Entities

- **FieldAgent**: Inventariante operacional/financeiro dentro de uma organization.
- **ProjectFieldAgent**: Vinculo de inventariante a project.
- **FieldAgentAuditLog**: Registro imutavel de mutacoes do cadastro e assignments.

## Dependencies

- **001-user-auth**: Sessao e usuario autenticado.
- **002-organizations-crud**: Organization tenant e status ativo/inativo.
- **003-users-roles-permissions**: RBAC e resolucao de permissoes.
- **004-projects**: Project tenant, status e regras operacionais.
