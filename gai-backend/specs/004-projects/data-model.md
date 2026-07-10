# Data Model: Projects

## Project

- `id`: BIGINT UNSIGNED auto-increment
- `organization_id`: BIGINT UNSIGNED, required FK to `organizations.id`
- `name`: varchar(255), required
- `description`: text, nullable
- `status`: varchar(20), required, default `draft`
- `start_date`: date, nullable
- `end_date`: date, nullable
- `finished_at`: datetime(3), nullable
- `settings`: json, nullable
- `metadata`: json, nullable
- `created_by_id`: BIGINT UNSIGNED, nullable FK to `users.id`
- `updated_by_id`: BIGINT UNSIGNED, nullable FK to `users.id`
- `created_at`: datetime(3)
- `updated_at`: datetime(3)
- `deleted_at`: datetime(3), nullable, reserved for logical removal; physical delete is out of scope

## ProjectAuditLog

- `id`: BIGINT UNSIGNED auto-increment
- `project_id`: BIGINT UNSIGNED FK
- `organization_id`: BIGINT UNSIGNED FK
- `operation`: varchar(50)
- `performed_by`: BIGINT UNSIGNED nullable FK to `users.id`
- `changes`: json
- `created_at`: datetime(3)

## Status

- `draft`
- `active`
- `paused`
- `inactive`
- `finished`
- `cancelled`
- `archived`

