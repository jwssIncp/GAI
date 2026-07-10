# Data Model: Catalog Assets

## catalog_assets

- `id`: BIGINT UNSIGNED, PK auto-incremento.
- `organization_id`: BIGINT UNSIGNED, FK obrigatoria para `organizations.id`.
- `description`: VARCHAR(255), descricao canonica exibida ao usuario.
- `description_normalized`: VARCHAR(255), descricao normalizada para unicidade por organization.
- `category`: VARCHAR(100), opcional.
- `status`: VARCHAR(20), `active` ou `inactive`.
- `metadata`: JSON, opcional.
- `created_by_id`: BIGINT UNSIGNED, FK opcional para `users.id`.
- `updated_by_id`: BIGINT UNSIGNED, FK opcional para `users.id`.
- `created_at`: DATETIME(3).
- `updated_at`: DATETIME(3).
- `deleted_at`: DATETIME(3), usado apenas na desativacao logica.

### Indexes and Constraints

- `idx_catalog_assets_org_status` em (`organization_id`, `status`).
- `idx_catalog_assets_org_category` em (`organization_id`, `category`).
- `uq_catalog_assets_org_description_normalized` unico em (`organization_id`, `description_normalized`).
- FKs para organization, usuario criador e usuario atualizador.

## catalog_asset_audit_logs

- `id`: BIGINT UNSIGNED, PK auto-incremento.
- `catalog_asset_id`: BIGINT UNSIGNED, FK para `catalog_assets.id`.
- `organization_id`: BIGINT UNSIGNED, FK para `organizations.id`.
- `operation`: VARCHAR(50), uma das operacoes de auditoria.
- `performed_by`: BIGINT UNSIGNED, FK opcional para `users.id`.
- `changes`: JSON, diff dos campos alterados.
- `created_at`: DATETIME(3).

## Status

- `active`: disponivel para uso.
- `inactive`: desativado logicamente, preservado para historico.

## Normalizacao de description

Normalizacao inicial no backend:

- trim;
- colapso de multiplos espacos para um espaco;
- lower case;
- remocao de acentos via Unicode normalization;
- remocao de marcas combinantes.

Essa chave normalizada e persistida para que o banco reforce unicidade por organization.
