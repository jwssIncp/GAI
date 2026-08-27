# Feature Specification: Inventory Operations

## Scope

This backend-only feature formalizes inventory campaigns, initial inventory and
reinventories without overwriting prior field evidence. It reuses projects,
inventory items, accounting items and project-field-agent assignments.

## Rules

- Every session, round, observation and decision is tenant- and project-scoped.
- Starting a draft session creates round 1 (`initial`).
- `GET .../inventory-sessions/{sessionId}/rounds` is paginated, ordered by
  descending `round_number` and filters by `status` and `type`. Session detail
  exposes only `current_round_id`, defined as the active round with the highest
  number, so a client can resume without embedding or duplicating the collection.
- Session lifecycle is `draft -> active -> finished` or
  `draft|active -> cancelled`. Finishing requires every active round to be
  finished. Cancelling requires a reason, cancels active rounds and never deletes
  history.
- A reinventory creates a new numbered round for one inventory item and requires
  a reason and an earlier observation.
- Observations are immutable. Corrections require another round/observation.
- Observation evidence is append-only metadata backed by presigned object
  storage. New uploads and confirmations are accepted only while the session is
  active; listing and authorized download remain available after closure.
- A round accepts at most one observation per inventory item. This is enforced
  both by the service and by `uq_inventory_observations_round_item`.
- `idempotency_key` prevents duplicate mobile submissions within an organization.
- An observed plate never silently overwrites the master item. A plate-history
  row records master, observed value, source, actor and timestamp.
- Reconciliation runs are append-only and compare the latest observation of each
  item against active accounting rows using normalized plate values.
- Consolidation stores an immutable snapshot of the reconciliation evidence.
- Valuations are manual, append-only records; external valuation integrations are
  outside this version.
- All growing collection endpoints use the backend pagination envelope with
  `page` (default 1), `page_size` (default 20, maximum 100), `total_items` and
  `total_pages`.

## Field/mobile contract

`POST .../rounds/{roundId}/observations` receives `inventory_item_id`,
`field_agent_id`, `result` and optionally `idempotency_key`, `observed_plate`,
serial/unit/sector/location/notes and `captured_at`. `observed_plate` is field
evidence and never updates `inventory_items.old_plate/new_plate`.

The client must retain a stable `idempotency_key` (8-100 characters) for every
logical submission and reuse it on network retries. The response exposes
`prior_observation_id`; it is server-derived from the latest observation for the
same item/session. A reinventory request identifies the inventory session and
item and supplies a mandatory reason; the returned round ID is then used by the
same observation endpoint. No mobile-only duplicate endpoint exists.

After a restart, the client calls session detail and reads `current_round_id`,
then calls `GET .../{sessionId}/rounds?status=active` to recover the complete
active set and its round types. It never derives the active round from observation
history. A reinventory restart follows the same sequence and the next observation
still receives server-derived `prior_observation_id`.

Evidence upload is a three-step flow: request `upload-url`, PUT the binary to the
returned object-storage URL, then call `confirm-upload`. JPEG/JPG, PNG and WebP are
accepted up to the same configurable 10 MiB default used by inventory item images.
The API stores only bucket/key, MIME type, size, checksum and audit metadata.
Evidence lists are paginated; download URLs are generated only for confirmed
evidence after validating organization, project, session, round and observation.

## Physical base import

Create an import session of type `physical_observations_import`. Its metadata
may define `inventory_session_id`, `round_id` and `field_agent_id`; rows may
override those values. Submit normalized payloads through the existing payload
endpoint or XLSX through
`POST /projects/{projectId}/import-sessions/{sessionId}/physical-observations/import`.
The XLSX parser centralizes Portuguese/English header aliases. Every valid row
materializes an immutable observation and `physical_base` plate evidence. The
derived per-row idempotency key prevents duplicates on payload retry; invalid
rows are retained in `import_payload_errors` while valid rows continue.

## Permissions

- `inventory-sessions:create`, `inventory-sessions:read`, `inventory-sessions:update`
- `inventory-rounds:reinventory`, `inventory-observations:create`
- `reconciliations:create`, `reconciliations:read`, `consolidations:create`
- `asset-valuations:create`, `asset-valuations:read`, `plate-history:read`

## API

- `POST|GET /projects/{projectId}/inventory-sessions`
- `GET /projects/{projectId}/inventory-sessions/{sessionId}`
- `GET /projects/{projectId}/inventory-sessions/{sessionId}/rounds`
- `POST /projects/{projectId}/inventory-sessions/{sessionId}/start`
- `POST /projects/{projectId}/inventory-sessions/{sessionId}/finish`
- `POST /projects/{projectId}/inventory-sessions/{sessionId}/cancel`
- `POST /projects/{projectId}/inventory-sessions/{sessionId}/reinventory`
- `POST /projects/{projectId}/inventory-sessions/{sessionId}/rounds/{roundId}/observations`
- `POST /projects/{projectId}/inventory-sessions/{sessionId}/rounds/{roundId}/finish`
- `GET /projects/{projectId}/inventory-sessions/{sessionId}/observations`
- `POST .../observations/{observationId}/evidence/upload-url`
- `POST .../observations/{observationId}/evidence/{evidenceId}/confirm-upload`
- `GET .../observations/{observationId}/evidence`
- `POST .../observations/{observationId}/evidence/{evidenceId}/download-url`
- `POST|GET /projects/{projectId}/inventory-sessions/{sessionId}/reconciliations`
- `POST /projects/{projectId}/inventory-sessions/{sessionId}/reconciliations/{id}/consolidate`
- `POST|GET /projects/{projectId}/inventory-items/{itemId}/valuations`
- `GET /projects/{projectId}/inventory-items/{itemId}/plate-history`

No permission keys were added. Round and evidence reads reuse
`inventory-sessions:read`; lifecycle reuses `inventory-sessions:update`; evidence
creation/confirmation reuses `inventory-observations:create`. Predictable unique
races are translated to stable 409 codes, including
`OBSERVATION_ALREADY_RECORDED`, `IDEMPOTENCY_KEY_REUSED`,
`INVENTORY_ROUND_CONCURRENT_MODIFICATION` and
`RECONCILIATION_ALREADY_CONSOLIDATED`.
