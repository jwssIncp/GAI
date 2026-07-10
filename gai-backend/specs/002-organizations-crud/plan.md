# Implementation Plan: CRUD de Organizations

**Branch**: `002-organizations-crud` | **Date**: 2026-06-15 | **Amended**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-organizations-crud/spec.md`

## Summary

Implementar CRUD completo de **organizations** (tenants do GAI) como API REST em
**TypeScript/NestJS** com camadas SOLID, validação de CNPJ no domínio, paginação,
soft delete via status, auditoria transacional em MySQL e autorização `PLATFORM_ADMIN`.

**Amendment 2026-06-17**: Atualizar ambiente local para stack Docker completo
(`app` + `mysql`), config via `.env` local e AWS Parameter Store em homolog/prod,
e garantir **Swagger/OpenAPI fidedigno** ao backend — contrato canônico em
`contracts/organizations-api.yaml` com schemas completos, status HTTP segmentados
por tipo de erro e fluxos paralelos documentados (fonte para geração do frontend).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)

**Primary Dependencies**: NestJS 11, TypeORM, class-validator, class-transformer, nestjs-pino, @nestjs/swagger, uuid

**Storage**: MySQL 8.0 (local: Docker volume; homolog/prod: Amazon RDS)

**Testing**: Jest, Supertest, @nestjs/testing, testcontainers (mysql), jest coverage ≥ 80%; testes locais no host contra MySQL publicado em `:3306`

**Target Platform**: Local Docker Compose (dev) + AWS ECS Fargate (Linux container Node.js 22 LTS)

**Environments**: **Local** (Docker Compose + `.env`) | **Homologação** | **Produção** (AWS PS + RDS isolados)

**Local Dev Stack**: `docker-compose.yml` — serviços `mysql` (persistente) + `app` (bind mount, hot-reload); entrypoint com bootstrap na 1ª subida e fail-fast em migrations pendentes

**CI/CD**: GitHub Actions — ESLint, Prettier, `npm audit`, Jest, coverage gate; deploy manual

**Observability**: nestjs-pino JSON → CloudWatch → OpenSearch/Kibana (homolog/prod); pino-pretty em local

**API Contract**: OpenAPI 3.1 em `contracts/organizations-api.yaml` (canônico) + Swagger UI em `/api/docs` (runtime, sincronizado)

**Project Type**: Backend API only (`gai-backend`)

**Repository Scope**: Backend exclusivo; sem frontend

**Performance Goals**: Listagem paginada p95 < 500 ms; consulta por ID p95 < 100 ms

**Constraints**: Paginação obrigatória; CNPJ imutável; utf8mb4; sem hard delete; Swagger DEVE documentar todos os status HTTP e códigos de erro por endpoint

**Scale/Scope**: Centenas a milhares de organizations; CRUD administrativo

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
| VI. Infraestrutura AWS | Local + homologação + produção isolados; IaC; config externalizada (`.env` / PS) | [x] | [x] |
| VII. CI/CD | Pipeline qualidade automático; deploy homolog/prod sob demanda | [x] | [x] |
| VIII. Observabilidade | Logs JSON com campos Kibana; alertas para erros críticos | [x] | [x] |

## Project Structure

### Documentation (this feature)

```text
specs/002-organizations-crud/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/organizations-api.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── filters/
│   ├── interceptors/
│   ├── pagination/
│   └── swagger/                    # helpers compartilhados (ApiErrorResponse, etc.)
└── modules/
    └── organizations/
        ├── domain/
        ├── application/
        │   └── dto/                # @ApiProperty em todos os campos
        ├── infrastructure/
        └── presentation/
            └── organizations.controller.ts  # @ApiResponse por status HTTP

scripts/
├── docker-entrypoint.sh            # bootstrap 1ª subida + fail-fast migrations
└── seed/bootstrap.ts

docker-compose.yml                  # mysql + app
Dockerfile                          # dev target com hot-reload
.env.example                        # template local (host tests + compose overrides)

test/
├── unit/modules/organizations/
├── integration/organizations/
└── contract/organizations-api.spec.ts  # validação fidelidade contrato

infra/terraform/                    # RDS, ECS, PS paths
```

**Structure Decision**: Módulo NestJS `organizations` com camadas domain/application/
infrastructure/presentation. Contrato OpenAPI versionado em `specs/` é fonte de verdade
para frontend; decorators NestJS mantêm paridade runtime.

## Swagger Fidelity Strategy

1. **Contrato YAML** (`contracts/organizations-api.yaml`): schemas completos, enum
   `ErrorCode`, exemplos por status, tabela de fluxos paralelos em `description` de
   cada operação.
2. **DTOs**: `@ApiProperty` / `@ApiPropertyOptional` com `enum`, `minLength`, `example`.
3. **Controllers**: `@ApiOperation`, `@ApiResponse` para **cada** status (201, 200, 400,
   401, 403, 404, 409) com `type` ou schema referenciado.
4. **Erros**: `HttpExceptionFilter` já normaliza `{ code, message, details? }`; contrato
   documenta cada `code` por cenário.
5. **Validação**: contract test estendido verifica paths, schemas, status codes e
   `ErrorCode` enum; e2e cobre ramos de erro principais.

## Local Docker Strategy

```text
docker compose up          → mysql (healthy) → entrypoint → app (start:dev)
Primeira subida            → migration:run + seed:bootstrap automáticos
Subidas posteriores        → fail-fast se migration pendente; seeds manuais
Testes (host)              → docker compose up -d mysql; DB_HOST=localhost
Reset banco                → docker compose down -v  (explícito)
```

Compose sobrescreve `DB_HOST=mysql` no serviço `app`; `.env.example` documenta ambos os
cenários (host vs container).

## Complexity Tracking

> Nenhuma violação da constituição identificada.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Phase 0 — Research

Concluída em [research.md](./research.md). Amendments 2026-06-17: R9 (Docker local),
R10 (Swagger fidedigno), R11 (PS), R12 (testes host).

## Phase 1 — Design

- **Data model**: [data-model.md](./data-model.md)
- **API contract**: [contracts/organizations-api.yaml](./contracts/organizations-api.yaml) — **amended 2026-06-17**
- **Validation guide**: [quickstart.md](./quickstart.md) — **amended 2026-06-17**

## Phase 2 — Implementation Backlog (new)

Ver [tasks.md](./tasks.md) **Phase 8**: ambiente Docker local completo + Swagger fidedigno.

## Dependências e ordem

1. Bootstrap NestJS (TypeORM + MySQL + CI + logging).
2. **Esta feature (002)** — organizations CRUD (concluído).
3. **Phase 8** — Docker local + Swagger fidedigno (backlog).
4. `001-user-auth` — validação de tenant no login.

## Artefatos gerados

| Artefato | Status |
|----------|--------|
| research.md | ✅ (amended 2026-06-17) |
| data-model.md | ✅ |
| contracts/organizations-api.yaml | ✅ (amended 2026-06-17) |
| quickstart.md | ✅ (amended 2026-06-17) |
| tasks.md | ✅ (Phase 8 added 2026-06-17) |
