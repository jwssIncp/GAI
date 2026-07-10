# Tasks: Usuários, Papéis e Permissões com Autorização Desacoplada

**Input**: Design documents from `/specs/003-users-roles-permissions/`

**Prerequisites**: plan.md, spec.md (revisada 2026-06-19), research.md, data-model.md, contracts/users-api.yaml, contracts/rbac-api.yaml

**Tests**: MANDATORY per constitution (≥ 80% coverage). Test tasks precede implementation in each user story phase.

**Organization**: Tasks grouped by user story (US1–US5). Features `001-user-auth` e `002-organizations-crud` já implementadas — esta feature refatora e estende.

**Status**: Implementação core concluída (2026-06-19). Tarefas pendentes concentram-se em testes de integração dedicados e documentação operacional.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 map to spec.md user stories

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estrutura do módulo `users` e wiring inicial

- [X] T001 Create UsersModule skeleton in src/modules/users/users.module.ts
- [X] T002 [P] Create users module folder structure (domain/application/infrastructure/presentation) per plan.md
- [X] T003 [P] Create PermissionKey value object in src/modules/users/domain/value-objects/permission-key.ts
- [X] T004 [P] Create PermissionScope enum in src/modules/users/domain/enums/permission-scope.enum.ts
- [X] T005 Register UsersModule in src/app.module.ts

**Checkpoint**: ✅ App boots with UsersModule registered

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migrations, entidades RBAC desacopladas, seeds e IDs numéricos

**⚠️ CRITICAL**: No user story work until this phase is complete

- [X] T006 Create migration for numeric IDs + RBAC tables in src/migrations/1739600000001-migrate-to-numeric-ids-and-rbac.ts
- [X] T007 Create decouple-authorization migration in src/migrations/1739700000001-decouple-user-authorization.ts
- [X] T008 [P] Create PermissionEntity in src/modules/users/infrastructure/persistence/permission.entity.ts
- [X] T009 [P] Create RoleEntity in src/modules/users/infrastructure/persistence/role.entity.ts
- [X] T010 [P] Create RolePermissionEntity in src/modules/users/infrastructure/persistence/role-permission.entity.ts
- [X] T011 [P] Create UserRoleAssignmentEntity in src/modules/users/infrastructure/persistence/user-role-assignment.entity.ts
- [X] T012 [P] Create UserAuditLogEntity in src/modules/users/infrastructure/persistence/user-audit-log.entity.ts
- [X] T013 [P] Create RoleAuditLogEntity in src/modules/users/infrastructure/persistence/role-audit-log.entity.ts
- [X] T014 Create idempotent permissions seed in src/scripts/seed/permissions.seed.ts
- [X] T015 Refactor UserEntity to profile-only (remove role, org_role_id) in src/modules/auth/infrastructure/persistence/user.entity.ts
- [X] T016 [P] Refactor OrganizationEntity to BIGINT UNSIGNED PK in src/modules/organizations/infrastructure/persistence/organization.entity.ts
- [X] T017 [P] Refactor SessionEntity user_id/organization_id to BIGINT in src/modules/auth/infrastructure/persistence/session.entity.ts
- [X] T018 Update User domain entity (profile-only) in src/modules/auth/domain/entities/user.ts
- [X] T019 [P] Update Organization domain entity and repository port to `number` IDs
- [X] T020 Refactor TypeOrmUserRepository for numeric IDs and update semantics in src/modules/auth/infrastructure/persistence/typeorm-user.repository.ts
- [X] T021 Update bootstrap seed for roles + assignments in src/scripts/seed/bootstrap.ts
- [X] T022 Wire RoleEntity, RolePermissionEntity, UserRoleAssignmentEntity in UsersModule and app.module.ts

**Checkpoint**: ✅ `migration:run` + `seed:bootstrap`; login retorna `role_assignments`

---

## Phase 3: User Story 1 — Cadastrar Usuário com Perfil (Priority: P1) 🎯 MVP

**Goal**: CRUD de perfil sem papel embutido; usuário sem atribuição = acesso negado

**Independent Test**: POST /users cria registro sem role; tabela users não contém colunas de autorização

### Tests for User Story 1

- [X] T023 [P] [US1] Unit tests for CreateUserUseCase scope rules in test/unit/modules/users/create-user.use-case.spec.ts
- [X] T024 [P] [US1] Integration test POST user profile-only in test/integration/users/create-user.e2e-spec.ts

### Implementation for User Story 1

- [X] T025 [P] [US1] Create ManagedUser domain entity in src/modules/users/domain/entities/managed-user.ts
- [X] T026 [P] [US1] Create UserManagementRepository port in src/modules/users/domain/ports/user-management.repository.port.ts
- [X] T027 [US1] Implement TypeOrmUserManagementRepository in src/modules/users/infrastructure/persistence/typeorm-user-management.repository.ts
- [X] T028 [P] [US1] Create CreateUserDto (login, email, password, organization_id only) in src/modules/users/application/dto/create-user.dto.ts
- [X] T029 [P] [US1] Create UserResponseDto with role_assignments in src/modules/users/application/dto/user-response.dto.ts
- [X] T030 [US1] Implement CreateUserUseCase with scope validation in src/modules/users/application/use-cases/create-user.use-case.ts
- [X] T031 [US1] Implement UserScopeService in src/modules/users/application/services/user-scope.service.ts
- [X] T032 [US1] Implement UsersController POST in src/modules/users/presentation/users.controller.ts

**Checkpoint**: US1 — criar usuário sem papel; acesso negado até atribuição

---

## Phase 4: User Story 2 — Atribuir e Gerenciar Papéis (Priority: P2)

**Goal**: Endpoints dedicados para atribuir, listar e revogar papéis

**Independent Test**: POST /users/{id}/role-assignments persiste em user_role_assignments; DELETE revoga sem alterar users

### Tests for User Story 2

- [X] T033 [P] [US2] Unit tests for AssignUserRoleUseCase scope rules in test/unit/modules/users/assign-user-role.use-case.spec.ts
- [X] T034 [P] [US2] Unit tests for last PLATFORM_ADMIN protection in test/unit/modules/users/revoke-user-role-assignment.use-case.spec.ts
- [X] T035 [P] [US2] Integration test role assignment flows in test/integration/users/role-assignments.e2e-spec.ts

### Implementation for User Story 2

- [X] T036 [P] [US2] Create UserRoleAssignmentRepository port in src/modules/users/domain/ports/user-role-assignment.repository.port.ts
- [X] T037 [US2] Implement TypeOrmUserRoleAssignmentRepository in src/modules/users/infrastructure/persistence/typeorm-user-role-assignment.repository.ts
- [X] T038 [P] [US2] Create AssignUserRoleDto in src/modules/users/application/dto/assign-user-role.dto.ts
- [X] T039 [US2] Implement AssignUserRoleUseCase in src/modules/users/application/use-cases/assign-user-role.use-case.ts
- [X] T040 [US2] Implement ListUserRoleAssignmentsUseCase in src/modules/users/application/use-cases/list-user-role-assignments.use-case.ts
- [X] T041 [US2] Implement RevokeUserRoleAssignmentUseCase in src/modules/users/application/use-cases/revoke-user-role-assignment.use-case.ts
- [X] T042 [US2] Implement UserRoleAssignmentsController in src/modules/users/presentation/user-role-assignments.controller.ts
- [X] T043 [US2] Create RoleAuthorizationService in src/modules/auth/application/services/role-authorization.service.ts

**Checkpoint**: US2 — atribuir/revogar papéis independente do CRUD de perfil

---

## Phase 5: User Story 3 — Consultar Usuários por Escopo (Priority: P3)

**Goal**: Listagem paginada com isolamento de tenant; detalhe inclui role_assignments

**Independent Test**: PLATFORM_ADMIN lista global; ORG_ADMIN vê só sua org; ORG_USER recebe 403

### Tests for User Story 3

- [X] T044 [P] [US3] Integration test list/get users with scope isolation in test/integration/users/list-users.e2e-spec.ts
- [X] T045 [P] [US3] Unit tests for DeactivateUserUseCase last-admin protection in test/unit/modules/users/deactivate-user.use-case.spec.ts

### Implementation for User Story 3

- [X] T046 [P] [US3] Create ListUsersQueryDto with role filter via assignments in src/modules/users/application/dto/list-users-query.dto.ts
- [X] T047 [US3] Implement ListUsersUseCase in src/modules/users/application/use-cases/list-users.use-case.ts
- [X] T048 [US3] Implement GetUserUseCase in src/modules/users/application/use-cases/get-user.use-case.ts
- [X] T049 [US3] Implement UpdateUserUseCase in src/modules/users/application/use-cases/update-user.use-case.ts
- [X] T050 [US3] Implement DeactivateUserUseCase and ActivateUserUseCase in src/modules/users/application/use-cases/
- [X] T051 [US3] Complete UsersController GET/PATCH/activate/deactivate in src/modules/users/presentation/users.controller.ts

**Checkpoint**: US3 — listagem com escopo e role_assignments agregados

---

## Phase 6: User Story 4 — Catálogo de Papéis e Permissões (Priority: P4)

**Goal**: Papéis customizados por organization; catálogo de permissões read-only

**Independent Test**: Criar papel "Auditor", atribuir a usuário, verificar permissões na resolução

### Tests for User Story 4

- [X] T052 [P] [US4] Integration test org roles CRUD in test/integration/users/org-roles.e2e-spec.ts

### Implementation for User Story 4

- [X] T053 [P] [US4] Refactor TypeOrmOrgRoleRepository to use RoleEntity in src/modules/users/infrastructure/persistence/typeorm-org-role.repository.ts
- [X] T054 [US4] Implement org role use cases in src/modules/users/application/use-cases/create-org-role.use-case.ts (and get/list/update/deactivate)
- [X] T055 [US4] Implement OrgRolesController in src/modules/users/presentation/org-roles.controller.ts
- [X] T056 [US4] Implement ListPermissionsUseCase and PermissionsController
- [X] T057 [US4] Refactor TypeOrmPermissionResolver to resolveForUser(userId) in src/modules/auth/infrastructure/persistence/typeorm-permission-resolver.ts

**Checkpoint**: US4 — matriz de permissões configurável por organization

---

## Phase 7: User Story 5 — IDs Numéricos (Priority: P5)

**Goal**: BIGINT AUTO_INCREMENT em entidades de negócio; sessions UUID

**Independent Test**: APIs retornam int64; access_token permanece UUID

### Tests for User Story 5

- [X] T058 [P] [US5] Update unit tests for numeric IDs in test/unit/modules/domain-entities.spec.ts
- [X] T059 [P] [US5] Update integration test login response in test/integration/auth/login.e2e-spec.ts
- [X] T060 [P] [US5] Update contract tests for numeric IDs in test/contract/auth-api.spec.ts and test/contract/organizations-api.spec.ts

### Implementation for User Story 5

- [X] T061 [P] [US5] Update LoginResponseDto with numeric id and role_assignments in src/modules/auth/application/dto/login-response.dto.ts
- [X] T062 [US5] Update auth and organization DTOs/controllers for int64 path params
- [X] T063 [US5] Amend OpenAPI contract IDs to int64 in specs/001-user-auth/contracts/auth-api.yaml
- [X] T064 [US5] Amend OpenAPI contracts in specs/003-users-roles-permissions/contracts/

**Checkpoint**: ✅ US5 — IDs numéricos + sessão UUID

---

## Phase 8: Auth Integration (Cross-cutting)

**Purpose**: Guards e respostas de auth alinhados ao modelo desacoplado

- [X] T065 Update SessionAuthGuard to load systemRoles and roleAssignments in src/modules/auth/presentation/guards/session-auth.guard.ts
- [X] T066 Update RolesGuard to check systemRoles in src/modules/auth/presentation/guards/roles.guard.ts
- [X] T067 Update PermissionsGuard and OrganizationScopeGuard for assignment-based auth
- [X] T068 Update LoginUseCase and GetCurrentUserUseCase to include role_assignments
- [X] T069 Export USER_ROLE_ASSIGNMENT_REPOSITORY from AuthModule in src/modules/auth/auth.module.ts
- [X] T070 Update test-app.helper seed with roles + assignments in test/integration/test-app.helper.ts

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: Contratos, documentação e cobertura restante

- [X] T071 [P] Update data-model.md for decoupled authorization in specs/003-users-roles-permissions/data-model.md
- [X] T072 [P] Update plan.md for decoupled model in specs/003-users-roles-permissions/plan.md
- [X] T073 [P] Update users-api.yaml with role-assignments endpoints in specs/003-users-roles-permissions/contracts/users-api.yaml
- [X] T074 [P] Update rbac-api.yaml for unified roles table in specs/003-users-roles-permissions/contracts/rbac-api.yaml
- [X] T075 [P] Add contract test for users-api.yaml in test/contract/users-api.spec.ts
- [X] T076 Update quickstart.md with role-assignments flows in specs/003-users-roles-permissions/quickstart.md
- [X] T077 Remove legacy org-role entity files from src/modules/users/infrastructure/persistence/
- [X] T078 Increase e2e testTimeout for Argon2 seed in test/jest-e2e.json

---

## Dependencies & Execution Order

```text
Phase 1 (Setup)
  └─► Phase 2 (Foundational) — BLOCKS all stories
        ├─► Phase 3 (US1 — Perfil) 🎯 MVP
        ├─► Phase 4 (US2 — Atribuições) — depends US1
        ├─► Phase 5 (US3 — Consulta) — depends US1
        ├─► Phase 6 (US4 — RBAC catálogo) — parallel com US2/US3
        ├─► Phase 7 (US5 — IDs) — largely done in Phase 2
        └─► Phase 8 (Auth) — depends US2
              └─► Phase 9 (Polish)
```

### Parallel opportunities

- T023–T024 (US1 tests) em paralelo após Phase 2
- T033–T035 (US2 tests) em paralelo
- T044–T045 (US3 tests) em paralelo
- T071–T074 (docs/contratos) em paralelo

---

## Implementation Strategy

1. **MVP (US1)**: Cadastro de perfil sem papel — já implementado
2. **Core value (US2)**: Atribuições dedicadas — já implementado
3. **Operação (US3–US4)**: Listagem + papéis customizados — já implementado
4. **Concluído**: Testes de integração/unit e contract test users-api implementados

---

## Task Summary

| Phase | Total | Done | Pending |
|-------|-------|------|---------|
| Setup | 5 | 5 | 0 |
| Foundational | 17 | 17 | 0 |
| US1 | 10 | 10 | 0 |
| US2 | 11 | 11 | 0 |
| US3 | 8 | 8 | 0 |
| US4 | 6 | 6 | 0 |
| US5 | 7 | 7 | 0 |
| Auth | 6 | 6 | 0 |
| Polish | 8 | 8 | 0 |
| **Total** | **78** | **78** | **0** |

**MVP scope**: US1 (cadastro perfil) + US2 (atribuição inicial de papel) — implementado.

**Remaining work**: nenhuma — todas as 78 tarefas concluídas.
