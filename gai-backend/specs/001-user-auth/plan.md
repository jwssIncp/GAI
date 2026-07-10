# Implementation Plan: Autenticação Segura de Usuários

**Branch**: `001-user-auth` | **Date**: 2026-06-15 | **Amended**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-user-auth/spec.md`

## Summary

Implementar autenticação segura com login/logout por sessão opaca, hashing Argon2id,
recuperação de senha via Amazon SES, rate limiting/lockout, auditoria e integração
com organizations (login bloqueado se tenant inativo). API REST **NestJS/TypeScript**
com camadas SOLID e persistência **MySQL**; implementar após `002-organizations-crud`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)

**Primary Dependencies**: NestJS 11, TypeORM, argon2, @aws-sdk/client-ses, @nestjs/throttler, nestjs-pino, class-validator, uuid

**Storage**: MySQL 8.0 (RDS) — users, sessions, password_reset_tokens, auth_audit_logs

**Testing**: Jest, Supertest, testcontainers (mysql); SES mockado em testes

**Target Platform**: AWS ECS Fargate (Node.js 22 LTS)

**Environments**: Homologação + Produção (AWS Secrets Manager)

**CI/CD**: GitHub Actions — ESLint, Prettier, `npm audit`, Jest, coverage ≥ 80%

**Observability**: nestjs-pino JSON com operation/result/userId → Kibana

**Project Type**: Backend API only

**Repository Scope**: Backend exclusivo; sem frontend

**Performance Goals**: Login p95 < 3 s; 95% recovery requests < 2 min

**Constraints**: HTTPS only; reset TTL 1h; sessão 8h inatividade; mensagens genéricas

**Scale/Scope**: Milhares de usuários; proteção brute-force por conta

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-Design | Post-Design |
|-----------|------|------------|-------------|
| Escopo | Apenas backend/API; sem frontend, UI ou assets de interface | [x] | [x] |
| I. Clean Code | Nomes de domínio, funções coesas, erros explícitos | [x] | [x] |
| II. Arquitetura SOLID | Camadas Domain/Application/Infrastructure definidas; DIP respeitado | [x] | [x] |
| III. Performance (grandes volumes) | Paginação, índices, batch/async e metas de latência documentados | [x] | [x] |
| IV. Cobertura ≥ 80% | Estratégia de testes unitários + integração com gate de cobertura | [x] | [x] |
| V. Integridade de Dados | Transações, auditoria e validações de domínio especificadas | [x] | [x] |
| VI. Infraestrutura AWS | Ambientes homologação/produção isolados; IaC; config externalizada | [x] | [x] |
| VII. CI/CD | Pipeline qualidade automático; deploy homolog/prod sob demanda | [x] | [x] |
| VIII. Observabilidade | Logs JSON com campos Kibana; alertas para erros críticos | [x] | [x] |

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/auth-api.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/modules/auth/
├── domain/
│   ├── entities/user.ts
│   ├── value-objects/password.ts
│   └── ports/
│       ├── password-hasher.port.ts
│       ├── session.repository.port.ts
│       └── organization-gate.port.ts
├── application/
│   └── use-cases/
│       ├── login.use-case.ts
│       ├── logout.use-case.ts
│       ├── request-password-reset.use-case.ts
│       └── confirm-password-reset.use-case.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── user.entity.ts
│   │   ├── session.entity.ts
│   │   └── typeorm-user.repository.ts
│   ├── security/argon2-password-hasher.ts
│   └── email/ses-email.sender.ts
├── presentation/
│   ├── auth.controller.ts
│   ├── guards/session-auth.guard.ts
│   ├── guards/roles.guard.ts
│   └── decorators/roles.decorator.ts
└── auth.module.ts

test/
├── unit/modules/auth/
├── integration/auth/
└── contract/
```

**Structure Decision**: Módulo NestJS `auth` com guards reutilizáveis por `organizations`
e demais módulos futuros. `OrganizationGate` implementado em infrastructure consultando
tabela `organizations`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| PLATFORM_ADMIN sem organization_id | Bootstrap do primeiro admin | Nullable FK apenas para PLATFORM_ADMIN; seed documentado |

## Phase 0 — Research

Concluída em [research.md](./research.md). Stack migrada para TypeScript/NestJS/MySQL.

## Phase 1 — Design

- **Data model**: [data-model.md](./data-model.md)
- **API contract**: [contracts/auth-api.yaml](./contracts/auth-api.yaml)
- **Validation guide**: [quickstart.md](./quickstart.md)

## Dependências

- **002-organizations-crud**: tabela `organizations` e gate `ACTIVE` no login.
- **Amazon SES**: homolog/prod; mock em dev/test.

## Artefatos gerados

| Artefato | Status |
|----------|--------|
| research.md | ✅ (amended) |
| data-model.md | ✅ (amended) |
| contracts/auth-api.yaml | ✅ |
| quickstart.md | ✅ (amended) |
