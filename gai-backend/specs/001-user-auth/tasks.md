# Tasks: Autenticação Segura de Usuários

**Input**: Design documents from `/specs/001-user-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.yaml, **002-organizations-crud complete**

**Tests**: MANDATORY per constitution (≥ 80% coverage). Test tasks precede implementation.

**Organization**: Tasks grouped by user story. Assumes NestJS bootstrap and organizations module from `002-organizations-crud`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Auth Module Scaffold)

**Purpose**: Estrutura do módulo auth no projeto NestJS existente

- [x] T001 Create AuthModule skeleton in src/modules/auth/auth.module.ts
- [x] T002 [P] Register AuthModule in src/app.module.ts
- [x] T003 [P] Add argon2 and @aws-sdk/client-ses dependencies in package.json
- [x] T004 [P] Add @nestjs/throttler for rate limiting in src/app.module.ts
- [x] T005 [P] Add auth environment variables in src/common/config/auth.config.ts

**Checkpoint**: Auth module loads without errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistência, ports e infraestrutura de segurança

**⚠️ CRITICAL**: No user story work until this phase is complete

- [x] T006 Create User TypeORM entity in src/modules/auth/infrastructure/persistence/user.entity.ts
- [x] T007 [P] Create Session entity in src/modules/auth/infrastructure/persistence/session.entity.ts
- [x] T008 [P] Create PasswordResetToken entity in src/modules/auth/infrastructure/persistence/password-reset-token.entity.ts
- [x] T009 [P] Create AuthAuditLog entity in src/modules/auth/infrastructure/persistence/auth-audit-log.entity.ts
- [x] T010 Create migration for auth tables in src/migrations/YYYYMMDDHHMMSS-create-auth-tables.ts
- [x] T011 [P] Create Password value object in src/modules/auth/domain/value-objects/password.ts
- [x] T012 [P] Create User domain entity in src/modules/auth/domain/entities/user.ts
- [x] T013 [P] Create PasswordHasher port in src/modules/auth/domain/ports/password-hasher.port.ts
- [x] T014 [P] Create SessionRepository port in src/modules/auth/domain/ports/session.repository.port.ts
- [x] T015 [P] Create OrganizationGate port in src/modules/auth/domain/ports/organization-gate.port.ts
- [x] T016 Implement Argon2PasswordHasher in src/modules/auth/infrastructure/security/argon2-password-hasher.ts
- [x] T017 Implement TypeOrmSessionRepository in src/modules/auth/infrastructure/persistence/typeorm-session.repository.ts
- [x] T018 Implement OrganizationGate adapter in src/modules/auth/infrastructure/persistence/organization-gate.adapter.ts
- [x] T019 [P] Implement SesEmailSender and MockEmailSender in src/modules/auth/infrastructure/email/ses-email.sender.ts
- [x] T020 Implement SessionAuthGuard in src/modules/auth/presentation/guards/session-auth.guard.ts
- [x] T021 Replace DevAdminGuard with SessionAuthGuard on organizations.controller.ts
- [x] T022 Create bootstrap seed script in src/scripts/seed/bootstrap.ts (PLATFORM_ADMIN + test org + test user)
- [x] T023 [P] Add npm run seed:bootstrap script in package.json

**Checkpoint**: Migrations run; seed creates admin; SessionAuthGuard protects organizations

---

## Phase 3: User Story 1 — Login com Credenciais (Priority: P1) 🎯 MVP

**Goal**: Login, logout, sessão válida e endpoint /auth/me

**Independent Test**: POST /auth/login retorna token; POST /auth/logout invalida; GET /auth/me com/sem token

### Tests for User Story 1 (MANDATORY — write FIRST, ensure FAIL)

- [x] T024 [P] [US1] Unit tests for Password value object in test/unit/modules/auth/password.spec.ts
- [x] T025 [P] [US1] Integration test login/logout/me in test/integration/auth/login.e2e-spec.ts

### Implementation for User Story 1

- [x] T026 [P] [US1] Create LoginDto in src/modules/auth/application/dto/login.dto.ts
- [x] T027 [P] [US1] Create LoginResponseDto and CurrentUserDto in src/modules/auth/application/dto/
- [x] T028 [US1] Implement LoginUseCase with organization ACTIVE check in src/modules/auth/application/use-cases/login.use-case.ts
- [x] T029 [US1] Implement LogoutUseCase in src/modules/auth/application/use-cases/logout.use-case.ts
- [x] T030 [US1] Implement GetCurrentUserUseCase in src/modules/auth/application/use-cases/get-current-user.use-case.ts
- [x] T031 [US1] Implement POST /auth/login, POST /auth/logout, GET /auth/me in src/modules/auth/presentation/auth.controller.ts
- [x] T032 [US1] Write auth audit log on login success/failure in LoginUseCase
- [x] T033 [US1] Add structured logging (operation, userId, result) in auth use cases

**Checkpoint**: US1 testable via quickstart.md §2.1–2.2

---

## Phase 4: User Story 2 — Recuperação de Senha (Priority: P2)

**Goal**: Solicitar reset por e-mail e confirmar nova senha

**Independent Test**: request sempre 200 genérico; confirm com token válido atualiza senha e revoga sessões

### Tests for User Story 2 (MANDATORY — write FIRST, ensure FAIL)

- [x] T034 [P] [US2] Integration test password reset flow in test/integration/auth/password-reset.e2e-spec.ts

### Implementation for User Story 2

- [x] T035 [P] [US2] Create PasswordResetRequestDto in src/modules/auth/application/dto/password-reset-request.dto.ts
- [x] T036 [P] [US2] Create PasswordResetConfirmDto in src/modules/auth/application/dto/password-reset-confirm.dto.ts
- [x] T037 [US2] Implement RequestPasswordResetUseCase in src/modules/auth/application/use-cases/request-password-reset.use-case.ts
- [x] T038 [US2] Implement ConfirmPasswordResetUseCase with session revocation in src/modules/auth/application/use-cases/confirm-password-reset.use-case.ts
- [x] T039 [US2] Implement POST /auth/password-reset/request and /confirm in auth.controller.ts
- [x] T040 [US2] Integrate MockEmailSender/SES in RequestPasswordResetUseCase

**Checkpoint**: US2 independently testable via quickstart §2.5–2.6

---

## Phase 5: User Story 3 — Proteção contra Acessos Indevidos (Priority: P3)

**Goal**: Mensagens genéricas, lockout, rate limit e auditoria completa

**Independent Test**: 6 falhas → 423; mensagem não enumera usuários; auth_audit_logs populado

### Tests for User Story 3 (MANDATORY — write FIRST, ensure FAIL)

- [x] T041 [P] [US3] Integration test lockout and generic errors in test/integration/auth/brute-force-protection.e2e-spec.ts
- [x] T042 [P] [US3] Integration test inactive organization blocks login in test/integration/auth/organization-gate.e2e-spec.ts

### Implementation for User Story 3

- [x] T043 [US3] Implement failed_login_attempts and locked_until logic in LoginUseCase
- [x] T044 [US3] Return generic error messages for invalid credentials in auth.controller.ts
- [x] T045 [US3] Configure ThrottlerModule limits on /auth/login and /auth/password-reset/request
- [x] T046 [US3] Ensure all auth operations write AuthAuditLog without credentials in metadata
- [x] T047 [US3] Reject login for INACTIVE/LOCKED users and inactive organizations in LoginUseCase

**Checkpoint**: US1–US3 security requirements validated

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Contratos, cobertura e validação E2E

- [x] T048 [P] Contract test validating auth-api.yaml in test/contract/auth-api.spec.ts
- [x] T049 [P] Verify coverage ≥ 80% with npm run test:cov; add tests in test/unit/modules/auth/ as needed
- [x] T050 Run full quickstart.md validation (001 + integration with 002)
- [x] T051 [P] Document SESSION_TTL and LOCKOUT config in .env.example
- [x] T052 Remove DevAdminGuard file after SessionAuthGuard fully wired

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Requires 002-organizations-crud bootstrap complete
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on US1 (sessions exist)
- **US3 (Phase 5)**: Depends on US1; enhances login and recovery
- **Polish (Phase 6)**: Depends on US1–US3

### User Story Dependencies

- **US1 (P1)**: After Foundational — no story dependencies
- **US2 (P2)**: After US1 — uses user accounts and sessions
- **US3 (P3)**: After US1 — hardens login; US2 benefits from generic messages

### Parallel Opportunities

- T006–T009 entities in parallel
- T011–T015 ports/value objects in parallel
- T024–T025 tests in parallel
- T026–T027 DTOs in parallel
- T034–T042 integration tests in parallel across stories

---

## Parallel Example: User Story 1

```bash
T024: test/unit/modules/auth/password.spec.ts
T025: test/integration/auth/login.e2e-spec.ts
T026: login.dto.ts
T027: login-response.dto.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1–2: Auth module + seed
2. Phase 3: US1 login/logout/me
3. **STOP**: validate quickstart §2.1–2.2
4. Wire SessionAuthGuard on organizations (T021)

### Incremental Delivery

1. US1 → login operacional + organizations protegidas
2. US2 → recuperação de senha
3. US3 → hardening segurança
4. Polish → cobertura e contratos

---

## Task Summary

| Phase | Tasks | Parallel |
|-------|-------|----------|
| Setup | T001–T005 (5) | 4 |
| Foundational | T006–T023 (18) | 10 |
| US1 Login | T024–T033 (10) | 4 |
| US2 Password Reset | T034–T040 (7) | 3 |
| US3 Security | T041–T047 (7) | 2 |
| Polish | T048–T052 (5) | 3 |
| **Total** | **52** | **26** |
