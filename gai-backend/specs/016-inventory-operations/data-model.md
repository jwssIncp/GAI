# Data Model: Inventory Operations

- `inventory_sessions`: campaign header and lifecycle, including cancellation
  timestamp and reason.
- `inventory_rounds`: numbered initial/reinventory attempts and reason.
- `inventory_observations`: immutable field results, actor, captured time,
  observed plate/serial/location and link to the prior observation.
- `inventory_observation_evidence`: append-only object-storage metadata linked to
  organization, project, session, round and observation. Status moves only from
  `pending_upload` to `uploaded`; no binary or base64 is stored in MySQL.
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

Migration `1741400000001-close-inventory-operation-gaps.ts` incrementally adds
the session cancellation fields and the evidence table with FKs, a scoped lookup
index, an observation/created-at pagination index and a unique storage key. It
does not modify any previously applied migration.
