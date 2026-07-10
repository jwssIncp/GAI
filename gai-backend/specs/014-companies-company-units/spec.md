# Feature Specification: Companies & Company Units

## Scope summary

The Companies & Company Units module manages the business entities inventoried by an organization and their physical units/locations. An `organization` remains the SaaS tenant. A `company` represents a client, branch, public body, contractor, or inventoried entity inside that tenant. A `company_unit` represents a physical or operational location for that company, such as a warehouse, office, campus, distribution center, sector, or address.

Projects must be created for a company and may be linked to one or more company units. Existing project rows are preserved with nullable `company_id`; new API project creation requires `company_id` to avoid destructive migration while the system is still evolving.

## Affected specs and contracts

- `specs/014-companies-company-units/spec.md`
- `specs/014-companies-company-units/data-model.md`
- `specs/014-companies-company-units/contracts/companies-company-units-api.yaml`
- `specs/004-projects/spec.md` and `specs/004-projects/contracts/projects-api.yaml` should be considered amended by this feature for `company_id`, project-unit assignment, and `company_id` project filtering.

## Affected folder structure

- `src/modules/companies/`
- `src/modules/projects/` for `company_id` and project-unit integration
- `src/migrations/` for companies, company units, project units, and project company linkage
- `src/scripts/seed/permissions.seed.ts`
- `test/contract/`
- `test/unit/modules/companies/`
- `test/integration/companies/`

## Actors and tenant rules

- Organization users can only manage companies, company units, and project-unit links from their own `organization_id`.
- Platform administrators can manage records from any organization.
- Every company belongs to exactly one organization.
- Every company unit belongs to exactly one company in the same organization.
- A project cannot be linked to a company from another organization.
- A project unit cannot link a project and company unit from different organizations.

## Company behavior

- Statuses: `active`, `inactive`, `blocked`.
- `document` is optional, normalized to digits when present, and must be a valid CNPJ with 14 digits.
- `document` must be unique inside the same organization when informed.
- Listing is paginated and supports filters by `status`, `document`, `city`, `state`, and textual `search`.
- Deactivation is logical and does not remove units, projects, or historical audit rows.
- Inactive or blocked companies cannot be used for new projects.
- Re-activation is allowed only from `inactive` or `blocked` to `active`.

## Company unit behavior

- Statuses: `active`, `inactive`.
- A company can have multiple units.
- A unit can be linked to multiple projects over time.
- Listing is paginated and supports filters by `status`, `city`, `state`, and textual `search`.
- Deactivation is logical and does not remove project-unit history.
- Inactive units cannot be newly linked to active projects.
- Re-activation is allowed only from `inactive` to `active`.

## Project unit behavior

- `POST /projects/:projectId/units` assigns an active unit from the project's company and organization.
- `GET /projects/:projectId/units` lists units assigned to the project.
- `POST /projects/:projectId/units/:unitId/remove` removes the active assignment logically by deleting the join row from the operational set while preserving audit history.
- Duplicate active assignments are rejected.

## Permissions

- `companies:create`
- `companies:read`
- `companies:update`
- `companies:deactivate`
- `companies:reactivate`
- `company-units:create`
- `company-units:read`
- `company-units:update`
- `company-units:deactivate`
- `company-units:reactivate`
- `project-units:assign`
- `project-units:read`
- `project-units:remove`

## API endpoints

Companies:

- `POST /v1/companies`
- `GET /v1/companies`
- `GET /v1/companies/:id`
- `PATCH /v1/companies/:id`
- `POST /v1/companies/:id/deactivate`
- `POST /v1/companies/:id/reactivate`

Company Units:

- `POST /v1/companies/:companyId/units`
- `GET /v1/companies/:companyId/units`
- `GET /v1/companies/:companyId/units/:unitId`
- `PATCH /v1/companies/:companyId/units/:unitId`
- `POST /v1/companies/:companyId/units/:unitId/deactivate`
- `POST /v1/companies/:companyId/units/:unitId/reactivate`

Project Units:

- `POST /v1/projects/:projectId/units`
- `GET /v1/projects/:projectId/units`
- `POST /v1/projects/:projectId/units/:unitId/remove`

## Audit and transactions

All create, update, deactivate, reactivate, assign, and remove operations must run in repository transactions and write audit rows with actor, organization, operation, and changes. Physical deletion of companies and company units is outside scope.

## Response and validation conventions

Responses use the existing snake_case DTO convention and paginated list shape: `items`, `page`, `page_size`, `total_items`, `total_pages`. Errors use the existing Nest exception filter shape with `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, and `CONFLICT`.

## Persistence decision

The prompt mentions Prisma, but this repository currently uses NestJS, TypeORM, and manual migrations under `src/migrations`. This feature therefore follows the real TypeORM pattern already used by Projects, Field Agents, Inventory Items, and Catalog Assets.
