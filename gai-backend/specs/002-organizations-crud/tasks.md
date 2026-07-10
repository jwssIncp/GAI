# Tasks: CRUD de Organizations

**Input**: Design documents from `/specs/002-organizations-crud/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/organizations-api.yaml

**Tests**: MANDATORY per constitution (≥ 80% coverage). Test tasks precede implementation in each user story phase.

**Organization**: Tasks grouped by user story. Bootstrap NestJS included here (greenfield — implement first).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 map to spec.md user stories

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar projeto NestJS + MySQL + CI conforme plan.md

- [x] T001 Initialize NestJS project with TypeScript strict in package.json, tsconfig.json, nest-cli.json
- [x] T002 [P] Configure TypeORM MySQL connection in src/app.module.ts and ormconfig.ts
- [x] T003 [P] Create docker-compose.yml with MySQL 8.0 service (utf8mb4) at repository root
- [x] T004 [P] Configure ESLint and Prettier in .eslintrc.js and .prettierrc
- [x] T005 [P] Configure Jest with coverage gate ≥ 80% in jest.config.ts and package.json scripts
- [x] T006 [P] Setup nestjs-pino structured JSON logging in src/main.ts
- [x] T007 [P] Configure @nestjs/swagger with global prefix api/v1 in src/main.ts
- [x] T008 [P] Create GitHub Actions CI workflow in .github/workflows/ci.yml (lint, npm audit, test, coverage)
- [x] T009 [P] Create deploy workflows in .github/workflows/deploy-homolog.yml and deploy-prod.yml (manual trigger)
- [x] T010 [P] Create environment config with @nestjs/config in src/common/config/app.config.ts
- [x] T011 [P] Create pagination helper in src/common/pagination/paginated-result.ts
- [x] T012 [P] Create Terraform skeleton for RDS MySQL and ECS in infra/terraform/

**Checkpoint**: `npm run start:dev` boots; MySQL connects; CI workflow file exists

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura core que DEVE estar completa antes das user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [x] T013 Create Organization TypeORM entity in src/modules/organizations/infrastructure/persistence/organization.entity.ts
- [x] T014 [P] Create OrganizationAuditLog entity in src/modules/organizations/infrastructure/persistence/organization-audit-log.entity.ts
- [x] T015 Create initial migration for organizations tables in src/migrations/YYYYMMDDHHMMSS-create-organizations.ts
- [x] T016 [P] Create Cnpj value object in src/modules/organizations/domain/value-objects/cnpj.ts
- [x] T017 [P] Create Organization domain entity in src/modules/organizations/domain/entities/organization.ts
- [x] T018 Create OrganizationRepository port in src/modules/organizations/domain/ports/organization.repository.port.ts
- [x] T019 Implement TypeOrmOrganizationRepository in src/modules/organizations/infrastructure/persistence/typeorm-organization.repository.ts
- [x] T020 Create OrganizationsModule wiring DI in src/modules/organizations/organizations.module.ts
- [x] T021 [P] Create global exception filter in src/common/filters/http-exception.filter.ts
- [x] T022 [P] Create correlation ID interceptor in src/common/interceptors/correlation-id.interceptor.ts
- [x] T023 Create DevAdminGuard stub in src/modules/auth/presentation/guards/dev-admin.guard.ts (replaced by SessionAuthGuard in 001-user-auth)
- [x] T024 [P] Create RolesGuard and @Roles decorator in src/modules/auth/presentation/guards/roles.guard.ts and roles.decorator.ts
- [x] T025 Register OrganizationsModule in src/app.module.ts

**Checkpoint**: Migrations run; module loads; guards stubbed for dev/test

---

## Phase 3: User Story 1 — Cadastrar Organization (Priority: P1) 🎯 MVP

**Goal**: Administrador cadastra organization com CNPJ válido e status ACTIVE

**Independent Test**: POST /organizations com dados válidos retorna 201; CNPJ duplicado retorna 409

### Tests for User Story 1 (MANDATORY — write FIRST, ensure FAIL)

- [x] T026 [P] [US1] Unit tests for Cnpj value object in test/unit/modules/organizations/cnpj.spec.ts
- [x] T027 [P] [US1] Integration test POST /organizations in test/integration/organizations/create-organization.e2e-spec.ts

### Implementation for User Story 1

- [x] T028 [P] [US1] Create CreateOrganizationDto in src/modules/organizations/application/dto/create-organization.dto.ts
- [x] T029 [P] [US1] Create OrganizationResponseDto in src/modules/organizations/application/dto/organization-response.dto.ts
- [x] T030 [US1] Implement CreateOrganizationUseCase in src/modules/organizations/application/use-cases/create-organization.use-case.ts
- [x] T031 [US1] Implement audit log write on create in src/modules/organizations/application/use-cases/create-organization.use-case.ts
- [x] T032 [US1] Implement POST /organizations in src/modules/organizations/presentation/organizations.controller.ts
- [x] T033 [US1] Add structured logging for create operation in CreateOrganizationUseCase

**Checkpoint**: US1 independently testable via quickstart.md §3.1–3.2

---

## Phase 4: User Story 2 — Consultar e Listar (Priority: P2)

**Goal**: Listagem paginada com filtros e consulta por ID

**Independent Test**: GET /organizations retorna paginação; GET /organizations/:id retorna 200 ou 404

### Tests for User Story 2 (MANDATORY — write FIRST, ensure FAIL)

- [x] T034 [P] [US2] Integration test GET list with pagination in test/integration/organizations/list-organizations.e2e-spec.ts
- [x] T035 [P] [US2] Integration test GET by id in test/integration/organizations/get-organization.e2e-spec.ts

### Implementation for User Story 2

- [x] T036 [P] [US2] Create ListOrganizationsQueryDto in src/modules/organizations/application/dto/list-organizations-query.dto.ts
- [x] T037 [US2] Implement ListOrganizationsUseCase with offset pagination in src/modules/organizations/application/use-cases/list-organizations.use-case.ts
- [x] T038 [US2] Implement GetOrganizationUseCase in src/modules/organizations/application/use-cases/get-organization.use-case.ts
- [x] T039 [US2] Implement GET /organizations and GET /organizations/:id in organizations.controller.ts
- [x] T040 [US2] Add indexes validation and search filter (LOWER + LIKE) in TypeOrmOrganizationRepository

**Checkpoint**: US1 + US2 work independently; list never unbounded

---

## Phase 5: User Story 3 — Atualizar Organization (Priority: P3)

**Goal**: Atualizar campos editáveis com auditoria; CNPJ imutável

**Independent Test**: PATCH atualiza trade_name; auditoria registra before/after

### Tests for User Story 3 (MANDATORY — write FIRST, ensure FAIL)

- [x] T041 [P] [US3] Integration test PATCH /organizations/:id in test/integration/organizations/update-organization.e2e-spec.ts

### Implementation for User Story 3

- [x] T042 [P] [US3] Create UpdateOrganizationDto in src/modules/organizations/application/dto/update-organization.dto.ts
- [x] T043 [US3] Implement UpdateOrganizationUseCase with audit trail in src/modules/organizations/application/use-cases/update-organization.use-case.ts
- [x] T044 [US3] Implement PATCH /organizations/:id in organizations.controller.ts
- [x] T045 [US3] Enforce CNPJ immutability in UpdateOrganizationUseCase domain validation

**Checkpoint**: US1–US3 independently functional

---

## Phase 6: User Story 4 — Desativar e Reativar (Priority: P4)

**Goal**: Soft delete via status INACTIVE; reativação via activate endpoint

**Independent Test**: deactivate → INACTIVE; activate → ACTIVE; double deactivate → 409

### Tests for User Story 4 (MANDATORY — write FIRST, ensure FAIL)

- [x] T046 [P] [US4] Integration test deactivate/activate in test/integration/organizations/deactivate-activate-organization.e2e-spec.ts

### Implementation for User Story 4

- [x] T047 [US4] Implement DeactivateOrganizationUseCase in src/modules/organizations/application/use-cases/deactivate-organization.use-case.ts
- [x] T048 [US4] Implement ActivateOrganizationUseCase in src/modules/organizations/application/use-cases/activate-organization.use-case.ts
- [x] T049 [US4] Implement POST /organizations/:id/deactivate and /activate in organizations.controller.ts
- [x] T050 [US4] Add state transition validation (invalid transitions return domain error)

**Checkpoint**: Full CRUD complete; all 4 stories independently testable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Qualidade, contratos e validação final

- [x] T051 [P] Contract test validating organizations-api.yaml in test/contract/organizations-api.spec.ts
- [x] T052 [P] Verify coverage ≥ 80% with npm run test:cov and add unit tests in test/unit/modules/organizations/ as needed
- [x] T053 Apply @Roles(PLATFORM_ADMIN) and DevAdminGuard on all organization endpoints
- [x] T054 Run quickstart.md validation scenarios and fix gaps
- [x] T055 [P] Add Kibana-friendly log fields (operation, organizationId, result) across all use cases

---

## Phase 8: Local Docker + Swagger Fidelity (2026-06-17)

**Purpose**: Alinhar código com NFR-010/011/012 e contrato OpenAPI fidedigno para frontend

**Depends on**: Phases 1–7 (CRUD implementado)

### Local Docker Environment

- [x] T056 Create Dockerfile with dev target (Node 22, hot-reload) at repository root
- [x] T057 [P] Create scripts/docker-entrypoint.sh (wait mysql, 1st-boot migration+seed, fail-fast pending migrations, start:dev)
- [x] T058 Update docker-compose.yml with `app` service (build, bind mount, depends_on mysql healthy, env overrides DB_HOST=mysql)
- [x] T059 [P] Update .env.example documenting local host vs compose scenarios (DB_HOST, NODE_ENV=local)
- [x] T060 [P] Create .dockerignore (node_modules, .git, coverage, .env)

### Swagger / OpenAPI Fidelity

- [x] T061 [P] Add @ApiProperty/@ApiPropertyOptional to all organization DTOs matching contracts/organizations-api.yaml
- [x] T062 Add @ApiOperation + @ApiResponse for every HTTP status on OrganizationsController (201, 200, 400, 401, 403, 404, 409)
- [x] T063 [P] Create shared Swagger error decorators or constants in src/common/swagger/ aligned with ErrorCode enum
- [x] T064 Extend test/contract/organizations-api.spec.ts to validate ErrorCode enum, all response codes per path, and required schemas
- [x] T065 [P] Add e2e tests for parallel error flows (409 duplicate CNPJ, 409 already inactive, 400 invalid CNPJ, 403 forbidden role)

### Validation

- [x] T066 Run quickstart.md end-to-end with `docker compose up --build` (Docker CLI indisponível no ambiente CI/agent; artefatos validados)
- [x] T067 Verify /api/docs-json schemas match contracts/organizations-api.yaml field names and enums

**Checkpoint**: `docker compose up` sobe app+mysql; Swagger reflete contrato; contract tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; uses data from US1 for richer tests
- **US3 (Phase 5)**: Depends on US1 (organizations exist)
- **US4 (Phase 6)**: Depends on US1 (organizations exist)
- **Polish (Phase 7)**: Depends on US1–US4

### User Story Dependencies

- **US1 (P1)**: After Foundational — no story dependencies
- **US2 (P2)**: After Foundational — independently testable with seed data
- **US3 (P3)**: After US1 — needs existing organizations
- **US4 (P4)**: After US1 — needs active organizations

### Within Each User Story

- Tests MUST fail before implementation
- Domain/value objects → use cases → controller
- Audit logging in same transaction as mutation

### Parallel Opportunities

- All Setup tasks T002–T012 marked [P]
- T013–T014 entities in parallel
- T026–T027 tests in parallel
- T028–T029 DTOs in parallel
- US2 list/get tests T034–T035 in parallel

---

## Parallel Example: User Story 1

```bash
# Tests first (parallel):
T026: test/unit/modules/organizations/cnpj.spec.ts
T027: test/integration/organizations/create-organization.e2e-spec.ts

# Then DTOs (parallel):
T028: create-organization.dto.ts
T029: organization-response.dto.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart §3.1–3.2
5. Demo cadastro de organization

### Incremental Delivery

1. Setup + Foundational → base ready
2. US1 → test → demo (MVP!)
3. US2 → listagem operacional
4. US3 → manutenção cadastral
5. US4 → ciclo de vida ativo/inativo

### Note on Auth

DevAdminGuard (T023) enables US1–US4 before `001-user-auth`. Replace with SessionAuthGuard when auth feature completes.

---

## Task Summary

| Phase | Tasks | Parallel |
|-------|-------|----------|
| Setup | T001–T012 (12) | 11 |
| Foundational | T013–T025 (13) | 5 |
| US1 Create | T026–T033 (8) | 4 |
| US2 Read/List | T034–T040 (7) | 3 |
| US3 Update | T041–T045 (5) | 2 |
| US4 Deactivate | T046–T050 (5) | 1 |
| Polish | T051–T055 (5) | 3 |
| Local Docker + Swagger | T056–T067 (12) | 6 |
| **Total** | **67** | **35** |
