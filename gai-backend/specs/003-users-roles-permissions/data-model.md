# Data Model: Usuários, Papéis e Permissões Desacopladas (003)

**Feature**: `003-users-roles-permissions` | **Date**: 2026-06-19 | **Revised**: 2026-06-19

**Database**: MySQL 8.0 | **Charset**: utf8mb4 | **ORM**: TypeORM

## Migration Strategy

1. Migration `1739600000001`: schema numérico + tabelas RBAC legadas (`org_roles`, etc.)
2. Migration `1739700000001`: desacoplamento — cria `roles`, `role_permissions`, `user_role_assignments`; migra dados; remove `users.role` e `users.org_role_id`; renomeia `org_role_audit_logs` → `role_audit_logs`

`sessions.id` permanece `CHAR(36)` UUID opaco.

Ambiente dev após merge: `docker compose down -v` ou `npm run migration:run` + `npm run seed:bootstrap`.

---

## Entity: users (profile-only)

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| organization_id | BIGINT UNSIGNED | FK → organizations.id, NULL | NULL para usuários de plataforma |
| login | VARCHAR(100) | NOT NULL, UNIQUE | |
| email | VARCHAR(255) | NOT NULL, UNIQUE | |
| password_hash | VARCHAR(255) | NOT NULL | Argon2id |
| status | ENUM('ACTIVE','INACTIVE','LOCKED') | NOT NULL, DEFAULT 'ACTIVE' | |
| failed_login_attempts | INT | NOT NULL, DEFAULT 0 | |
| locked_until | DATETIME(3) | NULL | |
| password_changed_at | DATETIME(3) | NOT NULL | |
| created_at | DATETIME(3) | NOT NULL | |
| updated_at | DATETIME(3) | NOT NULL | |

**Sem** colunas `role` ou `org_role_id`. Autorização via `user_role_assignments`.

### Indexes

- `UNIQUE uk_users_login (login)`
- `UNIQUE uk_users_email (email)`
- `INDEX idx_users_organization_id (organization_id)`
- `INDEX idx_users_status (status)`

---

## Entity: roles (catálogo unificado)

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| key | VARCHAR(100) | NULL, UNIQUE | Preenchido para papéis SYSTEM (`PLATFORM_ADMIN`, `ORG_ADMIN`) |
| type | ENUM('SYSTEM','ORGANIZATION') | NOT NULL | |
| organization_id | BIGINT UNSIGNED | FK → organizations.id, NULL | NULL para SYSTEM; obrigatório para ORGANIZATION |
| name | VARCHAR(100) | NOT NULL | Unique por `(organization_id, name)` |
| description | VARCHAR(255) | NULL | |
| is_active | TINYINT(1) | NOT NULL, DEFAULT 1 | Soft-disable |
| created_at | DATETIME(3) | NOT NULL | |
| updated_at | DATETIME(3) | NOT NULL | |

### Seeds SYSTEM

| key | name |
|-----|------|
| PLATFORM_ADMIN | Platform Administrator |
| ORG_ADMIN | Organization Administrator |

### Indexes

- `UNIQUE uk_roles_key (key)`
- `UNIQUE uk_roles_org_name (organization_id, name)`
- `INDEX idx_roles_organization_id (organization_id)`
- `INDEX idx_roles_type (type)`

---

## Entity: role_permissions

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| role_id | BIGINT UNSIGNED | PK, FK → roles.id | |
| permission_id | BIGINT UNSIGNED | PK, FK → permissions.id | |

---

## Entity: user_role_assignments

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | `assignment_id` na API |
| user_id | BIGINT UNSIGNED | FK → users.id, NOT NULL | |
| role_id | BIGINT UNSIGNED | FK → roles.id, NOT NULL | |
| is_active | TINYINT(1) | NOT NULL, DEFAULT 1 | Revogação = `is_active=0` + `revoked_at` |
| assigned_by | BIGINT UNSIGNED | FK → users.id, NULL | |
| assigned_at | DATETIME(3) | NOT NULL | |
| revoked_at | DATETIME(3) | NULL | |
| created_at | DATETIME(3) | NOT NULL | |

Um usuário pode ter múltiplas atribuições ativas simultâneas.

### Indexes

- `INDEX idx_user_role_assignments_user_id (user_id)`
- `INDEX idx_user_role_assignments_role_id (role_id)`

---

## Entity: permissions (catálogo global)

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| key | VARCHAR(100) | NOT NULL, UNIQUE | ex.: `users:read` |
| resource | VARCHAR(50) | NOT NULL | |
| action | VARCHAR(50) | NOT NULL | |
| scope | ENUM('PLATFORM','ORGANIZATION') | NOT NULL | |
| description | VARCHAR(255) | NOT NULL | |
| created_at | DATETIME(3) | NOT NULL | |

---

## Entity: sessions (token opaco)

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | CHAR(36) | PK | UUID = access_token |
| user_id | BIGINT UNSIGNED | FK → users.id, NOT NULL | |
| organization_id | BIGINT UNSIGNED | FK → organizations.id, NULL | Snapshot no login |
| expires_at | DATETIME(3) | NOT NULL | |
| revoked_at | DATETIME(3) | NULL | |
| created_at | DATETIME(3) | NOT NULL | |
| last_activity_at | DATETIME(3) | NOT NULL | |

---

## Entity: user_audit_logs

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| user_id | BIGINT UNSIGNED | FK → users.id, NOT NULL | |
| operation | VARCHAR(50) | NOT NULL | CREATE \| UPDATE \| DEACTIVATE \| ACTIVATE |
| performed_by | BIGINT UNSIGNED | FK → users.id, NULL | |
| changes | JSON | NOT NULL | |
| created_at | DATETIME(3) | NOT NULL | |

---

## Entity: role_audit_logs

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| role_id | BIGINT UNSIGNED | FK → roles.id, NOT NULL | |
| operation | VARCHAR(50) | NOT NULL | |
| performed_by | BIGINT UNSIGNED | FK → users.id, NULL | |
| changes | JSON | NOT NULL | |
| created_at | DATETIME(3) | NOT NULL | |

---

## Relationships

```text
organizations 1 ──► N users
organizations 1 ──► N roles (type=ORGANIZATION)
roles N ──► M permissions (via role_permissions)
users N ──► M roles (via user_role_assignments)
users 1 ──► N sessions
users 1 ──► N user_audit_logs (as target)
roles 1 ──► N role_audit_logs
```

---

## Authorization Resolution

```text
Request → SessionAuthGuard:
  1. Carrega user (perfil)
  2. Carrega user_role_assignments ativas
  3. Extrai systemRoles (roles com key PLATFORM_ADMIN | ORG_ADMIN | ORG_USER)
  4. Resolve permissions via união de role_permissions dos papéis ativos

if systemRoles includes PLATFORM_ADMIN:
  bypass total

if systemRoles includes ORG_ADMIN:
  bypass permissões ORGANIZATION na própria org

else:
  allow se permission.key está na união dos papéis atribuídos
```

Papéis de sistema são atribuídos via `user_role_assignments`, não colunas em `users`.

---

## API Response Composition

Respostas compostas (`UserResponse`, `LoginResponse.user`, `CurrentUserResponse`) agregam:

- **Perfil**: `id`, `login`, `email`, `status`, `organization_id`, timestamps
- **Autorização**: `role_assignments[]` com `assignment_id`, `role_id`, `role_key`, `role_name`, `role_type`, `organization_id`, `assigned_at`
