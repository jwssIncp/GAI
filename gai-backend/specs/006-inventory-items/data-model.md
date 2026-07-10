# Data Model: Inventory Items

## inventory_items

| Campo | Tipo logico | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | Sim | PK auto-incremento |
| organization_id | BIGINT UNSIGNED | Sim | FK para organizations |
| project_id | BIGINT UNSIGNED | Sim | FK para projects |
| external_item_id | VARCHAR(100) | Nao | Identificador vindo de sistema externo |
| sequence | VARCHAR(50) | Nao | Sequencia textual de campo/importacao |
| old_plate | VARCHAR(100) | Nao | Normalizada quando informada |
| new_plate | VARCHAR(100) | Nao | Normalizada quando informada |
| unit_text | VARCHAR(255) | Nao | Texto livre |
| address_text | TEXT | Nao | Texto livre |
| location_text | TEXT | Nao | Texto livre |
| description | TEXT | Nao | Descricao do bem |
| brand | VARCHAR(100) | Nao | Marca |
| model | VARCHAR(100) | Nao | Modelo |
| serial_number | VARCHAR(100) | Nao | Numero de serie |
| capacity | VARCHAR(100) | Nao | Capacidade textual |
| year | INT | Nao | Ano de fabricacao/aquisicao quando conhecido |
| notes | TEXT | Nao | Observacoes |
| source | VARCHAR(50) | Nao | Origem: manual/import/etc. |
| used_value | DECIMAL(15,2) | Nao | Valor usado, nunca float |
| new_value | DECIMAL(15,2) | Nao | Valor novo, nunca float |
| status | VARCHAR(20) | Sim | pending/evaluated/divergent/not_found/duplicated/removed/inactive |
| metadata | JSON | Nao | Dados extras |
| created_by_id | BIGINT UNSIGNED | Nao | FK para users |
| updated_by_id | BIGINT UNSIGNED | Nao | FK para users |
| created_at | DATETIME(3) | Sim | Timestamp de criacao |
| updated_at | DATETIME(3) | Sim | Timestamp de atualizacao |
| deleted_at | DATETIME(3) | Nao | Preenchido na desativacao logica |

## inventory_item_audit_logs

| Campo | Tipo logico | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | Sim | PK auto-incremento |
| inventory_item_id | BIGINT UNSIGNED | Sim | FK para inventory_items |
| organization_id | BIGINT UNSIGNED | Sim | FK para organizations |
| project_id | BIGINT UNSIGNED | Sim | FK para projects |
| operation | VARCHAR(50) | Sim | create/update/deactivate/reactivate |
| performed_by | BIGINT UNSIGNED | Nao | FK para users |
| changes | JSON | Sim | Mapa de alteracoes |
| created_at | DATETIME(3) | Sim | Timestamp da auditoria |

## Indices

- `idx_inventory_items_project_status (project_id, status)`
- `idx_inventory_items_organization_project (organization_id, project_id)`
- `idx_inventory_items_old_plate (old_plate)`
- `idx_inventory_items_new_plate (new_plate)`
- `idx_inventory_items_external_item_id (external_item_id)`
- `idx_inventory_item_audit_item_created (inventory_item_id, created_at)`
- `idx_inventory_item_audit_project_created (project_id, created_at)`

## Regras

- `organization_id` do item sempre deriva do project.
- Mutacoes sao bloqueadas quando o project bloqueia operacoes.
- `old_plate` e `new_plate` sao persistidas em formato normalizado: trim, uppercase e
  remocao de separadores comuns.
- Valores monetarios trafegam no contrato como string decimal e sao persistidos como
  DECIMAL(15,2).
