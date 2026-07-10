# Data Model: Import Sessions

## import_sessions

- `id`: bigint unsigned, PK
- `organization_id`: bigint unsigned, obrigatorio
- `project_id`: bigint unsigned, obrigatorio
- `type`: varchar(40), enum logico
- `source`: varchar(30), enum logico
- `status`: varchar(20), enum logico
- `session_uuid`: varchar(64), unico e opaco
- `expected_payloads`: int unsigned, nullable
- `received_payloads`: int unsigned
- `processed_payloads`: int unsigned
- `failed_payloads`: int unsigned
- `total_items`: int unsigned
- `total_images`: int unsigned
- `total_created`: int unsigned
- `total_updated`: int unsigned
- `total_deleted`: int unsigned
- `total_failed`: int unsigned
- `raw_backup_path`: varchar(500), nullable
- `created_by_id`: bigint unsigned, nullable
- `started_at`: datetime(3), nullable
- `finished_at`: datetime(3), nullable
- `expires_at`: datetime(3), nullable
- `error_message`: text, nullable
- `metadata`: json, nullable
- `created_at`, `updated_at`, `deleted_at`

Unicidades/indices:

- unique `session_uuid`
- index `(organization_id, project_id, status)`
- index `(project_id, created_at)`

## import_payloads

- `id`: bigint unsigned, PK
- `organization_id`: bigint unsigned, obrigatorio
- `import_session_id`: bigint unsigned, obrigatorio
- `payload_number`: int unsigned, obrigatorio
- `idempotency_key`: varchar(128), obrigatorio
- `checksum`: varchar(128), nullable
- `status`: varchar(20), enum logico
- `items_count`, `images_count`, `created_count`, `updated_count`, `deleted_count`, `failed_count`
- `raw_payload_path`: varchar(500), nullable
- `received_at`: datetime(3)
- `processed_at`: datetime(3), nullable
- `error_message`: text, nullable
- `metadata`: json, nullable
- `payload`: json, nullable para auditoria/reprocessamento local
- `created_at`, `updated_at`

Unicidades/indices:

- unique `(import_session_id, payload_number)`
- unique `(import_session_id, idempotency_key)`
- index `(organization_id, status)`

## import_payload_errors

- `id`: bigint unsigned, PK
- `organization_id`: bigint unsigned, obrigatorio
- `import_session_id`: bigint unsigned, obrigatorio
- `import_payload_id`: bigint unsigned, obrigatorio
- `row_number`: int unsigned, nullable
- `item_reference`: varchar(150), nullable
- `error_code`: varchar(80), obrigatorio
- `error_message`: text, obrigatorio
- `raw_data`: json, nullable
- `created_at`: datetime(3)

## import_files

- `id`: bigint unsigned, PK
- `organization_id`: bigint unsigned, obrigatorio
- `import_session_id`: bigint unsigned, obrigatorio
- `import_payload_id`: bigint unsigned, nullable
- `type`: varchar(30), enum logico
- `storage_provider`: varchar(50)
- `bucket`: varchar(255)
- `path`: varchar(500)
- `original_name`: varchar(255)
- `mime_type`: varchar(100)
- `size_bytes`: bigint unsigned
- `checksum`: varchar(128), nullable
- `status`: varchar(20)
- `uploaded_by_id`: bigint unsigned, nullable
- `created_at`, `updated_at`, `deleted_at`

## import_session_audit_logs

- `id`: bigint unsigned, PK
- `organization_id`: bigint unsigned
- `project_id`: bigint unsigned
- `import_session_id`: bigint unsigned, nullable
- `import_payload_id`: bigint unsigned, nullable
- `import_file_id`: bigint unsigned, nullable
- `operation`: varchar(60)
- `performed_by`: bigint unsigned, nullable
- `changes`: json
- `created_at`: datetime(3)

## Enums Logicos

Session types: `mobile_sync`, `inventory_items_import`, `accounting_items_import`, `images_import`, `raw_backup_import`, `incremental_sync`.

Sources: `mobile_app`, `web_admin`, `api_client`, `system`, `migration`.

Session statuses: `open`, `receiving`, `processing`, `finished`, `failed`, `cancelled`, `expired`.

Payload statuses: `received`, `processing`, `processed`, `failed`, `duplicated`, `ignored`.

File statuses: `pending_upload`, `uploaded`, `processed`, `failed`, `removed`.
