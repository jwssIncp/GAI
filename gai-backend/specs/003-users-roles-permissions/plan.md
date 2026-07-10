# Implementation Plan: Usuários, Papéis e Permissões com Autorização Desacoplada

**Branch**: `003-users-roles-permissions` | **Date**: 2026-06-19 | **Revised**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-users-roles-permissions/spec.md`

## Summary

Refatorar autorização para modelo desacoplado: **`users`** armazena apenas perfil e
`organization_id`; papéis e permissões vivem em **`roles`**, **`role_permissions`** e
**`user_role_assignments`**. PKs/FKs numéricos (BIGINT UNSIGNED); tokens de sessão
permanecem UUID. CRUD de usuários separado de atribuição de papéis; papéis customizados
por organization usam `roles.type = ORGANIZATION`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)

**Primary Dependencies**: NestJS 11, TypeORM, class-validator, class-transformer, nestjs-pino, @nestjs/swagger, uuid (sessions only)

**Storage**: MySQL 8.0 (local: Docker volume; homolog/prod: Amazon RDS)

**Testing**: Jest, Supertest, @nestjs/testing, jest coverage ≥ 80%

**Target Platform**: Local Docker Compose (dev) + AWS ECS Fargate (Linux container Node.js 22 LTS)

**API Contract**: OpenAPI 3.1 em `contracts/users-api.yaml`, `contracts/rbac-api.yaml`; amend em `001-user-auth/contracts/auth-api.yaml`

**Project Type**: Backend API only (`gai-backend`)

**Performance Goals**: Listagem de usuários p95 < 500 ms; resolução de permissões sem N+1 por request

**Constraints**: Paginação obrigatória; tenant isolation para ORG_ADMIN; último PLATFORM_ADMIN protegido; usuário sem papel = acesso negado

## Constitution Check

| Principle | Gate | Status |
|-----------|------|--------|
| Escopo | Apenas backend/API | [x] |
| I. Clean Code | Domínio explícito, erros tipados | [x] |
| II. SOLID | Camadas + DIP | [x] |
| III. Performance | Paginação, índices | [x] |
| IV. Cobertura ≥ 80% | Unit + integration | [x] |
| V. Integridade | Transações + auditoria | [x] |
| IX. IDs numéricos | BIGINT + sessions UUID | [x] |

## Project Structure

```text
src/
├── migrations/
│   ├── 1739600000001-migrate-to-numeric-ids-and-rbac.ts
│   └── 1739700000001-decouple-user-authorization.ts
├── modules/
│   ├── auth/
│   │   ├── application/services/role-authorization.service.ts
│   │   ├── application/use-cases/login.use-case.ts
│   │   └── presentation/guards/session-auth.guard.ts
│   ├── organizations/
│   └── users/
│       ├── domain/ports/user-role-assignment.repository.port.ts
│       ├── application/use-cases/assign-user-role.use-case.ts
│       ├── infrastructure/persistence/role.entity.ts
│       ├── infrastructure/persistence/user-role-assignment.entity.ts
│       └── presentation/
│           ├── users.controller.ts
│           ├── user-role-assignments.controller.ts
│           └── org-roles.controller.ts
└── scripts/seed/bootstrap.ts
```

## Authorization Architecture

```text
@UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN)
@RequirePermissions('users:write')
```

`SessionAuthGuard` popula `request.user` com:
- `systemRoles[]` — extraídos das atribuições ativas
- `roleAssignments[]` — metadados de cada papel
- `permissions[]` — união resolvida via `TypeOrmPermissionResolver`

## Breaking Changes

- `users` não expõe mais `role` nem `org_role_id` em requests/responses
- Respostas incluem `role_assignments[]`
- Atribuição de papéis via `POST /users/{userId}/role-assignments`
- IDs de API: `integer` (int64); sessão: UUID

## Artefatos

| Artefato | Status |
|----------|--------|
| spec.md (revisada) | ✅ |
| data-model.md (revisada) | ✅ |
| contracts/users-api.yaml (revisada) | ✅ |
| contracts/rbac-api.yaml (revisada) | ✅ |
| tasks.md | ✅ |
| quickstart.md | ⚠️ parcial |
