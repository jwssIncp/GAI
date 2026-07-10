# Data Model: Companies & Company Units

## companies

- `id` bigint unsigned primary key
- `organization_id` bigint unsigned not null
- `name` varchar(255) not null
- `corporate_name` varchar(255) null
- `document` varchar(20) null
- `state_registration` varchar(50) null
- `municipal_registration` varchar(50) null
- `email` varchar(255) null
- `phone` varchar(50) null
- `zipcode` varchar(20) null
- `address` varchar(255) null
- `number` varchar(50) null
- `complement` varchar(255) null
- `district` varchar(120) null
- `city` varchar(120) null
- `state` varchar(50) null
- `country` varchar(80) null default `BR`
- `status` varchar(20) not null default `active`
- `metadata` json null
- `created_by_id` bigint unsigned null
- `updated_by_id` bigint unsigned null
- `created_at` datetime(3) not null
- `updated_at` datetime(3) not null
- `deleted_at` datetime(3) null

Indexes:

- `(organization_id, status)`
- `(organization_id, document)` unique when `document` is not null
- `(organization_id, city, state)`
- `name`

## company_units

- `id` bigint unsigned primary key
- `organization_id` bigint unsigned not null
- `company_id` bigint unsigned not null
- `name` varchar(255) not null
- `code` varchar(80) null
- address fields matching companies
- `status` varchar(20) not null default `active`
- `metadata` json null
- `created_by_id` bigint unsigned null
- `updated_by_id` bigint unsigned null
- `created_at` datetime(3) not null
- `updated_at` datetime(3) not null
- `deleted_at` datetime(3) null

Indexes:

- `(organization_id, company_id, status)`
- `(organization_id, company_id, code)`
- `(organization_id, city, state)`
- `name`

## project_units

- `id` bigint unsigned primary key
- `organization_id` bigint unsigned not null
- `project_id` bigint unsigned not null
- `company_unit_id` bigint unsigned not null
- `created_at` datetime(3) not null
- `updated_at` datetime(3) not null

Indexes:

- `(organization_id, project_id)`
- `(organization_id, company_unit_id)`
- unique `(project_id, company_unit_id)`

## audit tables

`company_audit_logs` and `company_unit_audit_logs` store operation, actor, changes, and timestamp. `project_unit_audit_logs` stores assignment/removal history.

## projects update

`projects.company_id` is added as nullable for compatibility with already-created development data. `POST /projects` requires `company_id` and validates that the target company is active and belongs to the same organization. Project list supports `company_id` filter.
