# Feature Specification: Inventory Item Images / Imagens dos Itens Inventariados

**Feature Branch**: `007-inventory-item-images`

**Created**: 2026-07-07

**Status**: Draft

**Repository Scope**: Este repositorio e apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementacao de interface fica fora de escopo.

## User Scenarios & Testing

### User Story 1 - Solicitar URL de upload (Priority: P1)

Como usuario autorizado, quero solicitar uma URL pre-assinada para enviar imagem de um
item inventariado, para armazenar o arquivo em storage externo sem trafegar binario pelo
banco de dados.

**Independent Test**: Solicitar upload em item de project operacional e verificar
registro `pending_upload`, path gerado pelo backend, metadados persistidos e URL de upload.

**Acceptance Scenarios**:

1. **Given** item existente em project `draft`, `active` ou `paused`, **When** usuario
   autorizado solicita upload com `original_name`, `mime_type`, `size_bytes` e checksum
   opcional, **Then** o sistema cria imagem `pending_upload` e retorna URL pre-assinada.
2. **Given** usuario de organization X, **When** tenta solicitar upload para item de
   organization Y, **Then** o sistema nega acesso.
3. **Given** project `inactive`, `finished`, `cancelled` ou `archived`, **When** tenta
   criar imagem, **Then** o sistema bloqueia a mutacao.
4. **Given** mime type ou tamanho invalido, **When** solicita upload, **Then** o sistema
   retorna erro de validacao sem criar registro parcial.
5. **Given** item ja possui 3 imagens nao removidas, **When** solicita novo upload,
   **Then** o sistema rejeita por limite de negocio.

### User Story 2 - Confirmar upload (Priority: P2)

Como cliente de API, quero confirmar que o arquivo foi enviado ao storage, para que a
imagem passe a ficar disponivel para visualizacao/download.

**Acceptance Scenarios**:

1. **Given** imagem `pending_upload` no escopo do usuario, **When** confirma upload,
   **Then** status vira `uploaded` e auditoria e registrada.
2. **Given** imagem de outra organization, **When** tenta confirmar, **Then** acesso e
   negado.
3. **Given** imagem removida, **When** tenta confirmar upload, **Then** operacao e
   rejeitada.

### User Story 3 - Listar e consultar imagens (Priority: P3)

Como usuario autorizado, quero listar e consultar metadados das imagens de um item, para
inspecionar evidencias sem expor detalhes internos de storage.

**Acceptance Scenarios**:

1. **Given** item no escopo permitido, **When** lista imagens, **Then** recebe resposta
   paginada com metadados e sem binario.
2. **Given** imagem existente, **When** consulta detalhe, **Then** recebe metadados sem
   `bucket` e `path` internos em resposta publica.
3. **Given** item ou imagem de outra organization, **When** usuario de organization tenta
   consultar, **Then** acesso e negado ou recurso nao e revelado conforme padrao de erro.

### User Story 4 - Gerar URL de download/visualizacao (Priority: P4)

Como usuario autorizado, quero gerar URL pre-assinada de download/visualizacao, para
acessar temporariamente o arquivo real no storage externo.

**Acceptance Scenarios**:

1. **Given** imagem `uploaded` no escopo permitido, **When** solicita download-url,
   **Then** o sistema retorna URL pre-assinada com expiracao curta e registra log/auditoria.
2. **Given** imagem `pending_upload`, `failed` ou `removed`, **When** solicita download,
   **Then** o sistema rejeita a operacao.
3. **Given** usuario sem permissao `inventory-item-images:download`, **When** solicita
   download-url, **Then** acesso e negado.

### User Story 5 - Remover imagem logicamente (Priority: P5)

Como usuario autorizado, quero remover logicamente uma imagem, para preservar
rastreabilidade sem apagar fisicamente o banco ou o storage nesta primeira versao.

**Acceptance Scenarios**:

1. **Given** imagem existente em project operacional, **When** remove imagem, **Then**
   status vira `removed`, `deleted_at` e preenchido e auditoria e registrada.
2. **Given** imagem ja removida, **When** tenta remover novamente, **Then** sistema
   retorna conflito de negocio.
3. **Given** project bloqueado, **When** tenta remover, **Then** a mutacao e rejeitada.

## Requirements

### Functional Requirements

- **FR-001**: Inventory item image DEVE pertencer obrigatoriamente a uma organization.
- **FR-002**: Inventory item image DEVE pertencer obrigatoriamente a um inventory item.
- **FR-003**: O vinculo com project DEVE ser derivado e validado pelo inventory item.
- **FR-004**: Usuario de organization so PODE operar imagens da propria organization.
- **FR-005**: Administrador de plataforma PODE operar imagens de qualquer organization.
- **FR-006**: Criacao e remocao DEVEM ser bloqueadas em project `inactive`, `finished`,
  `cancelled` ou `archived`.
- **FR-007**: O banco DEVE armazenar apenas metadados da imagem; arquivo binario fica em
  storage externo.
- **FR-008**: O `path` de storage DEVE ser gerado pelo backend e nunca confiado
  integralmente ao cliente.
- **FR-009**: Mime types aceitos inicialmente: `image/jpeg`, `image/jpg`, `image/png`,
  `image/webp`.
- **FR-010**: Tamanho maximo por imagem DEVE ser configuravel por ambiente.
- **FR-011**: A primeira versao DEVE permitir no maximo 3 imagens nao removidas por item.
- **FR-012**: Criacao, confirmacao de upload e remocao logica DEVEM ocorrer em transacao
  e gerar auditoria.
- **FR-013**: Geracao de URL sensivel de download DEVE gerar log estruturado e/ou auditoria.
- **FR-014**: Exclusao fisica do banco e exclusao fisica no storage estao fora do escopo.
- **FR-015**: Respostas publicas NAO DEVEM expor `bucket` e `path` internos.
- **FR-016**: Permissoes expostas: `inventory-item-images:create`,
  `inventory-item-images:read`, `inventory-item-images:update`,
  `inventory-item-images:remove`, `inventory-item-images:download`.

### Non-Functional Requirements

- **NFR-001**: Feature MUST maintain >= 80% test coverage.
- **NFR-002**: List endpoints MUST use pagination.
- **NFR-003**: Data mutations MUST use transactions with audit trail.
- **NFR-004**: Domain validations MUST occur before persistence.
- **NFR-005**: CRUD operations and download URL generation MUST emit structured JSON logs.
- **NFR-006**: Backend only; frontend fora de escopo.
- **NFR-007**: Storage configuration MUST be externalized by environment and prepared for S3.

### Key Entities

- **InventoryItemImage**: Metadados de imagem/foto vinculada a um item inventariado.
- **InventoryItemImageAuditLog**: Registro imutavel de mutacoes e eventos sensiveis.
- **StorageSigner**: Porta de infraestrutura para gerar URLs pre-assinadas de upload e download.

## Dependencies

- **001-user-auth**: Sessao e usuario autenticado.
- **002-organizations-crud**: Organization tenant e status ativo/inativo.
- **003-users-roles-permissions**: RBAC e resolucao de permissoes.
- **004-projects**: Project tenant, status e regras operacionais.
- **006-inventory-items**: Item inventariado, escopo e existencia.
