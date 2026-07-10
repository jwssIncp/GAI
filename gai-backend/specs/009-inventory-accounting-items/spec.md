# Feature Specification: Inventory Accounting Items / Importacao da Base Contabil

**Feature Branch**: `009-inventory-accounting-items`

**Created**: 2026-07-08

**Status**: Draft

**Repository Scope**: Backend GAI. O projeto usa NestJS com TypeORM, migrations
em `src/migrations` e contratos OpenAPI em `specs/**/contracts`.

## User Scenarios & Testing

### User Story 1 - Importar Base Contabil XLSX (Priority: P1)

Como usuario autorizado, quero importar uma planilha XLSX da base contabil para
um project operacional, para preparar conciliacao futura com o inventario fisico.

**Independent Test**: Enviar XLSX com colunas esperadas, validar organization,
project, permissao, criacao de batch, processamento de linhas, auditoria e
contadores de sucesso/falha.

**Acceptance Scenarios**:

1. **Given** usuario da propria organization, **When** importa XLSX em project
   operacional, **Then** o sistema cria/atualiza itens contabeis e finaliza o batch.
2. **Given** project de outra organization, **When** tenta importar, **Then** o
   sistema nega acesso.
3. **Given** project `inactive`, `finished`, `cancelled` ou `archived`, **When**
   tenta importar, **Then** a mutacao e bloqueada.
4. **Given** linhas invalidas, **When** importa, **Then** erros ficam rastreaveis
   por linha em `metadata.error_report`.

### User Story 2 - Listar e Consultar Itens Contabeis (Priority: P2)

Como usuario autorizado, quero listar itens contabeis de um project com paginacao
e filtros por placa, status, codigos e texto.

### User Story 3 - Atualizar Manualmente Item Contabil (Priority: P3)

Como usuario autorizado, quero corrigir dados importados enquanto o project ainda
permite operacoes, registrando auditoria com antes/depois.

### User Story 4 - Desativar e Reativar Item Contabil (Priority: P4)

Como usuario autorizado, quero remover logicamente e reativar itens contabeis sem
exclusao fisica e preservando historico.

### User Story 5 - Consultar Batches e Erros (Priority: P5)

Como usuario autorizado, quero consultar batches de importacao e baixar/visualizar
relatorio de erros para saneamento da planilha.

## Requirements

### Functional Requirements

- **FR-001**: Inventory accounting item DEVE pertencer a uma organization e project.
- **FR-002**: Usuario de organization so PODE operar dados da propria organization.
- **FR-003**: Administrador de plataforma PODE operar qualquer organization.
- **FR-004**: Importacao/mutacao DEVE ser bloqueada para project `inactive`,
  `finished`, `cancelled` ou `archived`.
- **FR-005**: Listagens DEVEM ser paginadas.
- **FR-006**: Filtros DEVEM incluir `project_id`, `plate`, `status`,
  `base_code`, `investor_code`, `description` e `search`.
- **FR-007**: Placas DEVEM ser normalizadas quando informadas.
- **FR-008**: `acquisition_value` DEVE usar decimal no banco.
- **FR-009**: `acquisition_date` DEVE ser data real.
- **FR-010**: Textos vindos de planilha DEVEM ser aparados e strings vazias viram null.
- **FR-011**: `metadata` DEVE guardar colunas extras da planilha.
- **FR-012**: Exclusao fisica esta fora de escopo; remocao e logica por `inactive`
  e `deleted_at`.
- **FR-013**: Importacao e atualizacao manual DEVEM registrar auditoria.
- **FR-014**: Erros de importacao DEVEM ser rastreaveis por linha.
- **FR-015**: Sem fila existente, o servico DEVE manter processamento isolado para
  futura migracao para job assincrono.

### Permissions

- `inventory-accounting-items:create`
- `inventory-accounting-items:read`
- `inventory-accounting-items:update`
- `inventory-accounting-items:deactivate`
- `inventory-accounting-items:reactivate`
- `inventory-accounting-items:import`
- `inventory-accounting-items:export-errors`

## Key Entities

- **InventoryAccountingItem**: Item da base contabil/patrimonial importada.
- **AccountingImportBatch**: Lote de importacao XLSX e totais de processamento.
- **InventoryAccountingItemAuditLog**: Registro imutavel de mutacoes.

## Dependencies

- **001-user-auth**: Sessao e usuario autenticado.
- **003-users-roles-permissions**: Permissoes.
- **004-projects**: Tenant, status e bloqueio de mutacoes operacionais.
