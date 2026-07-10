# Data Model: Field Agents

## field_agents

- `id` BIGINT UNSIGNED PK auto-increment
- `organization_id` BIGINT UNSIGNED NOT NULL FK organizations(id)
- `user_id` BIGINT UNSIGNED NULL FK users(id)
- `name` VARCHAR(255) NOT NULL
- `email` VARCHAR(255) NULL
- `phone` VARCHAR(50) NULL
- `document` VARCHAR(50) NULL
- `status` VARCHAR(20) NOT NULL DEFAULT `active`
- `metadata` JSON NULL
- `created_at` DATETIME(3) NOT NULL
- `updated_at` DATETIME(3) NOT NULL
- `deleted_at` DATETIME(3) NULL

Indexes:

- `idx_field_agents_organization_status (organization_id, status)`
- `idx_field_agents_user_id (user_id)`
- `idx_field_agents_name (name)`
- `uq_field_agents_org_email (organization_id, email)` allowing NULLs
- `uq_field_agents_org_document (organization_id, document)` allowing NULLs

## project_field_agents

- `id` BIGINT UNSIGNED PK auto-increment
- `organization_id` BIGINT UNSIGNED NOT NULL FK organizations(id)
- `project_id` BIGINT UNSIGNED NOT NULL FK projects(id)
- `field_agent_id` BIGINT UNSIGNED NOT NULL FK field_agents(id)
- `role` VARCHAR(100) NULL
- `status` VARCHAR(20) NOT NULL DEFAULT `active`
- `start_date` DATE NULL
- `end_date` DATE NULL
- `notes` TEXT NULL
- `created_at` DATETIME(3) NOT NULL
- `updated_at` DATETIME(3) NOT NULL

Indexes:

- `idx_project_field_agents_project_status (project_id, status)`
- `idx_project_field_agents_agent_status (field_agent_id, status)`
- `uq_project_field_agents_active (project_id, field_agent_id, status)`

## field_agent_audit_logs

- `id` BIGINT UNSIGNED PK auto-increment
- `organization_id` BIGINT UNSIGNED NOT NULL FK organizations(id)
- `field_agent_id` BIGINT UNSIGNED NULL FK field_agents(id)
- `project_field_agent_id` BIGINT UNSIGNED NULL FK project_field_agents(id)
- `project_id` BIGINT UNSIGNED NULL FK projects(id)
- `operation` VARCHAR(50) NOT NULL
- `performed_by` BIGINT UNSIGNED NULL FK users(id)
- `changes` JSON NOT NULL
- `created_at` DATETIME(3) NOT NULL

## Enums

Field agent status:

- `active`
- `inactive`
- `blocked`

Project field agent status:

- `active`
- `inactive`
- `finished`

Audit operations:

- `CREATE`
- `UPDATE`
- `DEACTIVATE`
- `REACTIVATE`
- `ASSIGN_TO_PROJECT`
- `UPDATE_PROJECT_ASSIGNMENT`
- `REMOVE_FROM_PROJECT`
