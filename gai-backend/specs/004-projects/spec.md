# Feature Specification: Projects

**Feature Branch**: `004-projects`

**Created**: 2026-07-07

**Status**: Draft

**Repository Scope**: Este repositorio e apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementacao de interface fica fora de escopo.

## User Scenarios & Testing

### User Story 1 - Criar Project (Priority: P1)

Como administrador autorizado, quero criar um project dentro de uma organization ativa,
para iniciar o controle operacional de um inventario patrimonial.

**Independent Test**: Criar project com `organization_id` valido e verificar status
inicial `draft`, vinculo ao tenant, criador e auditoria.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma autenticado, **When** cria project para uma
   organization ativa, **Then** o project e persistido com status `draft`.
2. **Given** administrador de organization autenticado, **When** cria project, **Then**
   o project fica vinculado obrigatoriamente a propria organization do usuario.
3. **Given** organization inativa ou inexistente, **When** tenta criar project, **Then**
   o sistema rejeita a operacao sem criar registro parcial.
4. **Given** `end_date` anterior a `start_date`, **When** tenta criar project, **Then**
   o sistema retorna erro de validacao.

### User Story 2 - Listar e Consultar Projects (Priority: P2)

Como usuario autorizado, quero listar projects de forma paginada e consultar detalhes,
respeitando isolamento por organization.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma, **When** lista projects, **Then** pode filtrar
   por `organization_id` e consultar qualquer project.
2. **Given** usuario de organization, **When** lista projects, **Then** recebe apenas
   projects da propria organization.
3. **Given** project de outra organization, **When** usuario de organization consulta,
   **Then** o sistema retorna acesso negado.

### User Story 3 - Atualizar Project (Priority: P3)

Como usuario autorizado, quero atualizar dados editaveis do project enquanto ele estiver
em estado operacional permitido.

**Acceptance Scenarios**:

1. **Given** project em `draft`, `active` ou `paused`, **When** atualiza campos validos,
   **Then** o sistema persiste alteracoes e registra auditoria.
2. **Given** project `inactive`, `finished`, `cancelled` ou `archived`, **When** tenta
   atualizar dados operacionais, **Then** o sistema bloqueia a mutacao.
3. **Given** tentativa de trocar `organization_id`, **When** atualiza project, **Then**
   o campo e ignorado pelo contrato e rejeitado pela validacao global.

### User Story 4 - Controlar Status (Priority: P4)

Como usuario autorizado, quero ativar, pausar, retomar, finalizar, cancelar e arquivar
projects por comandos explicitos, para preservar um historico operacional coerente.

**Acceptance Scenarios**:

1. **Given** project `draft`, **When** ativa, **Then** status vira `active`.
2. **Given** project `active`, **When** pausa, **Then** status vira `paused`; quando
   retoma um project `paused`, o status volta para `active`.
3. **Given** project `active` sem pendencias, **When** finaliza, **Then** status vira
   `finished` e `finished_at` e preenchido.
4. **Given** project `draft`, `active` ou `paused` sem pendencias tecnicas ou operacionais,
   **When** cancela, **Then** status vira `cancelled`.
5. **Given** project `finished` ou `cancelled` sem pendencias tecnicas ou operacionais,
   **When** arquiva, **Then** status vira `archived`.
6. **Given** uma transicao fora da matriz, **When** envia o comando, **Then** recebe
   `409 PROJECT_STATUS_TRANSITION_NOT_ALLOWED` com status e acao solicitada.
7. **Given** pendencias que bloqueiam a transicao, **When** finaliza, cancela,
   arquiva ou usa a desativacao legada, **Then** recebe
   `409 PROJECT_HAS_OPEN_OPERATIONS` com tipos e contagens.

Os endpoints `deactivate` e `reactivate` permanecem apenas para compatibilidade com
registros legados `inactive` e estao marcados como deprecated no contrato.

## Requirements

### Functional Requirements

- **FR-001**: Project DEVE pertencer obrigatoriamente a uma organization ativa.
- **FR-002**: Project DEVE ter isolamento por organization; usuario de organization so
  opera projects da propria organization.
- **FR-003**: Administrador de plataforma PODE operar projects de qualquer organization.
- **FR-004**: Listagens DEVEM ser paginadas e aceitar filtros por organization, status e busca textual.
- **FR-005**: `end_date` NAO PODE ser anterior a `start_date`.
- **FR-006**: Status inicial padrao DEVE ser `draft`.
- **FR-007**: Exclusao fisica esta fora do escopo.
- **FR-008**: Mutacoes DEVEM ocorrer em transacao e gerar auditoria.
- **FR-009**: Projects `inactive`, `finished`, `cancelled` ou `archived` DEVEM bloquear
  mutacoes operacionais futuras, exceto transicoes explicitamente permitidas.
- **FR-010**: Permissoes expostas: `projects:create`, `projects:read`,
  `projects:update`, `projects:activate`, `projects:pause`, `projects:resume`,
  `projects:finish`, `projects:cancel`, `projects:archive` e, apenas para legado,
  `projects:deactivate` e `projects:reactivate`.
- **FR-011**: Novos projects DEVEM informar `company_id`; a company deve pertencer
  a mesma organization e estar ativa. Registros legados sem `company_id` permanecem
  permitidos no banco por compatibilidade de desenvolvimento.
- **FR-012**: `PATCH /projects/:id` NAO DEVE aceitar `status`; mudancas de estado
  ocorrem somente pelos endpoints de acao.
- **FR-013**: `description` aceita no maximo 5000 caracteres; nomes e descricoes
  DEVEM ser normalizados antes da validacao, e datas DEVEM usar `YYYY-MM-DD`.
- **FR-014**: Respostas de project DEVEM expor `available_actions` derivado da mesma
  matriz de transicao usada pelo backend, com `action` e `permission`.
- **FR-015**: A validacao de prontidao, a troca de status por compare-and-set e a
  auditoria DEVEM ocorrer na mesma transacao para evitar dupla transicao concorrente.
- **FR-016**: `PATCH /projects/:id` DEVE atualizar apenas `name`, `description`,
  `start_date` e `end_date`; `settings` e `metadata` nao fazem parte do contrato de PATCH.
- **FR-017**: A persistencia do PATCH DEVE usar compare-and-set em `status` e
  `updated_at`, atualizar somente os campos editaveis e gerar auditoria na mesma
  transacao. Uma alteracao concorrente DEVE retornar
  `409 PROJECT_CONCURRENT_MODIFICATION` sem sobrescrever `status` ou `finished_at`.
- **FR-018**: Finalizacao, cancelamento, arquivamento e desativacao legada DEVEM
  verificar o conjunto completo de pendencias tecnicas e operacionais.

### Non-Functional Requirements

- **NFR-001**: Feature MUST maintain >= 80% test coverage.
- **NFR-002**: Data mutations MUST use transactions with audit trail.
- **NFR-003**: Domain validations MUST occur before persistence.
- **NFR-004**: CRUD operations MUST emit structured JSON logs indexable in Kibana.
- **NFR-005**: Backend only; frontend fora de escopo.

### Key Entities

- **Project**: Projeto de inventario patrimonial dentro de uma organization.
- **ProjectAuditLog**: Registro imutavel de mutacoes no project.

## Dependencies

- **001-user-auth**: Sessao e usuario autenticado.
- **002-organizations-crud**: Organization tenant e status ativo/inativo.
- **003-users-roles-permissions**: RBAC e resolucao de permissoes.
