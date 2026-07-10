# Data Model: Autenticação Segura de Usuários (001)

**Feature**: `001-user-auth` | **Date**: 2026-06-15 | **Amended**: 2026-06-15

**Database**: MySQL 8.0 | **Charset**: utf8mb4 | **ORM**: TypeORM

## Entity: users

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | CHAR(36) | PK | UUID v4 |
| organization_id | CHAR(36) | FK → organizations.id, NULL | Nullable para PLATFORM_ADMIN |
| login | VARCHAR(100) | NOT NULL, UNIQUE | Username |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Recuperação de senha |
| password_hash | VARCHAR(255) | NOT NULL | Argon2id |
| role | ENUM('PLATFORM_ADMIN','ORG_ADMIN','ORG_USER') | NOT NULL, DEFAULT 'ORG_USER' | |
| status | ENUM('ACTIVE','INACTIVE','LOCKED') | NOT NULL, DEFAULT 'ACTIVE' | |
| failed_login_attempts | INT | NOT NULL, DEFAULT 0 | Reset em login sucesso |
| locked_until | DATETIME(3) | NULL | Bloqueio temporário |
| password_changed_at | DATETIME(3) | NOT NULL | |
| created_at | DATETIME(3) | NOT NULL | |
| updated_at | DATETIME(3) | NOT NULL | |

### Indexes

- `UNIQUE uk_users_login (login)`
- `UNIQUE uk_users_email (email)`
- `INDEX idx_users_organization_id (organization_id)`
- `INDEX idx_users_status (status)`

## Entity: sessions

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | CHAR(36) | PK | Token opaco = id |
| user_id | CHAR(36) | FK → users.id, NOT NULL | |
| organization_id | CHAR(36) | FK → organizations.id, NULL | Snapshot no login |
| expires_at | DATETIME(3) | NOT NULL | Default: +8h inatividade |
| revoked_at | DATETIME(3) | NULL | Logout ou troca de senha |
| created_at | DATETIME(3) | NOT NULL | |
| last_activity_at | DATETIME(3) | NOT NULL | Renovação de expiração |

### Indexes

- `INDEX idx_sessions_user_id (user_id)`
- `INDEX idx_sessions_expires_at (expires_at)`

## Entity: password_reset_tokens

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | CHAR(36) | PK | |
| user_id | CHAR(36) | FK → users.id, NOT NULL | |
| token_hash | CHAR(64) | NOT NULL | SHA-256 hex |
| expires_at | DATETIME(3) | NOT NULL | TTL 1 hora |
| used_at | DATETIME(3) | NULL | Uso único |
| created_at | DATETIME(3) | NOT NULL | |

### Indexes

- `INDEX idx_reset_tokens_user_id (user_id)`
- `INDEX idx_reset_tokens_hash (token_hash)`

## Entity: auth_audit_logs

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | CHAR(36) | PK | |
| user_id | CHAR(36) | FK → users.id, NULL | NULL se login desconhecido |
| operation | VARCHAR(50) | NOT NULL | LOGIN \| LOGOUT \| LOGIN_FAILED \| ... |
| ip_address | VARCHAR(45) | NULL | IPv4/IPv6 |
| result | VARCHAR(20) | NOT NULL | SUCCESS \| FAILURE |
| metadata | JSON | NULL | Sem credenciais |
| created_at | DATETIME(3) | NOT NULL | |

## Relationships

```text
organizations 1 ──► N users
users 1 ──► N sessions
users 1 ──► N password_reset_tokens
users 1 ──► N auth_audit_logs
```

## Login Flow (LoginUseCase)

1. Resolver user por login ou email.
2. Verificar `user.status` (ACTIVE, não LOCKED).
3. Verificar `organizations.status = 'ACTIVE'` (se organization_id presente).
4. Verificar password via `PasswordHasher` (Argon2id).
5. Criar Session; reset `failed_login_attempts`.
6. Em falha: incrementar attempts; lock se limite atingido.

## Password Reset Flow

1. Receber email → buscar user (resposta genérica sempre).
2. Gerar token raw → persistir hash → enviar e-mail SES.
3. Validar token → atualizar `password_hash`.
4. Revogar sessions; invalidar tokens anteriores.
