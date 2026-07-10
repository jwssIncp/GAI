# Data Model: Payments & Expenses

## field_agent_payments

- `id`: BIGINT UNSIGNED PK
- `organization_id`, `project_id`, `field_agent_id`: required FKs
- `state`: VARCHAR(2), nullable
- `start_date`, `end_date`, `payment_date`: DATE nullable
- `days`: INT UNSIGNED required default 0
- `daily_rate`, `additional_amount`, `daily_total`, `discount_amount`,
  `final_amount`: DECIMAL(15,2) required
- `status`: `pending`, `approved`, `paid`, `cancelled`
- `notes`: TEXT nullable
- `approved_by_id`, `approved_at`, `paid_by_id`, `paid_at`
- `created_by_id`, `updated_by_id`
- `metadata`: JSON nullable
- timestamps and `deleted_at`

## expenses

- `id`: BIGINT UNSIGNED PK
- `organization_id`, `project_id`: required FKs
- `field_agent_id`: nullable FK
- `description`, `reason`: TEXT
- `expense_date`: DATE required
- `amount`: DECIMAL(15,2) required
- `status`: `pending`, `approved`, `rejected`, `paid`, `cancelled`
- `approved_by_id`, `approved_at`, `rejected_by_id`, `rejected_at`,
  `paid_by_id`, `paid_at`
- `created_by_id`, `updated_by_id`
- `metadata`: JSON nullable
- timestamps and `deleted_at`

## expense_attachments

- `id`: BIGINT UNSIGNED PK
- `organization_id`, `expense_id`: required FKs
- `storage_provider`, `bucket`, `path`
- `original_name`, `mime_type`, `size_bytes`, `checksum`
- `status`: `pending_upload`, `uploaded`, `removed`
- `uploaded_by_id`
- timestamps and `deleted_at`

## payment_expense_audit_logs

- `id`: BIGINT UNSIGNED PK
- `organization_id`, `project_id`
- `payment_id`, `expense_id`, `expense_attachment_id`: nullable references
- `operation`: VARCHAR(60)
- `performed_by`: nullable FK users
- `changes`: JSON
- `created_at`
