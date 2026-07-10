# Data Model: CRUD de Organizations (002)

**Feature**: `002-organizations-crud` | **Date**: 2026-06-15 | **Amended**: 2026-06-15

**Database**: MySQL 8.0 | **Charset**: utf8mb4 | **ORM**: TypeORM

## Entity: organizations

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | CHAR(36) | PK | UUID v4 gerado na aplicação |
| legal_name | VARCHAR(255) | NOT NULL | Razão social |
| trade_name | VARCHAR(255) | NULL | Nome fantasia |
| cnpj | CHAR(14) | NOT NULL, UNIQUE | Apenas dígitos, validado no domínio |
| contact_email | VARCHAR(255) | NULL | E-mail de contato |
| contact_phone | VARCHAR(20) | NULL | Telefone de contato |
| status | ENUM('ACTIVE','INACTIVE') | NOT NULL, DEFAULT 'ACTIVE' | |
| created_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) | |
| updated_at | DATETIME(3) | NOT NULL, ON UPDATE CURRENT_TIMESTAMP(3) | |

### Indexes

- `UNIQUE uk_organizations_cnpj (cnpj)`
- `INDEX idx_organizations_status (status)`
- `INDEX idx_organizations_legal_name (legal_name)`

### TypeORM Entity

`src/modules/organizations/infrastructure/persistence/organization.entity.ts`

### Validation Rules (Domain)

- `legal_name`: 2–255 caracteres, trim aplicado.
- `cnpj`: 14 dígitos, dígitos verificadores válidos (value object `Cnpj`).
- `contact_email`: formato e-mail válido quando informado.
- `contact_phone`: 10–20 caracteres quando informado.
- `cnpj` **imutável** após criação (FR-008).

### State Transitions

```text
[CREATE] ──► ACTIVE
ACTIVE ──► INACTIVE   (deactivate)
INACTIVE ──► ACTIVE   (activate)
```

## Entity: organization_audit_logs

| Field | MySQL Type | Constraints | Notes |
|-------|------------|-------------|-------|
| id | CHAR(36) | PK | UUID v4 |
| organization_id | CHAR(36) | FK → organizations.id, NOT NULL | |
| operation | VARCHAR(50) | NOT NULL | CREATE \| UPDATE \| DEACTIVATE \| ACTIVATE |
| performed_by | CHAR(36) | FK → users.id, NULL | Usuário autenticado |
| changes | JSON | NOT NULL | `{ "field": { "before": x, "after": y } }` |
| created_at | DATETIME(3) | NOT NULL, DEFAULT CURRENT_TIMESTAMP(3) | Imutável |

### Indexes

- `INDEX idx_org_audit_org_created (organization_id, created_at DESC)`

## Relationships

```text
organizations 1 ──► N organization_audit_logs
organizations 1 ──► N users          (001-user-auth)
```

## Integration with 001-user-auth

- Login valida `organizations.status = 'ACTIVE'`.
- `PLATFORM_ADMIN` pode ter `organization_id` NULL.
- Demais usuários referenciam organization existente.

## Pagination Response Shape

```json
{
  "items": [ "Organization" ],
  "page": 1,
  "page_size": 20,
  "total_items": 150,
  "total_pages": 8
}
```

## API Error Codes (HttpExceptionFilter)

| HTTP | ErrorCode | Cenários organizations |
|------|-----------|------------------------|
| 400 | VALIDATION_ERROR | Campos inválidos, CNPJ inválido, CNPJ imutável |
| 401 | UNAUTHORIZED | Token ausente/expirado |
| 403 | FORBIDDEN | Role ≠ PLATFORM_ADMIN |
| 404 | NOT_FOUND | Organization inexistente |
| 409 | CONFLICT | CNPJ duplicado, já inativa, já ativa |
| 500 | INTERNAL_ERROR | Erro não tratado |

Contrato completo com exemplos: [contracts/organizations-api.yaml](./contracts/organizations-api.yaml)
