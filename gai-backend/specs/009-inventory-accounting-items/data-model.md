# Data Model: Inventory Accounting Items

## inventory_accounting_items

- `id`: BIGINT UNSIGNED PK
- `organization_id`: BIGINT UNSIGNED, required, FK organizations
- `project_id`: BIGINT UNSIGNED, required, FK projects
- `plate`: VARCHAR(100), nullable, normalized
- `description`: TEXT, nullable
- `accounting_account_description`: TEXT, nullable
- `location`: TEXT, nullable
- `acquisition_date`: DATE, nullable
- `acquisition_value`: DECIMAL(15,2), nullable
- `base_code`: VARCHAR(100), nullable
- `status`: VARCHAR(20), required, default `pending`
- `investor_code`: VARCHAR(100), nullable
- `note_1`: TEXT, nullable
- `note_2`: TEXT, nullable
- `new_inventory_plate`: VARCHAR(100), nullable, normalized
- `inventory_description`: TEXT, nullable
- `inventory_location`: TEXT, nullable
- `metadata`: JSON, nullable
- `imported_by_id`: BIGINT UNSIGNED, nullable, FK users
- `import_batch_id`: BIGINT UNSIGNED, nullable, FK accounting_import_batches
- `created_at`, `updated_at`, `deleted_at`

Statuses: `pending`, `matched`, `divergent`, `not_found`, `ignored`,
`inactive`.

## accounting_import_batches

- `id`: BIGINT UNSIGNED PK
- `organization_id`: BIGINT UNSIGNED, required, FK organizations
- `project_id`: BIGINT UNSIGNED, required, FK projects
- `original_file_name`: VARCHAR(255), required
- `storage_provider`: VARCHAR(50), nullable
- `bucket`: VARCHAR(255), nullable
- `path`: VARCHAR(500), nullable
- `status`: VARCHAR(20), required, default `pending`
- `total_rows`, `processed_rows`, `success_rows`, `failed_rows`: INT UNSIGNED
- `error_report_path`: VARCHAR(500), nullable
- `imported_by_id`: BIGINT UNSIGNED, nullable, FK users
- `started_at`, `finished_at`, `created_at`, `updated_at`
- `metadata`: JSON, nullable; stores inline error report until storage exists

Statuses: `pending`, `processing`, `finished`, `failed`, `cancelled`.

## inventory_accounting_item_audit_logs

- `id`: BIGINT UNSIGNED PK
- `inventory_accounting_item_id`: BIGINT UNSIGNED, required, FK item
- `organization_id`, `project_id`
- `operation`: VARCHAR(50)
- `performed_by`: BIGINT UNSIGNED, nullable, FK users
- `changes`: JSON
- `created_at`
