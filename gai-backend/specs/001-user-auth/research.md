# Research: Autenticação Segura de Usuários (001)

**Feature**: `001-user-auth` | **Date**: 2026-06-15 | **Amended**: 2026-06-15

> Stack compartilhada em `specs/002-organizations-crud/research.md` (R1, R7, R8).
> Esta feature implementa após o CRUD de organizations.

## R1 — Hashing de senha

**Decision**: Argon2id via pacote `argon2` (Node.js bindings nativos).

**Rationale**: Atende FR-002; OWASP recomendado; integra com `PasswordHasher` provider
injetável no NestJS.

**Alternatives considered**:
- `bcrypt` — amplamente usado, porém Argon2id é preferência OWASP atual.
- `@node-rs/argon2` — alternativa Rust; `argon2` npm tem adoção consolidada.

## R2 — Modelo de sessão

**Decision**: Tokens opacos (UUID v4) em tabela `sessions` via TypeORM; header
`Authorization: Bearer <token>`; guard `SessionAuthGuard` valida token, expiração
e `revoked_at`.

**Rationale**: Revogação em logout e troca de senha (FR-013); sem Redis no MVP.

**Alternatives considered**:
- `@nestjs/jwt` stateless — dificulta revogação global sem blacklist.
- Redis sessions — dependência adicional prematura.

## R3 — Recuperação de senha

**Decision**: Token opaco com hash SHA-256 em `password_reset_tokens`; envio via
`@aws-sdk/client-ses`; resposta genérica sempre (FR-010); TTL 1h.

**Rationale**: Token raw nunca persistido; SES alinhado à AWS.

**Alternatives considered**:
- OTP 6 dígitos — válido, link opaco é padrão corporativo.
- SMS — fora do escopo da spec.

## R4 — Rate limiting e lockout

**Decision**: Colunas `failed_login_attempts` + `locked_until` em `users`; regra:
5 falhas / 15 min → bloqueio 30 min. `ThrottlerModule` (@nestjs/throttler) como
camada adicional por IP.

**Rationale**: Atende FR-011; Throttler é padrão NestJS para rate limit HTTP.

**Alternatives considered**:
- ElastiCache — adicionar na fase 2 se necessário.
- CAPTCHA — fora do escopo inicial.

## R5 — Identificador de login

**Decision**: Campo `login` único + `email` único; endpoint único detecta formato
(contém `@` → busca email, senão login).

**Rationale**: Atende FR-001 e assumptions da spec.

**Alternatives considered**:
- Apenas e-mail — mais restritivo que o pedido.
- Endpoints separados — duplica lógica.

## R6 — Integração com Organizations

**Decision**: `users.organization_id` FK nullable apenas para `PLATFORM_ADMIN`;
`LoginUseCase` valida organization `ACTIVE` via `OrganizationGate` port.

**Rationale**: Modelo multi-tenant do GAI; dependência 002 ↔ 001.

**Alternatives considered**:
- User sem organization — viola modelo multi-tenant.
- Validação no frontend — inseguro.

## R7 — Roles iniciais

**Decision**: Enum `UserRole`: `PLATFORM_ADMIN` | `ORG_ADMIN` | `ORG_USER`;
`@Roles()` decorator + `RolesGuard`.

**Rationale**: Extensível; `PLATFORM_ADMIN` para CRUD de organizations.

**Alternatives considered**:
- RBAC com tabela permissions — over-engineering para MVP.

## R8 — Observabilidade de auth

**Decision**: `nestjs-pino` com `operation`, `userId`, `result`, `correlationId`;
interceptor global registra duração. Sem senhas/tokens em logs.

**Rationale**: Princípio VIII + FR-012 + NFR-008.

**Alternatives considered**:
- Console.log — não estruturado para Kibana.

## R9 — Validação de entrada

**Decision**: `class-validator` + `class-transformer` em DTOs; `ValidationPipe`
global com `whitelist: true` e `forbidNonWhitelisted: true`.

**Rationale**: Padrão NestJS; reforça segurança e Clean Code nos controllers.

**Alternatives considered**:
- Validação manual nos controllers — duplicação e inconsistência.
