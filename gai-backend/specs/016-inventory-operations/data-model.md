# Data Model: Inventory Operations

- `inventory_sessions`: campaign header and lifecycle.
- `inventory_rounds`: numbered initial/reinventory attempts and reason.
- `inventory_observations`: immutable field results, actor, captured time,
  observed plate/serial/location and link to the prior observation.
- `inventory_plate_history`: source-aware plate evidence; master data is not
  overwritten by an observation.
- `inventory_reconciliations`: append-only run result linking physical and
  accounting evidence.
- `inventory_consolidations`: immutable decision plus JSON evidence snapshot.
- `asset_valuations`: append-only manual value/source history.
- `inventory_operation_audit_logs`: tenant/project-scoped audit events.

All identifiers are numeric internal IDs. All child tables carry
`organization_id` and `project_id`, with foreign keys and composite indexes for
tenant-safe queries.
