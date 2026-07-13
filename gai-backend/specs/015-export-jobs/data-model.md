# Data Model: Export Jobs

## export_jobs

- `id`: bigint unsigned primary key
- `organization_id`: bigint unsigned FK, required
- `project_id`: bigint unsigned FK, required
- `type`: varchar(60), required
- `status`: varchar(20), required, default `pending`
- `file_name`: varchar(255), nullable
- `mime_type`: varchar(120), nullable
- `size_bytes`: bigint unsigned, nullable
- `file_content`: mediumblob, nullable and never selected by default
- `checksum`: varchar(64), nullable SHA-256
- `requested_by_id`: bigint unsigned FK, nullable
- `retry_of_id`: bigint unsigned self FK, nullable
- `attempt_count`: int unsigned, required, default 1
- `requested_at`: datetime(3), required
- `started_at`: datetime(3), nullable
- `finished_at`: datetime(3), nullable
- `expires_at`: datetime(3), nullable
- `error_code`: varchar(100), nullable
- `error_message`: text, nullable
- `created_at`: datetime(3), required
- `updated_at`: datetime(3), required
- `deleted_at`: datetime(3), nullable

Indexes:

- `(organization_id, project_id, status)`
- `(project_id, type, created_at)`
- `(status, created_at)` for worker polling
- `expires_at` for retention cleanup

## export_job_audit_logs

- `id`: bigint unsigned primary key
- `export_job_id`: bigint unsigned FK, required
- `organization_id`: bigint unsigned FK, required
- `project_id`: bigint unsigned FK, required
- `operation`: varchar(50), required
- `performed_by`: bigint unsigned FK, nullable for worker actions
- `changes`: json, required
- `created_at`: datetime(3), required

Indexes:

- `(export_job_id, created_at)`
- `(organization_id, project_id)`
