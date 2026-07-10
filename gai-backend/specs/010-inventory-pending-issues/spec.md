# Feature Specification: Inventory Pending Issues / Pendencias e Divergencias

**Feature Branch**: `010-inventory-pending-issues`

**Created**: 2026-07-08

**Status**: Draft

**Repository Scope**: Backend GAI. O projeto usa NestJS com TypeORM, migrations
em `src/migrations`, guards de sessao/permissao e contratos OpenAPI em `specs`.

## User Scenarios & Testing

### User Story 1 - Criar Pendencia Manual (Priority: P1)

Como usuario autorizado, quero registrar uma pendencia patrimonial em um project
operacional, vinculando opcionalmente item fisico e/ou item contabil.

**Acceptance Scenarios**:

1. **Given** usuario da propria organization, **When** cria pendencia em project
   operacional, **Then** a pendencia nasce `open` e e auditada.
2. **Given** project de outra organization, **When** tenta criar pendencia, **Then**
   acesso e negado.
3. **Given** project bloqueado, **When** tenta criar, **Then** mutacao e rejeitada.

### User Story 2 - Listar e Consultar Pendencias (Priority: P2)

Listagens devem ser paginadas, isoladas por organization e filtrar por `type`,
`status`, `severity`, `inventory_item_id`, `accounting_item_id`, `plate` e `search`.
Pendencias `ignored` nao aparecem por padrao quando `status` nao e informado.

### User Story 3 - Atualizar, Resolver, Ignorar e Cancelar (Priority: P3)

Mutacoes operacionais atualizam status/campos de resolucao, preservam historico e
registram auditoria com antes/depois.

### User Story 4 - Gerar Pendencias Automaticamente (Priority: P4)

O backend compara `inventory_items` e `inventory_accounting_items` do mesmo project,
gera pendencias abertas para itens sem correspondencia e divergencias basicas, e evita
duplicar pendencias abertas existentes.

## Requirements

- **FR-001**: Toda pendencia DEVE pertencer a organization e project.
- **FR-002**: Pendencia PODE se vincular a inventory item, accounting item, ou ambos.
- **FR-003**: Usuario de organization so PODE operar pendencias da propria organization.
- **FR-004**: Platform admin PODE operar qualquer organization.
- **FR-005**: Criar/atualizar/resolver/ignorar/cancelar/gerar DEVE ser bloqueado em
  project `inactive`, `finished`, `cancelled` ou `archived`.
- **FR-006**: Nao ha exclusao fisica; cancelamento e status logico `cancelled`.
- **FR-007**: Listagens DEVEM ser paginadas.
- **FR-008**: `old_value`, `new_value` e `metadata` DEVEM aceitar JSON.
- **FR-009**: Resolver pendencia de divergencia patrimonial relevante DEVE exigir
  `resolution_notes`.
- **FR-010**: `resolved_by_id/resolved_at` e `ignored_by_id/ignored_at` DEVEM ser
  preenchidos nos fluxos correspondentes.
- **FR-011**: Auditoria DEVE registrar criacao, atualizacao, resolucao, ignore,
  cancelamento e geracao.
- **FR-012**: O sistema DEVE evitar duplicidade de pendencias abertas para
  `project_id`, `type`, `inventory_item_id` e `accounting_item_id`.

## Permissions

- `inventory-pending-issues:create`
- `inventory-pending-issues:read`
- `inventory-pending-issues:update`
- `inventory-pending-issues:resolve`
- `inventory-pending-issues:ignore`
- `inventory-pending-issues:cancel`
- `inventory-pending-issues:generate`

## Key Entities

- **InventoryPendingIssue**: Pendencia patrimonial em um project.
- **InventoryPendingIssueAuditLog**: Historico imutavel de mutacoes.

## Dependencies

- **004-projects**: Escopo e bloqueio de mutacoes operacionais.
- **006-inventory-items**: Itens fisicos para vinculo e geracao.
- **009-inventory-accounting-items**: Itens contabeis para vinculo e geracao.
