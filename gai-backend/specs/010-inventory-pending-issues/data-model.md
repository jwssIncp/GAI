# Data Model: Inventory Pending Issues

## inventory_pending_issues

- `id`: BIGINT UNSIGNED PK
- `organization_id`: BIGINT UNSIGNED, required, FK organizations
- `project_id`: BIGINT UNSIGNED, required, FK projects
- `inventory_item_id`: BIGINT UNSIGNED, nullable, FK inventory_items
- `accounting_item_id`: BIGINT UNSIGNED, nullable, FK inventory_accounting_items
- `type`: VARCHAR(60), required
- `status`: VARCHAR(20), required, default `open`
- `severity`: VARCHAR(20), required, default `medium`
- `title`: VARCHAR(255), required
- `description`: TEXT, nullable
- `old_value`: JSON, nullable
- `new_value`: JSON, nullable
- `resolution_notes`: TEXT, nullable
- `resolved_by_id`: BIGINT UNSIGNED, nullable, FK users
- `resolved_at`: DATETIME(3), nullable
- `ignored_by_id`: BIGINT UNSIGNED, nullable, FK users
- `ignored_at`: DATETIME(3), nullable
- `created_by_id`: BIGINT UNSIGNED, nullable, FK users
- `updated_by_id`: BIGINT UNSIGNED, nullable, FK users
- `metadata`: JSON, nullable
- `created_at`, `updated_at`, `deleted_at`

Types: `missing_plate`, `accounting_item_not_found`,
`physical_item_without_accounting_match`, `plate_divergence`,
`description_divergence`, `location_divergence`, `duplicated_item`,
`manual_issue`, `other`.

Statuses: `open`, `in_review`, `resolved`, `ignored`, `cancelled`.

Severity: `low`, `medium`, `high`, `critical`.

## inventory_pending_issue_audit_logs

- `id`: BIGINT UNSIGNED PK
- `inventory_pending_issue_id`: BIGINT UNSIGNED, FK inventory_pending_issues
- `organization_id`: BIGINT UNSIGNED
- `project_id`: BIGINT UNSIGNED
- `operation`: VARCHAR(50)
- `performed_by`: BIGINT UNSIGNED, nullable
- `changes`: JSON
- `created_at`: DATETIME(3)
